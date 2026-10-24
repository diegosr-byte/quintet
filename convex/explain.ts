// Explanation after every decision. Tonight: built from the gate's reasons. Claude version (Diego's prompt) lands later.
import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { appendAction } from "./audit";

export const write = internalAction({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    await ctx.runMutation(internal.explain.save, { caseId });
  },
});

export const save = internalMutation({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const c = (await ctx.db.get(caseId))!;
    const verdictLine =
      c.verdict === "ALLOW" ? "Quintet paid this automatically." : c.verdict === "ASK" ? "Quintet is waiting for a human to sign." : "Quintet blocked this payment.";
    const explanation = [verdictLine, ...c.reasons].join(" ");
    await ctx.db.patch(caseId, { explanation });
    await appendAction(ctx, { orgId: c.orgId, caseId, seat: "controller", kind: "explanation_written", summary: explanation.slice(0, 300) });
  },
});
