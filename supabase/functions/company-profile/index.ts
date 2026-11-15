import { createClient } from "npm:@supabase/supabase-js@2";

// Profil enega podjetja (in njegovi de minimis zapisi) po matični številki.
// Tabele companies in de_minimis_records za anonimni dostop niso več berljive (vsak obiskovalec bi lahko prebral vsa
// podjetja), zato aplikacija bere samo eno podjetje prek te funkcije. Seznama podjetij funkcija ne vrne nikoli.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const body = await req.json().catch(() => ({}));
  const registrationNumber = String(body.registration_number || "").trim();
  if (!/^[0-9A-Za-z]{6,14}$/.test(registrationNumber)) {
    return json({ error: "Neveljavna matična številka" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Manjkajo Supabase env podatki" }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "ai_razpisi" } });

  const { data: company, error } = await supabase
    .from("companies")
    .select("id, company_name, registration_number, tax_number, legal_form, main_activity_code, main_activity_name, size_class, region, municipality, address, source, interests, dm_free, skd_code, skd_label")
    .eq("registration_number", registrationNumber)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!company) return json({ company: null, de_minimis: [] });

  const { data: records } = await supabase
    .from("de_minimis_records")
    .select("*")
    .eq("company_id", company.id)
    .order("granted_date", { ascending: false });

  return json({ company, de_minimis: records ?? [] });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
