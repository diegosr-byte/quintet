"use client";

// Cal's verification call, live: transcript lines stream in from calls.forCase (a reactive query) as a
// chat between Cal and the vendor, with the outcome once the call ends.
import { useEffect, useRef } from "react";
import { FunctionReturnType } from "convex/server";
import { PhoneCall } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { AgentAvatar } from "@/components/agents";
import { cn } from "@/lib/utils";
import { WebCall } from "@/components/WebCall";

type Call = FunctionReturnType<typeof api.calls.forCase>[number];

const OUTCOMES: Record<NonNullable<Doc<"calls">["outcome"]>, { label: string; className: string }> = {
  confirmed_change: { label: "Vendor confirmed the change", className: "bg-[#FFF1C9] text-[#7A4E00]" },
  denied_change: { label: "Vendor says they changed nothing", className: "bg-[#FFE1E4] text-[#A3182B]" },
  unclear: { label: "Answer was unclear", className: "bg-[#FFF1C9] text-[#7A4E00]" },
  no_answer: { label: "No answer", className: "bg-muted text-muted-foreground" },
};

// Cartesia labels the agent's side differently by setup; anything that isn't clearly the agent is the vendor.
const isCal = (speaker: string) => /agent|assistant|bot|cal|quintet/i.test(speaker);

export function CallPanel({ calls, awaiting }: { calls: Call[] | undefined; awaiting: boolean }) {
  if (!calls || calls.length === 0) {
    return (
      <p className="text-muted-foreground">
        {awaiting ? "Cal is about to call the vendor's number on file…" : "No call needed."}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {calls.map((call) => (
        <CallCard key={call._id} call={call} />
      ))}
    </div>
  );
}

function CallCard({ call }: { call: Call }) {
  const live = call.status === "queued" || call.status === "in_progress";
  const endRef = useRef<HTMLLIElement>(null);
  const lines = call.transcript.length;

  // Keep the newest line in view while the call is live.
  useEffect(() => {
    if (live) endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [lines, live]);

  const seconds = call.startedAt && call.endedAt ? Math.round((call.endedAt - call.startedAt) / 1000) : null;
  const simulated = call.toNumber === "simulated" || call.toNumber === "simulated call";
  const web = call.toNumber === "web call";
  const title = simulated
    ? "Simulated call"
    : web
      ? "Web call to the vendor (demo: answer in this browser)"
      : `Calling ${call.toNumber}, the number on file`;

  return (
    <div className="soft-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-base">
          <PhoneCall className="size-4 text-muted-foreground" aria-hidden />
          {title}
        </span>
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFE1E4] px-2.5 py-0.5 text-sm font-bold text-[#A3182B]">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#E05A6C] opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-[#C8243A]" />
            </span>
            {call.status === "queued" ? "Dialing" : "Live"}
          </span>
        ) : call.status === "failed" ? (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold text-muted-foreground">Call failed</span>
        ) : (
          <span className="text-sm text-muted-foreground">Ended{seconds !== null && seconds > 0 && ` · ${seconds}s`}</span>
        )}
      </div>

      {lines > 0 ? (
        <ol className="max-h-96 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {call.transcript.map((t, i) => {
            const cal = isCal(t.speaker);
            return (
              <li key={i} className={cn("flex items-end gap-2", !cal && "flex-row-reverse")}>
                {cal ? (
                  <AgentAvatar seat="caller" size={28} happy={live && i === lines - 1} />
                ) : (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">V</span>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-base leading-snug",
                    cal ? "rounded-bl-md bg-[#FFF3EE] text-foreground" : "rounded-br-md bg-muted",
                  )}
                >
                  <div className={cn("text-xs font-semibold", cal ? "text-[#9A3F1C]" : "text-muted-foreground")}>{cal ? "Cal" : "Vendor"}</div>
                  {t.text}
                </div>
              </li>
            );
          })}
          <li ref={endRef} aria-hidden />
        </ol>
      ) : (
        <p className="p-4 text-base text-muted-foreground">{live ? "Waiting for someone to pick up…" : "No transcript recorded."}</p>
      )}

      {web && live && <WebCall callId={call._id} caseId={call.caseId} status={call.status} />}

      {call.outcome && (
        <div className="border-t border-border/70 px-4 py-3">
          <span className={cn("inline-flex rounded-full px-3 py-1 text-base font-semibold", OUTCOMES[call.outcome].className)}>{OUTCOMES[call.outcome].label}</span>
        </div>
      )}
    </div>
  );
}

