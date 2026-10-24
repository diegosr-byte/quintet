import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { appendAction } from "./audit";
import { primaryOrg } from "./orgs";

export const pending = query({
  args: {},
  handler: async (ctx) => {
    const org = await primaryOrg(ctx);
    const waiting = await ctx.db
      .query("cases")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "awaiting_approval"))
      .collect();
    const out = [];
    for (const c of waiting) {
      const rows = await ctx.db
        .query("approvals")
        .withIndex("by_case", (q) => q.eq("caseId", c._id))
        .collect();
      for (const a of rows) if (a.status === "pending") out.push({ ...a, amountCents: c.amountCents, reasons: c.reasons });
    }
    return out;
  },
});

// A human signs. Approving requires typing the exact amount.
export const decide = mutation({
  args: {
    approvalId: v.id("approvals"),
    decision: v.union(v.literal("approved"), v.literal("denied")),
    typedAmountCents: v.union(v.number(), v.null()),
    decidedBy: v.string(),
  },
  handler: async (ctx, { approvalId, decision, typedAmountCents, decidedBy }) => {
    const approval = await ctx.db.get(approvalId);
    if (!approval || approval.status !== "pending") throw new Error("This approval is no longer pending.");
    const c = (await ctx.db.get(approval.caseId))!;
    if (c.status !== "awaiting_approval") throw new Error(`Case is ${c.status}.`);
    if (decision === "approved" && typedAmountCents !== c.amountCents) {
      throw new Error("The typed amount doesn't match the invoice amount.");
    }
    await ctx.db.patch(approvalId, { status: decision, decidedBy, typedAmountCents, decidedAt: Date.now() });
    await appendAction(ctx, {
      orgId: c.orgId,
      caseId: c._id,
      seat: "human",
      kind: decision === "approved" ? "approval_given" : "approval_denied",
      summary: `${decidedBy} (${approval.role}) ${decision} this payment.`,
      data: { approvalId, role: approval.role, typedAmountCents },
    });

    if (decision === "denied") {
      await ctx.db.patch(c._id, { status: "rejected" });
      return;
    }
    const all = await ctx.db
      .query("approvals")
      .withIndex("by_case", (q) => q.eq("caseId", c._id))
      .collect();
    if (all.every((a) => a.status === "approved")) {
      await ctx.db.patch(c._id, { status: "paying" });
      await ctx.scheduler.runAfter(0, internal.payments.execute, { caseId: c._id });
    }
  },
});
