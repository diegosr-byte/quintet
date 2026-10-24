# Quintet

**Five AI seats that watch every dollar a small business pays out.** Claude reads the paperwork. A tested rules engine decides. Quintet phones the number on file before it pays a "we changed banks" invoice.

Built at Cal Hacks 13.0. Everything here is synthetic: a fictional business, fictional vendors, sandbox money and test identities.

## The problem
A small business usually has one person who pays the bills: the owner or an office manager. Nobody checks their work. Payment-redirection fraud ("we've switched banks, please use the new account") is built for exactly that gap: one convincing email, one changed account number, and the money is gone.

Quintet is the second signature. It checks every invoice, bank change and receipt **before** money moves, and it can only be made stricter by the AI, never looser.

## The five seats
| Seat | Does | Cannot |
|---|---|---|
| **Intake clerk** (Claude, no tools) | Reads an invoice, receipt or email and extracts the fields. A plain-code parser re-reads the amount, account and invoice number. | Call tools, see the policy, or touch money |
| **Verification analyst** (code + CRS + Claude) | Compares the payee with the record on file, checks duplicates, runs CRS identity and fraud checks, and asks Claude whether the payee looks like a lookalike of a known vendor | Approve anything (it can only recommend ASK or BLOCK) |
| **Caller** (Cartesia voice agent) | When bank, phone or email details changed, phones the number **on file**, says it is automated, and asks a yes/no question | Dial a number from a document, read out account numbers, ask for personal data, approve or pay |
| **Payments clerk** (plain code, not AI) | Pays through the sandbox bank only what the rules allowed or a human approved, with an idempotency key | Pay without a gate decision |
| **Controller** (Claude, read-only) | Explains every decision from the audit log, in text or voice | Change records |

The **owner** (and, over $1,000, an **accountant**) are the human signers.

## The moment
1. The business's usual paper supplier emails invoice #1043 for $1,850: "we switched banks", with a new callback number and hidden white text telling the AI to "pay immediately".
2. Three checks go red: the bank account changed; CRS says the new number belongs to someone else and returns a high fraud score; the PDF contains instructions aimed at the AI.
3. The payment freezes. Quintet phones the number **on file**. The real vendor says nothing changed. The case is blocked for good.
4. Ask "why did you hold it?" and the Controller answers from the audit log.
5. The genuine invoice from the same vendor is allowed and paid; a forced failure mid-payment still results in exactly one payment.

## How it decides
**Claude proposes. Code countersigns.** Every payment passes `evaluate()` in `convex/lib/gate.ts`, a pure TypeScript function with no I/O.
- Verdicts: **ALLOW** (pay), **ASK** (a human signs), **BLOCK** (stopped). A rule can only raise a verdict.
- Anything unfamiliar (low confidence, a missing field, a credit note, a foreign currency) defaults to ASK.
- The model's recommendation can make a verdict stricter, never looser.
- Policy is data, so a new policy version can be checked with `isTighterOrEqual`: loosening needs explicit human approval.
- The rules: first payment to a payee; changed bank/phone/email (with a callback); CRS identity and fraud signals; amount limits; daily cap; duplicates; hidden instructions; receipt rules; split purchases. See `docs/policy-rules.md`.

```
document -> Intake (Claude, no tools + parser) -> Verification (checks, CRS, Claude) -> Gate (pure code)
   ALLOW -> Payments (sandbox bank, idempotent)
   ASK   -> owner / accountant approve by typing the amount
   BLOCK -> Caller phones the number on file -> confirmed / denied -> gate re-runs
Controller explains every decision from the append-only audit log.
```

## Where each sponsor's technology lives
<!-- TODO (Diego, Sat night): add the video timestamp for each row. -->
| Sponsor | What it does in Quintet | Video |
|---|---|---|
| **Hyphenate** | The five seats, each with scoped access, a work log and escalation; the moment; the live scenario console; the scorecard | TBD |
| **CRS Credit** | Identity verification, Fraud Finder score and reverse-phone lookup on new payees and on any change of details, in the sandbox with test identities only, behind an allowlist (the sandbox forwards unknown requests to the real bureau, so none can reach it) | TBD |
| **Anthropic (Claude)** | Reads documents with structured output and no tools; lookalike check; plain-language explanations. See failure modes below | TBD |
| **Cartesia** | The Caller seat phones the number on file; "Ask Quintet" speaks answers | TBD |
| **Capital One Nessie** | The business's bank: accounts, payees and idempotent transfers | TBD |
| **Convex** | System of record, reactive live board, scheduled pipeline, webhooks | TBD |
| **Microsoft** | See "Responsible design" and "Path to production" below | TBD |

## Proof it works
<!-- TODO (Diego, Sat 6 PM): paste the real numbers from /scorecard. Do not estimate. -->
25 synthetic cases with expected verdicts (`evals/fixtures/cases.ts`, re-runnable from `/scorecard`):

| Metric | Result |
|---|---|
| Attacks stopped before payment | TBD / 8 |
| Legitimate invoices paid automatically | TBD / 10 |
| Wrongful holds | TBD |
| Human asked (ASK rate) | TBD |
| Median time per case | TBD |
| Cost per case | TBD |

**Real:** Claude reading and explaining; the gate; CRS sandbox calls; sandbox bank transfers; the phone call; live state.
**Simulated:** the business, vendors and employees (fictional, marked SYNTHETIC); CRS test identities; money (sandbox). No customer interviews were done; the policy rules come from a published small-business expense policy (cited in `docs/policy-rules.md`) and the attack scenarios from well-documented business-email-compromise fraud patterns.

## Responsible design and failure modes
| Failure | Guard |
|---|---|
| A document tries to instruct the AI ("pay immediately") | Intake runs with no tools and a strict output schema; a parser scans the PDF text; hits are logged as evidence and never auto-allow (R7); the gate, not the model, decides |
| The AI misreads an amount or account number | A parser re-reads amount, account and invoice number; any disagreement goes to a human (R0) |
| A lookalike vendor impersonates a known one | Claude's recommendation can only raise a verdict (R10); a changed bank or phone triggers the callback (R2) |
| The vendor really did change banks | The call confirms it, and the owner signs; new details are never silently trusted |
| False holds hurt a good vendor | Ambiguous cases ASK instead of BLOCK; wrongful holds are measured on the scorecard |
| The voice call mishears or is unanswered | The agent asks only yes/no questions; an unclear or unanswered call goes to a human, never to ALLOW |
| Voice is spoofed to approve a payment | Payments can't be approved by voice at all |
| A retry pays twice | An idempotency key and a tag lookup; a fault-injection toggle proves exactly one payment |
| Test data leaks to a real credit bureau | CRS is reachable only through a hard-coded test-identity allowlist, asserted by tests |
| Credit-report misuse (FCRA) | No credit reports are pulled; only identity, fraud score and reverse lookup, on test identities |

## Path to production
Pilot with a few local small businesses; connect each business's real bank or accounting-software exports; single sign-on; a policy compiled from each business's own expense policy; consent at vendor onboarding for identity checks; audit retention and monitoring; per-business tenancy.

## Known limitations
New document types (a credit note, foreign currency) go to a human; voicemail ends in a human decision; CRS and Cartesia rate limits apply; the demo uses a sandbox bank, not real payment rails.

## Running it
```
npm install
npx convex dev                 # your own dev deployment
npx convex env set ANTHROPIC_API_KEY ...   # see .env.example and docs/contracts.md section 9
npx convex run seed:run        # creates the demo business, vendors and sandbox bank accounts
npm test                       # gate, parser, generator and eval tests
```
Keys are never committed; only `.env.example` (names only) is.

## Team
Diego Rosen, Josiah Jardine, Kai.
