// Payments clerk: plain code, no model. The ONLY caller of Nessie transfers.
// Runs only for ALLOW, or ASK with every required approval given; re-checks the kill switch right before sending.
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { appendAction } from "./audit";
import { sha256Hex } from "./lib/hash";
import { createTransfer, findTransferByTag } from "./lib/nessie";

const MAX_ATTEMPTS = 3;

export const load = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const c = (await ctx.db.get(caseId))!;
    return { partyId: c.partyId, amountCents: c.amountCents };
  },
});

// Validates the gate result and claims the payment row (unique per idempotency key).
export const begin = internalMutation({
  args: { caseId: v.id("cases"), idempotencyKey: v.string() },
  handler: async (ctx, { caseId, idempotencyKey }) => {
    const c = (await ctx.db.get(caseId))!;
    const org = (await ctx.db.get(c.orgId))!;
    const refuse = async (why: string) => {
      await appendAction(ctx, { orgId: c.orgId, caseId, seat: "payments", kind: "payment_failed", summary: `Not paying: ${why}` });
      return null;
    };

    if (c.status !== "paying") return await refuse(`case is ${c.status}, not paying.`);
    const approvals = await ctx.db
      .query("approvals")
      .withIndex("by_case", (q) => q.eq("caseId", caseId))
      .collect();
    const approved = c.verdict === "ASK" && approvals.length > 0 && approvals.every((a) => a.status === "approved");
    if (c.verdict !== "ALLOW" && !approved) return await refuse(`gate verdict is ${c.verdict} without all approvals.`);
    if (org.killSwitch) {
      await ctx.db.patch(caseId, { status: "blocked", reasons: [...c.reasons, "All payments are frozen by the owner."] });
      return await refuse("kill switch is on.");
    }
    if (c.amountCents === null || c.amountCents <= 0) return await refuse("no positive amount.");
    const party = c.partyId ? await ctx.db.get(c.partyId) : null;
    if (!party?.nessieAccountId) return await refuse("payee has no account on file.");

    let payment = await ctx.db
      .query("payments")
      .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
      .unique();
    if (payment?.status === "succeeded") {
      await ctx.db.patch(caseId, { status: "paid" });
      return null;
    }
    // One attempt at a time: a pending row means an attempt is in flight (or died mid-send), so a second
    // execute must not send in parallel. Retries come only from `fail`, which sets the row to failed first.
    if (payment?.status === "pending") return null;
    if (!payment) {
      const id = await ctx.db.insert("payments", {
        caseId,
        idempotencyKey,
        amountCents: c.amountCents,
        payeeNessieAccountId: party.nessieAccountId,
        tag: `QT-${idempotencyKey.slice(0, 12)}`,
        nessieTransferId: null,
        status: "pending",
        attempts: 0,
        lastError: null,
        succeededAt: null,
      });
      payment = (await ctx.db.get(id))!;
    }
    const attempt = payment.attempts + 1;
    await ctx.db.patch(payment._id, { attempts: attempt, status: "pending" });
    await appendAction(ctx, {
      orgId: c.orgId,
      caseId,
      seat: "payments",
      kind: attempt === 1 ? "payment_started" : "payment_retried",
      summary: `${attempt === 1 ? "Sending" : `Retrying (attempt ${attempt})`} $${(c.amountCents / 100).toFixed(2)} to ${party.displayName}, tag ${payment.tag}.`,
      data: { paymentId: payment._id, attempt },
    });
    return {
      paymentId: payment._id,
      orgId: c.orgId,
      tag: payment.tag,
      fromAccountId: org.nessieAccountId,
      toAccountId: party.nessieAccountId,
      amountCents: c.amountCents,
      memo: `${party.displayName} ${c.invoiceNumber ?? ""}`.trim(),
      attempt,
      faultInjection: c.faultInjection,
      sentTransferId: payment.nessieTransferId,
    };
  },
});

// Written the moment Nessie answers, so a later failure (the succeed mutation, a crash) can't lose the transfer.
export const recordSent = internalMutation({
  args: { paymentId: v.id("payments"), nessieTransferId: v.string() },
  handler: async (ctx, { paymentId, nessieTransferId }) => {
    await ctx.db.patch(paymentId, { nessieTransferId });
  },
});

export const succeed = internalMutation({
  args: { caseId: v.id("cases"), paymentId: v.id("payments"), nessieTransferId: v.string(), foundByTag: v.boolean() },
  handler: async (ctx, { caseId, paymentId, nessieTransferId, foundByTag }) => {
    const c = (await ctx.db.get(caseId))!;
    const now = Date.now();
    await ctx.db.patch(paymentId, { status: "succeeded", nessieTransferId, lastError: null, succeededAt: now });
    await ctx.db.patch(caseId, { status: "paid" });
    if (c.partyId) {
      const party = (await ctx.db.get(c.partyId))!;
      if (party.firstPaidAt === null) await ctx.db.patch(party._id, { firstPaidAt: now });
    }
    await appendAction(ctx, {
      orgId: c.orgId,
      caseId,
      seat: "payments",
      kind: "payment_succeeded",
      summary: foundByTag
        ? `Found the transfer already sent (${nessieTransferId}); not sending again.`
        : `Paid. Nessie transfer ${nessieTransferId}.`,
      data: { paymentId, nessieTransferId, foundByTag },
    });
  },
});

export const fail = internalMutation({
  args: { caseId: v.id("cases"), paymentId: v.id("payments"), error: v.string(), retry: v.boolean() },
  handler: async (ctx, { caseId, paymentId, error, retry }) => {
    const c = (await ctx.db.get(caseId))!;
    await ctx.db.patch(paymentId, { status: "failed", lastError: error });
    if (!retry) await ctx.db.patch(caseId, { status: "failed" });
    await appendAction(ctx, {
      orgId: c.orgId,
      caseId,
      seat: "payments",
      kind: "payment_failed",
      summary: `Payment attempt failed: ${error.slice(0, 200)}.${retry ? " Will retry." : ""}`,
      data: { paymentId, error },
    });
    if (retry) await ctx.scheduler.runAfter(2000, internal.payments.execute, { caseId });
  },
});

export const execute = internalAction({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const { partyId, amountCents } = await ctx.runQuery(internal.payments.load, { caseId });
    const idempotencyKey = await sha256Hex(`${caseId}${partyId}${amountCents}`);
    const p = await ctx.runMutation(internal.payments.begin, { caseId, idempotencyKey });
    if (!p) return;

    try {
      // Our own record first, then Nessie by tag; send only if neither has it.
      let transferId = p.sentTransferId ?? (await findTransferByTag(p.fromAccountId, p.tag, p.amountCents));
      const foundByTag = transferId !== null;
      if (!transferId) {
        if (await ctx.runQuery(internal.orgs.killSwitchOn, { orgId: p.orgId })) {
          throw new Error("kill switch turned on before sending");
        }
        transferId = await createTransfer({
          fromAccountId: p.fromAccountId,
          toAccountId: p.toAccountId,
          amountCents: p.amountCents,
          tag: p.tag,
          memo: p.memo,
        });
        // Demo toggle (DEMO-2): crash after Nessie succeeded but before we recorded it, so the retry must find it by tag.
        if (p.faultInjection && p.attempt === 1) throw new Error("injected fault after the transfer was sent");
        await ctx.runMutation(internal.payments.recordSent, { paymentId: p.paymentId, nessieTransferId: transferId });
      }
      await ctx.runMutation(internal.payments.succeed, { caseId, paymentId: p.paymentId, nessieTransferId: transferId, foundByTag });
    } catch (e) {
      const error = (e as Error).message;
      const retry = p.attempt < MAX_ATTEMPTS && !error.startsWith("kill switch");
      await ctx.runMutation(internal.payments.fail, { caseId, paymentId: p.paymentId, error, retry });
    }
  },
});
