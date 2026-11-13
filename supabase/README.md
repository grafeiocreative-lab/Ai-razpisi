# Supabase: kaj je kaj

Aplikacija uporablja projekt **Grafeio Workspace** (`cseifhrfmemvizwbmyjd`), shema **`ai_razpisi`**.

## `migrations/` je zgodovina starega projekta

Datoteke v `migrations/` so nastale za star projekt (`fhoayfzwfsalnnpxxlak`, shema `public`). Aplikacija je pozneje
prešla na shemo `ai_razpisi`, spremembe pa so bile uveljavljene neposredno v živi bazi (Supabase MCP).
Zato z živo bazo niso skladne: nobena ne omenja `ai_razpisi`, manjkajo pa tudi poznejše spremembe
(`ai_usage`, `plan_interest`, samoizbrana SKD dejavnost v `companies`). **Ne poganjaj jih na živem projektu.**

## `baseline/` je posnetek žive baze

| Datoteka | Vsebina |
|---|---|
| `baseline/ai_razpisi_schema.sql` | Celotna shema `ai_razpisi`: tabele, ključi, indeksi, RLS, pravilniki, pravice, pogled, sprožilec. Generirano iz žive baze 2026-11-13. |
| `baseline/ai_razpisi_skd_lookup_seed.sql` | Podatki za `skd_lookup` (1725 vrstic). |

Uporaba: samo za postavitev iz nič (nov projekt, preview branch). Najprej shema, nato seed, nato v
Dashboardu (Settings → API → Exposed schemas) izpostavi `ai_razpisi`. Sheme ni mogoče samodejno primerjati
z živo bazo, zato ob vsaki spremembi sheme posnetek osveži ali dodaj novo migracijo.

## Pravilo za nove tabele

Vsaka nova tabela v `ai_razpisi` potrebuje izrecen `GRANT` za vloge, ki jih uporablja (RLS pravilnik ne zadostuje,
`service_role` brez `GRANT` tiho dobi `permission denied`). Za shemo `public` velja od 30. 10. 2026 enako za vse vloge.

## Edge funkcije

Deploy na pravi projekt prek Supabase MCP (`deploy_edge_function`, `project_id: cseifhrfmemvizwbmyjd`).
Lokalni Supabase CLI je lahko povezan na star projekt, zato ga pred deployem preveri (`supabase projects list`).
