// Shared case visuals. Design rules (team/kai.md): projector first, and verdicts are
// always icon + word + color, never color alone.
import {
  CircleCheck,
  CircleMinus,
  Clock,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { AgentAvatar, Seat } from "@/components/agents";

type Verdict = NonNullable<Doc<"cases">["verdict"]>;
type CaseStatus = Doc<"cases">["status"];
type CheckResult = Doc<"checks">["result"];

export function formatCents(cents: number | null, currency = "USD") {
  if (cents === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

// Pastel fills with deep text and icons: soft on the eye, still readable from the back of the room.
const VERDICTS: Record<Verdict, { icon: typeof CircleCheck; className: string }> = {
  ALLOW: { icon: CircleCheck, className: "border-[#CFEEDC] bg-[#F0FAF4] text-[#0F6B3E]" },
  ASK: { icon: TriangleAlert, className: "border-[#F6E3B0] bg-[#FFF9E8] text-[#7A4E00]" },
  BLOCK: { icon: OctagonX, className: "border-[#F6D0D5] bg-[#FFF3F4] text-[#A3182B]" },
};

export function VerdictBadge({
  verdict,
  size = "md",
  children,
}: {
  verdict: Verdict | null;
  size?: "md" | "xl";
  children?: ReactNode; // trailing content inside the pill, e.g. a dropdown arrow
}) {
  // Quiet by default: small pills that inform without shouting. xl is the case page header.
  const sizing = size === "xl" ? "gap-2 rounded-full px-4 py-1.5 text-xl" : "gap-1 rounded-full px-2.5 py-0.5 text-sm";
  const iconSize = size === "xl" ? "size-5" : "size-3.5";
  if (!verdict) {
    return (
      <span className={cn("inline-flex items-center border bg-muted font-medium text-muted-foreground", sizing)}>
        <Clock className={iconSize} aria-hidden />
        PENDING
        {children}
      </span>
    );
  }
  const { icon: Icon, className } = VERDICTS[verdict];
  return (
    <span className={cn("inline-flex items-center border font-semibold tracking-wide", className, sizing)}>
      <Icon className={iconSize} strokeWidth={2.25} aria-hidden />
      {verdict}
      {children}
    </span>
  );
}

const STATUS_LABELS: Record<CaseStatus, string> = {
  received: "Received",
  extracting: "Reading document",
  checking: "Verifying",
  awaiting_call: "Payment frozen",
  awaiting_approval: "Needs approval",
  paying: "Paying",
  paid: "Paid",
  blocked: "Blocked",
  rejected: "Rejected",
  failed: "Failed",
};

export function statusLabel(status: CaseStatus) {
  return STATUS_LABELS[status];
}

export function isFinal(status: CaseStatus) {
  return status === "paid" || status === "blocked" || status === "rejected" || status === "failed";
}

// The five steps a case moves through, each done by one agent.
export const STEPS: { label: string; seat: Seat }[] = [
  { label: "Intake", seat: "intake" },
  { label: "Verify", seat: "verification" },
  { label: "Gate", seat: "controller" },
  { label: "Call", seat: "caller" },
  { label: "Pay", seat: "payments" },
];

// A failed case doesn't record which seat it died in, so infer it: no amount means intake never
// finished, no verdict means verification did not, and a verdict means it failed while paying.
function failedStep(c: Pick<Doc<"cases">, "amountCents" | "verdict">) {
  if (c.amountCents === null) return 0;
  if (c.verdict === null) return 1;
  return 4;
}

export function stepState(c: Pick<Doc<"cases">, "status" | "amountCents" | "verdict">): { at: number; tone: "working" | "waiting" | "done" | "stopped" } {
  switch (c.status) {
    case "received":
    case "extracting":
      return { at: 0, tone: "working" };
    case "checking":
      return { at: 1, tone: "working" };
    case "awaiting_approval":
      return { at: 2, tone: "waiting" };
    case "awaiting_call":
      return { at: 3, tone: "stopped" };
    case "paying":
      return { at: 4, tone: "working" };
    case "paid":
      return { at: 5, tone: "done" };
    case "blocked":
    case "rejected":
      return { at: 2, tone: "stopped" };
    case "failed":
      return { at: failedStep(c), tone: "stopped" };
  }
}

export function PipelineSteps({ c }: { c: Pick<Doc<"cases">, "status" | "amountCents" | "verdict"> }) {
  const { at, tone } = stepState(c);
  return (
    <ol className="flex items-center" aria-label={`Status: ${statusLabel(c.status)}`}>
      {STEPS.map((step, i) => {
        const done = i < at;
        const current = i === at;
        return (
          <li key={step.label} className="flex items-center">
            {i > 0 && <span className={cn("mx-1 h-0.5 w-4 rounded-full", i <= at ? "bg-[#B5E8CC]" : "bg-border")} aria-hidden />}
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-3 text-base font-medium transition-colors duration-500",
                done && "text-foreground",
                current && tone === "working" && "bg-[#E6ECFF] text-[#2D4BA6]",
                current && tone === "waiting" && "bg-[#FFF1C9] text-[#7A4E00]",
                current && tone === "stopped" && "bg-[#FFE1E4] text-[#A3182B]",
                current && tone === "done" && "bg-[#DCF5E7] text-[#0F6B3E]",
                !done && !current && "text-muted-foreground",
              )}
            >
              <AgentAvatar seat={step.seat} size={26} busy={current && tone === "working"} dimmed={!done && !current} happy={current} />
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function StatusChip({ status }: { status: CaseStatus }) {
  const tone =
    status === "paid"
      ? "bg-[#F0FAF4] text-[#0F6B3E]"
      : status === "blocked" || status === "rejected" || status === "failed" || status === "awaiting_call"
        ? "bg-[#FFF3F4] text-[#A3182B]"
        : status === "awaiting_approval"
          ? "bg-[#FFF9E8] text-[#7A4E00]"
          : "bg-[#EEF2FF] text-[#2D4BA6]";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium", tone)}>
      {(status === "received" || status === "extracting" || status === "checking" || status === "paying") && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
      {statusLabel(status)}
    </span>
  );
}

const CHECK_RESULTS: Record<CheckResult, { icon: typeof CircleCheck; label: string; className: string }> = {
  pass: { icon: CircleCheck, label: "PASS", className: "text-[#0F6B3E]" },
  fail: { icon: OctagonX, label: "FAIL", className: "text-[#A3182B]" },
  warn: { icon: TriangleAlert, label: "WARN", className: "text-[#7A4E00]" },
  skipped: { icon: CircleMinus, label: "SKIPPED", className: "text-muted-foreground" },
};

export function CheckResultBadge({ result }: { result: CheckResult }) {
  const { icon: Icon, label, className } = CHECK_RESULTS[result];
  return (
    <span className={cn("inline-flex w-28 shrink-0 items-center gap-1.5 font-bold", className)}>
      <Icon className="size-5" aria-hidden />
      {label}
    </span>
  );
}

const CHECK_LABELS: Record<Doc<"checks">["kind"], string> = {
  extraction_confidence: "Extraction confidence",
  required_fields: "Required fields",
  doc_type: "Document type",
  parser_crosscheck: "Parser cross-check",
  payee_known: "Known payee",
  bank_match: "Bank account matches file",
  contact_match: "Contact matches file",
  crs_identity: "CRS identity",
  crs_fraud_score: "CRS fraud score",
  crs_reverse_phone: "CRS reverse phone",
  duplicate: "Duplicate",
  injection: "Hidden instructions",
  amount_cap: "Amount cap",
  daily_cap: "Daily cap",
  split_purchase: "Split purchase",
  receipt_rules: "Receipt rules",
  call_outcome: "Verification call",
  kill_switch: "Kill switch",
};

export function checkLabel(kind: Doc<"checks">["kind"]) {
  return CHECK_LABELS[kind];
}

// How a check reads when it fails: the red flags say what went wrong, not what was tested.
const FAIL_LABELS: Record<Doc<"checks">["kind"], string> = {
  extraction_confidence: "Document hard to read",
  required_fields: "Required fields missing",
  doc_type: "Not a payable document",
  parser_crosscheck: "PDF text disagrees with what was read",
  payee_known: "Unknown payee",
  bank_match: "Bank account changed",
  contact_match: "Contact details changed",
  crs_identity: "Identity not verified",
  crs_fraud_score: "High fraud score",
  crs_reverse_phone: "Phone belongs to someone else",
  duplicate: "Already paid",
  injection: "Hidden instructions aimed at the AI",
  amount_cap: "Over the amount limit",
  daily_cap: "Over today's limit",
  split_purchase: "Looks like a split purchase",
  receipt_rules: "Receipt breaks policy",
  call_outcome: "Vendor didn't confirm",
  kill_switch: "Payments frozen",
};

export function failLabel(kind: Doc<"checks">["kind"]) {
  return FAIL_LABELS[kind];
}

export function SyntheticBadge() {
  return (
    <span className="rounded-full border border-dashed border-[#E9C46A] bg-[#FFF8E6] px-2.5 py-0.5 text-sm font-bold tracking-widest text-[#7A5300]">
      SYNTHETIC
    </span>
  );
}
