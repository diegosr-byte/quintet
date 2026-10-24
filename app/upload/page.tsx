"use client";

// Phone-friendly receipt capture: pick who's being reimbursed, snap the receipt, send it to Ivy.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { Camera, LoaderCircle, RotateCcw, Send } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/agents";
import { SyntheticBadge } from "@/components/case-ui";
import { cn } from "@/lib/utils";

// Seeded employees (convex/seed.ts). ingest() rejects anything that isn't an employee on file.
const EMPLOYEES = ["A", "B", "C", "D"].map((l) => ({ key: `employee${l}`, name: `Employee ${l}` }));

export default function UploadPage() {
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const ingest = useMutation(api.documents.ingest);
  const [employee, setEmployee] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<Id<"cases"> | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const send = async () => {
    if (!file || !employee) return;
    setBusy(true);
    setError(null);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const id = await ingest({
        storageId,
        source: "upload",
        fileName: file.name || "receipt.jpg",
        mimeType: file.type || "image/jpeg",
        kind: "receipt",
        submittedByPartyKey: employee,
      });
      setCaseId(id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message.match(/Uncaught Error: (.*?)(\n|$)/)?.[1] ?? message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null);
    setCaseId(null);
    setError(null);
  };

  if (caseId) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 p-6 text-center text-lg">
        <AgentAvatar seat="intake" size={96} happy busy />
        <h1 className="text-3xl font-bold text-primary">Got it!</h1>
        <p className="text-muted-foreground">Ivy is reading your receipt. The team will take it from here.</p>
        <Button asChild size="lg" className="h-14 w-full rounded-full text-lg">
          <Link href={`/case/${caseId}`}>Watch it go</Link>
        </Button>
        <Button variant="ghost" size="lg" onClick={reset} className="h-12 rounded-full text-lg">
          <RotateCcw aria-hidden /> Send another
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-6 p-5 pb-28 text-lg">
      <header className="flex items-center gap-3 pt-2">
        <AgentAvatar seat="intake" size={52} />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-primary">Send a receipt</h1>
            <SyntheticBadge />
          </div>
          <p className="text-base text-muted-foreground">Ivy reads it, the team checks it.</p>
        </div>
      </header>

      <section className="soft-card space-y-3 p-5" aria-labelledby="who-heading">
        <h2 id="who-heading" className="font-semibold">
          1. Who&apos;s being reimbursed?
        </h2>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="who-heading">
          {EMPLOYEES.map((p) => (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={employee === p.key}
              onClick={() => setEmployee(p.key)}
              className={cn(
                "h-14 rounded-2xl border text-lg font-medium transition-colors",
                employee === p.key ? "border-[#A8BEFF] bg-[#EEF2FF] text-[#2D4BA6]" : "bg-card hover:bg-muted",
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      </section>

      <section className="soft-card space-y-3 p-5" aria-labelledby="snap-heading">
        <h2 id="snap-heading" className="font-semibold">
          2. Snap the receipt
        </h2>
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed bg-muted/50 text-muted-foreground transition-colors hover:bg-muted",
            preview ? "p-0" : "h-48",
          )}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Receipt to send" className="max-h-96 w-full object-contain" />
          ) : (
            <>
              <Camera className="size-10" aria-hidden />
              <span>Tap to take a photo</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {preview && <p className="text-center text-base text-muted-foreground">Tap the photo to retake it.</p>}
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-[#FFE1E4] px-4 py-3 font-semibold text-[#A3182B]">
          {error}
        </p>
      )}

      <Button size="lg" onClick={() => void send()} disabled={!file || !employee || busy} className="h-14 w-full rounded-full text-lg [&_svg]:size-5">
        {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {busy ? "Sending…" : "Send to Ivy"}
      </Button>
    </main>
  );
}
