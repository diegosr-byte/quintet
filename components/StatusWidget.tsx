"use client";

// Floating status widget, bottom right on every page: who's working, whether anything needs you,
// and whether payments are live. Click to open the full team view.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { AgentAvatar, AGENTS, TEAM } from "@/components/agents";
import { StatusDot, useTeamStatus } from "@/components/team-status";
import { cn } from "@/lib/utils";

export function StatusWidget() {
  const { workload, frozen, needsSignature, inProgress, loading } = useTeamStatus();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // The phone upload page stays single-purpose.
  if (loading || pathname === "/upload") return null;

  const busy = TEAM.filter((seat) => (workload.get(seat) ?? 0) > 0);
  const summary = frozen ? "Payments frozen" : inProgress > 0 ? `${inProgress} in progress` : "All quiet";

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div id="status-widget-panel" role="dialog" aria-label="Team status" className="soft-card w-80 p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-lg font-semibold">Team status</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold",
                frozen ? "bg-[#FFE1E4] text-[#A3182B]" : "bg-[#DCF5E7] text-[#0F6B3E]",
              )}
            >
              <span className={cn("size-2 rounded-full", frozen ? "bg-[#A3182B]" : "bg-[#1F9D61]")} aria-hidden />
              {frozen ? "Payments frozen" : "Payments live"}
            </span>
          </div>
          <ul className="space-y-1">
            {TEAM.map((seat) => {
              const count = workload.get(seat) ?? 0;
              return (
                <li key={seat} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                  <AgentAvatar seat={seat} size={32} busy={count > 0} happy={count > 0} />
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold leading-tight" style={{ color: AGENTS[seat].ink }}>
                      {AGENTS[seat].name}
                    </div>
                    <div className="text-sm text-muted-foreground">{AGENTS[seat].role}</div>
                  </div>
                  <StatusDot seat={seat} count={count} />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="status-widget-panel"
        className="soft-card inline-flex items-center gap-3 rounded-full py-2 pl-2 pr-4 text-base font-medium shadow-lg transition-shadow hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex -space-x-2">
          {(busy.length > 0 ? busy : (["payments"] as const)).slice(0, 3).map((seat) => (
            <span key={seat} className="rounded-full bg-card p-0.5">
              <AgentAvatar seat={seat} size={28} happy={busy.length > 0} />
            </span>
          ))}
        </span>
        <span className={cn(frozen && "text-[#A3182B]")}>{summary}</span>
        {needsSignature > 0 && (
          <span className="rounded-full bg-[#FFF1C9] px-2 py-0.5 text-sm font-semibold text-[#7A4E00]">
            {needsSignature} need{needsSignature === 1 ? "s" : ""} you
          </span>
        )}
        <span className={cn("size-2.5 rounded-full", frozen ? "bg-[#A3182B]" : "bg-[#1F9D61]")} title={frozen ? "Payments frozen" : "Payments live"} aria-hidden />
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-200", !open && "rotate-180")} aria-hidden />
      </button>
    </div>
  );
}
