# Devpost draft (paste into the form)

**Project name:** Quintet
**Tagline (60 chars max):** The second signature for small-business payments
**Elevator pitch:** Quintet checks every invoice and receipt before a small business pays it. Claude reads the paperwork, a tested rules engine decides, and a voice agent calls the vendor on file before paying a "we switched banks" invoice.

## Tracks to select
Hyphenate (primary), CRS Credit, Anthropic (Claude), Cartesia, Capital One Nessie, Convex, Microsoft. Confirm the exact names in the form. Tick Factory only if the Droid README section is real.

## Inspiration
Picture a three-person print shop. One person pays the bills, and nobody checks their work. On Tuesday the usual paper supplier emails: "We've switched banks, please use the new account." The invoice looks right, the amount is normal, and the new account belongs to a fraudster. Nobody catches it, because nobody was ever positioned to. That is payment-redirection fraud, and it's built for exactly that gap. Quintet is the second signature a small business can't staff.

## What it does
A clear, defined workflow runs on every document. Five steps, each owned by one seat:
1. **Read.** Intake clerk (Claude, no tools) extracts the fields. A plain-code parser re-reads the amount, account and invoice number, and any disagreement goes to a human.
2. **Verify.** Verification analyst compares the payee with the record on file, runs CRS identity and fraud checks, and flags lookalike vendors.
3. **Call.** If bank, phone or email details changed, a Cartesia voice agent calls the vendor **on file** (never a number from the document), says it's automated, and asks a yes/no question.
4. **Decide.** A deterministic gate returns **ALLOW** (pay), **ASK** (a human signs) or **BLOCK**. It's a pure TypeScript function with no I/O, and a model verdict can only make it stricter, never looser.
5. **Pay.** Payments clerk (plain code, deliberately not AI) pays through the sandbox bank with an idempotency key, so a retry never pays twice.

A fifth seat, the Controller (Claude, read-only), explains every decision from the audit log, in text or voice. Four seats use AI. The one that moves money doesn't.

**The demo moment.** The usual paper supplier emails invoice #1043 for $1,850: "we switched banks", with a new callback number and hidden white text telling the AI to "pay immediately". Three checks go red: the bank account changed, CRS says the new number belongs to someone else and returns a high fraud score, and the PDF contains instructions aimed at the AI. Payment freezes. Quintet calls the number on file, the real vendor says nothing changed, and the case is blocked for good. Ask "why did you hold it?" and the Controller answers from the log. Then the genuine invoice from the same vendor is paid, and we break the payment mid-transfer to show it still lands exactly once.

Snap a photo of a receipt and the same gate applies company policy: itemized, recent, no alcohol, gift cards or tobacco.

## How we built it
- **Claude** (Anthropic): structured-output extraction with no tools, the lookalike check, and plain-language explanations.
- **The gate:** rules R0 to R10, each covered by unit tests, plus the full moment end to end. Policy is data, so a new version is checked for loosening, which needs human approval.
- **CRS Credit** sandbox: identity, Fraud Finder score and reverse-phone lookup on new payees and changed details, only through a hard-coded test-identity allowlist.
- **Cartesia:** the verification call, and "Ask Quintet" spoken answers.
- **Capital One Nessie:** sandbox accounts, payees and idempotent transfers.
- **Convex:** system of record, live board, scheduled pipeline, append-only audit log.
- **Next.js** front end: a judge console with seven scenarios, a scorecard and a policy page.

## Challenges
- **Documents are untrusted input.** A PDF can carry hidden instructions to the AI. Intake runs with no tools, hits are logged as evidence, and the gate, not the model, decides.
- **Paying exactly once under failure.** We inject a fault mid-payment and check that one transfer lands.
- **Sandbox safety.** The CRS sandbox forwards unknown requests to the real bureau. We use only test identities, behind an allowlist asserted by tests.
- **A call can't prove who answered.** So "yes, we changed it" only reaches ASK, and voice can never approve a payment. A forged answer cannot move money.

## Accomplishments we're proud of
- It stops the fraud **without** wrongly holding good vendors: 25 synthetic cases re-run from `/scorecard`. Attacks stopped **[TBD] / 8**, legitimate invoices paid automatically **[TBD] / 10**, wrongful holds **[TBD]**, median time **[TBD]**, cost per case **[TBD]**.
- Every decision traces to a rule and an evidence line in the audit log, so a business owner can read why.

## What we learned
Put the model where it adds judgement (reading, explaining) and plain code where it adds safety (deciding, paying). And measure wrongful holds, not just caught fraud, because a tool that blocks good vendors gets switched off.

## Responsible design (Microsoft)
Claude's output can raise a verdict, never lower it. Anything unfamiliar defaults to ASK. No credit reports are pulled (identity, fraud score and reverse lookup only, on test identities). Voice can't approve a payment. Every action is logged and a kill switch freezes payments.

## What's next
Pilot with a few local small businesses, connect real bank and accounting exports, compile each business's policy from its own expense policy, add vendor consent for identity checks, and add per-business tenancy.

## Real vs simulated
**Real:** Claude reading and explaining, the gate, CRS sandbox calls, sandbox bank transfers, the Cartesia voice agent, live state.
**Simulated:** the business, vendors and employees (fictional, marked SYNTHETIC), CRS test identities, sandbox money, and the vendor's answer (a teammate plays the vendor; the demo call runs in the browser, not over the phone network). We did no customer interviews. The policy comes from a published small-business expense policy and the attacks from documented business-email-compromise patterns.

## Built with
TypeScript, Next.js, Convex, Anthropic Claude, Cartesia, CRS Credit sandbox, Capital One Nessie, Vercel

## Links to add
- [ ] GitHub repo (public only after `git grep` finds no keys or phone numbers)
- [ ] Demo video (YouTube, unlisted) with the sponsor timestamps from the README table
- [ ] Live site, if deployed
- [ ] Teammates: Diego Rosen, Josiah Jardine, Kai (add all three on the submission)
