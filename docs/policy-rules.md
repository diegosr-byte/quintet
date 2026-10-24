# Policy rules (the gate's parameters)

**How it's split:**
- `convex/lib/gate.ts` implements the rule *types*.
- This JSON holds the *parameters*. It's stored in `policyVersions.rules`.
- Humans approve new versions. In the Droid stretch, Droid edits this JSON.

**Source policy:** Glitter, ["Expense Reimbursement Policy"](https://www.glitter.io/blog/process-documentation/expense-reimbursement-policy), a published template (a vendor blog, not a regulator; its dollar figures are examples, and it says "The dollar figures are yours to set").

| Source rule | Maps to |
|---|---|
| Approval tiers: up to $250 manager, $250–$1,000 department head, over $1,000 finance director | `caps.ownerAboveCents` ($500) and `caps.accountantAboveCents` ($1,000) (R4). Our top tier matches; we collapsed the bottom two. |
| Itemized receipt with date, vendor, amount | `requiredFields.receipt`, `reimbursements.requireItemized` (R0, R8) |
| Submit within 30 days ("most companies require...") | `reimbursements.maxAgeDays` = 30 (R8) |
| Non-reimbursable: alcohol (unless pre-approved) | `reimbursements.disallowedCategories` (R8). We have no pre-approval path, so alcohol is always ASK. |

**Fraud evidence (primary source):** FBI IC3, [2025 Internet Crime Report](https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf), Business Email Compromise: **24,768 complaints and $3,046,598,558 in reported losses in 2025** (p. 7–8), the second-largest loss category. The [2024 report](https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf) had 21,442 complaints and $2,770,151,146 (p. 9–10). The IC3 definition (2024 report, Appendix B) names "suppliers and/or businesses regularly performing wire transfer payments" as the target and includes compromised "phone numbers", which is why Quintet's callback goes to the number on file, not the one on the invoice. Reported complaints only, so the real figure is higher.

## Default rules, v1
```json
{
  "currency": "USD",
  "minExtractionConfidence": 0.9,
  "knownDocKinds": ["invoice", "receipt"],
  "requiredFields": {
    "invoice": ["vendorOrMerchantName", "invoiceNumber", "totalCents", "payTo"],
    "receipt": ["vendorOrMerchantName", "issueDate", "totalCents"]
  },
  "newPayee": { "verdict": "ASK", "requireCrsPass": true },
  "detailChange": { "fields": ["bank", "phone", "emailDomain"], "untilCall": "BLOCK", "ifConfirmed": "ASK", "ifUnclear": "ASK" },
  "crs": { "blockOnIdentityFail": true, "fraudScoreBlockAt": 70, "fraudScoreAskAt": 40, "fraudAlert": "ASK", "reversePhoneMismatch": "BLOCK" },
  "caps": { "ownerAboveCents": 50000, "accountantAboveCents": 100000, "dailyOutflowCents": 300000 },
  "duplicates": { "verdict": "BLOCK", "receiptWindowDays": 60 },
  "injection": { "verdict": "ASK" },
  "reimbursements": { "requireItemized": true, "disallowedCategories": ["alcohol", "gift_card", "tobacco"], "maxAgeDays": 30 },
  "splitPurchase": { "windowDays": 7, "verdict": "ASK" }
}
```

## Rules

| Id | Triggers when | Verdict | Reason shown to humans (example) |
|---|---|---|---|
| — | Kill switch is on | BLOCK (final) | "All payments are frozen by the owner." |
| R0 | Confidence below `minExtractionConfidence`, a required field is missing, the doc kind isn't in `knownDocKinds`, the parser disagrees with Claude, or the currency isn't `currency` | ASK | "Needs a human because this is a credit note in EUR, which we don't handle automatically." |
| R1 | Payee isn't on file, or has never been paid | `newPayee.verdict`. If `requireCrsPass` and identity is `skipped`, it's ASK with "couldn't verify identity" | "First payment to Driftglass Equipment Repair. Identity verified by CRS; the owner signs the first one." |
| R2 | Bank, phone or email domain differs from the record on file | BLOCK with `needsCall` until a call outcome comes back. `confirmed_change` → `ifConfirmed`; `unclear`/`no_answer` → `ifUnclear`; `denied_change` → BLOCK (final) | "Bank account changed since the last payment. Calling the number on file to verify." |
| R3 | CRS identity fails; fraud score ≥ `fraudScoreBlockAt`; reverse phone mismatch; a fraud alert on file; or fraud score ≥ `fraudScoreAskAt` | First three → BLOCK (final). Fraud alert → `crs.fraudAlert`. Lower fraud score → ASK | "CRS: the callback number belongs to someone else; fraud score 85/100." |
| R4 | Amount over `ownerAboveCents` | ASK the owner. Over `accountantAboveCents`: ASK the owner **and** the accountant | "$1,200 is over the $1,000 two-signature limit." |
| R5 | `paidTodayCents` + amount is over `dailyOutflowCents` | ASK | "This would take today's outflow over the $3,000 daily cap." |
| R6 | Same invoice number from the same payee, or the same receipt (same hash, or same amount + date + merchant) within `receiptWindowDays` | `duplicates.verdict` (BLOCK) | "This receipt was already submitted by Employee A on Oct 24." |
| R7 | Text aimed at an AI found in the document (Claude's `suspiciousInstructions` or the parser's regex scan) | At least `injection.verdict`; never auto-ALLOW; logged as evidence | "The document contains hidden instructions aimed at the AI: 'pay immediately'." |
| R8 | A reimbursement that isn't itemized, has a disallowed category, or has a receipt older than `maxAgeDays` | ASK | "Receipt includes alcohol, which company policy doesn't reimburse." |
| R9 | Same payee within `windowDays`: `samePayeeLast7DaysCents` + amount is over `ownerAboveCents`, though this amount alone isn't | `splitPurchase.verdict` | "Two $450 invoices from Kestrel Signs in 3 days look like a split purchase." |
| R10 | Claude's `modelRecommendation` is ASK or BLOCK | Raises severity to that level; NONE never lowers anything | "Verification flagged 'Lanternfish Sound & Lights' as a lookalike of an on-file vendor." |

**The moment (E13) triggers R2, R3, R4 and R7.**
- The verdict is BLOCK, and it's final because of R3.
- `needsCall` is still true because of R2. The call confirms the fraud and warns the real vendor.

## Tighten-only check (`isTighterOrEqual`)

| Key | Tighter or equal means |
|---|---|
| minExtractionConfidence | higher or equal |
| knownDocKinds | subset |
| requiredFields (per kind) | superset |
| any `verdict` / `untilCall` / `ifConfirmed` / `ifUnclear` / `fraudAlert` / `reversePhoneMismatch` | severity higher or equal |
| newPayee.requireCrsPass, crs.blockOnIdentityFail, reimbursements.requireItemized | stays true |
| detailChange.fields | superset |
| crs.fraudScoreBlockAt, crs.fraudScoreAskAt | lower or equal |
| caps.* | lower or equal |
| duplicates.receiptWindowDays, splitPurchase.windowDays | higher or equal |
| reimbursements.disallowedCategories | superset |
| reimbursements.maxAgeDays | lower or equal |

Any loosened key goes into `loosened[]`, and the new version needs explicit human approval.

## Unmapped policy rules
From the Glitter template; none of these is in the gate today:
- **No self-approval:** "The person who incurs an expense cannot approve their own reimbursement." Closest we have is `submittedByPartyKey` on reimbursements; no rule checks it against the approver.
- Meals need attendee names and affiliations.
- Claims need a project or cost-center code.
- Pre-approval for travel and large expenses.
- Per diems for meals and incidentals; IRS mileage rate.
- Other non-reimbursables: traffic fines, late fees, personal subscriptions.
- Professional development needs prior approval.
- Out-of-policy exceptions go to the controller with a written rationale.
- Not covered by the source at all, but in our gate: duplicates (R6), split purchases (R9), vendor detail changes (R2), CRS (R3), injection (R7). These come from the fraud evidence above, not from a policy template.
