"use client";

// The vendor's phone, for the table pitch: Josiah leaves this open on his laptop. When a case needs a
// verification call, Cal's web call rings here automatically (no hunting for the case page), and he
// answers as the vendor. The call itself is WebCall (Cartesia agent over WebSocket).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { BellRing, PhoneIncoming } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { AgentAvatar } from "@/components/agents";
import { formatCents, SyntheticBadge } from "@/components/case-ui";
import { WebCall } from "@/components/WebCall";
import { cn } from "@/lib/utils";

const OUTCOME_LABELS: Record<NonNullable<Doc<"calls">["outcome"]>, string> = {
  confirmed_change: "You confirmed the change",
  denied_change: "You said nothing changed",
  unclear: "The answer was unclear",
  no_answer: "No answer",
};

export default function VendorPhone() {
  // The newest case waiting on a call is the candidate; it becomes "shown" once its call actually rings,
  // and stays shown after the call ends (so the outcome stays on screen) until a newer call rings.
  const waiting = useQuery(api.cases.list, { status: "awaiting_call" });
  const candidate = waiting?.[0] ?? null;
  const candidateCalls = useQuery(api.calls.forCase, candidate ? { caseId: candidate._id } : "skip");
  const candidateRinging = candidateCalls?.some((x) => x.status === "queued" || x.status === "in_progress") ?? false;
  const [shownCaseId, setShownCaseId] = useState<Doc<"cases">["_id"] | null>(null);
  if (candidate && candidateRinging && candidate._id !== shownCaseId) setShownCaseId(candidate._id);
  const caseId = shownCaseId;

  const data = useQuery(api.cases.get, caseId ? { caseId } : "skip");
  const calls = useQuery(api.calls.forCase, caseId ? { caseId } : "skip");
  const call = calls?.at(-1) ?? null;
  const ringing = call?.status === "queued";
  const live = call?.status === "in_progress";

  const [armed, setArmed] = useState(false);
  useRinger(armed && ringing);

  const c = data?.case;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-5 text-lg">
      <header className="flex items-center justify-between pt-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-primary">Vendor phone</h1>
            <SyntheticBadge />
          </div>
          <p className="text-base text-muted-foreground">Answer here when Cal calls to verify a bank change.</p>
        </div>
      </header>

      {!armed && (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-3 text-base font-medium text-muted-foreground hover:bg-muted"
        >
          <BellRing className="size-5" aria-hidden />
          Tap once to turn the ringer on
        </button>
      )}

      <section
        className={cn(
          "soft-card flex flex-1 flex-col items-center gap-4 p-6 text-center transition-colors",
          ringing && "border-[#B5E8CC] bg-[#F3FCF7]",
          live && "border-[#A8BEFF] bg-[#EEF2FF]",
        )}
        aria-live="polite"
      >
        {!call ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <AgentAvatar seat="caller" size={72} />
            <p>Waiting for a call…</p>
            <p className="text-base">Generate &ldquo;We switched banks&rdquo; on the console and Cal will call here.</p>
          </div>
        ) : (
          <>
            <AgentAvatar seat="caller" size={96} happy={ringing || live} busy={ringing} />
            <div>
              <div className="flex items-center justify-center gap-2 text-base text-muted-foreground">
                <PhoneIncoming className="size-4" aria-hidden />
                {ringing ? "Incoming call" : live ? "On the call" : "Call ended"}
              </div>
              <div className="text-2xl font-bold">Cal · verification call</div>
              {c && (
                <p className="text-base text-muted-foreground">
                  About invoice {c.invoiceNumber ? `#${c.invoiceNumber}` : ""} · {formatCents(c.amountCents, c.currency)}
                  {data?.party?.displayName && (
                    <>
                      <br />
                      You are {data.party.displayName}
                    </>
                  )}
                </p>
              )}
            </div>

            {call.status === "completed" || call.status === "failed" ? (
              <div className="space-y-3">
                <p className="rounded-full bg-muted px-4 py-1.5 font-semibold">
                  {call.outcome ? OUTCOME_LABELS[call.outcome] : "Call failed"}
                </p>
                <Link href={`/case/${call.caseId}`} className="text-base font-semibold text-primary hover:underline">
                  Open the case →
                </Link>
              </div>
            ) : (
              <div className="w-full overflow-hidden rounded-2xl border bg-card text-left">
                <WebCall callId={call._id} caseId={call.caseId} status={call.status} />
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

// A two-tone ring (like a phone) while a call is ringing. Needs one tap first: browsers block audio
// that no gesture started.
function useRinger(on: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!on) return;
    const ctx = (ctxRef.current ??= new AudioContext());
    void ctx.resume();
    const ring = () => {
      const t = ctx.currentTime;
      for (const [start, freq] of [
        [0, 440],
        [0, 480],
        [0.5, 440],
        [0.5, 480],
      ] as const) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t + start);
        gain.gain.linearRampToValueAtTime(0.08, t + start + 0.02);
        gain.gain.setValueAtTime(0.08, t + start + 0.38);
        gain.gain.linearRampToValueAtTime(0, t + start + 0.4);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t + start);
        osc.stop(t + start + 0.42);
      }
    };
    ring();
    const id = window.setInterval(ring, 3000);
    return () => window.clearInterval(id);
  }, [on]);
}
