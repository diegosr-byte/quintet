# Kai: face + voice + video

**Mission:**
- Make every decision readable on a projector within 2 seconds.
- Let a judge drive a scenario themselves.
- Ship the 2-minute video that sponsors judge from.

**Load:** about 21.5 h of core work. Stretch: a live voice agent over WebSocket (2 h).

## You own
`app/**`, `components/**`, `convex/ask.ts`, `public/**`, and the video assets.

**Don't touch:** any other file in `convex/`, `convex/lib/*` or `prompts/`.

## What you hand off, and what you wait for

| You provide | To | By |
|---|---|---|
| Ops board + case page | demo | Fri 10:00 PM |
| Approvals, kill switch, audit timeline UI | demo | Sat 2:00 AM |
| Console + `/upload` | Hyphenate demo | Sat 9:00 AM |
| Scorecard + policy pages | Microsoft demo | Sat 1:00 PM |
| Video v1 / final | Diego (Devpost) | Sat 11:00 PM / Sun 7:30 AM |

| You consume | From | By |
|---|---|---|
| `schema.ts` + seed | Josiah | Fri 7:30 PM (mock data until then) |
| Queries | Josiah | Fri 9:00 PM |
| Approvals + kill-switch mutations | Josiah | Sat 12:00 AM |
| `factory.render` v1 | Diego | Sat 7:00 AM |
| Eval runner | Josiah | Sat 1:00 PM |

## Tracks you're responsible for proving
- **Convex:** the live UI.
- **Cartesia:** Ask Quintet, plus recording the call well.
- **Hyphenate:** the console a judge drives.
- **Hacker's Choice:** people want to touch it.
- **Every sponsor, through the video.**

## Pages

| Route | Shows | Data |
|---|---|---|
| `/` (ops board) | A live feed of cases, with status chips moving intake → verification → gate → caller (when a call is needed) → payment; today's totals; the kill switch | `cases.list`, `audit.recent` |
| `/case/[id]` | The document (PDF or photo) and its extracted fields; checks with pass/fail and evidence; the verdict, reasons and rule ids; approvals (typed amount, two signatures over $1,000); the live call transcript; the audit timeline; "Why?" (Ask Quintet); the fault-injection toggle | `cases.get`, `audit.forCase`, `calls.forCase` |
| `/console` | Judge mode: template + knobs (payee, amount, bank same or changed, callback number, hidden text, duplicate) → Generate → the case opens. Shows a QR code to `/upload` | `factory.render`, `documents.ingest` |
| `/upload` | Phone-friendly receipt capture (`<input type="file" accept="image/*" capture="environment">`) plus an employee picker (who's being reimbursed) | `documents.generateUploadUrl`, `documents.ingest` with `submittedByPartyKey` |
| `/scorecard` | The latest eval: attacks stopped, legit auto-paid, wrongful holds, ASK rate, median seconds, cost per case; a table of all 25 with expected vs actual; a "Run eval" button | `evals.latest`, `evals.run` |
| `/policy` | Active rules in plain English, plus version history. Stretch: Droid diffs with an approve button | `policy.current`, `policy.versions` |

**Design rules:**
- Projector first: body text 18 px or larger, and high contrast.
- Verdicts are always icon + word + color, never color alone: ALLOW green, ASK amber, BLOCK red.
- One primary action per screen.
- A visible SYNTHETIC badge.

## Before Friday 6 PM (no code)
- [ ] Create a Vercel account (GitHub login).
- [ ] Read: the Convex React quickstart (`useQuery`/`useMutation`), Convex file uploads, the shadcn/ui install guide.
- [ ] Recorder: QuickTime or OBS. Test recording the screen plus a phone on speaker. Find a phone stand.
- [ ] Sketch the 6 pages on paper.

## Fri 6:00–6:45 PM
1. Contracts session with all three.
2. After Josiah pushes: clone, `npm install` (shadcn is already initialized), then the layout and nav.

## Fri 6:45–10:00 PM
**Ops board and case page.** Use mock data until Josiah's seed lands at 7:30.

Done when: a newly ingested case appears and moves through its statuses live, without a refresh.
> Read CLAUDE.md, docs/contracts.md §2–3 and §7, and team/kai.md. Build app/page.tsx (ops board) and app/case/[id]/page.tsx with Convex useQuery. Follow the design rules in team/kai.md.

**Checkpoint A (10 PM).**

## Fri 10:00 PM – 2:00 AM
Approvals UI (typed-amount confirm, two-signature state), the kill switch, the audit timeline, and an evidence drawer for each check.

Done when: the moment's three red checks are readable from 3 m away.

**Checkpoint B (2 AM).**

## Fri 2:00–6:00 AM: sleep

## Sat 7:00–9:00 AM
`/console` on top of `factory.render`, plus `/upload` and its QR code.

Done when: a console-generated PDF shows up in the case viewer, proving it went through intake.

## Sat 9:00 AM – 1:00 PM
The `/scorecard` and `/policy` pages, and a live call-transcript panel on the case page.

**Checkpoint C (1 PM).**

## Sat 1:00–6:00 PM: Ask Quintet + polish
`convex/ask.ts` flow:
1. A push-to-talk recording (MediaRecorder) is uploaded.
2. Cartesia STT `ink-2` transcribes it. Check its docs for a batch endpoint; if it only streams, start with typed input.
3. Claude (`claude-opus-5-5`, effort low) answers from `case.explanation` plus the recent actions.
4. Cartesia TTS `sonic-3.6` speaks the answer, and the audio plays in the page.

Keep typed input as the fallback. Then polish the UI.

Stretch: a live voice agent over the Cartesia WebSocket, with a token minted by an action.

## Sat 6:00–11:00 PM
**Video v1**, following `docs/demo-script.md`:
- 2:00 maximum.
- The moment inside the first 20 s.
- Sponsor labels and burned-in captions.

## Sat 11:00 PM – 5:00 AM
Video v2, then sleep at least 3 h.

## Sun 5:00–8:30 AM
Upload the final video to YouTube (unlisted) and send Diego the link and timestamps.

## Sun 9:00 AM – 12:30 PM
At the table: you drive the laptop.

## If you're behind
**Cut in this order:**
1. The live WebSocket voice agent.
2. The `/policy` page.
3. The voice part of Ask Quintet (keep typed input + TTS).
4. The `/upload` QR code (keep the console).

**Never cut:** the ops board, the case page, the console, the scorecard, the video.

## Gotchas
- **Never put API keys in the browser.** Claude and Cartesia calls happen in `convex/ask.ts`. Browser voice (stretch) uses a token minted by an action.
- **Live updates come from Convex reactive queries.** Don't poll.
- **For the live call or CRS checks,** point `NEXT_PUBLIC_CONVEX_URL` at the integration deployment (Josiah's dev until Sat ~9 PM, then prod).
- **The case page must handle both** photos (no text layer) and PDFs.
- **Record the call so both sides are audible**, and caption it for sponsors watching muted.
