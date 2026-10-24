# Contracts (freeze at Fri 6:45 PM)

These are the interfaces between the three workstreams. Build against them, and stub anything that hasn't been delivered yet.

To change one: get all three to agree, then update this file in the same commit.

## 1. Pipeline at a glance
```
documents.ingest (mutation, creates the case)
  → intakeNode.extract (action: Claude, no tools, structured output + parser re-read)
  → verify.run       (action: on-file diff, duplicates, CRS, injection scan, Claude fuzzy match)
  → gateRun.decide   (mutation: builds GateInput, calls evaluate(), writes the decision)
       ALLOW                      → payments.execute (action, Nessie) → paid
       ASK                        → approvals rows → approvals.decide (UI) → all approved → payments.execute
       BLOCK, needsCall           → calls.place (action, Cartesia) → POST /cartesia/outcome (http)
                                       → calls.recordOutcome → gateRun.decide again
       BLOCK, final               → blocked
  after every decision → explain.write (action) stores cases.explanation
```

## 2. Enums

| Name | Values |
|---|---|
| Verdict | `ALLOW` `ASK` `BLOCK` (severity rises in that order) |
| CaseStatus | `received` → `extracting` → `checking` → `awaiting_call` / `awaiting_approval` / `paying` → final: `paid`, `blocked`, `rejected`, `failed` |
| CaseKind | `vendor_payment` `reimbursement` |
| DocKind | `invoice` `receipt` `email` `credit_note` `unknown` |
| PartyKind | `vendor` `employee` |
| Seat | `intake` `verification` `caller` `payments` `controller` `human` `system`. The `call_placed` and `call_result` actions use `caller` |
| CheckKind | `extraction_confidence` `required_fields` `doc_type` `parser_crosscheck` `payee_known` `bank_match` `contact_match` `crs_identity` `crs_fraud_score` `crs_reverse_phone` `duplicate` `injection` `amount_cap` `daily_cap` `split_purchase` `receipt_rules` `call_outcome` `kill_switch` |
| CheckResult | `pass` `fail` `warn` `skipped` |
| CallOutcome | `confirmed_change` `denied_change` `unclear` `no_answer` |
| ApprovalRole | `owner` `accountant` |
| ActionKind | `case_created` `extracted` `check_ran` `crs_called` `gate_decided` `call_placed` `call_result` `approval_requested` `approval_given` `approval_denied` `payment_started` `payment_succeeded` `payment_failed` `payment_retried` `explanation_written` `kill_switch_changed` `policy_version_created` `question_answered` |

## 3. Tables
Convex adds `_id` and `_creationTime` itself.

**orgs** (one row per business; "org" is just the tenant label)

| Field | Type | Notes |
|---|---|---|
| name | string | e.g. "Bluefin Print & Design (SYNTHETIC)" |
| killSwitch | boolean | |
| activePolicyVersionId | Id<"policyVersions"> or null | null only between inserting the org and its first policy version |
| isEval | boolean | each eval run gets a fresh org, so caps and duplicates don't leak between runs |
| nessieAccountId | string | the business's checking account |

**policyVersions**

| Field | Type | Notes |
|---|---|---|
| orgId | Id<"orgs"> | |
| version | number | |
| rules | object | shape in `docs/policy-rules.md` |
| source | string | `policy-doc:<url>`, `manual` or `droid` |
| createdBy | string | |
| approvedBy / approvedAt | string / number, or null | |
| diffSummary | string or null | |
| testsPassed | boolean or null | |

**parties**

| Field | Type | Notes |
|---|---|---|
| orgId | Id<"orgs"> | |
| key | string | stable seed key, e.g. `lanternfish` |
| kind | PartyKind | |
| displayName / legalName | string | vendors are sole proprietors; legalName is the person |
| email / emailDomain | string | |
| phoneOnFile | string | shown in the UI, masked |
| callTargetPhone | string or null | the real phone of the teammate playing this vendor. **Only `calls.place` reads it. Never sent to CRS.** |
| bankOnFile | `{ routingLast4, accountLast4, fingerprint }` or null | fingerprint = sha256(routing + account) |
| crsPersonaId | string or null | an allowlisted persona (e.g. `P19`) or null |
| crsStatus | `unverified` `passed` `failed` | |
| nessieAccountId | string or null | payee account |
| firstPaidAt | number or null | seed sets this for on-file parties |

**documents**

| Field | Type | Notes |
|---|---|---|
| orgId, storageId, fileName, mimeType, sha256 | | |
| kind | DocKind | |
| source | `upload` `console` `eval` | |
| extracted | Extraction or null | see §5 |
| parserFields | `{ totalCents, routingNumber, accountNumber, invoiceNumber }` or null | deterministic re-read of the PDF text layer; null for photos |
| injectionFindings | `{ text, where }[]` | |

**cases**

| Field | Type | Notes |
|---|---|---|
| orgId, documentId | | |
| kind | CaseKind | |
| partyId | Id<"parties"> or null | the vendor for invoices; the submitting employee for reimbursements |
| amountCents | number or null | |
| currency | string | |
| invoiceNumber | string or null | |
| status | CaseStatus | |
| verdict | Verdict or null | |
| reasons | string[] | plain English, shown in the UI |
| ruleIds | string[] | |
| requiredApprovals | ApprovalRole[] | |
| explanation | string or null | written by Claude after each decision; read by Ask Quintet |
| evalCaseId | string or null | |
| faultInjection | boolean | demo toggle: fail once after Nessie succeeds |
| simulatedCallOutcome | CallOutcome or null | eval runs only; live demos use the real call |

**checks**: `caseId`, `kind` (CheckKind), `result` (CheckResult), `detail` (string), `evidence` (object or null), `seat` (Seat).

**actions** (append-only audit log): `orgId`, `caseId` (or null), `seat`, `kind` (ActionKind), `summary` (string), `data` (object or null), `ruleIds` (string[] or null).

**approvals**: `caseId`, `role` (ApprovalRole), `status` (`pending` `approved` `denied`), `decidedBy`, `typedAmountCents`, `decidedAt`. The last three may be null.

**payments**

| Field | Type | Notes |
|---|---|---|
| caseId | Id<"cases"> | |
| idempotencyKey | string | sha256(caseId + partyId + amountCents). Look it up before inserting; unique |
| amountCents | number | |
| payeeNessieAccountId | string | |
| tag | string | `QT-<first 12 chars of key>`, written into the Nessie description |
| nessieTransferId | string or null | |
| status | `pending` `succeeded` `failed` | |
| attempts | number | |
| lastError | string or null | |
| succeededAt | number or null | when Nessie confirmed; feeds the daily cap (R5) and split-purchase window (R9) |

**calls**: `caseId`, `partyId`, `toNumber` (copied from callTargetPhone), `cartesiaCallId`, `status` (`queued` `in_progress` `completed` `failed`), `outcome` (CallOutcome or null), `transcript` (`{ speaker, text }[]`), `startedAt`, `endedAt`.

**evalRuns**: `orgId` (the eval org), `policyVersionId`, `startedAt`, `finishedAt`.
- `results`: `{ evalCaseId, caseId, expected: Verdict[], actual, paid, ms, costUsd, pass, note }[]`
- `summary`: `{ attacksStopped, attacksTotal, legitAuto, legitTotal, wrongfulHolds, askRate, medianMs, costPerCaseUsd }`

**Indexes:**
- `cases`: by_org_status, by_document.
- `checks`, `actions`, `approvals`, `payments`, `calls`: by_case.
- `actions`: by_org.
- `payments`: by_idempotencyKey.
- `policyVersions`: by_org.
- `parties`: by_org_kind, by_org_key.
- `documents`: by_sha256.

## 4. Gate (Diego): `convex/lib/gate.ts`
Pure TypeScript: no Convex imports, no I/O, no `Date.now()` (callers pass times in).

- `evaluate(rules: PolicyRules, input: GateInput): Decision`
- `isTighterOrEqual(oldRules, newRules): { ok: boolean; loosened: string[] }`

**GateInput**

| Field | Type |
|---|---|
| killSwitch | boolean |
| caseKind | CaseKind |
| docKind | DocKind |
| amountCents | number or null |
| currency | string |
| extractionConfidence | number (0–1) |
| missingRequiredFields | string[] |
| parserAgrees | boolean or null (null = no text layer) |
| payee | `{ known: boolean; firstPayment: boolean }` |
| crs | `{ identity: "pass" \| "fail" \| "skipped" \| "not_needed"; fraudScore: number \| null; fraudAlert: boolean; reversePhone: "match" \| "mismatch" \| "skipped" }` |
| changed | `{ bank: boolean; phone: boolean; emailDomain: boolean }` |
| duplicate | `{ invoice: boolean; receipt: boolean }` |
| injectionFound | boolean |
| receipt | `{ itemized: boolean \| null; disallowedItems: string[]; ageDays: number \| null }` or null |
| outflow | `{ paidTodayCents: number; samePayeeLast7DaysCents: number }` |
| call | `{ outcome: CallOutcome \| null }` |
| modelRecommendation | `"NONE"` `"ASK"` `"BLOCK"` |

**Decision**

| Field | Type | Notes |
|---|---|---|
| verdict | Verdict | |
| reasons | string[] | one plain-English line per triggered rule |
| ruleIds | string[] | e.g. `["R2","R3","R7"]` |
| requiredApprovals | ApprovalRole[] | empty unless the verdict is ASK |
| needsCall | boolean | R2 triggered and there's no call outcome yet |
| final | boolean | nothing can change the verdict (e.g. `denied_change`, CRS identity fail) |

**Semantics:**
- Start at ALLOW. Each triggered rule can only raise severity, never lower it.
- R0 raises to ASK whenever any ALLOW precondition fails.
- The kill switch always means BLOCK.

## 5. Extraction schema
Diego writes it in `convex/lib/schemas.ts`; Josiah's `intake.extract` uses it.

| Field | Type |
|---|---|
| docKind | DocKind |
| vendorOrMerchantName | string or null |
| contactEmail / contactPhone | string or null |
| invoiceNumber | string or null |
| issueDate / dueDate | `YYYY-MM-DD` or null |
| currency | string |
| totalCents | number or null |
| lineItems | `{ description, amountCents, category }[]`. Categories: `goods` `services` `food` `alcohol` `gift_card` `tobacco` `other` |
| payTo | `{ name, routingNumber, accountNumber }` or null |
| itemized | boolean or null (receipts only) |
| suspiciousInstructions | string[]: any text addressed to an AI, assistant or system |
| confidence | number (0–1) |
| missingFields | string[] |

## 6. Document factory (Diego): `convex/factory.ts`
`factory.render(spec) → { storageId }` (action)

| Spec field | Values |
|---|---|
| template | `invoice_a` `invoice_b` `invoice_c` `receipt` `credit_note`, or `email_with_invoice` (one 2-page PDF: the email on page 1, invoice_a on page 2; used for E13 and DEMO-1) |
| payee | a seed party key (e.g. `lanternfish`), or `{ newPayee: { displayName, legalName, email, phone, personaId } }` |
| invoiceNumber, amountCents, lineItems, issueDate, currency | defaults are fine |
| bank | `on_file`, or `changed` (uses the persona's fake account; routing starts with 99) |
| callbackPhone | `on_file`, or `persona:P12`, etc. |
| hiddenText | string or null (white 1-pt text) |

Every page carries the footer: **SYNTHETIC TEST DOCUMENT · Quintet demo**.

Kai's console calls `factory.render`, then `documents.ingest({ storageId, source: "console" })`.

## 7. Functions by owner
Convex names each function after its file. `cases.list` lives in `convex/cases.ts`; `audit.forCase` lives in `convex/audit.ts`; and so on.

An action that needs a Node-only package moves to an actions-only `<module>Node.ts` file (e.g. `intakeNode.extract`), owned by the same person. Update the name here when that happens.

| Function | Kind | Owner | Used by |
|---|---|---|---|
| `documents.generateUploadUrl` | mutation | Josiah | Kai (uploads, receipt photos) |
| `documents.ingest({ storageId, source, fileName, mimeType, kind?, evalCaseId?, submittedByPartyKey? }) → caseId` (`submittedByPartyKey` is required for reimbursements: the employee being reimbursed) | mutation | Josiah | Kai, evals |
| `intakeNode.extract` (Node: unpdf needs it), `verify.run`, `gateRun.decide`, `explain.write`, `payments.execute`, `calls.place` | internal | Josiah | the pipeline |
| `documents.ingestForOrg({ orgId, simulatedCallOutcome, ...ingest args })` | internal mutation | Josiah | evals |
| `calls.recordOutcome` | internal mutation | Josiah | `http.ts` |
| `POST /cartesia/outcome` | HTTP action (shared-secret check) | Josiah | Cartesia agent webhook tool |
| `approvals.decide({ approvalId, decision, typedAmountCents, decidedBy })` | mutation | Josiah | Kai |
| `orgs.setKillSwitch({ on })`, `cases.setFaultInjection({ caseId, on })` | mutation | Josiah | Kai |
| Queries: `cases.list({ status? })`, `cases.get({ caseId })`, `audit.forCase`, `audit.recent`, `calls.forCase`, `approvals.pending`, `evals.latest`, `policy.current`, `policy.versions` | query | Josiah | Kai |
| `evals.run()` | action | Josiah | Kai (scorecard button) |
| `factory.render(spec)` | action | Diego | Kai, evals |
| `evaluate`, `isTighterOrEqual` (in `lib/gate`) | pure functions | Diego | gateRun, tests, Droid |
| `ask.answer({ caseId?, question?, audioStorageId? }) → { text, audioUrl }` | action | Kai | Kai's UI |

## 8. Delivery deadlines (stub until then)

| What | Owner | By |
|---|---|---|
| Repo with the kit as its first commit | Josiah | Fri 6:15 PM |
| Gate stub (always ASK, reason "stub") | Diego | Fri 7:00 PM |
| `schema.ts` + seed | Josiah | Fri 7:30 PM |
| Intake prompt + extraction schema | Diego | Fri 8:00 PM |
| Queries for the UI | Josiah | Fri 9:00 PM |
| Gate rules R0–R6 | Diego | Fri 10:00 PM |
| Verification + explanation prompts; gate R7–R10 | Diego | Sat 12:00 AM |
| Approvals + kill-switch mutations | Josiah | Sat 12:00 AM |
| `factory.render` v1 | Diego | Sat 7:00 AM |
| Verification call working | Josiah | Sat 9:00 AM |
| 25 fixtures | Diego | Sat 12:00 PM |
| Eval runner | Josiah | Sat 1:00 PM |
| Prod deploy | Josiah | Sat 9:00 PM |

## 9. Environment variables
Set each with `npx convex env set NAME value` on the deployment that needs it. Names only go in `.env.example`; values go in the password manager.

| Variable | Where | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | every deployment | |
| `NESSIE_API_KEY` | every deployment | |
| `CRS_USERNAME`, `CRS_PASSWORD` | **integration deployment only** | Unset → the CRS client returns `skipped`. Never retry failed logins |
| `CARTESIA_API_KEY` | integration deployment; Kai's dev too, for TTS/STT | |
| `CARTESIA_AGENT_ID`, `CARTESIA_FROM_NUMBER_ID`, `CARTESIA_WEBHOOK_SECRET` | integration deployment only | Re-point the agent's webhook URL to prod at the prod deploy |
| `DEMO_VENDOR_PHONE` | integration deployment only | Josiah's phone. `seed.ts` reads it into `callTargetPhone`. Never hardcoded, never committed |
| `FACTORY_API_KEY` | Diego's laptop (stretch worker) | |
| `APIFY_TOKEN` | integration deployment (stretch) | |
| `NEXT_PUBLIC_CONVEX_URL` | frontend `.env.local` / Vercel | Point it at the integration deployment to test the call or CRS |
