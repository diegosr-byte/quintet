// The eval runner (evals/fixtures/README.md): a fresh eval org per run, wave 1 then wave 2, at most 6 cases at a time.
// Run it with: npx convex run evals:run   (or '{"only":["E13"]}' for a subset)
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { EVAL_CASES, EvalCase } from "../evals/fixtures/cases";
import { CaseResult, scoreCase, summarize } from "../evals/fixtures/score";

const CONCURRENCY = 6;
const CASE_TIMEOUT_MS = 180_000;
const FINAL = new Set(["paid", "blocked", "rejected", "failed", "awaiting_approval", "awaiting_call"]);

export const latest = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("evalRuns").order("desc").first();
  },
});

export const start = internalMutation({
  args: { orgId: v.id("orgs") },
  handler: async (ctx, { orgId }) => {
    const org = (await ctx.db.get(orgId))!;
    return await ctx.db.insert("evalRuns", {
      orgId,
      policyVersionId: org.activePolicyVersionId!,
      startedAt: Date.now(),
      finishedAt: null,
      results: [],
      summary: null,
    });
  },
});

export const finish = internalMutation({
  args: { runId: v.id("evalRuns"), results: v.any(), summary: v.any() },
  handler: async (ctx, { runId, results, summary }) => {
    await ctx.db.patch(runId, { finishedAt: Date.now(), results, summary });
  },
});

// Where the case is now, and what it has cost so far (intake + explanation).
export const progress = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const c = (await ctx.db.get(caseId))!;
    const actions = await ctx.db.query("actions").withIndex("by_case", (q) => q.eq("caseId", caseId)).collect();
    const costUsd = actions.reduce((sum, a) => sum + (typeof a.data?.costUsd === "number" ? a.data.costUsd : 0), 0);
    return { status: c.status, verdict: c.verdict, explained: c.explanation !== null, costUsd };
  },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const run = internalAction({
  args: { only: v.optional(v.array(v.string())) },
  handler: async (ctx, { only }) => {
    const cases = EVAL_CASES.filter((c) => !only || only.includes(c.id));
    const orgId: Id<"orgs"> = await ctx.runAction(internal.seed.run, { isEval: true });
    const runId: Id<"evalRuns"> = await ctx.runMutation(internal.evals.start, { orgId });

    const stored = new Map<string, { storageId: string; fileName: string; mimeType: string }>();
    const outcomes: (CaseResult & { caseId: Id<"cases"> | null })[] = [];

    async function runCase(c: EvalCase) {
      const t0 = Date.now();
      const base = { evalCaseId: c.id, actual: null, paid: false, ms: 0, costUsd: 0, caseId: null as Id<"cases"> | null };
      try {
        // E19 submits the exact bytes E07 produced, so the sha256 matches.
        const file = c.reuseFileOf ? stored.get(c.reuseFileOf) : await ctx.runAction(api.factory.render, c.spec);
        if (!file) throw new Error(`no stored file for ${c.reuseFileOf} (run its case first)`);
        stored.set(c.id, file);
        const caseId: Id<"cases"> = await ctx.runMutation(internal.documents.ingestForOrg, {
          orgId,
          storageId: file.storageId as Id<"_storage">,
          source: "eval",
          fileName: file.fileName,
          mimeType: file.mimeType,
          evalCaseId: c.id,
          submittedByPartyKey: c.submittedByPartyKey,
          simulatedCallOutcome: c.simulatedCallOutcome ?? null,
        });
        base.caseId = caseId;
        // Wait for a final status, then for the explanation (it lands after the decision) for up to 20 s.
        let p = await ctx.runQuery(internal.evals.progress, { caseId });
        let finalAt = 0;
        while (Date.now() - t0 < CASE_TIMEOUT_MS) {
          if (FINAL.has(p.status)) {
            finalAt ||= Date.now();
            if (p.explained || Date.now() - finalAt > 20_000) break;
          }
          await sleep(1500);
          p = await ctx.runQuery(internal.evals.progress, { caseId });
        }
        return { ...base, actual: FINAL.has(p.status) ? p.verdict : null, paid: p.status === "paid", ms: (finalAt || Date.now()) - t0, costUsd: p.costUsd };
      } catch (e) {
        console.log(`${c.id} errored: ${(e as Error).message}`);
        return { ...base, ms: Date.now() - t0 };
      }
    }

    // Wave 1 finishes before wave 2 starts, because wave 2 depends on wave 1 (duplicates, reused files).
    for (const wave of [1, 2] as const) {
      const queue = cases.filter((c) => c.wave === wave);
      await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
          for (let c = queue.shift(); c; c = queue.shift()) outcomes.push(await runCase(c));
        }),
      );
    }

    const byId = new Map(cases.map((c) => [c.id, c]));
    const results = outcomes.map((o) => {
      const c = byId.get(o.evalCaseId)!;
      const { pass, note } = scoreCase(c, o);
      return { evalCaseId: o.evalCaseId, caseId: o.caseId, expected: c.expected, actual: o.actual, paid: o.paid, ms: o.ms, costUsd: o.costUsd, pass, note };
    });
    const summary = summarize(results, cases);
    await ctx.runMutation(internal.evals.finish, { runId, results, summary });
    const failed = results.filter((r) => !r.pass);
    console.log(`Eval run ${runId}: ${results.length - failed.length}/${results.length} pass`, failed.map((r) => `${r.evalCaseId}: ${r.note}`));
    return { runId, pass: results.length - failed.length, total: results.length, failed: failed.map((r) => `${r.evalCaseId}: ${r.note}`), summary };
  },
});
