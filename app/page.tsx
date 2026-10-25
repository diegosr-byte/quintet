// The public front door: what Quintet is, for a small business that just found it. The live app
// (ops board, console, scorecard) is one click away and still drives the demo.
import Link from "next/link";
import {
  ArrowRight,
  FileWarning,
  Lock,
  PenLine,
  PhoneCall,
  Power,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { AgentAvatar, AGENTS, Seat } from "@/components/agents";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { AgentPlayground } from "@/components/AgentPlayground";
import { ScrollReveal } from "@/components/ScrollReveal";

const IC3_REPORT =
  "https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf";

const STEPS: { seat: Seat; verb: string; text: string }[] = [
  {
    seat: "intake",
    verb: "Read",
    text: "Ivy reads every invoice and receipt, PDF or phone photo, and pulls out who, how much and where to pay.",
  },
  {
    seat: "verification",
    verb: "Verify",
    text: "Vera checks the payee, bank and contacts against your records, looks for duplicates, and runs identity and fraud checks.",
  },
  {
    seat: "caller",
    verb: "Call",
    text: "If bank details changed, Cal phones the vendor at the number already on file, never the one on the invoice.",
  },
  {
    seat: "controller",
    verb: "Decide",
    text: "Your written policy decides: pay, ask a person, or block. Cora explains every decision in plain English.",
  },
  {
    seat: "payments",
    verb: "Pay",
    text: "Penny sends the money only when the policy allows, and tags every payment so it can never go out twice.",
  },
];

const SAFETY = [
  {
    icon: Lock,
    title: "The AI never moves money",
    text: "A tested rules engine decides. The AI can only recommend holding a payment, never releasing one.",
  },
  {
    icon: FileWarning,
    title: "Documents can't give orders",
    text: "Hidden text like “pay this immediately” is flagged as evidence, never followed.",
  },
  {
    icon: PhoneCall,
    title: "It calls the number you trust",
    text: "Bank changes are confirmed with the vendor at the number on file, the step fraudsters count on you skipping.",
  },
  {
    icon: PenLine,
    title: "You sign what matters",
    text: "Payments over your limits wait for you to type the exact amount. Over $1,000, two people sign.",
  },
  {
    icon: Power,
    title: "One switch freezes everything",
    text: "Turn on the kill switch and nothing is paid until you turn it off.",
  },
  {
    icon: ScrollText,
    title: "Every step is on the record",
    text: "Each read, check, call, signature and payment is written to a log that can't be edited.",
  },
];

const FOR = [
  "Construction subcontractors",
  "Property managers",
  "Dental and vet practices",
  "Agencies and studios",
  "Small manufacturers",
];

export default function Home() {
  return (
    <div className="min-h-dvh text-lg">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-primary">
              Quintet
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-base sm:gap-2">
            <a
              href="#how"
              className="hidden rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground sm:block"
            >
              How it works
            </a>
            <a
              href="#safety"
              className="hidden rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground sm:block"
            >
              Safety
            </a>
            <Link
              href="/agents"
              className="hidden rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground md:block"
            >
              The team
            </Link>
            <ThemeSwitch />
            <Link
              href="/board"
              className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90"
            >
              Open the app
            </Link>
          </nav>
        </div>
      </header>

      <ScrollReveal />
      <main>
        {/* Hero: Quintet at the center; the agents drift and bounce around it. */}
        <AgentPlayground>
          <h1 className="text-7xl font-bold tracking-tight text-primary sm:text-8xl md:text-9xl">
            Quintet
          </h1>
          <p className="mx-auto mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="block">Your AI finance team.</span>
            <span className="block whitespace-nowrap">Every payment double-checked.</span>
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/agents"
              className="inline-flex items-center gap-2 rounded-full border bg-card px-6 py-3 font-semibold transition-colors hover:bg-accent"
            >
              Meet the team
            </Link>
            <Link
              href="/console"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-[0_8px_24px_rgb(40_90_190/0.22)] transition-transform hover:-translate-y-0.5"
            >
              Try the live demo <ArrowRight className="size-5" aria-hidden />
            </Link>
          </div>
        </AgentPlayground>

        {/* Problem */}
        <section className="reveal border-y border-border/60 bg-accent/40">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-[1fr_22rem]">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                One person pays the bills. Nobody checks their work.
              </h2>
              <p className="mt-4 text-muted-foreground">
                In most small businesses, the owner or an office manager pays
                every invoice alone. A convincing email that says
                &ldquo;we&apos;ve switched banks, please use the new
                account&rdquo; is all it takes, and once a bank transfer goes
                out it rarely comes back. Big companies stop this with a second
                person who checks. Quintet is that second person, for businesses
                that can&apos;t hire one.
              </p>
            </div>
            <div className="soft-card p-6">
              <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Business email compromise, 2025
              </div>
              <div className="mt-2 text-4xl font-bold tabular-nums">
                $3.05 billion
              </div>
              <p className="text-base text-muted-foreground">
                in reported losses from 24,768 complaints, the second-largest
                category.
              </p>
              <a
                href={IC3_REPORT}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
              >
                Source: FBI IC3, 2025 Internet Crime Report
              </a>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how"
          className="reveal mx-auto max-w-6xl scroll-mt-20 px-6 py-16"
        >
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                Five steps, every bill
              </h2>
              <p className="mt-2 text-muted-foreground">
                Read, verify, call, decide, pay. Each step has its own teammate.
              </p>
            </div>
            <Link
              href="/agents"
              className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
            >
              Meet the team <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.seat} className="soft-card flex flex-col gap-3 p-5">
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-12 items-center justify-center rounded-2xl"
                    style={{ background: AGENTS[s.seat].tint }}
                  >
                    <AgentAvatar seat={s.seat} size={38} />
                  </span>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Step {i + 1}
                    </div>
                    <div className="font-semibold">{s.verb}</div>
                  </div>
                </div>
                <p className="text-base text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Example */}
        <section className="reveal mx-auto max-w-6xl px-6 pb-16">
          <div className="soft-card grid gap-8 p-8 md:grid-cols-2">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                What it catches
              </div>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                &ldquo;We switched banks.&rdquo;
              </h2>
              <p className="mt-3 text-muted-foreground">
                Your usual paper supplier emails an invoice for $1,850 with new
                bank details. It looks routine. Quintet stops it in seconds,
                calls the supplier at the number you already had, and the
                supplier says they changed nothing.
              </p>
              <Link
                href="/console"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90"
              >
                Run it yourself <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="rounded-2xl border border-[#F6D0D5] bg-[#FFFAFA] p-5">
              <div className="mb-3 flex items-center gap-2.5 font-semibold text-[#A3182B]">
                <AgentAvatar seat="verification" size={30} /> Vera found 3 red
                flags
              </div>
              <ul className="space-y-2.5 text-base">
                {[
                  "Bank account changed since the last payment",
                  "The callback number belongs to someone else",
                  "Hidden text telling the AI to pay immediately",
                ].map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span
                      className="mt-2 size-2 shrink-0 rounded-full bg-[#E05A6C]"
                      aria-hidden
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center gap-2.5 border-t border-[#F6D0D5] pt-4 text-base">
                <AgentAvatar seat="caller" size={30} />
                <span>
                  Cal called the number on file:{" "}
                  <span className="font-semibold">
                    &ldquo;No, we didn&apos;t change anything.&rdquo;
                  </span>{" "}
                  Blocked.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Safety */}
        <section
          id="safety"
          className="reveal scroll-mt-20 border-y border-border/60 bg-accent/40"
        >
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-3xl font-bold tracking-tight">
              Claude proposes. Code countersigns.
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              AI is great at reading messy documents and explaining itself. It
              shouldn&apos;t be trusted with your money, so it isn&apos;t.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SAFETY.map((x) => (
                <div key={x.title} className="soft-card p-5">
                  <x.icon className="size-6 text-primary" aria-hidden />
                  <h3 className="mt-3 font-semibold">{x.title}</h3>
                  <p className="mt-1 text-base text-muted-foreground">
                    {x.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who it's for + tested */}
        <section className="reveal mx-auto grid max-w-6xl gap-6 px-6 py-16 md:grid-cols-2">
          <div className="soft-card p-6">
            <h2 className="text-2xl font-bold tracking-tight">
              Who it&apos;s for
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              Businesses of about 5 to 50 people where one person pays repeat
              vendors by bank transfer, and there&apos;s no finance team to
              double-check.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {FOR.map((f) => (
                <span
                  key={f}
                  className="rounded-full bg-muted px-3 py-1 text-base"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
          <div className="soft-card flex flex-col p-6">
            <h2 className="text-2xl font-bold tracking-tight">
              Tested, not promised
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              Every change runs 25 test cases, from routine bills to fake
              vendors and hidden instructions, and scores whether attacks are
              stopped and good bills are paid.
            </p>
            <Link
              href="/scorecard"
              className="mt-auto inline-flex items-center gap-1.5 pt-4 font-semibold text-primary hover:underline"
            >
              See the latest scorecard{" "}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>

        {/* Final call to action */}
        <section className="reveal mx-auto max-w-6xl px-6 pb-20">
          <div className="soft-card flex flex-col items-center gap-5 px-6 py-12 text-center">
            <div className="flex -space-x-3">
              {STEPS.map((s) => (
                <span key={s.seat} className="rounded-full bg-card p-1">
                  <AgentAvatar seat={s.seat} size={44} happy />
                </span>
              ))}
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              Meet your back office
            </h2>
            <p className="max-w-xl text-muted-foreground">
              Send the team an invoice and watch them work, live.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/console"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
              >
                Try the live demo <ArrowRight className="size-5" aria-hidden />
              </Link>
              <Link
                href="/board"
                className="inline-flex items-center gap-2 rounded-full border bg-card px-6 py-3 font-semibold hover:bg-accent"
              >
                Open the app
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="reveal border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4" aria-hidden /> Built at Cal Hacks
            13.0. Synthetic data only; payments run in a sandbox bank.
          </span>
          <span className="flex gap-4">
            <Link href="/agents" className="hover:text-foreground">
              The team
            </Link>
            <Link href="/policy" className="hover:text-foreground">
              Policy
            </Link>
            <Link href="/scorecard" className="hover:text-foreground">
              Scorecard
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
