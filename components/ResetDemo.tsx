"use client";

// Reset between judges (docs/demo-script.md): repeat demos trip the daily cap (R5) and the duplicate and
// 7-day vendor rules (R6, R9), so the routine invoice starts coming back ASK. Diego's backend starts a
// fresh business, like the eval runner; this button just calls it.
import { useState } from "react";
import { useAction } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

// convex/seed.ts resetDemo. Referenced by name so the button builds without regenerated types.
const resetDemo = makeFunctionReference<"action", Record<string, never>, unknown>("seed:resetDemo");

export function ResetDemo() {
  const reset = useAction(resetDemo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (!window.confirm("Reset the demo? This starts a fresh business, so the board clears and limits start over.")) return;
    setBusy(true);
    setError(null);
    try {
      await reset({});
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(
        /Could not find public function/.test(message)
          ? "Reset isn't deployed yet."
          : (message.match(/Uncaught Error: (.*?)(\n|$)/)?.[1] ?? message),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="ghost" size="lg" onClick={() => void onClick()} disabled={busy} className="h-14 rounded-full px-5 text-lg text-muted-foreground [&_svg]:size-5">
        {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
        {busy ? "Resetting…" : "Reset demo"}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-[#A3182B]">
          {error}
        </span>
      )}
    </div>
  );
}
