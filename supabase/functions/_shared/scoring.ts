// Ocenjevanje ujemanja med podjetjem in razpisom. To je EDINI vir te logike: uporabljata ga
// aplikacija (src/App.jsx) in edge funkcija compute-matches, zato se prikazana in shranjena ocena ne moreta razhajati.

export interface GrantRow {
  title?: string | null;
  eligible_sectors?: string[] | null;
  eligible_regions?: string[] | null;
  eligible_company_sizes?: string[] | null;
  is_de_minimis?: boolean | null;
  raw_summary?: string | null;
  requirements?: string | null;
  plain_language_summary?: string | null;
  // null = upravičenci še niso razvrščeni (nov razpis); undefined = podatek ni bil naložen.
  eligibility?: { applicants?: string[]; sectors?: string[] } | null;
}

export interface Profile {
  interests?: string[];
  kmu?: string | null;
  dmFree?: number;
  region?: string | null;
  skdLabel?: string | null;
  skdCode?: string | null;
  legalForm?: string | null;
}

export interface ScoreResult {
  score: number;
  reasons: string[];
  penalties: string[];
}

const SKD_STOPWORDS = new Set([
  "in", "ali", "za", "na", "po", "do", "iz", "pri", "ter", "ki", "ni", "je", "se", "ne", "kot", "tudi", "oz", "itd",
  "dejavnosti", "dejavnost", "storitve", "storitev", "drugo", "druge", "drugih",
]);

export const INTEREST_LABELS: Record<string, string> = {
  digi: "digitalizacija", green: "zeleni prehod", export: "izvoz", rd: "R&D in inovacije",
  employ: "zaposlovanje", energy: "energetika", tourism: "turizem", edu: "izobraževanje",
  agri: "kmetijstvo", culture: "kultura",
};

const INTEREST_KEYWORDS: Record<string, string[]> = {
  digi: ["digitalizacij", "digital", "informatiz", "e-poslovan", "it rešit"],
  green: ["zeleni", "okolj", "trajnost", "podnebj", "ekolo", "obnovljiv", "co2", "emisij", "energetsk"],
  export: ["izvoz", "internacionalizacij", "tuj trg", "mednarod", "eures"],
  rd: ["inovacij", "razvoj", "raziskov", "r&d", "tehnolog", "patent", "startup", "zagonsk"],
  employ: ["zaposlov", "delovno mest", "kadr", "brezposel", "usposab na del"],
  energy: ["energetik", "energij", "obnovljiv vir", "toplotn", "sončn", "fotovoltai", "biomasa"],
  tourism: ["turizem", "turistič", "prenočitev", "gostinst"],
  edu: ["izobra", "usposab", "kompetenc", "znanj", "šolanj", "štipendij"],
  agri: ["kmetij", "ribiš", "gozdarst", "živinorej", "sadjarst", "vinogradn"],
  culture: ["kultur", "umetnost", "avdiovizual", "film", "glasb"],
};

// Groba primerjava ključnih besed iz SKD naziva z besedilom razpisa ("programiranje" → "progra" ujame tudi "programske").
export function activityMatches(hay: string, skdLabel: string | null | undefined): boolean {
  if (!skdLabel) return false;
  const stems = [...new Set(
    skdLabel.toLowerCase().replace(/[.,()–-]/g, " ").split(/\s+/)
      .filter((w) => w.length >= 5 && !SKD_STOPWORDS.has(w))
      .map((w) => w.slice(0, 6)),
  )];
  return stems.some((st) => hay.includes(st));
}

// Oddelek SKD iz šifre dejavnosti ("K62.10" → "K").
export const skdSection = (code: string | null | undefined): string | null =>
  /^[A-S]/i.test(String(code || "")) ? String(code)[0].toUpperCase() : null;

// Razred prijavitelja iz pravne oblike (in oddelka SKD za kmetije).
export function applicantClasses(legalForm: string | null | undefined, skdCode: string | null | undefined): string[] {
  const lf = String(legalForm || "").toLowerCase();
  const out: string[] = [];
  if (/s\.p\.|samostojni podjetnik/.test(lf)) out.push("sp");
  else if (/d\.o\.o|d\.d\.|d\.n\.o|k\.d\.|družba|poslovna enota/.test(lf)) out.push("podjetja");
  else if (/zavod|društvo|ustanova|zadruga/.test(lf)) out.push("nevladne");
  else out.push("podjetja", "sp");
  if (skdSection(skdCode) === "A") out.push("kmetije");
  return out;
}

export function scoreGrantDetailed(row: GrantRow, profile: Profile | null | undefined): ScoreResult {
  const tags = row.eligible_sectors || [];
  const sizes = row.eligible_company_sizes || [];
  const hay = [...tags, row.title || "", row.raw_summary || "", row.requirements || "", row.plain_language_summary || ""]
    .join(" ").toLowerCase();
  const reasons: string[] = [];
  const penalties: string[] = [];
  let s = 50;

  if (profile) {
    for (const [id, ks] of Object.entries(INTEREST_KEYWORDS)) {
      if (profile.interests?.includes(id) && ks.some((k) => hay.includes(k))) {
        s += 15;
        reasons.push(`Interes „${INTEREST_LABELS[id] ?? id}“ se ujema z vsebino razpisa`);
      }
    }

    if (activityMatches(hay, profile.skdLabel)) {
      s += 18;
      reasons.push(`Dejavnost „${profile.skdLabel}“ se ujema z vsebino razpisa`);
    }

    // Kdo lahko kandidira (AI-izluščeno v scrape-grants). Razpis brez podatka ostane nevtralen.
    const el = row.eligibility;
    if (el) {
      const ap = el.applicants || [];
      if (ap.length) {
        const cls = applicantClasses(profile.legalForm, profile.skdCode);
        if (ap.some((a) => cls.includes(a))) {
          s += 8;
          reasons.push("Podjetje spada med upravičence razpisa");
        } else if (!(cls.includes("sp") && ap.includes("podjetja"))) {
          s -= 35;
          penalties.push("Razpis ni namenjen tej vrsti prijavitelja");
        }
      }
      const sec = el.sectors || [];
      if (sec.length) {
        const cs = skdSection(profile.skdCode);
        if (cs) {
          if (sec.includes(cs)) { s += 12; reasons.push("Dejavnost podjetja ustreza razpisu"); }
          else { s -= 30; penalties.push("Razpis je omejen na druge dejavnosti"); }
        } else {
          s -= 10;
          penalties.push("Razpis je omejen na določene dejavnosti, dejavnost podjetja ni znana");
        }
      }
    }

    const sizeMap: Record<string, string> = { MIKRO: "micro", MALO: "small", MSP: "small", SREDNJE: "medium", VELIKO: "large" };
    const compSize = sizeMap[profile.kmu || ""] || null;
    if (sizes.length > 0 && compSize) {
      if (sizes.includes(compSize) || (compSize === "micro" && sizes.includes("small"))) {
        s += 10;
        reasons.push("Velikost podjetja ustreza razpisu");
      } else if (!sizes.includes("large")) {
        s -= 20;
        penalties.push("Velikost podjetja ne ustreza razpisu");
      }
    } else if (tags.some((t) => t === "MSP") && profile.kmu === "VELIKO") {
      s -= 40;
      penalties.push("Razpis je namenjen MSP, podjetje je veliko");
    }

    if (row.is_de_minimis) {
      if ((profile.dmFree ?? 0) > 0) {
        s += 5;
        reasons.push("De minimis prostor je na voljo");
      } else {
        s -= 20;
        penalties.push("De minimis kvota je izčrpana");
      }
    }

    const er = row.eligible_regions || [];
    if (er.length > 0 && profile.region) {
      const region = profile.region.toLowerCase();
      if (er.some((r) => r.toLowerCase().includes(region) || region.includes(r.toLowerCase()))) {
        reasons.push("Regija ustreza");
      } else {
        s -= 25;
        penalties.push(`Razpis je omejen na regije: ${er.join(", ")}`);
      }
    }

    // Razpis, pri katerem upravičenci še niso preverjeni (nov, čaka na razvrstitev), ne sme veljati za ujemanje (< 60).
    if (row.eligibility === null) {
      s = Math.min(s, 55);
      penalties.push("Upravičenci razpisa še niso preverjeni");
    }
  } else {
    s += Math.min(30, tags.length * 6) + (row.is_de_minimis ? 5 : 0);
  }

  return { score: Math.min(95, Math.max(10, s)), reasons, penalties };
}

export const scoreGrant = (row: GrantRow, profile: Profile | null | undefined): number =>
  scoreGrantDetailed(row, profile).score;
