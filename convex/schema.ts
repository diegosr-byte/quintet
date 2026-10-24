import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Enums: docs/contracts.md §2
export const verdict = v.union(v.literal("ALLOW"), v.literal("ASK"), v.literal("BLOCK"));
export const caseStatus = v.union(
  v.literal("received"),
  v.literal("extracting"),
  v.literal("checking"),
  v.literal("awaiting_call"),
  v.literal("awaiting_approval"),
  v.literal("paying"),
  v.literal("paid"),
  v.literal("blocked"),
  v.literal("rejected"),
  v.literal("failed"),
);
export const caseKind = v.union(v.literal("vendor_payment"), v.literal("reimbursement"));
export const docKind = v.union(
  v.literal("invoice"),
  v.literal("receipt"),
  v.literal("email"),
  v.literal("credit_note"),
  v.literal("unknown"),
);
export const partyKind = v.union(v.literal("vendor"), v.literal("employee"));
export const seat = v.union(
  v.literal("intake"),
  v.literal("verification"),
  v.literal("caller"),
  v.literal("payments"),
  v.literal("controller"),
  v.literal("human"),
  v.literal("system"),
);
export const checkKind = v.union(
  v.literal("extraction_confidence"),
  v.literal("required_fields"),
  v.literal("doc_type"),
  v.literal("parser_crosscheck"),
  v.literal("payee_known"),
  v.literal("bank_match"),
  v.literal("contact_match"),
  v.literal("crs_identity"),
  v.literal("crs_fraud_score"),
  v.literal("crs_reverse_phone"),
  v.literal("duplicate"),
  v.literal("injection"),
  v.literal("amount_cap"),
  v.literal("daily_cap"),
  v.literal("split_purchase"),
  v.literal("receipt_rules"),
  v.literal("call_outcome"),
  v.literal("kill_switch"),
);
export const checkResult = v.union(v.literal("pass"), v.literal("fail"), v.literal("warn"), v.literal("skipped"));
export const callOutcome = v.union(
  v.literal("confirmed_change"),
  v.literal("denied_change"),
  v.literal("unclear"),
  v.literal("no_answer"),
);
export const approvalRole = v.union(v.literal("owner"), v.literal("accountant"));
export const actionKind = v.union(
  v.literal("case_created"),
  v.literal("extracted"),
  v.literal("check_ran"),
  v.literal("crs_called"),
  v.literal("gate_decided"),
  v.literal("call_placed"),
  v.literal("call_result"),
  v.literal("approval_requested"),
  v.literal("approval_given"),
  v.literal("approval_denied"),
  v.literal("payment_started"),
  v.literal("payment_succeeded"),
  v.literal("payment_failed"),
  v.literal("payment_retried"),
  v.literal("explanation_written"),
  v.literal("kill_switch_changed"),
  v.literal("policy_version_created"),
  v.literal("question_answered"),
);

// Extraction: docs/contracts.md §5
export const extraction = v.object({
  docKind,
  vendorOrMerchantName: v.union(v.string(), v.null()),
  contactEmail: v.union(v.string(), v.null()),
  contactPhone: v.union(v.string(), v.null()),
  invoiceNumber: v.union(v.string(), v.null()),
  issueDate: v.union(v.string(), v.null()),
  dueDate: v.union(v.string(), v.null()),
  currency: v.string(),
  totalCents: v.union(v.number(), v.null()),
  lineItems: v.array(
    v.object({
      description: v.string(),
      amountCents: v.number(),
      category: v.union(
        v.literal("goods"),
        v.literal("services"),
        v.literal("food"),
        v.literal("alcohol"),
        v.literal("gift_card"),
        v.literal("tobacco"),
        v.literal("other"),
      ),
    }),
  ),
  payTo: v.union(v.object({ name: v.string(), routingNumber: v.string(), accountNumber: v.string() }), v.null()),
  itemized: v.union(v.boolean(), v.null()),
  suspiciousInstructions: v.array(v.string()),
  confidence: v.number(),
  missingFields: v.array(v.string()),
});

export const parserFields = v.object({
  totalCents: v.union(v.number(), v.null()),
  routingNumber: v.union(v.string(), v.null()),
  accountNumber: v.union(v.string(), v.null()),
  invoiceNumber: v.union(v.string(), v.null()),
});

export default defineSchema({
  orgs: defineTable({
    name: v.string(),
    killSwitch: v.boolean(),
    // Null only for the moment between inserting the org and its first policy version.
    activePolicyVersionId: v.union(v.id("policyVersions"), v.null()),
    isEval: v.boolean(),
    nessieAccountId: v.string(),
  }),

  policyVersions: defineTable({
    orgId: v.id("orgs"),
    version: v.number(),
    rules: v.any(), // PolicyRules, docs/policy-rules.md
    source: v.string(),
    createdBy: v.string(),
    approvedBy: v.union(v.string(), v.null()),
    approvedAt: v.union(v.number(), v.null()),
    diffSummary: v.union(v.string(), v.null()),
    testsPassed: v.union(v.boolean(), v.null()),
  }).index("by_org", ["orgId"]),

  parties: defineTable({
    orgId: v.id("orgs"),
    key: v.string(),
    kind: partyKind,
    displayName: v.string(),
    legalName: v.string(),
    email: v.string(),
    emailDomain: v.string(),
    phoneOnFile: v.string(),
    callTargetPhone: v.union(v.string(), v.null()), // only calls.place reads this; never sent to CRS or the UI
    bankOnFile: v.union(
      v.object({ routingLast4: v.string(), accountLast4: v.string(), fingerprint: v.string() }),
      v.null(),
    ),
    crsPersonaId: v.union(v.string(), v.null()),
    crsStatus: v.union(v.literal("unverified"), v.literal("passed"), v.literal("failed")),
    nessieAccountId: v.union(v.string(), v.null()),
    firstPaidAt: v.union(v.number(), v.null()),
  })
    .index("by_org_kind", ["orgId", "kind"])
    .index("by_org_key", ["orgId", "key"]),

  documents: defineTable({
    orgId: v.id("orgs"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    sha256: v.string(), // "" until intake hashes the file
    kind: docKind,
    source: v.union(v.literal("upload"), v.literal("console"), v.literal("eval")),
    extracted: v.union(extraction, v.null()),
    parserFields: v.union(parserFields, v.null()),
    injectionFindings: v.array(v.object({ text: v.string(), where: v.string() })),
  }).index("by_sha256", ["sha256"]),

  cases: defineTable({
    orgId: v.id("orgs"),
    documentId: v.id("documents"),
    kind: caseKind,
    partyId: v.union(v.id("parties"), v.null()),
    amountCents: v.union(v.number(), v.null()),
    currency: v.string(),
    invoiceNumber: v.union(v.string(), v.null()),
    status: caseStatus,
    verdict: v.union(verdict, v.null()),
    reasons: v.array(v.string()),
    ruleIds: v.array(v.string()),
    requiredApprovals: v.array(approvalRole),
    explanation: v.union(v.string(), v.null()),
    evalCaseId: v.union(v.string(), v.null()),
    faultInjection: v.boolean(),
    simulatedCallOutcome: v.union(callOutcome, v.null()),
  })
    .index("by_org_status", ["orgId", "status"])
    .index("by_document", ["documentId"]),

  checks: defineTable({
    caseId: v.id("cases"),
    kind: checkKind,
    result: checkResult,
    detail: v.string(),
    evidence: v.union(v.any(), v.null()),
    seat,
  }).index("by_case", ["caseId"]),

  // Append-only audit log. Never patch or delete these rows.
  actions: defineTable({
    orgId: v.id("orgs"),
    caseId: v.union(v.id("cases"), v.null()),
    seat,
    kind: actionKind,
    summary: v.string(),
    data: v.union(v.any(), v.null()),
    ruleIds: v.union(v.array(v.string()), v.null()),
  })
    .index("by_case", ["caseId"])
    .index("by_org", ["orgId"]),

  approvals: defineTable({
    caseId: v.id("cases"),
    role: approvalRole,
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("denied")),
    decidedBy: v.union(v.string(), v.null()),
    typedAmountCents: v.union(v.number(), v.null()),
    decidedAt: v.union(v.number(), v.null()),
  }).index("by_case", ["caseId"]),

  payments: defineTable({
    caseId: v.id("cases"),
    idempotencyKey: v.string(),
    amountCents: v.number(),
    payeeNessieAccountId: v.string(),
    tag: v.string(),
    nessieTransferId: v.union(v.string(), v.null()),
    status: v.union(v.literal("pending"), v.literal("succeeded"), v.literal("failed")),
    attempts: v.number(),
    lastError: v.union(v.string(), v.null()),
    succeededAt: v.union(v.number(), v.null()), // for the daily cap (R5) and the 7-day split check (R9)
  })
    .index("by_case", ["caseId"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

  calls: defineTable({
    caseId: v.id("cases"),
    partyId: v.id("parties"),
    toNumber: v.string(),
    cartesiaCallId: v.union(v.string(), v.null()),
    status: v.union(v.literal("queued"), v.literal("in_progress"), v.literal("completed"), v.literal("failed")),
    outcome: v.union(callOutcome, v.null()),
    transcript: v.array(v.object({ speaker: v.string(), text: v.string() })),
    startedAt: v.union(v.number(), v.null()),
    endedAt: v.union(v.number(), v.null()),
  }).index("by_case", ["caseId"]),

  // A failed CRS login, recorded so no function on this deployment ever retries it.
  crsLogin: defineTable({ failedAt: v.number(), error: v.string() }),

  evalRuns: defineTable({
    orgId: v.id("orgs"),
    policyVersionId: v.id("policyVersions"),
    startedAt: v.number(),
    finishedAt: v.union(v.number(), v.null()),
    results: v.array(
      v.object({
        evalCaseId: v.string(),
        caseId: v.union(v.id("cases"), v.null()),
        expected: v.array(verdict),
        actual: v.union(verdict, v.null()),
        paid: v.boolean(),
        ms: v.number(),
        costUsd: v.number(),
        pass: v.boolean(),
        note: v.string(),
      }),
    ),
    summary: v.union(
      v.object({
        attacksStopped: v.number(),
        attacksTotal: v.number(),
        legitAuto: v.number(),
        legitTotal: v.number(),
        wrongfulHolds: v.number(),
        askRate: v.number(),
        medianMs: v.number(),
        costPerCaseUsd: v.number(),
      }),
      v.null(),
    ),
  }),
});
