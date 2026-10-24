// Verification seat. Tonight: on-file diff, duplicates, injection, receipt rules, parser cross-check.
// Still to come (Fri 10 PM block): CRS through the allowlist, receipt amount+date+merchant duplicates,
// and Claude's fuzzy match (modelRecommendation).
import { v, Infer } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { appendAction } from "./audit";
import { bankFingerprint } from "./lib/hash";
import { PolicyRules } from "./lib/policy";
import { Extraction } from "./lib/schemas";
import { checkKind, checkResult } from "./schema";

const DAY = 24 * 60 * 60 * 1000;

export const payTo = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const c = (await ctx.db.get(caseId))!;
    const doc = (await ctx.db.get(c.documentId))!;
    return { status: c.status, payTo: doc.extracted?.payTo ?? null };
  },
});

export const run = internalAction({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const { status, payTo } = await ctx.runQuery(internal.verify.payTo, { caseId });
    if (status !== "checking") return;
    const payToFingerprint = payTo ? await bankFingerprint(payTo.routingNumber, payTo.accountNumber) : null;
    await ctx.runMutation(internal.verify.record, { caseId, payToFingerprint });
  },
});

const normalizeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const digits = (s: string) => s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
const domainOf = (email: string) => email.split("@")[1]?.toLowerCase() ?? "";

function missingRequired(e: Extraction, rules: PolicyRules): string[] {
  const required = rules.requiredFields[e.docKind] ?? [];
  return required.filter((f) => {
    const value = (e as Record<string, unknown>)[f];
    return value === null || value === undefined || value === "";
  });
}

function parserComparison(e: Extraction, p: Doc<"documents">["parserFields"]) {
  if (!p) return { agrees: null, mismatches: [] as string[] };
  const mismatches: string[] = [];
  if (p.totalCents !== null && p.totalCents !== e.totalCents) mismatches.push("totalCents");
  if (p.routingNumber !== null && p.routingNumber !== e.payTo?.routingNumber) mismatches.push("routingNumber");
  if (p.accountNumber !== null && p.accountNumber !== e.payTo?.accountNumber) mismatches.push("accountNumber");
  if (p.invoiceNumber !== null && p.invoiceNumber.toUpperCase() !== e.invoiceNumber?.toUpperCase())
    mismatches.push("invoiceNumber");
  return { agrees: mismatches.length === 0, mismatches };
}

type Check = {
  kind: Infer<typeof checkKind>;
  result: Infer<typeof checkResult>;
  detail: string;
  evidence: Record<string, unknown>;
};

export const record = internalMutation({
  args: { caseId: v.id("cases"), payToFingerprint: v.union(v.string(), v.null()) },
  handler: async (ctx, { caseId, payToFingerprint }) => {
    const c = (await ctx.db.get(caseId))!;
    if (c.status !== "checking") return;
    const doc = (await ctx.db.get(c.documentId))!;
    const org = (await ctx.db.get(c.orgId))!;
    const rules = (await ctx.db.get(org.activePolicyVersionId!))!.rules as PolicyRules;
    const e = doc.extracted!;
    const checks: Check[] = [];

    // Extraction quality (R0)
    checks.push({
      kind: "extraction_confidence",
      result: e.confidence >= rules.minExtractionConfidence ? "pass" : "warn",
      detail: `Extraction confidence ${e.confidence.toFixed(2)} (minimum ${rules.minExtractionConfidence}).`,
      evidence: { confidence: e.confidence },
    });
    const missing = missingRequired(e, rules);
    checks.push({
      kind: "required_fields",
      result: missing.length ? "fail" : "pass",
      detail: missing.length ? `Missing: ${missing.join(", ")}.` : "All required fields present.",
      evidence: { missing },
    });
    checks.push({
      kind: "doc_type",
      result: rules.knownDocKinds.includes(e.docKind) ? "pass" : "warn",
      detail: `Document kind: ${e.docKind}; currency ${e.currency}.`,
      evidence: { docKind: e.docKind, currency: e.currency },
    });
    const parser = parserComparison(e, doc.parserFields);
    checks.push({
      kind: "parser_crosscheck",
      result: parser.agrees === null ? "skipped" : parser.agrees ? "pass" : "fail",
      detail:
        parser.agrees === null
          ? "No PDF text layer to cross-check."
          : parser.agrees
            ? "PDF text layer agrees with the extraction."
            : `PDF text layer disagrees on ${parser.mismatches.join(", ")}.`,
      evidence: { agrees: parser.agrees, mismatches: parser.mismatches, parserFields: doc.parserFields },
    });

    // Payee (R1): employees come from the case; vendors by exact normalized name or exact email.
    let party: Doc<"parties"> | null = c.partyId ? await ctx.db.get(c.partyId) : null;
    if (!party && c.kind === "vendor_payment") {
      const vendors = await ctx.db
        .query("parties")
        .withIndex("by_org_kind", (q) => q.eq("orgId", c.orgId).eq("kind", "vendor"))
        .collect();
      const name = e.vendorOrMerchantName ? normalizeName(e.vendorOrMerchantName) : null;
      const email = e.contactEmail?.toLowerCase() ?? null;
      party =
        vendors.find((p) => name !== null && normalizeName(p.displayName) === name) ??
        vendors.find((p) => email !== null && p.email.toLowerCase() === email) ??
        null;
      if (party) await ctx.db.patch(caseId, { partyId: party._id });
    }
    const known = party !== null;
    const firstPayment = !party || party.firstPaidAt === null;
    checks.push({
      kind: "payee_known",
      result: known && !firstPayment ? "pass" : "warn",
      detail: party
        ? `Payee on file: ${party.displayName}${firstPayment ? " (never paid)" : ""}.`
        : `"${e.vendorOrMerchantName ?? "unknown"}" is not on file.`,
      evidence: { known, firstPayment, partyKey: party?.key ?? null, modelRecommendation: "NONE" },
    });

    // Detail changes (R2), vendors only
    const changed = { bank: false, phone: false, emailDomain: false };
    if (party && party.kind === "vendor") {
      changed.bank = payToFingerprint !== null && party.bankOnFile !== null && payToFingerprint !== party.bankOnFile.fingerprint;
      changed.phone = e.contactPhone !== null && digits(e.contactPhone) !== digits(party.phoneOnFile);
      changed.emailDomain = e.contactEmail !== null && domainOf(e.contactEmail) !== party.emailDomain;
      checks.push({
        kind: "bank_match",
        result: changed.bank ? "fail" : payToFingerprint === null ? "skipped" : "pass",
        detail: changed.bank
          ? `Bank account differs from the one on file (••${party.bankOnFile!.accountLast4}).`
          : payToFingerprint === null
            ? "No bank details on the document."
            : "Bank account matches the one on file.",
        evidence: { changed: changed.bank },
      });
      checks.push({
        kind: "contact_match",
        result: changed.phone || changed.emailDomain ? "fail" : "pass",
        detail:
          [changed.phone && "phone number differs from the one on file", changed.emailDomain && "email domain differs from the one on file"]
            .filter(Boolean)
            .join("; ") || "Contact details match the record on file.",
        evidence: { phone: changed.phone, emailDomain: changed.emailDomain },
      });
    }

    // CRS (R3): the allowlisted client lands tonight; until then unknown payees are "skipped".
    const identity = known ? "not_needed" : "skipped";
    checks.push({
      kind: "crs_identity",
      result: "skipped",
      detail: known ? "Payee verified at onboarding; no CRS check needed." : "CRS not run (client not wired yet).",
      evidence: { identity, fraudScore: null, fraudAlert: false, reversePhone: "skipped" },
    });

    // Duplicates (R6)
    let invoiceDup = false;
    if (party && c.invoiceNumber) {
      const others = await ctx.db
        .query("cases")
        .withIndex("by_org_status", (q) => q.eq("orgId", c.orgId))
        .collect();
      invoiceDup = others.some(
        (o) => o._id !== caseId && o.partyId === party._id && o.invoiceNumber?.toUpperCase() === c.invoiceNumber!.toUpperCase(),
      );
    }
    const sameFile = await ctx.db
      .query("documents")
      .withIndex("by_sha256", (q) => q.eq("sha256", doc.sha256))
      .collect();
    const receiptDup =
      e.docKind === "receipt" &&
      sameFile.some(
        (d) => d._id !== doc._id && d.orgId === c.orgId && d._creationTime > Date.now() - rules.duplicates.receiptWindowDays * DAY,
      );
    checks.push({
      kind: "duplicate",
      result: invoiceDup || receiptDup ? "fail" : "pass",
      detail: invoiceDup
        ? `Invoice ${c.invoiceNumber} from this payee was already submitted.`
        : receiptDup
          ? "This exact receipt file was already submitted."
          : "No duplicate found.",
      evidence: { invoice: invoiceDup, receipt: receiptDup },
    });

    // Injection (R7): Claude's findings merged with the parser's regex scan
    const injectionFound = e.suspiciousInstructions.length > 0 || doc.injectionFindings.length > 0;
    checks.push({
      kind: "injection",
      result: injectionFound ? "fail" : "pass",
      detail: injectionFound
        ? `Text aimed at an AI found: "${(e.suspiciousInstructions[0] ?? doc.injectionFindings[0].text).slice(0, 120)}".`
        : "No instructions aimed at an AI.",
      evidence: { found: injectionFound, claude: e.suspiciousInstructions, parser: doc.injectionFindings },
    });

    // Receipt rules (R8), reimbursements only
    if (c.kind === "reimbursement") {
      const disallowedItems = e.lineItems
        .filter((li) => rules.reimbursements.disallowedCategories.includes(li.category))
        .map((li) => li.description);
      const issued = e.issueDate ? Date.parse(`${e.issueDate}T12:00:00Z`) : NaN;
      const ageDays = Number.isNaN(issued) ? null : Math.floor((Date.now() - issued) / DAY);
      const bad =
        (rules.reimbursements.requireItemized && e.itemized !== true) ||
        disallowedItems.length > 0 ||
        (ageDays !== null && ageDays > rules.reimbursements.maxAgeDays);
      checks.push({
        kind: "receipt_rules",
        result: bad ? "fail" : "pass",
        detail: `Itemized: ${e.itemized ?? "unknown"}; disallowed items: ${disallowedItems.join(", ") || "none"}; age: ${ageDays ?? "unknown"} days.`,
        evidence: { itemized: e.itemized, disallowedItems, ageDays },
      });
    }

    for (const check of checks) {
      await ctx.db.insert("checks", { caseId, ...check, seat: "verification" });
      await appendAction(ctx, {
        orgId: c.orgId,
        caseId,
        seat: "verification",
        kind: "check_ran",
        summary: `${check.kind}: ${check.result}. ${check.detail}`,
        data: { kind: check.kind, result: check.result, evidence: check.evidence },
      });
    }
    await ctx.scheduler.runAfter(0, internal.gateRun.decide, { caseId });
  },
});
