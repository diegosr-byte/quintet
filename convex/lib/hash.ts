export async function sha256Hex(data: string | ArrayBuffer): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// bankOnFile.fingerprint = sha256(routing + account), docs/contracts.md §3
export function bankFingerprint(routingNumber: string, accountNumber: string): Promise<string> {
  return sha256Hex(routingNumber.replace(/\D/g, "") + accountNumber.replace(/\D/g, ""));
}
