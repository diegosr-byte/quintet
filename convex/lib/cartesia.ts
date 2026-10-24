// Cartesia client for the Caller seat. Demo mode is a web call: the browser talks to the managed
// agent over Cartesia's agent WebSocket, so no purchased number or phone line is needed.
// The API key stays on the server; the browser only ever gets a short-lived access token.
const BASE = "https://api.cartesia.ai";
export const CARTESIA_VERSION = "2026-08-14";

export function agentSocketUrl(agentId: string, token: string): string {
  return `wss://api.cartesia.ai/v1/agents/websocket/${encodeURIComponent(agentId)}?cartesia_version=${CARTESIA_VERSION}&access_token=${encodeURIComponent(token)}`;
}

// Mints a token that can open the agent WebSocket and nothing else (no TTS or STT).
export async function mintAgentToken(apiKey: string, expiresInSeconds: number): Promise<string> {
  const res = await fetch(`${BASE}/access-token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Cartesia-Version": CARTESIA_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grants: { agent: true }, expires_in: expiresInSeconds }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Cartesia access-token -> ${res.status}: ${text.slice(0, 300)}`);
  const token = (JSON.parse(text) as { token?: unknown }).token;
  if (typeof token !== "string") throw new Error("Cartesia access-token: no token in the response");
  return token;
}
