import { createClient } from "npm:@supabase/supabase-js@2";
import { scoreGrantDetailed } from "../_shared/scoring.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "ai_razpisi" } });

  const body = await req.json().catch(() => ({}));
  const companyId: string | null = body.company_id || null;
  const registrationNumber: string | null = body.registration_number || null;

  if (!companyId && !registrationNumber) {
    return json({ error: "Potreben company_id ali registration_number" }, 400);
  }

  // Razreši company_id in naloži shranjen profil iz baze
  let resolvedId = companyId;
  let company: Record<string, unknown> | null = null;

  if (!resolvedId) {
    const { data } = await supabase
      .from("companies")
      .select("id, region, size_class, interests, dm_free, skd_label, skd_code, legal_form")
      .eq("registration_number", registrationNumber!)
      .maybeSingle();
    if (!data) return json({ error: "Podjetje ni najdeno v companies" }, 404);
    resolvedId = data.id as string;
    company = data;
  } else {
    const { data } = await supabase
      .from("companies")
      .select("id, region, size_class, interests, dm_free, skd_label, skd_code, legal_form")
      .eq("id", resolvedId)
      .maybeSingle();
    company = data;
  }

  const dbInterests = Array.isArray((company as Record<string,unknown>)?.interests)
    ? (company as Record<string,unknown>).interests as string[]
    : [];
  const sizeClassToKmu: Record<string, string> = {
    micro: "MIKRO", small: "MALO", medium: "SREDNJE", large: "VELIKO"
  };
  const dbSizeClass = String((company as Record<string,unknown>)?.size_class || "");
  const dbKmu = sizeClassToKmu[dbSizeClass] || "MSP";
  const dbDmFree = Number((company as Record<string,unknown>)?.dm_free ?? 200000);

  // Body params imajo prednost pred shranjenim profilom
  const profile: Record<string, unknown> = {
    interests: body.interests?.length ? body.interests : dbInterests,
    kmu: body.kmu || dbKmu,
    dmFree: body.dm_free ?? dbDmFree,
    region: body.region || (company as Record<string,unknown>)?.region || null,
    // Samoizbrana dejavnost (SKD naziv) — glej activityMatches() spodaj.
    skdLabel: body.skd_label || (company as Record<string,unknown>)?.skd_label || null,
    skdCode: body.skd_code || (company as Record<string,unknown>)?.skd_code || null,
    legalForm: (company as Record<string,unknown>)?.legal_form || null,
  };

  // Shrani profil (interesi/velikost/de minimis prostor) nazaj v companies —
  // teče s service_role, zato gre mimo RLS, ki bi to anon klicu iz brskalnika zavrnil.
  const kmuToSizeClass: Record<string, string> = { MIKRO: "micro", MALO: "small", SREDNJE: "medium", VELIKO: "large" };
  const profileUpdate: Record<string, unknown> = {};
  if (Array.isArray(body.interests)) profileUpdate.interests = body.interests;
  if (body.kmu) profileUpdate.size_class = kmuToSizeClass[body.kmu] || "small";
  if (body.dm_free !== undefined) profileUpdate.dm_free = body.dm_free;
  if (body.skd_code) profileUpdate.skd_code = body.skd_code;
  if (body.skd_label) profileUpdate.skd_label = body.skd_label;
  if (Object.keys(profileUpdate).length) {
    const { error: profileError } = await supabase.from("companies").update(profileUpdate).eq("id", resolvedId);
    if (profileError) console.error("Shranjevanje profila ni uspelo:", profileError.message);
  }

  // Pridobi vse aktivne razpise
  const today = new Date().toISOString();
  const { data: grants, error: grantsError } = await supabase
    .from("grants")
    .select("id, title, eligible_sectors, eligible_regions, eligible_company_sizes, is_de_minimis, raw_summary, requirements, plain_language_summary, source_url, eligibility")
    .in("status", ["open", "upcoming"])
    .or(`deadline_at.is.null,deadline_at.gte.${today}`)
    .limit(200);

  if (grantsError) return json({ error: grantsError.message }, 500);

  const verified = (grants || []).filter(g => /^https?:\/\//i.test(String(g.source_url || "")));

  // Izračunaj score za vsak razpis
  const matches = verified.map(g => {
    const { score, reasons, penalties } = scoreGrantDetailed(g, profile);
    return { grant_id: g.id, score, breakdown: { base: 50, reasons, penalties, final: score } };
  });

  // Shrani v grant_matches (upsert)
  let saved = 0;
  const errors: string[] = [];

  for (const m of matches) {
    const { error } = await supabase
      .from("grant_matches")
      .upsert({
        company_id: resolvedId,
        grant_id: m.grant_id,
        match_score: m.score,
        score_breakdown: m.breakdown,
        updated_at: new Date().toISOString(),
      }, { onConflict: "company_id,grant_id" });
    if (error) errors.push(error.message);
    else saved++;
  }

  return json({
    ok: true,
    company_id: resolvedId,
    grants_evaluated: verified.length,
    matches_saved: saved,
    top_matches: matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(m => ({ grant_id: m.grant_id, score: m.score, reasons: m.breakdown.reasons })),
    errors,
  });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
