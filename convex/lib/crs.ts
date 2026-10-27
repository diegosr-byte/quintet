// CRS sandbox client. THE ALLOWLIST IS THE ONLY PATH.
// The sandbox forwards any request that doesn't exactly match a test persona to the REAL bureau, so:
// - callers pass only a persona id; every request body below is a constant copied verbatim from
//   get_test_data (@crscreditapi/crs-calhacks-mcp-server@1.1.2, personas.json, CalHacks13(20261022));
// - document text, judge input and callTargetPhone are only ever compared against these constants, never sent;
// - a failed login is never retried (repeated failures disable the account).
// No Convex imports, so the guard is unit-testable (crs.test.ts).
const BASE = "https://api-sandbox.stitchcredit.com/api";

export const PERSONAS = {
  P01: {
    name: "MARGARET OKAFOR",
    phone: "5550101001",
    email: "margaret.okafor@example.com",
    identity: {"firstName": "MARGARET", "lastName": "OKAFOR", "ssn": "666701001", "dob": "1984-03-14", "street1": "1420 WILLOW CREEK DR", "city": "SAN JOSE", "state": "CA", "zip": "95125"},
    fraudFinder: {"firstName": "MARGARET", "lastName": "OKAFOR", "phoneNumber": "5550101001", "email": "margaret.okafor@example.com", "ipAddress": "203.0.113.11", "address": {"addressLine1": "1420 WILLOW CREEK DR", "city": "SAN JOSE", "state": "CA", "postalCode": "95125"}},
    reverse: {"phoneNumber": "5550101001"},
  },
  P12: {
    name: "VICTOR ANAND",
    phone: "5550101012",
    email: "v.anand.1968@example.com",
    identity: {"firstName": "VICTOR", "lastName": "ANAND", "ssn": "666701012", "dob": "1968-08-08", "street1": "55 WATER ST FL 20", "city": "NEW YORK", "state": "NY", "zip": "10041"},
    fraudFinder: {"firstName": "VICTOR", "lastName": "ANAND", "phoneNumber": "5550101012", "email": "v.anand.1968@example.com", "ipAddress": "198.51.100.12", "address": {"addressLine1": "55 WATER ST FL 20", "city": "NEW YORK", "state": "NY", "postalCode": "10041"}},
    reverse: {"phoneNumber": "5550101012"},
  },
  P13: {
    name: "KAYLA BRENNAN",
    phone: "5550101013",
    email: "kb.9921x@example.com",
    identity: {"firstName": "KAYLA", "lastName": "BRENNAN", "ssn": "666701013", "dob": "1999-12-24", "street1": "9021 KINGSTON PIKE", "city": "KNOXVILLE", "state": "TN", "zip": "37923"},
    fraudFinder: {"firstName": "KAYLA", "lastName": "BRENNAN", "phoneNumber": "5550101013", "email": "kb.9921x@example.com", "ipAddress": "198.51.100.13", "address": {"addressLine1": "9021 KINGSTON PIKE", "city": "KNOXVILLE", "state": "TN", "postalCode": "37923"}},
    reverse: {"phoneNumber": "5550101013"},
  },
  P14: {
    name: "HAROLD PETTIGREW",
    phone: "5550101014",
    email: "harold.pettigrew@example.com",
    identity: {"firstName": "HAROLD", "lastName": "PETTIGREW", "ssn": "666701014", "dob": "1948-01-19", "street1": "310 ELM ST", "city": "DAYTON", "state": "OH", "zip": "45402"},
    fraudFinder: {"firstName": "HAROLD", "lastName": "PETTIGREW", "phoneNumber": "5550101014", "email": "harold.pettigrew@example.com", "ipAddress": "203.0.113.24", "address": {"addressLine1": "310 ELM ST", "city": "DAYTON", "state": "OH", "postalCode": "45402"}},
    reverse: {"phoneNumber": "5550101014"},
  },
  P16: {
    name: "SAMUEL OYELARAN",
    phone: "5550101016",
    email: "samuel.oyelaran@example.com",
    identity: {"firstName": "SAMUEL", "lastName": "OYELARAN", "ssn": "666701016", "dob": "1977-06-12", "street1": "1200 BRICKELL BAY DR APT 2203", "city": "MIAMI", "state": "FL", "zip": "33131"},
    fraudFinder: {"firstName": "SAMUEL", "lastName": "OYELARAN", "phoneNumber": "5550101016", "email": "samuel.oyelaran@example.com", "ipAddress": "203.0.113.26", "address": {"addressLine1": "1200 BRICKELL BAY DR APT 2203", "city": "MIAMI", "state": "FL", "postalCode": "33131"}},
    reverse: {"phoneNumber": "5550101016"},
  },
  P19: {
    name: "GRACE NAKAMURA",
    phone: "5550101019",
    email: "grace.nakamura@example.com",
    identity: {"firstName": "GRACE", "lastName": "NAKAMURA", "ssn": "666701019", "dob": "1976-09-16", "street1": "1850 SOLANO AVE", "city": "BERKELEY", "state": "CA", "zip": "94707"},
    fraudFinder: {"firstName": "GRACE", "lastName": "NAKAMURA", "phoneNumber": "5550101019", "email": "grace.nakamura@example.com", "ipAddress": "203.0.113.29", "address": {"addressLine1": "1850 SOLANO AVE", "city": "BERKELEY", "state": "CA", "postalCode": "94707"}},
    reverse: {"phoneNumber": "5550101019"},
  },
} as const;

export type PersonaId = keyof typeof PERSONAS;

export function isPersonaId(id: unknown): id is PersonaId {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(PERSONAS, id);
}

// Only a field that is purely a phone number counts; digits fished out of free text don't.
const phoneDigits = (s: string) =>
  /^[\d\s()+.-]+$/.test(s.trim()) ? s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "") : null;

// Which persona, if any, a document's contact details belong to. Exact match only.
export function personaForContact(phone: string | null, email: string | null): PersonaId | null {
  for (const id of Object.keys(PERSONAS) as PersonaId[]) {
    const p = PERSONAS[id];
    if (phone !== null && phoneDigits(phone) === p.phone) return id;
    if (email !== null && email.trim().toLowerCase() === p.email) return id;
  }
  return null;
}

export type CrsResult =
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string; loginFailed: boolean }
  | {
      status: "ok";
      personaId: PersonaId;
      identity: "pass" | "fail";
      identityMessages: { code: string; text: string }[];
      fraudAlert: boolean;
      fraudScore: number | null;
      reversePhone: "match" | "mismatch" | "skipped";
      reverseNames: string[];
    };

// TU message codes (guides/tu_identity_verification.md): 2101 address mismatch, 2201 SSN issued to another
// name, 2202 SSN issued before DOB, 2301 deceased; 2401 fraud alert = step up, not a failure.
const FRAUD_ALERT_CODE = "2401";

/* eslint-disable @typescript-eslint/no-explicit-any -- CRS responses are untyped third-party JSON */
let token: string | null = null;
let loginFailure: string | null = null; // per isolate; callers also persist it (crsLogin table)

async function post(path: string, body: unknown, auth: string | null): Promise<{ status: number; json: any }> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: JSON.stringify(body),
    });
    // 429 CRS962: wait Retry-After once. Never applies to login (see login()).
    if (res.status === 429 && auth && attempt === 0) {
      const wait = Math.min(Number(res.headers.get("Retry-After") ?? "2"), 10) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 300) };
    }
    return { status: res.status, json };
  }
}

async function login(): Promise<string> {
  if (token) return token;
  if (loginFailure) throw new Error(loginFailure);
  const username = process.env.CRS_USERNAME;
  const password = process.env.CRS_PASSWORD;
  if (!username || !password) throw new Error("CRS credentials not set");
  const res = await post("/users/login", { username, password }, null);
  if (res.status !== 200 || typeof res.json?.token !== "string") {
    loginFailure = `CRS login failed (${res.status}); not retrying`;
    throw new Error(loginFailure);
  }
  token = res.json.token as string;
  return token;
}

function apiError(res: { status: number; json: any }): string | null {
  if (res.status >= 400) return `HTTP ${res.status}: ${JSON.stringify(res.json?.codes ?? res.json?.messages ?? res.json).slice(0, 200)}`;
  if (Array.isArray(res.json?.errorMessages) && res.json.errorMessages.length) return JSON.stringify(res.json.errorMessages).slice(0, 200);
  return null;
}

// Runs identity verification, Fraud Finder and reverse phone for one allowlisted persona.
// loginBlocked: a login failure was already recorded on this deployment.
export async function runCrsChecks(personaId: unknown, opts: { loginBlocked: boolean }): Promise<CrsResult> {
  if (!isPersonaId(personaId)) return { status: "skipped", reason: "not an allowlisted persona" };
  if (!process.env.CRS_USERNAME || !process.env.CRS_PASSWORD) return { status: "skipped", reason: "CRS credentials not set on this deployment" };
  if (opts.loginBlocked) return { status: "skipped", reason: "an earlier CRS login failed; not retrying" };
  const p = PERSONAS[personaId];

  let auth: string;
  try {
    auth = await login();
  } catch (e) {
    return { status: "error", error: (e as Error).message, loginFailed: true };
  }

  const identityRes = await post("/transunion/identity-manager-verification/basic", p.identity, auth);
  const fraudRes = await post("/fraud-finder/fraud-finder", p.fraudFinder, auth);
  const reverseRes = await post("/accurate-append/reverse", p.reverse, auth);
  if (identityRes.status === 401 || fraudRes.status === 401 || reverseRes.status === 401) token = null;
  const err = apiError(identityRes) ?? apiError(fraudRes) ?? apiError(reverseRes);
  if (err) return { status: "error", error: err, loginFailed: false };

  const messages: { code: string; text: string }[] = (identityRes.json?.addOnProducts?.[0]?.idManagerVerification?.messages ?? []).map(
    (m: any) => ({ code: String(m.code), text: String(m.text ?? "") }),
  );
  const failing = messages.filter((m) => m.code !== FRAUD_ALERT_CODE);
  const records: any[] = reverseRes.json?.data?.records ?? [];
  const reverseNames = records.map((r) => `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim().toUpperCase());
  const score = fraudRes.json?.risk?.score;

  return {
    status: "ok",
    personaId,
    identity: failing.length ? "fail" : "pass",
    identityMessages: messages,
    fraudAlert: messages.some((m) => m.code === FRAUD_ALERT_CODE),
    fraudScore: typeof score === "number" ? score : null,
    reversePhone: records.length === 0 ? "skipped" : reverseNames.includes(p.name) ? "match" : "mismatch",
    reverseNames,
  };
}

// Test hook: reset the per-isolate login state.
export function _resetForTests() {
  token = null;
  loginFailure = null;
}
