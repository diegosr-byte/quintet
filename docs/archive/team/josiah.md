# Josiah: pipes + money

**Mission:** every document flows from upload to a decision, then to a payment or a phone call, reliably. Nothing ever pays twice, and nothing ever leaks to a real credit bureau.

**Load:** about 20 h of core work. Stretch: the Apify crawl plus a published actor (2.5 h), only if checkpoint C passes.

## You own
- `convex/schema.ts`, `seed.ts`, `documents.ts`, `intake.ts`, `verify.ts`, `gateRun.ts`, `explain.ts`, `payments.ts`, `approvals.ts`, `orgs.ts`, `calls.ts`, `http.ts`, `cases.ts`, `audit.ts`, `policy.ts`, `evals.ts`.
- `convex/lib/{crs,nessie,cartesia,claude,parser}.ts`.
- `package.json` (you merge dependency adds) and prod deploys.
- Stretch: `convex/apify.ts`.

**Don't touch:**
- Diego's files: `convex/lib/gate*`, `policy*`, `schemas.ts`, `prompts/`, `factory.ts`.
- Kai's files: `app/`, `components/`, `convex/ask.ts`.

## What you hand off, and what you wait for

| You provide | To | By |
|---|---|---|
| Repo with the kit as its first commit | all | Fri 6:15 PM |
| `schema.ts` + seed | Kai, Diego | Fri 7:30 PM |
| Queries for the UI (contracts §7) | Kai | Fri 9:00 PM |
| Approvals + kill-switch mutations | Kai | Sat 12:00 AM |
| Verification call working | demo | Sat 9:00 AM |
| Eval runner | Diego, Kai | Sat 1:00 PM |
| Prod deploy | all | Sat 9:00 PM |

| You consume | From | By |
|---|---|---|
| Gate stub, then R0–R6 | Diego | 7:00 / 10:00 PM |
| Intake prompt + schema | Diego | Fri 8:00 PM |
| `factory.render` v1 | Diego | Sat 7:00 AM |
| 25 fixtures | Diego | Sat 12:00 PM |

## Tracks you're responsible for proving
- **CRS:** live checks and the allowlist guard.
- **Capital One Nessie:** payments and idempotency.
- **Convex:** the pipeline, scheduler and webhooks.
- **Cartesia:** the verification call.

You also write the README sections for these four.

## Before Friday 6 PM (no code)
- [ ] Get a Nessie key (log in with GitHub at nessieisreal.com) and put it in the password manager.
- [ ] Cartesia: create an account, get the Pro plan ($5) and a US Cartesia number. Ask the booth for credits on Friday.
- [ ] Read:
  - Convex: the Next.js quickstart, actions, scheduling, HTTP actions.
  - Cartesia: outbound dialing and agent webhook tools.
  - The CRS sandbox page.
  - The Nessie OpenAPI spec.
- [ ] Install Node 22+, the GitHub CLI and Claude Code (logged in). Use Convex through `npx convex`.
- [ ] You play the demo vendor. Your number goes only in the env var `DEMO_VENDOR_PHONE`, on the integration deployment; `seed.ts` reads it. Never hardcode it.

## Fri 6:00–6:45 PM
1. Create the GitHub repo (private until submission).
2. Scaffold it with `npm create convex@latest` (Next.js + Convex). In the same commit:
   - pre-install the known dependencies so nobody fights over `package-lock.json` later: `vitest`, `@anthropic-ai/sdk`, `pdf-lib`, `unpdf`, `@cartesia/cartesia-js`;
   - run shadcn init with its defaults;
   - commit `.env.example` with the variable names from contracts §9.
3. Copy everything inside the kit (`CLAUDE.md`, `.claude/`, `docs/`, `team/`) into the repo root.
4. Commit "kit", push, and invite Diego and Kai.
5. Contracts session with all three.

## Fri 6:45–10:00 PM
1. **Schema and seed (by 7:30).** Done when: Kai sees the seed cases on the dashboard.
   > Read CLAUDE.md, docs/contracts.md §3 and the seed table in docs/eval-cases.md. Write convex/schema.ts exactly per the contract, with its indexes. Then write convex/seed.ts:
   > - the business, and policy v1 from Diego's defaultRules;
   > - the parties, with firstPaidAt set for everyone on file;
   > - Nessie customers and accounts for the business and every payee, through convex/lib/nessie.ts against https://api.nessieisreal.com.
   >
   > Test one Nessie POST by hand first.
2. **Pipeline end to end (queries by 9:00).** Done when: an uploaded PDF becomes a case, moves through statuses live, and ALLOW produces a real Nessie transfer.
   > Load the claude-api skill. Build documents.ingest → intake.extract (Claude, Diego's prompt and schema, no tools, model claude-opus-5-5, effort medium) → verify.run (stub checks for now) → gateRun.decide (calls Diego's evaluate) → payments.execute (Nessie transfer, tagged). Chain the steps with ctx.scheduler.runAfter. Every step appends to actions. Add the queries from contracts §7.

**Checkpoint A (10 PM):** one invoice flows end to end, live.

## Fri 10:00 PM – 2:00 AM
1. **CRS client with the allowlist.**
   - `convex/lib/crs.ts` maps allowlisted persona IDs to the exact request bodies from `get_test_data`.
   - Any other input → `skipped`.
   - A unit test asserts that `callTargetPhone` and free text never reach a request.
   - Never retry a failed login.
2. **Checks:**
   - Bank, phone and email-domain diff against the record on file.
   - Duplicate invoices (party + invoice number) and receipts (sha256, or amount + date + merchant).
   - Parser cross-check: the PDF text layer gives amount, account, routing and invoice number.
   - Injection scan: regex on the text layer, merged with Claude's `suspiciousInstructions`.
   - Diego's verification prompt gives `modelRecommendation`.
3. **Approvals and explanations:**
   - Create approval rows for ASK (the owner, plus the accountant over $1,000).
   - `approvals.decide` requires `typedAmountCents` to equal the amount.
   - `orgs.setKillSwitch`.
   - `explain.write` runs after every decision.

**Checkpoint B (2 AM):** the moment works in text.

## Fri 3:00–7:00 AM: sleep

## Sat 7:00–9:00 AM: the verification call
- In Cartesia, configure the agent "Quintet Caller" (the Caller seat) with the prompt below. Log `call_placed` and `call_result` with seat `caller`.
  - Dynamic variables: `business`, `vendor`, `invoiceNumber`, `amount`.
  - Webhook tool `report_outcome(outcome)` → `https://<deployment>.convex.site/cartesia/outcome`, with a shared secret.
- `calls.place` sends `POST /agents/calls` with `agent_id`, `from_number_id`, `to_number` (the party's `callTargetPhone`) and `dynamic_variables`.
- `http.ts` checks the secret, then calls `calls.recordOutcome`, which re-runs the gate.
- **Done when:** your phone rings, you say "no", and the case flips to BLOCKED live on Kai's screen. For this check, Kai points `NEXT_PUBLIC_CONVEX_URL` at your deployment.

**Agent prompt draft:**
> You are Quintet, an automated finance assistant calling for {{business}}. Say: "Hi, this is Quintet, an automated assistant calling for {{business}}. Am I speaking with {{vendor}}?" Then: "We received invoice {{invoiceNumber}} for {{amount}} asking us to send payment to a new bank account. Did your business recently change its bank details?"
> - Never read out account numbers. Never ask for personal information.
> - If no: thank them, say we won't send payment to the new account and will flag the invoice, and call report_outcome with denied_change.
> - If yes: thank them, say a team member will confirm before paying, and call report_outcome with confirmed_change.
> - If unsure, or you reach voicemail: call report_outcome with unclear or no_answer.
> - Keep the call under 60 seconds.

## Sat 9:00 AM – 1:00 PM
1. **`evals.run`:**
   - Creates a fresh eval org (`isEval`) for each run.
   - Ingests fixtures in order (E01–E12, then E13–E25), at most 6 at once.
   - Uses the `simulatedCallOutcome` values.
   - Writes `evalRuns` with the summary.
2. **Reimbursement path:** employees as payees; receipt checks feed R8.
3. **Fault injection:**
   - When `cases.faultInjection` is on, throw after Nessie succeeds on attempt 1.
   - The retry finds the transfer by its tag, so no second transfer.

**Checkpoint C (1 PM):** the moment with the call; the console; the eval runs.

## Sat 1:00–6:00 PM
- **If C passed:** the Apify stretch. Crawl a few public small-business expense-policy templates with Website Content Crawler (`.start()` + poll, `maxCrawlPages` ≤ 20), and hand the text to Diego's compiler. Publish "Small-Business Expense Policy Extractor" for Best Actor.
- **Otherwise:** hardening (retries, rate limits, error states).

## Sat 6:00–11:00 PM
1. **Prod deploy:**
   - `npx convex deploy`, then `npx convex env set` for every variable on prod, then the Vercel environment variables.
   - **Re-point the Cartesia agent's webhook to prod.** From here on, prod is the integration deployment.
2. **Replay mode:** re-plays a recorded case's actions with their timing, with no external calls. This is our wifi fallback.
3. **README sections** for CRS, Nessie, the Cartesia call and Convex.

## Sat 11:00 PM – 5:00 AM
Fixes, then sleep at least 3 h.

## Sun 5:00–8:30 AM
Smoke-test prod three times: DEMO-1 with the real call, DEMO-2 with fault injection, and a console PDF.

## Sun 9:00 AM – 12:30 PM
At the table: you play the vendor and answer backend questions.

## If you're behind
**Cut in this order:**
1. Apify.
2. Replay mode (the recorded video becomes the fallback).
3. The reimbursement path.
4. The parser cross-check.

**Never cut:** the CRS allowlist guard, idempotency, and the call (or Kai's browser call panel as its fallback).

## Gotchas
- **CRS:**
  - The allowlist is the only path.
  - Never retry a failed login.
  - Errors can arrive as HTTP 200 with `errorMessages`.
  - On 429 `CRS962`, wait for `Retry-After`.
- **Nessie:**
  - Base URL `https://api.nessieisreal.com`; its data is public.
  - Test POSTs first.
  - It has no idempotency support, so use our payments table plus the tag lookup.
- **Cartesia:** outbound only through `POST /agents/calls` from a Cartesia number (US only, 1 call/s). No Twilio trial numbers.
- **Convex:**
  - Network calls only in actions (`fetch` works in the default runtime). Node-only packages go in an actions-only `<module>Node.ts` file.
  - At most 8 scheduled jobs on the free plan.
  - Mutations time out at 1 s; Node actions at 10 min.
- **Claude:**
  - Load the claude-api skill. Model `claude-opus-5-5`.
  - Never send temperature, top_p or top_k. No forced `tool_choice`.
