import { createClient } from "npm:@supabase/supabase-js@2";

const PAGES = [
  { url: "https://evropskasredstva.si/razpisi/aktualen", status: "open" },
  { url: "https://evropskasredstva.si/razpisi/napovedan", status: "upcoming" },
];

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "Missing Supabase env vars" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const results = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };

    for (const page of PAGES) {
      try {
        const res = await fetch(page.url, {
          headers: { "User-Agent": "AI-Razpisi-Bot/1.0 (grant aggregator)" },
        });

        if (!res.ok) {
          results.errors.push(`${page.url}: HTTP ${res.status}`);
          continue;
        }

        const html = await res.text();
        const grants = parseGrants(html, page.status);

        for (const grant of grants) {
          try {
            // Preveri ali razpis že obstaja (po naslovu)
            const { data: existing } = await supabase
              .from("grants")
              .select("id")
              .eq("title", grant.title)
              .maybeSingle();

            if (existing?.id) {
              // Posodobi obstoječi
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
              // Vstavi nov
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
            results.errors.push(`"${grant.title}": ${String(err)}`);
          }
        }
      } catch (err) {
        results.errors.push(`${page.url}: ${String(err)}`);
      }
    }

    // ── Posodobi health check ──
    await supabase.from("data_source_health").upsert({
      source: "evropskasredstva",
      last_success: results.errors.length === 0 ? new Date().toISOString() : undefined,
      last_failure: results.errors.length > 0 ? new Date().toISOString() : undefined,
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

// ═══════════════════════════════════════════════════
//  HTML PARSER
// ═══════════════════════════════════════════════════

function parseGrants(html: string, defaultStatus: string): Record<string, unknown>[] {
  const grants: Record<string, unknown>[] = [];

  // Odstrani HTML tage, ohrani strukturo
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
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Razdeli po vzorcu "Aktualno" ali "Napovedano" (status oznaka pred naslovom)
  const blocks = text.split(/(?=(?:Aktualno|Napovedano|Zaključeno)\s+[A-ZŽŠČĆĐ])/i);

  for (const block of blocks) {
    if (block.length < 50) continue;

    const title = extractTitle(block);
    if (!title) continue;

    const grant: Record<string, unknown> = {
      title,
      funder: extractField(block, "Razpisovalec"),
      programme: extractField(block, "Program EU"),
      description_raw: extractField(block, "Namen") ||
                       extractField(block, "Opis upravičenih prijaviteljev") || null,
      eligible_applicants: extractField(block, "Opis upravičenih prijaviteljev") ||
                           extractField(block, "Upravičeni prijavitelji") || null,
      amount_total: parseAmount(extractField(block, "Razpisana vrednost")),
      amount_eu: parseAmount(extractField(block, "Prispevek EU")),
      policy_goal: extractField(block, "Cilj politike oz. specifični cilj") ||
                   extractField(block, "Cilj politike") || null,
      source_url: extractUrl(block, "Povezava do strani") ||
                  extractUrl(block, "Povezava do dokumentacije") || null,
      valid_from: parseDate(extractField(block, "Datum objave javnega razpisa") ||
                            extractField(block, "Veljavno")),
      deadline: parseDeadlineDate(
        extractField(block, "Rok za prijavo na javni razpis") ||
        extractField(block, "Veljavno")
      ),
      status: defaultStatus,
      region_restriction: extractField(block, "Geografsko območje") || null,
      funding_type: "Nepovratna sredstva",
      is_de_minimis: false,
      tags: extractTags(block),
      raw_data: { source: "evropskasredstva.si", scraped_at: new Date().toISOString() },
    };

    // Preskoči brez naslova ali brez vsaj enega uporabnega polja
    if (grant.title && (grant.funder || grant.amount_total || grant.source_url)) {
      grants.push(grant);
    }
  }

  return grants;
}

function extractTitle(block: string): string | null {
  // Naslov je prva dolga vrstica po statusu (Aktualno/Napovedano)
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    // Preskoči status oznake in kratke vrstice
    if (/^(Aktualno|Napovedano|Zaključeno|Manj|Več|Izvozi)/i.test(line)) continue;
    if (line.length < 10) continue;
    // Preskoči filter oznake
    if (/^(Razpisovalec|Program EU|Razpisana|Prispevek|Veljavno|Rok|Cilj|Opis|Datum|Povezava|Namen)/i.test(line)) continue;
    return line.substring(0, 500);
  }
  return null;
}

function extractField(block: string, label: string): string | null {
  // Poišči vzorec: "Label" sledi besedilo do naslednje oznake
  const regex = new RegExp(
    label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
    "\\s*[:\\n]?\\s*(.+?)(?=\\n\\s*(?:Razpisovalec|Program EU|Razpisana vrednost|Prispevek EU|Veljavno|Rok za prijavo|Cilj politike|Opis upravičenih|Datum objave|Povezava do|Namen|Geografsko|$))",
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
  // Odstrani EUR, €, presledke, zamenjaj vejico s piko
  const clean = text
    .replace(/EUR/gi, "")
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function parseDate(text: string | null): string | null {
  if (!text) return null;
  // Vzorec: dd.mm.yyyy ali dd. mm. yyyy
  const match = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (!match) return null;
  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseDeadlineDate(text: string | null): string | null {
  if (!text) return null;
  // Poišči zadnji datum v besedilu (pri "Od - Do" vzame Do)
  const matches = [...text.matchAll(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/g)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const [, d, m, y] = last;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
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
    headers: { "Content-Type": "application/json" },
  });
}