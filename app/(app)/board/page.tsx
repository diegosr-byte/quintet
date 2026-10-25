"use client";

// Ops board: the team of agents, a live feed of cases moving through them, today's totals, and the kill switch.
import Link from "next/link";
import { useState } from "react";
import { useMutation } from "convex/react";
import { ArrowRight, FilePlus2, Power } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { FunctionReturnType } from "convex/server";
import { VerdictButton, WhyPanel } from "@/components/CaseWhy";
import { Button } from "@/components/ui/button";
import { AgentAvatar, AGENTS, TEAM } from "@/components/agents";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Collapsible } from "@/components/Collapsible";
import { ResetDemo } from "@/components/ResetDemo";
import { AgentTimeline } from "@/components/AgentTimeline";
import { StatusDot, useTeamStatus } from "@/components/team-status";
import { formatCents, formatTime, StatusChip } from "@/components/case-ui";

export default function OpsBoard() {
  const { cases, recent, workload, frozen } = useTeamStatus();
  const setKillSwitch = useMutation(api.orgs.setKillSwitch);

  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const today = (cases ?? []).filter((c) => c._creationTime >= startOfToday);
  // Count by when the money moved, not when the case was created (seeded history is created today too).
  const paidTodayIds = new Set(
    (recent ?? [])
      .filter(
        (a) =>
          a.kind === "payment_succeeded" && a._creationTime >= startOfToday,
      )
      .map((a) => a.caseId),
  );
  const paid = (cases ?? []).filter(
    (c) => c.status === "paid" && paidTodayIds.has(c._id),
  );
  const totals = [
    {
      label: "Paid today",
      value: formatCents(
        paid.reduce((sum, c) => sum + (c.amountCents ?? 0), 0),
      ),
      sub: `${paid.length} case${paid.length === 1 ? "" : "s"}`,
    },
    {
      label: "Needs your signature",
      value: today.filter((c) => c.status === "awaiting_approval").length,
    },
    {
      label: "Stopped",
      value: today.filter(
        (c) => c.status === "blocked" || c.status === "rejected",
      ).length,
    },
    {
      label: "In progress",
      value: today.filter((c) =>
        [
          "received",
          "extracting",
          "checking",
          "awaiting_call",
          "paying",
        ].includes(c.status),
      ).length,
    },
  ];

  const toggleKillSwitch = () => {
    if (
      !frozen &&
      !window.confirm(
        "Freeze all payments? Nothing will be paid until you unfreeze.",
      )
    )
      return;
    void setKillSwitch({ on: !frozen });
  };

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-6 pb-28 text-lg">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Ops board
          </h1>
          <p className="text-base text-muted-foreground">
            Live: every bill and where it is in the team&apos;s five steps.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ResetDemo />
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-14 rounded-full px-6 text-lg [&_svg]:size-5"
          >
            <Link href="/console">
              <FilePlus2 aria-hidden /> Send a test
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={toggleKillSwitch}
            className={
              frozen
                ? "h-14 rounded-full border-[#B5E8CC] bg-[#ECFAF3] px-6 text-lg text-[#0F6B3E] hover:bg-[#DCF5E7] [&_svg]:size-6"
                : "h-14 rounded-full border-[#F5BFC6] bg-[#FFF1F2] px-6 text-lg text-[#A3182B] hover:bg-[#FFE1E4] [&_svg]:size-6"
            }
          >
            <Power aria-hidden />
            {frozen ? "Unfreeze payments" : "Freeze all payments"}
          </Button>
        </div>
      </header>

      {frozen && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-[#F5BFC6] bg-[#FFE1E4] px-5 py-4 text-xl font-semibold text-[#A3182B]"
        >
          <AgentAvatar seat="payments" size={36} />
          Kill switch on. Penny won&apos;t send any payment until you unfreeze.
        </div>
      )}

      <section aria-labelledby="team-heading">
        <h2 id="team-heading" className="mb-3 text-2xl font-semibold">
          Your team
        </h2>
        {/* Flex with fixed fractions so a short last row (the bottom 2 of 5) sits centered. */}
        <ul className="flex flex-wrap justify-center gap-3">
          {TEAM.map((seat) => {
            const agent = AGENTS[seat];
            const count = workload.get(seat) ?? 0;
            return (
              <li
                key={seat}
                className="soft-card relative flex w-full flex-col gap-3 p-4 sm:w-[calc((100%-0.75rem)/2)] md:w-[calc((100%-1.5rem)/3)] xl:w-[calc((100%-3rem)/5)]"
              >
                <StatusDot
                  seat={seat}
                  count={count}
                  className="absolute right-4 top-4"
                />
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-14 items-center justify-center rounded-2xl"
                    style={{ background: agent.tint }}
                  >
                    <AgentAvatar seat={seat} size={46} busy={count > 0} />
                  </span>
                  <div>
                    <div
                      className="text-xl font-bold"
                      style={{ color: agent.ink }}
                    >
                      {agent.name}
                    </div>
                    <div className="text-base text-muted-foreground">
                      {agent.role}
                    </div>
                  </div>
                </div>
                <p className="text-base leading-snug text-muted-foreground">
                  {agent.job}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {totals.map((t) => (
          <div key={t.label} className="soft-card p-4">
            <div className="text-base text-muted-foreground">{t.label}</div>
            <div className="text-4xl font-bold tabular-nums">
              {cases === undefined ? "—" : t.value}
            </div>
            {t.sub && (
              <div className="text-base text-muted-foreground">{t.sub}</div>
            )}
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Collapsible title="Cases" count={cases?.length} className="min-w-0">
          {cases === undefined ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : cases.length === 0 ? (
            <div className="soft-card flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
              <AgentAvatar seat="intake" size={56} />
              No cases yet. Send Ivy an invoice and watch the team work.
            </div>
          ) : (
            <ul className="space-y-3">
              {cases.map((c) => (
                <li key={c._id}>
                  <CaseRow c={c} />
                </li>
              ))}
            </ul>
          )}
        </Collapsible>

        {/* min-w-0: let one-line summaries truncate instead of widening the grid column */}
        <aside className="min-w-0">
          <Collapsible
            title="Activity"
            count={recent && (recent.length >= 200 ? "200+" : recent.length)}
          >
            <ActivityFeed actions={recent} />
          </Collapsible>
        </aside>
      </div>
    </main>
  );
}

type CaseListItem = FunctionReturnType<typeof api.cases.list>[number];

function CaseRow({ c }: { c: CaseListItem }) {
  const [open, setOpen] = useState(false);
  const panelId = `why-${c._id}`;
  return (
    <div className="soft-card p-5 transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/case/${c._id}`}
          className="min-w-0 flex-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <div className="truncate text-xl font-semibold hover:underline">
            {c.partyName ?? c.fileName ?? "Unknown payee"}
          </div>
          <div className="text-base text-muted-foreground">
            {c.kind === "reimbursement" ? "Reimbursement" : "Vendor payment"}
            {c.invoiceNumber && ` · #${c.invoiceNumber}`} ·{" "}
            {formatTime(c._creationTime)}
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold tabular-nums">
            {formatCents(c.amountCents, c.currency)}
          </span>
          <VerdictButton
            verdict={c.verdict}
            open={open}
            onToggle={() => setOpen(!open)}
            controls={panelId}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <AgentTimeline c={c} id={c._id} />
        <StatusChip status={c.status} />
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          <WhyPanel id={panelId} c={c} />
          <Link
            href={`/case/${c._id}`}
            className="inline-flex items-center gap-1.5 text-base font-semibold text-primary hover:underline"
          >
            Open case <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      )}
    </div>
  );
}
