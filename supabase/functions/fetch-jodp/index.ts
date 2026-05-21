import { createClient } from "npm:@supabase/supabase-js@2";

const JODP_URL = "https://jodp.mf.gov.si";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ error: "POST only" }, 405);

    const body = await req.json();
    const maticna = String(body.registration_number || body.maticna || "").trim();
    if (!maticna) return json({ error: "Manjka registration_number ali maticna" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: "Missing env" }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Korak 1: GET domača stran, pridobi tokene ──
    const step1 = await fetch(`${JODP_URL}/Domov`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!step1.ok) return json({ ok: false, error: "JODP step1 failed", status: step1.status }, 500);

    const html1 = await step1.text();
    const cookies1 = extractCookies(step1.headers);
    const tokens1 = extractTokens(html1);

    if (!tokens1.__VIEWSTATE) {
      return json({ ok: false, error: "Ni VIEWSTATE v koraku 1" }, 500);
    }

    // ── Korak 2: POST "Podjetja" gumb ──
    const formData2 = new URLSearchParams({
      __VIEWSTATE: tokens1.__VIEWSTATE,
      __VIEWSTATEGENERATOR: tokens1.__VIEWSTATEGENERATOR || "",
      __EVENTVALIDATION: tokens1.__EVENTVALIDATION || "",
      "ctl00$MainContent$but1": "Podjetja\r\n  \r\n(po matični številki)",
    });

    const step2 = await fetch(`${JODP_URL}/Domov`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        "Cookie": cookies1,
      },
      body: formData2.toString(),
      redirect: "manual",
    });

    // ASP.NET lahko redirecta
    let html2: string;
    let cookies2 = cookies1;

    if (step2.status >= 300 && step2.status < 400) {
      const redirectUrl = step2.headers.get("location") || "";
      const fullUrl = redirectUrl.startsWith("http") ? redirectUrl : `${JODP_URL}${redirectUrl}`;
      cookies2 = mergeCookies(cookies1, extractCookies(step2.headers));

      const step2b = await fetch(fullUrl, {
        headers: { "User-Agent": "Mozilla/5.0", "Cookie": cookies2 },
      });
      html2 = await step2b.text();
      cookies2 = mergeCookies(cookies2, extractCookies(step2b.headers));
    } else {
      html2 = await step2.text();
      cookies2 = mergeCookies(cookies1, extractCookies(step2.headers));
    }

    const tokens2 = extractTokens(html2);

    if (!tokens2.__VIEWSTATE) {
      return json({ ok: false, error: "Ni VIEWSTATE v koraku 2", htmlLength: html2.length }, 500);
    }

    // ── Korak 3: POST matična številka ──
    // Poišči ime input polja za matično
    const inputName = findInputName(html2, "maticna") || "ctl00$MainContent$tbMaticna";
    const buttonName = findButtonName(html2, "isci") || "ctl00$MainContent$btnIsci";

    const formData3 = new URLSearchParams({
      __VIEWSTATE: tokens2.__VIEWSTATE,
      __VIEWSTATEGENERATOR: tokens2.__VIEWSTATEGENERATOR || "",
      __EVENTVALIDATION: tokens2.__EVENTVALIDATION || "",
      [inputName]: maticna,
      [buttonName]: "Išči",
    });

    const step3 = await fetch(`${JODP_URL}/Podjetja`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        "Cookie": cookies2,
      },
      body: formData3.toString(),
      redirect: "manual",
    });

    let html3: string;
    if (step3.status >= 300 && step3.status < 400) {
      const loc = step3.headers.get("location") || "";
      const url3 = loc.startsWith("http") ? loc : `${JODP_URL}${loc}`;
      const cookies3 = mergeCookies(cookies2, extractCookies(step3.headers));
      const step3b = await fetch(url3, {
        headers: { "User-Agent": "Mozilla/5.0", "Cookie": cookies3 },
      });
      html3 = await step3b.text();
    } else {
      html3 = await step3.text();
    }

    // ── Korak 4: Parsaj rezultate ──
    const records = parseDeMinimisRecords(html3, maticna);

    // ── Korak 5: Poišči podjetje v bazi ──
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("registration_number", maticna)
      .or(`maticna.eq.${maticna}`)
      .maybeSingle();

    let saved = 0;
    const errors: string[] = [];

    if (company?.id && records.length > 0) {
      for (const rec of records) {
        const { error } = await supabase
          .from("de_minimis_records")
          .upsert({
            company_id: company.id,
            year: rec.year,
            source: rec.source,
            amount: rec.amount,
            legal_basis: rec.legal_basis,
            date_awarded: rec.date_awarded,
            jodp_raw: rec.raw,
            fetched_at: new Date().toISOString(),
            confirmed: false,
          }, { onConflict: "company_id,year,source,amount" });

        if (error) errors.push(error.message); else saved++;
      }

      // Posodobi company jodp timestamp
      await supabase
        .from("companies")
        .update({ jodp_fetched_at: new Date().toISOString() })
        .eq("id", company.id);
    }

    // ── Health check ──
    await supabase.from("data_source_health").upsert({
      source: "jodp",
      last_success: new Date().toISOString(),
      failure_count: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "source" });

    return json({
      ok: true,
      maticna,
      company_id: company?.id || null,
      records_found: records.length,
      records_saved: saved,
      records,
      errors,
    });
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});

// ═══ ASP.NET helpers ═══

function extractTokens(html: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const field of ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"]) {
    const regex = new RegExp(`id="${field}"[^>]*value="([^"]*)"`, "i");
    const match = html.match(regex);
    if (match) tokens[field] = match[1];
  }
  return tokens;
}

function extractCookies(headers: Headers): string {
  const setCookies = headers.getSetCookie?.() || [];
  return setCookies.map(c => c.split(";")[0]).join("; ");
}

function mergeCookies(existing: string, fresh: string): string {
  if (!fresh) return existing;
  if (!existing) return fresh;
  const map: Record<string, string> = {};
  for (const part of `${existing}; ${fresh}`.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k && v) map[k.trim()] = v.trim();
  }
  return Object.entries(map).map(([k, v]) => `${k}=${v}`).join("; ");
}

function findInputName(html: string, hint: string): string | null {
  const regex = new RegExp(`<input[^>]*(?:id|name)="([^"]*${hint}[^"]*)"`, "i");
  const match = html.match(regex);
  return match ? match[1].replace(/\$/g, "$") : null;
}

function findButtonName(html: string, hint: string): string | null {
  const regex = new RegExp(`<input[^>]*(?:id|name)="([^"]*${hint}[^"]*)"[^>]*type="submit"`, "i");
  const match = html.match(regex);
  if (match) return match[1];
  // Fallback: button element
  const regex2 = new RegExp(`<button[^>]*(?:id|name)="([^"]*${hint}[^"]*)"`, "i");
  const match2 = html.match(regex2);
  return match2 ? match2[1] : null;
}

// ═══ De minimis parser ═══

function parseDeMinimisRecords(html: string, maticna: string): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];

  // Poišči tabelo z rezultati
  const tableMatch = html.match(/<table[^>]*class="[^"]*grid[^"]*"[^>]*>([\s\S]*?)<\/table>/i) ||
                     html.match(/<table[^>]*id="[^"]*grid[^"]*"[^>]*>([\s\S]*?)<\/table>/i) ||
                     html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi);

  if (!tableMatch) {
    // Morda ni tabele — preveri ali piše "ni podatkov"
    if (html.includes("ni podatkov") || html.includes("Ni zapisov") || html.includes("ni zapisov")) {
      return [];
    }
    // Poskusi parsati iz teksta
    return parseFromText(html, maticna);
  }

  const tableHtml = Array.isArray(tableMatch) ? tableMatch.join("") : tableMatch[1] || tableMatch[0];

  // Parsaj vrstice
  const rows = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  let headerCols: string[] = [];

  for (const row of rows) {
    const cells = (row.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) || [])
      .map(c => c.replace(/<[^>]+>/g, "").trim());

    if (cells.length === 0) continue;

    // Prva vrstica = headerji
    if (headerCols.length === 0 && (row.includes("<th") || cells.some(c => /leto|znesek|dajalec|pravna|pomoč/i.test(c)))) {
      headerCols = cells;
      continue;
    }

    if (cells.length < 3) continue;

    const rec = mapRow(headerCols, cells, maticna);
    if (rec) records.push(rec);
  }

  return records;
}

function parseFromText(html: string, maticna: string): Record<string, unknown>[] {
  // Fallback: parsaj iz čistega teksta
  const text = html.replace(/<[^>]+>/g, "\n").replace(/\s+/g, " ");
  const records: Record<string, unknown>[] = [];

  // Poišči vzorce: leto + znesek + dajalec
  const yearAmountRegex = /(\d{4})\s+[\d.,]+\s+€?\s*([\d.,]+)/g;
  let match;
  while ((match = yearAmountRegex.exec(text)) !== null) {
    const year = parseInt(match[1]);
    if (year < 2020 || year > 2030) continue;
    records.push({
      year,
      source: "JODP",
      amount: parseFloat(match[2].replace(/\./g, "").replace(",", ".")),
      legal_basis: null,
      date_awarded: null,
      raw: { maticna, text: text.substring(Math.max(0, match.index - 100), match.index + 200) },
    });
  }

  return records;
}

function mapRow(headers: string[], cells: string[], maticna: string): Record<string, unknown> | null {
  const row: Record<string, string> = {};
  headers.forEach((h, i) => { row[h.toLowerCase()] = cells[i] || ""; });

  // Poišči ključna polja po različnih možnih imenih
  const year = parseInt(findVal(row, ["leto", "year", "obdobje"]) || "0");
  const amount = parseFloat(
    (findVal(row, ["znesek", "amount", "višina", "vrednost"]) || "0")
      .replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")
  );
  const source = findVal(row, ["dajalec", "vir", "organ", "source", "institucija"]) || "JODP";
  const legalBasis = findVal(row, ["pravna", "podlaga", "uredba", "zakon"]) || null;

  if (!year || year < 2000 || !amount) return null;

  return {
    year,
    source,
    amount,
    legal_basis: legalBasis,
    date_awarded: null,
    raw: { maticna, headers, cells },
  };
}

function findVal(row: Record<string, string>, hints: string[]): string | null {
  for (const [key, val] of Object.entries(row)) {
    for (const hint of hints) {
      if (key.includes(hint)) return val;
    }
  }
  return null;
}

function json(p: unknown, s = 200) {
  return new Response(JSON.stringify(p, null, 2), { status: s, headers: { "Content-Type": "application/json" } });
}