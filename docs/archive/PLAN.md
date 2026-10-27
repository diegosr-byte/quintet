# Quintet: Cal Hacks 13.0 plan and team Claude Code kit

> **Note:** interfaces, rules and test cases in `kit/docs/` supersede this plan where they differ. They were refined after this plan was written.

## Context
- **Team:** Diego, Josiah and Kai, all building with AI (Claude Code).
- **Event:** Cal Hacks 13.0, Palace of Fine Arts, Fri Oct 23 – Sun Oct 25 2026.
- **Hard constraints:**
  - Devpost closes Sun 9:00 AM and needs a GitHub repo and a demo video.
  - Judging at the table: a 3-minute pitch plus 2 minutes of questions, with the whole team present. Criteria: Application, Intentionality, Functionality, Creativity, Technical Complexity.
  - Sponsor judges score asynchronously from the Devpost video.
  - Projects must be started at the event, so no project code before hacking opens (~6 PM Friday).
- **The ask:** criticize the "Ledger Crew" brief (`~/projects/calhacks-13/ledger-crew-brief.md`), redo it, and scope it to win its target tracks.
- **Latest direction:** don't code now. Build the **file infrastructure each teammate's Claude Code will run on**, with the work split evenly across the three of us. Approving this plan writes **markdown and config files only** (section 12).

## 0. Changes vs your track map

| Your map | This plan | Why | Cost to add back |
|---|---|---|---|
| SpacetimeDB as core | **Convex** | TypeScript end to end; reactive UI, scheduler, storage and webhooks in one tool. Spacetime's external API calls rely on procedures its docs mark unstable (Rust/C# examples), and its prize isn't posted. | 6–8 h re-platform |
| Cartesia for briefings and voice approvals | **Cartesia makes the verification call** + "Ask Quintet" | Approving payments by voice is the attack vector; a verification call is the defense | — |
| Coinbase x402 | Cut | Pay-per-request, not invoice settlement; its tracks are Payment/Trading Agents with one winner each | About 2 h, and a forced fit |
| Apify | Stretch, paired with Factory | Only meaningful as the policy-compiler input | About 1.5 h after Droid works |
| Elastic, Moss, Bitdeer, Mana, Atlassian, Creao | Cut | Bolt-ons, no free credits, conflicts with our UI, or criteria gated/unknown | 0.5–4 h each |
| Fetch.ai | Cut | The whole user flow must live inside ASI:One with no custom UI; Python | 3–4 h |
| *(new)* Factory Droid | Stretch | Policy compiler | — |
| *(new)* Armadin security | Opt-in | It's a security hack | 0 |

## 1. Critique of Ledger Crew

**Keep:**
- **"The model proposes, code decides":** a deterministic ALLOW / ASK / BLOCK gate. It's PlanEd's winning architecture and exactly what Hyphenate scores.
- **The fraud moment**, the scenario console, the eval set, and the real-vs-simulated table.

**Fix:**
1. **About 15 tracks is a logo wall.** Each sponsor rubric wants its tech central, and each integration is another live failure point on venue wifi (hotspots banned). Build 7, stretch 2.
2. **Three audiences means no community.** Anthropic rejects broad communities; Microsoft scores customer understanding. One community: owner-operated small businesses with no finance team (the demo business is a 6-person print-and-design studio). Narrow to one trade for the pitch.
3. **An "AI clerk that catches invoice fraud" is the obvious Hyphenate entry,** and Ramp, Bill.com and nickel.com (a different company) already sell versions of it. nickel.com's AI agent "Penny" already does small-business accounts payable by email (chasing invoices, paying bills, asking for approval). Hyphenate asks "did we see something new?" Answer with a thesis: separation of duties for businesses too small to have a finance team, enforced by an independent verifier (a callback to the number on file, a tested rules gate, an audit log). This is the crowded version of the idea, so the callback moment has to carry the novelty.
4. **Freelancers mostly receive money,** so the vendor-payment moment barely applies to them.
5. **Approving payments by voice is a security anti-pattern.** Move voice to where it's the control: a callback to the vendor's on-file number.
6. **Free-running multi-agent loops add latency and nondeterminism.** Seats become permission boundaries over a deterministic pipeline.
7. **Credit pulls on vendors need an FCRA permissible purpose.** Use CRS identity verification, fraud score and reverse phone/email instead; no credit reports.

## 2. Quintet
- **Line:** "Every small business has one person who pays the bills. Quintet is the second signature."
- **Tagline:** "Claude proposes. Code countersigns."
- **Name:** Quintet: five seats working in harmony. Searched Oct 23; no finance or accounts-payable product by that name turned up. (Rejected: Nickel, because nickel.com is a small-business payments company whose AI agent Penny already does accounts payable by email.) Fictional vendor names must return no real business when searched ("Fogline" is a band).
- **Community:** owner-operated small businesses (1–20 people) with no finance team. Demo business: a 6-person print-and-design studio.
- **Problem:** the owner or office manager pays suppliers and reimburses employees with no second check. Fake "we changed banks" invoices target exactly these businesses, and the approval rules live in the owner's head.
- **Seats line (for Hyphenate):** "Quintet fills five seats a small business can't staff (intake clerk, verification analyst, caller, payments clerk, controller), so the owner only signs what policy says needs a human."
- **Hyphenate vocabulary:** Hyphenate (formerly Maximor) runs P2P / O2C / treasury / close agents that learn a company's policies, hand judgment calls to a person, and are "audit-ready by default". Pitch as "procure-to-pay for businesses with no finance team".

| Seat | Filled by | Can | Cannot |
|---|---|---|---|
| Intake clerk | Claude (no tools) + deterministic PDF parser | Extract fields from invoices, receipts and emails; flag text aimed at the AI | Call tools, see policy, touch money |
| Verification analyst | Code + CRS + Claude for fuzzy matching and the written evidence | Diff the payee against the on-file record, check duplicates, run CRS | Approve anything (recommends ASK/BLOCK only) |
| Caller | Cartesia voice agent | When the gate asks for a call: phone the **on-file** number, say it's automated, ask yes/no whether the bank details changed, report the outcome | Dial any number from a document, read out account numbers, ask for personal information, approve or pay |
| Payments clerk | Code | Pay via Nessie what the gate allowed or a human approved, with idempotency | Pay without a gate decision |
| Controller | Claude (read-only) + code | Answer "why?" from the audit log; watch caps and split purchases; freeze everything | Change records |
| Owner (+ accountant over $1,000) | Humans | Approve ASK cases by typing the amount | — |

**The moment (lands in the video's first 20 s):**
1. The business's usual paper supplier, a fictional sole proprietor, emails invoice #1043 for $1,850: "we switched banks", with a new callback number and hidden white text telling the AI to pay immediately.
2. Three red checks appear:
   - Bank account changed since the last payment.
   - CRS: the new number belongs to someone else, the sender's fraud score is 85, and identity verification fails (persona P12).
   - Instructions aimed at the AI were found in the PDF.
3. The payment freezes. A phone on the table rings: the crew is calling the **on-file** number. The "vendor" (a teammate) says nothing changed, and the case is BLOCKED.
4. "Why did you hold it?" is answered aloud, citing audit entries.
5. The genuine invoice from the same vendor is ALLOWED and paid through Nessie. A forced failure mid-payment still results in exactly one payment.

## 3. Tracks

| Track | Prize | What judges see |
|---|---|---|
| **Hyphenate** (primary) | $8k / $5k / $3k + interviews for top 5 | The moment first; the seats line; the judge's own scenario (console, or a receipt from their wallet); real vs simulated; the scorecard |
| **CRS** (4 prizes) | $1k / $500 / interview prizes | Live sandbox checks on every new payee and every detail change. Personas: P19 clean business owner, P12 mismatch, P13 synthetic, P14 deceased, P16 fraud alert |
| **Microsoft ×2** | Surface per member + FDE talk | Rules from a published expense policy, measured metrics, path-to-production README, responsible design. No Microsoft tech required |
| **Anthropic** | TBD (not on Devpost yet; add it when it appears) | Named community; Claude reads, matches and explains; a written list of failure modes with their guards |
| **Cartesia** | Meta glasses (TBD) | The outbound verification call + "Ask Quintet" |
| **Capital One Nessie** | $300 per person | The business's bank: accounts, payees, bills, deposits |
| **Convex** | EP-133 + ESP32 board | System of record, live board, scheduled pipeline, webhooks |
| *Stretch:* Factory Droid | $2k | Policy compiler (JSON rules + tests, human-approved diff) |
| *Stretch:* Apify | Top 5 from $2k down to $400, + Best Actor $400 | Crawls public small-business expense-policy templates into the compiler; actor published |
| *Opt-in:* Armadin | Headphones | Fraud and injection defense |

Also general: overall, Most Technically Complex, Best People-First, Hacker's Choice.

No cap on tracks per submission is published; ask #0-ask-directors.

## 4. Architecture
**Stack:**
- Next.js (App Router) + Tailwind + shadcn/ui on Vercel.
- **Convex:** database, reactive queries, Node actions, scheduler, file storage, HTTP actions.
- Claude via `@anthropic-ai/sdk`.
- Cartesia, Nessie (`api.nessieisreal.com`), CRS sandbox.

**Claude rules (go into the kit's CLAUDE.md):**
- Load the `claude-api` skill before writing any Claude call.
- `claude-opus-5-5` everywhere, with `output_config.effort` per route: extraction `medium`, evidence and explanations `low`.
- Extraction: PDF/image blocks + structured outputs (`output_config.format` / `messages.parse()`), no tools.
- **Never send `temperature`/`top_p`/`top_k`** (400 since Oct 21 2026). No forced `tool_choice`, no assistant prefill.
- Refusal fallback on (`fallbacks: "default"`). Put stable prompt content first for caching.

**Gate:**
- A pure `evaluate(policy, input) → {verdict, reasons, ruleIds}`, unit-tested with vitest.
- The policy is **JSON data** in `policyVersions`, so "rules may only tighten without a human" is a code check, and Droid can edit rules without a redeploy.
- The executor re-checks the kill switch right before sending.

| Rule | Condition → verdict |
|---|---|
| **R0** | ALLOW only if every check passes, confidence ≥ 0.9, required fields are present and the document type is known. Otherwise ASK, with "needs a human because…" |
| R1 | New payee → ASK, and needs a CRS pass |
| R2 | Bank, phone or email domain differs from the record on file → BLOCK until the call. If the vendor confirms the change → ASK |
| R3 | CRS identity fails or fraud flag → BLOCK |
| R4 | Over $500 → ASK the owner. Over $1,000 → ASK the owner **and** the accountant |
| R5 | Daily outflow cap exceeded → ASK |
| R6 | Duplicate invoice or receipt → BLOCK |
| R7 | Instructions aimed at the AI detected → never auto-ALLOW; logged as evidence |
| R8 | Reimbursement with no itemized receipt, a disallowed category, or older than 30 days → ASK |
| R9 | Split purchase (same payee within 7 days, summing over the cap) → ASK |
| R10 | The model can only make a verdict stricter |
| — | Kill switch on → BLOCK all |

**Guards:**
- **CRS** calls happen only through a hard-coded persona allowlist. The sandbox routes non-matching requests to the real bureau.
  - The dialed phone lives in `callTargetPhone`, which the CRS client never reads; a unit test asserts it.
  - Vendors are sole proprietors (the sandbox has no business checks).
  - Login credentials arrive by email invite; don't retry failed logins (repeated failures disable the account).
  - Check `errorMessages` even on HTTP 200, and back off on 429 `CRS962`.
- **Untrusted docs:** extraction runs tool-less with a strict schema, and a parser cross-checks amount, bank account and invoice number. Any disagreement → ASK.
- **Payments:** a unique idempotency-key row is written before calling Nessie. A retry looks up our tag first. A fault-injection toggle proves exactly one payment.
- **Nessie:** data is effectively public, so synthetic data only. A same-shape mock sits behind a flag, for development.
- **Convex free plan:** only 8 scheduled jobs at once, so the eval runner batches ≤6. Node actions time out at 10 min; queries and mutations at 1 s.

**Voice:**
- **Verification call:** a Cartesia agent configured in Cartesia's UI or API.
  - A Convex action places the call with `POST /agents/calls`, sending `agent_id`, `from_number_id`, `to_number` (the on-file number) and `dynamic_variables`.
  - The agent says it's an automated assistant, asks only whether the bank details changed, and never reads out numbers.
  - Its webhook tool `report_outcome` hits a Convex HTTP action, which re-gates the case.
  - Use a Cartesia number (Pro plan, $5); no Twilio, because trial numbers strip the audio streaming.
- **"Ask Quintet":** push-to-talk or typed question → Claude answers from the stored explanation → Cartesia TTS (`sonic-3.6`). Stretch: a live WebSocket agent.

**Console:** templates plus knobs render a **real PDF** that goes through the same intake path, and a judge can upload a receipt photo from their phone.

**Tables:** `orgs`, `policyVersions`, `parties`, `documents`, `cases` (status machine), `checks`, `actions` (append-only audit log), `approvals`, `payments`, `calls`, `evalRuns`.

## 5. Proof
**25 eval cases:**

| Group | Cases | Expected |
|---|---|---|
| Legit | 6 vendor invoices, 4 reimbursements | ALLOW |
| New payee | 2 (P19) | ASK |
| Attacks | 8: bank change (P12), lookalike vendor, synthetic identity (P13), deceased (P14), fraud alert (P16, → ASK + call), re-sent invoice, duplicate receipt, hidden instructions | **Never paid** |
| Policy edges | 4: alcohol, receipt over 30 days, split purchase, over $1,000 | ASK |
| Off-template | 1: credit note in EUR | ASK (R0) |

- 18 cases survive cutting the reimbursement path.
- **Scorecard:** attacks stopped, legit auto-processed, wrongful holds, ASK rate, median seconds and cost per case. Stretch: a naive no-gate baseline.
- **Real:** Claude, the gate, CRS sandbox, Nessie API, the phone call, Convex.
- **Simulated:** the business, vendors and employees (marked SYNTHETIC), test identities, sandbox money.

## 6. Team split (even: about 20–21 h of core work each)

| | **Diego: brain + story** | **Josiah: pipes + money** | **Kai: face + voice + video** |
|---|---|---|---|
| Owns | `convex/lib/gate*`, `convex/lib/policy*`, `prompts/`, `convex/factory.ts` (PDF/doc generator), `evals/fixtures/`, `docs/` pitch files, README core | `convex/schema.ts`, `seed`, `documents`, `intake`, `verify`, `gateRun`, `payments`, `calls`, `http`, `evals` runner, `convex/lib/{crs,nessie,cartesia,claude,parser}`, `package.json` merges, prod deploys | `app/**`, `components/**`, `convex/ask.ts`, video assets |
| Core work | Gate + policy JSON + tests (3 h); prompts and schemas for intake, verification, explanation (2.5 h); document factory: 3 invoice layouts, hidden-text option, receipt photos (3 h); 25 fixtures (2 h) | Repo, Convex, schema, seed (2.5 h); pipeline ingest → intake → verify → gate (3 h); parser cross-check + injection scan (1.5 h); CRS client + allowlist + tests (2 h); Nessie payments + idempotency + fault injection (2.5 h); Cartesia verification call + webhook (3 h); eval runner (2 h); prod deploy + replay mode (2.5 h) | App shell + Vercel (1 h); live ops board (2.5 h); case page with live call transcript (3 h); approvals + kill switch UI (1.5 h); console + receipt upload (2.5 h); scorecard + policy pages (2.5 h); Ask Quintet push-to-talk + TTS (2.5 h); polish (2 h) |
| Story / ship | Expense-policy template → policy rules and seed data (2 h); sponsor tables + Hyphenate workshop (2.5 h); pitch, Q&A, rehearsals (3 h); README core + Devpost (3 h) | README sections for CRS, Nessie, Cartesia call, Convex (1 h) | Video ≤2:00, record + edit (3.5 h); README UI/voice (0.5 h) |
| **Core total** | **~21 h** | **~20 h** | **~21.5 h** |
| Stretch (only if checkpoint C passes) | Droid policy compiler (4 h) | Apify crawl + actor (2.5 h) | Live voice agent over WebSocket (2 h) |

**Handoffs (stub until delivered):**
- Josiah: schema + seed by Fri 7:30 PM. This unblocks Kai.
- Diego: intake prompt by 8 PM; gate stub (always ASK) by 7 PM, real rules by 10 PM; factory v1 by Sat 7 AM. This unblocks Kai's console.
- Josiah: queries for Kai (`cases.list/get`, `actions.forCase`, `calls.forCase`, `approvals.pending`, `evalRuns.latest`, `policy.current`) by 9 PM.

**Git and Convex rules:**
- Everyone commits small and often to `main`, touching only files they own; `git pull --rebase` before pushing.
- Announce dependency adds in chat; Josiah merges `package.json`.
- Each person runs their own Convex dev deployment; Josiah deploys prod from `main`.

## 7. Timeline

| When | Diego | Josiah | Kai | Checkpoint |
|---|---|---|---|---|
| Fri 6:00–6:45 | All three: adjust `docs/contracts.md` (don't redesign it); Josiah creates the repo with the kit as its first commit | ← | ← | Contracts frozen |
| Fri 6:45–10 PM | Gate R0–R6 + tests; intake prompt | Schema, seed, pipeline through a Nessie payment | Shell, ops board, case page on seed data | **A:** one invoice end to end, live |
| Fri 10 PM–2 AM | R7–R10; verification + explanation prompts; factory v1 | CRS + allowlist; diff and duplicate checks; parser; approvals backend | Approvals UI, audit timeline, kill switch | **B:** the moment works in text |
| Fri 2–7 AM | Sleep at least 4 h each, staggered | | | |
| Sat 7–9 AM | Sponsor tables; Hyphenate track doc | Verification call end to end | Console on the factory; receipt upload | |
| Sat 9 AM–1 PM | 25 fixtures; review eval misses | Eval runner; reimbursement path; fault injection | Scorecard + policy pages; live transcript | **C:** moment with call; console; eval runs |
| Sat 1–6 PM | Stretch Droid, or fix misses | Stretch Apify, or harden | Ask Quintet; polish | Freeze integrations 8 PM |
| Sat 6–11 PM | README core; **Devpost draft by 11 PM**; rehearsal | Prod deploy; replay mode; README sections | Video v1 | Draft submitted |
| Sat 11 PM–5 AM | Rehearse; sleep at least 3 h | Fixes; sleep at least 3 h | Video v2; sleep at least 3 h | |
| Sun 5–8:30 AM | Final README/Devpost; **submit by 8:30** | Prod smoke test ×3 | Final video | Submitted |
| Sun 9–12:30 | All three at the table; ethernet in; phone charged | ← | ← | |

**Cut order if behind:**
1. Stretch.
2. Ask Quintet voice (the text version stays).
3. The reimbursement path.
4. The parser cross-check.

**Never cut:** the moment, the console, the scorecard, the audit log, real vs simulated.

## 8. Demo, video and judging
- **Video:** 2:00 max, the moment within 20 s, labeled sponsor segments. The timestamps are listed in Devpost and the README. Record the call audio cleanly.
- **Table pitch, 3:00:**

  | Time | Beat |
  |---|---|
  | 0:00–0:15 | Problem in one line |
  | 0:15–1:00 | The moment |
  | 1:00–1:20 | "Why did you hold it?" |
  | 1:20–1:45 | Paid exactly once |
  | 1:45–2:25 | The judge's own scenario |
  | 2:25–3:00 | Scorecard, real vs simulated, the seats line |

- Then 2:00 of questions. Prepare 20-second sponsor add-ons.
- **Ten questions to prepare:** what's real; why not Ramp, Bill.com or nickel.com; tricked model; a real bank change; false holds; why voice; FCRA; evidence it's a real problem; path to production; scale.

## 9. Before the event (no code)
- **Diego:**
  - Assumption (no interviews): the business pays from its own bank account, which Nessie stands in for.
  - Turn one real, published small-business expense policy into `policy-rules.md`.
  - Request CRS sandbox access tonight.
  - Post the Slack questions.
  - Create the shared team accounts (Anthropic, Convex) and share keys through a password manager.
- **Josiah:** Nessie key (GitHub login), Cartesia Pro ($5) + number. Read the Convex, Cartesia agents and CRS docs. Install Node 22+ and the Convex CLI.
- **Kai:** Vercel. Read the Convex React docs and shadcn. Set up a screen recorder (screen + phone audio). Find a phone stand.
- **All:** Claude Code installed and logged in; GitHub access; ethernet-to-USB-C adapter, chargers, ID, Hacker Pass in the wallet.

## 10. Risks

| Risk | Fallback |
|---|---|
| Venue wifi | Ethernet; cloud backend; call over cellular; replay mode; recorded video |
| Sponsor API down | Mock adapter for development; be honest in the demo |
| Call fails | In-browser call panel; last resort, a labeled recording of a real call |
| A CRS request leaks to the real bureau | Allowlist is the only path; asserted by a test |
| Cartesia free plan can't dial out | Pay $5 for Pro on Friday |
| AI-coding thrash | Frozen contracts; owned files; the kit's CLAUDE.md; small tasks |

## 11. Verification
- **Before Friday (the kit itself):**
  - Every repo path has exactly one owner across the three team files.
  - Hour totals stay within ±10% of each other.
  - Every research fact appears in `sponsor-notes.md`.
  - Only `.md` files plus `.claude/settings.json` are created.
  - `kit/CLAUDE.md` is under ~150 lines.
- **At the event:**
  - `npx vitest` covers the gate rules, tighten-only and the CRS allowlist.
  - The eval runs 25/25, or every miss is explained.
  - The moment works end to end ×3 on venue wifi.
  - The fault-injection toggle produces exactly one Nessie transfer.
  - A console PDF shows in the case viewer.
  - Fresh-eyes test with another team.
  - `git grep` finds no keys.

## 12. On approval: the team kit (markdown and config only, no code)
```
~/projects/calhacks-13/
  START-HERE.md            how the kit works, who reads what when, how to share it, the Friday kickoff
  PLAN.md                  team copy of this plan
  ledger-crew-brief.md     archive (exists)
  kit/                     → becomes the repo's first commit at ~6 PM Friday
    CLAUDE.md              shared rules for every teammate's Claude Code: product, hard rules,
                           Claude API rules, Convex conventions, file ownership, git rules
    .claude/settings.json  conservative permission allowlist (tests, convex dev, git status/diff/commit).
                           No deploy, no push. Syntax checked with the update-config skill.
    docs/contracts.md      frozen interfaces as tables: Convex tables/fields, enums, status machine,
                           gate input/output, policy JSON keys, factory spec, functions by owner, audit kinds
    docs/policy-rules.md   R0–R10 with parameters and defaults (Diego adds the policy source)
    docs/eval-cases.md     25 cases: id, scenario, payee/persona, key fields, expected verdict, rule ids
    docs/sponsor-notes.md  per sponsor: verified facts, gotchas, what judges must see, segment owner
    docs/demo-script.md    video shot list (≤2:00) + 3-min table pitch + sponsor add-ons
    docs/judge-qa.md       10 questions with draft answers
    team/diego.md          each file: mission; owns / don't touch; provides and consumes (with deadlines);
    team/josiah.md         tracks you prove; time blocks with tasks and "done when"; paste-in prompts;
    team/kai.md            cut rules; gotchas; pre-event checklist
  prep/                    pre-event only, not committed
    accounts-checklist.md  per person, with links
    slack-questions.md     ready to paste into #0-ask-directors
```

**Kickoff prompt** (each person, Friday at ~6 PM, in the cloned repo):
> "I'm <Name> on team Quintet at Cal Hacks 13.0. Read CLAUDE.md, docs/contracts.md and team/<name>.md. Start my first block and stop at each 'done when' check to show me."

**After writing the kit:**
1. Update the vault: the Quintet decision at the top of `log/decisions.md`; the project note; the "Now" line in `core.md`.
2. Save a memory: Diego wants per-teammate Claude Code kits with an even split, not code, for team hackathons.
3. Tell Diego how to share `kit/` with Josiah and Kai (private GitHub repo, AirDrop or Drive). I won't push anywhere without his OK.
