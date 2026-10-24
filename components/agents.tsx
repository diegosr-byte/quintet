// The five seats as characters: soft pastel shapes with simple eyes. Each seat's name and color
// stays the same everywhere (team strip, pipeline, activity, audit) so people learn who does what.
import { User } from "lucide-react";
import { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

export type Seat = Doc<"actions">["seat"];

// ink and tint are CSS variables (globals.css) so they adapt to light and dark mode.
type Agent = { name: string; role: string; job: string; color: string; ink: string; tint: string };

export const AGENTS: Record<Seat, Agent> = {
  intake: { name: "Ivy", role: "Intake clerk", job: "Reads every invoice and receipt", color: "#A8BEFF", ink: "var(--ink-intake)", tint: "var(--tint-intake)" },
  verification: { name: "Vera", role: "Verification analyst", job: "Checks the payee, bank and contacts", color: "#FFD670", ink: "var(--ink-verification)", tint: "var(--tint-verification)" },
  caller: { name: "Cal", role: "Caller", job: "Phones the vendor to confirm changes", color: "#FFB596", ink: "var(--ink-caller)", tint: "var(--tint-caller)" },
  payments: { name: "Penny", role: "Payments clerk", job: "Pays only when the gate allows. Plain code, no AI", color: "#8FDDB7", ink: "var(--ink-payments)", tint: "var(--tint-payments)" },
  controller: { name: "Cora", role: "Controller", job: "Applies your policy and explains every decision", color: "#C6B0FF", ink: "var(--ink-controller)", tint: "var(--tint-controller)" },
  human: { name: "You", role: "Approver", job: "Signs when a payment needs a person", color: "#DCE3EE", ink: "var(--ink-human)", tint: "var(--tint-human)" },
  system: { name: "Quintet", role: "System", job: "Setup and housekeeping", color: "#E3E7EE", ink: "var(--ink-system)", tint: "var(--tint-system)" },
};

export const TEAM: Seat[] = ["intake", "verification", "controller", "caller", "payments"];

const EYE = "#23314F";

// Solid round eyes by default; Ivy and Cal have pills. Whoever holds the case right now gets happy
// eyes: two upturned arrows (^ ^). Eyes sit 13 units apart and blink (globals.css .agent-eyes).
const PILL_EYES: Seat[] = ["intake", "caller"];
// Stagger the blinks so the team doesn't blink in unison.
const BLINK_DELAY: Record<Seat, string> = { intake: "0s", verification: "-1.3s", controller: "-2.6s", caller: "-3.4s", payments: "-0.7s", human: "0s", system: "-4.1s" };

function Eyes({ cx, y, seat, happy }: { cx: number; y: number; seat: Seat; happy: boolean }) {
  const xs = [cx - 6.5, cx + 6.5];
  if (happy) {
    return (
      <g fill="none" stroke={EYE} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
        {xs.map((x) => (
          <path key={x} d={`M${x - 4.5} ${y + 2.5}L${x} ${y - 2.5}L${x + 4.5} ${y + 2.5}`} />
        ))}
      </g>
    );
  }
  return (
    <g className="agent-eyes" fill={EYE} style={{ animationDelay: BLINK_DELAY[seat] }}>
      {xs.map((x) =>
        PILL_EYES.includes(seat) ? (
          <rect key={x} x={x - 3.5} y={y - 6} width={7} height={12} rx={3.5} />
        ) : (
          <circle key={x} cx={x} cy={y} r={5} />
        ),
      )}
    </g>
  );
}

function Body({ seat, color, happy }: { seat: Seat; color: string; happy: boolean }) {
  const eyes = (cx: number, y: number) => <Eyes cx={cx} y={y} seat={seat} happy={happy} />;
  switch (seat) {
    case "intake": // a cloud: takes things in
      return (
        <>
          <g fill={color}>
            <circle cx="22" cy="36" r="13" />
            <circle cx="35" cy="27" r="15" />
            <circle cx="46" cy="38" r="12" />
            <rect x="14" y="36" width="40" height="14" rx="7" />
          </g>
          {eyes(34, 36)}
        </>
      );
    case "verification": // a chunky check mark: it checks things
      return (
        <>
          <path d="M16 33 28 45 48 21" fill="none" stroke={color} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
          {eyes(29, 36)}
        </>
      );
    case "caller": // a speech bubble
      return (
        <>
          <path d="M32 11c11.6 0 21 8.7 21 19.5S43.6 50 32 50c-2.4 0-4.7-.4-6.8-1.1L15 53.5l2.6-8.9C13.5 41 11 36 11 30.5 11 19.7 20.4 11 32 11Z" fill={color} />
          {eyes(32, 30)}
        </>
      );
    case "payments": // a steady capsule: plain code, no surprises
      return (
        <>
          <rect x="9" y="17" width="46" height="32" rx="16" fill={color} />
          {eyes(32, 32)}
        </>
      );
    case "controller": // a four-petal flower: brings the team together
      return (
        <>
          <g fill={color}>
            <circle cx="32" cy="19" r="12" />
            <circle cx="45" cy="32" r="12" />
            <circle cx="32" cy="45" r="12" />
            <circle cx="19" cy="32" r="12" />
            <circle cx="32" cy="32" r="12" />
          </g>
          {eyes(32, 32)}
        </>
      );
    case "human":
      return <circle cx="32" cy="32" r="22" fill={color} />;
    case "system":
      return (
        <>
          <circle cx="32" cy="32" r="20" fill={color} />
          {eyes(32, 32)}
        </>
      );
  }
}

export function AgentAvatar({
  seat,
  size = 40,
  busy = false,
  dimmed = false,
  happy = false,
  className,
}: {
  seat: Seat;
  size?: number;
  busy?: boolean; // gently bobs while this seat is working
  dimmed?: boolean; // hasn't had its turn yet
  happy?: boolean; // ^ ^ eyes: this agent has the case right now
  className?: string;
}) {
  const agent = AGENTS[seat];
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", busy && "agent-busy", dimmed && "opacity-35 grayscale", className)}
      style={{ width: size, height: size }}
      title={`${agent.name} · ${agent.role}`}
    >
      <svg viewBox="7 7 50 50" width={size} height={size} aria-hidden>
        <Body seat={seat} color={agent.color} happy={happy} />
      </svg>
      {seat === "human" && <User className="absolute text-[#20497A]" style={{ width: size * 0.42, height: size * 0.42 }} aria-hidden />}
    </span>
  );
}

export function agentName(seat: Seat) {
  return AGENTS[seat].name;
}
