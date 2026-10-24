// Verification seat: on-file diff, duplicates, CRS (allowlist only), injection scan, receipt rules,
// parser cross-check, and Claude's lookalike check (modelRecommendation, which can only add caution).
import { v, Infer } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { appendAction } from "./audit";
import { structured } from "./lib/claude";
import { CrsResult, personaForContact, runCrsChecks } from "./lib/crs";
import { bankFingerprint } from "./lib/hash";
import { PolicyRules } from "./lib/policy";
import { Extraction } from "./lib/schemas";
import { checkKind, checkResult } from "./schema";
import { VERIFY_SYSTEM_PROMPT, verifyJsonSchema } from "../prompts/verify";

const DAY = 24 * 60 * 60 * 1000;

export const inputs = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const c = (await ctx.db.get(caseId))!;
    const doc = (await ctx.db.get(c.documentId))!;
    const vendors = await ctx.db
      .query("parties")
      .withIndex("by_org_kind", (q) => q.eq("orgId", c.orgId).eq("kind", "vendor"))
      .collect();
    return {
      status: c.status,
      kind: c.kind,
      extracted: doc.extracted,
      vendorsOnFile: vendors.map((p) => ({ name: p.displayName, emailDomain: p.emailDomain })),
      crsLoginBlocked: (await ctx.db.query("crsLogin").first()) !== null,
    };
  },
});

export const recordCrsLoginFailure = internalMutation({
  args: { error: v.string() },
  handler: async (ctx, { error }) => {
    if (!(await ctx.db.query("crsLogin").first())) await ctx.db.insert("crsLogin", { failedAt: Date.now(), error });
  },
});

type Recommendation = { recommendation: "NONE" | "ASK" | "BLOCK"; reason: string };

export const run = internalAction({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }): Promise<null> => {
    const i = await ctx.runQuery(internal.verify.inputs, { caseId });
    if (i.status !== "checking" || !i.extracted) return null;
    const e = i.extracted;
    const payToFingerprint = e.payTo ? await bankFingerprint(e.payTo.routingNumber, e.payTo.accountNumber) : null;

    // CRS: the document's contact details only pick a persona; only that persona's stored bodies are sent.
    const personaId = personaForContact(e.contactPhone, e.contactEmail);
    const crs: CrsResult = await runCrsChecks(personaId, { loginBlocked: i.crsLoginBlocked });
    if (crs.status === "error" && crs.loginFailed) {
      await ctx.runMutation(internal.verify.recordCrsLoginFailure, { error: crs.error });
    }

    // Claude's lookalike check (no tools). A failure adds no caution and is logged.
    let model: Recommendation & { costUsd: number; error: string | null } = {
      recommendation: "NONE",
      reason: "Not a vendor invoice.",
      costUsd: 0,
      error: null,
    };
    if (i.kind === "vendor_payment") {
      try {
        const r = await structured<Recommendation>({
          system: VERIFY_SYSTEM_PROMPT,
          userText: JSON.stringify({
            payeeFromDocument: { name: e.vendorOrMerchantName, email: e.contactEmail, phone: e.contactPhone },
            vendorsOnFile: i.vendorsOnFile,
          }),
          schema: verifyJsonSchema,
          effort: "low",
        });
        model = r.ok ? { ...r.value, costUsd: r.costUsd, error: null } : { ...model, reason: "Check failed.", costUsd: r.costUsd, error: r.error };
      } catch (err) {
        model = { ...model, reason: "Check failed.", error: (err as Error).message.slice(0, 200) };
      }
    }

    await ctx.runMutation(internal.verify.record, {
      caseId,
      payToFingerprint,
      crs: { personaId, result: crs },
      model: { recommendation: model.recommendation, reason: model.reason, costUsd: model.costUsd, error: model.error },
    });
    return null;
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
  args: {
    caseId: v.id("cases"),
    payToFingerprint: v.union(v.string(), v.null()),
    crs: v.object({ personaId: v.union(v.string(), v.null()), result: v.any() }),
    model: v.object({
      recommendation: v.union(v.literal("NONE"), v.literal("ASK"), v.literal("BLOCK")),
      reason: v.string(),
      costUsd: v.number(),
      error: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, { caseId, payToFingerprint, crs: crsIn, model }) => {
    const crs = crsIn.result as CrsResult;
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
      evidence: { known, firstPayment, partyKey: party?.key ?? null, modelRecommendation: model.recommendation },
    });
    if (c.kind === "vendor_payment") {
      checks.push({
        kind: "payee_known",
        result: model.error ? "skipped" : model.recommendation === "NONE" ? "pass" : "warn",
        detail: model.error ? `Lookalike check failed: ${model.error}` : `Lookalike check: ${model.recommendation}. ${model.reason}`,
        evidence: { source: "claude", recommendation: model.recommendation, reason: model.reason, costUsd: model.costUsd },
      });
    }

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

    // CRS (R3). Runs only when the document's contact details exactly match an allowlisted persona.
    if (crs.status === "ok") {
      const failed = crs.identityMessages.filter((m) => m.code !== "2401").map((m) => m.text);
      checks.push({
        kind: "crs_identity",
        result: crs.identity === "pass" ? (crs.fraudAlert ? "warn" : "pass") : "fail",
        detail:
          crs.identity === "pass"
            ? `CRS identity verified${crs.fraudAlert ? ", but a fraud alert is on file" : ""}.`
            : `CRS identity failed: ${failed.join("; ") || "identity did not verify"}.`,
        evidence: { identity: crs.identity, fraudAlert: crs.fraudAlert, personaId: crs.personaId, messages: crs.identityMessages },
      });
      checks.push({
        kind: "crs_fraud_score",
        result: crs.fraudScore === null ? "skipped" : crs.fraudScore >= rules.crs.fraudScoreAskAt ? "fail" : "pass",
        detail: `CRS fraud score ${crs.fraudScore ?? "unavailable"}/100.`,
        evidence: { fraudScore: crs.fraudScore },
      });
      checks.push({
        kind: "crs_reverse_phone",
        result: crs.reversePhone === "mismatch" ? "fail" : crs.reversePhone === "match" ? "pass" : "skipped",
        detail:
          crs.reversePhone === "mismatch"
            ? `CRS: the phone number belongs to someone else (${crs.reverseNames.join(", ")}).`
            : crs.reversePhone === "match"
              ? "CRS: the phone number belongs to the payee."
              : "CRS: no record for this phone number.",
        evidence: { reversePhone: crs.reversePhone },
      });
    } else {
      const notNeeded = known && crsIn.personaId === null;
      checks.push({
        kind: "crs_identity",
        result: crs.status === "error" ? "warn" : "skipped",
        detail: notNeeded
          ? "Payee verified at onboarding and contact details unchanged; no CRS check needed."
          : crs.status === "error"
            ? `CRS check failed: ${crs.error}`
            : `CRS not run: ${crs.reason}.`,
        evidence: { identity: notNeeded ? "not_needed" : "skipped", fraudAlert: false },
      });
    }

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
    const windowStart = Date.now() - rules.duplicates.receiptWindowDays * DAY;
    let receiptDup =
      e.docKind === "receipt" && sameFile.some((d) => d._id !== doc._id && d.orgId === c.orgId && d._creationTime > windowStart);
    if (e.docKind === "receipt" && !receiptDup && e.totalCents !== null && e.issueDate && e.vendorOrMerchantName) {
      const orgCases = await ctx.db
        .query("cases")
        .withIndex("by_org_status", (q) => q.eq("orgId", c.orgId))
        .collect();
      for (const o of orgCases) {
        if (o._id === caseId || o._creationTime < windowStart) continue;
        const od = (await ctx.db.get(o.documentId))?.extracted;
        if (
          od?.docKind === "receipt" &&
          od.totalCents === e.totalCents &&
          od.issueDate === e.issueDate &&
          od.vendorOrMerchantName !== null &&
          normalizeName(od.vendorOrMerchantName) === normalizeName(e.vendorOrMerchantName)
        ) {
          receiptDup = true;
          break;
        }
      }
    }
    checks.push({
      kind: "duplicate",
      result: invoiceDup || receiptDup ? "fail" : "pass",
      detail: invoiceDup
        ? `Invoice ${c.invoiceNumber} from this payee was already submitted.`
        : receiptDup
          ? "This receipt (same file, or same amount, date and merchant) was already submitted."
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

    if (crs.status !== "skipped") {
      await appendAction(ctx, {
        orgId: c.orgId,
        caseId,
        seat: "verification",
        kind: "crs_called",
        summary:
          crs.status === "ok"
            ? `CRS checks for persona ${crs.personaId}: identity ${crs.identity}, fraud score ${crs.fraudScore ?? "n/a"}, reverse phone ${crs.reversePhone}.`
            : `CRS call failed: ${crs.error}`,
        data: crs,
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
