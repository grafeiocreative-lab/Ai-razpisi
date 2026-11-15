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
| `baseline/cron.sql` | Zaplanirano dnevno osveževanje razpisov (pg_cron + Vault). Skrivnost ni v datoteki. |

Uporaba: samo za postavitev iz nič (nov projekt, preview branch). Najprej shema, nato seed, nato v
Dashboardu (Settings → API → Exposed schemas) izpostavi `ai_razpisi`. Sheme ni mogoče samodejno primerjati
z živo bazo, zato ob vsaki spremembi sheme posnetek osveži ali dodaj novo migracijo.

## Pravilo za nove tabele

Vsaka nova tabela v `ai_razpisi` potrebuje izrecen `GRANT` za vloge, ki jih uporablja (RLS pravilnik ne zadostuje,
`service_role` brez `GRANT` tiho dobi `permission denied`). Za shemo `public` velja od 30. 10. 2026 enako za vse vloge.

## Dostop do podatkov

`companies`, `de_minimis_records` in `grant_matches` za `anon` in `authenticated` nista berljivi. Aplikacija bere eno podjetje
prek edge funkcije `company-profile` (po matični številki), vse ostalo teče prek `service_role` v edge funkcijah.
Skupna koda ocenjevanja je v `functions/_shared/scoring.ts` (uporabljata jo aplikacija in `compute-matches`), tipi baze
v `functions/_shared/database.types.ts` (osveži: `supabase gen types typescript --linked --schema ai_razpisi`).

## Edge funkcije

Deploy: `supabase functions deploy <ime> --project-ref cseifhrfmemvizwbmyjd --no-verify-jwt --use-api` (CLI 2.x).
SQL na živi bazi: `supabase db query --linked "..."`.
