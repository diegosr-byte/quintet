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
import { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

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

const VERDICTS: Record<Verdict, { icon: typeof CircleCheck; className: string }> = {
  ALLOW: { icon: CircleCheck, className: "bg-green-700 text-white" },
  ASK: { icon: TriangleAlert, className: "bg-amber-400 text-black" },
  BLOCK: { icon: OctagonX, className: "bg-red-700 text-white" },
};

export function VerdictBadge({ verdict, size = "md" }: { verdict: Verdict | null; size?: "md" | "xl" }) {
  if (!verdict) {
    return (
      <span className={cn("inline-flex items-center gap-2 rounded-md border px-3 py-1 font-semibold text-muted-foreground", size === "xl" && "px-5 py-3 text-3xl")}>
        <Clock className={size === "xl" ? "size-8" : "size-5"} aria-hidden />
        PENDING
      </span>
    );
  }
  const { icon: Icon, className } = VERDICTS[verdict];
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-md px-3 py-1 font-bold tracking-wide", className, size === "xl" && "px-5 py-3 text-3xl")}>
      <Icon className={size === "xl" ? "size-8" : "size-5"} aria-hidden />
      {verdict}
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

// The five steps a case moves through on the ops board.
const STEPS = ["Intake", "Verify", "Gate", "Call", "Pay"] as const;

// A failed case doesn't record which seat it died in, so infer it: no amount means intake never
// finished, no verdict means verification did not, and a verdict means it failed while paying.
function failedStep(c: Pick<Doc<"cases">, "amountCents" | "verdict">) {
  if (c.amountCents === null) return 0;
  if (c.verdict === null) return 1;
  return 4;
}

function stepState(c: Pick<Doc<"cases">, "status" | "amountCents" | "verdict">): { at: number; tone: "working" | "waiting" | "done" | "stopped" } {
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
    <ol className="flex items-center gap-1" aria-label={`Status: ${statusLabel(c.status)}`}>
      {STEPS.map((step, i) => {
        const done = i < at;
        const current = i === at;
        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-0.5 text-base font-medium transition-colors duration-500",
              done && "bg-green-700/15 text-green-800 dark:text-green-300",
              current && tone === "working" && "bg-blue-600 text-white",
              current && tone === "waiting" && "bg-amber-400 text-black",
              current && tone === "stopped" && "bg-red-700 text-white",
              !done && !current && "text-muted-foreground",
            )}
          >
            {current && tone === "working" && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
            {step}
          </li>
        );
      })}
    </ol>
  );
}

export function StatusChip({ status }: { status: CaseStatus }) {
  const tone =
    status === "paid"
      ? "bg-green-700 text-white"
      : status === "blocked" || status === "rejected" || status === "failed" || status === "awaiting_call"
        ? "bg-red-700 text-white"
        : status === "awaiting_approval"
          ? "bg-amber-400 text-black"
          : "bg-blue-600 text-white";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 font-semibold", tone)}>
      {(status === "received" || status === "extracting" || status === "checking" || status === "paying") && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {statusLabel(status)}
    </span>
  );
}

const CHECK_RESULTS: Record<CheckResult, { icon: typeof CircleCheck; label: string; className: string }> = {
  pass: { icon: CircleCheck, label: "PASS", className: "text-green-700 dark:text-green-400" },
  fail: { icon: OctagonX, label: "FAIL", className: "text-red-700 dark:text-red-400" },
  warn: { icon: TriangleAlert, label: "WARN", className: "text-amber-600 dark:text-amber-400" },
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
    <span className="rounded border-2 border-dashed border-amber-500 px-2 py-0.5 text-sm font-bold tracking-widest text-amber-700 dark:text-amber-400">
      SYNTHETIC
    </span>
  );
}
