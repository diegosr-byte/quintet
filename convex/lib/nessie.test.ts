import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findTransferByTag } from "./nessie";

// Shape copied from a live GET /accounts/{id}/transfers?type=payer (2026-10-24): `id`, not `_id`.
const LISTED = [
  {
    id: "93555615-cdfb-45bc-8b48-65db67803bbe",
    transaction_date: "2026-10-24",
    status: "completed",
    amount: 1,
    description: "QT-40cad2626465 Synthetic Vendor INV-1 -> a92bd34a",
  },
];

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })),
  );
}

describe("findTransferByTag", () => {
  beforeEach(() => vi.stubEnv("NESSIE_API_KEY", "test-key"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("finds a listed transfer whose id comes back as `id`", async () => {
    mockFetch(200, LISTED);
    expect(await findTransferByTag("acct", "QT-40cad2626465")).toBe("93555615-cdfb-45bc-8b48-65db67803bbe");
  });

  it("returns null when no transfer carries the tag", async () => {
    mockFetch(200, LISTED);
    expect(await findTransferByTag("acct", "QT-000000000000")).toBeNull();
  });

  it("returns null when the account has no transfers yet (Nessie 404s)", async () => {
    mockFetch(404, '"No transfers found for this account"');
    expect(await findTransferByTag("acct", "QT-40cad2626465")).toBeNull();
  });

  it("throws on other errors, so execute retries instead of sending blind", async () => {
    mockFetch(500, "boom");
    await expect(findTransferByTag("acct", "QT-40cad2626465")).rejects.toThrow(/500/);
  });
});
