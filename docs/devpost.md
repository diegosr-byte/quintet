# Devpost draft (paste into the form)

**Project name:** Quintet
**Tagline:** Five AI seats that check every invoice and receipt before a small business pays. Claude proposes. Code countersigns.

## Tracks to select
Hyphenate (primary), CRS Credit, Anthropic (Claude), Cartesia, Capital One Nessie, Convex, Microsoft. Confirm the exact track names in the form. Only tick Factory if the Droid README section is real.

## Inspiration
A small business usually has one person who pays the bills, and nobody checks their work. Payment-redirection fraud ("we've switched banks, please use the new account") is built for exactly that gap: one convincing email, one changed account number, and the money is gone. Quintet is the second signature.

## What it does
Quintet reads every invoice, bank change and receipt before money moves, and it can only be made stricter by the AI, never looser.
1. **Read:** an intake clerk (Claude, no tools) extracts the fields, and a plain-code parser re-reads the amount, account and invoice number.
2. **Verify:** a verification analyst compares the payee with the record on file, runs CRS identity and fraud checks, and flags lookalike vendors.
3. **Call:** when bank, phone or email details changed, a Cartesia voice agent calls the vendor on file, says it is automated, and asks a yes/no question.
4. **Decide:** a deterministic gate returns ALLOW, ASK (a human signs) or BLOCK. It's a pure TypeScript function with no I/O.
5. **Pay:** a payments clerk (plain code, not AI) pays through the sandbox bank with an idempotency key, so a retry never pays twice.

The demo moment: the usual paper supplier emails invoice #1043 for $1,850, "we switched banks", with hidden white text telling the AI to "pay immediately". Quintet freezes the payment, calls the vendor on file, the vendor says nothing changed, and the case is blocked. Ask "why did you hold it?" and the Controller answers from the audit log. The genuine invoice from the same vendor is paid, and a forced failure mid-payment still results in exactly one payment.

## How we built it
- **Claude** reads documents with structured output and no tools, runs the lookalike check, and explains every decision.
- **A tested rules gate** (rules R0 to R10) decides. A model verdict can only raise severity. Policy is data, and loosening a policy needs human approval.
- **CRS Credit** sandbox: identity, Fraud Finder score and reverse-phone lookup on new payees and changed details, behind a hard-coded test-identity allowlist.
- **Cartesia** voice agent for the verification call and "Ask Quintet" spoken answers.
- **Capital One Nessie** sandbox bank for accounts, payees and idempotent transfers.
- **Convex** is the system of record, with the live board, the scheduled pipeline and an append-only audit log.
- Next.js front end with a judge console, a scorecard and a policy page.

## Challenges
- Making the AI unable to talk its way past the gate: documents can carry hidden instructions, so intake has no tools, and the gate, not the model, decides.
- Paying exactly once under failure: we inject a fault mid-payment and prove one transfer.
- Keeping the sandbox safe: CRS is reachable only through a test-identity allowlist, asserted by tests, because the sandbox can forward unknown requests to a real bureau.
- A web call cannot prove who answered, so "yes, we changed it" only reaches ASK; a forged answer cannot move money.

## Accomplishments
- 25 synthetic eval cases, re-runnable from `/scorecard`: attacks stopped **TBD / 8**, legitimate invoices paid automatically **TBD / 10**, wrongful holds **TBD**. <!-- fill from the integration run -->
- Voice cannot approve a payment, by design.

## What we learned
Put the model where it adds judgement (reading, explaining) and plain code where it adds safety (deciding, paying). Measure wrongful holds, not just caught fraud.

## What's next
Pilot with a few local small businesses, connect real bank and accounting exports, build each business's policy from its own expense policy, add consent at vendor onboarding, and add per-business tenancy.

## Real vs simulated (say this plainly)
**Real:** Claude reading and explaining, the gate, CRS sandbox calls, sandbox bank transfers, the Cartesia voice call, live state.
**Simulated:** the business, vendors and employees (fictional, marked SYNTHETIC), CRS test identities, sandbox money, and the vendor's answer (a teammate plays the vendor; the demo call runs in the browser, not over the phone network). No customer interviews were done.

## Built with
TypeScript, Next.js, Convex, Anthropic Claude, Cartesia, CRS Credit sandbox, Capital One Nessie, Vercel

## Links to add
- [ ] GitHub repo (public only after `git grep` finds no keys or phone numbers)
- [ ] Demo video (YouTube, unlisted), with the sponsor timestamps from the README table
- [ ] Live site, if deployed
- [ ] Teammates: Diego Rosen, Josiah Jardine, Kai (add all three on the submission)
