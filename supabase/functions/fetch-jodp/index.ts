import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  const JODP_URL = "https://jodp.mf.gov.si";

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload, null, 2), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const safeJson = async (r: Request) => { try { return await r.json(); } catch { return {}; } };

  const browserHeaders = () => ({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  });

  const extractCookies = (headers: Headers): string => {
    try {
      const sc = (headers as any).getSetCookie?.() || [];
      return sc.map((c: string) => c.split(";")[0]).join("; ");
    } catch {
      return (headers.get("set-cookie") || "")
        .split(",").map((c: string) => c.split(";")[0].trim()).filter(Boolean).join("; ");
    }
  };

  const mergeCookies = (a: string, b: string): string => {
    if (!b) return a;
    if (!a) return b;
    const map: Record<string, string> = {};
    for (const part of (a + "; " + b).split(";")) {
      const eq = part.indexOf("=");
      if (eq > 0) map[part.substring(0, eq).trim()] = part.substring(eq + 1).trim();
    }
    return Object.entries(map).map(([k, v]) => k + "=" + v).join("; ");
  };

  const extractTokens = (html: string): Record<string, string> => {
    const tokens: Record<string, string> = {};
    for (const field of ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"]) {
      const m = html.match(new RegExp('id="' + field + '"[^>]*value="([^"]*)"', "i"));
      if (m) tokens[field] = m[1];
    }
    return tokens;
  };

  const absoluteUrl = (path: string): string => {
    if (!path) return JODP_URL + "/Domov";
    if (path.startsWith("http")) return path;
    return JODP_URL + "/" + path.replace(/^\.\//, "").replace(/^\//, "");
  };

  const cleanHtmlText = (value: string): string =>
    value
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

  const parseSlovenianDate = (value: string): string | null => {
    const m = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!m) return null;
    const [, d, mo, y] = m;
    return y + "-" + mo.padStart(2, "0") + "-" + d.padStart(2, "0");
  };

  const parseAmount = (value: string): number => {
    const n = parseFloat(value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const parseDeMinimisRecords = (html: string, maticna: string): Record<string, unknown>[] => {
    const records: Record<string, unknown>[] = [];
    const rows = [...html.matchAll(
      /<tr[^>]*id="MainContent_pnlDTO_gvDTO_DXDataRow\d+"[^>]*>([\s\S]*?)<\/tr>/gi
    )];
    for (const rowMatch of rows) {
      const cells = [...rowMatch[1].matchAll(/<td[^>]*class="[^"]*dxgv[^"]*"[^>]*>([\s\S]*?)<\/td>/gi)]
        .map((m) => cleanHtmlText(m[1]))
        .filter((v) => v && v !== "..." && v !== "X");
      if (cells.length < 6) continue;
      const dateAwarded = parseSlovenianDate(cells[1]);
      const amount = parseAmount(cells[5]);
      const year = dateAwarded ? Number(dateAwarded.substring(0, 4)) : new Date().getFullYear();
      if (amount > 0) {
        records.push({
          year, source: cells[3], amount,
          legal_basis: cells[4], date_awarded: dateAwarded,
          raw: { maticna, rowNumber: cells[0], mssiNumber: cells[2], cells },
        });
      }
    }
    return records;
  };

  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

    const body = await safeJson(req);
    const maticna = String(body.registration_number || body.maticna || "").trim();
    const debug = Boolean(body.debug);

    if (!maticna) return json({ ok: false, error: "Manjka registration_number" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: "Missing Supabase env vars" }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const debugInfo: Record<string, unknown> = {};

    // Davčna → Matična resolution: davčna je 8-mestna, matična je 10-mestna
    let resolvedMaticna = maticna;
    const isDavcna = maticna.length === 8;
    if (isDavcna) {
      const { data: byTax } = await supabase
        .from("prs_cache")
        .select("registration_number")
        .eq("tax_number", maticna)
        .maybeSingle();
      if (byTax?.registration_number) {
        resolvedMaticna = byTax.registration_number;
      } else {
        const { data: byCo } = await supabase
          .from("companies")
          .select("registration_number")
          .eq("tax_number", maticna)
          .maybeSingle();
        if (byCo?.registration_number) resolvedMaticna = byCo.registration_number;
      }
      if (resolvedMaticna === maticna) {
        // Zadnji poskus: VIES EU DDV validacija vrne firmo → iščemo v prs_cache po imenu
        try {
          const viesResp = await fetch(
            `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/SI/vat/${maticna}`
          );
          if (viesResp.ok) {
            const vies = await viesResp.json();
            if (vies.isValid && vies.name) {
              // Vzami besedi pred prvim vejico kot iskalni niz
              const searchName = vies.name.split(",")[0].trim();
              const { data: byName } = await supabase
                .from("prs_cache")
                .select("registration_number")
                .ilike("company_name", `${searchName}%`)
                .limit(1)
                .maybeSingle();
              if (byName?.registration_number) {
                resolvedMaticna = byName.registration_number;
                // Zakešaj davčno za prihodnje iskanje
                await supabase
                  .from("prs_cache")
                  .update({ tax_number: maticna })
                  .eq("registration_number", resolvedMaticna);
              }
            }
          }
        } catch { /* VIES ni dosegljiv — preskočimo */ }
      }

      if (resolvedMaticna === maticna) {
        return json({
          ok: false,
          is_davcna: true,
          company_in_jodp: false,
          maticna,
          error: "Davčna številka ni bila najdena v bazi. Prosimo, vnesite matično številko (10 mest).",
        }, 200);
      }
    }

    // Step1: GET /Domov — establishes __AntiXsrfToken session cookie and gets ViewState
    const step1 = await fetch(JODP_URL + "/Domov", { headers: browserHeaders() });
    if (!step1.ok) return json({ ok: false, error: "JODP step1 HTTP " + step1.status }, 500);

    const html1 = await step1.text();
    const cookies1 = extractCookies(step1.headers);
    const tokens1 = extractTokens(html1);

    if (!tokens1.__VIEWSTATE) {
      return json({ ok: false, error: "Ni VIEWSTATE v koraku 1", htmlSnippet: html1.substring(0, 500) }, 500);
    }

    if (debug) debugInfo.step1 = { tokens: Object.keys(tokens1), hasCookie: cookies1.includes("AntiXsrf") };

    // Step2: POST __EVENTTARGET=but1 — navigate to Podjetja search tab.
    // but1 is a LinkButton so it uses __EVENTTARGET, not a form field name/value.
    const form2: Record<string, string> = {
      __VIEWSTATE: tokens1.__VIEWSTATE,
      __EVENTVALIDATION: tokens1.__EVENTVALIDATION || "",
      __EVENTTARGET: "ctl00$MainContent$but1",
      __EVENTARGUMENT: "",
    };
    if (tokens1.__VIEWSTATEGENERATOR) form2.__VIEWSTATEGENERATOR = tokens1.__VIEWSTATEGENERATOR;

    const step2 = await fetch(JODP_URL + "/Domov", {
      method: "POST",
      headers: { ...browserHeaders(), "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies1 },
      body: new URLSearchParams(form2).toString(),
      redirect: "manual",
    });

    let html2 = "";
    let cookies2 = mergeCookies(cookies1, extractCookies(step2.headers));

    if (step2.status >= 300 && step2.status < 400) {
      const r2 = await fetch(absoluteUrl(step2.headers.get("location") || ""), {
        headers: { ...browserHeaders(), Cookie: cookies2 },
      });
      html2 = await r2.text();
      cookies2 = mergeCookies(cookies2, extractCookies(r2.headers));
    } else {
      html2 = await step2.text();
    }

    const tokens2 = extractTokens(html2);
    if (debug) debugInfo.step2 = { status: step2.status, but1Active: /but1[^>]*disabled/i.test(html2) };

    if (!tokens2.__VIEWSTATE) {
      return json({ ok: false, error: "Ni VIEWSTATE v koraku 2", debug: debugInfo }, 500);
    }

    // Step3: POST maticna with no EventTarget — registers the search term in ViewState
    const form3: Record<string, string> = {
      __VIEWSTATE: tokens2.__VIEWSTATE,
      __EVENTVALIDATION: tokens2.__EVENTVALIDATION || "",
      "ctl00$MainContent$txtMaticnaStevilka": resolvedMaticna,
    };
    if (tokens2.__VIEWSTATEGENERATOR) form3.__VIEWSTATEGENERATOR = tokens2.__VIEWSTATEGENERATOR;

    const step3 = await fetch(JODP_URL + "/Domov", {
      method: "POST",
      headers: { ...browserHeaders(), "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies2 },
      body: new URLSearchParams(form3).toString(),
    });

    const html3 = await step3.text();
    const cookies3 = mergeCookies(cookies2, extractCookies(step3.headers));
    const tokens3 = extractTokens(html3);

    if (debug) debugInfo.step3 = { status: step3.status, hasDxgv: /dxgv/i.test(html3) };

    // Step4: POST __EVENTTARGET=ctl01 with maticna — triggers De minimis pomoči tab search
    const form4: Record<string, string> = {
      __VIEWSTATE: tokens3.__VIEWSTATE || tokens2.__VIEWSTATE,
      __EVENTVALIDATION: tokens3.__EVENTVALIDATION || tokens2.__EVENTVALIDATION || "",
      __EVENTTARGET: "ctl00$MainContent$ctl01",
      __EVENTARGUMENT: "",
      "ctl00$MainContent$txtMaticnaStevilka": resolvedMaticna,
    };
    if (tokens3.__VIEWSTATEGENERATOR || tokens2.__VIEWSTATEGENERATOR)
      form4.__VIEWSTATEGENERATOR = tokens3.__VIEWSTATEGENERATOR || tokens2.__VIEWSTATEGENERATOR;

    const step4 = await fetch(JODP_URL + "/Domov", {
      method: "POST",
      headers: { ...browserHeaders(), "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies3 },
      body: new URLSearchParams(form4).toString(),
    });

    const html4 = await step4.text();

    // Two JODP error cases:
    // "ne obstaja" = company completely unknown to JODP
    // "še ni prejel" = company in JODP system but no de minimis records
    const companyNotInJodp = /lblError/i.test(html4) && /ne obstaja/i.test(html4);
    const jodpMsg = (() => {
      const m = html4.match(/lblError[^>]*>([\s\S]*?)<\/span>/i);
      return m ? m[1].replace(/<[^>]+>/g, "").trim() : null;
    })();

    if (debug) {
      const dxgvIdx = html4.toLowerCase().indexOf("dxgv");
      debugInfo.step4 = {
        status: step4.status,
        hasDxgv: dxgvIdx >= 0,
        hasDXDataRow: /DXDataRow/i.test(html4),
        companyNotInJodp,
        jodpMsg,
        gridArea: dxgvIdx >= 0 ? html4.substring(Math.max(0, dxgvIdx - 200), dxgvIdx + 2000) : null,
      };
    }

    const bestHtml = /DXDataRow/i.test(html4) ? html4 : /DXDataRow/i.test(html3) ? html3 : html4;
    const records = parseDeMinimisRecords(bestHtml, resolvedMaticna);

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .upsert({ registration_number: resolvedMaticna }, { onConflict: "registration_number" })
      .select("id")
      .single();
    if (companyError && debug) debugInfo.companyError = companyError.message;

    let saved = 0;
    const errors: string[] = [];

    if (company?.id && records.length > 0) {
      for (const rec of records) {
        const raw = rec.raw as Record<string, unknown>;
        const { error } = await supabase
          .from("de_minimis_records")
          .upsert({
            company_id: company.id,
            mssi_number: raw.mssiNumber || null,
            provider: rec.source,
            programme: rec.legal_basis,
            amount: rec.amount,
            granted_date: rec.date_awarded || (rec.year + "-01-01"),
            source_url: JODP_URL + "/Domov",
            source_payload: raw,
          }, { onConflict: "company_id,mssi_number,granted_date,amount", ignoreDuplicates: true });
        if (error) errors.push(error.message); else saved++;
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
      version: "fetch-jodp-2026-05-25-clean",
      maticna: resolvedMaticna,
      input: maticna,
      company_in_jodp: records.length > 0 || !companyNotInJodp,
      company_id: company?.id || null,
      records_found: records.length,
      records_saved: saved,
      records,
      errors,
    };

    if (debug) result.debug = debugInfo;
    return json(result);

  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});
