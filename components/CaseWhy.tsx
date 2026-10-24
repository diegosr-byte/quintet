"use client";

// The verdict doubles as a toggle: click ASK / BLOCK / ALLOW / PENDING to see why.
// Keeps the reasons and Cora's explanation out of the way until someone asks.
import { ChevronDown } from "lucide-react";
import { Doc } from "@/convex/_generated/dataModel";
import { AgentAvatar } from "@/components/agents";
import { VerdictBadge } from "@/components/case-ui";
import { cn } from "@/lib/utils";

export function VerdictButton({
  verdict,
  open,
  onToggle,
  controls,
  size = "md",
}: {
  verdict: Doc<"cases">["verdict"];
  open: boolean;
  onToggle: () => void;
  controls: string;
  size?: "md" | "xl";
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={`${verdict ?? "Pending"}: ${open ? "hide" : "show"} why`}
      className="group inline-flex items-center gap-1 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <VerdictBadge verdict={verdict} size={size} />
      <ChevronDown
        className={cn(
          "text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
          size === "xl" ? "size-5" : "size-4",
          open && "rotate-180",
        )}
        aria-hidden
      />
    </button>
  );
}

export function WhyPanel({
  id,
  c,
}: {
  id: string;
  c: Pick<Doc<"cases">, "reasons" | "ruleIds" | "explanation" | "status">;
}) {
  const empty = c.reasons.length === 0 && !c.explanation;
  return (
    <div id={id} className="space-y-3 rounded-2xl bg-muted/60 p-4">
      {empty ? (
        <p className="text-base text-muted-foreground">
          {c.status === "received" || c.status === "extracting" || c.status === "checking"
            ? "The team is still working on this one."
            : "No reasons recorded."}
        </p>
      ) : (
        <>
          {c.reasons.length > 0 && (
            <ul className="space-y-1.5 text-base">
              {c.reasons.map((r, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
          {c.ruleIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {c.ruleIds.map((r) => (
                <span key={r} className="rounded-full bg-[#F5F0FF] px-2.5 py-0.5 font-mono text-sm text-[#5B3EA8]">
                  {r}
                </span>
              ))}
            </div>
          )}
          {c.explanation && (
            <div className="flex gap-3 rounded-xl bg-card p-3">
              <AgentAvatar seat="controller" size={30} className="mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#5B3EA8]">Cora explains</div>
                <p className="text-base leading-relaxed">{c.explanation}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
