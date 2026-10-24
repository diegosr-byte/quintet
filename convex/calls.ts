// Caller seat. Eval cases resolve from simulatedCallOutcome. Everything else gets a web call: the case
// page rings, the vendor answers in the browser, and the browser talks to the Cartesia agent directly.
// A web call can't prove who answered, but that's acceptable here: "confirmed_change" still only
// reaches ASK (owner signs off) in the gate, so a forged "yes" can't move money on its own.
import { Infer, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, MutationCtx, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { appendAction } from "./audit";
import { agentSocketUrl, mintAgentToken } from "./lib/cartesia";
import { callOutcome } from "./schema";

const WEB = "web";
const TOKEN_SECONDS = 120;

export const forCase = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const calls = await ctx.db
      .query("calls")
      .withIndex("by_case", (q) => q.eq("caseId", caseId))
      .collect();
    return calls.map(({ toNumber, ...rest }) => ({
      ...rest,
      toNumber: toNumber === WEB ? "web call" : `•••-${toNumber.replace(/\D/g, "").slice(-4)}`,
    }));
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
    // Phone dialing (POST /agents/calls) needs a bought number; demo mode rings in the browser instead.
    await ctx.runMutation(internal.calls.ring, { caseId, partyId: t.partyId });
  },
});

export const ring = internalMutation({
  args: { caseId: v.id("cases"), partyId: v.id("parties") },
  handler: async (ctx, { caseId, partyId }) => {
    const c = (await ctx.db.get(caseId))!;
    await ctx.db.insert("calls", {
      caseId,
      partyId,
      toNumber: WEB,
      cartesiaCallId: null,
      status: "queued",
      outcome: null,
      transcript: [],
      startedAt: null,
      endedAt: null,
    });
    await appendAction(ctx, {
      orgId: c.orgId,
      caseId,
      seat: "caller",
      kind: "call_placed",
      summary: "Web call ringing for the vendor (demo mode, no phone line).",
      data: { channel: WEB },
    });
  },
});

// What the agent may say on the call. Trusted fields only: the org and vendor names come from seed data,
// and the invoice number (extracted from an untrusted document) is reduced to plain id characters.
export const webCallContext = internalQuery({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (!call || call.toNumber !== WEB || call.status !== "queued") return null;
    const c = (await ctx.db.get(call.caseId))!;
    const org = (await ctx.db.get(c.orgId))!;
    const party = (await ctx.db.get(call.partyId))!;
    const invoiceNumber = (c.invoiceNumber ?? "").replace(/[^A-Za-z0-9#-]/g, "").slice(0, 20) || "unknown";
    const amount = c.amountCents === null ? "unknown" : `${(c.amountCents / 100).toFixed(2)} ${c.currency}`;
    return { business: org.name, vendor: party.displayName, invoiceNumber, amount };
  },
});

// The browser asks for this when the vendor taps "answer". Returns the socket URL with a short-lived token.
export const startWebCall = action({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }): Promise<{ socketUrl: string; context: Record<string, string> }> => {
    const context: Record<string, string> | null = await ctx.runQuery(internal.calls.webCallContext, { callId });
    if (!context) throw new Error("This call isn't ringing.");
    const apiKey = process.env.CARTESIA_API_KEY;
    const agentId = process.env.CARTESIA_AGENT_ID;
    if (!apiKey || !agentId) throw new Error("Cartesia isn't set up on this deployment.");
    const token = await mintAgentToken(apiKey, TOKEN_SECONDS);
    return { socketUrl: agentSocketUrl(agentId, token), context };
  },
});

// The browser sends this on session_ready, with the call_id Cartesia gave it.
export const answerWebCall = mutation({
  args: { callId: v.id("calls"), cartesiaCallId: v.string() },
  handler: async (ctx, { callId, cartesiaCallId }) => {
    const call = await ctx.db.get(callId);
    if (!call || call.toNumber !== WEB || call.status !== "queued") throw new Error("This call isn't ringing.");
    await ctx.db.patch(callId, { status: "in_progress", cartesiaCallId: cartesiaCallId.slice(0, 100), startedAt: Date.now() });
  },
});

// The browser sends this when the agent calls its report_outcome client tool, or with "unclear" if the
// call ends without one. Accepted once, and only for the Cartesia call that answered.
export const reportWebOutcome = mutation({
  args: {
    callId: v.id("calls"),
    cartesiaCallId: v.string(),
    outcome: callOutcome,
    transcript: v.array(v.object({ speaker: v.string(), text: v.string() })),
  },
  handler: async (ctx, { callId, cartesiaCallId, outcome, transcript }) => {
    const call = await ctx.db.get(callId);
    if (!call || call.toNumber !== WEB || call.status !== "in_progress" || call.cartesiaCallId !== cartesiaCallId) {
      throw new Error("This call isn't live.");
    }
    await ctx.db.patch(callId, {
      status: "completed",
      outcome,
      transcript: transcript.slice(0, 60).map((l) => ({ speaker: l.speaker.slice(0, 20), text: l.text.slice(0, 500) })),
      endedAt: Date.now(),
    });
    await logResult(ctx, call.caseId, outcome, false);
  },
});

export const recordOutcome = internalMutation({
  args: { caseId: v.id("cases"), partyId: v.id("parties"), outcome: callOutcome, simulated: v.boolean() },
  handler: async (ctx, { caseId, partyId, outcome, simulated }) => {
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
    await logResult(ctx, caseId, outcome, simulated);
  },
});

// Console fallback if the web call won't ring: plays the vendor's answer (default: "no, we changed nothing").
export const simulate = mutation({
  args: { caseId: v.id("cases"), outcome: v.optional(callOutcome) },
  handler: async (ctx, { caseId, outcome }) => {
    const c = (await ctx.db.get(caseId))!;
    if (c.status !== "awaiting_call" || !c.partyId) return;
    const now = Date.now();
    const done = { toNumber: "simulated", status: "completed" as const, outcome: outcome ?? ("denied_change" as const), startedAt: now, endedAt: now };
    const call = await ctx.db.query("calls").withIndex("by_case", (q) => q.eq("caseId", caseId)).first();
    if (call?.status === "completed") return;
    if (call) await ctx.db.patch(call._id, done);
    else await ctx.db.insert("calls", { caseId, partyId: c.partyId, cartesiaCallId: null, transcript: [], ...done });
    await logResult(ctx, caseId, done.outcome, true);
  },
});

async function logResult(ctx: MutationCtx, caseId: Id<"cases">, outcome: Infer<typeof callOutcome>, simulated: boolean) {
  const c = (await ctx.db.get(caseId))!;
  await appendAction(ctx, {
    orgId: c.orgId,
    caseId,
    seat: "caller",
    kind: "call_result",
    summary: `${simulated ? "Simulated call" : "Call"} outcome: ${outcome}.`,
    data: { outcome, simulated },
  });
  await ctx.scheduler.runAfter(0, internal.gateRun.decide, { caseId });
}
