# Sponsor notes: verified facts, gotchas, what judges must see

Researched Oct 22 from the Hacker Guide, Devpost, hive.hackberkeley.org/prizes and sponsor docs. Re-check the live site on Friday, because each track's Hacker Starter Pack is published when the event starts.

## Devpost and judging (everyone)
**Submission:**
- Deadline: **Sun Oct 25, 9:00 AM**.
- Requires a project image and a GitHub repo ("for any code to be considered").
- Requires a demo, pre-recorded or live.

**Judging:**
- **Table:** a 3-minute pitch plus 2 minutes of questions. Criteria: Application, Intentionality, Functionality, Creativity, Technical Complexity.
- The whole team must be present 10:30–12:30.
- **Sponsors judge asynchronously from the Devpost video.** The video is our pitch to every sponsor track.

**Prize tracks:**
- No published cap on how many tracks one project can enter; we're asking in #0-ask-directors.
- Anthropic and SpacetimeDB prizes aren't on Devpost yet. Check Friday.

## Hyphenate (primary target)
- **Track:** "The Hyphenated Enterprise: Autonomous Systems for Finance". $8k / $5k / $3k cash, plus a faster interview process for the top 5.
- **Judging questions:**
  1. Is it real enough? Realistic data, a messy problem, and proof it works.
  2. Would you hire it? For which seats, and would it earn them: limited access, a clean record of its work, and knowing when to ask?
  3. Did we see something new?
  4. The moment: it catches what others missed, recovers from something going wrong, or defends a decision when questioned.
- **What to bring:**
  - A video that opens with the moment.
  - A live demo ("we may ask them to try a scenario of our own").
  - One line on the seats it fills.
  - What's real vs simulated, and how we know.
- **The company:** formerly Maximor. Its agents run order-to-cash, procure-to-pay, treasury and close on top of a company's ERP. They learn the company's policies, hand judgment calls to a person, and are "audit-ready by default". Use that vocabulary.
- **Track doc:** not public. Get it at their workshop (time on hive.hackberkeley.org/schedule) or their table.
- **Our proof:** the seats line; the console and judge receipt photo; the scorecard; the real-vs-simulated table; the audit log.
- **Owners:** Diego (pitch); video 0:00–0:40.

## CRS Credit (4 prizes)
- **Prizes:**
  - Best Overall CRS Hack: $1,000.
  - Best Financial AI Agent: $500 (an AI agent doing real work with CRS data via the API or MCP).
  - Best Identity/Fraud Innovation and Most Unexpected Use: interviews for a forward-deployed engineer role, for each team member.
- **Criteria:** how central CRS is; a working live demo against the sandbox; usefulness; creativity.
- **Access:**
  - calhacks.crscreditapi.com → credentials by **email invite**.
  - Log in with `POST https://api-sandbox.stitchcredit.com/api/users/login` → Bearer token.
  - **Repeated failed logins silently disable the account.**
- **Sandbox products (each must be enabled on the account):**
  - TransUnion, Equifax and Experian credit reports. **We don't use these.**
  - TransUnion identity verification. Knowledge-based questions and one-time codes aren't mocked.
  - AtData Fraud Finder: a 0–100 risk score from email, phone, IP and address.
  - Reverse phone/email lookup (AccurateAppend).
  - Criminal, eviction and liens checks. Not used.
- **Not in the sandbox, despite the landing page:** OFAC and business (KYB) checks. Ask at the booth.
- **Personas (all fake):**
  - **P19:** small-business owner; score 770, fraud score 9. Our clean new vendor.
  - **P12:** identity mismatch; no credit file, identity check fails, fraud score 85, reverse phone returns a different person. **The moment.**
  - **P13:** synthetic identity, fraud score 88.
  - **P14:** deceased.
  - **P16:** fraud alert on file.
  - **Exact request bodies:** the MCP tool `get_test_data` from npm `@crscreditapi/crs-calhacks-mcp-server`. Add it to Claude Code for docs and schemas. The app itself calls the REST API.
- **Gotchas:**
  - **A request that doesn't exactly match a persona goes to the REAL vendor.** Use the allowlist only.
  - Credit-report errors come back as HTTP 200 with `errorMessages`.
  - Rate limiting returns 429 `CRS962` with `Retry-After`.
  - Trust the API spec over the landing page; the Experian path differs.
- **FCRA stance:** no credit pulls. We use identity verification, fraud score and reverse lookup on payees and invoice senders only, with test identities only.
- **Owners:** Josiah (client and guard); video 0:52–1:05.

## Microsoft: Built for the Real World, plus the Customer Impact Award
- **Challenge:** a production-minded AI agent for a meaningful problem (finance, productivity, healthcare or similar).
- **Criteria:** customer understanding, measurable usefulness, path from prototype to production, responsible design, end-to-end functionality. **No Microsoft tech required.**
- **Prizes:** a Surface laptop per member (1st); a remote tech talk with Microsoft's Delta/Frontier forward-deployed engineering team; 1:1 mentorship.
- **Our proof:**
  - Rules cited from a real published small-business expense policy.
  - Scorecard metrics.
  - A README "Path to production": real bank rails or accounting-software exports, single sign-on, multi-business tenancy, audit retention, monitoring, cost per case.
  - A responsible-design list.
- **Owner:** Diego.

## Anthropic
- **Criteria:**
  1. A named community (a broad category is too broad).
  2. A real problem you lived or heard firsthand.
  3. It works and is usable on Monday.
  4. Thoughtful use of Claude, knowing where it could go wrong.
- **Prize:** "coming soon", and not on Devpost yet. At Cal Hacks 12.0, "Best Use of Claude" was a Tungsten Cube plus $5k in API credits.
- **Workshop:** "Intro to Claude Code: Boost Your Coding Workflow".
- **Our proof:**
  - Owner-operated small businesses, with rules cited from a real published expense policy.
  - Claude reads messy documents, fuzzy-matches vendors and writes explanations.
  - The failure-modes answer in `judge-qa.md` (#3).
- **Owner:** Diego.

## Cartesia
- **Criteria (25% each):**
  - Problem and originality.
  - Use of Cartesia: core to the product; clear, responsive, natural voice.
  - Execution: the main flow works, and likely edge cases are handled.
  - Impact and responsibility: accessibility, privacy, responsible use.
- **Submit:**
  - A working demo.
  - A **2-minute demo-first presentation**: one complete user flow, then the problem and how it was built.
  - A README with setup, Cartesia features used, and known limitations.
  - Source access, with no keys in the repo.
- **Prize:** Meta glasses (TBD).
- **Facts:**
  - **Models:** TTS `sonic-3.6` (Cartesia claims under 90 ms to first audio). STT `ink-2`, with turn detection.
  - **Line SDK:** hosting for Python Line SDK agents ends 2026-12-01. Use Cartesia's managed agents, configured in the UI or API, with webhook tools that call our HTTPS endpoint.
  - **Outbound calls:** `POST /agents/calls` with `agent_id`, `from_number_id`, `to_number` and `dynamic_variables`. Cartesia numbers call US numbers only, one call per second.
  - **Interruptions:** the agent WebSocket sends `audio_output_clear` when the caller starts talking.
  - **Browser:** connect over WebSocket with a token our server creates. SDK: `@cartesia/cartesia-js`.
- **Cost:**
  - The free plan has 1 number, 8 concurrent calls and $1 of agent credit (about 17 min). Whether it can dial out is unconfirmed, so **buy Pro ($5/mo) on Friday**.
  - Calls cost $0.06/min, plus $0.014/min on a Cartesia number. Ask the booth for credits.
- **No Twilio:** trial accounts strip `<Stream>`, `<ConversationRelay>` and `<Dial>`.
- **Docs:** docs.cartesia.ai (outbound dialing, Cartesia numbers, agent models, WebSocket API).
- **Responsible design:**
  - The call says it's automated.
  - It asks only yes/no questions and never reads account numbers.
  - It dials only on-file numbers.
  - Voice approval of payments is deliberately not allowed.
- **Owners:** Josiah (the call), Kai (Ask Quintet and the video).

## Capital One Nessie
- **Criteria and prize:** completeness, creativity, complexity. $300 Giftogram per member.
- **Base URL:** `https://api.nessieisreal.com` (HTTPS only). `api.reimaginebanking.com` is dead.
- **Key:** log in with GitHub at nessieisreal.com, then add `?key=` to every request.
- **Spec:** nessieisreal.com/nessie-openapi-spec.yaml.
- **Endpoints:** customers, accounts, bills, deposits, withdrawals, loans, merchants; transfers and purchases per account; a read-only `/enterprise`.
- **Gotchas:**
  - Key checking is lax, and `/enterprise` shows other teams' records, so treat all data as public. Synthetic data only.
  - With no key, `/customers` returns 502, not 401.
  - The SDKs are years old; use plain `fetch`.
  - **POST behavior is untested: test it first thing Friday.**
  - There's no idempotency support, so our `payments` table plus the tag lookup provides it.
  - Transfer `amount` is an integer: floats are truncated ($1.23 stored as 1, $0.50 as 0) and strings are a 400. We send integer **cents** and check the stored amount; the description carries the dollar figure. Transfers don't move account balances in the sandbox. Bills take a float `payment_amount`, but listing them 400s unless every bill has `recurring_date` and `upcoming_payment_date` (checked live 2026-10-24).
- **Our use:** the business's checking account; payees as accounts; payments as transfers (or bills) tagged `QT-…`.
- **Owner:** Josiah.

## Convex
- **Criteria and prize:** criteria coming soon. Prize: Teenage Engineering EP-133 K.O. II plus a Waveshare ESP32-S3 touch display.
- **What it gives us:**
  - Reactive queries.
  - Network calls only in actions; `fetch` works in the default runtime. `"use node"` (Node 22/24) is only for Node-only packages, in separate actions-only files.
  - Scheduler and crons, file storage, and HTTP actions for webhooks.
  - `@convex-dev/agent` exists; we don't need it.
  - The AI Gateway is paid-only, so we use our own Anthropic key.
- **Free-plan limits:**
  - 1M function calls a month; 20 GB-hours of action compute.
  - 0.5 GB database; 1 GB of files.
  - Concurrency: 16 queries, 16 mutations, 64 actions, **8 scheduled jobs**.
  - Timeouts: queries and mutations 1 s; Node actions 10 min.
- **Workshop:** "Build Your Backend with Convex".
- **Owners:** Josiah (backend), Kai (live UI).

## Factory Droid (stretch; only if checkpoint C passes)
- **Prize:** $2,000 cash, plus credits and swag.
- **Requirements:** use the Droid SDK meaningfully, in the running product. The README must explain where and how.
- **Scores well:**
  - Droid runs on a trigger you designed.
  - Thoughtful control over what Droid can touch.
  - Its plans, steps, diffs and results are visible.
- **Scores poorly:** a chatbot wrapper; slides-only demos; projects where you can't tell what the agent did.
- **SDK facts:**
  - Packages: TypeScript `@factory/droid-sdk` (Node 18+, import from `/node`) or Python `droid-sdk`. Auth: `FACTORY_API_KEY`.
  - It spawns the `droid` CLI, so it must run in a long-running Node process on a laptop, not in Convex or Vercel.
- **Confining Droid:**
  - `createSession({ cwd })` sets a starting folder, but **`cwd` is not a fence**. Turn on `sandbox.enabled`; it's documented for the CLI, so verify it works for the SDK.
  - Block shell commands with `disabledToolIds: ['Execute']`.
- **Watching its work:** `session.stream()` yields assistant, tool_call, tool_result and result messages. The plan arrives in `details.plan`. There's no diff event, so run `git diff` yourself.
- **Our use:** a policy compiler. Droid edits `policy-repo/rules.json` and its tests, posts the plan, diff and results to Convex, and a human approves. Anything that loosens a rule is flagged.
- **Owner:** Diego.

## Apify (stretch; only with Droid)
- **Prize:** $5,000 total (1st $2,000; 2nd $1,000; 3rd $800; 4th and 5th $400 each), plus Best Actor $400.
- **Crawling:**
  - Use `apify-client`: `client.actor('apify/website-content-crawler').start({ startUrls, maxCrawlPages })`, then poll and read `client.dataset(run.defaultDatasetId).listItems()`. Items have `url`, `text` and `markdown`.
  - Always set `maxCrawlPages`. `.call()` blocks until done, so use `.start()` plus polling to stay under Convex timeouts.
  - The free plan includes $5 a month.
- **Publishing an actor:**
  - `npm i -g apify-cli` (Node 22+), then `apify create`, `apify run`, `apify push`.
  - Publish in the Console with a logo, description, monetization choice, sample output and output schema.
- **Our use:** crawl a few public small-business expense-policy templates and feed them to Droid. Publish "Small-Business Expense Policy Extractor" for Best Actor.
- **Owner:** Josiah.

## Armadin (opt-in only)
Best Security Hack: criteria coming soon; prize is Apple headphones. Opt in on Devpost if it's allowed; there's no extra build.

## Skipped (don't spend time on these)
- **Coinbase:** its tracks are Payment Agents (Coinbase MCP + x402) and Trading Agents, with one winner each, and a verified Coinbase account is required.
- **Fetch.ai:** the whole user flow must happen inside ASI:One with no custom frontend; Python uAgents.
- **Also skipped:**
  - SpacetimeDB and Bitdeer (no free credits).
  - Moss and Elastic.
  - Mana, Visa, Meta and Atlassian.
  - Creao, SpaceXAI, Notability and Figma.
