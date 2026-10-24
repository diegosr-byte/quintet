"use client";

// Case page: the document, its extracted fields, every check with evidence, the verdict and why,
// approvals, the call, and the audit timeline. All live via Convex reactive queries.
import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, OctagonX } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import {
  checkLabel,
  CheckResultBadge,
  failLabel,
  formatCents,
  formatTime,
  PipelineSteps,
  StatusChip,
  SyntheticBadge,
} from "@/components/case-ui";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import { AskPanel } from "@/components/AskPanel";
import { CallPanel } from "@/components/CallPanel";
import { VerdictButton, WhyPanel } from "@/components/CaseWhy";
import { AgentAvatar, AGENTS } from "@/components/agents";

// Failures first, so the checks that decided the verdict are the ones on screen.
const RESULT_ORDER: Record<Doc<"checks">["result"], number> = { fail: 0, warn: 1, pass: 2, skipped: 3 };

export default function CasePage() {
  const { id } = useParams<{ id: string }>();
  const caseId = id as Id<"cases">;
  const data = useQuery(api.cases.get, { caseId });
  const actions = useQuery(api.audit.forCase, { caseId });
  const calls = useQuery(api.calls.forCase, { caseId });
  const setFaultInjection = useMutation(api.cases.setFaultInjection);
  const [whyOpen, setWhyOpen] = useState(false);

  if (data === undefined) return <main className="p-6 text-lg text-muted-foreground">Loading…</main>;
  if (data === null) return <main className="p-6 text-lg">Case not found.</main>;

  const { case: c, document: doc, party, checks, approvals, payments } = data;
  const ex = doc?.extracted ?? null;
  const sortedChecks = [...checks].sort((a, b) => RESULT_ORDER[a.result] - RESULT_ORDER[b.result]);
  const redFlags = checks.filter((ch) => ch.result === "fail");

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6 pb-28 text-lg">
      <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-5" aria-hidden /> Ops board
      </Link>

      {/* Verdict header: readable from the back of the room. */}
      <header className="soft-card flex flex-wrap items-start justify-between gap-6 p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{party?.displayName ?? ex?.vendorOrMerchantName ?? doc?.fileName ?? "Unknown payee"}</h1>
            <SyntheticBadge />
          </div>
          <div className="text-muted-foreground">
            {c.kind === "reimbursement" ? "Reimbursement" : "Vendor payment"}
            {c.invoiceNumber && ` · Invoice #${c.invoiceNumber}`} · received {formatTime(c._creationTime)}
          </div>
          <div className="text-5xl font-bold tabular-nums">{formatCents(c.amountCents, c.currency)}</div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <PipelineSteps c={c} />
            <StatusChip status={c.status} />
          </div>
        </div>
        <VerdictButton verdict={c.verdict} size="xl" open={whyOpen} onToggle={() => setWhyOpen(!whyOpen)} controls="case-why" />
        {whyOpen && (
          <div className="w-full">
            <WhyPanel id="case-why" c={c} />
          </div>
        )}
      </header>

      {/* The demo moment: failed checks big enough to read from the back of the room. */}
      {redFlags.length > 0 && (
        <section aria-labelledby="flags-heading" className="rounded-2xl border-2 border-[#F5BFC6] bg-[#FFF1F2] p-6">
          <h2 id="flags-heading" className="mb-5 flex items-center gap-3 text-2xl font-bold text-[#A3182B]">
            <AgentAvatar seat="verification" size={44} />
            Vera found {redFlags.length} red flag{redFlags.length === 1 ? "" : "s"}
          </h2>
          <ul className="space-y-4">
            {redFlags.map((ch) => (
              <li key={ch._id} className="flex items-start gap-4">
                <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-[#FFE1E4]">
                  <OctagonX className="size-7 text-[#A3182B]" strokeWidth={2.5} aria-hidden />
                </span>
                <div>
                  <div className="text-3xl font-bold text-[#7D1220]">{failLabel(ch.kind)}</div>
                  <div className="text-xl text-[#6B3A40]">{ch.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {approvals.length > 0 && (
        <section aria-labelledby="approvals-heading" className="space-y-3">
          <h2 id="approvals-heading" className="text-2xl font-semibold">Approvals</h2>
          <ApprovalPanel c={c} approvals={approvals} />
        </section>
      )}

      <section aria-labelledby="ask-heading" className="soft-card space-y-4 p-6">
        <h2 id="ask-heading" className="flex items-center gap-3 text-2xl font-semibold">
          <AgentAvatar seat="controller" size={36} />
          Ask Cora
          <span className="text-base font-normal text-muted-foreground">about this payment</span>
        </h2>
        <AskPanel caseId={caseId} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* The document as received: PDF or photo. */}
        <section aria-labelledby="doc-heading" className="space-y-3">
          <h2 id="doc-heading" className="text-2xl font-semibold">Document</h2>
          {doc?.fileUrl ? (
            doc.mimeType === "application/pdf" ? (
              <iframe src={doc.fileUrl} title={doc.fileName} className="soft-card h-[36rem] w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={doc.fileUrl} alt={doc.fileName} className="soft-card max-h-[36rem] w-full object-contain" />
            )
          ) : (
            <p className="text-muted-foreground">No file.</p>
          )}
          {doc && doc.injectionFindings.length > 0 && (
            <div role="alert" className="rounded-2xl border border-[#F5BFC6] bg-[#FFF1F2] p-4">
              <div className="font-bold text-[#A3182B]">Hidden instructions found in the document (treated as evidence, not commands)</div>
              <ul className="mt-2 space-y-1">
                {doc.injectionFindings.map((f, i) => (
                  <li key={i} className="font-mono text-base">“{f.text}” <span className="text-muted-foreground">({f.where})</span></li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section aria-labelledby="fields-heading" className="space-y-3">
          <h2 id="fields-heading" className="text-2xl font-semibold">Extracted fields</h2>
          {ex ? (
            <dl className="soft-card grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 p-5">
              <Field label="Type" value={ex.docKind} />
              <Field label="From" value={ex.vendorOrMerchantName} />
              <Field label="Invoice #" value={ex.invoiceNumber} />
              <Field label="Total" value={formatCents(ex.totalCents, ex.currency)} />
              <Field label="Issued / due" value={[ex.issueDate, ex.dueDate].filter(Boolean).join(" / ") || null} />
              <Field label="Contact" value={[ex.contactEmail, ex.contactPhone].filter(Boolean).join(" · ") || null} />
              <Field
                label="Pay to"
                value={ex.payTo ? `${ex.payTo.name} · routing •••${ex.payTo.routingNumber.slice(-4)} · acct •••${ex.payTo.accountNumber.slice(-4)}` : null}
              />
              {party?.bankOnFile && (
                <Field label="Bank on file" value={`routing •••${party.bankOnFile.routingLast4} · acct •••${party.bankOnFile.accountLast4}`} />
              )}
              <Field label="Confidence" value={`${Math.round(ex.confidence * 100)}%`} />
              {ex.missingFields.length > 0 && <Field label="Missing" value={ex.missingFields.join(", ")} />}
            </dl>
          ) : (
            <p className="text-muted-foreground">Not extracted yet.</p>
          )}
          {ex && ex.lineItems.length > 0 && (
            <table className="w-full text-base">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-1 font-medium">Item</th><th className="py-1 font-medium">Category</th><th className="py-1 text-right font-medium">Amount</th></tr>
              </thead>
              <tbody>
                {ex.lineItems.map((li, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-1">{li.description}</td>
                    <td className="py-1">{li.category}</td>
                    <td className="py-1 text-right tabular-nums">{formatCents(li.amountCents, ex.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section aria-labelledby="checks-heading">
        <h2 id="checks-heading" className="mb-3 text-2xl font-semibold">Checks</h2>
        {sortedChecks.length === 0 ? (
          <p className="text-muted-foreground">No checks yet.</p>
        ) : (
          <ul className="soft-card divide-y divide-border/70">
            {sortedChecks.map((ch) => (
              <li key={ch._id} className="p-4">
                <details>
                  <summary className="flex cursor-pointer list-none items-center gap-4">
                    <CheckResultBadge result={ch.result} />
                    <span className="w-64 shrink-0 font-semibold">{checkLabel(ch.kind)}</span>
                    <span className="text-muted-foreground">{ch.detail}</span>
                  </summary>
                  <div className="mt-3 pl-32 text-base">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AgentAvatar seat={ch.seat} size={24} /> Checked by {AGENTS[ch.seat].name}
                    </div>
                    {ch.evidence !== null && <Evidence value={ch.evidence} />}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="payment-heading" className="space-y-3">
          <h2 id="payment-heading" className="flex items-center gap-3 text-2xl font-semibold">
            <AgentAvatar seat="payments" size={36} busy={c.status === "paying"} />
            Payment
          </h2>
          {payments.length === 0 ? (
            <p className="text-muted-foreground">Not paid.</p>
          ) : (
            payments.map((p) => (
              <div key={p._id} className="soft-card p-4">
                <div className="flex justify-between">
                  <span className="font-semibold">{formatCents(p.amountCents, c.currency)} · {p.status}</span>
                  <span className="font-mono text-base text-muted-foreground">{p.tag}</span>
                </div>
                <div className="text-base text-muted-foreground">
                  {p.attempts} attempt{p.attempts === 1 ? "" : "s"}
                  {p.lastError && ` · last error: ${p.lastError}`}
                </div>
              </div>
            ))
          )}
          <label className="flex items-center gap-3 text-base">
            <input
              type="checkbox"
              className="size-5"
              checked={c.faultInjection}
              onChange={(e) => void setFaultInjection({ caseId, on: e.target.checked })}
            />
            Fault injection: fail once after the bank succeeds
          </label>
        </section>

        <section aria-labelledby="call-heading" className="space-y-3">
          <h2 id="call-heading" className="flex items-center gap-3 text-2xl font-semibold">
            <AgentAvatar seat="caller" size={36} busy={c.status === "awaiting_call"} />
            Verification call
          </h2>
          <CallPanel calls={calls} awaiting={c.status === "awaiting_call"} />
        </section>
      </div>

      <section aria-labelledby="audit-heading">
        <h2 id="audit-heading" className="mb-3 text-2xl font-semibold">Audit timeline</h2>
        <ol className="soft-card space-y-4 p-5">
          {(actions ?? []).map((a) => (
            <li key={a._id} className="flex gap-3">
              <AgentAvatar seat={a.seat} size={32} className="mt-0.5" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 text-base">
                  <span className="font-semibold" style={{ color: AGENTS[a.seat].ink }}>{AGENTS[a.seat].name}</span>
                  <span className="tabular-nums text-muted-foreground">{formatTime(a._creationTime)}</span>
                  {a.ruleIds && a.ruleIds.length > 0 && <span className="font-mono text-muted-foreground">{a.ruleIds.join(" ")}</span>}
                </div>
                <p className="leading-snug">{a.summary}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

// Evidence is whatever the seat recorded. Show objects as labeled rows; nested values as JSON.
function Evidence({ value }: { value: unknown }) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return <pre className="mt-2 overflow-x-auto rounded-xl bg-muted p-3 font-mono text-sm">{JSON.stringify(value, null, 2)}</pre>;
  }
  return (
    <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 rounded-xl bg-muted p-3">
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}</dt>
          <dd className="break-words font-mono text-sm leading-6">{typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value ?? "—"}</dd>
    </>
  );
}
