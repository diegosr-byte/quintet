// Controller seat: builds GateInput from the recorded checks, asks evaluate(), routes the case.
// The verdict comes only from evaluate() in lib/gate.ts. Nothing here decides money.
import { v } from "convex/values";
import { internalMutation, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { appendAction } from "./audit";
import { evaluate, GateInput } from "./lib/gate";
import { DocKind, PolicyRules } from "./lib/policy";

const DAY = 24 * 60 * 60 * 1000;
const PT_OFFSET = 7 * 60 * 60 * 1000; // the event runs on PDT (UTC-7)

function startOfTodayPT(now: number): number {
  return Math.floor((now - PT_OFFSET) / DAY) * DAY + PT_OFFSET;
}

async function succeededPayments(ctx: MutationCtx, orgId: Id<"orgs">) {
  const cases = await ctx.db
    .query("cases")
    .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "paid"))
    .collect();
  const out: { partyId: Id<"parties"> | null; caseId: Id<"cases">; amountCents: number; at: number }[] = [];
  for (const c of cases) {
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_case", (q) => q.eq("caseId", c._id))
      .collect();
    for (const p of payments) {
      if (p.status === "succeeded") out.push({ partyId: c.partyId, caseId: c._id, amountCents: p.amountCents, at: p.succeededAt ?? p._creationTime });
    }
  }
  return out;
}

async function buildInput(ctx: MutationCtx, c: Doc<"cases">, org: Doc<"orgs">, rules: PolicyRules): Promise<GateInput> {
  const checks = await ctx.db
    .query("checks")
    .withIndex("by_case", (q) => q.eq("caseId", c._id))
    .collect();
  const ev = (kind: Doc<"checks">["kind"]) =>
    (checks.find((ch) => ch.kind === kind)?.evidence ?? null) as Record<string, any> | null;

  const docType = ev("doc_type");
  const payee = ev("payee_known");
  const bank = ev("bank_match");
  const contact = ev("contact_match");
  const crs = ev("crs_identity");
  const duplicate = ev("duplicate");
  const receipt = ev("receipt_rules");

  const now = Date.now();
  const paid = await succeededPayments(ctx, c.orgId);
  const paidTodayCents = paid.filter((p) => p.at >= startOfTodayPT(now)).reduce((s, p) => s + p.amountCents, 0);
  const samePayeeLast7DaysCents = c.partyId
    ? paid
        .filter((p) => p.partyId === c.partyId && p.caseId !== c._id && p.at >= now - rules.splitPurchase.windowDays * DAY)
        .reduce((s, p) => s + p.amountCents, 0)
    : 0;

  const calls = await ctx.db
    .query("calls")
    .withIndex("by_case", (q) => q.eq("caseId", c._id))
    .collect();
  const callOutcome = calls.filter((cl) => cl.outcome !== null).pop()?.outcome ?? null;

  return {
    killSwitch: org.killSwitch,
    caseKind: c.kind,
    docKind: (docType?.docKind ?? "unknown") as DocKind,
    amountCents: c.amountCents,
    currency: c.currency,
    extractionConfidence: ev("extraction_confidence")?.confidence ?? 0,
    missingRequiredFields: ev("required_fields")?.missing ?? [],
    parserAgrees: ev("parser_crosscheck")?.agrees ?? null,
    payee: { known: payee?.known ?? false, firstPayment: payee?.firstPayment ?? true },
    crs: {
      identity: crs?.identity ?? "skipped",
      fraudScore: ev("crs_fraud_score")?.fraudScore ?? null,
      fraudAlert: crs?.fraudAlert ?? false,
      reversePhone: ev("crs_reverse_phone")?.reversePhone ?? "skipped",
    },
    changed: { bank: bank?.changed ?? false, phone: contact?.phone ?? false, emailDomain: contact?.emailDomain ?? false },
    duplicate: { invoice: duplicate?.invoice ?? false, receipt: duplicate?.receipt ?? false },
    injectionFound: ev("injection")?.found ?? false,
    receipt: receipt ? { itemized: receipt.itemized, disallowedItems: receipt.disallowedItems, ageDays: receipt.ageDays } : null,
    outflow: { paidTodayCents, samePayeeLast7DaysCents },
    call: { outcome: callOutcome },
    modelRecommendation: payee?.modelRecommendation ?? "NONE",
  };
}

const DECIDABLE = new Set(["checking", "awaiting_call", "awaiting_approval", "blocked"]);

export const decide = internalMutation({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const c = (await ctx.db.get(caseId))!;
    if (!DECIDABLE.has(c.status)) return;
    const org = (await ctx.db.get(c.orgId))!;
    const policy = (await ctx.db.get(org.activePolicyVersionId!))!;
    const rules = policy.rules as PolicyRules;

    const input = await buildInput(ctx, c, org, rules);
    const decision = evaluate(rules, input);

    // ASK always needs the owner, plus the accountant over the two-signature limit. This only adds signers.
    const requiredApprovals: ("owner" | "accountant")[] = [];
    if (decision.verdict === "ASK") {
      const roles = new Set(decision.requiredApprovals);
      roles.add("owner");
      if ((c.amountCents ?? 0) > rules.caps.accountantAboveCents) roles.add("accountant");
      requiredApprovals.push(...(["owner", "accountant"] as const).filter((r) => roles.has(r)));
    }
    let status: Doc<"cases">["status"];
    if (decision.verdict === "ALLOW") status = "paying";
    else if (decision.verdict === "ASK") status = "awaiting_approval";
    else status = decision.final || !decision.needsCall ? "blocked" : "awaiting_call";

    await ctx.db.patch(caseId, {
      verdict: decision.verdict,
      reasons: decision.reasons,
      ruleIds: decision.ruleIds,
      requiredApprovals,
      status,
    });
    await appendAction(ctx, {
      orgId: c.orgId,
      caseId,
      seat: "controller",
      kind: "gate_decided",
      summary: `${decision.verdict}${decision.final ? " (final)" : ""}: ${decision.reasons.join(" ") || "all checks passed."}`,
      data: { input, decision, policyVersion: policy.version },
      ruleIds: decision.ruleIds,
    });

    if (decision.verdict === "ALLOW") {
      await ctx.scheduler.runAfter(0, internal.payments.execute, { caseId });
    } else if (decision.verdict === "ASK") {
      const existing = await ctx.db
        .query("approvals")
        .withIndex("by_case", (q) => q.eq("caseId", caseId))
        .collect();
      for (const role of requiredApprovals) {
        if (existing.some((a) => a.role === role && a.status === "pending")) continue;
        await ctx.db.insert("approvals", { caseId, role, status: "pending", decidedBy: null, typedAmountCents: null, decidedAt: null });
        await appendAction(ctx, {
          orgId: c.orgId,
          caseId,
          seat: "controller",
          kind: "approval_requested",
          summary: `Waiting for the ${role} to approve.`,
          data: { role },
        });
      }
    }
    if (decision.needsCall && input.call.outcome === null) {
      await ctx.scheduler.runAfter(0, internal.calls.place, { caseId });
    }
    await ctx.scheduler.runAfter(0, internal.explain.write, { caseId });
  },
});
