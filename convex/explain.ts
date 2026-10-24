// Explanation after every decision (Claude, no tools, effort low). Falls back to the gate's own reasons.
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { appendAction } from "./audit";
import { structured } from "./lib/claude";
import { EXPLAIN_SYSTEM_PROMPT, explainJsonSchema } from "../prompts/explain";

export const facts = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const c = (await ctx.db.get(caseId))!;
    const party = c.partyId ? await ctx.db.get(c.partyId) : null;
    const checks = await ctx.db
      .query("checks")
      .withIndex("by_case", (q) => q.eq("caseId", caseId))
      .collect();
    return {
      verdict: c.verdict,
      status: c.status,
      amountCents: c.amountCents,
      currency: c.currency,
      payee: party?.displayName ?? null,
      reasons: c.reasons,
      ruleIds: c.ruleIds,
      requiredApprovals: c.requiredApprovals,
      checks: checks.map((ch) => ({ kind: ch.kind, result: ch.result, detail: ch.detail })),
    };
  },
});

function fallback(verdict: string | null, reasons: string[]): string {
  const lead =
    verdict === "ALLOW"
      ? "Quintet paid this automatically."
      : verdict === "ASK"
        ? "Quintet is waiting for a human to sign."
        : "Quintet blocked this payment.";
  return [lead, ...reasons].join(" ");
}

export const write = internalAction({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }): Promise<null> => {
    const f = await ctx.runQuery(internal.explain.facts, { caseId });
    let explanation = fallback(f.verdict, f.reasons);
    let costUsd = 0;
    let source = "fallback";
    try {
      const r = await structured<{ explanation: string }>({
        system: EXPLAIN_SYSTEM_PROMPT,
        userText: JSON.stringify(f),
        schema: explainJsonSchema,
        effort: "low",
      });
      costUsd = r.costUsd;
      if (r.ok) {
        explanation = r.value.explanation;
        source = "claude";
      }
    } catch {
      // keep the fallback
    }
    await ctx.runMutation(internal.explain.save, { caseId, explanation, source, costUsd });
    return null;
  },
});

export const save = internalMutation({
  args: { caseId: v.id("cases"), explanation: v.string(), source: v.string(), costUsd: v.number() },
  handler: async (ctx, { caseId, explanation, source, costUsd }) => {
    const c = (await ctx.db.get(caseId))!;
    await ctx.db.patch(caseId, { explanation });
    await appendAction(ctx, {
      orgId: c.orgId,
      caseId,
      seat: "controller",
      kind: "explanation_written",
      summary: explanation.slice(0, 300),
      data: { source, costUsd },
    });
  },
});
