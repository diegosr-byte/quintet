"use client";

// Placeholder from the scaffold so the pipeline can be watched live. Kai owns app/**: replace freely.
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function Home() {
  const cases = useQuery(api.cases.list, {});
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Quintet</h1>
      <p className="text-sm text-muted-foreground">Claude proposes. Code countersigns.</p>
      <ul className="mt-6 space-y-2">
        {cases?.map((c) => (
          <li key={c._id} className="rounded border p-3 text-sm">
            <span className="font-medium">{c.partyName ?? c.fileName}</span> · {c.status} · {c.verdict ?? "-"}
            {c.amountCents !== null && ` · $${(c.amountCents / 100).toFixed(2)}`}
            {c.reasons.length > 0 && <div className="text-muted-foreground">{c.reasons.join(" ")}</div>}
          </li>
        ))}
      </ul>
    </main>
  );
}
