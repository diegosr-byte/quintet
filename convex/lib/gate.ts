// STUB by Josiah, per docs/contracts.md §4 (always ASK, reason "stub"). Diego owns this file: replace wholesale.
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

export function evaluate(_rules: PolicyRules, input: GateInput): Decision {
  if (input.killSwitch) {
    return { verdict: "BLOCK", reasons: ["All payments are frozen by the owner."], ruleIds: ["KILL"], requiredApprovals: [], needsCall: false, final: true };
  }
  return { verdict: "ASK", reasons: ["stub"], ruleIds: [], requiredApprovals: ["owner"], needsCall: false, final: false };
}

export function isTighterOrEqual(_oldRules: PolicyRules, _newRules: PolicyRules): { ok: boolean; loosened: string[] } {
  return { ok: false, loosened: ["stub"] };
}
