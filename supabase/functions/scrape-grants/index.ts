import { createClient } from "npm:@supabase/supabase-js@2";

const PAGES = [
  { url: "https://evropskasredstva.si/razpisi/aktualen", status: "open" },
  { url: "https://evropskasredstva.si/razpisi/napovedan", status: "upcoming" },
];

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "Missing Supabase env vars" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const results = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      parsed: 0,
      errors: [] as string[],
    };

    for (const page of PAGES) {
      try {
        const res = await fetch(page.url, {
          headers: {
            "User-Agent": "AI-Razpisi-Bot/1.0 grant aggregator",
          },
        });

        if (!res.ok) {
          results.errors.push(`${page.url}: HTTP ${res.status}`);
          continue;
        }

        const html = await res.text();
        const grants = parseGrants(html, page.status);

        results.parsed += grants.length;

        for (const grant of grants) {
          try {
            if (!grant.title) {
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
                results.errors.push(`Update "${grant.title}": ${error.message}`);
              } else {
                results.updated++;
              }
            } else {
              const { error } = await supabase
                .from("grants")
                .insert(grant);

              if (error) {
                results.errors.push(`Insert "${grant.title}": ${error.message}`);
              } else {
                results.inserted++;
              }
            }
          } catch (err) {
            results.errors.push(`Grant "${grant.title}": ${String(err)}`);
          }
        }
      } catch (err) {
        results.errors.push(`${page.url}: ${String(err)}`);
      }
    }

    await supabase.from("data_source_health").upsert({
      source: "evropskasredstva",
      last_success: results.errors.length === 0 ? new Date().toISOString() : null,
      last_failure: results.errors.length > 0 ? new Date().toISOString() : null,
      failure_count: results.errors.length,
      last_error: results.errors[0] || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "source" });

    return json({
      ok: results.errors.length === 0,
      ...results,
    });

  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});

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

function parseGrants(html: string, defaultStatus: string): Record<string, unknown>[] {
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

    const grant = {
      title,
      provider: extractField(block, "Razpisovalec"),
      source_url: sourceUrl,
      status: defaultStatus,

      published_at: parseDate(
        extractField(block, "Datum objave javnega razpisa") ||
        extractField(block, "Veljavno")
      ),

      deadline_at: parseDeadlineDate(
        extractField(block, "Rok za prijavo na javni razpis") ||
        extractField(block, "Veljavno")
      ),

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
        scraped_at: new Date().toISOString(),
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

    if (grant.title && (grant.provider || grant.max_aid_amount || grant.source_url)) {
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

  const match = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (!match) return null;

  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseDeadlineDate(text: string | null): string | null {
  if (!text) return null;

  const matches = [...text.matchAll(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/g)];
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

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json"
    },
  });
}