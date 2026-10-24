// Capital One Nessie sandbox client. Only payments.execute may call createTransfer.
// Nessie data is public: send synthetic names only. Amounts on the wire are dollars.
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
type NessieTransfer = { _id: string; description?: string; amount: number; status?: string };

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
  return (await call("GET", `/accounts/${fromAccountId}/transfers?type=payer`)) as NessieTransfer[];
}

// Idempotency: Nessie has none, so every transfer carries our tag and we look for it before sending.
export async function findTransferByTag(fromAccountId: string, tag: string): Promise<string | null> {
  const transfers = await listOutgoingTransfers(fromAccountId);
  return transfers.find((t) => t.description?.includes(tag))?._id ?? null;
}

export async function createTransfer(args: {
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  tag: string;
  memo: string;
}): Promise<string> {
  const res = await call("POST", `/accounts/${args.fromAccountId}/transfers`, {
    medium: "balance",
    payee_id: args.toAccountId,
    amount: args.amountCents / 100,
    transaction_date: new Date().toISOString().slice(0, 10),
    description: `${args.tag} ${args.memo}`.slice(0, 140),
  });
  const id = createdId(res) ?? (await findTransferByTag(args.fromAccountId, args.tag));
  if (!id) throw new Error(`Nessie transfer ${args.tag} not found after create`);
  return id;
}
