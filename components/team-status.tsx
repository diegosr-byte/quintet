"use client";

// Live team status shared by the ops board and the floating status widget.
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { AGENTS, Seat } from "@/components/agents";

// Which agent has a case in each status. Cora's cases are waiting on a human signature.
const SEAT_FOR_STATUS: Partial<Record<Doc<"cases">["status"], Seat>> = {
  received: "intake",
  extracting: "intake",
  checking: "verification",
  awaiting_approval: "controller",
  awaiting_call: "caller",
  paying: "payments",
};

export function useTeamStatus() {
  const cases = useQuery(api.cases.list, {});
  const recent = useQuery(api.audit.recent, { limit: 200 });

  const workload = new Map<Seat, number>();
  for (const c of cases ?? []) {
    const seat = SEAT_FOR_STATUS[c.status];
    if (seat) workload.set(seat, (workload.get(seat) ?? 0) + 1);
  }

  // No public query exposes orgs.killSwitch yet, so read the latest kill_switch_changed action.
  // TODO: swap for an orgs.current query once Josiah adds one.
  const killSwitchAction = recent?.find((a) => a.kind === "kill_switch_changed");
  const frozen = (killSwitchAction?.data as { on?: boolean } | null)?.on ?? false;

  const needsSignature = workload.get("controller") ?? 0;
  const inProgress = [...workload.entries()].filter(([seat]) => seat !== "controller").reduce((sum, [, n]) => sum + n, 0);

  return { cases, recent, workload, frozen, needsSignature, inProgress, loading: cases === undefined };
}

export function statusLabel(seat: Seat, count: number) {
  if (count === 0) return "Free";
  return seat === "controller" ? `${count} waiting for your signature` : `Working on ${count}`;
}

// Grey when free, the agent's color (pulsing) when working, amber when a case waits on a person.
export function StatusDot({ seat, count, className }: { seat: Seat; count: number; className?: string }) {
  const waiting = seat === "controller" && count > 0;
  const color = count === 0 ? "#C5CDD9" : waiting ? "#E0A100" : AGENTS[seat].ink;
  const label = statusLabel(seat, count);
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`} title={label}>
      <span className="relative flex size-3">
        {count > 0 && <span className="absolute inline-flex size-full animate-ping rounded-full opacity-50" style={{ background: color }} />}
        <span className="relative inline-flex size-3 rounded-full" style={{ background: color }} />
      </span>
      {count > 0 && (
        <span className="text-sm font-bold tabular-nums" style={{ color }} aria-hidden>
          {count}
        </span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}
