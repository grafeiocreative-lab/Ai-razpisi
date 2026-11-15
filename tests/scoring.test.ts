import { describe, expect, it } from "vitest";
import { applicantClasses, scoreGrant, scoreGrantDetailed, skdSection } from "../supabase/functions/_shared/scoring";

const doo = { interests: [], kmu: "MALO", dmFree: 200000, region: "Zahodna Slovenija", legalForm: "d.o.o.", skdCode: null, skdLabel: null };
const base = { title: "Javni razpis", eligibility: { applicants: [], sectors: [] } };

describe("applicantClasses", () => {
  it("razpozna samostojnega podjetnika", () => {
    expect(applicantClasses("Samostojni podjetnik posameznik s.p.", null)).toEqual(["sp"]);
  });
  it("razpozna družbo", () => {
    expect(applicantClasses("Družba z omejeno odgovornostjo d.o.o.", null)).toEqual(["podjetja"]);
  });
  it("neznana pravna oblika šteje kot podjetje ali s.p.", () => {
    expect(applicantClasses(null, null)).toEqual(["podjetja", "sp"]);
  });
  it("dejavnost A doda kmetije", () => {
    expect(applicantClasses("s.p.", "A01.11")).toContain("kmetije");
  });
});

describe("skdSection", () => {
  it("vrne črko oddelka", () => expect(skdSection("K62.10")).toBe("K"));
  it("brez šifre vrne null", () => expect(skdSection(null)).toBeNull());
});

describe("scoreGrant", () => {
  it("brez profila ostane v razponu 10-95", () => {
    const s = scoreGrant({ ...base, eligible_sectors: ["a", "b"] }, null);
    expect(s).toBeGreaterThanOrEqual(10);
    expect(s).toBeLessThanOrEqual(95);
  });

  it("razpis za raziskovalne organizacije podjetju močno odšteje", () => {
    const research = scoreGrant({ ...base, eligibility: { applicants: ["raziskovalne"], sectors: [] } }, doo);
    const neutral = scoreGrant(base, doo);
    expect(research).toBeLessThan(neutral - 30);
  });

  it("razpis za podjetja doda točke", () => {
    expect(scoreGrant({ ...base, eligibility: { applicants: ["podjetja"], sectors: [] } }, doo)).toBeGreaterThan(scoreGrant(base, doo));
  });

  it("s.p. se razpisu samo za podjetja ne odšteva", () => {
    const sp = { ...doo, legalForm: "s.p." };
    expect(scoreGrant({ ...base, eligibility: { applicants: ["podjetja"], sectors: [] } }, sp)).toBe(scoreGrant(base, sp));
  });

  it("kmetijski razpis ne ustreza IT podjetju, a ustreza kmetiji", () => {
    const agri = { ...base, eligibility: { applicants: ["kmetije"], sectors: ["A"] } };
    const it = { ...doo, skdCode: "J62.01" };
    const farm = { ...doo, legalForm: "s.p.", skdCode: "A01.11" };
    expect(scoreGrant(agri, it)).toBeLessThan(40);
    expect(scoreGrant(agri, farm)).toBeGreaterThan(60);
  });

  it("razpis omejen na dejavnost, ko dejavnost ni znana, dobi odbitek", () => {
    const restricted = { ...base, eligibility: { applicants: [], sectors: ["I"] } };
    expect(scoreGrant(restricted, doo)).toBeLessThan(scoreGrant(base, doo));
  });

  it("nerazvrščen razpis (eligibility = null) ne more preseči 55", () => {
    const interest = { ...doo, interests: ["digi", "green", "rd"], skdLabel: "Računalniško programiranje" };
    const pending = { title: "digitalizacija zeleni razvoj", eligibility: null, eligible_company_sizes: ["small"] };
    expect(scoreGrant(pending, interest)).toBeLessThanOrEqual(55);
  });

  it("razpis, kjer eligibility ni naložen (undefined), ni omejen", () => {
    const loaded = { title: "digitalizacija", eligible_company_sizes: ["small"] };
    expect(scoreGrant(loaded, { ...doo, interests: ["digi"] })).toBeGreaterThan(55);
  });

  it("interes se ujema z besedilom razpisa", () => {
    const r = scoreGrantDetailed({ ...base, title: "Digitalizacija poslovanja" }, { ...doo, interests: ["digi"] });
    expect(r.reasons.join(" ")).toContain("digitalizacija");
  });

  it("de minimis izčrpan odšteje, prost doda", () => {
    const dm = { ...base, is_de_minimis: true };
    expect(scoreGrant(dm, { ...doo, dmFree: 0 })).toBeLessThan(scoreGrant(dm, doo));
  });

  it("razpis za drugo regijo odšteje", () => {
    const regional = { ...base, eligible_regions: ["Vzhodna Slovenija"] };
    expect(scoreGrant(regional, doo)).toBeLessThan(scoreGrant(base, doo));
  });

  it("velikost podjetja neustrezna odšteje", () => {
    const small = { ...base, eligible_company_sizes: ["micro"] };
    expect(scoreGrant(small, { ...doo, kmu: "SREDNJE" })).toBeLessThan(scoreGrant(base, { ...doo, kmu: "SREDNJE" }));
  });
});
