import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// AI pomočnik: samo pogovor o razpisih/profilu podjetja (brez tool use, ne spreminja baze).
// Kontekst (profil + do 15 najbolje ujemajočih razpisov) se pošlje ob vsakem klicu —
// brez shranjene seje na strežniku, zgodovino pogovora pošilja frontend.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Manjkajo Supabase env podatki" }, 500);
    }
    if (!anthropicKey) {
      return json({ error: "AI pomočnik trenutno ni na voljo (manjka ANTHROPIC_API_KEY)" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const companyId: string | null = body.company_id || null;
    const message: string = String(body.message || "").trim();
    const history: { role: string; content: string }[] = Array.isArray(body.history) ? body.history : [];

    if (!message) return json({ error: "Manjka message" }, 400);
    if (message.length > 2000) return json({ error: "Sporočilo je predolgo (max 2000 znakov)" }, 400);

    const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "ai_razpisi" } });

    // Profil podjetja (za kontekst, ne za spreminjanje)
    let company: Record<string, unknown> | null = null;
    if (companyId) {
      const { data } = await supabase
        .from("companies")
        .select("company_name, region, size_class, interests, dm_free, main_activity_name")
        .eq("id", companyId)
        .maybeSingle();
      company = data;
    }

    // Do 15 najbolje ujemajočih razpisov za to podjetje (če jih ni, splošno aktualni)
    let grants: Record<string, unknown>[] = [];
    if (companyId) {
      const { data } = await supabase
        .from("grant_matches")
        .select("match_score, grants(title, provider, status, deadline_at, max_aid_amount, funding_rate, plain_language_summary, raw_summary, is_de_minimis, source_url)")
        .eq("company_id", companyId)
        .order("match_score", { ascending: false })
        .limit(15);
      grants = (data || [])
        .filter((m: Record<string, unknown>) => m.grants)
        .map((m: Record<string, unknown>) => ({ ...(m.grants as Record<string, unknown>), match_score: m.match_score }));
    }
    if (grants.length === 0) {
      const { data } = await supabase
        .from("grants")
        .select("title, provider, status, deadline_at, max_aid_amount, funding_rate, plain_language_summary, raw_summary, is_de_minimis, source_url")
        .in("status", ["open", "upcoming"])
        .limit(15);
      grants = data || [];
    }

    const grantsContext = grants.map((g, i) => {
      const summary = String(g.plain_language_summary || g.raw_summary || "").substring(0, 300);
      const deadline = g.deadline_at ? new Date(String(g.deadline_at)).toLocaleDateString("sl-SI") : "brez roka";
      const amount = g.max_aid_amount ? `${Math.round(Number(g.max_aid_amount)).toLocaleString("sl-SI")} €` : "ni navedeno";
      return `${i + 1}. "${g.title}" (${g.provider || "ni navedeno"})${g.match_score ? ` — ujemanje ${Math.round(Number(g.match_score))}%` : ""}\n   Rok: ${deadline} · Znesek: ${amount} · De minimis: ${g.is_de_minimis ? "da" : "ne"}\n   ${summary}`;
    }).join("\n\n");

    const companyContext = company
      ? `Ime: ${company.company_name || "ni navedeno"}\nRegija: ${company.region || "ni navedeno"}\nVelikost: ${company.size_class || "ni navedeno"}\nInteresi: ${(company.interests as string[] | null)?.join(", ") || "ni izbranih"}\nProsto de minimis: ${company.dm_free ?? "ni podatka"} €`
      : "Profil podjetja ni na voljo — odgovarjaj splošno.";

    const systemPrompt = `Si AI pomočnik znotraj slovenske platforme AI Razpisi, ki podjetjem pomaga najti javne razpise. Piši v slovenščini, naravno, brez uradniškega jezika. Uporabljaj slovenske tipografske konvencije: narekovaji „..." ne "...", nikoli ne uporabljaj pomišljaja (– ali —) sredi povedi, uporabi vejico, dvopičje ali piko, decimalna vejica ne pika. Odgovarjaj kratko in konkretno (največ nekaj stavkov, razen če uporabnik izrecno prosi za več).

Odgovarjaj SAMO na podlagi profila podjetja in seznama razpisov spodaj. Če odgovora ne najdeš v teh podatkih, to jasno povej — ne izmišljuj si zneskov, rokov ali pogojev. Ne moreš spreminjati profila, oddajati vlog ali karkoli zapisati v sistem, samo svetuješ in razlagaš.

PROFIL PODJETJA:
${companyContext}

RAZPISI (razvrščeni po ujemanju):
${grantsContext || "Trenutno ni podatkov o razpisih."}`;

    const messages = [
      ...history
        .filter(h => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
        .slice(-10)
        .map(h => ({ role: h.role, content: h.content.substring(0, 2000) })),
      { role: "user", content: message },
    ];

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 600,
        system: systemPrompt,
        messages,
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text();
      return json({ error: `Anthropic API HTTP ${res.status}: ${bodyText.substring(0, 300)}` }, 502);
    }

    const data = await res.json();

    if (data.stop_reason === "refusal") {
      return json({ reply: "Na to vprašanje ne morem odgovoriti. Poskusi ga preoblikovati ali vprašaj kaj drugega o razpisih." });
    }

    const textBlock = (data.content || []).find((b: { type: string }) => b.type === "text");
    if (!textBlock || !textBlock.text) {
      return json({ error: "AI pomočnik ni vrnil odgovora" }, 502);
    }

    return json({ reply: textBlock.text.trim() });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
