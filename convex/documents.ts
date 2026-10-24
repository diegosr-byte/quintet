import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { appendAction } from "./audit";
import { primaryOrg } from "./orgs";
import { callOutcome, docKind, extraction, parserFields } from "./schema";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

const ingestArgs = {
  storageId: v.id("_storage"),
  source: v.union(v.literal("upload"), v.literal("console"), v.literal("eval")),
  fileName: v.string(),
  mimeType: v.string(),
  kind: v.optional(docKind),
  evalCaseId: v.optional(v.string()),
  // Required for reimbursements: the employee being reimbursed.
  submittedByPartyKey: v.optional(v.string()),
};

async function createCase(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
  args: {
    storageId: Id<"_storage">;
    source: "upload" | "console" | "eval";
    fileName: string;
    mimeType: string;
    kind?: "invoice" | "receipt" | "email" | "credit_note" | "unknown";
    evalCaseId?: string;
    submittedByPartyKey?: string;
    simulatedCallOutcome?: "confirmed_change" | "denied_change" | "unclear" | "no_answer" | null;
  },
): Promise<Id<"cases">> {
  let partyId: Id<"parties"> | null = null;
  if (args.submittedByPartyKey) {
    const party = await ctx.db
      .query("parties")
      .withIndex("by_org_key", (q) => q.eq("orgId", orgId).eq("key", args.submittedByPartyKey!))
      .unique();
    if (!party || party.kind !== "employee") throw new Error(`Unknown employee ${args.submittedByPartyKey}`);
    partyId = party._id;
  }

  const documentId = await ctx.db.insert("documents", {
    orgId,
    storageId: args.storageId,
    fileName: args.fileName,
    mimeType: args.mimeType,
    sha256: "",
    kind: args.kind ?? "unknown",
    source: args.source,
    extracted: null,
    parserFields: null,
    injectionFindings: [],
  });
  const caseId = await ctx.db.insert("cases", {
    orgId,
    documentId,
    kind: partyId ? "reimbursement" : "vendor_payment",
    partyId,
    amountCents: null,
    currency: "USD",
    invoiceNumber: null,
    status: "received",
    verdict: null,
    reasons: [],
    ruleIds: [],
    requiredApprovals: [],
    explanation: null,
    evalCaseId: args.evalCaseId ?? null,
    faultInjection: false,
    simulatedCallOutcome: args.simulatedCallOutcome ?? null,
  });
  await appendAction(ctx, {
    orgId,
    caseId,
    seat: "intake",
    kind: "case_created",
    summary: `Received ${args.fileName} (${args.source}).`,
    data: { documentId, mimeType: args.mimeType },
  });
  await ctx.scheduler.runAfter(0, internal.intakeNode.extract, { caseId });
  return caseId;
}

export const ingest = mutation({
  args: ingestArgs,
  handler: async (ctx, args) => {
    const org = await primaryOrg(ctx);
    return await createCase(ctx, org._id, args);
  },
});

// evals.run ingests into its own eval org.
export const ingestForOrg = internalMutation({
  args: { orgId: v.id("orgs"), simulatedCallOutcome: v.union(callOutcome, v.null()), ...ingestArgs },
  handler: async (ctx, { orgId, ...args }) => await createCase(ctx, orgId, args),
});

export const forIntake = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const c = await ctx.db.get(caseId);
    if (!c) throw new Error("case not found");
    const doc = (await ctx.db.get(c.documentId))!;
    return { case: c, document: doc };
  },
});

export const saveExtraction = internalMutation({
  args: {
    caseId: v.id("cases"),
    sha256: v.string(),
    extracted: extraction,
    parserFields: v.union(parserFields, v.null()),
    injectionFindings: v.array(v.object({ text: v.string(), where: v.string() })),
    costUsd: v.number(),
  },
  handler: async (ctx, args) => {
    const c = (await ctx.db.get(args.caseId))!;
    await ctx.db.patch(c.documentId, {
      sha256: args.sha256,
      kind: args.extracted.docKind,
      extracted: args.extracted,
      parserFields: args.parserFields,
      injectionFindings: args.injectionFindings,
    });
    await ctx.db.patch(args.caseId, {
      amountCents: args.extracted.totalCents,
      currency: args.extracted.currency,
      invoiceNumber: args.extracted.invoiceNumber,
      status: "checking",
    });
    const e = args.extracted;
    const amount = e.totalCents === null ? "no amount" : `${e.currency} ${(e.totalCents / 100).toFixed(2)}`;
    await appendAction(ctx, {
      orgId: c.orgId,
      caseId: args.caseId,
      seat: "intake",
      kind: "extracted",
      summary: `Read a ${e.docKind} from ${e.vendorOrMerchantName ?? "an unknown sender"}: ${amount}, confidence ${e.confidence.toFixed(2)}.`,
      data: { extracted: e, parserFields: args.parserFields, costUsd: args.costUsd },
    });
  },
});
