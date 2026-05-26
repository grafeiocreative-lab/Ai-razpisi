import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = await req.json();
    const registrationNumber = String(body.registration_number || "").trim();

    if (!registrationNumber) {
      return json({ error: "Manjka registration_number" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Manjkajo Supabase env podatki" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Davčna → Matična resolution: davčna je 8-mestna, matična je 10-mestna
    let resolvedRegistration = registrationNumber;
    let viesCompany: { name: string; address: string } | null = null;
    if (registrationNumber.length === 8) {
      const { data: byTax } = await supabase
        .from("prs_cache")
        .select("registration_number")
        .eq("tax_number", registrationNumber)
        .maybeSingle();
      if (byTax?.registration_number) {
        resolvedRegistration = byTax.registration_number;
      } else {
        // VIES fallback: EU DDV validacija vrne firmo → iščemo v prs_cache po imenu
        try {
          const viesResp = await fetch(
            `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/SI/vat/${registrationNumber}`
          );
          if (viesResp.ok) {
            const vies = await viesResp.json();
            if (vies.isValid && vies.name) {
              viesCompany = { name: vies.name, address: vies.address || "" };
              const searchName = vies.name.split(",")[0].trim();
              const { data: byName } = await supabase
                .from("prs_cache")
                .select("registration_number")
                .ilike("company_name", `${searchName}%`)
                .limit(1)
                .maybeSingle();
              if (byName?.registration_number) {
                resolvedRegistration = byName.registration_number;
                await supabase
                  .from("prs_cache")
                  .update({ tax_number: registrationNumber })
                  .eq("registration_number", resolvedRegistration);
              }
            }
          }
        } catch { /* VIES ni dosegljiv */ }
      }
    }

    const { data: prsRecord, error: prsError } = await supabase
      .from("prs_cache")
      .select("*")
      .eq("registration_number", resolvedRegistration)
      .single();

    if (prsError || !prsRecord) {
      return json({
        ok: false,
        status: "not_found",
        message: "Podjetje ni najdeno v lokalnem PRS cache.",
        registration_number: registrationNumber,
        vies_company: viesCompany,
      }, 404);
    }

    // Enrichment: pridobi davčno iz FiPo če manjka v prs_cache
    let taxNumber = prsRecord.tax_number;
    if (!taxNumber) {
      try {
        const fipoResp = await fetch(
          `https://www.ajpes.si/fipo/rezultati.asp?maticna=${resolvedRegistration}`,
          { headers: { "User-Agent": "Mozilla/5.0" } }
        );
        if (fipoResp.ok) {
          const fipoHtml = await fipoResp.text();
          const m = fipoHtml.match(/Dav[^<]{0,30}<b>(?:SI\s*)?(\d{8})<\/b>/i);
          if (m) {
            taxNumber = m[1];
            await supabase
              .from("prs_cache")
              .update({ tax_number: taxNumber })
              .eq("registration_number", resolvedRegistration);
          }
        }
      } catch { /* FiPo ni dosegljiv */ }
    }

    const rawPayload = prsRecord.raw_payload || {};
    const postCode = String(rawPayload["Poštna št"] || rawPayload["Poštna št "] || "").trim();
    const region = prsRecord.region || inferCohesionRegion(postCode, prsRecord.municipality || prsRecord.address);

    const companyPayload = {
      company_name: prsRecord.company_name,
      registration_number: prsRecord.registration_number,
      tax_number: taxNumber,
      legal_form: prsRecord.legal_form,
      address: cleanAddress(prsRecord.address),
      municipality: prsRecord.municipality,
      region,
      main_activity_code: prsRecord.main_activity_code,
      main_activity_name: prsRecord.main_activity_name,
      source: "prs_cache",
      source_payload: prsRecord.raw_payload
    };

    const { data: existingCompany } = await supabase
      .from("companies")
      .select("id")
      .eq("registration_number", registrationNumber)
      .maybeSingle();

    let company;
    let dbError;

    if (existingCompany?.id) {
      const result = await supabase
        .from("companies")
        .update(companyPayload)
        .eq("id", existingCompany.id)
        .select()
        .single();

      company = result.data;
      dbError = result.error;
    } else {
      const result = await supabase
        .from("companies")
        .insert(companyPayload)
        .select()
        .single();

      company = result.data;
      dbError = result.error;
    }

    if (dbError) {
      return json({ error: dbError.message }, 500);
    }

    return json({
      ok: true,
      status: existingCompany?.id ? "updated" : "inserted",
      company
    }, 200);

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function cleanAddress(value: string | null) {
  if (!value) return null;
  return value
    .replace(/\s*"\s*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

function inferCohesionRegion(postCode: string | null, location: string | null) {
  const pc = String(postCode || "").trim();
  const loc = String(location || "").toLowerCase();

  if (/^[23689]/.test(pc)) return "Vzhodna Slovenija";
  if (/^[145]/.test(pc)) return "Zahodna Slovenija";

  const eastHints = [
    "maribor", "celje", "ptuj", "murska sobota", "novo mesto", "krško",
    "brežice", "velenje", "slovenj gradec", "trbovlje", "zagorje", "ormož",
    "lendava", "radenci", "slovenska bistrica", "rogaška", "sevnica",
  ];
  const westHints = [
    "ljubljana", "kranj", "koper", "nova gorica", "postojna", "idrija",
    "izola", "piran", "ajdovščina", "logatec", "vrhnika", "domžale",
    "kamnik", "škofja loka", "jesenice", "tolmin",
  ];

  if (eastHints.some((hint) => loc.includes(hint))) return "Vzhodna Slovenija";
  if (westHints.some((hint) => loc.includes(hint))) return "Zahodna Slovenija";
  return null;
}
