import { createClient } from "npm:@supabase/supabase-js@2";

const JODP_URL = "https://jodp.mf.gov.si";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json({ ok: false, error: "POST only" }, 405);
    }

    const body = await safeJson(req);
    const maticna = String(body.registration_number || body.maticna || "").trim();
    const debug = Boolean(body.debug);

    if (!maticna) {
      return json({ ok: false, error: "Manjka registration_number" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "Missing Supabase env vars" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const debugInfo: Record<string, unknown> = {};

    const step1 = await fetch(`${JODP_URL}/Domov`, {
      headers: browserHeaders(),
    });

    if (!step1.ok) {
      return json({ ok: false, error: `JODP step1 HTTP ${step1.status}` }, 500);
    }

    const html1 = await step1.text();
    const cookies1 = extractCookies(step1.headers);
    const tokens1 = extractTokens(html1);

    if (!tokens1.__VIEWSTATE) {
      return json({
        ok: false,
        error: "Ni VIEWSTATE v koraku 1",
        htmlSnippet: html1.substring(0, 1000),
      }, 500);
    }

    const but1Name = findFieldName(html1, "but1") || "ctl00$MainContent$but1";
    const but1Value = findButtonValue(html1, but1Name) || "";

    if (debug) {
      debugInfo.step1 = {
        tokens: Object.keys(tokens1),
        but1Name,
        but1Value,
        cookies: cookies1.substring(0, 120),
      };
    }

    const form2: Record<string, string> = {
      __VIEWSTATE: tokens1.__VIEWSTATE,
      __EVENTVALIDATION: tokens1.__EVENTVALIDATION || "",
      [but1Name]: but1Value,
    };

    if (tokens1.__VIEWSTATEGENERATOR) {
      form2.__VIEWSTATEGENERATOR = tokens1.__VIEWSTATEGENERATOR;
    }

    const step2 = await fetch(`${JODP_URL}/Domov`, {
      method: "POST",
      headers: {
        ...browserHeaders(),
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies1,
      },
      body: new URLSearchParams(form2).toString(),
      redirect: "manual",
    });

    let html2 = "";
    let cookies2 = mergeCookies(cookies1, extractCookies(step2.headers));
    let step2FinalUrl = `${JODP_URL}/Domov`;

    if (step2.status >= 300 && step2.status < 400) {
      const loc = step2.headers.get("location") || "";
      step2FinalUrl = absoluteUrl(loc);
      const r2 = await fetch(step2FinalUrl, {
        headers: {
          ...browserHeaders(),
          Cookie: cookies2,
        },
      });
      html2 = await r2.text();
      cookies2 = mergeCookies(cookies2, extractCookies(r2.headers));
    } else {
      html2 = await step2.text();
    }

    const tokens2 = extractTokens(html2);

    const inputName =
      findFieldName(html2, "Maticna") ||
      findFieldName(html2, "maticna") ||
      findFieldName(html2, "txtMaticna") ||
      findFieldName(html2, "tbMaticna") ||
      findInputByType(html2, "search") ||
      findInputByType(html2, "text");

    const btnName =
      findFieldName(html2, "btnIsci") ||
      findFieldName(html2, "Isci") ||
      findFieldName(html2, "btnSearch") ||
      findSubmitButton(html2);

    const formAction = findFormAction(html2) || step2.headers.get("location") || "./Domov";
    const postUrl = absoluteUrl(formAction);

    if (debug) {
      const allInputs = [...html2.matchAll(/<input[^>]*name="([^"]+)"[^>]*>/gi)].map((m) => m[1]);
      const allButtons = [...html2.matchAll(/<input[^>]*type="submit"[^>]*name="([^"]+)"/gi)].map((m) => m[1]);

      debugInfo.step2 = {
        status: step2.status,
        finalUrl: step2FinalUrl,
        formAction,
        postUrl,
        tokens: Object.keys(tokens2),
        inputName,
        btnName,
        allInputs: allInputs.slice(0, 30),
        allButtons,
        htmlSnippet: html2.substring(0, 2500),
      };
    }

    if (!tokens2.__VIEWSTATE || !inputName) {
      return json({
        ok: false,
        error: "Ni VIEWSTATE ali input polja v koraku 2",
        inputName,
        btnName,
        debug: debugInfo,
      }, 500);
    }

    const form3: Record<string, string> = {
      __VIEWSTATE: tokens2.__VIEWSTATE,
      __EVENTVALIDATION: tokens2.__EVENTVALIDATION || "",
      [inputName]: maticna,
    };

    if (tokens2.__VIEWSTATEGENERATOR) {
      form3.__VIEWSTATEGENERATOR = tokens2.__VIEWSTATEGENERATOR;
    }

    if (btnName) {
      form3[btnName] = "Išči";
    }

    const step3 = await fetch(postUrl, {
      method: "POST",
      headers: {
        ...browserHeaders(),
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies2,
      },
      body: new URLSearchParams(form3).toString(),
      redirect: "manual",
    });

    let html3 = "";
    let cookies3 = mergeCookies(cookies2, extractCookies(step3.headers));

    if (step3.status >= 300 && step3.status < 400) {
      const loc = step3.headers.get("location") || "";
      const url3 = absoluteUrl(loc);
      const r3 = await fetch(url3, {
        headers: {
          ...browserHeaders(),
          Cookie: cookies3,
        },
      });
      html3 = await r3.text();
      cookies3 = mergeCookies(cookies3, extractCookies(r3.headers));
    } else {
      html3 = await step3.text();
    }

    if (debug) {
      debugInfo.step3 = {
        status: step3.status,
        postUrl,
        htmlLength: html3.length,
        hasTable: html3.includes("<table"),
        hasGrid: html3.includes("grid") || html3.includes("Grid"),
        tablesFound: (html3.match(/<table/gi) || []).length,

        gridIds: [...html3.matchAll(/id="([^"]*(?:grid|Grid|gv|GV|dxgv)[^"]*)"/gi)]
          .map((m) => m[1])
          .slice(0, 5),

        gridSnippets: [...html3.matchAll(/(<[^>]+id="[^"]*(?:grid|Grid|dxgv)[^"]*"[\s\S]{0,3000})/gi)]
          .map((m) => m[1])
          .slice(0, 5),

        allTables: (html3.match(/<table[\s\S]*?<\/table>/gi) || [])
          .map((t, i) => ({
            index: i,
            length: t.length,
            snippet: t.substring(0, 3000),
          }))
          .slice(0, 10),

        gridCandidates: [...html3.matchAll(/id="([^"]*?(?:grid|Grid|gv|GV|dx))/gi)]
          .map((m) => m[1])
          .slice(0, 20),

        dxFragments: [...html3.matchAll(/.{0,300}(dxgv|dxGrid|dxrp|dxpc).{0,300}/gi)]
          .map((m) => m[0])
          .slice(0, 10),

        tailHtml: html3.substring(html3.length - 6000),

        buttonTargets: [...html3.matchAll(/WebForm_PostBackOptions\(&quot;([^&]+)&quot;/gi)]
          .map((m) => m[1])
          .slice(0, 20),
      };
    }

    const tokens3 = extractTokens(html3);

const form4: Record<string, string> = {
  __VIEWSTATE: tokens3.__VIEWSTATE,
  __EVENTVALIDATION: tokens3.__EVENTVALIDATION || "",
  __EVENTTARGET: "ctl00$MainContent$ctl01",
  __EVENTARGUMENT: "",
  "ctl00$MainContent$txtMaticnaStevilka": maticna,
};

if (tokens3.__VIEWSTATEGENERATOR) {
  form4.__VIEWSTATEGENERATOR = tokens3.__VIEWSTATEGENERATOR;
}

const step4 = await fetch(`${JODP_URL}/Domov`, {
  method: "POST",
  headers: {
    ...browserHeaders(),
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: cookies3,
  },
  body: new URLSearchParams(form4).toString(),
});

const html4 = await step4.text();

if (debug) {
  debugInfo.step4 = {
    status: step4.status,
    htmlLength: html4.length,
    hasTable: html4.includes("<table"),
    tablesFound: (html4.match(/<table/gi) || []).length,

    dtoRows: [...html4.matchAll(
      /<tr[^>]*id="MainContent_pnlDTO_gvDTO_DXDataRow\d+"[\s\S]*?<\/tr>/gi
    )]
      .map((m, i) => ({
        index: i,
        snippet: m[0].substring(0, 2000)
      }))
      .slice(0,5),

    tailHtml: html4.substring(html4.length - 6000),
  };
}

    const records = parseDeMinimisRecords(html4, maticna);

    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("registration_number", maticna)
      .maybeSingle();

    let saved = 0;
    const errors: string[] = [];

    if (company?.id && records.length > 0) {
      for (const rec of records) {
        const { error } = await supabase
          .from("de_minimis_records")
          .insert({
            company_id: company.id,
            provider: rec.source,
            programme: rec.legal_basis,
            amount: rec.amount,
            granted_date: rec.date_awarded || `${rec.year}-01-01`,
            source_url: `${JODP_URL}/Domov`,
            source_payload: rec.raw,
          });

        if (error) {
          errors.push(error.message);
        } else {
          saved++;
        }
      }
    }

    await supabase.from("data_source_health").upsert({
      source: "jodp",
      last_success: new Date().toISOString(),
      failure_count: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "source" });

    const result: Record<string, unknown> = {
      ok: true,
      version: "fetch-jodp-2026-05-22-browserHeaders-ok",
      maticna,
      company_id: company?.id || null,
      records_found: records.length,
      records_saved: saved,
      records,
      errors,
    };

    if (debug) {
      result.debug = debugInfo;
    }

    return json(result);
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});

function parseDeMinimisRecords(html: string, maticna: string): Record<string, any>[] {
  const records: Record<string, any>[] = [];

  const rows = [...html.matchAll(
    /<tr[^>]*id="MainContent_pnlDTO_gvDTO_DXDataRow\d+"[^>]*>([\s\S]*?)<\/tr>/gi
  )];

  for (const rowMatch of rows) {
    const rowHtml = rowMatch[1];

    const cells = [...rowHtml.matchAll(/<td[^>]*class="[^"]*dxgv[^"]*"[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((m) => cleanHtmlText(m[1]))
      .filter((v) => v && v !== "..." && v !== "X");

    if (cells.length < 6) continue;

    const rowNumber = cells[0];
    const dateAwarded = parseSlovenianDate(cells[1]);
    const mssiNumber = cells[2];
    const source = cells[3];
    const legalBasis = cells[4];
    const amount = parseAmount(cells[5]);

    const year = dateAwarded
      ? Number(dateAwarded.substring(0, 4))
      : new Date().getFullYear();

    if (amount > 0) {
      records.push({
        year,
        source,
        amount,
        legal_basis: legalBasis,
        date_awarded: dateAwarded,
        raw: {
          maticna,
          rowNumber,
          mssiNumber,
          cells,
        },
      });
    }
  }

  return records;
}

function findValue(row: Record<string, string>, hints: string[]): string | null {
  for (const [key, value] of Object.entries(row)) {
    for (const hint of hints) {
      if (key.includes(hint)) return value;
    }
  }

  return null;
}
function cleanHtmlText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSlovenianDate(value: string): string | null {
  const match = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;

  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseAmount(value: string): number {
  const cleaned = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const number = parseFloat(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function browserHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
}

function extractCookies(headers: Headers): string {
  try {
    const setCookies = headers.getSetCookie?.() || [];
    return setCookies
      .map((c) => c.split(";")[0])
      .join("; ");
  } catch {
    const raw = headers.get("set-cookie") || "";
    return raw
      .split(",")
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");
  }
}
function extractTokens(html: string): Record<string, string> {
  const tokens: Record<string, string> = {};

  for (const field of [
    "__VIEWSTATE",
    "__VIEWSTATEGENERATOR",
    "__EVENTVALIDATION",
  ]) {
    const match = html.match(
      new RegExp(`id="${field}"[^>]*value="([^"]*)"`, "i")
    );

    if (match) {
      tokens[field] = match[1];
    }
  }

  return tokens;
}
function absoluteUrl(path: string) {
  if (!path) return `${JODP_URL}/Domov`;
  if (path.startsWith("http")) return path;

  const cleaned = path
    .replace(/^\.\//, "")
    .replace(/^\//, "");

  return `${JODP_URL}/${cleaned}`;
}

function findFormAction(html: string): string | null {
  const match = html.match(/<form[^>]*action="([^"]+)"/i);
  return match ? match[1] : null;
}

function findButtonValue(html: string, name: string): string {
  const escaped = name.replace(/\$/g, "\\$");
  const regex = new RegExp(`name="${escaped}"[^>]*value="([^"]*)"`, "i");
  const match = html.match(regex);
  return match ? match[1] : "";
}

function findInputByType(html: string, type: string): string | null {
  const regex = new RegExp(`<input[^>]*type="${type}"[^>]*name="([^"]+)"`, "i");
  const match = html.match(regex);
  return match ? match[1] : null;
}

function findSubmitButton(html: string): string | null {
  const match = html.match(/<input[^>]*type="submit"[^>]*name="([^"]+)"/i);
  return match ? match[1] : null;
}

function findFieldName(html: string, hint: string): string | null {
  const regex = new RegExp(`name="([^"]*${hint}[^"]*)"`, "i");
  const match = html.match(regex);
  return match ? match[1] : null;
}

function mergeCookies(a: string, b: string): string {
  if (!b) return a;
  if (!a) return b;

  const map: Record<string, string> = {};

  for (const part of `${a}; ${b}`.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) {
      map[part.substring(0, eq).trim()] = part.substring(eq + 1).trim();
    }
  }

  return Object.entries(map)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}


