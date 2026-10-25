// Records the demo video's screen shots from the live site, with a gliding cursor, smooth zooms and burned-in captions.
// Needs no screen-recording permission: Playwright records its own browser window.
//
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/record-demo.mjs                     # simulated call (the case page's own Simulate button)
//   REAL_CALL=1 node scripts/record-demo.mjs         # waits up to 90 s for a person to answer on /vendor
//   BASE=https://quintet.marketingmeteor.workers.dev node scripts/record-demo.mjs
//
// Output: scripts/out/<timestamp>/*.webm, one file per page. Convert with: ffmpeg -i in.webm -c:v libx264 -crf 18 out.mp4
import { chromium } from "playwright";
import { mkdirSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = (process.env.BASE ?? "https://quintet.marketingmeteor.workers.dev").replace(/\/$/, "");
const REAL_CALL = process.env.REAL_CALL === "1";
const OUT = new URL(`./out/${new Date().toISOString().replace(/[:.]/g, "-")}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = 1920, H = 1080;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: OUT, size: { width: W, height: H } },
  colorScheme: "light",
});
// Light mode, a visible cursor, a caption bar and a sponsor label, re-injected on every page load.
await ctx.addInitScript(() => {
  try { localStorage.setItem("theme", "light"); } catch {}
  const boot = () => {
    if (document.getElementById("rec-cursor")) return;
    const s = document.createElement("style");
    s.textContent = `
      #rec-cursor{position:fixed;z-index:2147483647;left:0;top:0;width:34px;height:34px;pointer-events:none;
        transform:translate(-100px,-100px);transition:none}
      #rec-cursor svg{filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))}
      #rec-ring{position:fixed;z-index:2147483646;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;
        border:4px solid rgba(45,75,166,.7);pointer-events:none;opacity:0;transform:scale(.3)}
      #rec-ring.go{animation:rec-ping .5s ease-out}
      @keyframes rec-ping{0%{opacity:.9;transform:scale(.3)}100%{opacity:0;transform:scale(1.3)}}
      #rec-cap{position:fixed;z-index:2147483645;left:50%;bottom:44px;transform:translateX(-50%);max-width:1500px;
        background:rgba(15,23,42,.88);color:#fff;font:600 34px/1.3 system-ui,sans-serif;padding:16px 30px;border-radius:18px;
        text-align:center;opacity:0;transition:opacity .35s}
      #rec-lab{position:fixed;z-index:2147483645;right:28px;top:22px;background:#2D4BA6;color:#fff;
        font:700 22px system-ui,sans-serif;padding:8px 18px;border-radius:999px;opacity:0;transition:opacity .35s}
      body{transition:transform .9s cubic-bezier(.4,0,.2,1);overflow-x:hidden}
    `;
    document.head.appendChild(s);
    const c = document.createElement("div");
    c.id = "rec-cursor";
    c.innerHTML = `<svg width="34" height="34" viewBox="0 0 24 24"><path d="M3 2l7.6 19 2.6-7.8L21 10.6z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    const ring = document.createElement("div"); ring.id = "rec-ring";
    const cap = document.createElement("div"); cap.id = "rec-cap";
    const lab = document.createElement("div"); lab.id = "rec-lab";
    document.documentElement.append(ring, c, cap, lab); // outside <body>, so zooming the page never moves them
    window.addEventListener("mousemove", (e) => {
      c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
      ring.style.left = e.clientX + "px"; ring.style.top = e.clientY + "px";
    }, true);
    window.addEventListener("mousedown", () => { ring.classList.remove("go"); void ring.offsetWidth; ring.classList.add("go"); }, true);
  };
  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);
});

const page = await ctx.newPage();
page.on("dialog", (d) => d.accept());
page.setDefaultTimeout(30_000);

let mx = W / 2, my = H / 2;
// Ease the cursor to a point along a curve, like a hand.
async function glide(x, y, ms = 900) {
  const n = Math.max(12, Math.round(ms / 16));
  const x0 = mx, y0 = my;
  for (let i = 1; i <= n; i++) {
    const t = i / n, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e + Math.sin(t * Math.PI) * -18);
    await sleep(ms / n);
  }
  mx = x; my = y;
}
async function box(loc) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (!b) throw new Error("no box");
  return b;
}
async function clickOn(loc, pause = 350) {
  const b = await box(loc);
  await glide(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(pause);
  await page.mouse.down(); await sleep(70); await page.mouse.up();
}
async function caption(text, label = "") {
  await page.evaluate(([t, l]) => {
    const c = document.getElementById("rec-cap"), b = document.getElementById("rec-lab");
    if (c) { c.textContent = t; c.style.opacity = t ? "1" : "0"; }
    if (b) { b.textContent = l; b.style.opacity = l ? "1" : "0"; }
  }, [text, label]);
}
// Smooth zoom into an element (or back out with no argument).
async function zoom(loc, scale = 1.6) {
  if (!loc) { await page.evaluate(() => { document.body.style.transform = ""; }); await sleep(1000); return; }
  const b = await box(loc);
  await page.evaluate(([cx, cy, s]) => {
    const h = document.body;
    h.style.transformOrigin = `${cx + window.scrollX}px ${cy + window.scrollY}px`;
    h.style.transform = `scale(${s})`;
  }, [b.x + b.width / 2, b.y + b.height / 2, scale]);
  await sleep(1000);
}
// Keep going if one step's wording has changed; the shot list says what was meant to happen.
const T0 = Date.now(), marks = [];
async function step(name, fn) {
  marks.push({ name, start: (Date.now() - T0) / 1000 });
  try { await fn(); console.log("ok  ", name); }
  catch (e) {
    console.log("FAIL", name, "-", e.message.split("\n")[0]);
    await page.screenshot({ path: `${OUT}fail-${name.replace(/\W+/g, "-")}.png` });
  }
}
const text = (t) => page.getByText(t, { exact: false }).first();
const btn = (name) => page.getByRole("button", { name }).first();

// 0. Reset so the limits start clean (the Ops board's Reset demo button).
await step("reset", async () => {
  await page.goto(`${BASE}/board`, { waitUntil: "networkidle" });
  await sleep(1500);
  await btn(/reset demo/i).click();
  await sleep(6000);
});

// Shot 1 (0:00-0:06): landing page, then the console.
await step("shot1-landing", async () => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await sleep(2500);
  await caption("This invoice looks routine.", "Hyphenate: the moment");
  await clickOn(page.getByRole("link", { name: /try the live demo/i }).first());
  await page.waitForURL(/\/console/);
  await sleep(1200);
  await clickOn(btn(/we switched banks/i));
  await sleep(600);
  await clickOn(btn(/generate/i));
  await page.waitForURL(/\/case\//, { timeout: 60_000 });
});

// Shot 2 (0:06-0:16): the red flags fill in and the payment freezes.
await step("shot2-flags", async () => {
  await caption("Bank changed · CRS: number belongs to someone else · hidden instructions aimed at the AI", "CRS");
  await text("red flag").waitFor({ timeout: 60_000 });
  await sleep(800);
  await zoom(text("red flag"), 1.5);
  await sleep(2500);
  await zoom(null);
});

// Shot 3 (0:16-0:34): the call.
await step("shot3-call", async () => {
  if (REAL_CALL) {
    await caption("Calling the vendor at the number on file…", "Cartesia");
    await page.getByText(/blocked/i).first().waitFor({ timeout: 90_000 });
  } else {
    await caption("Simulated call: the vendor says nothing changed", "Cartesia");
    const sim = page.getByRole("button", { name: /simulate/i }).first();
    await sim.waitFor({ timeout: 60_000 });
    await zoom(sim, 1.4);
    await clickOn(sim);
    await page.getByText(/blocked/i).first().waitFor({ timeout: 60_000 });
  }
  await sleep(2500);
  await zoom(null);
});

// Shot 5 (0:44-0:54): "Why was this stopped?" (the chip, since voice can't run headless).
await step("shot5-cora", async () => {
  await caption("Every answer comes from the case's own record.", "Anthropic · Hyphenate");
  const chip = text("Why was this stopped");
  await clickOn(chip);
  await sleep(7000);
});

// Shot 6 (0:54-1:02): the failed checks.
await step("shot6-checks", async () => {
  await caption("Sandbox test identities only, behind an allowlist", "CRS");
  const checks = page.getByRole("heading", { name: /checks/i }).first();
  await clickOn(checks, 200);
  await zoom(checks, 1.5);
  await sleep(3500);
  await zoom(null);
});

// Shot 7 (1:02-1:16): a routine invoice with the payment broken on purpose; it still pays once.
await step("shot7-pay-once", async () => {
  await page.goto(`${BASE}/console`, { waitUntil: "networkidle" });
  await sleep(1200);
  await caption("Allowed → paid once, even when the first transfer fails", "Nessie · Convex");
  await clickOn(btn(/routine invoice/i));
  await clickOn(text("Break the payment"));
  await sleep(500);
  await clickOn(btn(/generate/i));
  await page.waitForURL(/\/case\//, { timeout: 60_000 });
  await page.getByText(/paid/i).first().waitFor({ timeout: 90_000 });
  await sleep(1200);
  const log = text("Case log");
  await clickOn(log);
  await sleep(1500);
  const retry = text("not sending again");
  await retry.waitFor({ timeout: 15_000 });
  await zoom(retry, 1.6);
  await sleep(3500);
  await zoom(null);
});

// Shot 9 (1:28-1:42): the scorecard.
await step("shot9-scorecard", async () => {
  await page.goto(`${BASE}/scorecard`, { waitUntil: "networkidle" });
  await sleep(1500);
  await caption("25 cases, scored every run", "Microsoft");
  const card = page.locator("table").first();
  await card.waitFor({ timeout: 20_000 });
  await zoom(card, 1.25);
  await sleep(4500);
  await zoom(null);
});

// Shot 10 (1:42-2:00): back to the landing page, five agents bouncing.
await step("shot10-close", async () => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await caption("Five seats, one quintet. Claude proposes, code countersigns.", "");
  await sleep(6000);
});

const total = (Date.now() - T0) / 1000;
await ctx.close();
await browser.close();

// Cut one mp4 per shot (needs ffmpeg), plus the whole thing as demo-full.mp4.
const webm = readdirSync(OUT).find((f) => f.endsWith(".webm"));
if (webm) {
  const src = `${OUT}${webm}`;
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", src, "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", `${OUT}demo-full.mp4`]);
  marks.forEach((m, i) => {
    if (m.name === "reset") return;
    const end = marks[i + 1]?.start ?? total;
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-ss", String(m.start), "-to", String(end), "-i", src, "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", `${OUT}${String(i).padStart(2, "0")}-${m.name}.mp4`]);
    console.log(`${m.name}: ${m.start.toFixed(1)}s to ${end.toFixed(1)}s (${(end - m.start).toFixed(1)}s)`);
  });
}
console.log(`\nClips saved in ${OUT}`);
