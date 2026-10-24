// The one place that builds Claude requests. Intake calls carry no tools: documents are untrusted.
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const USD_PER_INPUT_TOKEN = 4 / 1_000_000;
const USD_PER_OUTPUT_TOKEN = 20 / 1_000_000;

type Effort = "low" | "medium";

export type StructuredResult<T> =
  | { ok: true; value: T; costUsd: number }
  | { ok: false; error: string; costUsd: number };

export type Attachment = { mimeType: string; base64: string };

function attachmentBlock(a: Attachment): Anthropic.Beta.BetaContentBlockParam {
  if (a.mimeType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: a.base64 } };
  }
  if (a.mimeType.startsWith("text/")) {
    return { type: "document", source: { type: "text", media_type: "text/plain", data: atob(a.base64) } };
  }
  const media = a.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  return { type: "image", source: { type: "base64", media_type: media, data: a.base64 } };
}

// One request, structured JSON out. Stable text (system prompt) goes first so it caches.
export async function structured<T>(args: {
  system: string;
  userText: string;
  attachment?: Attachment;
  schema: Record<string, unknown>;
  effort: Effort;
}): Promise<StructuredResult<T>> {
  const client = new Anthropic();
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (args.attachment) content.push(attachmentBlock(args.attachment));
  content.push({ type: "text", text: args.userText });

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: [{ type: "text", text: args.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { effort: args.effort, format: { type: "json_schema", schema: args.schema } },
  });

  const costUsd =
    (response.usage.input_tokens +
      (response.usage.cache_creation_input_tokens ?? 0) * 1.25 +
      (response.usage.cache_read_input_tokens ?? 0) * 0.1) *
      USD_PER_INPUT_TOKEN +
    response.usage.output_tokens * USD_PER_OUTPUT_TOKEN;

  if (response.stop_reason === "refusal") {
    return { ok: false, error: `refused (${response.stop_details?.category ?? "no category"})`, costUsd };
  }
  if (response.stop_reason === "max_tokens") {
    return { ok: false, error: "output hit max_tokens", costUsd };
  }
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return { ok: true, value: JSON.parse(text) as T, costUsd };
  } catch {
    return { ok: false, error: "output was not valid JSON", costUsd };
  }
}
