"use client";

// Ask Quintet: tap to talk (or type), and Cora answers out loud from the case record.
// Recording uses MediaRecorder; the clip goes to Convex storage and ask.answer transcribes it.
import { useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { LoaderCircle, Mic, Send, Square, Volume2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/agents";
import { cn } from "@/lib/utils";

type Turn = { question: string; text: string; audioUrl: string | null };

const SUGGESTIONS = ["Why was this stopped?", "What happens next?", "Is it safe to pay?"];
// A tiny silent WAV, played once during a tap to unlock audio playback.
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export function AskPanel({ caseId }: { caseId: Id<"cases"> }) {
  const ask = useAction(api.ask.answer);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [typed, setTyped] = useState("");
  const [state, setState] = useState<"idle" | "recording" | "thinking">("idle");
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);

  // Stop the mic and any playback if the page goes away mid-question.
  useEffect(
    () => () => {
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
      audio.current?.pause();
    },
    [],
  );

  // One audio element, unlocked during the tap: the answer arrives seconds later, and Safari won't
  // start audio that long after a gesture unless the element was already played from one.
  const player = () => {
    if (!audio.current) {
      const a = new Audio();
      a.onplay = () => setSpeaking(true);
      a.onended = a.onpause = () => setSpeaking(false);
      audio.current = a;
    }
    return audio.current;
  };
  const unlock = () => {
    const a = player();
    if (a.src) return;
    a.src = SILENCE;
    void a.play().catch(() => {});
  };
  const play = (url: string) => {
    const a = player();
    a.pause();
    a.src = url;
    void a.play().catch(() => setSpeaking(false));
  };

  const submit = async (args: { question?: string; audioStorageId?: Id<"_storage"> }) => {
    unlock();
    setState("thinking");
    setError(null);
    try {
      const turn = await ask({ caseId, ...args });
      setTurns((prev) => [...prev, turn]);
      if (turn.audioUrl) play(turn.audioUrl);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message.match(/Uncaught Error: (.*?)(\n|$)/)?.[1] ?? message);
    } finally {
      setState("idle");
    }
  };

  const startRecording = async () => {
    unlock();
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const r = new MediaRecorder(stream, { mimeType: type });
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const clip = new Blob(chunks.current, { type });
        if (clip.size < 2000) {
          setState("idle");
          setError("That was too short. Tap, ask your question, then tap again.");
          return;
        }
        setState("thinking");
        try {
          const url = await generateUploadUrl();
          const res = await fetch(url, { method: "POST", headers: { "Content-Type": type }, body: clip });
          if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
          const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
          await submit({ audioStorageId: storageId });
        } catch (e) {
          setState("idle");
          setError(e instanceof Error ? e.message : String(e));
        }
      };
      recorder.current = r;
      r.start();
      setState("recording");
    } catch {
      setError("Couldn't use the microphone. Allow access, or type your question.");
    }
  };

  const stopRecording = () => recorder.current?.state === "recording" && recorder.current.stop();

  const sendTyped = () => {
    const q = typed.trim();
    if (!q || state !== "idle") return;
    setTyped("");
    void submit({ question: q });
  };

  return (
    <div className="space-y-4">
      {turns.length > 0 && (
        <ol className="space-y-3" aria-live="polite">
          {turns.map((t, i) => (
            <li key={i} className="space-y-2">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-muted px-3.5 py-2 text-base">{t.question}</div>
              <div className="flex items-start gap-2">
                <AgentAvatar seat="controller" size={30} happy={speaking && i === turns.length - 1} busy={speaking && i === turns.length - 1} className="mt-1" />
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-[#F5F0FF] px-3.5 py-2 text-base leading-relaxed">
                  {t.text}
                  {t.audioUrl && (
                    <button
                      type="button"
                      onClick={() => play(t.audioUrl!)}
                      className="ml-2 inline-flex translate-y-0.5 items-center text-[#5B3EA8] hover:opacity-70"
                      aria-label="Play the answer again"
                    >
                      <Volume2 className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={state !== "idle"}
              onClick={() => void submit({ question: s })}
              className="rounded-full border bg-card px-3.5 py-1.5 text-base transition-colors hover:bg-accent disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          onClick={state === "recording" ? stopRecording : () => void startRecording()}
          disabled={state === "thinking"}
          aria-label={state === "recording" ? "Stop and ask" : "Ask out loud"}
          className={cn(
            "size-12 shrink-0 rounded-full [&_svg]:size-5",
            state === "recording" ? "animate-pulse bg-[#C8243A] text-white hover:bg-[#A3182B]" : "bg-[#5B3EA8] text-white hover:bg-[#4A3290]",
          )}
        >
          {state === "recording" ? <Square aria-hidden /> : <Mic aria-hidden />}
        </Button>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendTyped()}
          disabled={state === "recording"}
          placeholder={state === "recording" ? "Listening… tap the square when you're done" : "Or type a question for Cora"}
          className="h-12 min-w-0 flex-1 rounded-full border bg-card px-4 text-lg"
          aria-label="Question for Cora"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={sendTyped}
          disabled={!typed.trim() || state !== "idle"}
          aria-label="Send question"
          className="size-12 shrink-0 rounded-full [&_svg]:size-5"
        >
          {state === "thinking" ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-[#FFE1E4] px-4 py-2 text-base font-semibold text-[#A3182B]">
          {error}
        </p>
      )}
    </div>
  );
}
