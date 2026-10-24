import { describe, expect, it } from "vitest";
import { evaluate, isTighterOrEqual, GateInput } from "./gate";
import { defaultRules, PolicyRules } from "./policy";

// A clean, routine invoice from a known, previously paid vendor: nothing triggers.
const clean = (over: Partial<GateInput> = {}): GateInput => ({
  killSwitch: false,
  caseKind: "vendor_payment",
  docKind: "invoice",
  amountCents: 28000,
  currency: "USD",
  extractionConfidence: 0.97,
  missingRequiredFields: [],
  parserAgrees: true,
  payee: { known: true, firstPayment: false },
  crs: { identity: "not_needed", fraudScore: null, fraudAlert: false, reversePhone: "skipped" },
  changed: { bank: false, phone: false, emailDomain: false },
  duplicate: { invoice: false, receipt: false },
  injectionFound: false,
  receipt: null,
  outflow: { paidTodayCents: 0, samePayeeLast7DaysCents: 0 },
  call: { outcome: null },
  modelRecommendation: "NONE",
  ...over,
});
const run = (over: Partial<GateInput> = {}, rules: PolicyRules = defaultRules) => evaluate(rules, clean(over));
const receipt = (over = {}) => ({ itemized: true, disallowedItems: [] as string[], ageDays: 3, ...over });

describe("baseline and kill switch", () => {
  it("allows a clean invoice", () => {
    expect(run()).toMatchObject({ verdict: "ALLOW", ruleIds: [], reasons: [], requiredApprovals: [], needsCall: false, final: false });
  });
  it("blocks everything, finally, when the kill switch is on", () => {
    expect(run({ killSwitch: true })).toMatchObject({ verdict: "BLOCK", final: true, ruleIds: ["KILL"] });
  });
});

describe("R0: anything unfamiliar goes to a human", () => {
  it.each([
    ["low confidence", { extractionConfidence: 0.7 }],
    ["missing required field", { missingRequiredFields: ["invoiceNumber"] }],
    ["unknown document kind", { docKind: "credit_note" as const }],
    ["parser disagrees", { parserAgrees: false }],
    ["foreign currency", { currency: "EUR" }],
    ["no amount", { amountCents: null }],
  ])("asks on %s", (_n, over) => {
    const d = run(over);
    expect(d.verdict).toBe("ASK");
    expect(d.ruleIds).toContain("R0");
    expect(d.requiredApprovals).toEqual(["owner"]);
  });
  it("does not trigger at the confidence threshold or with no text layer", () => {
    expect(run({ extractionConfidence: 0.9, parserAgrees: null }).ruleIds).not.toContain("R0");
  });
});

describe("R1: first payment", () => {
  it("asks for an unknown payee and says identity wasn't verified", () => {
    const d = run({ payee: { known: false, firstPayment: true }, crs: { identity: "skipped", fraudScore: null, fraudAlert: false, reversePhone: "skipped" } });
    expect(d.verdict).toBe("ASK");
    expect(d.ruleIds).toEqual(["R1"]);
    expect(d.reasons.join(" ")).toMatch(/verify the payee's identity/);
  });
  it("still asks (owner signs the first one) when CRS passes", () => {
    const d = run({ payee: { known: true, firstPayment: true }, crs: { identity: "pass", fraudScore: 9, fraudAlert: false, reversePhone: "match" } });
    expect(d.verdict).toBe("ASK");
    expect(d.reasons).toHaveLength(1);
  });
  it("does not trigger for a known, previously paid payee", () => {
    expect(run().ruleIds).not.toContain("R1");
  });
});

describe("R2: changed details need the call", () => {
  const changedBank = { changed: { bank: true, phone: false, emailDomain: false } };
  it("blocks pending a call", () => {
    expect(run(changedBank)).toMatchObject({ verdict: "BLOCK", needsCall: true, final: false, ruleIds: ["R2"] });
  });
  it("blocks finally when the vendor denies the change", () => {
    expect(run({ ...changedBank, call: { outcome: "denied_change" } })).toMatchObject({ verdict: "BLOCK", final: true, needsCall: false });
  });
  it("asks the owner when the vendor confirms the change", () => {
    expect(run({ ...changedBank, call: { outcome: "confirmed_change" } })).toMatchObject({ verdict: "ASK", needsCall: false, final: false });
  });
  it.each(["unclear", "no_answer"] as const)("asks on %s", (outcome) => {
    expect(run({ ...changedBank, call: { outcome } }).verdict).toBe("ASK");
  });
  it("triggers for phone or email-domain changes too, and not when nothing changed", () => {
    expect(run({ changed: { bank: false, phone: true, emailDomain: false } }).ruleIds).toContain("R2");
    expect(run({ changed: { bank: false, phone: false, emailDomain: true } }).ruleIds).toContain("R2");
    expect(run().ruleIds).not.toContain("R2");
  });
});

describe("R3: CRS signals", () => {
  const crs = (over = {}) => ({ identity: "pass" as const, fraudScore: 9, fraudAlert: false, reversePhone: "match" as const, ...over });
  it("blocks finally on identity failure", () => {
    expect(run({ crs: crs({ identity: "fail" }) })).toMatchObject({ verdict: "BLOCK", final: true, ruleIds: ["R3"] });
  });
  it("blocks finally at the fraud-score block line, asks between the lines, passes below", () => {
    expect(run({ crs: crs({ fraudScore: 70 }) })).toMatchObject({ verdict: "BLOCK", final: true });
    expect(run({ crs: crs({ fraudScore: 69 }) }).verdict).toBe("ASK");
    expect(run({ crs: crs({ fraudScore: 40 }) }).verdict).toBe("ASK");
    expect(run({ crs: crs({ fraudScore: 39 }) }).ruleIds).not.toContain("R3");
  });
  it("blocks finally on a reverse-phone mismatch", () => {
    expect(run({ crs: crs({ reversePhone: "mismatch" }) })).toMatchObject({ verdict: "BLOCK", final: true });
  });
  it("asks on a fraud alert", () => {
    expect(run({ crs: crs({ fraudAlert: true }) })).toMatchObject({ verdict: "ASK", final: false });
  });
  it("ignores an identity failure when the rule is switched off", () => {
    const rules = { ...defaultRules, crs: { ...defaultRules.crs, blockOnIdentityFail: false } };
    expect(run({ crs: crs({ identity: "fail" }) }, rules).ruleIds).not.toContain("R3");
  });
});

describe("R4: amount limits", () => {
  it("does not trigger at exactly the owner limit", () => {
    expect(run({ amountCents: 50000 }).ruleIds).not.toContain("R4");
  });
  it("asks the owner just over it", () => {
    expect(run({ amountCents: 50001 })).toMatchObject({ verdict: "ASK", requiredApprovals: ["owner"] });
  });
  it("asks the owner and the accountant over the two-signature limit", () => {
    const d = run({ amountCents: 120000 });
    expect(d.requiredApprovals).toEqual(["owner", "accountant"]);
    expect(d.reasons.join(" ")).toMatch(/\$1,000\.00 two-signature limit/);
  });
  it("does not ask for approvals when the final verdict is BLOCK", () => {
    expect(run({ amountCents: 120000, killSwitch: false, crs: { identity: "fail", fraudScore: null, fraudAlert: false, reversePhone: "skipped" } }).requiredApprovals).toEqual([]);
  });
});

describe("R5, R6, R7, R9", () => {
  it("R5 asks when today's outflow would pass the cap, not at the cap", () => {
    expect(run({ outflow: { paidTodayCents: 290000, samePayeeLast7DaysCents: 0 }, amountCents: 10001 }).ruleIds).toContain("R5");
    expect(run({ outflow: { paidTodayCents: 290000, samePayeeLast7DaysCents: 0 }, amountCents: 10000 }).ruleIds).not.toContain("R5");
  });
  it("R6 blocks finally on a duplicate invoice or receipt", () => {
    expect(run({ duplicate: { invoice: true, receipt: false } })).toMatchObject({ verdict: "BLOCK", final: true, ruleIds: ["R6"] });
    expect(run({ duplicate: { invoice: false, receipt: true } }).verdict).toBe("BLOCK");
  });
  it("R7 never auto-allows when instructions aimed at the AI are found", () => {
    expect(run({ injectionFound: true })).toMatchObject({ verdict: "ASK", ruleIds: ["R7"] });
  });
  it("R7 still asks even if the injection verdict is loosened to ALLOW", () => {
    const rules = { ...defaultRules, injection: { verdict: "ALLOW" as const } };
    expect(run({ injectionFound: true }, rules).verdict).toBe("ASK");
  });
  it("R9 asks when a recent payment plus this one passes the owner limit, though this one alone doesn't", () => {
    const d = run({ amountCents: 45000, outflow: { paidTodayCents: 0, samePayeeLast7DaysCents: 45000 } });
    expect(d).toMatchObject({ verdict: "ASK", ruleIds: ["R9"] });
    expect(run({ amountCents: 45000, outflow: { paidTodayCents: 0, samePayeeLast7DaysCents: 0 } }).ruleIds).not.toContain("R9");
    expect(run({ amountCents: 60000, outflow: { paidTodayCents: 0, samePayeeLast7DaysCents: 45000 } }).ruleIds).toEqual(["R4"]);
  });
});

describe("R8: reimbursement receipts", () => {
  const reimb = (r: object | null) => run({ caseKind: "reimbursement", receipt: r as GateInput["receipt"] });
  it("allows a clean, itemized, recent receipt", () => {
    expect(reimb(receipt()).verdict).toBe("ALLOW");
  });
  it.each([
    ["not itemized", { itemized: false }],
    ["unknown itemization", { itemized: null }],
    ["disallowed item", { disallowedItems: ["alcohol"] }],
    ["too old", { ageDays: 45 }],
  ])("asks when %s", (_n, over) => {
    expect(reimb(receipt(over))).toMatchObject({ verdict: "ASK", ruleIds: ["R8"] });
  });
  it("asks when there are no receipt details, and is skipped for vendor payments", () => {
    expect(reimb(null).ruleIds).toEqual(["R8"]);
    expect(run({ receipt: receipt({ ageDays: 99 }) }).ruleIds).not.toContain("R8");
  });
  it("accepts a receipt exactly at the age limit", () => {
    expect(reimb(receipt({ ageDays: 30 })).verdict).toBe("ALLOW");
  });
});

describe("R10: the model can only tighten", () => {
  it("raises ALLOW to ASK or BLOCK", () => {
    expect(run({ modelRecommendation: "ASK" })).toMatchObject({ verdict: "ASK", ruleIds: ["R10"] });
    expect(run({ modelRecommendation: "BLOCK" }).verdict).toBe("BLOCK");
  });
  it("NONE never lowers a verdict, and no recommendation ever does", () => {
    const rank = { ALLOW: 0, ASK: 1, BLOCK: 2 };
    const variants: Partial<GateInput>[] = [
      {}, { amountCents: 60000 }, { injectionFound: true }, { duplicate: { invoice: true, receipt: false } },
      { changed: { bank: true, phone: false, emailDomain: false } }, { extractionConfidence: 0.5 },
      { crs: { identity: "fail", fraudScore: 85, fraudAlert: false, reversePhone: "mismatch" } },
    ];
    for (const v of variants) {
      const none = run({ ...v, modelRecommendation: "NONE" }).verdict;
      for (const rec of ["ASK", "BLOCK"] as const) expect(rank[run({ ...v, modelRecommendation: rec }).verdict]).toBeGreaterThanOrEqual(rank[none]);
    }
  });
});

describe("the moment (E13): changed bank, CRS fails, hidden instructions, $1,850", () => {
  const moment = clean({
    amountCents: 185000,
    changed: { bank: true, phone: true, emailDomain: false },
    crs: { identity: "fail", fraudScore: 85, fraudAlert: false, reversePhone: "mismatch" },
    injectionFound: true,
  });
  it("is BLOCK and final, still needs the call, and names R2, R3, R4, R7", () => {
    const d = evaluate(defaultRules, moment);
    expect(d).toMatchObject({ verdict: "BLOCK", final: true, needsCall: true, requiredApprovals: [] });
    expect(d.ruleIds).toEqual(["R2", "R3", "R4", "R7"]);
  });
  it("stays BLOCK and final after the vendor denies the change", () => {
    expect(evaluate(defaultRules, { ...moment, call: { outcome: "denied_change" } })).toMatchObject({ verdict: "BLOCK", final: true, needsCall: false });
  });
});

describe("isTighterOrEqual", () => {
  const tweak = (f: (r: PolicyRules) => void) => { const r: PolicyRules = structuredClone(defaultRules); f(r); return r; };
  it("accepts an identical policy", () => {
    expect(isTighterOrEqual(defaultRules, defaultRules)).toEqual({ ok: true, loosened: [] });
  });
  it("accepts tightening: lower caps, more required fields, stricter verdicts, longer windows", () => {
    const tighter = tweak((r) => {
      r.caps.ownerAboveCents = 25000; r.minExtractionConfidence = 0.95; r.requiredFields.invoice.push("dueDate");
      r.splitPurchase.windowDays = 14; r.injection.verdict = "BLOCK"; r.reimbursements.disallowedCategories.push("travel");
    });
    expect(isTighterOrEqual(defaultRules, tighter).ok).toBe(true);
  });
  it.each([
    ["caps.ownerAboveCents", (r: PolicyRules) => { r.caps.ownerAboveCents = 75000; }],
    ["caps.dailyOutflowCents", (r: PolicyRules) => { r.caps.dailyOutflowCents = 999999; }],
    ["minExtractionConfidence", (r: PolicyRules) => { r.minExtractionConfidence = 0.5; }],
    ["duplicates.verdict", (r: PolicyRules) => { r.duplicates.verdict = "ASK"; }],
    ["crs.reversePhoneMismatch", (r: PolicyRules) => { r.crs.reversePhoneMismatch = "ASK"; }],
    ["crs.fraudScoreBlockAt", (r: PolicyRules) => { r.crs.fraudScoreBlockAt = 90; }],
    ["newPayee.requireCrsPass", (r: PolicyRules) => { r.newPayee.requireCrsPass = false; }],
    ["knownDocKinds", (r: PolicyRules) => { r.knownDocKinds.push("credit_note"); }],
    ["requiredFields.invoice", (r: PolicyRules) => { r.requiredFields.invoice = ["totalCents"]; }],
    ["detailChange.fields", (r: PolicyRules) => { r.detailChange.fields = ["bank"]; }],
    ["reimbursements.disallowedCategories", (r: PolicyRules) => { r.reimbursements.disallowedCategories = ["alcohol"]; }],
    ["reimbursements.maxAgeDays", (r: PolicyRules) => { r.reimbursements.maxAgeDays = 90; }],
    ["splitPurchase.windowDays", (r: PolicyRules) => { r.splitPurchase.windowDays = 3; }],
  ])("flags loosening %s", (key, f) => {
    const res = isTighterOrEqual(defaultRules, tweak(f));
    expect(res.ok).toBe(false);
    expect(res.loosened).toContain(key);
  });
});
