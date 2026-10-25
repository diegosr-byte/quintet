"use client";

// Meet the team: what each seat does, what it is never allowed to do, and what it's doing right now.
// The guardrails mirror CLAUDE.md's hard rules, so this page describes how the system really works.
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { AgentAvatar, AGENTS, Seat } from "@/components/agents";
import {
  statusLabel,
  StatusDot,
  useTeamStatus,
} from "@/components/team-status";

// The pitch order: read, verify, call, decide, pay.
const ORDER = [
  "intake",
  "verification",
  "caller",
  "controller",
  "payments",
] as const;

const DETAILS: Record<
  Exclude<Seat, "human" | "system">,
  { step: string; does: string[]; never: string[] }
> = {
  intake: {
    step: "1 · Read",
    does: [
      "Reads every invoice and receipt, PDF or photo, and pulls out who it's from, the amount, the invoice number and where to pay.",
      "A separate, plain-code parser re-reads the PDF's text layer; if the two disagree, a person checks.",
      "Notes any text in the document that tries to instruct the AI.",
    ],
    never: [
      "Has no tools: it can only read and report.",
      "Treats instructions inside a document as evidence, never as commands.",
    ],
  },
  verification: {
    step: "2 · Verify",
    does: [
      "Compares the payee, bank account, phone and email domain with what's on file.",
      "Checks for duplicates and split purchases.",
      "Runs identity, fraud-score and reverse-phone checks with CRS for new payees and changed details.",
    ],
    never: [
      "Can only make a verdict stricter, never more lenient.",
      "Sends CRS only allowlisted test identities, never text from a document.",
    ],
  },
  caller: {
    step: "3 · Call",
    does: [
      "When bank or contact details change, phones the vendor at the number already on file to confirm.",
      "Says up front that it's an automated assistant, and asks simple yes/no questions.",
    ],
    never: [
      "Never calls the number printed on the invoice.",
      "Never reads out account numbers.",
    ],
  },
  controller: {
    step: "4 · Decide",
    does: [
      "Applies your written policy: a tested rules engine decides ALLOW, ASK or BLOCK.",
      "Asks for the right signatures (the owner over $500, the accountant too over $1,000).",
      "Explains every decision in plain English, and answers your questions out loud.",
    ],
    never: [
      "The AI can't approve or move money; it can only recommend holding something.",
    ],
  },
  payments: {
    step: "5 · Pay",
    does: [
      "Sends the transfer through the bank once a case is allowed or fully signed.",
      "Tags every payment so a retry can never pay twice.",
    ],
    never: [
      "Plain code, no AI.",
      "Re-checks the kill switch right before sending; frozen means nothing goes out.",
    ],
  },
};

export default function AgentsPage() {
  const { workload } = useTeamStatus();
  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6 pb-28 text-lg">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          Meet the team
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Five seats a small business can&apos;t usually staff. Four use AI to
          read, check, call and explain; the one that pays is plain code. Every
          step is logged, and money only moves when your policy says so.
        </p>
      </header>

      <ol className="space-y-5">
        {ORDER.map((seat) => {
          const agent = AGENTS[seat];
          const d = DETAILS[seat];
          const count = workload.get(seat) ?? 0;
          return (
            <li key={seat} id={seat} className="soft-card scroll-mt-20 p-6">
              <div className="flex flex-wrap items-start gap-4">
                <span
                  className="flex size-20 shrink-0 items-center justify-center rounded-3xl"
                  style={{ background: agent.tint }}
                >
                  <AgentAvatar
                    seat={seat}
                    size={64}
                    busy={count > 0}
                    happy={count > 0}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    {d.step}
                  </div>
                  <h2
                    className="text-2xl font-bold"
                    style={{ color: agent.ink }}
                  >
                    {agent.name}{" "}
                    <span className="text-lg font-medium text-muted-foreground">
                      · {agent.role}
                    </span>
                  </h2>
                  <p className="text-base">{agent.job}</p>
                </div>
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <StatusDot seat={seat} count={count} />
                  {statusLabel(seat, count)}
                </span>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-base font-semibold">
                    What {agent.name} does
                  </h3>
                  <ul className="space-y-1.5 text-base text-muted-foreground">
                    {d.does.map((x) => (
                      <li key={x} className="flex gap-2">
                        <span
                          className="mt-2.5 size-1.5 shrink-0 rounded-full"
                          style={{ background: agent.color }}
                          aria-hidden
                        />
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-base font-semibold">Guardrails</h3>
                  <ul className="space-y-1.5 text-base text-muted-foreground">
                    {d.never.map((x) => (
                      <li key={x} className="flex gap-2">
                        <ShieldCheck
                          className="mt-0.5 size-4 shrink-0 text-[#0F6B3E]"
                          aria-hidden
                        />
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="soft-card flex flex-wrap items-center gap-4 p-6">
        <AgentAvatar seat="human" size={48} />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">And you</h2>
          <p className="text-base text-muted-foreground">
            You only sign what the policy says needs a person, by typing the
            exact amount. One switch freezes every payment.
          </p>
        </div>
        <Link
          href="/console"
          className="rounded-full bg-primary px-5 py-2.5 text-base font-semibold text-primary-foreground hover:opacity-90"
        >
          See them work
        </Link>
      </section>
    </main>
  );
}
