// Capital One Nessie sandbox client. Only payments.execute may call createTransfer.
// Nessie data is public: send synthetic names only.
// Units: account balances are dollars, but transfer amounts are integer CENTS. The sandbox's TransferCreate
// types amount as an integer and truncates floats (1.23 -> 1, 0.5 -> 0; a string is a 400; checked live
// 2026-10-24). Transfers don't move balances in the sandbox, so the field is only a record, and cents keep it exact.
const BASE = "https://api.nessieisreal.com";

function key(): string {
  const k = process.env.NESSIE_API_KEY;
  if (!k) throw new Error("NESSIE_API_KEY is not set on this deployment");
  return k;
}

async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}${path}${sep}key=${encodeURIComponent(key())}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Nessie ${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// The classic API answers POSTs with { objectCreated: { _id } }; the current spec documents a bare
// string. Take the id when it's there, otherwise the caller looks the new object up.
function createdId(res: unknown): string | null {
  const obj = (res as { objectCreated?: { _id?: string } } | null)?.objectCreated;
  return obj?._id ?? null;
}

type NessieCustomer = { _id: string; first_name: string; last_name: string };
type NessieAccount = { _id: string; nickname: string; balance: number };
// POST answers with objectCreated._id, but GET /accounts/{id}/transfers lists each transfer as `id` (checked live 2026-10-24).
type NessieTransfer = { _id?: string; id?: string; description?: string; amount: number; status?: string };

export async function createCustomer(firstName: string, lastName: string): Promise<string> {
  const res = await call("POST", "/customers", {
    first_name: firstName,
    last_name: lastName,
    address: { street_number: "1", street_name: "Synthetic Way", city: "Berkeley", state: "CA", zip: "94704" },
  });
  const id = createdId(res);
  if (id) return id;
  const all = (await call("GET", "/customers")) as NessieCustomer[];
  const match = all.filter((c) => c.first_name === firstName && c.last_name === lastName).pop();
  if (!match) throw new Error(`Nessie customer ${firstName} ${lastName} not found after create`);
  return match._id;
}

export async function createCheckingAccount(customerId: string, nickname: string, balanceDollars: number): Promise<string> {
  const res = await call("POST", `/customers/${customerId}/accounts`, {
    type: "Checking",
    nickname,
    rewards: 0,
    balance: balanceDollars,
  });
  const id = createdId(res);
  if (id) return id;
  const accounts = (await call("GET", `/customers/${customerId}/accounts`)) as NessieAccount[];
  const match = accounts.filter((a) => a.nickname === nickname).pop();
  if (!match) throw new Error(`Nessie account ${nickname} not found after create`);
  return match._id;
}

export async function getAccount(accountId: string): Promise<NessieAccount> {
  return (await call("GET", `/accounts/${accountId}`)) as NessieAccount;
}

async function listOutgoingTransfers(fromAccountId: string): Promise<NessieTransfer[]> {
  try {
    return (await call("GET", `/accounts/${fromAccountId}/transfers?type=payer`)) as NessieTransfer[];
  } catch (e) {
    if (String((e as Error).message).includes("No transfers found")) return []; // Nessie 404s on an account with no transfers yet
    throw e;
  }
}

// A tagged transfer whose stored amount isn't ours is never "already paid": throw, so the payment fails visibly
// instead of being marked paid (or sent a second time).
function checkAmount(t: NessieTransfer, tag: string, amountCents: number): void {
  if (t.amount !== amountCents) {
    throw new Error(`Nessie transfer ${tag} stored amount ${t.amount}, expected ${amountCents} cents`);
  }
}

// Idempotency: Nessie has none, so every transfer carries our tag and we look for it before sending.
export async function findTransferByTag(fromAccountId: string, tag: string, amountCents: number): Promise<string | null> {
  const transfers = await listOutgoingTransfers(fromAccountId);
  const t = transfers.find((t) => t.description?.includes(tag));
  if (!t) return null;
  checkAmount(t, tag, amountCents);
  return t._id ?? t.id ?? null;
}

export async function createTransfer(args: {
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  tag: string;
  memo: string;
}): Promise<string> {
  if (!Number.isInteger(args.amountCents) || args.amountCents <= 0) {
    throw new Error(`Nessie transfer ${args.tag}: amount must be positive integer cents, got ${args.amountCents}`);
  }
  const res = await call("POST", `/accounts/${args.fromAccountId}/transfers`, {
    // The sandbox's TransferCreate takes only status, amount, date and description (medium and payee_id are rejected),
    // so the payee travels in the description, like the other teams' records. The dollar figure is for people
    // reading Nessie; `amount` is cents (see the top of this file).
    status: "completed",
    amount: args.amountCents,
    transaction_date: new Date().toISOString().slice(0, 10),
    description: `${args.tag} $${(args.amountCents / 100).toFixed(2)} ${args.memo} -> ${args.toAccountId}`.slice(0, 140),
  });
  const created = (res as { objectCreated?: NessieTransfer } | null)?.objectCreated;
  if (created?._id) {
    checkAmount(created, args.tag, args.amountCents);
    return created._id;
  }
  const id = await findTransferByTag(args.fromAccountId, args.tag, args.amountCents);
  if (!id) throw new Error(`Nessie transfer ${args.tag} not found after create`);
  return id;
}
