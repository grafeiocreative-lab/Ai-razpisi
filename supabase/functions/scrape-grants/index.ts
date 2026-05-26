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
    source: "arrs",
    parser: "arrs",
    url: "https://www.arrs.si/sl/razpisi/26/pregled-razpisov-26.asp",
    status: "open",
  },
];

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret = Deno.env.get("SCRAPE_GRANTS_SECRET");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "Missing Supabase env vars" }, 500);
    }

    if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const results = {
      inserted: 0,
      updated: 0,
      closed_expired: 0,
      skipped: 0,
      parsed: 0,
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

        // ARRS uses Windows-1250 encoding — must decode from bytes
        let body: string;
        if (page.parser === "arrs") {
          const bytes = await res.arrayBuffer();
          body = new TextDecoder("windows-1250").decode(bytes);
        } else {
          body = await res.text();
        }

        const grants = page.parser === "sps"
          ? parseSpsPosts(body, page.url)
          : page.parser === "arrs"
          ? parseArrsGrants(body, page.url)
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

function parseArrsGrants(html: string, sourcePageUrl: string): Record<string, unknown>[] {
  const grants: Record<string, unknown>[] = [];
  const BASE = "https://www.arrs.si/sl/";

  // Resolve relative URL like "../../inovac/razpisi/26/razp.asp" from /sl/razpisi/26/
  const resolveUrl = (rel: string): string => {
    if (rel.startsWith("http")) return rel;
    // Strip leading ../../ and prepend base
    const clean = rel.replace(/^(?:\.\.\/)+/, "");
    return BASE + clean;
  };

  // Parse Slovenian date "10.06.2026" → "2026-06-10T23:59:59+01:00"
  const parseSlDate = (s: string): string | null => {
    const m = s.match(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})/);
    if (!m) return null;
    return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}T23:59:59+01:00`;
  };

  // Amount: "1.000.000" (period = thousands sep) → 1000000
  const parseArrsAmount = (s: string): number | null => {
    const clean = s.replace(/\./g, "").replace(",", ".").trim();
    const n = parseFloat(clean);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  // Each data row: <tr> with 6-7 <td> cells
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const rowMatch of rows) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(m => m[1]);
    if (cells.length < 5) continue;

    // Col 2 (index 2): title + link
    const titleCell = cells[2] || "";
    const linkMatch = titleCell.match(/href="([^"]+\.asp)"/i);
    if (!linkMatch) continue;

    const title = titleCell.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (title.length < 10) continue;

    const sourceUrl = resolveUrl(linkMatch[1]);

    // Col 1 (index 1): publication date
    const pubDateRaw = cells[1]?.replace(/<[^>]+>/g, "").trim() || "";
    const publishedAt = parseSlDate(pubDateRaw)?.substring(0, 10) || null;

    // Col 3 (index 3): status text
    const statusText = (cells[3] || "").replace(/<[^>]+>/g, "").trim().toLowerCase();
    const status = statusText.includes("zaklju") ? "closed"
      : statusText.includes("napoved") ? "upcoming"
      : "open";

    // Col 4 (index 4): deadline — take last date found
    const deadlineCell = (cells[4] || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ");
    const allDates = [...deadlineCell.matchAll(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})/g)];
    const deadlineAt = allDates.length
      ? parseSlDate(allDates[allDates.length - 1][0])
      : null;

    // Col 6 (index 6): amount
    const amountCell = (cells[6] || "").replace(/<[^>]+>/g, "").trim();
    const maxAidAmount = parseArrsAmount(amountCell);

    const text = title + " " + (cells[4] || "");
    const qualityFlags = [
      deadlineAt ? null : "missing_deadline",
    ].filter(Boolean);

    grants.push({
      title,
      provider: "Javna agencija za znanstvenoraziskovalno in inovacijsko dejavnost Republike Slovenije",
      source_url: sourceUrl,
      status,
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
        source: "arrs.si",
        source_page_url: sourcePageUrl,
        scraped_at: new Date().toISOString(),
        quality_flags: qualityFlags,
        quality_status: qualityFlags.length ? "needs_review" : "verified",
        status_text: statusText,
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
