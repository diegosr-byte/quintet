"use client";

// Human signatures. Approving means typing the exact amount; over the two-signature limit both
// the owner and the accountant must sign. approvals.decide re-checks the amount server-side.
import { useState } from "react";
import { useMutation } from "convex/react";
import { CircleCheck, OctagonX, PenLine } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { formatCents, formatTime } from "@/components/case-ui";
import { AgentAvatar } from "@/components/agents";

const ROLE_LABELS: Record<Doc<"approvals">["role"], string> = { owner: "Owner", accountant: "Accountant" };

// "1,234.50" or "$1234.5" → 123450; anything else → null.
function parseCents(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

export function ApprovalPanel({ c, approvals }: { c: Doc<"cases">; approvals: Doc<"approvals">[] }) {
  if (approvals.length === 0) return <p className="text-muted-foreground">None required.</p>;

  const signed = approvals.filter((a) => a.status === "approved").length;
  // Only one signer at a time gets the form, so each screen has one primary action.
  const next = c.status === "awaiting_approval" ? approvals.find((a) => a.status === "pending") : undefined;

  return (
    <div className="space-y-3">
      {approvals.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-xl font-semibold tabular-nums">
            {signed} of {approvals.length} signatures
          </span>
          <div className="flex gap-1" aria-hidden>
            {approvals.map((a) => (
              <span
                key={a._id}
                className={
                  a.status === "approved" ? "h-3 w-10 rounded-full bg-[#7FD3A8]" : a.status === "denied" ? "h-3 w-10 rounded-full bg-[#F29AA5]" : "h-3 w-10 rounded-full bg-muted"
                }
              />
            ))}
          </div>
        </div>
      )}
      <ul className="space-y-2">
        {approvals.map((a) =>
          a._id === next?._id ? (
            <li key={a._id}>
              <SignForm approval={a} amountCents={c.amountCents} currency={c.currency} />
            </li>
          ) : (
            <li key={a._id} className="soft-card flex items-center justify-between gap-3 p-4">
              <span className="flex items-center gap-3 font-semibold">
                <AgentAvatar seat="human" size={32} />
                {ROLE_LABELS[a.role]}
              </span>
              <SignatureStatus approval={a} />
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function SignatureStatus({ approval: a }: { approval: Doc<"approvals"> }) {
  if (a.status === "approved") {
    return (
      <span className="inline-flex items-center gap-2 font-semibold text-[#0F6B3E]">
        <CircleCheck className="size-5" aria-hidden /> Approved by {a.decidedBy}
        {a.decidedAt && <span className="font-normal text-muted-foreground">· {formatTime(a.decidedAt)}</span>}
      </span>
    );
  }
  if (a.status === "denied") {
    return (
      <span className="inline-flex items-center gap-2 font-semibold text-[#A3182B]">
        <OctagonX className="size-5" aria-hidden /> Denied by {a.decidedBy}
        {a.decidedAt && <span className="font-normal text-muted-foreground">· {formatTime(a.decidedAt)}</span>}
      </span>
    );
  }
  return <span className="text-muted-foreground">Waiting</span>;
}

function SignForm({ approval, amountCents, currency }: { approval: Doc<"approvals">; amountCents: number | null; currency: string }) {
  const decide = useMutation(api.approvals.decide);
  const [name, setName] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const typedCents = parseCents(typed);
  const matches = typedCents !== null && typedCents === amountCents;
  const signer = name.trim();

  const submit = async (decision: "approved" | "denied") => {
    setError(null);
    setBusy(true);
    try {
      await decide({
        approvalId: approval._id,
        decision,
        typedAmountCents: decision === "approved" ? typedCents : null,
        decidedBy: signer,
      });
    } catch (e) {
      // Convex wraps server errors; show just the message the mutation threw.
      const message = e instanceof Error ? e.message : String(e);
      setError(message.match(/Uncaught Error: (.*?)(\n|$)/)?.[1] ?? message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4 rounded-2xl border-2 border-[#F6DC9A] bg-[#FFFBEF] p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (matches && signer) void submit("approved");
      }}
    >
      <div className="flex items-center gap-2 text-xl font-semibold">
        <AgentAvatar seat="controller" size={36} />
        <span>
          Cora needs the {approval.role}&apos;s signature
          <span className="flex items-center gap-1.5 text-base font-normal text-muted-foreground">
            <PenLine className="size-4" aria-hidden /> Type the amount to confirm you&apos;ve checked it
          </span>
        </span>
      </div>
      <label className="block space-y-1">
        <span className="text-base text-muted-foreground">Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className="h-12 w-full rounded-xl border bg-card px-4 text-lg"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-base text-muted-foreground">
          Type the amount to approve: <span className="font-semibold text-foreground">{formatCents(amountCents, currency)}</span>
        </span>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          aria-invalid={typed !== "" && !matches}
          className="h-14 w-full rounded-xl border bg-card px-4 text-2xl tabular-nums aria-[invalid=true]:border-[#E07A88]"
        />
        {typed !== "" && !matches && <span className="text-base text-[#A3182B]">Doesn&apos;t match the invoice amount.</span>}
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-[#FFE1E4] px-3 py-2 font-semibold text-[#A3182B]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={!matches || !signer || busy} className="h-12 rounded-full bg-[#1F7A4D] px-6 text-lg text-white hover:bg-[#17694A]">
          <CircleCheck aria-hidden /> Approve {formatCents(amountCents, currency)}
        </Button>
        <Button type="button" variant="ghost" size="lg" disabled={!signer || busy} onClick={() => {
            if (window.confirm("Deny this payment? The case will be rejected.")) void submit("denied");
          }} className="h-12 rounded-full text-lg">
          Deny
        </Button>
      </div>
    </form>
  );
}
