import { query } from "./_generated/server";

// evals.run (the runner) lands Sat 9 AM-1 PM.
export const latest = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("evalRuns").order("desc").first();
  },
});
