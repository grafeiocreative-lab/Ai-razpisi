# AI-razpisi - povzetek za nadaljevanje

Datum: 2026-05-24

## Lokalne mape

- Glavna mapa projekta: `/Users/Mojca/Documents/AI-razpisi`
- Frontend: `/Users/Mojca/Documents/AI-razpisi/src/App.jsx`
- Supabase functions: `/Users/Mojca/Documents/AI-razpisi/supabase/functions`
- JODP funkcija: `/Users/Mojca/Documents/AI-razpisi/supabase/functions/fetch-jodp/index.ts`
- Migracije: `/Users/Mojca/Documents/AI-razpisi/supabase/migrations`

## Povezave

- GitHub: https://github.com/grafeiocreative-lab/Ai-razpisi
- Supabase lokalno povezan projekt: `fhoayfzwfsalnnpxxlak`
- Supabase URL iz `.env.local`: https://fhoayfzwfsalnnpxxlak.supabase.co
- Supabase dashboard: https://supabase.com/dashboard/project/fhoayfzwfsalnnpxxlak
- Netlify: v lokalnem repozitoriju ni najden `.netlify`, `netlify.toml` ali site ID. Povezavo je treba preveriti v Netlify dashboardu.

Pozor: v prejsnjem deployu je bil uporabljen drug Supabase projekt: `inoespixizhomurthxbp`. Pred naslednjim deployem je treba potrditi, kateri Supabase projekt je pravi.

## Trenutno stanje

- `fetch-jodp` parser dela.
- Rezultat testa je bil: `version OK`, `step4 OK`, `dtoRows OK`, `records_found: 10`, `records_saved: 10`, brez errors.
- Podatki so bili uspesno pobrani in shranjeni.
- Debug response je treba drzati produkcijsko cist: brez `htmlSnippet`, `tailHtml`, `gridSnippets`, `dxFragments`, `allTables`, `dtoRows`.
- V debug response naj ostanejo samo lahke informacije: `version`, `step1`, `step2.status`, `step3.status`, `step4.status`, `records_found`, `records_saved`.

## Dedupe / upsert

Pred schedulingom mora biti urejen dedupe za `de_minimis_records`, ker sicer vsak test ponovno vstavi iste zapise.

Predlagan unique key:

```sql
alter table de_minimis_records
  add column if not exists mssi_number text;

create unique index if not exists de_minimis_records_uidx
  on de_minimis_records(company_id, mssi_number, granted_date, amount);
```

V funkciji `fetch-jodp` mora insert uporabljati:

```ts
.upsert(..., { onConflict: "company_id,mssi_number,granted_date,amount" })
```

Lokalno so bile opazene spremembe, ki ze ciljajo na to:

- `supabase/functions/fetch-jodp/index.ts`
- `supabase/migrations/20260524_add_mssi_number.sql`
- `supabase/migrations/20260525_fix_constraints.sql`
- `supabase/migrations/20260526_nullable_company_name.sql`

## UI prikaz de minimis

Prikaz na strani podjetja je najbolj smiseln.

Struktura strani:

```text
Podjetje
├─ Osnovni podatki
├─ AI / razpisna primernost
├─ De minimis pomoci
│  ├─ skupni znesek
│  ├─ stevilo zapisov
│  └─ tabela
└─ Priporoceni razpisi
```

Povzetek nad tabelo:

- Skupaj evidentiranih de minimis pomoci: X EUR
- Zadnja pomoc: DD.MM.YYYY
- Stevilo zapisov: X

Tabela:

| Datum odobritve | Dajalec | Program / pravna osnova | Znesek |
| --- | --- | --- | --- |

## Naslednji koraki

1. Potrditi pravi Supabase projekt: `fhoayfzwfsalnnpxxlak` ali `inoespixizhomurthxbp`.
2. Preveriti ali tabela `de_minimis_records` obstaja v pravem projektu.
3. Aplicirati migracije za `mssi_number` in unique index.
4. Deployati `fetch-jodp` na pravi Supabase projekt.
5. Testirati, da ponovni klic ne vstavi dvojnikov.
6. Preveriti frontend prikaz podjetja: osnovni podatki, AI primernost, de minimis pomoci, priporoceni razpisi.
7. Sele potem dodati scheduled refresh.
