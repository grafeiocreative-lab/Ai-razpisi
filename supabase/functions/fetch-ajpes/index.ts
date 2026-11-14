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
    // Odstrani vse, kar ni številka (presledki, vezaji, "SI" predpona pri ID za DDV ...):
    // frontend to že počisti, tu je obramba v globino za klicatelje mimo frontenda.
    const registrationNumber = String(body.registration_number || "").replace(/\D/g, "");
    // Profil podjetja, shrani se v companies za personaliziran matching
    const interests: string[] = Array.isArray(body.interests) ? body.interests : [];
    const kmu: string = body.kmu || "";
    const dmFree: number = typeof body.dm_free === "number" ? body.dm_free : 200000;

    if (!registrationNumber) {
      return json({ error: "Manjka registration_number" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Manjkajo Supabase env podatki" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "ai_razpisi" } });

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
        // VIES fallback: EU DDV validacija vrne ime in naslov, po njiju poiščemo podjetje v PRS.
        viesCompany = await fetchVies(registrationNumber);
        if (viesCompany) {
          const matched = await findPrsByVies(supabase, viesCompany);
          if (matched) {
            resolvedRegistration = matched;
            await supabase
              .from("prs_cache")
              .update({ tax_number: registrationNumber })
              .eq("registration_number", resolvedRegistration);
          }
        }
      }
    }

    const { data: prsData, error: prsError } = await supabase
      .from("prs_cache")
      .select("*")
      .eq("registration_number", resolvedRegistration)
      .single();
    // deno-lint-ignore no-explicit-any
    let prsRecord: any = prsData;
    let companySource = "prs_cache";

    // Podjetja ni v PRS (npr. novo registriran s.p.), davčna pa je v VIES veljavna: naredimo omejen
    // profil iz VIES podatkov. Ključ je davčna številka (8 mest), matične ne poznamo.
    if ((prsError || !prsRecord) && viesCompany && registrationNumber.length === 8) {
      const addr = parseViesAddress(viesCompany.address);
      prsRecord = {
        company_name: niceName(viesCompany.name),
        registration_number: registrationNumber,
        tax_number: registrationNumber,
        legal_form: null,
        address: addr ? `${niceSentence(`${addr.street} ${addr.number}`)}, ${addr.postCode} ${niceName(addr.city)}` : niceSentence(viesCompany.address),
        municipality: addr ? niceName(addr.city) : null,
        region: null,
        main_activity_code: null,
        main_activity_name: null,
        raw_payload: { "Poštna št": addr?.postCode || "", vies: true },
      };
      resolvedRegistration = registrationNumber;
      companySource = "vies";
    }

    if (!prsRecord) {
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

    const sizeMap: Record<string, string> = {
      MIKRO: "micro", MALO: "small", MSP: "small", SREDNJE: "medium", VELIKO: "large"
    };

    const companyPayload: Record<string, unknown> = {
      company_name: prsRecord.company_name,
      registration_number: prsRecord.registration_number,
      tax_number: taxNumber,
      legal_form: prsRecord.legal_form,
      address: cleanAddress(prsRecord.address),
      municipality: prsRecord.municipality,
      region,
      main_activity_code: prsRecord.main_activity_code,
      main_activity_name: prsRecord.main_activity_name,
      source: companySource,
      source_payload: prsRecord.raw_payload,
    };

    // Shrani profil samo če je bil poslan (ne prepiši obstoječega z defaulti)
    if (interests.length > 0) companyPayload.interests = interests;
    if (kmu) companyPayload.size_class = sizeMap[kmu] || kmu.toLowerCase();
    if (body.dm_free !== undefined) companyPayload.dm_free = dmFree;

    const { data: existingCompany } = await supabase
      .from("companies")
      .select("id")
      .eq("registration_number", resolvedRegistration)
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

    // Sproži matching v ozadju, ne čakamo na odgovor
    const companyId = (company as Record<string, unknown>)?.id;
    if (companyId) {
      const matchUrl = (supabaseUrl || "").replace(/\/$/, "") + "/functions/v1/compute-matches";
      fetch(matchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey || "",
        },
        body: JSON.stringify({ company_id: companyId }),
      }).catch(() => { /* matching ni kritičen */ });
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

// ── VIES → PRS ujemanje ───────────────────────────────────────────────
// VIES vrne ime in naslov. Pri s.p. je to ime osebe ("MIRAN VUGRINSKI"), v PRS pa je firma pred
// imenom ("Dostava hrane, Alija Gavranović s.p."), hišna številka pa ima ničle ("Regentova ulica 020").
// Zato ne iščemo po začetku imena, ampak po naslovu in po vseh besedah imena.
const NAME_SUFFIXES = new Set(["d.o.o.", "d.o.o", "s.p.", "s.p", "d.d.", "d.n.o.", "k.d.", "z.o.o.", "sp", "doo"]);

function foldText(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
}

function parseViesAddress(address: string): { street: string; number: string; postCode: string; city: string } | null {
  const parts = address.split(/[,\n]/).map((p) => p.trim()).filter(Boolean);
  const cityPart = parts.find((p) => /^\d{4}\s/.test(p));
  const m = (parts[0] || "").match(/^(.+?)\s+(\d+)\s*[A-Za-z]?$/);
  if (!cityPart || !m) return null;
  return {
    street: m[1].replace(/[%_]/g, " ").trim(),
    number: m[2],
    postCode: cityPart.slice(0, 4),
    city: cityPart.slice(5).trim(),
  };
}

// deno-lint-ignore no-explicit-any
async function findPrsByVies(supabase: any, vies: { name: string; address: string }): Promise<string | null> {
  const rawTokens = vies.name.split(",")[0].toLowerCase().split(/\s+/).filter((t) => t.length >= 2 && !NAME_SUFFIXES.has(t));
  if (rawTokens.length === 0) return null;
  const foldedTokens = rawTokens.map(foldText);
  const hasAllTokens = (name: string) => {
    const f = foldText(name);
    return foldedTokens.every((t) => f.includes(t));
  };
  type Row = { registration_number: string; company_name: string; address: string | null };

  const addr = parseViesAddress(vies.address || "");
  if (addr) {
    const { data } = await supabase
      .from("prs_cache")
      .select("registration_number, company_name, address")
      .ilike("address", `${addr.street} ${addr.number.padStart(3, "0")}%`)
      .ilike("address", `%${addr.postCode}%`)
      .limit(300);
    const hits = ((data || []) as Row[]).filter((c) => hasAllTokens(c.company_name));
    if (hits.length === 1) return hits[0].registration_number;
    if (hits.length > 1) return null; // dvoumno: raje brez ujemanja kot napačno podjetje
  }

  // Brez ujemanja po naslovu (npr. selitev): iščemo po besedah imena.
  let query = supabase.from("prs_cache").select("registration_number, company_name, address");
  for (const t of [...rawTokens].sort((a, b) => b.length - a.length).slice(0, 3)) {
    query = query.ilike("company_name", `%${t.replace(/[%_]/g, " ")}%`);
  }
  const { data } = await query.limit(200);
  const named = ((data || []) as Row[]).filter((c) => hasAllTokens(c.company_name));
  const inCity = addr ? named.filter((c) => String(c.address || "").includes(addr.postCode)) : named;
  if (inCity.length === 1) return inCity[0].registration_number;
  if (inCity.length === 0 && named.length === 1) return named[0].registration_number;
  return null;
}

async function fetchVies(taxNumber: string): Promise<{ name: string; address: string } | null> {
  try {
    const resp = await fetch(
      `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/SI/vat/${taxNumber}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!resp.ok) return null;
    const vies = await resp.json();
    if (vies.isValid && vies.name) return { name: String(vies.name), address: String(vies.address || "") };
  } catch { /* VIES ni dosegljiv */ }
  return null;
}

// VIES vrača velike črke ("MIRAN VUGRINSKI"): za prikaz pretvorimo v navadno pisavo.
function niceName(value: string): string {
  if (value !== value.toUpperCase()) return value.trim();
  return value.toLowerCase().replace(/(^|[\s\-(])(\p{L})/gu, (_m, p, c) => p + c.toUpperCase()).trim();
}

function niceSentence(value: string): string {
  const v = value.toLowerCase().trim();
  return v.charAt(0).toUpperCase() + v.slice(1);
}
