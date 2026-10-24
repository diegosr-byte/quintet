import { query } from "./_generated/server";
import { primaryOrg } from "./orgs";

export const current = query({
  args: {},
  handler: async (ctx) => {
    const org = await primaryOrg(ctx);
    return org.activePolicyVersionId ? await ctx.db.get(org.activePolicyVersionId) : null;
  },
});

export const versions = query({
  args: {},
  handler: async (ctx) => {
    const org = await primaryOrg(ctx);
    return await ctx.db
      .query("policyVersions")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .collect();
  },
});
