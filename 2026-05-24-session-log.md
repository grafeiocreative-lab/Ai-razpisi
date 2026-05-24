# Dnevnik dela — AI Razpisi — 24. maj 2026

## Pregled

Danes smo vzpostavili celotno verigo od JODP portala do Netlify produkcije:
scraping → baza → edge funkcija → frontend → deployment.

---

## 1. Supabase Edge Function `fetch-jodp`

**Datoteka:** `supabase/functions/fetch-jodp/index.ts`

### Problem
Funkcija je vračala `records_found: 0` za vsa podjetja. Tudi za tista, ki de minimis pomoči dejansko imajo.

### Vzrok
JODP (jodp.mf.gov.si) je ASP.NET WebForms portal s 4-koračnim HTTP tokom:

| Korak | Opis |
|-------|------|
| Step 1 | GET /Domov — vzpostavi session cookie (`__AntiXsrfToken`) in pridobi ViewState |
| Step 2 | POST z `__EVENTTARGET=ctl00$MainContent$but1` — navigacija na zavihek Podjetja |
| Step 3 | POST z matično številko — registrira iskalni pogoj v ViewState |
| Step 4 | POST z `__EVENTTARGET=ctl00$MainContent$ctl01` — sproži zavihek De minimis |

**Ključna napaka:** `but1` je ASP.NET `LinkButton`, ki se sproži prek `__EVENTTARGET` in ne prek form polja. Stara koda je iskala submit gumb dinamično in ni našla prave vrednosti.

### Rešitve
- Vsi form field names so zdaj hardkodirani (ne več dinamično iskanje)
- Dodan `companyNotInJodp` za razlikovanje med dvema JODP napakama:
  - `"ne obstaja"` = podjetje sploh ni v JODP
  - `"še ni prejel"` = podjetje je v JODP, ampak nima de minimis zapisov
- Dodan `company_in_jodp` v odgovor
- Odstranjenih 5 neuporabljenih helper funkcij (`findButtonValue`, `findFieldName` itd.)
- Verzija: `fetch-jodp-2026-05-25-clean`

### Testiranje
| Matična | Rezultat |
|---------|----------|
| NLB, Mercator, Krka | `records_found: 0` — pravilno, prevelika podjetja za de minimis |
| `7020198000` | V JODP, a brez de minimis (samo splošne državne pomoči) |
| `5298156000` | ✅ 3 zapisi — Ministrstvo za okolje (2× za e-vozila) + ZRSZ (zaposlovanje) |

---

## 2. Baza — Migracije

**Mapa:** `supabase/migrations/`

| Datoteka | Opis |
|----------|------|
| `20260524_add_mssi_number.sql` | Dodana kolona `mssi_number` v `de_minimis_records` |
| `20260525_fix_constraints.sql` | UNIQUE constraint na `companies.registration_number` |
| `20260526_nullable_company_name.sql` | `company_name` sedaj nullable |
| `20260527_fix_deminimis_unique_index.sql` | **Ključna popravka:** zamenjava partial unique indexa z `NULLS NOT DISTINCT` full indexom |

### Problem z `ON CONFLICT`
```sql
-- NAPAK: partial index (WHERE mssi_number IS NOT NULL) ne dela z ON CONFLICT
create unique index de_minimis_records_uidx
  on de_minimis_records(company_id, mssi_number, granted_date, amount)
  where mssi_number is not null;

-- PRAVILNO: full index z NULLS NOT DISTINCT
create unique index de_minimis_records_uidx
  on de_minimis_records(company_id, mssi_number, granted_date, amount)
  nulls not distinct;
```

PostgreSQL ne more uporabiti partial indexa za `ON CONFLICT` — vedno zahteva full index.

---

## 3. Frontend — Onboarding (`src/App.jsx`)

### Povezava z edge funkcijo
Korak 2 onboardinga je imel lažno animacijo (samo timeouty). Zdaj kliče pravo funkcijo:

```javascript
// Vzporedno: animacija (4s) + API klic
sb.functions.invoke("fetch-jodp", { body: { registration_number: iv } })
  .then(({ data }) => { setJodpResult(data); api = true; go(); })
```

Korak 3 prikazuje prave podatke iz `jodpResult.records`:
- Skupaj prejeto (€)
- Prosto do meje 300.000 €
- Zgodovinska lista (leto, dajalec, znesek)

### Kar ostaja mock
Podatki o podjetju (ime, naslov, SKD) v koraku 3 in v CompanyProfile so še vedno iz mock objekta — AJPES integracija ni bila del današnjega dela.

---

## 4. Netlify Deployment

**URL:** https://ai-razpisi.netlify.app

### Problemi in rešitve

| Problem | Vzrok | Rešitev |
|---------|-------|---------|
| Črn zaslon | `index.css` iz Vite template — `color-scheme: light dark` + temno ozadje v dark mode | Zamenjali z minimalnim CSS (3 vrstice) |
| Bel zaslon | `createClient(undefined, undefined)` meče napako — env vars niso bili na voljo | — |
| Bel zaslon (2) | Netlify env vars so imele napačne vrednosti: `VITE_SUPABASE_URL = https://...` namesto samo `https://...` | Popravek vrednosti v Netlify UI |
| SPA routing | Brez `netlify.toml` — direktni URL-ji vračali 404 | Dodali `netlify.toml` z redirect pravilom |
| Node verzija | Vite 7.3.3 zahteva Node ≥ 20.19 ali ≥ 22 | `NODE_VERSION = "22"` v `netlify.toml` |

### Dokaz napake z env vars
V napačno buildenem JS bundlu je bilo vidno:
```javascript
createClient("VITE_SUPABASE_URL = https://fhoayfzwfsalnnpxxlak.supabase.co", "VITE_SUPABASE_ANON_KEY = eyJ...")
```
`new URL("VITE_SUPABASE_URL = https://...")` je vrgel `TypeError: Invalid URL` → bel zaslon.

Po popravku:
```javascript
createClient("https://fhoayfzwfsalnnpxxlak.supabase.co", "eyJ...")
```

---

## 5. Commiti danes

```
42bc402  fix netlify build config and make missing env vars visible
f54ab67  strip default Vite CSS that caused black screen in dark mode
6d49543  add netlify.toml SPA redirects, guard against missing env vars
be214cd  connect frontend to fetch-jodp edge function, fix de minimis DB constraints
20db722  move all helpers inside Deno.serve to fix eszip scoping issue
74ae14b  convert fetch-jodp helpers to const arrows, fix ReferenceError
```

---

## 6. Naslednji koraki

- [ ] AJPES integracija — pravo ime, naslov, SKD podjetja (trenutno mock)
- [ ] Razpisi — pravi podatki namesto mock grant kartic
- [ ] Avtentikacija — prijava/odjava, shranjevanje profila
- [ ] AI matching — algoritem za ujemanje razpisov s profilom podjetja
- [ ] VIES davčna validacija (korak 3 v animaciji je še vedno mock)
