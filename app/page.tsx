"use client";

// Ops board: a live feed of cases moving through the seats, today's totals, and the kill switch.
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Power } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  formatCents,
  formatTime,
  PipelineSteps,
  StatusChip,
  SyntheticBadge,
  VerdictBadge,
} from "@/components/case-ui";

export default function OpsBoard() {
  const cases = useQuery(api.cases.list, {});
  const recent = useQuery(api.audit.recent, { limit: 200 });
  const setKillSwitch = useMutation(api.orgs.setKillSwitch);

  // No public query exposes orgs.killSwitch yet, so read the latest kill_switch_changed action.
  // TODO: swap for an orgs.current query once Josiah adds one.
  const killSwitchAction = recent?.find((a) => a.kind === "kill_switch_changed");
  const frozen = (killSwitchAction?.data as { on?: boolean } | null)?.on ?? false;

  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const today = (cases ?? []).filter((c) => c._creationTime >= startOfToday);
  // Count by when the money moved, not when the case was created (seeded history is created today too).
  const paidTodayIds = new Set(
    (recent ?? []).filter((a) => a.kind === "payment_succeeded" && a._creationTime >= startOfToday).map((a) => a.caseId),
  );
  const paid = (cases ?? []).filter((c) => c.status === "paid" && paidTodayIds.has(c._id));
  const totals = [
    { label: "Paid today", value: formatCents(paid.reduce((sum, c) => sum + (c.amountCents ?? 0), 0)), sub: `${paid.length} cases` },
    { label: "Needs approval", value: today.filter((c) => c.status === "awaiting_approval").length },
    { label: "Blocked", value: today.filter((c) => c.status === "blocked" || c.status === "rejected").length },
    { label: "In progress", value: today.filter((c) => ["received", "extracting", "checking", "awaiting_call", "paying"].includes(c.status)).length },
  ];

  const toggleKillSwitch = () => {
    if (!frozen && !window.confirm("Freeze all payments? Nothing will be paid until you unfreeze.")) return;
    void setKillSwitch({ on: !frozen });
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6 text-lg">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold">Quintet</h1>
            <SyntheticBadge />
          </div>
          <p className="text-muted-foreground">Claude proposes. Code countersigns.</p>
        </div>
        <Button
          size="lg"
          variant={frozen ? "outline" : "destructive"}
          onClick={toggleKillSwitch}
          className="h-14 px-6 text-lg [&_svg]:size-6"
        >
          <Power aria-hidden />
          {frozen ? "Unfreeze payments" : "Freeze all payments"}
        </Button>
      </header>

      {frozen && (
        <div role="alert" className="rounded-lg bg-red-700 px-5 py-3 text-xl font-bold text-white">
          Kill switch ON: every payment is blocked.
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {totals.map((t) => (
          <div key={t.label} className="rounded-xl border p-4">
            <div className="text-base text-muted-foreground">{t.label}</div>
            <div className="text-4xl font-bold tabular-nums">{cases === undefined ? "—" : t.value}</div>
            {t.sub && <div className="text-base text-muted-foreground">{t.sub}</div>}
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="cases-heading">
          <h2 id="cases-heading" className="mb-3 text-2xl font-semibold">Cases</h2>
          {cases === undefined ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : cases.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              No cases yet. Ingest a document to watch it move through the seats.
            </p>
          ) : (
            <ul className="space-y-3">
              {cases.map((c) => (
                <li key={c._id}>
                  <Link
                    href={`/case/${c._id}`}
                    className="block rounded-xl border p-4 transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xl font-semibold">{c.partyName ?? c.fileName ?? "Unknown payee"}</div>
                        <div className="text-base text-muted-foreground">
                          {c.kind === "reimbursement" ? "Reimbursement" : "Vendor payment"}
                          {c.invoiceNumber && ` · #${c.invoiceNumber}`} · {formatTime(c._creationTime)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold tabular-nums">{formatCents(c.amountCents, c.currency)}</span>
                        <VerdictBadge verdict={c.verdict} />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <PipelineSteps c={c} />
                      <StatusChip status={c.status} />
                    </div>
                    {c.reasons.length > 0 && (
                      <p className="mt-2 text-base text-muted-foreground">{c.reasons[0]}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="mb-3 text-2xl font-semibold">Activity</h2>
          <ol className="space-y-2">
            {(recent ?? []).slice(0, 15).map((a) => (
              <li key={a._id} className="rounded-lg border p-3 text-base">
                <div className="flex justify-between gap-2 text-sm text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wide">{a.seat}</span>
                  <span>{formatTime(a._creationTime)}</span>
                </div>
                <div>{a.summary}</div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </main>
  );
}
