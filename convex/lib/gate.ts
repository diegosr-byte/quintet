// The policy gate. Pure TypeScript: no Convex imports, no I/O, no Date.now() (callers pass times in).
// A verdict only ever rises (ALLOW < ASK < BLOCK); no rule can lower it. Rules: docs/policy-rules.md.
import type { DocKind, PolicyRules, Verdict } from "./policy";

export type CallOutcome = "confirmed_change" | "denied_change" | "unclear" | "no_answer";
export type ApprovalRole = "owner" | "accountant";

export type GateInput = {
  killSwitch: boolean;
  caseKind: "vendor_payment" | "reimbursement";
  docKind: DocKind;
  amountCents: number | null;
  currency: string;
  extractionConfidence: number;
  missingRequiredFields: string[];
  parserAgrees: boolean | null;
  payee: { known: boolean; firstPayment: boolean };
  crs: {
    identity: "pass" | "fail" | "skipped" | "not_needed";
    fraudScore: number | null;
    fraudAlert: boolean;
    reversePhone: "match" | "mismatch" | "skipped";
  };
  changed: { bank: boolean; phone: boolean; emailDomain: boolean };
  duplicate: { invoice: boolean; receipt: boolean };
  injectionFound: boolean;
  receipt: { itemized: boolean | null; disallowedItems: string[]; ageDays: number | null } | null;
  outflow: { paidTodayCents: number; samePayeeLast7DaysCents: number };
  call: { outcome: CallOutcome | null };
  modelRecommendation: "NONE" | "ASK" | "BLOCK";
};

export type Decision = {
  verdict: Verdict;
  reasons: string[];
  ruleIds: string[];
  requiredApprovals: ApprovalRole[];
  needsCall: boolean;
  final: boolean;
};

const RANK: Record<Verdict, number> = { ALLOW: 0, ASK: 1, BLOCK: 2 };
const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export function evaluate(rules: PolicyRules, input: GateInput): Decision {
  const d: Decision = { verdict: "ALLOW", reasons: [], ruleIds: [], requiredApprovals: [], needsCall: false, final: false };
  if (input.killSwitch) {
    return { ...d, verdict: "BLOCK", reasons: ["All payments are frozen by the owner."], ruleIds: ["KILL"], final: true };
  }

  let needAccountant = false;
  const hit = (id: string, verdict: Verdict, reason: string, final = false) => {
    if (!d.ruleIds.includes(id)) d.ruleIds.push(id);
    d.reasons.push(reason);
    if (RANK[verdict] > RANK[d.verdict]) d.verdict = verdict;
    if (final) d.final = true;
  };
  const amount = input.amountCents;
  const { caps, crs: crsRules } = rules;
  const c = input.crs;

  // R0: ALLOW only if every precondition holds; anything unfamiliar goes to a human.
  if (input.extractionConfidence < rules.minExtractionConfidence)
    hit("R0", "ASK", `Needs a human: the document was read with low confidence (${Math.round(input.extractionConfidence * 100)}%).`);
  if (input.missingRequiredFields.length)
    hit("R0", "ASK", `Needs a human: missing required fields (${input.missingRequiredFields.join(", ")}).`);
  if (!rules.knownDocKinds.includes(input.docKind))
    hit("R0", "ASK", `Needs a human: this is a ${input.docKind.replace("_", " ")}, which isn't handled automatically.`);
  if (input.parserAgrees === false)
    hit("R0", "ASK", "Needs a human: the amount, account or invoice number read by the AI doesn't match the document's own text.");
  if (input.currency !== rules.currency)
    hit("R0", "ASK", `Needs a human: the currency is ${input.currency}, not ${rules.currency}.`);
  if (amount === null) hit("R0", "ASK", "Needs a human: no amount could be read.");

  // R1: first payment to a payee.
  if (!input.payee.known || input.payee.firstPayment) {
    hit("R1", rules.newPayee.verdict, input.payee.known ? "First payment to this payee; the owner signs the first one." : "This payee isn't on file.");
    if (rules.newPayee.requireCrsPass && c.identity !== "pass" && c.identity !== "fail")
      hit("R1", "ASK", "Couldn't verify the payee's identity with CRS.");
  }

  // R2: payee details changed since the last payment; confirm by phoning the number on file.
  const changed = rules.detailChange.fields.filter((f) => input.changed[f as keyof GateInput["changed"]]);
  if (changed.length) {
    const what = changed.join(", ").replace("emailDomain", "email domain");
    const o = input.call.outcome;
    if (o === null) {
      d.needsCall = true;
      hit("R2", rules.detailChange.untilCall, `The ${what} changed since the last payment. Calling the number on file to verify.`);
    } else if (o === "denied_change") {
      hit("R2", "BLOCK", `The vendor said they did not change their ${what}. Payment blocked.`, true);
    } else if (o === "confirmed_change") {
      hit("R2", rules.detailChange.ifConfirmed, `The vendor confirmed the new ${what}; the owner signs off.`);
    } else {
      hit("R2", rules.detailChange.ifUnclear, `The call about the changed ${what} was inconclusive (${o.replace("_", " ")}).`);
    }
  }

  // R3: CRS identity and fraud signals.
  if (c.identity === "fail" && crsRules.blockOnIdentityFail) hit("R3", "BLOCK", "CRS identity verification failed.", true);
  if (c.fraudScore !== null && c.fraudScore >= crsRules.fraudScoreBlockAt)
    hit("R3", "BLOCK", `CRS fraud score ${c.fraudScore}/100 is at or above the block line (${crsRules.fraudScoreBlockAt}).`, true);
  else if (c.fraudScore !== null && c.fraudScore >= crsRules.fraudScoreAskAt)
    hit("R3", "ASK", `CRS fraud score ${c.fraudScore}/100 is elevated.`);
  if (c.reversePhone === "mismatch")
    hit("R3", crsRules.reversePhoneMismatch, "CRS: the phone number belongs to someone else.", crsRules.reversePhoneMismatch === "BLOCK");
  if (c.fraudAlert) hit("R3", crsRules.fraudAlert, "CRS: a fraud alert is on file for this identity.");

  // R4: amount limits (owner, then owner + accountant).
  if (amount !== null && amount > caps.ownerAboveCents) {
    hit("R4", "ASK", `${usd(amount)} is over the ${usd(caps.ownerAboveCents)} owner-approval limit.`);
    if (amount > caps.accountantAboveCents) {
      needAccountant = true;
      d.reasons.push(`${usd(amount)} is over the ${usd(caps.accountantAboveCents)} two-signature limit.`);
    }
  }

  // R5: daily outflow cap.
  if (amount !== null && input.outflow.paidTodayCents + amount > caps.dailyOutflowCents)
    hit("R5", "ASK", `This would take today's outflow over the ${usd(caps.dailyOutflowCents)} daily cap.`);

  // R6: duplicates.
  if (input.duplicate.invoice || input.duplicate.receipt)
    hit("R6", rules.duplicates.verdict, `This ${input.duplicate.invoice ? "invoice" : "receipt"} was already submitted.`, rules.duplicates.verdict === "BLOCK");

  // R7: text aimed at the AI is evidence; never auto-ALLOW.
  if (input.injectionFound)
    hit("R7", RANK[rules.injection.verdict] >= RANK.ASK ? rules.injection.verdict : "ASK", "The document contains hidden instructions aimed at the AI.");

  // R8: reimbursement receipt rules.
  if (input.caseKind === "reimbursement") {
    const r = input.receipt;
    const rr = rules.reimbursements;
    if (!r) hit("R8", "ASK", "No receipt details to check.");
    else {
      if (rr.requireItemized && r.itemized !== true) hit("R8", "ASK", "The receipt isn't itemized.");
      if (r.disallowedItems.length) hit("R8", "ASK", `The receipt includes items company policy doesn't reimburse (${r.disallowedItems.join(", ")}).`);
      if (r.ageDays !== null && r.ageDays > rr.maxAgeDays) hit("R8", "ASK", `The receipt is ${r.ageDays} days old (limit ${rr.maxAgeDays}).`);
    }
  }

  // R9: split purchase (this amount alone is under the limit, but the recent total isn't).
  const recent = input.outflow.samePayeeLast7DaysCents;
  if (amount !== null && recent > 0 && amount <= caps.ownerAboveCents && recent + amount > caps.ownerAboveCents)
    hit("R9", rules.splitPurchase.verdict, `${usd(recent)} was already paid to this payee in the last ${rules.splitPurchase.windowDays} days; together with this ${usd(amount)} that looks like a split purchase.`);

  // R10: the model can only make the verdict stricter, never looser.
  if (input.modelRecommendation !== "NONE")
    hit("R10", input.modelRecommendation, `The verification model flagged this (recommends ${input.modelRecommendation}).`);

  if (d.verdict === "ASK") d.requiredApprovals = needAccountant ? ["owner", "accountant"] : ["owner"];
  return d;
}

const subset = (a: readonly string[], b: readonly string[]) => a.every((x) => b.includes(x));

// A new policy version may only tighten the old one; anything looser needs explicit human approval.
export function isTighterOrEqual(oldR: PolicyRules, newR: PolicyRules): { ok: boolean; loosened: string[] } {
  const loosened: string[] = [];
  const check = (key: string, tighter: boolean) => { if (!tighter) loosened.push(key); };
  const verdictKeys: [string, Verdict, Verdict][] = [
    ["newPayee.verdict", oldR.newPayee.verdict, newR.newPayee.verdict],
    ["detailChange.untilCall", oldR.detailChange.untilCall, newR.detailChange.untilCall],
    ["detailChange.ifConfirmed", oldR.detailChange.ifConfirmed, newR.detailChange.ifConfirmed],
    ["detailChange.ifUnclear", oldR.detailChange.ifUnclear, newR.detailChange.ifUnclear],
    ["crs.fraudAlert", oldR.crs.fraudAlert, newR.crs.fraudAlert],
    ["crs.reversePhoneMismatch", oldR.crs.reversePhoneMismatch, newR.crs.reversePhoneMismatch],
    ["duplicates.verdict", oldR.duplicates.verdict, newR.duplicates.verdict],
    ["injection.verdict", oldR.injection.verdict, newR.injection.verdict],
    ["splitPurchase.verdict", oldR.splitPurchase.verdict, newR.splitPurchase.verdict],
  ];
  for (const [key, o, n] of verdictKeys) check(key, RANK[n] >= RANK[o]);

  check("currency", newR.currency === oldR.currency);
  check("minExtractionConfidence", newR.minExtractionConfidence >= oldR.minExtractionConfidence);
  check("knownDocKinds", subset(newR.knownDocKinds, oldR.knownDocKinds));
  for (const kind of Object.keys(oldR.requiredFields)) check(`requiredFields.${kind}`, subset(oldR.requiredFields[kind], newR.requiredFields[kind] ?? []));
  check("newPayee.requireCrsPass", !oldR.newPayee.requireCrsPass || newR.newPayee.requireCrsPass);
  check("crs.blockOnIdentityFail", !oldR.crs.blockOnIdentityFail || newR.crs.blockOnIdentityFail);
  check("reimbursements.requireItemized", !oldR.reimbursements.requireItemized || newR.reimbursements.requireItemized);
  check("detailChange.fields", subset(oldR.detailChange.fields, newR.detailChange.fields));
  check("crs.fraudScoreBlockAt", newR.crs.fraudScoreBlockAt <= oldR.crs.fraudScoreBlockAt);
  check("crs.fraudScoreAskAt", newR.crs.fraudScoreAskAt <= oldR.crs.fraudScoreAskAt);
  check("caps.ownerAboveCents", newR.caps.ownerAboveCents <= oldR.caps.ownerAboveCents);
  check("caps.accountantAboveCents", newR.caps.accountantAboveCents <= oldR.caps.accountantAboveCents);
  check("caps.dailyOutflowCents", newR.caps.dailyOutflowCents <= oldR.caps.dailyOutflowCents);
  check("duplicates.receiptWindowDays", newR.duplicates.receiptWindowDays >= oldR.duplicates.receiptWindowDays);
  check("splitPurchase.windowDays", newR.splitPurchase.windowDays >= oldR.splitPurchase.windowDays);
  check("reimbursements.disallowedCategories", subset(oldR.reimbursements.disallowedCategories, newR.reimbursements.disallowedCategories));
  check("reimbursements.maxAgeDays", newR.reimbursements.maxAgeDays <= oldR.reimbursements.maxAgeDays);
  return { ok: loosened.length === 0, loosened };
}
