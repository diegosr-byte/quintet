"use client";

// Policy: the active rules in plain English (written from the live parameters, so they always match
// what the gate enforces), plus the version history.
import { useQuery } from "convex/react";
import { CircleCheck, CircleX, ExternalLink, ShieldCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import type { PolicyRules, Verdict } from "@/convex/lib/policy";
import { AgentAvatar } from "@/components/agents";
import {
  formatCents,
  SyntheticBadge,
  VerdictBadge,
} from "@/components/case-ui";

const SOURCE_URL =
  "https://www.glitter.io/blog/process-documentation/expense-reimbursement-policy";

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

const list = (
  items: string[],
  joiner: "and" | "or" = "and",
  plural = false,
) => {
  const named = items.map(
    (i) => (FIELD_NAMES[i] ?? i.replace(/_/g, " ")) + (plural ? "s" : ""),
  );
  return named.length <= 1
    ? named.join("")
    : `${named.slice(0, -1).join(", ")} ${joiner} ${named.at(-1)}`;
};

type Rule = {
  id: string;
  title: string;
  text: string;
  verdict: Verdict | "MIXED";
};

function describe(r: PolicyRules): Rule[] {
  const money = (c: number) => formatCents(c, r.currency).replace(/\.00$/, "");
  return [
    {
      id: "R0",
      title: "Unclear or incomplete documents",
      text: `A person checks anything Ivy reads with under ${Math.round(r.minExtractionConfidence * 100)}% confidence, anything other than ${list(r.knownDocKinds, "or", true)}, anything not in ${r.currency}, or an invoice missing ${list(r.requiredFields.invoice ?? [], "or")}.`,
      verdict: "ASK",
    },
    {
      id: "R1",
      title: "New payees",
      text: `The first payment to anyone new needs a signature${r.newPayee.requireCrsPass ? ", and CRS must verify their identity first" : ""}.`,
      verdict: r.newPayee.verdict,
    },
    {
      id: "R2",
      title: "Changed bank, phone or email",
      text: `If the ${list(r.detailChange.fields, "or")} differs from what's on file, payment stops and Cal calls the number on file, never the one on the invoice. If the vendor says nothing changed, it stays blocked. If they confirm, a person signs.`,
      verdict: r.detailChange.untilCall,
    },
    {
      id: "R3",
      title: "Fraud and identity warnings",
      text: `Blocked if CRS can't verify the person, the fraud score is ${r.crs.fraudScoreBlockAt}+ out of 100, or the callback number belongs to someone else. A fraud alert or a score of ${r.crs.fraudScoreAskAt}+ needs a signature.`,
      verdict: "MIXED",
    },
    {
      id: "R4",
      title: "Large payments",
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
      title: "Duplicate bills",
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
      title: "Receipt rules",
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

function Tier({
  verdict,
  title,
  note,
  rules,
}: {
  verdict: Verdict;
  title: string;
  note: string;
  rules?: Rule[];
}) {
  return (
    <section className="soft-card overflow-hidden" aria-label={title}>
      <header className="flex flex-wrap items-center gap-3 p-5">
        <VerdictBadge verdict={verdict} />
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-base text-muted-foreground">{note}</p>
        </div>
      </header>
      {rules && rules.length > 0 && (
        <ul className="divide-y divide-border/70 border-t border-border/70">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-start gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{rule.title}</div>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {rule.text}
                </p>
              </div>
              <span className="shrink-0 pt-1 font-mono text-sm text-muted-foreground">
                {rule.id}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function PolicyPage() {
  const current = useQuery(api.policy.current, {});
  const versions = useQuery(api.policy.versions, {});
  const rules = current ? describe(current.rules as PolicyRules) : [];
  // Fraud and identity warnings (R3) mix ASK and BLOCK; they stop the payment, so they sit under "Stopped".
  const inTier = (v: Verdict) =>
    rules.filter((r) =>
      r.verdict === "MIXED" ? r.id === "R3" && v === "BLOCK" : r.verdict === v,
    );
  const guarantee = rules.find((r) => r.id === "R10");

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 pb-28 text-lg">
      <header className="flex items-center gap-4">
        <AgentAvatar seat="controller" size={56} />
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-primary">
              Policy
            </h1>
            <SyntheticBadge />
          </div>
          <p className="text-muted-foreground">
            The rules every bill is checked against. Code enforces them; the AI
            can&apos;t change them.
          </p>
        </div>
      </header>

      {current === undefined ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : current === null ? (
        <p className="soft-card p-6 text-muted-foreground">
          No policy yet. Seed the deployment first.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground">
            Every bill gets one of three answers.
          </p>
          <Tier
            verdict="ALLOW"
            title="Paid automatically"
            note="A bill that passes every rule below is paid by Penny, with no one signing."
          />
          <Tier
            verdict="ASK"
            title="A person signs"
            note="Penny waits until the right person approves."
            rules={inTier("ASK")}
          />
          <Tier
            verdict="BLOCK"
            title="Stopped"
            note="The payment is held and nothing is sent."
            rules={inTier("BLOCK")}
          />
          {guarantee && (
            <section className="flex items-start gap-3 rounded-2xl border border-border/70 bg-accent/40 p-5">
              <ShieldCheck
                className="mt-0.5 size-6 shrink-0 text-primary"
                aria-hidden
              />
              <div>
                <div className="font-semibold">{guarantee.title}</div>
                <p className="text-base text-muted-foreground">
                  {guarantee.text}
                </p>
              </div>
            </section>
          )}
        </>
      )}

      <footer className="space-y-3 text-base text-muted-foreground">
        <details>
          <summary className="cursor-pointer font-medium text-foreground">
            Version history
            {current ? ` · version ${current.version} is active` : ""}
          </summary>
          <ol className="soft-card mt-3 divide-y divide-border/70">
            {(versions ?? []).map((v) => (
              <VersionRow key={v._id} v={v} active={v._id === current?._id} />
            ))}
          </ol>
        </details>
        <p className="flex flex-wrap items-center gap-1.5">
          Based on a published template:
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Glitter, Expense Reimbursement Policy{" "}
            <ExternalLink className="size-4" aria-hidden />
          </a>
        </p>
      </footer>
    </main>
  );
}

function VersionRow({
  v,
  active,
}: {
  v: Doc<"policyVersions">;
  active: boolean;
}) {
  const source = v.source.startsWith("policy-doc:")
    ? "From the policy document"
    : v.source === "droid"
      ? "Proposed by Droid"
      : v.createdBy === "seed"
        ? "Starting policy"
        : "Set by hand";
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-semibold">
          Version {v.version}
          {active && (
            <span className="rounded-full bg-[#DCF5E7] px-2.5 py-0.5 text-sm font-semibold text-[#0F6B3E]">
              Active
            </span>
          )}
        </div>
        <div className="text-base text-muted-foreground">
          {source}
          {v.createdBy !== "seed" && ` · by ${v.createdBy}`} ·{" "}
          {new Date(v._creationTime).toLocaleString()}
        </div>
        {v.diffSummary && <p className="mt-1 text-base">{v.diffSummary}</p>}
      </div>
      <div className="flex flex-col items-end gap-1 text-base">
        {v.approvedBy ? (
          <span className="inline-flex items-center gap-1.5 text-[#0F6B3E]">
            <CircleCheck className="size-5" aria-hidden />{" "}
            {v.approvedBy === "seed"
              ? "Approved at setup"
              : `Approved by ${v.approvedBy}`}
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
