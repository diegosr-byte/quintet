// STUB by Josiah, per docs/policy-rules.md "Default rules, v1". Diego owns this file: replace wholesale.
export type Verdict = "ALLOW" | "ASK" | "BLOCK";
export type DocKind = "invoice" | "receipt" | "email" | "credit_note" | "unknown";

export type PolicyRules = {
  currency: string;
  minExtractionConfidence: number;
  knownDocKinds: DocKind[];
  requiredFields: Record<string, string[]>;
  newPayee: { verdict: Verdict; requireCrsPass: boolean };
  detailChange: { fields: string[]; untilCall: Verdict; ifConfirmed: Verdict; ifUnclear: Verdict };
  crs: {
    blockOnIdentityFail: boolean;
    fraudScoreBlockAt: number;
    fraudScoreAskAt: number;
    fraudAlert: Verdict;
    reversePhoneMismatch: Verdict;
  };
  caps: { ownerAboveCents: number; accountantAboveCents: number; dailyOutflowCents: number };
  duplicates: { verdict: Verdict; receiptWindowDays: number };
  injection: { verdict: Verdict };
  reimbursements: { requireItemized: boolean; disallowedCategories: string[]; maxAgeDays: number };
  splitPurchase: { windowDays: number; verdict: Verdict };
};

export const defaultRules: PolicyRules = {
  currency: "USD",
  minExtractionConfidence: 0.9,
  knownDocKinds: ["invoice", "receipt"],
  requiredFields: {
    invoice: ["vendorOrMerchantName", "invoiceNumber", "totalCents", "payTo"],
    receipt: ["vendorOrMerchantName", "issueDate", "totalCents"],
  },
  newPayee: { verdict: "ASK", requireCrsPass: true },
  detailChange: { fields: ["bank", "phone", "emailDomain"], untilCall: "BLOCK", ifConfirmed: "ASK", ifUnclear: "ASK" },
  crs: { blockOnIdentityFail: true, fraudScoreBlockAt: 70, fraudScoreAskAt: 40, fraudAlert: "ASK", reversePhoneMismatch: "BLOCK" },
  caps: { ownerAboveCents: 50000, accountantAboveCents: 100000, dailyOutflowCents: 300000 },
  duplicates: { verdict: "BLOCK", receiptWindowDays: 60 },
  injection: { verdict: "ASK" },
  reimbursements: { requireItemized: true, disallowedCategories: ["alcohol", "gift_card", "tobacco"], maxAgeDays: 30 },
  splitPurchase: { windowDays: 7, verdict: "ASK" },
};
