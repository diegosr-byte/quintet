"use client";

// Compact timeline for case lists: only the agent holding the case is shown (with happy ^ ^ eyes);
// the chevron drops down the full five-step timeline.
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Doc } from "@/convex/_generated/dataModel";
import { AgentAvatar, AGENTS } from "@/components/agents";
import { PipelineSteps, STEPS, stepState } from "@/components/case-ui";
import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  working: "bg-[#E6ECFF] text-[#2D4BA6]",
  waiting: "bg-[#FFF1C9] text-[#7A4E00]",
  stopped: "bg-[#FFE1E4] text-[#A3182B]",
  done: "bg-[#DCF5E7] text-[#0F6B3E]",
};

export function AgentTimeline({ c, id }: { c: Pick<Doc<"cases">, "status" | "amountCents" | "verdict">; id: string }) {
  const [open, setOpen] = useState(false);
  const { at, tone } = stepState(c);
  // A paid case has finished every step; show Penny, who did the last one.
  const index = Math.min(at, STEPS.length - 1);
  const step = STEPS[index];
  const agent = AGENTS[step.seat];
  const panelId = `timeline-${id}`;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "group inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-base font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          TONE_CLASSES[tone],
        )}
      >
        <AgentAvatar seat={step.seat} size={30} happy busy={tone === "working"} />
        <span>
          <span className="font-semibold">{agent.name}</span>
          <span className="opacity-75"> · {step.label}</span>
        </span>
        <span className="text-sm tabular-nums opacity-60">
          {index + 1}/{STEPS.length}
        </span>
        <ChevronDown className={cn("size-4 opacity-60 transition-transform duration-200 group-hover:opacity-100", open && "rotate-180")} aria-hidden />
        <span className="sr-only">{open ? "Hide" : "Show"} the full timeline</span>
      </button>
      {open && (
        <div id={panelId} className="overflow-x-auto rounded-2xl bg-muted/60 p-3">
          <PipelineSteps c={c} />
        </div>
      )}
    </div>
  );
}
