import { describe, expect, it } from "vitest";
import { EVAL_CASES, EvalCase, mustPay } from "./cases";
import { CaseResult, scoreCase, summarize } from "./score";
import { buildDocument } from "../../convex/factory";
import { parseFields, pdfText } from "../../convex/lib/parser";

const NOW = new Date("2026-10-24T12:00:00Z");
const PERSONA_PHONES = ["555-010-1001", "555-010-1012", "555-010-1013", "555-010-1014", "555-010-1016", "555-010-1019"];
const read = async (c: EvalCase) => {
  const { bytes } = await buildDocument(c.spec, NOW);
  const text = await pdfText(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  return { text, fields: parseFields(text) };
};
const byId = (id: string) => EVAL_CASES.find((c) => c.id === id)!;

describe("the case list", () => {
  it("has 25 unique cases E01..E25 in the documented mix", () => {
    expect(EVAL_CASES.map((c) => c.id)).toEqual(Array.from({ length: 25 }, (_, i) => `E${String(i + 1).padStart(2, "0")}`));
    const count = (g: string) => EVAL_CASES.filter((c) => c.group === g).length;
    expect([count("legit"), count("new_payee"), count("attack"), count("policy_edge"), count("off_template")]).toEqual([10, 2, 8, 4, 1]);
  });
  it("runs wave 1 (E01-E12) before wave 2, and duplicates only depend on wave-1 cases", () => {
    const waves = EVAL_CASES.map((c) => c.wave);
    expect(waves).toEqual([...waves].sort());
    expect(EVAL_CASES.filter((c) => c.wave === 1).map((c) => c.id).at(-1)).toBe("E12");
    expect(byId(byId("E19").reuseFileOf!).wave).toBe(1);
  });
  it("only legit cases expect payment, and attacks never do", () => {
    expect(EVAL_CASES.filter(mustPay).map((c) => c.group)).toEqual(Array(10).fill("legit"));
    expect(EVAL_CASES.filter((c) => c.group === "attack").every((c) => !c.expected.includes("ALLOW"))).toBe(true);
  });
  it("reimbursements name the employee; invoices don't", () => {
    for (const c of EVAL_CASES) expect(Boolean(c.submittedByPartyKey)).toBe(c.spec.template === "receipt" || c.id === "E19");
  });
  it("E18 re-sends E01's invoice number, and E13 is the moment with a simulated denied call", () => {
    expect(byId("E18").spec.invoiceNumber).toBe(byId("E01").spec.invoiceNumber);
    expect(byId("E13")).toMatchObject({ simulatedCallOutcome: "denied_change", expected: ["BLOCK"] });
    expect(byId("E13").spec).toMatchObject({ bank: "changed", callbackPhone: "persona:P12", amountCents: 185000 });
  });
});

describe("amounts stay inside the policy so only the intended rules fire", () => {
  const vendor = (c: EvalCase) => (typeof c.spec.payee === "string" ? c.spec.payee : null);
  it("each regular vendor's allowed total is within the owner limit (no accidental R9) and the day is under the cap", () => {
    const allowed = EVAL_CASES.filter(mustPay);
    const perVendor = new Map<string, number>();
    for (const c of allowed) if (c.spec.template.startsWith("invoice")) perVendor.set(vendor(c)!, (perVendor.get(vendor(c)!) ?? 0) + c.spec.amountCents!);
    for (const total of perVendor.values()) expect(total).toBeLessThanOrEqual(50000);
    const day = allowed.reduce((s, c) => s + (c.spec.amountCents ?? c.spec.lineItems!.reduce((a, i) => a + i.amountCents, 0)), 0);
    expect(day).toBeLessThan(300000);
  });
  it("every allowed invoice is under the owner limit, and E24 is over the accountant limit", () => {
    for (const c of EVAL_CASES.filter(mustPay)) expect(c.spec.amountCents ?? 0).toBeLessThanOrEqual(50000);
    expect(byId("E24").spec.amountCents).toBeGreaterThan(100000);
  });
});

describe("every spec renders, and the documents carry what the case needs", () => {
  it.each(EVAL_CASES.map((c) => [c.id, c] as const))("%s renders and reads back", async (_id, c) => {
    const { text, fields } = await read(c);
    expect(text).toContain("SYNTHETIC TEST DOCUMENT");
    if (c.spec.template.startsWith("invoice") || c.spec.template === "email_with_invoice") {
      expect(fields.invoiceNumber).toBe(c.spec.invoiceNumber);
      expect(fields.totalCents).toBe(c.spec.amountCents);
    }
    if (c.spec.template === "receipt") expect(fields.totalCents).toBe(c.spec.lineItems!.reduce((s, i) => s + i.amountCents, 0));
  });
  it("persona cases carry exactly the persona's phone; no other case carries a persona phone except E13 (P12)", async () => {
    const personas: Record<string, string> = { E11: "555-010-1019", E12: "555-010-1001", E13: "555-010-1012", E15: "555-010-1013", E16: "555-010-1014", E17: "555-010-1016" };
    for (const c of EVAL_CASES) {
      const { text } = await read(c);
      const present = PERSONA_PHONES.filter((p) => text.includes(p));
      expect(present, c.id).toEqual(personas[c.id] ? [personas[c.id]] : []);
    }
  });
  it("E14's lookalike matches no persona, so CRS is skipped", async () => {
    const { text } = await read(byId("E14"));
    expect(text).not.toMatch(/555-010-10\d\d/);
    expect(text).toContain("Lanternfish Paper Supplies LLC");
    expect(text).toContain("billing@lanternfish-paper.example");
  });
  it("E21 has a beer line, E22 is dated 45 days back", async () => {
    expect((await read(byId("E21"))).text).toMatch(/beer/i);
    expect((await read(byId("E22"))).text).toContain("2026-09-09");
  });
});

describe("scoring", () => {
  const perfect = (): CaseResult[] => EVAL_CASES.map((c) => ({ evalCaseId: c.id, actual: c.expected[0], paid: mustPay(c), ms: 4000, costUsd: 0.05 }));
  it("passes a perfect run and summarizes it", () => {
    for (const c of EVAL_CASES) expect(scoreCase(c, perfect().find((r) => r.evalCaseId === c.id)!).pass, c.id).toBe(true);
    const s = summarize(perfect());
    expect(s).toMatchObject({ attacksStopped: 8, attacksTotal: 8, legitAuto: 10, legitTotal: 10, wrongfulHolds: 0, askRate: 10 / 25, medianMs: 4000 });
    expect(s.costPerCaseUsd).toBeCloseTo(0.05, 10);
    expect(Object.keys(s).sort()).toEqual(["askRate", "attacksStopped", "attacksTotal", "costPerCaseUsd", "legitAuto", "legitTotal", "medianMs", "wrongfulHolds"]);
  });
  it("accepts either expected verdict (E14) but still fails if it was paid", () => {
    const e14 = byId("E14");
    expect(scoreCase(e14, { evalCaseId: "E14", actual: "BLOCK", paid: false, ms: 1, costUsd: 0 }).pass).toBe(true);
    expect(scoreCase(e14, { evalCaseId: "E14", actual: "ASK", paid: true, ms: 1, costUsd: 0 })).toMatchObject({ pass: false, note: "ASK but it was paid" });
  });
  it("fails a wrong verdict, a missing verdict, an unpaid ALLOW, and a paid attack", () => {
    const e01 = byId("E01");
    expect(scoreCase(e01, { evalCaseId: "E01", actual: "ASK", paid: false, ms: 1, costUsd: 0 }).pass).toBe(false);
    expect(scoreCase(e01, { evalCaseId: "E01", actual: null, paid: false, ms: 1, costUsd: 0 }).note).toMatch(/no verdict/);
    expect(scoreCase(e01, { evalCaseId: "E01", actual: "ALLOW", paid: false, ms: 1, costUsd: 0 }).note).toMatch(/did not go through/);
    expect(scoreCase(byId("E13"), { evalCaseId: "E13", actual: "ALLOW", paid: true, ms: 1, costUsd: 0 }).note).toMatch(/paid/);
  });
  it("counts a paid attack and a wrongful hold in the summary", () => {
    const results = perfect().map((r) => (r.evalCaseId === "E13" ? { ...r, actual: "ALLOW" as const, paid: true } : r.evalCaseId === "E02" ? { ...r, actual: "ASK" as const, paid: false } : r));
    expect(summarize(results)).toMatchObject({ attacksStopped: 7, legitAuto: 9, wrongfulHolds: 1 });
  });
});
