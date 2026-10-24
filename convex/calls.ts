// Caller seat. The live Cartesia call lands Sat 7-9 AM; tonight only eval cases (simulatedCallOutcome) resolve.
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { appendAction } from "./audit";
import { callOutcome } from "./schema";

export const forCase = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const calls = await ctx.db
      .query("calls")
      .withIndex("by_case", (q) => q.eq("caseId", caseId))
      .collect();
    return calls.map(({ toNumber, ...rest }) => ({ ...rest, toNumber: `•••-${toNumber.replace(/\D/g, "").slice(-4)}` }));
  },
});

export const target = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const c = (await ctx.db.get(caseId))!;
    const party = c.partyId ? await ctx.db.get(c.partyId) : null;
    const existing = await ctx.db
      .query("calls")
      .withIndex("by_case", (q) => q.eq("caseId", caseId))
      .first();
    return { simulated: c.simulatedCallOutcome, partyId: party?._id ?? null, toNumber: party?.callTargetPhone ?? null, alreadyCalled: existing !== null };
  },
});

export const place = internalAction({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const t = await ctx.runQuery(internal.calls.target, { caseId });
    if (t.alreadyCalled || !t.partyId) return;
    if (t.simulated) {
      await ctx.runMutation(internal.calls.recordOutcome, { caseId, partyId: t.partyId, outcome: t.simulated, simulated: true });
      return;
    }
    // TODO(Sat 7 AM): POST /agents/calls to Cartesia with t.toNumber. Until then the case waits in awaiting_call.
    console.log(`call needed for ${caseId}; Cartesia not wired yet (target ${t.toNumber ? "set" : "missing"})`);
  },
});

export const recordOutcome = internalMutation({
  args: { caseId: v.id("cases"), partyId: v.id("parties"), outcome: callOutcome, simulated: v.boolean() },
  handler: async (ctx, { caseId, partyId, outcome, simulated }) => {
    const c = (await ctx.db.get(caseId))!;
    const now = Date.now();
    await ctx.db.insert("calls", {
      caseId,
      partyId,
      toNumber: simulated ? "simulated" : "",
      cartesiaCallId: null,
      status: "completed",
      outcome,
      transcript: [],
      startedAt: now,
      endedAt: now,
    });
    await appendAction(ctx, {
      orgId: c.orgId,
      caseId,
      seat: "caller",
      kind: "call_result",
      summary: `${simulated ? "Simulated call" : "Call"} outcome: ${outcome}.`,
      data: { outcome, simulated },
    });
    await ctx.scheduler.runAfter(0, internal.gateRun.decide, { caseId });
  },
});
