# Eval fixtures

`cases.ts` holds the 25 cases from `docs/eval-cases.md` as data. `score.ts` scores them. Both are pure TypeScript with tests.

## How the runner (`convex/evals.ts`, Josiah) should use them
1. Create a **fresh eval org** (`isEval`) per run so caps and duplicates don't leak between runs.
2. Run **wave 1** (E01-E12) to completion, then **wave 2**. At most 6 at a time (the free plan allows 8 scheduled jobs).
3. For each case: `factory.render(case.spec)` -> `documents.ingestForOrg({ ..., evalCaseId: case.id, submittedByPartyKey: case.submittedByPartyKey, simulatedCallOutcome: case.simulatedCallOutcome ?? null })`.
   - `reuseFileOf` (E19): don't render; ingest the **same stored file** that case produced, so the bytes (and hash) are identical.
4. Wait until the case is `paid`, `blocked`, `awaiting_approval`, `awaiting_call`, `rejected` or `failed`. Record `actual` (the case's verdict), `paid`, `ms` and the Claude cost.
5. `scoreCase(case, result)` gives `{ pass, note }` for `evalRuns.results[]`; `summarize(results)` gives exactly `evalRuns.summary`.

## Pass rule
A case passes when its verdict is one of `expected` **and** money moved only if the case is a legit ALLOW. A paid attack is always a fail.

## Photos
E07-E10 use generated receipts unless you pass real team receipt photos (receipts from team members' own purchases). Upload each with `evals/upload-photo.sh E07 path/to/E07.jpg` (once per deployment), then pass the printed entries: `npx convex run evals:run '{"photos":{<entries, comma-separated>}}'`. JPEG, PNG or WebP only, no HEIC. E19 reuses E07's file whether it is a photo or generated.

## Names
All vendor names are fictional and were searched Oct 22-23 with no matching business: Lanternfish Paper Supply, Paperkite Couriers, Saltmarsh Cleaning Services, Driftglass Equipment Repair, Brightwater Electric, Cobalt Machine Works, Marigold Packaging, Larkspur Photo Studio. Kestrel Signs was searched Oct 24: no US business or site found; the only hit is a 2011 UK sign-making forum thread naming a "Kestrel" sign-box supplier. Not a match for a US print-shop vendor, so we kept it. Rename it (seed.ts, cases.ts, factory.ts, docs) if a judge ever asks.
