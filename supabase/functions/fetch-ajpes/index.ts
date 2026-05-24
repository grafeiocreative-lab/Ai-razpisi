import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
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

    const { data: prsRecord, error: prsError } = await supabase
      .from("prs_cache")
      .select("*")
      .eq("registration_number", registrationNumber)
      .single();

    if (prsError || !prsRecord) {
      return json({
        ok: false,
        status: "not_found",
        message: "Podjetje ni najdeno v lokalnem PRS cache.",
        registration_number: registrationNumber
      }, 404);
    }

    const rawPayload = prsRecord.raw_payload || {};
    const postCode = String(rawPayload["Poštna št"] || rawPayload["Poštna št "] || "").trim();
    const region = prsRecord.region || inferCohesionRegion(postCode, prsRecord.municipality || prsRecord.address);

    const companyPayload = {
      company_name: prsRecord.company_name,
      registration_number: prsRecord.registration_number,
      tax_number: prsRecord.tax_number,
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
