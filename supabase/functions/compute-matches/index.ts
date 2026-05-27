import { createClient } from "npm:@supabase/supabase-js@2";

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
  const supabase = createClient(supabaseUrl, serviceRoleKey);

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
      .select("id, region, size_class, interests, dm_free")
      .eq("registration_number", registrationNumber!)
      .maybeSingle();
    if (!data) return json({ error: "Podjetje ni najdeno v companies" }, 404);
    resolvedId = data.id as string;
    company = data;
  } else {
    const { data } = await supabase
      .from("companies")
      .select("id, region, size_class, interests, dm_free")
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
  };

  // Pridobi vse aktivne razpise
  const today = new Date().toISOString();
  const { data: grants, error: grantsError } = await supabase
    .from("grants")
    .select("id, title, eligible_sectors, eligible_regions, eligible_company_sizes, is_de_minimis, raw_summary, requirements, plain_language_summary, source_url")
    .in("status", ["open", "upcoming"])
    .or(`deadline_at.is.null,deadline_at.gte.${today}`)
    .limit(200);

  if (grantsError) return json({ error: grantsError.message }, 500);

  const verified = (grants || []).filter(g => /^https?:\/\//i.test(String(g.source_url || "")));

  // Izračunaj score za vsak razpis
  const matches = verified.map(g => {
    const { score, breakdown } = scoreGrant(g, profile);
    return { grant_id: g.id, score, breakdown };
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

interface GrantRow {
  id: string;
  title: string;
  eligible_sectors: string[];
  eligible_regions: string[];
  eligible_company_sizes: string[];
  is_de_minimis: boolean;
  raw_summary: string | null;
  requirements: string | null;
  plain_language_summary: string | null;
}

interface Profile {
  interests: string[];
  kmu: string;
  dmFree: number;
  region: string | null;
}

function scoreGrant(row: GrantRow, profile: Record<string, unknown>): { score: number; breakdown: Record<string, unknown> } {
  const p = profile as unknown as Profile;
  const tags = row.eligible_sectors || [];
  const sizes = row.eligible_company_sizes || [];
  const hay = [
    ...tags,
    row.title || "",
    row.raw_summary || "",
    row.requirements || "",
    row.plain_language_summary || "",
  ].join(" ").toLowerCase();

  let s = 50;
  const reasons: string[] = [];
  const penalties: string[] = [];

  const kws: Record<string, string[]> = {
    digi:    ["digitalizacij", "digital", "informatiz", "e-poslovan", "it rešit"],
    green:   ["zeleni", "okolj", "trajnost", "podnebj", "ekolo", "obnovljiv", "co2", "emisij", "energetsk"],
    export:  ["izvoz", "internacionalizacij", "tuj trg", "mednarod", "eures"],
    rd:      ["inovacij", "razvoj", "raziskov", "r&d", "tehnolog", "patent", "startup", "zagonsk"],
    employ:  ["zaposlov", "delovno mest", "kadr", "brezposel", "usposab na del"],
    energy:  ["energetik", "energij", "obnovljiv vir", "toplotn", "sončn", "fotovoltai", "biomasa"],
    tourism: ["turizem", "turistič", "prenočitev", "gostinst"],
    edu:     ["izobra", "usposab", "kompetenc", "znanj", "šolanj", "štipendij"],
    agri:    ["kmetij", "ribiš", "gozdarst", "živinorej", "sadjarst", "vinogradn"],
    culture: ["kultur", "umetnost", "avdiovizual", "film", "glasb"],
  };

  for (const [id, ks] of Object.entries(kws)) {
    if (p.interests?.includes(id) && ks.some(k => hay.includes(k))) {
      s += 15;
      reasons.push(`Interes "${id}" se ujema z vsebino razpisa`);
    }
  }

  // Velikost podjetja
  const sizeMap: Record<string, string> = { MIKRO: "micro", MALO: "small", MSP: "small", SREDNJE: "medium", VELIKO: "large" };
  const compSize = sizeMap[p.kmu] || null;
  if (sizes.length > 0 && compSize) {
    if (sizes.includes(compSize) || (compSize === "micro" && sizes.includes("small"))) {
      s += 10;
      reasons.push("Velikost podjetja ustreza razpisu");
    } else if (!sizes.includes("large")) {
      s -= 20;
      penalties.push("Velikost podjetja ne ustreza razpisu");
    }
  } else if (tags.some(t => t === "MSP") && p.kmu === "VELIKO") {
    s -= 40;
    penalties.push("Razpis je namenjen MSP, podjetje je veliko");
  }

  // De minimis
  if (row.is_de_minimis) {
    if (p.dmFree > 0) {
      s += 5;
      reasons.push("De minimis prostor je na voljo");
    } else {
      s -= 20;
      penalties.push("De minimis kvota je izčrpana");
    }
  }

  // Regija
  const er = row.eligible_regions || [];
  if (er.length > 0 && p.region) {
    const matches = er.some(r =>
      r.toLowerCase().includes(p.region!.toLowerCase()) ||
      p.region!.toLowerCase().includes(r.toLowerCase())
    );
    if (!matches) {
      s -= 25;
      penalties.push(`Razpis je omejen na regije: ${er.join(", ")}`);
    } else {
      reasons.push("Regija ustreza");
    }
  }

  return {
    score: Math.min(95, Math.max(10, s)),
    breakdown: { base: 50, reasons, penalties, final: Math.min(95, Math.max(10, s)) },
  };
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
