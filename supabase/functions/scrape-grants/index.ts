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
    // Prej ročno vpisan seznam 7 spodbud (nikoli se ni osvežil). Najden pravi, javen
    // TYPO3 JSON endpoint za ZRSZ "Iskalnik po finančnih spodbudah" (id/type parametra
    // sta iz njihove Angular aplikacije, ne dokumentirana javno, a stabilna in brez ključa) —
    // pravi naslovi, roki, zneski in pristojna institucija za vseh ~17 programov.
    source: "ess",
    parser: "ess",
    url: "https://www.ess.gov.si/?id=351&type=871",
    status: "open",
  },
  {
    // Javni, neavtenticiran JSON API za javno agencijo SPIRIT Slovenija — najden
    // z branjem njihovega Angular JS bundla (stran sama je SPA, brez statičnega HTML seznama).
    source: "spirit",
    parser: "spirit",
    url: "https://www.spiritslovenia.si/api/v1/backend/tender/list",
    status: "open",
  },
  {
    // Vsa ministrstva delijo isto gov.si "javne objave" CMS predlogo (tabela + strani
    // z razdelki Namen/Predmet) — en parser (parseGovSiJavneObjave) pokrije oboje,
    // dodajanje novega ministrstva je samo nov vnos tu.
    source: "mgts",
    parser: "govsi",
    url: "https://www.gov.si/drzavni-organi/ministrstva/ministrstvo-za-gospodarstvo-turizem-in-sport/javne-objave/",
    provider: "Ministrstvo za gospodarstvo, turizem in šport",
    status: "open",
  },
  {
    source: "mkgp",
    parser: "govsi",
    url: "https://www.gov.si/drzavni-organi/ministrstva/ministrstvo-za-kmetijstvo-gozdarstvo-in-prehrano/javne-objave/",
    provider: "Ministrstvo za kmetijstvo, gozdarstvo in prehrano",
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
    // Šteje strani, ki se sploh niso prebrale (HTTP napaka ali izjema pri fetchu/parsanju) —
    // to je edini pravi "izpad" znak. Napake pri posameznem razpisu (vrstica 121+) ali AI
    // povzetku (spodaj) so pričakovane občasne napake enega zapisa, ne izpad celega vira.
    let pageFailures = 0;

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
          pageFailures++;
          continue;
        }

        const body = await res.text();

        const grants = page.parser === "sps"
          ? parseSpsPosts(body, page.url)
          : page.parser === "aris"
          ? parseArisGrants(body, page.url, page.status)
          : page.parser === "ess"
          ? parseEssPrograms(body, page.url)
          : page.parser === "spirit"
          ? await parseSpiritTenders(body, page.url)
          : page.parser === "govsi"
          ? await parseGovSiJavneObjave(body, page.url, page.provider || "Ministrstvo")
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
        pageFailures++;
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
      // "ok" = teden ni popolnoma odpovedal (vsaj ena stran se je prebrala). Posamezne napake
      // pri enem razpisu ali enem AI povzetku so v `errors` za vpogled, a ne sesujejo statusa
      // celega dnevnega teka — sicer en sam manjkajoč AI povzetek javi "failed" GitHub Actionu,
      // čeprav se je večina podatkov pravilno osvežila.
      ok: pageFailures < PAGES.length,
      ...results,
      sources: sourceStats,
    });

  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});

// Ista dnevna varovalka kot v ai-assistant, deljena kvota med obema funkcijama
// prek skupne tabele ai_usage. Nastavljivo prek AI_DAILY_TOKEN_BUDGET secreta.
const DAILY_TOKEN_BUDGET = Number(Deno.env.get("AI_DAILY_TOKEN_BUDGET")) || 300_000;

async function checkAiBudget(supabase: ReturnType<typeof createClient>): Promise<{ ok: boolean; used: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("ai_usage").select("input_tokens, output_tokens").eq("usage_date", today).maybeSingle();
  const used = Number(data?.input_tokens || 0) + Number(data?.output_tokens || 0);
  return { ok: used < DAILY_TOKEN_BUDGET, used };
}

async function recordAiUsage(supabase: ReturnType<typeof createClient>, inputTokens: number, outputTokens: number) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error: selectError } = await supabase.from("ai_usage").select("input_tokens, output_tokens, request_count").eq("usage_date", today).maybeSingle();
  if (selectError) console.error("ai_usage select napaka:", selectError.message);
  const { error: upsertError } = await supabase.from("ai_usage").upsert({
    usage_date: today,
    input_tokens: Number(data?.input_tokens || 0) + inputTokens,
    output_tokens: Number(data?.output_tokens || 0) + outputTokens,
    request_count: Number(data?.request_count || 0) + 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: "usage_date" });
  if (upsertError) console.error("ai_usage upsert napaka:", upsertError.message);
}

// ─── AI povzetki (Claude Sonnet 5) ────────────────────
// Poišče razpise brez plain_language_summary in za vsakega pokliče Anthropic API.
// Max 10 na klic funkcije, da ne obtičimo na rate limitu ali predolgem izvajanju.
async function generateSummaries(
  supabase: ReturnType<typeof createClient>,
  apiKey: string
): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;

  const budget = await checkAiBudget(supabase);
  if (!budget.ok) {
    errors.push("AI povzetki preskočeni: dnevna kvota žetonov je izčrpana");
    return { processed, errors };
  }

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
      const summary = await summarizeGrant(supabase, apiKey, grant);
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
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  grant: { title: string; raw_summary: string | null; requirements: string | null; max_aid_amount: number | null; deadline_at: string | null }
): Promise<string> {
  const systemPrompt = `Si pomočnik za razlago javnih razpisov v Sloveniji. Piši v slovenščini, naravno, brez uradniškega jezika. Uporabljaj slovenske tipografske konvencije: narekovaji „..." ne "...", nikoli ne uporabljaj pomišljaja (– ali —) sredi povedi, uporabi vejico, dvopičje ali piko, decimalna vejica ne pika. Piši kratko in jedrnato.`;

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

  if (data.usage) {
    await recordAiUsage(supabase, Number(data.usage.input_tokens || 0), Number(data.usage.output_tokens || 0));
  }

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

// ZRSZ "Iskalnik po finančnih spodbudah" — realen, javen JSON vir (najden z opazovanjem
// omrežnih klicev njihove Angular aplikacije: isk-fis-www-prod-estoritve.apps.ess.gov.si
// nazadnje pokliče nazaj na glavno TYPO3 stran z ?id=351&type=871, ki vrne {"list":[...]}).
// Nadomešča prejšnji ročno vpisan seznam 7 spodbud, ki se ni nikoli osvežil.
const ESS_INSTITUTIONS: Record<string, string> = {
  ZRSZ: "Zavod Republike Slovenije za zaposlovanje",
  FURS: "Finančna uprava Republike Slovenije",
  ZPIZ: "Zavod za pokojninsko in invalidsko zavarovanje Slovenije",
};

function parseEssPrograms(jsonText: string, sourcePageUrl: string): Record<string, unknown>[] {
  const parsed = JSON.parse(jsonText);
  const items: Array<Record<string, unknown>> = Array.isArray(parsed?.list) ? parsed.list : [];
  const scraped = new Date().toISOString();

  return items.map((it) => {
    const title = cleanHtmlText(String(it.nazivSpodbude || ""));
    const summary = cleanHtmlText(String(it.kratekOpisSpodbude || it.opisSpodbude || ""));
    const sourceUrl = String(it.linkElement || sourcePageUrl);
    const deadlineAt = parseDeadlineDate(String(it.zakljucek || ""));
    const text = title + " " + summary;
    const institution = ESS_INSTITUTIONS[String(it.pristojnaInstitucija || "")] || String(it.pristojnaInstitucija || "ZRSZ");
    const qualityFlags = [deadlineAt ? null : "missing_deadline"].filter(Boolean);

    return {
      title,
      provider: institution,
      source_url: sourceUrl,
      status: deadlineAt && new Date(deadlineAt).getTime() < Date.now() ? "closed" : "open",
      published_at: parseDate(String(it.zacetek || "")),
      deadline_at: deadlineAt,
      is_de_minimis: true,
      max_aid_amount: Number(it.visinaSpodbude) > 0 ? Number(it.visinaSpodbude) : null,
      funding_rate: null,
      eligible_company_sizes: ["micro", "small", "medium", "large"],
      eligible_regions: [],
      eligible_sectors: ["Zaposlovanje", ...extractTags(text)],
      eligible_costs: [],
      investment_types: ["Zaposlovanje"],
      raw_summary: summary || null,
      plain_language_summary: null,
      requirements: null,
      required_documents: [],
      raw_payload: {
        source: "ess.gov.si",
        source_page_url: sourcePageUrl,
        ess_uid: it.uid || null,
        scraped_at: scraped,
        quality_flags: qualityFlags,
        quality_status: qualityFlags.length ? "needs_review" : "verified",
      },
      last_checked_at: scraped,
    };
  });
}

// SPIRIT Slovenija: javen, neavtenticiran JSON API (najden branjem njihovega Angular bundla,
// stran sama je SPA brez statičnega HTML). /tender/list vrne zadnjih ~100 zapisov (aktivnih IN
// arhiviranih pomešano, vsak z "validity" poljem) brez polnega besedila; za vsebino (namen,
// pogoji, znesek) je potreben ločen klic /tender/get?id=X na zapis. Da ne naredimo ~100 dodatnih
// klicev vsak dan za zapise, ki se uporabnikom nikoli ne prikažejo, podrobnosti pridobimo SAMO za
// zapise z validity==="ACTIVE" (v praksi jih je le peščica). Nekaj zapisov na strani ni pravih
// razpisov (npr. splošne pristopne strani) — obdržimo samo naslove, ki dejansko zvenijo kot javni
// razpis/poziv/povabilo.
async function parseSpiritTenders(jsonText: string, sourcePageUrl: string): Promise<Record<string, unknown>[]> {
  const parsed = JSON.parse(jsonText);
  const items: Array<Record<string, unknown>> = Array.isArray(parsed?.data) ? parsed.data : [];
  const active = items.filter(it =>
    it.validity === "ACTIVE" && /razpis|poziv|povabilo|vabilo/i.test(String(it.title || ""))
  );

  const grants: Record<string, unknown>[] = [];
  const CONCURRENCY = 8;

  for (let i = 0; i < active.length; i += CONCURRENCY) {
    const batch = active.slice(i, i + CONCURRENCY);
    const detailed = await Promise.all(batch.map(async (it) => {
      let rawSummary: string | null = null;
      try {
        const detailRes = await fetch(
          `https://www.spiritslovenia.si/api/v1/backend/tender/get?id=${it.id}`,
          { headers: { "User-Agent": "AI-Razpisi-Bot/1.0 grant aggregator" } }
        );
        if (detailRes.ok) {
          const detail = await detailRes.json();
          const snippets: Array<{ content?: string }> = detail?.data?.snippets || [];
          const snippetsText = snippets.map(s => cleanHtmlText(s.content || "")).join("\n\n");
          rawSummary = snippetsText.substring(0, 3000) || null;
        }
      } catch { /* podrobnosti niso na voljo, nadaljujemo samo s podatki iz seznama */ }
      return { it, rawSummary };
    }));

    for (const { it, rawSummary } of detailed) {
      const title = cleanHtmlText(String(it.title || ""));
      if (!title) continue;

      const sourceUrl = `https://www.spiritslovenia.si/${it.link}`;
      const deadlineAt = it.endTime ? new Date(String(it.endTime)).toISOString() : null;
      const text = title + " " + (rawSummary || "");
      const qualityFlags = [deadlineAt ? null : "missing_deadline"].filter(Boolean);

      grants.push({
        title,
        provider: "SPIRIT Slovenija",
        source_url: sourceUrl,
        status: deadlineAt && new Date(deadlineAt).getTime() < Date.now() ? "closed" : "open",
        published_at: it.publishDate || null,
        deadline_at: deadlineAt,
        is_de_minimis: /de minimis/i.test(text),
        max_aid_amount: parseLargestAmount(rawSummary),
        funding_rate: parseFundingRate(rawSummary || ""),
        eligible_company_sizes: extractCompanySizes(text),
        eligible_regions: extractRegions(text),
        eligible_sectors: extractTags(text),
        eligible_costs: [],
        investment_types: extractTags(text),
        raw_summary: rawSummary,
        plain_language_summary: null,
        requirements: null,
        required_documents: [],
        raw_payload: {
          source: "spiritslovenia.si",
          source_page_url: sourcePageUrl,
          spirit_id: it.id,
          scraped_at: new Date().toISOString(),
          quality_flags: qualityFlags,
          quality_status: qualityFlags.length ? "needs_review" : "verified",
        },
        last_checked_at: new Date().toISOString(),
      });
    }
  }

  return grants;
}

// Vsa ministrstva na gov.si delijo isto CMS predlogo za "javne objave": seznamska stran je
// HTML tabela (<td class="td-title/td-published-date/td-due-date">), posamezna objava pa
// <article class="tender-page"> z besedilnimi razdelki (Namen, Predmet, Upravičenci ...).
// En parser torej pokrije poljubno število ministrstev — glej PAGES zgoraj za dodajanje novih.
// Podrobno vsebino (za raw_summary) pridobimo samo za objave, ki še niso potekle, da ne
// nalagamo strežnika z nepotrebnimi klici za zaprte razpise.
async function parseGovSiJavneObjave(html: string, sourcePageUrl: string, provider: string): Promise<Record<string, unknown>[]> {
  const GOVSI_BASE = "https://www.gov.si";
  const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];

  type Row = { title: string; path: string; deadlineAt: string | null };
  const parsedRows: Row[] = [];

  for (const [, row] of rows) {
    const titleMatch = row.match(/td-title[\s\S]*?<a href="([^"]+)">([^<]+)<\/a>/);
    if (!titleMatch) continue;

    const title = cleanHtmlText(titleMatch[2]);
    if (!/razpis|poziv|povabilo|vabilo|vavčer|natečaj/i.test(title)) continue;

    const dueMatch = row.match(/td-due-date[\s\S]*?cell">([^<]*)<\/div>/);
    const deadlineAt = dueMatch ? parseDeadlineDate(dueMatch[1]) : null;

    parsedRows.push({ title, path: titleMatch[1], deadlineAt });
  }

  const grants: Record<string, unknown>[] = [];
  const CONCURRENCY = 6;
  const now = Date.now();
  const open = parsedRows.filter(r => !r.deadlineAt || new Date(r.deadlineAt).getTime() >= now);
  const closed = parsedRows.filter(r => r.deadlineAt && new Date(r.deadlineAt).getTime() < now);

  for (let i = 0; i < open.length; i += CONCURRENCY) {
    const batch = open.slice(i, i + CONCURRENCY);
    const detailed = await Promise.all(batch.map(async (r) => {
      let rawSummary: string | null = null;
      try {
        const url = r.path.startsWith("http") ? r.path : `${GOVSI_BASE}${r.path}`;
        const detailRes = await fetch(url, { headers: { "User-Agent": "AI-Razpisi-Bot/1.0 grant aggregator" } });
        if (detailRes.ok) {
          const detailHtml = await detailRes.text();
          const article = detailHtml.match(/<article class="tender-page">([\s\S]*?)<\/article>/);
          rawSummary = cleanHtmlText(article ? article[1] : detailHtml).substring(0, 3000) || null;
        }
      } catch { /* podrobnosti niso na voljo, nadaljujemo samo s podatki iz seznama */ }
      return { r, rawSummary };
    }));

    for (const { r, rawSummary } of detailed) {
      grants.push(buildGovSiGrant(r, rawSummary, provider, sourcePageUrl, "open"));
    }
  }

  // Zaprte objave: obdržimo samo osnovne podatke (naslov/rok), brez dodatnih klicev za vsebino.
  for (const r of closed) {
    grants.push(buildGovSiGrant(r, null, provider, sourcePageUrl, "closed"));
  }

  return grants;
}

function buildGovSiGrant(
  row: { title: string; path: string; deadlineAt: string | null },
  rawSummary: string | null,
  provider: string,
  sourcePageUrl: string,
  status: string
): Record<string, unknown> {
  const sourceUrl = row.path.startsWith("http") ? row.path : `https://www.gov.si${row.path}`;
  const text = row.title + " " + (rawSummary || "");
  const qualityFlags = [row.deadlineAt ? null : "missing_deadline"].filter(Boolean);

  return {
    title: row.title,
    provider,
    source_url: sourceUrl,
    status,
    published_at: null,
    deadline_at: row.deadlineAt,
    is_de_minimis: /de minimis/i.test(text),
    max_aid_amount: parseLargestAmount(rawSummary),
    funding_rate: parseFundingRate(rawSummary || ""),
    eligible_company_sizes: extractCompanySizes(text),
    eligible_regions: extractRegions(text),
    eligible_sectors: extractTags(text),
    eligible_costs: [],
    investment_types: extractTags(text),
    raw_summary: rawSummary,
    plain_language_summary: null,
    requirements: null,
    required_documents: [],
    raw_payload: {
      source: "gov.si",
      source_page_url: sourcePageUrl,
      scraped_at: new Date().toISOString(),
      quality_flags: qualityFlags,
      quality_status: qualityFlags.length ? "needs_review" : "verified",
    },
    last_checked_at: new Date().toISOString(),
  };
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
