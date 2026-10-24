import { v, Infer } from "convex/values";
import { MutationCtx, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { actionKind, seat } from "./schema";

// The only way rows get into actions. There is deliberately no update or delete.
export async function appendAction(
  ctx: MutationCtx,
  row: {
    orgId: Id<"orgs">;
    caseId: Id<"cases"> | null;
    seat: Infer<typeof seat>;
    kind: Infer<typeof actionKind>;
    summary: string;
    data?: unknown;
    ruleIds?: string[];
  },
) {
  await ctx.db.insert("actions", { ...row, data: row.data ?? null, ruleIds: row.ruleIds ?? null });
}

export const forCase = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    return await ctx.db
      .query("actions")
      .withIndex("by_case", (q) => q.eq("caseId", caseId))
      .order("asc")
      .collect();
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const org = await ctx.db
      .query("orgs")
      .filter((q) => q.eq(q.field("isEval"), false))
      .first();
    if (!org) return [];
    return await ctx.db
      .query("actions")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(Math.min(limit ?? 50, 200));
  },
});
