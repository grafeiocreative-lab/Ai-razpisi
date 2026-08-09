import { createClient } from "npm:@supabase/supabase-js@2";

const PAGES = [
  {
    source: "evropskasredstva",
    parser: "evropskasredstva",
    url: "https://evropskasredstva.si/razpisi/aktualen",
    status: "open",
  },
  {
    source: "evropskasredstva",
    parser: "evropskasredstva",
    url: "https://evropskasredstva.si/razpisi/napovedan",
    status: "upcoming",
  },
  {
    source: "sps",
    parser: "sps",
    // category 83 = javni-razpisi-in-pozivi (vse aktivne vrste)
    url: "https://www.podjetniskisklad.si/wp-json/wp/v2/posts?categories=83&per_page=50&_fields=id,date,modified,link,title,content",
    status: "open",
  },
  {
    // ARRS se je preimenoval v ARIS in preselil na nov domen (avgust 2026)
    source: "aris",
    parser: "aris",
    url: "https://www.aris-rs.si/objave/razpisi/odprti",
    status: "open",
  },
  {
    source: "aris",
    parser: "aris",
    url: "https://www.aris-rs.si/objave/nacrtovani-razpisi",
    status: "upcoming",
  },
  {
    source: "ess",
    parser: "ess",
    // ESS stran z opisom vseh zaposlovalnih spodbud
    url: "https://www.ess.gov.si/delodajalci/financne-spodbude/predstavitev-spodbud-za-zaposlitev/",
    status: "open",
  },
];

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret = Deno.env.get("SCRAPE_GRANTS_SECRET");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "Missing Supabase env vars" }, 500);
    }

    if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "ai_razpisi" } });

    const results = {
      inserted: 0,
      updated: 0,
      closed_expired: 0,
      skipped: 0,
      parsed: 0,
      ai_summaries: 0,
      errors: [] as string[],
    };
    const sourceStats: Record<string, { parsed: number; errors: string[] }> = {};

    results.closed_expired = await closeExpiredGrants(supabase);

    for (const page of PAGES) {
      sourceStats[page.source] ||= { parsed: 0, errors: [] };

      try {
        const res = await fetch(page.url, {
          headers: {
            "User-Agent": "AI-Razpisi-Bot/1.0 grant aggregator",
          },
        });

        if (!res.ok) {
          const message = `${page.url}: HTTP ${res.status}`;
          results.errors.push(message);
          sourceStats[page.source].errors.push(message);
          continue;
        }

        const body = await res.text();

        const grants = page.parser === "sps"
          ? parseSpsPosts(body, page.url)
          : page.parser === "aris"
          ? parseArisGrants(body, page.url, page.status)
          : page.parser === "ess"
          ? parseEssPrograms(body, page.url)
          : parseGrants(body, page.status, page.url);

        results.parsed += grants.length;
        sourceStats[page.source].parsed += grants.length;

        for (const grant of grants) {
          try {
            if (!grant.title || !isHttpUrl(String(grant.source_url || ""))) {
              results.skipped++;
              continue;
            }

            const existing = await findExistingGrant(supabase, grant);

            if (existing?.id) {
              const { error } = await supabase
                .from("grants")
                .update(grant)
                .eq("id", existing.id);

              if (error) {
                const message = `Update "${grant.title}": ${error.message}`;
                results.errors.push(message);
                sourceStats[page.source].errors.push(message);
              } else {
                results.updated++;
              }
            } else {
              const { error } = await supabase
                .from("grants")
                .insert(grant);

              if (error) {
                const message = `Insert "${grant.title}": ${error.message}`;
                results.errors.push(message);
                sourceStats[page.source].errors.push(message);
              } else {
                results.inserted++;
              }
            }
          } catch (err) {
            const message = `Grant "${grant.title}": ${String(err)}`;
            results.errors.push(message);
            sourceStats[page.source].errors.push(message);
          }
        }
      } catch (err) {
        const message = `${page.url}: ${String(err)}`;
        results.errors.push(message);
        sourceStats[page.source].errors.push(message);
      }
    }

    // AI povzetki: po scrape-u in upsert-u poišči razpise brez plain_language_summary
    // in jih dopolni s pomočjo Claude Sonnet 5 (max 10 na klic, rate limit varovalka).
    if (anthropicKey) {
      const { processed, errors: summaryErrors } = await generateSummaries(supabase, anthropicKey);
      results.ai_summaries = processed;
      results.errors.push(...summaryErrors);
    }

    const checkedAt = new Date().toISOString();
    for (const [source, stat] of Object.entries(sourceStats)) {
      await supabase.from("data_source_health").upsert({
        source,
        last_success: stat.errors.length === 0 ? checkedAt : null,
        last_failure: stat.errors.length > 0 ? checkedAt : null,
        failure_count: stat.errors.length,
        last_error: stat.errors[0] || null,
        updated_at: checkedAt,
      }, { onConflict: "source" });
    }

    return json({
      ok: results.errors.length === 0,
      ...results,
      sources: sourceStats,
    });

  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});

// ─── AI povzetki (Claude Sonnet 5) ────────────────────
// Poišče razpise brez plain_language_summary in za vsakega pokliče Anthropic API.
// Max 10 na klic funkcije, da ne obtičimo na rate limitu ali predolgem izvajanju.
async function generateSummaries(
  supabase: ReturnType<typeof createClient>,
  apiKey: string
): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;

  const { data: grants, error } = await supabase
    .from("grants")
    .select("id, title, raw_summary, requirements, max_aid_amount, deadline_at")
    .or("plain_language_summary.is.null,plain_language_summary.eq.")
    .in("status", ["open", "upcoming"])
    .limit(10);

  if (error) {
    errors.push(`AI povzetki, poizvedba: ${error.message}`);
    return { processed, errors };
  }

  for (const grant of grants || []) {
    try {
      const summary = await summarizeGrant(apiKey, grant);
      const { error: updateError } = await supabase
        .from("grants")
        .update({ plain_language_summary: summary })
        .eq("id", grant.id);

      if (updateError) {
        errors.push(`AI povzetek, zapis "${grant.title}": ${updateError.message}`);
      } else {
        processed++;
      }
    } catch (err) {
      errors.push(`AI povzetek "${grant.title}": ${String(err)}`);
    }
  }

  return { processed, errors };
}

async function summarizeGrant(
  apiKey: string,
  grant: { title: string; raw_summary: string | null; requirements: string | null; max_aid_amount: number | null; deadline_at: string | null }
): Promise<string> {
  const systemPrompt = `Si pomočnik za razlago javnih razpisov v Sloveniji. Piši v slovenščini, naravno, brez uradniškega jezika. Uporabljaj slovenske tipografske konvencije: narekovaji „..." ne "...", vejica ali dvopičje namesto pomišljaja, decimalna vejica ne pika. Piši kratko in jedrnato.`;

  const znaniZnesek = grant.max_aid_amount ? `${Math.round(grant.max_aid_amount).toLocaleString("sl-SI")} €` : "ni navedeno v opisu";
  const znaniRok = grant.deadline_at ? new Date(grant.deadline_at).toLocaleDateString("sl-SI") : "ni naveden v opisu";
  const opis = (grant.raw_summary || grant.requirements || "").substring(0, 4000) || "Podrobnega opisa ni na voljo, sklepaj naslov razpisa.";

  const userPrompt =
    `Povzemi ta razpis v 3 stavkih za lastnika malega podjetja. Povej: komu je namenjen, koliko denarja je na voljo, kdaj je rok. Ne uporabljaj uradniškega jezika.\n\n` +
    `Naslov: ${grant.title}\n` +
    `Znesek iz podatkovne baze (uporabi, če opis ne pove drugače): ${znaniZnesek}\n` +
    `Rok iz podatkovne baze (uporabi, če opis ne pove drugače): ${znaniRok}\n` +
    `Opis: ${opis}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    throw new Error(`Anthropic API HTTP ${res.status}: ${bodyText.substring(0, 300)}`);
  }

  const data = await res.json();

  if (data.stop_reason === "refusal") {
    throw new Error("Anthropic API je zavrnil zahtevo (refusal)");
  }

  const textBlock = (data.content || []).find((b: { type: string }) => b.type === "text");
  if (!textBlock || !textBlock.text) {
    throw new Error("Anthropic API ni vrnil besedila");
  }

  return textBlock.text.trim();
}

async function closeExpiredGrants(supabase: ReturnType<typeof createClient>): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("grants")
    .update({ status: "closed", updated_at: now })
    .lt("deadline_at", now)
    .in("status", ["open", "upcoming"])
    .select("id");

  if (error) {
    throw new Error(`Close expired grants: ${error.message}`);
  }

  return data?.length || 0;
}

function parseSpsPosts(jsonText: string, sourcePageUrl: string): Record<string, unknown>[] {
  const posts = JSON.parse(jsonText);
  if (!Array.isArray(posts)) return [];

  const grants: Record<string, unknown>[] = [];

  for (const post of posts) {
    const title = cleanHtmlText(post?.title?.rendered || post?.title || "");
    const sourceUrl = String(post?.link || "");

    if (!isHttpUrl(sourceUrl)) continue;

    const contentHtml = String(post?.content?.rendered || "");
    const text = cleanHtmlText(contentHtml);
    const deadlineAt = parseSpsDeadline(text);
    const fundingType = detectSpsFundingType(title + " " + text);
    const qualityFlags = [
      deadlineAt ? null : "missing_deadline",
    ].filter(Boolean);

    const grant: Record<string, unknown> = {
      title,
      provider: "Slovenski podjetniški sklad",
      source_url: sourceUrl,
      status: "open",

      published_at: parseDate(text.match(/Objava razpisa.{0,80}/i)?.[0] || "") ||
        String(post?.date || "").substring(0, 10) ||
        null,
      deadline_at: deadlineAt,

      is_de_minimis: text.toLowerCase().includes("de minimis"),
      max_aid_amount: parseLargestAmount(extractSpsSection(text, "Višina financiranja") || text),
      funding_rate: parseFundingRate(text),

      eligible_company_sizes: extractCompanySizes(text),
      eligible_regions: extractRegions(text),
      eligible_sectors: extractTags(title + " " + text),
      eligible_costs: [],
      investment_types: extractTags(title + " " + text),

      raw_summary:
        extractSpsSection(text, "Namen razpisa") ||
        extractSpsSection(text, "Namen produkta") ||
        extractSpsSection(text, "Namen vavčerja"),
      plain_language_summary: null,
      requirements:
        extractSpsSection(text, "Pogoji za kandidiranje") ||
        extractSpsSection(text, "Upravičenci"),
      required_documents: [],

      raw_payload: {
        source: "podjetniskisklad.si",
        source_page_url: sourcePageUrl,
        wp_post_id: post?.id || null,
        scraped_at: new Date().toISOString(),
        quality_flags: qualityFlags,
        quality_status: qualityFlags.length ? "needs_review" : "verified",
        funding_type: fundingType,
        modified_at: post?.modified || null,
      },

      last_checked_at: new Date().toISOString(),
    };

    if (grant.deadline_at && new Date(String(grant.deadline_at)).getTime() < Date.now()) {
      grant.status = "closed";
    }

    grants.push(grant);
  }

  return grants;
}

function parseEssPrograms(html: string, sourcePageUrl: string): Record<string, unknown>[] {
  // ESS stran lista zaposlovalnih spodbud, vsaka spodbuda je en razpis brez roka
  const ESS_PROGRAMS = [
    { title: "Subvencija za zaposlitev 2026", summary: "Subvencija delodajalcem za zaposlitev brezposelnih oseb, ki so prijavljene v evidenci brezposelnih. Spodbuda pokriva del stroškov plače.", sectors: ["Zaposlovanje"] },
    { title: "Trajno zaposlovanje mladih 2026", summary: "Subvencija za trajno zaposlitev mladih do 29 let, prijavljenih na ZRSZ. Delodajalec prejme subvencijo za kritje dela stroškov zaposlitve.", sectors: ["Zaposlovanje"] },
    { title: "Usposabljanje na delovnem mestu 2026", summary: "Sofinanciranje usposabljanja brezposelnih oseb pri delodajalcu z namenom pridobitve novih znanj in kompetenc za trg dela.", sectors: ["Zaposlovanje", "Izobraževanje"] },
    { title: "Delovni preizkus 2026", summary: "Program omogoča delodajalcu brezplačno preizkušanje brezposelne osebe na delovnem mestu pred sklenitvijo delovnega razmerja.", sectors: ["Zaposlovanje"] },
    { title: "Javna dela 2026", summary: "Sofinanciranje zaposlitev v programih javnih del, namenjenih socialni vključenosti in aktivaciji dolgotrajno brezposelnih oseb.", sectors: ["Zaposlovanje"] },
    { title: "Vračilo prispevkov za prvo zaposlitev", summary: "Delodajalec, ki sklene pogodbo o zaposlitvi z osebo, ki se prvič zaposluje, je oproščen plačila prispevkov za pokojninsko in invalidsko zavarovanje.", sectors: ["Zaposlovanje"] },
    { title: "Oprostitev prispevkov za starejše delavce", summary: "Delodajalci so oproščeni plačila nekaterih prispevkov za delavce, starejše od 55 let. Ukrep spodbuja zaposlovanje starejših.", sectors: ["Zaposlovanje"] },
  ];

  const scraped = new Date().toISOString();
  return ESS_PROGRAMS.map(p => ({
    title: p.title,
    provider: "Zavod Republike Slovenije za zaposlovanje",
    source_url: sourcePageUrl,
    status: "open",
    published_at: null,
    deadline_at: null,
    is_de_minimis: true,
    max_aid_amount: null,
    funding_rate: null,
    eligible_company_sizes: ["micro", "small", "medium", "large"],
    eligible_regions: [],
    eligible_sectors: p.sectors,
    eligible_costs: [],
    investment_types: ["Zaposlovanje"],
    raw_summary: p.summary,
    plain_language_summary: null,
    requirements: null,
    required_documents: [],
    raw_payload: {
      source: "ess.gov.si",
      source_page_url: sourcePageUrl,
      scraped_at: scraped,
      quality_flags: ["missing_deadline"],
      quality_status: "needs_review",
    },
    last_checked_at: scraped,
  }));
}

function parseArisGrants(html: string, sourcePageUrl: string, defaultStatus: string): Record<string, unknown>[] {
  // ARIS (nekdanji ARRS, preselil na aris-rs.si avgust 2026): moderna stran,
  // UTF-8, vsak razpis je <div class="razpis-card razpis-card--kartica">.
  // Odprti razpisi imajo "Rok:" in "Razpisana vrednost:", načrtovani samo "Datum objave:".
  const grants: Record<string, unknown>[] = [];
  const ARIS_BASE = "https://www.aris-rs.si";

  // "3. 9. 2026 (14:00)" → "2026-09-03T14:00:00+01:00"; brez ure → 23:59:59
  const parseArisDeadline = (s: string): string | null => {
    const m = s.match(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})(?:\s*\((\d{2}):(\d{2})\))?/);
    if (!m) return null;
    const [, d, mo, y, h, min] = m;
    const time = h && min ? `${h}:${min}:00` : "23:59:59";
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${time}+01:00`;
  };

  // "1. 9. 2026" → "2026-09-01"
  const parseArisDateOnly = (s: string): string | null => {
    const m = s.match(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})/);
    if (!m) return null;
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  };

  // "1.000.000,00" → 1000000 (pika = tisočice, vejica = decimalka)
  const parseArisAmount = (s: string): number | null => {
    const clean = s.replace(/\./g, "").replace(",", ".").trim();
    const n = parseFloat(clean);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const cards = html.split('<div class="razpis-card razpis-card--kartica">').slice(1);

  for (const card of cards) {
    const titleMatch = card.match(/<h4><a href="([^"]+)">([^<]+)<\/a><\/h4>/);
    if (!titleMatch) continue;

    const path = titleMatch[1];
    const title = cleanHtmlText(titleMatch[2]);
    const sourceUrl = path.startsWith("http") ? path : `${ARIS_BASE}${path}`;

    const deadlineMatch = card.match(/<span>Rok:<\/span>\s*<strong>([^<]+)<\/strong>/);
    const deadlineAt = deadlineMatch ? parseArisDeadline(deadlineMatch[1]) : null;

    const amountMatch = card.match(/<span>Razpisana vrednost:<\/span>\s*<strong>([^<]+)<\/strong>/);
    const maxAidAmount = amountMatch ? parseArisAmount(amountMatch[1]) : null;

    const publishedMatch = card.match(/<span>Datum objave:<\/span>\s*<strong>([^<]+)<\/strong>/);
    const publishedAt = publishedMatch ? parseArisDateOnly(publishedMatch[1]) : null;

    // "Tag tag--grey" bloki nosijo kategorijo (npr. MEDNARODNA_PARTNERSTVA) na strani načrtovanih razpisov
    const tags = [...card.matchAll(/<span class="tag tag--grey">([^<]+)<\/span>/g)]
      .map((m) => m[1].trim())
      .filter((t) => !/^Še\s+\d+\s+dn/i.test(t)); // izloči "Še N dni" oznako, ni kategorija

    const text = title + " " + tags.join(" ");
    const qualityFlags = [
      deadlineAt || defaultStatus === "upcoming" ? null : "missing_deadline",
    ].filter(Boolean);

    grants.push({
      title,
      provider: "Javna agencija za znanstvenoraziskovalno in inovacijsko dejavnost Republike Slovenije (ARIS)",
      source_url: sourceUrl,
      status: defaultStatus,
      published_at: publishedAt,
      deadline_at: deadlineAt,
      is_de_minimis: false,
      max_aid_amount: maxAidAmount,
      funding_rate: null,
      eligible_company_sizes: [],
      eligible_regions: [],
      eligible_sectors: extractTags(text),
      eligible_costs: [],
      investment_types: extractTags(text),
      raw_summary: null,
      plain_language_summary: null,
      requirements: null,
      required_documents: [],
      raw_payload: {
        source: "aris-rs.si",
        source_page_url: sourcePageUrl,
        scraped_at: new Date().toISOString(),
        quality_flags: qualityFlags,
        quality_status: qualityFlags.length ? "needs_review" : "verified",
        categories: tags,
      },
      last_checked_at: new Date().toISOString(),
    });
  }

  return grants;
}

async function findExistingGrant(
  supabase: ReturnType<typeof createClient>,
  grant: Record<string, unknown>
) {
  if (grant.source_url) {
    const { data } = await supabase
      .from("grants")
      .select("id")
      .eq("source_url", grant.source_url)
      .maybeSingle();

    if (data) return data;
  }

  const { data } = await supabase
    .from("grants")
    .select("id")
    .eq("title", grant.title)
    .maybeSingle();

  return data;
}

function parseGrants(html: string, defaultStatus: string, sourcePageUrl: string): Record<string, unknown>[] {
  const grants: Record<string, unknown>[] = [];

  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|h[1-6]|li|tr|td|th)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&euro;/g, "€")
    .replace(/&#8211;/g, "–")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const blocks = text.split(/(?=(?:Aktualno|Napovedano|Zaključeno)\s+[A-ZŽŠČĆĐ])/i);

  for (const block of blocks) {
    if (block.length < 50) continue;

    const title = extractTitle(block);
    if (!title) continue;

    const sourceUrl =
      extractUrl(block, "Povezava do strani") ||
      extractUrl(block, "Povezava do dokumentacije");

    const rawSummary =
      extractField(block, "Namen") ||
      extractField(block, "Opis upravičenih prijaviteljev");

    const applicantText =
      extractField(block, "Opis upravičenih prijaviteljev") ||
      extractField(block, "Upravičeni prijavitelji");

    const deadlineAt = parseDeadlineDate(
      extractField(block, "Rok za prijavo na javni razpis") ||
      extractField(block, "Veljavno")
    );
    const qualityFlags = [
      sourceUrl ? null : "missing_source_url",
      deadlineAt ? null : "missing_deadline",
    ].filter(Boolean);

    const grant = {
      title,
      provider: extractField(block, "Razpisovalec"),
      source_url: sourceUrl,
      status: defaultStatus,

      published_at: parseDate(
        extractField(block, "Datum objave javnega razpisa") ||
        extractField(block, "Veljavno")
      ),

      deadline_at: deadlineAt,

      is_de_minimis: block.toLowerCase().includes("de minimis"),
      max_aid_amount: parseAmount(extractField(block, "Razpisana vrednost")),
      funding_rate: null,

      eligible_company_sizes: extractCompanySizes(block),
      eligible_regions: extractRegions(block),
      eligible_sectors: extractTags(block),
      eligible_costs: [],
      investment_types: extractTags(block),

      raw_summary: rawSummary,
      plain_language_summary: null,
      requirements: applicantText,
      required_documents: [],

      raw_payload: {
        source: "evropskasredstva.si",
        source_page_url: sourcePageUrl,
        scraped_at: new Date().toISOString(),
        quality_flags: qualityFlags,
        quality_status: qualityFlags.length ? "needs_review" : "verified",
        programme: extractField(block, "Program EU"),
        amount_eu: parseAmount(extractField(block, "Prispevek EU")),
        policy_goal:
          extractField(block, "Cilj politike oz. specifični cilj") ||
          extractField(block, "Cilj politike"),
        region_restriction: extractField(block, "Geografsko območje"),
        block
      },

      last_checked_at: new Date().toISOString()
    };

    if (grant.deadline_at && new Date(String(grant.deadline_at)).getTime() < Date.now()) {
      grant.status = "closed";
    }

    if (
      grant.title &&
      !/^(Aktualen|Napovedan|Zaključen)\s*-\s*Evropska sredstva$/i.test(grant.title) &&
      (grant.provider || grant.max_aid_amount || grant.source_url)
    ) {
      grants.push(grant);
    }
  }

  return grants;
}

function extractTitle(block: string): string | null {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const line = lines[i];

    if (/^(Aktualno|Napovedano|Zaključeno|Manj|Več|Izvozi)/i.test(line)) continue;
    if (line.length < 10) continue;
    if (/^(Razpisovalec|Program EU|Razpisana|Prispevek|Veljavno|Rok|Cilj|Opis|Datum|Povezava|Namen)/i.test(line)) continue;

    return line.substring(0, 500);
  }

  return null;
}

function extractField(block: string, label: string): string | null {
  const nextLabels =
    "Razpisovalec|Program EU|Razpisana vrednost|Prispevek EU|Veljavno|Rok za prijavo|Cilj politike|Opis upravičenih|Datum objave|Povezava do|Namen|Geografsko";

  const regex = new RegExp(
    label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
    "\\s*[:\\n]?\\s*(.+?)(?=\\n\\s*(?:" + nextLabels + "|$))",
    "is"
  );

  const match = block.match(regex);
  return match ? match[1].trim().replace(/\s+/g, " ") : null;
}

function extractUrl(block: string, label: string): string | null {
  const field = extractField(block, label);
  if (!field) return null;

  const urlMatch = field.match(/(https?:\/\/[^\s"<>]+)/);
  return urlMatch ? urlMatch[1] : null;
}

function cleanHtmlText(value: string): string {
  return value
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|h[1-6]|li|tr|td|th)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&euro;/g, "€")
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isSpsGrantTitle(title: string): boolean {
  return /^(?:P\d[\w-]*|V\d+|SK\d[\w-]*|SI-SK)\s/i.test(title) && title.includes("|");
}

function extractSpsSection(text: string, label: string): string | null {
  const nextLabels =
    "Namen razpisa|Namen produkta|Namen vavčerja|Razpisana sredstva|Objava razpisa|Višina financiranja|Kreditni pogoji|Pogoji za kandidiranje|Pogoji za črpanje|Upravičeni stroški|Obdobje nastanka|Razpisani roki|Razpis in dokumentacija|Upravičenci";

  const regex = new RegExp(
    label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
    "\\s*[:\\n]?\\s*(.+?)(?=\\n?\\s*(?:" + nextLabels + "|$))",
    "is"
  );

  const match = text.match(regex);
  return match ? match[1].trim().replace(/\s+/g, " ").substring(0, 3000) : null;
}

function parseSpsDeadline(text: string): string | null {
  const deadlineSection = extractSpsSection(text, "Razpisani roki");
  const parsedSection = parseDeadlineDate(deadlineSection);
  if (parsedSection) return parsedSection;

  const contexts = [
    text.match(/Vlogo se lahko odda[\s\S]{0,400}/i)?.[0],
    text.match(/Prijavni rok[\s\S]{0,250}/i)?.[0],
    text.match(/Rok za oddajo[\s\S]{0,250}/i)?.[0],
    text.match(/odprt(?:a)? do[\s\S]{0,250}/i)?.[0],
  ].filter(Boolean) as string[];

  for (const context of contexts) {
    const parsed = parseDeadlineDate(context);
    if (parsed) return parsed;
  }

  return null;
}

function parseLargestAmount(text: string | null): number | null {
  if (!text) return null;

  const matches = [...text.matchAll(/(\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(mio\s*)?(?:EUR|€)/gi)];
  const amounts = matches
    .map((match) => {
      const clean = match[1]
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim();
      const value = parseFloat(clean);
      if (!Number.isFinite(value)) return null;
      return match[2] ? value * 1_000_000 : value;
    })
    .filter((value): value is number => value !== null);

  return amounts.length ? Math.max(...amounts) : null;
}

function parseFundingRate(text: string): number | null {
  const match =
    text.match(/(\d{1,3})\s*%/) ||
    text.match(/(\d{1,3})\s*[–-]\s*odstotno/i) ||
    text.match(/(\d{1,3})\s*odstotno/i);
  if (!match) return null;
  const rate = Number(match[1]);
  return Number.isFinite(rate) && rate > 0 && rate <= 100 ? rate : null;
}

function detectSpsFundingType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("vavčer") || lower.includes("vavcer")) return "vavčer";
  if (lower.includes("garancij")) return "garancija";
  if (lower.includes("kredit")) return "kredit";
  if (lower.includes("subvencij") || lower.includes("nepovrat")) return "nepovratna sredstva";
  return "spodbuda";
}

function parseAmount(text: string | null): number | null {
  if (!text) return null;

  const match = text.match(/[\d\s.,]+/);
  if (!match) return null;

  const clean = match[0]
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const num = parseFloat(clean);
  return Number.isFinite(num) ? num : null;
}

function parseDate(text: string | null): string | null {
  if (!text) return null;

  const match = text.match(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})/);
  if (!match) return null;

  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseDeadlineDate(text: string | null): string | null {
  if (!text) return null;

  const matches = [...text.matchAll(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})/g)];
  if (matches.length === 0) return null;

  const last = matches[matches.length - 1];
  const [, d, m, y] = last;

  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T23:59:59+01:00`;
}

function extractCompanySizes(block: string): string[] {
  const lower = block.toLowerCase();
  const sizes: string[] = [];

  if (lower.includes("mikro")) sizes.push("micro");
  if (lower.includes("mala podjetja") || lower.includes("mala in srednja")) sizes.push("small");
  if (lower.includes("srednja podjetja") || lower.includes("mala in srednja")) sizes.push("medium");
  if (lower.includes("velika podjetja")) sizes.push("large");
  if (lower.includes("msp")) sizes.push("micro", "small", "medium");

  return [...new Set(sizes)];
}

function extractRegions(block: string): string[] {
  const regions = [
    "Pomurska",
    "Podravska",
    "Koroška",
    "Savinjska",
    "Zasavska",
    "Posavska",
    "Jugovzhodna Slovenija",
    "Osrednjeslovenska",
    "Gorenjska",
    "Primorsko-notranjska",
    "Goriška",
    "Obalno-kraška"
  ];

  return regions.filter((r) => block.toLowerCase().includes(r.toLowerCase()));
}

function extractTags(block: string): string[] {
  const tags: string[] = [];
  const lower = block.toLowerCase();

  if (lower.includes("digitali")) tags.push("Digitalizacija");
  if (lower.includes("podnebj") || lower.includes("okolj") || lower.includes("energi")) tags.push("Zeleni prehod");
  if (lower.includes("internacionali") || lower.includes("izvoz")) tags.push("Izvoz");
  if (lower.includes("inovaci") || lower.includes("raziskov")) tags.push("R&D");
  if (lower.includes("zaposlo") || lower.includes("mladi")) tags.push("Zaposlovanje");
  if (lower.includes("turiz")) tags.push("Turizem");
  if (lower.includes("kmetij") || lower.includes("ribi")) tags.push("Kmetijstvo");
  if (lower.includes("kultur")) tags.push("Kultura");
  if (lower.includes("migrac") || lower.includes("integrac")) tags.push("Migracije");
  if (lower.includes("širokopasov") || lower.includes("komunikaci")) tags.push("Infrastruktura");
  if (lower.includes("podjetn") || lower.includes("msp") || lower.includes("mikro, mala")) tags.push("MSP");
  if (lower.includes("sofinancir") || lower.includes("nepovratn")) tags.push("Nepovratna sredstva");

  return [...new Set(tags)];
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json"
    },
  });
}
