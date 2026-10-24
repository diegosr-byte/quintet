# Demo script

**Roles at the table:**
- **Diego** pitches.
- **Kai** drives the laptop.
- **Josiah** is the "vendor" whose phone rings, and answers backend questions.

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
| 0:00–0:15 | Diego | "Small businesses move real money (supplier invoices, employee reimbursements) through one person, with nobody checking their work, and fake 'we changed banks' invoices target exactly that gap." "Quintet is the second signature." |
| 0:15–1:00 | Kai drives, Diego narrates | Kai runs DEMO-1 from the console. Diego names the three red checks. Josiah's phone rings; Josiah answers as the vendor and says "no". The case goes to BLOCKED. |
| 1:00–1:20 | Diego | Push-to-talk: "Why did you hold it?" The spoken answer cites the audit log. |
| 1:20–1:45 | Kai | The genuine invoice → ALLOW → paid. Fault injection on → paid exactly once. Diego: "The model can't move money. A tested rules engine decides, and the model can only make it stricter." |
| 1:45–2:25 | Judge | "Your turn: give us a receipt from your wallet, or change anything on this invoice." Kai runs it live. |
| 2:25–3:00 | Diego | Scorecard → "what's real, what's simulated" → "Quintet fills five seats a small business can't staff: intake clerk, verification analyst, caller, payments clerk, controller. The owner only signs what policy says needs a human." |

## 20-second sponsor add-ons (for judges who stop by)
- **Hyphenate:** the seats line, plus "audit-ready by default: every action has an append-only log entry; try your own scenario."
- **CRS:** "CRS is the verification analyst's eyes: identity, Fraud Finder and reverse phone on every new payee and every detail change. Allowlisted test identities, no credit pulls."
- **Microsoft:** "Our rules come from a real published small-business expense policy, we measured 25 cases, and here's the path to production."
- **Anthropic:** "For owner-operated small businesses with no finance team. Claude reads the messy documents, but can't move money. Here's where it could go wrong and our guard for each."
- **Cartesia:** "Voice is the control, not a garnish. Our Caller seat phones the number on file, the step humans skip. Voice approvals are deliberately banned."
- **Nessie:** "The business's bank: accounts, payees, transfers, idempotent retries."
- **Convex:** "One reactive backend. Every seat's work shows up live; scheduled pipeline, webhooks for the call."
- **Factory / Apify (if built):** "Droid turns a published expense-policy template (crawled by our Apify actor) into tested policy. A human approves the diff, and loosening is flagged."
