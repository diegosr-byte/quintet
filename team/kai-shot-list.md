# Video v1: shot list (Kai)

Follows the table in `docs/demo-script.md` (2:00 max, the moment inside 20 s, burned-in captions, a sponsor label in the corner).
Each shot says what to have on screen, what to click, the caption, and the label. **Record against Josiah's integration deployment**: only it has CRS (the fraud flags) and the live call.

## Before you record

- [ ] **Point the app at the integration deployment.** `.env.local` → `NEXT_PUBLIC_CONVEX_URL=<Josiah's URL>`, restart `npm run dev`.
- [ ] **No dev badge on screen.** Record from the deployed Vercel site (or `npm run build && npm start`); the dev server shows a Next.js "N" badge bottom-left.
- [ ] **Browser:** full screen, 1920×1080, zoom 110–125% so text reads on a phone-sized YouTube player. Hide bookmarks bar and extensions.
- [ ] **Clean board:** ask Josiah for a fresh seed (or a reset) so the ops board isn't full of test cases, then run one routine invoice to warm up.
- [ ] **Phone:** Josiah's phone on speaker next to the mic, Do Not Disturb on except for the Cartesia number.
- [ ] **Receipt prop:** a real paper receipt with an alcohol line (for 1:20) and the `/upload` page open on a phone.
- [ ] **Never on screen:** real keys, Josiah's real number (the UI masks it as •••-1234; keep it that way), the Convex dashboard.

## Gaps to close first (in order of risk)

1. **The live call** (0:18–0:40) isn't built yet: no Cartesia agent or number, `calls.place` is a TODO, no `http.ts`. Josiah. Fallback: record the rest now and drop the call in later, or use the simulated outcome and caption it "simulated".
2. **"Break the payment" before the case exists** (1:05–1:20): fault injection is a checkbox on the case page, and the payment lands in about 10 s, so ticking it after the fact races the payment. **Kai can add a console toggle** that sets it the instant the case is created.
3. **Invoice #1043** (0:00): the console's "We switched banks" scenario doesn't set the invoice number, so it shows a random LF-xxxxx. **Kai can pin it to LF-1043** so it matches the script and captions.
4. **"The cited evidence highlights"** (0:40–0:52): Ask Cora answers aloud and in text, but nothing highlights on the page. Cover it with a caption, or cut the phrase.

## Shots

| # | Time | On screen / action | Caption (burned in) | Label |
|---|---|---|---|---|
| 1 | 0:00–0:06 | Ops board, team strip visible. Click **Try it yourself → "We switched banks" → Generate**. The case appears on the board; Ivy (cloud) bobs. | "An invoice from the usual paper supplier. Looks routine." | Hyphenate: the moment |
| 2 | 0:06–0:18 | Case page. Red flags fill in: **Bank account changed · Phone belongs to someone else / High fraud score · Hidden instructions aimed at the AI.** Status chip flips to **Payment frozen**; tracker stops on **Cal · Call**. | "Bank changed · CRS: number belongs to someone else, fraud 85/100 · hidden instructions aimed at the AI" | CRS |
| 3 | 0:18–0:40 | Scroll to **Verification call**: the **Live** badge pulses, Cal's lines stream in. Cut to the phone ringing on the table; Josiah: "No, we didn't change anything." Verdict stays **BLOCK**; status → **Blocked**. | Call subtitles (Cal / Vendor) | Cartesia |
| 4 | 0:40–0:52 | **Ask Cora**: tap the mic, ask "Why did you hold it?", tap again. Cora's answer plays aloud and appears as a bubble; she bobs while speaking. | The answer text, plus "Every answer comes from the case's own audit log." | Anthropic · Hyphenate |
| 5 | 0:52–1:05 | **Checks**: expand the failed CRS checks (identity, fraud score 85, reverse phone) to show the evidence rows. | "Sandbox test identities only, behind an allowlist" | CRS |
| 6 | 1:05–1:20 | Console → **Routine invoice** at $280 (with "break the payment" on, once gap 2 is fixed) → case pays: **ALLOW**, **Penny · Pay**, payment tag `QT-…`. In the audit timeline, Penny's retry says "Found the transfer already sent … not sending again." Cut to the ops board: **Paid today** updates live. | "Allowed → paid once, even when the first transfer fails" | Nessie · Convex |
| 7 | 1:20–1:35 | Phone: `/upload` → Employee A → take a photo of the receipt → **Send to Ivy** → "Got it!". Laptop: the case shows **ASK** with "Receipt includes alcohol". | "Snap a receipt: alcohol isn't reimbursable, so a person decides" | Hyphenate (a judge's own scenario) |
| 8 | 1:35–1:50 | **Scorecard** after a full run: 25 cases, attacks stopped, legit auto-paid, wrongful holds 0, ask rate, cost per case. Pan down the table. | "25 test cases, scored every run" | Microsoft |
| 9 | 1:50–2:00 | Back to the ops board team strip: Ivy, Vera, Cora, Cal, Penny. | "Five seats, one quintet. Claude proposes, code countersigns." | — |

## Takes

- **Shots 1–3 (the moment):** 3 takes, keep the cleanest; each needs a fresh case.
- **Shot 4:** record in a quiet room; if voice is flaky, type the question (the demo script allows it) and caption it.
- **Shots 6–8:** one take each is usually enough; re-run the eval just before shot 8 so the numbers are fresh.
- Record the screen in one long take per shot, then trim. Add captions and labels in the editor (CapCut or iMovie), not on screen.

## After

- Upload **unlisted** to YouTube; send Diego the link and these timestamps for Devpost and the README ("Where each sponsor's tech lives").
