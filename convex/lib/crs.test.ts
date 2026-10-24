import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PERSONAS, _resetForTests, personaForContact, runCrsChecks } from "./crs";

const TEAMMATE_PHONE = "+1 (510) 555-7788"; // stands in for DEMO_VENDOR_PHONE / callTargetPhone

const ALLOWLISTED_BODIES = Object.values(PERSONAS).flatMap((p) => [
  JSON.stringify(p.identity),
  JSON.stringify(p.fraudFinder),
  JSON.stringify(p.reverse),
]);

type Sent = { url: string; body: string };
let sent: Sent[];

function mockFetch(loginStatus = 200) {
  sent = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { body: string }) => {
      sent.push({ url, body: init.body });
      const json = url.endsWith("/users/login")
        ? loginStatus === 200
          ? { token: "t" }
          : { codes: ["CRS113"] }
        : url.includes("identity")
          ? { addOnProducts: [{ idManagerVerification: { messages: [{ code: "2201", text: "SSN issued to another name" }] } }] }
          : url.includes("fraud-finder")
            ? { risk: { score: 85 } }
            : { data: { records: [{ firstName: "RAJESH", lastName: "MENON" }] } };
      return new Response(JSON.stringify(json), { status: url.endsWith("/users/login") ? loginStatus : 200 });
    }),
  );
}

beforeEach(() => {
  _resetForTests();
  process.env.CRS_USERNAME = "user";
  process.env.CRS_PASSWORD = "pass";
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CRS_USERNAME;
  delete process.env.CRS_PASSWORD;
});

describe("personaForContact", () => {
  it("matches a persona's exact phone or email, however the phone is formatted", () => {
    expect(personaForContact("(555) 010-1012", null)).toBe("P12");
    expect(personaForContact("+1 555 010 1019", null)).toBe("P19");
    expect(personaForContact(null, "V.Anand.1968@example.com")).toBe("P12");
  });

  it("matches nothing else", () => {
    expect(personaForContact(TEAMMATE_PHONE, null)).toBeNull();
    expect(personaForContact("555-0101", "orders@lanternfishpaper.example")).toBeNull();
    expect(personaForContact("call 5550101012 now", null)).toBeNull();
    expect(personaForContact(null, "v.anand.1968@example.com.evil")).toBeNull();
  });
});

describe("runCrsChecks", () => {
  it("never calls the network for anything but an allowlisted persona id", async () => {
    mockFetch();
    for (const input of [null, "", "P99", "p12", TEAMMATE_PHONE, "Lanternfish Paper Supply", { id: "P12" }, "__proto__"]) {
      expect((await runCrsChecks(input, { loginBlocked: false })).status).toBe("skipped");
    }
    expect(sent).toHaveLength(0);
  });

  it("sends only the allowlisted bodies, byte for byte, and never the teammate phone", async () => {
    mockFetch();
    const result = await runCrsChecks("P12", { loginBlocked: false });
    expect(result).toMatchObject({ status: "ok", identity: "fail", fraudScore: 85, reversePhone: "mismatch" });
    const nonLogin = sent.filter((s) => !s.url.endsWith("/users/login"));
    expect(nonLogin).toHaveLength(3);
    for (const s of nonLogin) {
      expect(ALLOWLISTED_BODIES).toContain(s.body);
      expect(s.body).not.toContain(TEAMMATE_PHONE.replace(/\D/g, "").slice(-7));
    }
    expect(nonLogin.map((s) => s.body)).toEqual([
      JSON.stringify(PERSONAS.P12.identity),
      JSON.stringify(PERSONAS.P12.fraudFinder),
      JSON.stringify(PERSONAS.P12.reverse),
    ]);
  });

  it("skips without credentials", async () => {
    mockFetch();
    delete process.env.CRS_PASSWORD;
    expect((await runCrsChecks("P19", { loginBlocked: false })).status).toBe("skipped");
    expect(sent).toHaveLength(0);
  });

  it("never retries a failed login, in this isolate or after one was recorded", async () => {
    mockFetch(401);
    expect(await runCrsChecks("P19", { loginBlocked: false })).toMatchObject({ status: "error", loginFailed: true });
    expect(await runCrsChecks("P19", { loginBlocked: false })).toMatchObject({ status: "error", loginFailed: true });
    expect(sent.filter((s) => s.url.endsWith("/users/login"))).toHaveLength(1);

    _resetForTests();
    mockFetch();
    expect((await runCrsChecks("P19", { loginBlocked: true })).status).toBe("skipped");
    expect(sent).toHaveLength(0);
  });
});
