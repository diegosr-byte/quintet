# Quintet

**Five AI seats that watch every dollar a small business pays out.** Claude reads the paperwork. A tested rules engine decides. Quintet calls the vendor on file before it pays a "we changed banks" invoice.

Built at Cal Hacks 13.0. Everything here is synthetic: a fictional business, fictional vendors, sandbox money and test identities.

## The problem
A small business usually has one person who pays the bills: the owner or an office manager. Nobody checks their work. Payment-redirection fraud ("we've switched banks, please use the new account") is built for exactly that gap: one convincing email, one changed account number, and the money is gone.

Quintet is the second signature. It checks every invoice, bank change and receipt **before** money moves, and it can only be made stricter by the AI, never looser.

**One real owner, interviewed at the event.** We asked Alex Marianetti, who owns Lockhunt, a two-person locksmith company (he agreed to be named and filmed), and who gets "5 or 6 invoices every day", how he pays bills, before showing him anything:
- Who checks his work? "I pay my bills, and honestly, I don't have anyone double-checking my work."
- Has a vendor changed bank details on him? "Yes, and I didn't realize till later, which actually caused me some issues."
- Receipts and reimbursements are "all done manually, in spreadsheets."

Then he tried the "we switched banks" invoice. His reaction: "Software that can streamline something like that is just incredibly useful, especially for a locksmith business." He said the call to the vendor on file was fair ("I think that would actually be useful"), and that he'd pay for it ("I would probably pay over 1,000 a month"). That is one person's stated willingness, not a commitment, and we don't treat it as demand validation. His main objection is ours too: getting his existing invoices and spreadsheets in. Quintet takes photos and PDFs today, and a bank or accounting-software connection is the first item under "Path to production".

## The five seats
| Seat | Does | Cannot |
|---|---|---|
| **Intake clerk** (Claude, no tools) | Reads an invoice, receipt or email and extracts the fields. A plain-code parser re-reads the amount, account and invoice number. | Call tools, see the policy, or touch money |
| **Verification analyst** (code + CRS + Claude) | Compares the payee with the record on file, checks duplicates, runs CRS identity and fraud checks, and asks Claude whether the payee looks like a lookalike of a known vendor | Approve anything (it can only recommend ASK or BLOCK) |
| **Caller** (Cartesia voice agent) | When bank, phone or email details changed, calls the vendor **on file** (never a number from a document), says it is automated, and asks a yes/no question | Dial a number from a document, read out account numbers, ask for personal data, approve or pay |
| **Payments clerk** (plain code, not AI) | Pays through the sandbox bank only what the rules allowed or a human approved, with an idempotency key | Pay without a gate decision |
| **Controller** (Claude, read-only) | Explains every decision from the audit log, in text or voice | Change records |

The **owner** (and, over $1,000, an **accountant**) are the human signers.

## The moment
1. The business's usual paper supplier emails invoice #1043 for $1,850: "we switched banks", with a new callback number and hidden white text telling the AI to "pay immediately".
2. Three checks go red: the bank account changed; CRS says the new number belongs to someone else and returns a high fraud score; the PDF contains instructions aimed at the AI.
3. The payment freezes. Quintet calls the vendor on file with a voice agent. The real vendor says nothing changed. The case is blocked for good.
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
   BLOCK -> Caller calls the vendor on file -> confirmed / denied -> gate re-runs
Controller explains every decision from the append-only audit log.
```

## Where each sponsor's technology lives
Try each one in the [live app](https://quintet.marketingmeteor.workers.dev). The demo video is linked from our Devpost entry.

| Sponsor | What it does in Quintet | See it in the app |
|---|---|---|
| **Hyphenate** | The five seats, each with scoped access, a work log and escalation; the moment; the live scenario console; the scorecard | `/console`, `/agents`, `/scorecard` |
| **CRS Credit** | Identity verification, Fraud Finder score and reverse-phone lookup on new payees and on any change of details, in the sandbox with test identities only, behind an allowlist (the sandbox forwards unknown requests to the real bureau, so none can reach it) | `/case` (checks list) |
| **Anthropic (Claude)** | Reads documents with structured output and no tools; lookalike check; plain-language explanations. See failure modes below | `/upload`, `/case` |
| **Cartesia** | The Caller seat calls the vendor on file (a live voice call in the browser); "Ask Quintet" speaks answers | `/case` (verification call), `/vendor` |
| **Capital One Nessie** | The business's bank: accounts, payees and idempotent transfers | `/case` (payment panel) |
| **Convex** | System of record, reactive live board, scheduled pipeline | `/board` (live) |
| **Microsoft** | See "Responsible design" and "Path to production" below | `/policy` |

## Proof it works
Measured on the deployed app, Sat Oct 24, 9:42 PM PT (25 of 25 cases passed).

25 synthetic cases with expected verdicts (`evals/fixtures/cases.ts`, re-runnable from `/scorecard`):

| Metric | Result |
|---|---|
| Attacks stopped before payment | 8 / 8 |
| Legitimate invoices paid automatically | 10 / 10 |
| Wrongful holds | 0 |
| Human asked (ASK rate) | 36% of all cases |
| Median time per case | 9.3 s |
| Cost per case | about 2 cents |

**Real:** Claude reading and explaining; the gate; CRS sandbox calls; sandbox bank transfers; the voice call with the Cartesia agent; live state.
**Simulated:** the vendor's answer (a teammate plays the vendor, and in the evals the outcome is scripted; the demo call runs in the browser, not over the phone network); the business, vendors and employees (fictional, marked SYNTHETIC); CRS test identities; money (sandbox). We did one informal interview (above), not a study; the policy rules come from a published small-business expense policy (cited in `docs/policy-rules.md`) and the attack scenarios from well-documented business-email-compromise fraud patterns.

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
