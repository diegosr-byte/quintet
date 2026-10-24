"use client";

// A section whose header is the toggle: closed by default to keep pages calm, with a count so you
// know what's inside before opening it.
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Collapsible({
  title,
  count,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  count?: number | string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className={className}>
      <h2 className="mb-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={id}
          className="group flex w-full items-center gap-2 rounded-xl text-left text-2xl font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {title}
          {count !== undefined && <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium tabular-nums text-muted-foreground">{count}</span>}
          <ChevronDown className={cn("ml-auto size-5 text-muted-foreground transition-transform group-hover:text-foreground", open && "rotate-180")} aria-hidden />
        </button>
      </h2>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
