// Seed data: docs/eval-cases.md "Seed data". Everything here is SYNTHETIC.
// Run once per deployment: npx convex run seed:run
import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { appendAction } from "./audit";
import { bankFingerprint } from "./lib/hash";
import { createCheckingAccount, createCustomer } from "./lib/nessie";
import { defaultRules } from "./lib/policy";

const DAY = 24 * 60 * 60 * 1000;

export const BUSINESS_NAME = "Bluefin Print & Design (SYNTHETIC)";

// Full bank numbers live only here (the factory renders "on file" invoices from them).
// Routing numbers start with 99, which no real bank uses. Domains are RFC 2606 .example.
export const SEED_PARTIES = [
  {
    key: "lanternfish",
    kind: "vendor",
    displayName: "Lanternfish Paper Supply",
    legalName: "Mara Lindqvist (SYNTHETIC)",
    email: "orders@lanternfishpaper.example",
    phone: null, // DEMO_VENDOR_PHONE: Josiah plays this vendor
    bank: { routingNumber: "990000421", accountNumber: "7310020421" },
  },
  {
    key: "paperkite",
    kind: "vendor",
    displayName: "Paperkite Couriers",
    legalName: "Theo Okafor (SYNTHETIC)",
    email: "billing@paperkitecouriers.example",
    phone: "+1 (415) 555-0142",
    bank: { routingNumber: "990001187", accountNumber: "5520031187" },
  },
  {
    key: "saltmarsh",
    kind: "vendor",
    displayName: "Saltmarsh Cleaning Services",
    legalName: "Ines Calloway (SYNTHETIC)",
    email: "accounts@saltmarshcleaning.example",
    phone: "+1 (510) 555-0167",
    bank: { routingNumber: "990002254", accountNumber: "8840042254" },
  },
  {
    key: "kestrel",
    kind: "vendor",
    displayName: "Kestrel Signs",
    legalName: "Ruben Achterberg (SYNTHETIC)",
    email: "hello@kestrelsigns.example",
    phone: "+1 (510) 555-0183",
    bank: { routingNumber: "990003390", accountNumber: "6650053390" },
  },
  ...(["A", "B", "C", "D"] as const).map((letter, i) => ({
    key: `employee${letter}`,
    kind: "employee" as const,
    displayName: `Employee ${letter} (SYNTHETIC)`,
    legalName: `Employee ${letter} (SYNTHETIC)`,
    email: `employee.${letter.toLowerCase()}@bluefinprint.example`,
    phone: `+1 (415) 555-01${20 + i}`,
    bank: null,
  })),
] as const;

const KESTREL_PRIOR = { invoiceNumber: "KS-1041", amountCents: 45000, daysAgo: 3 };

const partyArg = v.object({
  key: v.string(),
  kind: v.union(v.literal("vendor"), v.literal("employee")),
  displayName: v.string(),
  legalName: v.string(),
  email: v.string(),
  phoneOnFile: v.string(),
  callTargetPhone: v.union(v.string(), v.null()),
  bankOnFile: v.union(v.object({ routingLast4: v.string(), accountLast4: v.string(), fingerprint: v.string() }), v.null()),
  nessieAccountId: v.string(),
});

export const hasPrimaryOrg = internalQuery({
  args: {},
  handler: async (ctx) => {
    const org = await ctx.db
      .query("orgs")
      .filter((q) => q.eq(q.field("isEval"), false))
      .first();
    return org !== null;
  },
});

// Creates Nessie customers + checking accounts, then the org. Nessie data is public: names are synthetic.
// evals.run passes isEval: true for a fresh org per run, so caps and duplicates don't leak between runs.
export const run = internalAction({
  args: { isEval: v.optional(v.boolean()) },
  handler: async (ctx, { isEval }): Promise<Id<"orgs">> => {
    if (!isEval && (await ctx.runQuery(internal.seed.hasPrimaryOrg, {}))) {
      throw new Error("Already seeded. Clear the tables in the dashboard to re-seed.");
    }
    const nonce = Math.random().toString(36).slice(2, 6).toUpperCase();
    const demoPhone = process.env.DEMO_VENDOR_PHONE ?? null;

    const businessCustomer = await createCustomer("Bluefin Print and Design", `SYNTHETIC ${nonce}`);
    const businessAccount = await createCheckingAccount(businessCustomer, `Bluefin operating ${nonce}`, 50000);

    const parties = [];
    for (const p of SEED_PARTIES) {
      const customer = await createCustomer(p.displayName, `SYNTHETIC ${nonce}`);
      const account = await createCheckingAccount(customer, `${p.key} ${nonce}`, 0);
      parties.push({
        key: p.key,
        kind: p.kind,
        displayName: p.displayName,
        legalName: p.legalName,
        email: p.email,
        phoneOnFile: p.phone ?? demoPhone ?? "+1 (415) 555-0101",
        callTargetPhone: p.key === "lanternfish" ? demoPhone : null,
        bankOnFile: p.bank
          ? {
              routingLast4: p.bank.routingNumber.slice(-4),
              accountLast4: p.bank.accountNumber.slice(-4),
              fingerprint: await bankFingerprint(p.bank.routingNumber, p.bank.accountNumber),
            }
          : null,
        nessieAccountId: account,
      });
    }

    const placeholder = await ctx.storage.store(
      new Blob([`SYNTHETIC TEST DOCUMENT · Quintet demo\nKestrel Signs invoice ${KESTREL_PRIOR.invoiceNumber}, $450.00`], {
        type: "text/plain",
      }),
    );
    const orgId: Id<"orgs"> = await ctx.runMutation(internal.seed.createOrg, {
      name: isEval ? `${BUSINESS_NAME} (eval)` : BUSINESS_NAME,
      isEval: isEval ?? false,
      nessieAccountId: businessAccount,
      parties,
      placeholderStorageId: placeholder,
    });
    console.log(`Seeded org ${orgId}; Nessie business account ${businessAccount}; demo phone ${demoPhone ? "set" : "NOT set"}`);
    return orgId;
  },
});

// Also used by evals.run to build a fresh eval org with the same parties and Nessie accounts.
export const createOrg = internalMutation({
  args: {
    name: v.string(),
    isEval: v.boolean(),
    nessieAccountId: v.string(),
    parties: v.array(partyArg),
    placeholderStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const orgId = await ctx.db.insert("orgs", {
      name: args.name,
      killSwitch: false,
      activePolicyVersionId: null,
      isEval: args.isEval,
      nessieAccountId: args.nessieAccountId,
    });
    const policyId = await ctx.db.insert("policyVersions", {
      orgId,
      version: 1,
      rules: defaultRules,
      source: "manual",
      createdBy: "seed",
      approvedBy: "seed",
      approvedAt: now,
      diffSummary: null,
      testsPassed: null,
    });
    await ctx.db.patch(orgId, { activePolicyVersionId: policyId });
    await appendAction(ctx, {
      orgId,
      caseId: null,
      seat: "system",
      kind: "policy_version_created",
      summary: "Policy v1 created from the default rules.",
      data: { policyVersionId: policyId, version: 1 },
    });

    let kestrelId: Id<"parties"> | null = null;
    for (const p of args.parties) {
      const id = await ctx.db.insert("parties", {
        ...p,
        orgId,
        emailDomain: p.email.split("@")[1],
        crsPersonaId: null,
        crsStatus: "passed", // verified at onboarding
        firstPaidAt: now - 90 * DAY,
      });
      if (p.key === "kestrel") kestrelId = id;
    }

    // E23 needs a paid $450 Kestrel invoice from 3 days ago.
    if (kestrelId) {
      const kestrel = (await ctx.db.get(kestrelId))!;
      const documentId = await ctx.db.insert("documents", {
        orgId,
        storageId: args.placeholderStorageId,
        fileName: `kestrel-${KESTREL_PRIOR.invoiceNumber}.txt`,
        mimeType: "text/plain",
        sha256: `seed-kestrel-${KESTREL_PRIOR.invoiceNumber}`,
        kind: "invoice",
        source: "console",
        extracted: null,
        parserFields: null,
        injectionFindings: [],
      });
      const caseId = await ctx.db.insert("cases", {
        orgId,
        documentId,
        kind: "vendor_payment",
        partyId: kestrelId,
        amountCents: KESTREL_PRIOR.amountCents,
        currency: "USD",
        invoiceNumber: KESTREL_PRIOR.invoiceNumber,
        status: "paid",
        verdict: "ALLOW",
        reasons: ["Seeded: paid before this demo started."],
        ruleIds: [],
        requiredApprovals: [],
        explanation: null,
        evalCaseId: null,
        faultInjection: false,
        simulatedCallOutcome: null,
      });
      await ctx.db.insert("payments", {
        caseId,
        idempotencyKey: `seed-kestrel-${orgId}`,
        amountCents: KESTREL_PRIOR.amountCents,
        payeeNessieAccountId: kestrel.nessieAccountId!,
        tag: "QT-seed",
        nessieTransferId: null,
        status: "succeeded",
        attempts: 1,
        lastError: null,
        succeededAt: now - KESTREL_PRIOR.daysAgo * DAY,
      });
      await appendAction(ctx, {
        orgId,
        caseId,
        seat: "system",
        kind: "case_created",
        summary: `Seeded prior payment: Kestrel Signs ${KESTREL_PRIOR.invoiceNumber}, $450.00, ${KESTREL_PRIOR.daysAgo} days ago.`,
      });
    }
    return orgId;
  },
});

// The console's Reset button between judges: a fresh business (empty caps, no duplicates) replaces the live one.
// The old org is kept but retired, so its audit log is not lost.
export const swapPrimary = internalMutation({
  args: { newOrgId: v.id("orgs") },
  handler: async (ctx, { newOrgId }) => {
    for (const o of await ctx.db.query("orgs").filter((q) => q.eq(q.field("isEval"), false)).collect()) {
      await ctx.db.patch(o._id, { isEval: true, name: `${o.name} (retired)` });
    }
    await ctx.db.patch(newOrgId, { isEval: false, name: BUSINESS_NAME });
  },
});

export const resetDemo = action({
  args: {},
  handler: async (ctx) => {
    const newOrgId: Id<"orgs"> = await ctx.runAction(internal.seed.run, { isEval: true });
    await ctx.runMutation(internal.seed.swapPrimary, { newOrgId });
  },
});
