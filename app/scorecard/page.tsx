"use client";

// Scorecard: the latest eval over the 25 cases. Headline numbers first, then every case's
// expected vs actual verdict. "Run eval" starts a fresh run in its own eval org.
import { useState } from "react";
import Link from "next/link";
import { useAction, useQuery } from "convex/react";
import { ArrowLeft, CircleCheck, CircleX, LoaderCircle, Play } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/agents";
import { SyntheticBadge, VerdictBadge } from "@/components/case-ui";
import { EVAL_CASES } from "@/evals/fixtures/cases";
import { cn } from "@/lib/utils";

const CASE_INFO = new Map(EVAL_CASES.map((c) => [c.id, c]));
const GROUP_LABELS: Record<string, string> = {
  legit: "Legitimate",
  new_payee: "New payee",
  attack: "Attack",
  policy_edge: "Policy edge",
  off_template: "Off template",
};

type Run = Doc<"evalRuns">;

export default function ScorecardPage() {
  const run = useQuery(api.evals.latest, {});
  const start = useAction(api.evals.runFromUi);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const running = run !== undefined && run !== null && run.finishedAt === null;

  const onRun = async () => {
    setStarting(true);
    setError(null);
    try {
      await start({});
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(
        /Could not find public function/.test(message)
          ? "The eval runner isn't deployed yet."
          : (message.match(/Uncaught Error: (.*?)(\n|$)/)?.[1] ?? message),
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 pb-28 text-lg">
      <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-5" aria-hidden /> Ops board
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <AgentAvatar seat="controller" size={56} happy={running} busy={running} />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-primary">Scorecard</h1>
              <SyntheticBadge />
            </div>
            <p className="text-muted-foreground">25 test cases: real-looking bills and the attacks we expect.</p>
          </div>
        </div>
        <Button size="lg" onClick={() => void onRun()} disabled={starting || running} className="h-14 rounded-full px-6 text-lg [&_svg]:size-5">
          {starting || running ? <LoaderCircle className="animate-spin" aria-hidden /> : <Play aria-hidden />}
          {running ? "Running…" : starting ? "Starting…" : "Run eval"}
        </Button>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-[#FFE1E4] px-4 py-3 font-semibold text-[#A3182B]">
          {error}
        </p>
      )}

      {run === undefined ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : run === null ? (
        <div className="soft-card flex flex-col items-center gap-3 p-10 text-center">
          <AgentAvatar seat="controller" size={64} />
          <p className="text-xl font-semibold">No eval has run yet</p>
          <p className="max-w-md text-muted-foreground">Run eval sends all 25 cases through the team in a separate test business and scores every verdict.</p>
        </div>
      ) : (
        <>
          <Summary run={run} />
          {run.results.length > 0 && <Results run={run} />}
        </>
      )}
    </main>
  );
}

function Summary({ run }: { run: Run }) {
  const s = run.summary;
  const pct = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((n / d) * 100)}%`);
  const tiles = s
    ? [
        { label: "Attacks stopped", value: `${s.attacksStopped}/${s.attacksTotal}`, sub: pct(s.attacksStopped, s.attacksTotal), good: s.attacksStopped === s.attacksTotal },
        { label: "Legit bills auto-paid", value: `${s.legitAuto}/${s.legitTotal}`, sub: pct(s.legitAuto, s.legitTotal), good: s.legitAuto === s.legitTotal },
        { label: "Wrongful holds", value: String(s.wrongfulHolds), sub: "good bills held for no reason", good: s.wrongfulHolds === 0 },
        { label: "Asked a human", value: `${Math.round(s.askRate * 100)}%`, sub: "of all cases" },
        { label: "Median time", value: `${(s.medianMs / 1000).toFixed(1)}s`, sub: "per case" },
        { label: "Cost per case", value: `$${s.costPerCaseUsd.toFixed(3)}`, sub: "model spend" },
      ]
    : [];
  return (
    <section aria-label="Summary" className="space-y-2">
      <p className="text-base text-muted-foreground">
        {run.finishedAt === null
          ? `Started ${new Date(run.startedAt).toLocaleTimeString()} · the team is working through all ${EVAL_CASES.length} cases, results land when they're done`
          : `Finished ${new Date(run.finishedAt).toLocaleString()}`}
      </p>
      {s ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {tiles.map((t) => (
            <div key={t.label} className={cn("soft-card p-4", t.good === true && "border-[#B5E8CC] bg-[#F3FCF7]", t.good === false && "border-[#F5BFC6] bg-[#FFF7F8]")}>
              <div className="text-base text-muted-foreground">{t.label}</div>
              <div className="text-4xl font-bold tabular-nums">{t.value}</div>
              <div className="text-base text-muted-foreground">{t.sub}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="soft-card p-5 text-muted-foreground">Totals appear when the run finishes.</div>
      )}
    </section>
  );
}

function Results({ run }: { run: Run }) {
  const passed = run.results.filter((r) => r.pass).length;
  return (
    <section aria-labelledby="results-heading" className="space-y-3">
      <h2 id="results-heading" className="text-2xl font-semibold">
        Every case <span className="text-lg font-normal text-muted-foreground">· {passed} of {run.results.length} passed</span>
      </h2>
      <div className="soft-card overflow-x-auto">
        <table className="w-full text-base">
          <thead className="text-left text-sm text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-3 font-medium">Case</th>
              <th className="px-4 py-3 font-medium">Expected</th>
              <th className="px-4 py-3 font-medium">Actual</th>
              <th className="px-4 py-3 text-right font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {run.results.map((r) => {
              const info = CASE_INFO.get(r.evalCaseId);
              return (
                <tr key={r.evalCaseId} className={cn(!r.pass && "bg-[#FFF7F8]")}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">
                      {r.caseId ? (
                        <Link href={`/case/${r.caseId}`} className="hover:underline">
                          {info?.scenario ?? r.evalCaseId}
                        </Link>
                      ) : (
                        (info?.scenario ?? r.evalCaseId)
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {r.evalCaseId}
                      {info && ` · ${GROUP_LABELS[info.group] ?? info.group}`}
                      {r.paid && " · paid"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground">{r.expected.join(" or ")}</span>
                  </td>
                  <td className="px-4 py-3">
                    <VerdictBadge verdict={r.actual} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{(r.ms / 1000).toFixed(1)}s</td>
                  <td className="px-4 py-3">
                    {r.pass ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F6B3E]">
                        <CircleCheck className="size-5" aria-hidden /> Pass
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#A3182B]">
                        <CircleX className="size-5" aria-hidden /> Fail
                      </span>
                    )}
                    {r.note && <div className="text-sm text-muted-foreground">{r.note}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
