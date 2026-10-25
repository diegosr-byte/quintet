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

**Positions:** Kai in the middle with the laptop. Diego on the left, facing the judge. Josiah on the right with his own laptop open to the case page, speaker on. Speak to the judge, not the screen.

**Before each judge arrives (Kai):** reset the demo, run one routine invoice to warm it up, and have the console open on the scenario buttons.

| Time | Who | What |
|---|---|---|
| 0:00–0:20 | Diego | "Small businesses move real money through one person, with nobody checking their work, and fake 'we changed banks' invoices target exactly that gap. Quintet is the second signature. Every document takes the same five steps: **read, verify, call, decide, pay.** Watch where this one stops." Kai clicks "We switched banks" on the last words. |
| 0:20–0:45 | Kai | Narrates the board as the steps light up. **Read:** "the bank details changed, and there's hidden text aimed at the AI." **Verify:** "three red checks: the bank, a CRS fraud score of 85 on the callback number, and the hidden instructions." Keep it short: the call starts on its own. |
| 0:45–1:15 | Josiah | **Call.** "Step three: it calls the number we have on file, not the one on the invoice." The case page rings (a browser call, on Josiah's laptop with speaker on); Josiah answers as the vendor: "No, we didn't change anything." The live transcript is on screen. BLOCKED. |
| 1:15–1:35 | Diego | **Decide.** "Why did you hold it?" (spoken, or typed if it's loud). The answer cites the audit log. "Every action is in an append-only log." |
| 1:35–2:05 | Josiah (Kai drives) | **Pay.** Kai clicks "Routine invoice", with "break the payment" on. "It's allowed, and I'm breaking the payment on purpose. It retries, and pays exactly once, because every payment carries a unique key." Diego adds: "The model can't move money. A tested rules engine decides, and the model can only make it stricter." |
| 2:05–2:30 | Judge, Kai runs it | "Your turn. Pick any of these (Kai shows the scenario buttons), or change the amount, the bank details or the vendor." If the judge hesitates, Diego picks "Over $1,000": it needs two signatures, a different verdict. |
| 2:30–3:00 | Diego | Kai switches to the scorecard. "25 cases: every attack stopped, every legitimate invoice paid, no wrongful holds. What's real, what's simulated." Close: "Read, verify, call, decide, pay: five seats a small business can't staff, and the owner only signs what the policy says needs a human." |

**Speaking time:** Diego about 1:25, Josiah about 1:00, Kai about 25 s plus the judge round.

## If something breaks (say it out loud, keep going)
- **The call doesn't ring within 10 s.** Josiah: "The phone network is slow in here. Here's what it does." Kai switches to the call outcome already shown on the case page (or the recorded video of the moment). Don't wait in silence.
- **The case is slow (over 15 s).** Diego fills with the policy line: "While it checks: the rules come from a published small-business expense policy, and the model can only make a verdict stricter."
- **Voice is unusable in the hall.** Type the question and let the answer show on screen. Never ask a judge to repeat it.
- **The judge asks for something the console can't do.** "Good question, that one we can't run live, but here's what the gate would do." Answer from `policy-rules.md`.
- **Always have the video ready** on a second tab, at the moment (0:00–0:40).

## Before the first judge: status
1. Break the payment before the case exists: built (console toggle, creation-time flag). Check once.
2. Reset between judges: built (Reset demo button, `seed:resetDemo`). Check once.
3. Simulate the call: built (button on the case page while the call rings). Check once.
4. Run the whole pitch ten times back to back with reset between runs. Not done.

## 20-second sponsor add-ons (for judges who stop by)
- **Hyphenate:** the seats line, plus "audit-ready by default: every action has an append-only log entry; try your own scenario."
- **CRS:** "CRS is the verification analyst's eyes: identity, Fraud Finder and reverse phone on every new payee and every detail change. Allowlisted test identities, no credit pulls."
- **Microsoft:** "Our rules come from a real published small-business expense policy, we measured 25 cases, and here's the path to production."
- **Anthropic:** "For owner-operated small businesses with no finance team. Claude reads the messy documents, but can't move money. Here's where it could go wrong and our guard for each."
- **Cartesia:** "Voice is the control, not a garnish. Our Caller seat calls the vendor on file, the step humans skip. Voice approvals are deliberately banned."
- **Nessie:** "The business's bank: accounts, payees, transfers, idempotent retries."
- **Convex:** "One reactive backend. Every seat's work shows up live; scheduled pipeline, live call state."
- **Factory / Apify (if built):** "Droid turns a published expense-policy template (crawled by our Apify actor) into tested policy. A human approves the diff, and loosening is flagged."
