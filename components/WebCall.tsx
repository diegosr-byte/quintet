"use client";

// Demo-mode verification call: the vendor answers in this browser, which talks straight to Cal (the
// Cartesia agent) over its WebSocket. The server only mints a short-lived token; the API key never
// reaches the page. When Cal calls report_outcome, the outcome and transcript go back to Convex,
// which re-runs the gate. "Simulate 'no'" is the stage fallback if the mic or Cartesia misbehaves.
import { useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { Phone, PhoneOff } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

type Outcome = NonNullable<Doc<"calls">["outcome"]>;
type Line = { speaker: string; text: string };

const RATE = 16000;
const OUTCOMES: Outcome[] = ["confirmed_change", "denied_change", "unclear", "no_answer"];
// Time for Cal to say goodbye after reporting the outcome.
const HANGUP_AFTER_OUTCOME_MS = 4000;

// Convex wraps server errors ("[CONVEX A(calls:startWebCall)] … Uncaught Error: <message> at handler …");
// show just the message.
function readable(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  return message.match(/Uncaught Error: (.*?)(?: at handler|\n|$)/)?.[1]?.trim() ?? message;
}

function toBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Float32Array<ArrayBuffer> {
  const bin = atob(b64);
  const pcm = new Int16Array(bin.length >> 1);
  for (let i = 0; i < pcm.length; i++) pcm[i] = (bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) << 16 >> 16;
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 0x8000;
  return out;
}

export function WebCall({ callId, caseId, status }: { callId: Id<"calls">; caseId: Id<"cases">; status: Doc<"calls">["status"] }) {
  const startWebCall = useAction(api.calls.startWebCall);
  const answerWebCall = useMutation(api.calls.answerWebCall);
  const reportWebOutcome = useMutation(api.calls.reportWebOutcome);
  const simulate = useMutation(api.calls.simulate);

  const [phase, setPhase] = useState<"ringing" | "connecting" | "live" | "ending">("ringing");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const hangupRef = useRef<((outcome: Outcome) => Promise<void>) | null>(null);

  // Leaving the page mid-call hangs up and records "unclear" (unless Cal already reported an outcome).
  useEffect(() => () => void hangupRef.current?.("unclear"), []);

  async function answer() {
    setError(null);
    setPhase("connecting");
    let ws: WebSocket | null = null;
    let ctx: AudioContext | null = null;
    let mic: MediaStream | null = null;
    let cartesiaCallId: string | null = null;
    let outcome: Outcome | null = null;
    let done = false;
    const transcript: Line[] = [];
    const playing = new Set<AudioBufferSourceNode>();
    let playAt = 0;

    const hangup = async (fallback: Outcome) => {
      if (done) return;
      done = true;
      hangupRef.current = null;
      setPhase("ending");
      ws?.close(1000);
      mic?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
      if (cartesiaCallId) {
        try {
          await reportWebOutcome({ callId, cartesiaCallId, outcome: outcome ?? fallback, transcript });
        } catch (e) {
          setError(readable(e));
        }
      } else {
        setPhase("ringing");
      }
    };
    hangupRef.current = hangup;

    try {
      const { socketUrl, context } = await startWebCall({ callId });
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      ctx = new AudioContext({ sampleRate: RATE });
      const audio = ctx;
      const source = audio.createMediaStreamSource(mic);
      // ScriptProcessor is deprecated but needs no worklet file, and 4096 frames (~256 ms) is fine for a call.
      const proc = audio.createScriptProcessor(4096, 1, 1);
      source.connect(proc);
      proc.connect(audio.destination);

      ws = new WebSocket(socketUrl);
      const sock = ws;
      sock.onopen = () => sock.send(JSON.stringify({ type: "session_create", audio: { input_format: `pcm_${RATE}` } }));
      sock.onerror = () => setError("The call connection failed.");
      sock.onclose = () => void hangup("unclear");
      sock.onmessage = (msg) => {
        const ev = JSON.parse(String(msg.data)) as Record<string, unknown>;
        switch (ev.type) {
          case "session_ready":
            cartesiaCallId = String(ev.call_id);
            void answerWebCall({ callId, cartesiaCallId });
            setPhase("live");
            proc.onaudioprocess = (e) => {
              if (sock.readyState !== WebSocket.OPEN) return;
              const f = e.inputBuffer.getChannelData(0);
              const pcm = Int16Array.from(f, (x) => Math.max(-1, Math.min(1, x)) * 0x7fff);
              sock.send(JSON.stringify({ type: "audio_input", audio: toBase64(pcm) }));
            };
            break;
          case "audio_output": {
            const samples = fromBase64(String(ev.audio));
            const buf = audio.createBuffer(1, samples.length, RATE);
            buf.copyToChannel(samples, 0);
            const node = audio.createBufferSource();
            node.buffer = buf;
            node.connect(audio.destination);
            playAt = Math.max(playAt, audio.currentTime);
            node.start(playAt);
            playAt += buf.duration;
            playing.add(node);
            node.onended = () => playing.delete(node);
            break;
          }
          case "audio_output_clear":
            // The vendor started talking: stop Cal mid-sentence.
            playing.forEach((n) => n.stop());
            playing.clear();
            playAt = 0;
            break;
          case "turn_ended": {
            const text = typeof ev.text === "string" ? ev.text.trim() : "";
            if (!text) break;
            transcript.push({ speaker: ev.role === "user" ? "vendor" : "agent", text });
            setLines([...transcript]);
            break;
          }
          case "client_tool_call": {
            const name = String(ev.tool_name);
            const reply = (result: string, isError = false) =>
              ev.expects_response && sock.send(JSON.stringify({ type: "client_tool_result", tool_call_id: ev.tool_call_id, result, is_error: isError }));
            if (name === "get_call_context") {
              reply(JSON.stringify(context));
            } else if (name === "report_outcome") {
              const o = (ev.parameters as { outcome?: unknown } | null)?.outcome;
              if (OUTCOMES.includes(o as Outcome)) {
                outcome = o as Outcome;
                reply("Recorded.");
                setTimeout(() => void hangup("unclear"), HANGUP_AFTER_OUTCOME_MS);
              } else {
                reply(`outcome must be one of ${OUTCOMES.join(", ")}`, true);
              }
            } else {
              reply(`Unknown tool ${name}`, true);
            }
            break;
          }
          case "error":
            setError(String(ev.message ?? "Cartesia reported an error."));
            break;
        }
      };
    } catch (e) {
      setError(readable(e));
      await hangup("unclear");
    }
  }

  // Stage fallback: say the vendor's line out loud (speech synthesis works offline), then record it.
  function simulateNo() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance("No, we didn't change anything."));
    }
    void simulate({ caseId });
  }

  const live = phase === "live" || phase === "ending";
  return (
    <div className="space-y-3 border-t border-border/70 px-4 py-3">
      {live && lines.length > 0 && status !== "completed" && (
        <ol className="space-y-1 text-base" aria-live="polite">
          {lines.map((l, i) => (
            <li key={i}>
              <span className="font-semibold">{l.speaker === "agent" ? "Cal" : "Vendor"}:</span> {l.text}
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {phase === "ringing" || phase === "connecting" ? (
          <Button onClick={() => void answer()} disabled={phase === "connecting"} className="bg-[#1E8E4E] text-white hover:bg-[#17733F]">
            <Phone className="size-4" aria-hidden />
            {phase === "connecting" ? "Connecting…" : "Answer as the vendor"}
          </Button>
        ) : (
          <Button variant="outline" onClick={() => void hangupRef.current?.("unclear")} disabled={phase === "ending"}>
            <PhoneOff className="size-4" aria-hidden />
            {phase === "ending" ? "Ending…" : "Hang up"}
          </Button>
        )}
        <Button variant="ghost" onClick={simulateNo} title="Fallback: record the vendor saying they changed nothing">
          Simulate &ldquo;no&rdquo;
        </Button>
      </div>
      {error && <p className="text-sm text-[#A3182B]">{error}</p>}
    </div>
  );
}
