"use client";

// Phone-friendly receipt upload: pick who's being reimbursed, take photos or choose files (photos or
// PDFs, several at once), and send each one to Ivy as its own case.
//
// What intake needs (convex/intakeNode.ts, lib/claude.ts): PDFs, or images Claude accepts (JPEG, PNG,
// GIF, WebP) under ~5 MB. Anything else (HEIC from iPhones, huge photos) is converted to JPEG here.
// Files that already fit are sent byte-for-byte so duplicate detection by hash (R6) stays exact.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { Camera, CircleCheck, FileText, FolderOpen, LoaderCircle, RotateCcw, Send, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/agents";
import { SyntheticBadge } from "@/components/case-ui";
import { cn } from "@/lib/utils";

// Seeded employees (convex/seed.ts). ingest() rejects anything that isn't an employee on file.
const EMPLOYEES = ["A", "B", "C", "D"].map((l) => ({ key: `employee${l}`, name: `Employee ${l}` }));

const CLAUDE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024; // under Claude's 5 MB per-image limit, with headroom
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_EDGE_PX = 2400; // plenty for receipt text; keeps converted photos small
const MAX_FILES = 10;

type Item = {
  id: string;
  file: File;
  preview: string | null; // object URL for images
  status: "ready" | "sending" | "sent" | "error";
  note: string | null; // e.g. "Converted from HEIC" or the error
  caseId: Id<"cases"> | null;
};

// Make a file intake can read. Returns the file to send plus a note when it had to change.
async function prepare(file: File): Promise<{ file: File; note: string | null }> {
  const type = file.type || guessType(file.name);
  if (type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) throw new Error("This PDF is over 20 MB.");
    return { file: type === file.type ? file : new File([file], file.name, { type }), note: null };
  }
  if (!type.startsWith("image/")) throw new Error("Only photos and PDFs can be sent.");
  if (CLAUDE_IMAGE_TYPES.includes(type) && file.size <= MAX_IMAGE_BYTES) return { file, note: null };

  // Re-encode as JPEG: unsupported format (e.g. HEIC) or too large.
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Can't read this photo format. Take a screenshot of it, or save it as JPEG.");
  }
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#fff"; // transparent PNGs become white, not black
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error("This photo is too large to send.");
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  const why = CLAUDE_IMAGE_TYPES.includes(type) ? "Resized to send" : `Converted from ${type.replace("image/", "").toUpperCase()}`;
  return { file: new File([blob], name, { type: "image/jpeg" }), note: why };
}

function sizeLabel(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Some phones hand over files with no type (often HEIC); fall back to the extension.
function guessType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "heic" || ext === "heif") return "image/heic";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext && ["png", "gif", "webp"].includes(ext)) return `image/${ext}`;
  return "";
}

export default function UploadPage() {
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const ingest = useMutation(api.documents.ingest);
  const [employee, setEmployee] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urls = useRef(new Set<string>());

  // Release preview URLs when the page goes away.
  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const update = (id: string, patch: Partial<Item>) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const room = MAX_FILES - items.filter((it) => it.status !== "sent").length;
    const picked = Array.from(files).slice(0, Math.max(room, 0));
    if (picked.length < files.length) setError(`You can send up to ${MAX_FILES} at a time.`);
    const added = picked.map((file) => {
      const isImage = (file.type || guessType(file.name)).startsWith("image/");
      const preview = isImage ? URL.createObjectURL(file) : null;
      if (preview) urls.current.add(preview);
      return { id: crypto.randomUUID(), file, preview, status: "ready" as const, note: null, caseId: null };
    });
    setItems((prev) => [...prev.filter((it) => it.status !== "sent"), ...added]);
  };

  const remove = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  const sendAll = async () => {
    if (!employee) return;
    setSending(true);
    setError(null);
    // One at a time: each file becomes its own case, in the order picked.
    for (const it of items.filter((i) => i.status === "ready" || i.status === "error")) {
      update(it.id, { status: "sending", note: null });
      try {
        const { file, note } = await prepare(it.file);
        const url = await generateUploadUrl();
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        const caseId = await ingest({
          storageId,
          source: "upload",
          fileName: file.name,
          mimeType: file.type,
          kind: "receipt",
          submittedByPartyKey: employee,
        });
        update(it.id, { status: "sent", caseId, note });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        update(it.id, { status: "error", note: message.match(/Uncaught Error: (.*?)(\n|$)/)?.[1] ?? message });
      }
    }
    setSending(false);
  };

  const sent = items.filter((it) => it.status === "sent");
  const pending = items.filter((it) => it.status !== "sent");
  const allSent = items.length > 0 && pending.length === 0;

  if (allSent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 p-6 text-center text-lg">
        <AgentAvatar seat="intake" size={96} happy busy />
        <h1 className="text-3xl font-bold text-primary">Got {sent.length === 1 ? "it" : `all ${sent.length}`}!</h1>
        <p className="text-muted-foreground">
          Ivy is reading {sent.length === 1 ? "your receipt" : "them now"}. The team will take it from here.
        </p>
        <ul className="w-full space-y-2 text-left">
          {sent.map((it) => (
            <li key={it.id}>
              <Link href={`/case/${it.caseId}`} className="soft-card flex items-center justify-between gap-3 px-4 py-3 hover:shadow-md">
                <span className="truncate">{it.file.name}</span>
                <span className="shrink-0 text-base font-semibold text-primary">Watch it go →</span>
              </Link>
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="lg" onClick={() => setItems([])} className="h-12 rounded-full text-lg">
          <RotateCcw aria-hidden /> Send more
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
            <h1 className="text-2xl font-bold text-primary">Send receipts</h1>
            <SyntheticBadge />
          </div>
          <p className="text-base text-muted-foreground">Ivy reads them, the team checks them.</p>
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

      <section className="soft-card space-y-3 p-5" aria-labelledby="files-heading">
        <h2 id="files-heading" className="font-semibold">
          2. Add receipts
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <PickButton icon={<Camera aria-hidden />} label="Take photo" accept="image/*" capture onPick={add} disabled={sending} />
          <PickButton icon={<FolderOpen aria-hidden />} label="Choose files" accept="image/*,application/pdf,.heic,.heif" multiple onPick={add} disabled={sending} />
        </div>
        <p className="text-sm text-muted-foreground">Photos or PDFs, up to {MAX_FILES} at a time. Each one becomes its own case.</p>

        {pending.length > 0 && (
          <ul className="space-y-2">
            {pending.map((it) => (
              <li key={it.id} className="flex items-center gap-3 rounded-2xl border bg-card p-2 pr-3">
                <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                  {it.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.preview} alt="" className="size-full object-cover" onError={() => update(it.id, { preview: null })} />
                  ) : (
                    <FileText className="size-6 text-muted-foreground" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium">{it.file.name || "Photo"}</span>
                  <span className={cn("block text-sm", it.status === "error" ? "text-[#A3182B]" : "text-muted-foreground")}>
                    {it.status === "sending" ? "Sending…" : (it.note ?? sizeLabel(it.file.size))}
                  </span>
                </span>
                {it.status === "sending" ? (
                  <LoaderCircle className="size-5 shrink-0 animate-spin text-muted-foreground" aria-label="Sending" />
                ) : (
                  <button
                    type="button"
                    onClick={() => remove(it.id)}
                    disabled={sending}
                    aria-label={`Remove ${it.file.name}`}
                    className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {sent.length > 0 && (
          <ul className="space-y-1.5">
            {sent.map((it) => (
              <li key={it.id}>
                <Link href={`/case/${it.caseId}`} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-base hover:bg-muted">
                  <CircleCheck className="size-5 shrink-0 text-[#0F6B3E]" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{it.file.name}</span>
                  <span className="shrink-0 font-semibold text-primary">Watch →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-[#FFE1E4] px-4 py-3 font-semibold text-[#A3182B]">
          {error}
        </p>
      )}

      <Button
        size="lg"
        onClick={() => void sendAll()}
        disabled={!employee || pending.length === 0 || sending}
        className="h-14 w-full rounded-full text-lg [&_svg]:size-5"
      >
        {sending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {sending ? "Sending…" : pending.length > 1 ? `Send ${pending.length} to Ivy` : "Send to Ivy"}
      </Button>
      {!employee && pending.length > 0 && <p className="-mt-3 text-center text-base text-muted-foreground">Pick who&apos;s being reimbursed first.</p>}
    </main>
  );
}

function PickButton({
  icon,
  label,
  accept,
  capture = false,
  multiple = false,
  disabled,
  onPick,
}: {
  icon: React.ReactNode;
  label: string;
  accept: string;
  capture?: boolean;
  multiple?: boolean;
  disabled: boolean;
  onPick: (files: FileList | null) => void;
}) {
  return (
    <label
      className={cn(
        "flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed bg-muted/50 text-base font-medium text-muted-foreground transition-colors hover:bg-muted [&_svg]:size-7",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {icon}
      {label}
      <input
        type="file"
        accept={accept}
        {...(capture && { capture: "environment" as const })}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = ""; // allow picking the same file again
        }}
      />
    </label>
  );
}
