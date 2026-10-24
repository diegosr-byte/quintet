"use client";

// Policy: the active rules in plain English (written from the live parameters, so they always match
// what the gate enforces), plus the version history.
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowLeft, CircleCheck, CircleX, ExternalLink } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import type { PolicyRules, Verdict } from "@/convex/lib/policy";
import { AgentAvatar } from "@/components/agents";
import { formatCents, SyntheticBadge, VerdictBadge } from "@/components/case-ui";

const SOURCE_URL = "https://www.glitter.io/blog/process-documentation/expense-reimbursement-policy";

const FIELD_NAMES: Record<string, string> = {
  vendorOrMerchantName: "who it's from",
  invoiceNumber: "invoice number",
  totalCents: "total",
  payTo: "where to pay",
  issueDate: "date",
  bank: "bank account",
  phone: "phone number",
  emailDomain: "email domain",
  gift_card: "gift cards",
};

const list = (items: string[], joiner: "and" | "or" = "and", plural = false) => {
  const named = items.map((i) => (FIELD_NAMES[i] ?? i.replace(/_/g, " ")) + (plural ? "s" : ""));
  return named.length <= 1 ? named.join("") : `${named.slice(0, -1).join(", ")} ${joiner} ${named.at(-1)}`;
};

type Rule = { id: string; title: string; text: string; verdict: Verdict | "MIXED" };

function describe(r: PolicyRules): Rule[] {
  const money = (c: number) => formatCents(c, r.currency).replace(/\.00$/, "");
  return [
    {
      id: "R0",
      title: "Clean, complete documents",
      text: `A person checks anything Ivy reads with under ${Math.round(r.minExtractionConfidence * 100)}% confidence, anything other than ${list(r.knownDocKinds, "or", true)}, anything not in ${r.currency}, or an invoice missing ${list(r.requiredFields.invoice ?? [], "or")}.`,
      verdict: "ASK",
    },
    {
      id: "R1",
      title: "New payees",
      text: `The first payment to anyone new needs a signature${r.newPayee.requireCrsPass ? ", and their identity must check out with CRS first" : ""}.`,
      verdict: r.newPayee.verdict,
    },
    {
      id: "R2",
      title: "Changed details",
      text: `If the ${list(r.detailChange.fields, "or")} differs from what's on file, payment stops and Cal calls the number on file, never the one on the invoice. Confirmed changes still need a signature; a denied change stays blocked.`,
      verdict: r.detailChange.untilCall,
    },
    {
      id: "R3",
      title: "Identity and fraud signals",
      text: `Blocked if CRS can't verify the person, the fraud score is ${r.crs.fraudScoreBlockAt}+ out of 100, or the callback number belongs to someone else. A fraud alert or a score of ${r.crs.fraudScoreAskAt}+ needs a signature.`,
      verdict: "MIXED",
    },
    {
      id: "R4",
      title: "Signing limits",
      text: `Over ${money(r.caps.ownerAboveCents)} the owner signs. Over ${money(r.caps.accountantAboveCents)} the accountant signs too.`,
      verdict: "ASK",
    },
    {
      id: "R5",
      title: "Daily limit",
      text: `A person checks anything that would take today's payments over ${money(r.caps.dailyOutflowCents)}.`,
      verdict: "ASK",
    },
    {
      id: "R6",
      title: "No double payments",
      text: `The same invoice number from the same payee, or the same receipt within ${r.duplicates.receiptWindowDays} days, is never paid twice.`,
      verdict: r.duplicates.verdict,
    },
    {
      id: "R7",
      title: "Hidden instructions",
      text: "Text in a document that tries to instruct the AI is treated as evidence, never as a command, and the payment is never automatic.",
      verdict: r.injection.verdict,
    },
    {
      id: "R8",
      title: "Reimbursement rules",
      text: `Receipts must be ${r.reimbursements.requireItemized ? "itemized, " : ""}under ${r.reimbursements.maxAgeDays} days old, and free of ${list(r.reimbursements.disallowedCategories)}.`,
      verdict: "ASK",
    },
    {
      id: "R9",
      title: "Split purchases",
      text: `Several bills from one payee within ${r.splitPurchase.windowDays} days that together pass ${money(r.caps.ownerAboveCents)} are treated as one.`,
      verdict: r.splitPurchase.verdict,
    },
    {
      id: "R10",
      title: "The AI can only make it stricter",
      text: "If Vera flags something, the verdict can go up to ASK or BLOCK. The AI can never turn a hold into a payment.",
      verdict: "MIXED",
    },
  ];
}

export default function PolicyPage() {
  const current = useQuery(api.policy.current, {});
  const versions = useQuery(api.policy.versions, {});

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 pb-28 text-lg">
      <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-5" aria-hidden /> Ops board
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <AgentAvatar seat="controller" size={56} />
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-primary">Policy</h1>
            <SyntheticBadge />
          </div>
          <p className="text-muted-foreground">
            The rules Cora applies. Code enforces them; the AI can&apos;t change them.
            {current && ` Version ${current.version}.`}
          </p>
        </div>
      </header>

      {current === undefined ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : current === null ? (
        <p className="soft-card p-6 text-muted-foreground">No policy yet. Seed the deployment first.</p>
      ) : (
        <section aria-label="Active rules" className="soft-card divide-y divide-border/70">
          {describe(current.rules as PolicyRules).map((rule) => (
            <div key={rule.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-start sm:gap-5">
              <span className="w-12 shrink-0 rounded-full bg-[#F5F0FF] py-0.5 text-center font-mono text-base text-[#5B3EA8]">{rule.id}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{rule.title}</div>
                <p className="text-base leading-relaxed text-muted-foreground">{rule.text}</p>
              </div>
              {rule.verdict !== "MIXED" && <VerdictBadge verdict={rule.verdict} />}
            </div>
          ))}
          <p className="flex items-center gap-1.5 p-5 text-base text-muted-foreground">
            Based on a published template:
            <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Glitter, Expense Reimbursement Policy <ExternalLink className="size-4" aria-hidden />
            </a>
          </p>
        </section>
      )}

      <section aria-labelledby="history-heading" className="space-y-3">
        <h2 id="history-heading" className="text-2xl font-semibold">
          Version history
        </h2>
        <ol className="soft-card divide-y divide-border/70">
          {(versions ?? []).map((v) => (
            <VersionRow key={v._id} v={v} active={v._id === current?._id} />
          ))}
        </ol>
      </section>
    </main>
  );
}

function VersionRow({ v, active }: { v: Doc<"policyVersions">; active: boolean }) {
  const source = v.source.startsWith("policy-doc:") ? "From the policy document" : v.source === "droid" ? "Proposed by Droid" : "Set by hand";
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-semibold">
          Version {v.version}
          {active && <span className="rounded-full bg-[#DCF5E7] px-2.5 py-0.5 text-sm font-semibold text-[#0F6B3E]">Active</span>}
        </div>
        <div className="text-base text-muted-foreground">
          {source} · by {v.createdBy} · {new Date(v._creationTime).toLocaleString()}
        </div>
        {v.diffSummary && <p className="mt-1 text-base">{v.diffSummary}</p>}
      </div>
      <div className="flex flex-col items-end gap-1 text-base">
        {v.approvedBy ? (
          <span className="inline-flex items-center gap-1.5 text-[#0F6B3E]">
            <CircleCheck className="size-5" aria-hidden /> Approved by {v.approvedBy}
          </span>
        ) : (
          <span className="text-muted-foreground">Not approved</span>
        )}
        {v.testsPassed !== null &&
          (v.testsPassed ? (
            <span className="inline-flex items-center gap-1.5 text-[#0F6B3E]">
              <CircleCheck className="size-5" aria-hidden /> Tests passed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[#A3182B]">
              <CircleX className="size-5" aria-hidden /> Tests failed
            </span>
          ))}
      </div>
    </li>
  );
}
