# Demo script

**Roles at the table (all three speak):**
- **Diego** opens, closes, and answers questions on the gate, the policy, the eval and the evidence.
- **Kai** drives the laptop, narrates what's on screen, and answers UI questions.
- **Josiah** owns the call and the payment, and answers backend questions (CRS, Nessie, Cartesia, Convex).

## Video: 2:00 maximum (sponsors judge from this)
**Format:**
- Demo first, with the moment inside the first 20 seconds.
- Burned-in captions, so it works muted.
- A small label in the corner naming the sponsor tech in each segment.

**Recording:** upload unlisted to YouTube. List the timestamps in Devpost and in the README under "Where each sponsor's tech lives".

| Time | Shot | Voiceover / on-screen | Label |
|---|---|---|---|
| 0:00–0:06 | Ops board; an email with invoice #1043 arrives from the studio's usual paper supplier | "This invoice looks routine." | Hyphenate: the moment |
| 0:06–0:18 | The case page lights up three red checks; the status flips to "Payment frozen" | Captions: bank changed · CRS: number belongs to someone else, fraud 85/100 · hidden instructions aimed at the AI | CRS |
| 0:18–0:40 | The phone on the table rings; the transcript streams live. Josiah: "No, we didn't change anything." → BLOCKED: confirmed fraud attempt | Call subtitles | Cartesia |
| 0:40–0:52 | "Why did you hold it?" answered aloud; the cited evidence highlights | | Anthropic · Hyphenate |
| 0:52–1:05 | Evidence drawer: identity fail, Fraud Finder 85, reverse-phone mismatch | Caption: "Sandbox test identities only, behind an allowlist" | CRS |
| 1:05–1:20 | The genuine $280 invoice → ALLOW → Nessie transfer. Fault injection on → retry → "paid exactly once"; the board updates live | | Nessie · Convex |
| 1:20–1:35 | A phone photo of a receipt → alcohol line flagged → ASK | | Hyphenate (a judge's own scenario) |
| 1:35–1:50 | Scorecard: 25 cases, attacks stopped, wrongful holds, ASK rate, cost per case; real vs simulated | | Microsoft |
| 1:50–2:00 | The seats line + "Five seats, one quintet. Claude proposes, code countersigns." | | — |

**Recording tips:**
- Use QuickTime or OBS for the screen; put the phone on speaker near the mic.
- Record 3 takes of the moment and keep the cleanest.
- Never show real keys or real phone numbers on screen.

## Table pitch: 3:00, then 2:00 of questions

| Time | Who | What |
|---|---|---|
| 0:00–0:20 | Diego | "Small businesses move real money (supplier invoices, employee reimbursements) through one person, with nobody checking their work, and fake 'we changed banks' invoices target exactly that gap." "Quintet is the second signature. Every document takes the same five steps: **read, verify, call, decide, pay.** Watch where this one stops." |
| 0:20–0:50 | Kai | Runs DEMO-1 from the console and narrates the board as each step lights up. **Read:** the invoice arrives and Quintet finds the bank changed and hidden text aimed at the AI. **Verify:** three red checks: the bank changed, CRS says the number belongs to someone else with a fraud score of 85, and the hidden instructions. |
| 0:50–1:15 | Josiah | **Call.** "Quintet calls the number we have on file, not the one on the invoice." The phone rings and Josiah answers as the vendor: "No, we didn't change anything." The case goes to BLOCKED. |
| 1:15–1:35 | Diego | Push-to-talk: "Why did you hold it?" The spoken answer cites the audit log. "Every action is in an append-only log." |
| 1:35–2:05 | Josiah (Kai drives) | **Decide, pay.** The genuine invoice → ALLOW → paid. Fault injection on: "I'm breaking the payment. It retries, and it still pays exactly once, because every payment carries a unique key." Diego adds one line: "The model can't move money. A tested rules engine decides, and the model can only make it stricter." |
| 2:05–2:30 | Judge (Kai runs it) | "Your turn: you pick. Change the amount, the bank details, the vendor, or the kind of document, and Kai runs it live." Kai uses the console knobs. If the judge has no preference, Diego picks a scenario that shows a different verdict (an invoice over $1,000, or a duplicate). **Don't count on the judge having a receipt.** If they do have one, `/upload` takes a photo. Keep the real receipt photo (E07) on Kai's phone, or printed on the table, to offer instead. |
| 2:30–3:00 | Diego | Scorecard → "what's real, what's simulated" → "Quintet fills five seats a small business can't staff: intake clerk, verification analyst, caller, payments clerk, controller. The owner only signs what policy says needs a human." |

**Speaking time:** Diego about 1:15, Josiah about 55 s, Kai about 30 s plus the judge round.

**Who answers in the 2 minutes of questions:**
- **Diego:** the policy and its source, the eval, the failure modes, why these customers.
- **Kai:** the UI, the console, Ask Quintet, the video.
- **Josiah:** CRS and the allowlist, the call, Nessie and idempotency, Convex.

## 20-second sponsor add-ons (for judges who stop by)
- **Hyphenate:** the seats line, plus "audit-ready by default: every action has an append-only log entry; try your own scenario."
- **CRS:** "CRS is the verification analyst's eyes: identity, Fraud Finder and reverse phone on every new payee and every detail change. Allowlisted test identities, no credit pulls."
- **Microsoft:** "Our rules come from a real published small-business expense policy, we measured 25 cases, and here's the path to production."
- **Anthropic:** "For owner-operated small businesses with no finance team. Claude reads the messy documents, but can't move money. Here's where it could go wrong and our guard for each."
- **Cartesia:** "Voice is the control, not a garnish. Our Caller seat phones the number on file, the step humans skip. Voice approvals are deliberately banned."
- **Nessie:** "The business's bank: accounts, payees, transfers, idempotent retries."
- **Convex:** "One reactive backend. Every seat's work shows up live; scheduled pipeline, webhooks for the call."
- **Factory / Apify (if built):** "Droid turns a published expense-policy template (crawled by our Apify actor) into tested policy. A human approves the diff, and loosening is flagged."
