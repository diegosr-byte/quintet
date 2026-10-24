"use client";

// Compact activity feed: one line per action; click a line for the details. Anything that looks like a
// credential or account detail is masked until clicked, so a screen share or recording never shows it.
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Eye } from "lucide-react";
import { Doc } from "@/convex/_generated/dataModel";
import { AgentAvatar, AGENTS } from "@/components/agents";
import { formatTime } from "@/components/case-ui";
import { cn } from "@/lib/utils";

const SENSITIVE_KEY = /key|token|secret|password|auth|account|routing|phone|number|transfer|storage|fingerprint|sha|tag/i;
// Values that look like credentials even under an innocent key: API-key prefixes, or long opaque strings.
const SENSITIVE_VALUE = /^(sk-|sk_|pk_|rk_|ghp_|gho_|xox[abp]-|eyJ)|^[A-Za-z0-9_\-]{24,}$/;

function isSensitive(key: string, value: unknown) {
  if (value === null || value === undefined || typeof value === "boolean") return false;
  if (SENSITIVE_KEY.test(key)) return true;
  return typeof value === "string" && SENSITIVE_VALUE.test(value);
}

// IDs and tokens that show up inside summary text (e.g. "Paid. Nessie transfer 1a2b…").
const SENSITIVE_IN_TEXT = /((?:sk|pk|rk)[-_][\w-]+|ghp_\w+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9_-]{24,})/g;

// Summary text with sensitive pieces masked. interactive=false for the compact line (it sits inside a button).
function Redacted({ text, interactive }: { text: string; interactive: boolean }) {
  const parts = text.split(SENSITIVE_IN_TEXT);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          interactive ? (
            <Masked key={i} value={part} />
          ) : (
            <span key={i} aria-label="hidden value">
              ••••
            </span>
          )
        ) : (
          part
        ),
      )}
    </>
  );
}

const show = (v: unknown) => (typeof v === "object" && v !== null ? JSON.stringify(v) : String(v));

export function ActivityFeed({ actions, limit = 20 }: { actions: Doc<"actions">[] | undefined; limit?: number }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!actions) return <p className="text-muted-foreground">Loading…</p>;
  if (actions.length === 0) return <p className="soft-card p-4 text-base text-muted-foreground">Nothing yet.</p>;

  return (
    <ol className="soft-card divide-y divide-border/70 overflow-hidden">
      {actions.slice(0, limit).map((a) => {
        const agent = AGENTS[a.seat];
        const expanded = open === a._id;
        return (
          <li key={a._id}>
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : a._id)}
              aria-expanded={expanded}
              className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/60", expanded && "bg-muted/60")}
            >
              <AgentAvatar seat={a.seat} size={22} />
              <span className="shrink-0 text-sm font-semibold" style={{ color: agent.ink }}>
                {agent.name}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                <Redacted text={a.summary} interactive={false} />
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatTime(a._creationTime)}</span>
              <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden />
            </button>
            {expanded && <Details a={a} />}
          </li>
        );
      })}
    </ol>
  );
}

function Details({ a }: { a: Doc<"actions"> }) {
  const data = a.data && typeof a.data === "object" && !Array.isArray(a.data) ? Object.entries(a.data as Record<string, unknown>) : [];
  return (
    <div className="space-y-2 bg-muted/40 px-4 pb-3 pt-1 text-sm">
      <p className="text-base leading-snug">
        <Redacted text={a.summary} interactive />
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
        <span>
          {AGENTS[a.seat].role} · {a.kind.replace(/_/g, " ")}
        </span>
        <span className="tabular-nums">{new Date(a._creationTime).toLocaleString()}</span>
        {a.ruleIds?.map((r) => (
          <span key={r} className="rounded-full bg-[#F5F0FF] px-2 py-0.5 font-mono text-xs text-[#5B3EA8]">
            {r}
          </span>
        ))}
      </div>
      {data.length > 0 && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded-xl bg-card p-3">
          {data.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}</dt>
              <dd className="min-w-0 break-words font-mono text-xs leading-5">
                {isSensitive(k, v) ? <Masked value={show(v)} /> : show(v)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {a.caseId && (
        <Link href={`/case/${a.caseId}`} className="inline-block font-semibold text-primary hover:underline">
          Open case →
        </Link>
      )}
    </div>
  );
}

function Masked({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);
  if (revealed) {
    return (
      <button type="button" onClick={() => setRevealed(false)} title="Hide" className="text-left hover:opacity-70">
        {value}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
      aria-label="Reveal hidden value"
    >
      <span aria-hidden>••••••••</span>
      <Eye className="size-3.5" aria-hidden />
      <span className="font-sans">Reveal</span>
    </button>
  );
}
