# Recording checklist (SFSU tonight)

Shot-by-shot detail is in `docs/archive/team/kai-shot-list.md`. Fixes to it:
- Its "Gaps to close first" list is stale: the live call, "break the payment" before the case exists, and the simulate-call fallback are all built. Only check each once.
- **No real alcohol receipt on camera.** For the 1:20 receipt shot use a generated alcohol receipt (E21), or one of the team's real receipts without alcohol that trips another rule. A real alcohol purchase doesn't go in a public video.
- Everything the video shows is also in `docs/demo-script.md`; keep the two in step.

## Before leaving the venue
- [ ] Josiah confirms the web call rings, answers and ends BLOCKED, and says how long it takes.
- [ ] Josiah's `evals:run` result in hand, so the scorecard shot shows real numbers.
- [ ] Pull `main` on every laptop; `npm install`; clean `git status`.
- [ ] The integration URL works from a phone hotspot, not just venue wifi.
- [ ] Photos (`E07-valero.jpg`, `chipotle-old-E22.jpeg`) and this repo's docs are on a laptop that works offline.
- [ ] Record raw takes of shots 1-3 (the moment and the call) while all three are together.

## At SFSU
- [ ] `.env.local` points at the integration deployment; record from the deployed site or `npm run build && npm start` (no dev badge).
- [ ] Full screen 1920x1080, zoom 110-125%, bookmarks and extensions hidden.
- [ ] Reset demo, then one routine invoice to warm up.
- [ ] Never on screen: keys, a real phone number, the Convex dashboard, staff names or card digits on receipts.
- [ ] Phone on Do Not Disturb. Quiet room for Ask Cora.
- [ ] Upload unlisted to YouTube; add the sponsor timestamps to the README table and the Devpost.

## Sun morning
- [ ] README timestamps and scorecard filled; Devpost video link added; submitted by 8:30.
- [ ] `git grep` finds no keys or phone numbers, then make the repo public.

## Recording the screen shots automatically (Diego's setup)
`scripts/record-demo.mjs` opens the live site in its own browser and records the screen shots with a gliding cursor, smooth zooms, burned-in captions and a sponsor label, one clip per shot. No screen-recording permission is needed.
- Install once: `npm i --no-save playwright && npx playwright install chromium` (ffmpeg must be installed).
- Run: `node scripts/record-demo.mjs`. Clips land in `scripts/out/<timestamp>/` (gitignored).
- `REAL_CALL=1` waits for a person to answer on `/vendor` (for a real call take). `ONLY=reset,shot1-landing,shot2-flags,shot3-call` runs just those steps. `MIC=1` also records the MacBook mic (list devices: `ffmpeg -f avfoundation -list_devices true -i ""`) and puts it on the call clip.
- The receipt shot uses a copy of the Valero receipt with the cashier's name and card digits blacked out (`scripts/out/valero-receipt.jpg`). Never use the unredacted photo in public footage.
- Alex Marianetti's clips and the assembled cuts live outside the repo (`~/projects/quintet-alex-clips/`, `~/projects/quintet-demo-cut/`), because they contain his footage.
- Known limits: the recorder can't capture audio (Cora's spoken answer and the call need a separate take), and the Simulate button needs the backend fix noted in `docs/demo-script.md`.
