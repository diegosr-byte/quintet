import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { appendAction } from "./audit";
import { primaryOrg } from "./orgs";
import { caseStatus, seat } from "./schema";

// The UI never sees callTargetPhone (a teammate's real phone), and sees the on-file phone masked.
function publicParty(p: Doc<"parties"> | null) {
  if (!p) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strips the vendor phone from the public view
  const { callTargetPhone: _hidden, ...rest } = p;
  return { ...rest, phoneOnFile: `•••-${p.phoneOnFile.replace(/\D/g, "").slice(-4)}` };
}

export const list = query({
  args: { status: v.optional(caseStatus) },
  handler: async (ctx, { status }) => {
    const org = await primaryOrg(ctx);
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_org_status", (q) => (status ? q.eq("orgId", org._id).eq("status", status) : q.eq("orgId", org._id)))
      .collect();
    cases.sort((a, b) => b._creationTime - a._creationTime);
    return await Promise.all(
      cases.map(async (c) => {
        const party = c.partyId ? await ctx.db.get(c.partyId) : null;
        const doc = await ctx.db.get(c.documentId);
        return {
          ...c,
          partyName: party?.displayName ?? doc?.extracted?.vendorOrMerchantName ?? null,
          fileName: doc?.fileName ?? null,
        };
      }),
    );
  },
});

export const get = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const c = await ctx.db.get(caseId);
    if (!c) return null;
    const document = await ctx.db.get(c.documentId);
    const party = c.partyId ? await ctx.db.get(c.partyId) : null;
    const checks = await ctx.db.query("checks").withIndex("by_case", (q) => q.eq("caseId", caseId)).collect();
    const approvals = await ctx.db.query("approvals").withIndex("by_case", (q) => q.eq("caseId", caseId)).collect();
    const payments = await ctx.db.query("payments").withIndex("by_case", (q) => q.eq("caseId", caseId)).collect();
    return {
      case: c,
      document: document && { ...document, fileUrl: await ctx.storage.getUrl(document.storageId) },
      party: publicParty(party),
      checks,
      approvals,
      payments,
    };
  },
});

export const setFaultInjection = mutation({
  args: { caseId: v.id("cases"), on: v.boolean() },
  handler: async (ctx, { caseId, on }) => {
    await ctx.db.patch(caseId, { faultInjection: on });
  },
});

export const setStatus = internalMutation({
  args: { caseId: v.id("cases"), status: caseStatus },
  handler: async (ctx, { caseId, status }) => {
    await ctx.db.patch(caseId, { status });
  },
});

export const markFailed = internalMutation({
  args: { caseId: v.id("cases"), seat, error: v.string() },
  handler: async (ctx, { caseId, seat, error }) => {
    const c = (await ctx.db.get(caseId))!;
    await ctx.db.patch(caseId, { status: "failed", reasons: [`Couldn't process: ${error}`] });
    await appendAction(ctx, { orgId: c.orgId, caseId, seat, kind: "check_ran", summary: `Failed: ${error}`, data: { error } });
  },
});
