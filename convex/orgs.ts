import { v } from "convex/values";
import { mutation, internalQuery, QueryCtx } from "./_generated/server";
import { appendAction } from "./audit";

// The live business. Eval runs each get their own org (isEval: true).
export async function primaryOrg(ctx: QueryCtx) {
  const org = await ctx.db
    .query("orgs")
    .filter((q) => q.eq(q.field("isEval"), false))
    .first();
  if (!org) throw new Error("No org yet: run `npx convex run seed:run`");
  return org;
}

export const setKillSwitch = mutation({
  args: { on: v.boolean() },
  handler: async (ctx, { on }) => {
    const org = await primaryOrg(ctx);
    await ctx.db.patch(org._id, { killSwitch: on });
    await appendAction(ctx, {
      orgId: org._id,
      caseId: null,
      seat: "human",
      kind: "kill_switch_changed",
      summary: on ? "Owner froze all payments." : "Owner unfroze payments.",
      data: { on },
    });
  },
});

export const killSwitchOn = internalQuery({
  args: { orgId: v.id("orgs") },
  handler: async (ctx, { orgId }) => {
    const org = await ctx.db.get(orgId);
    return org?.killSwitch ?? true;
  },
});
