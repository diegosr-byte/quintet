import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTransfer, findTransferByTag } from "./nessie";

// Shape copied from a live GET /accounts/{id}/transfers?type=payer (2026-10-24): `id`, not `_id`. Amount is cents.
const LISTED = [
  {
    id: "93555615-cdfb-45bc-8b48-65db67803bbe",
    transaction_date: "2026-10-24",
    status: "completed",
    amount: 123,
    description: "QT-40cad2626465 $1.23 Synthetic Vendor INV-1 -> a92bd34a",
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
    expect(await findTransferByTag("acct", "QT-40cad2626465", 123)).toBe("93555615-cdfb-45bc-8b48-65db67803bbe");
  });

  it("returns null when no transfer carries the tag", async () => {
    mockFetch(200, LISTED);
    expect(await findTransferByTag("acct", "QT-000000000000", 123)).toBeNull();
  });

  it("returns null when the account has no transfers yet (Nessie 404s)", async () => {
    mockFetch(404, '"No transfers found for this account"');
    expect(await findTransferByTag("acct", "QT-40cad2626465", 123)).toBeNull();
  });

  it("throws when the tagged transfer stored a different amount, so it is never marked paid", async () => {
    mockFetch(200, [{ ...LISTED[0], amount: 1 }]); // what a $1.23 sent as dollars looked like: truncated to 1
    await expect(findTransferByTag("acct", "QT-40cad2626465", 123)).rejects.toThrow(/stored amount 1, expected 123/);
  });

  it("throws on other errors, so execute retries instead of sending blind", async () => {
    mockFetch(500, "boom");
    await expect(findTransferByTag("acct", "QT-40cad2626465", 123)).rejects.toThrow(/500/);
  });
});

// Shape copied from a live POST /accounts/{id}/transfers (2026-10-24).
function created(amount: number) {
  return {
    code: 201,
    message: "Transfer created",
    objectCreated: { transaction_date: "2026-10-24", status: "completed", amount, description: "x", _id: "a2545235" },
  };
}

describe("createTransfer", () => {
  const args = { fromAccountId: "from", toAccountId: "to", amountCents: 123, tag: "QT-40cad2626465", memo: "Synthetic Vendor INV-1" };
  beforeEach(() => vi.stubEnv("NESSIE_API_KEY", "test-key"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends integer cents, with the dollar figure in the description", async () => {
    mockFetch(201, created(123));
    expect(await createTransfer(args)).toBe("a2545235");
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.amount).toBe(123);
    expect(body.description).toBe("QT-40cad2626465 $1.23 Synthetic Vendor INV-1 -> to");
  });

  it("throws when Nessie stored a different amount", async () => {
    mockFetch(201, created(1));
    await expect(createTransfer(args)).rejects.toThrow(/stored amount 1, expected 123/);
  });

  it("refuses fractional cents before calling Nessie", async () => {
    mockFetch(201, created(123));
    await expect(createTransfer({ ...args, amountCents: 12.5 })).rejects.toThrow(/integer cents/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
