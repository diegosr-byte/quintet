"use client";

// The landing hero: the five agents drift slowly across the screen like a DVD screensaver, bouncing off
// the edges, each other, and the text in the middle (so they never cover it). Every bump squishes them
// along the hit and they wobble back on a spring.
//
// They're also toys: grab one and fling it (it slows back to its lazy drift), or sweep the mouse into
// one to bump it. Positions are written straight to the DOM each frame (no React re-render). With
// reduced motion on, they stay put.
import { useEffect, useRef, useSyncExternalStore } from "react";
import { AgentAvatar, AGENTS, Seat } from "@/components/agents";

const SEATS: Seat[] = [
  "intake",
  "verification",
  "caller",
  "controller",
  "payments",
];
const PAD = 14; // tile padding around the avatar
const TEXT_MARGIN = 16; // keep this far from the text block

// Damped spring for the squish: higher K = snappier, higher C = settles faster.
const K = 120;
const C = 7;
const KICK = 9;

const MAX_SPEED = 380; // px/s, cap for flings and cursor bumps (kept low: nudges, not launches)
const SETTLE = 2.2; // how fast a flung or bumped agent eases back to its drift speed (per second)
const CURSOR_R = 20; // the mouse cursor acts as a small round bumper this big
const FLING = 0.5; // share of the hand's speed an agent keeps when let go
const BUMP = 0.3; // share of the cursor's speed passed on in a bump

type Body = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  speed: number; // drift speed it settles back to
  s: number; // squish amount (0 = round)
  sv: number; // squish velocity
  angle: number; // direction of the last hit, radians
};

type Drag = {
  i: number;
  offX: number;
  offY: number;
  lastX: number;
  lastY: number;
  lastT: number;
  vx: number;
  vy: number;
};
type Cursor = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  inside: boolean;
};

export function AgentPlayground({ children }: { children: React.ReactNode }) {
  const heroRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const outerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const innerRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Avatar size scales with the screen (~56 px on phones, up to 96 px). The hero fills the window, so the
  // window size stands in for it; null on the server, so the agents render only in the browser.
  const avatar = useSyncExternalStore(
    () => () => {},
    () =>
      Math.round(
        Math.min(
          96,
          Math.max(
            56,
            Math.min(window.innerWidth, window.innerHeight - 64) / 9,
          ),
        ),
      ),
    () => null,
  );

  useEffect(() => {
    if (avatar === null) return;
    const hero = heroRef.current;
    const text = textRef.current;
    if (!hero || !text) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let W = 0;
    let H = 0;
    let rect = { l: 0, t: 0, r: 0, b: 0 };
    const measure = () => {
      const hb = hero.getBoundingClientRect();
      const tb = text.getBoundingClientRect();
      W = hb.width;
      H = hb.height;
      rect = {
        l: tb.left - hb.left - TEXT_MARGIN,
        t: tb.top - hb.top - TEXT_MARGIN,
        r: tb.right - hb.left + TEXT_MARGIN,
        b: tb.bottom - hb.top + TEXT_MARGIN,
      };
    };
    measure();

    const r = avatar / 2 + PAD;
    // Start spread around the edges, clear of the text and of each other.
    const starts = [
      [0.12, 0.18],
      [0.88, 0.16],
      [0.9, 0.82],
      [0.1, 0.84],
      [0.5, 0.92],
    ];
    const bodies: Body[] = SEATS.map((_, i) => {
      const a = Math.PI * 2 * ((i * 0.37 + 0.11) % 1);
      const speed = 26 + i * 3.5; // px per second: slow, each a little different
      return {
        x: Math.min(Math.max(starts[i][0] * W, r), W - r),
        y: Math.min(Math.max(starts[i][1] * H, r), H - r),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r,
        speed,
        s: 0,
        sv: 0,
        angle: 0,
      };
    });

    let drag: Drag | null = null;
    const cursor: Cursor = { x: 0, y: 0, vx: 0, vy: 0, t: 0, inside: false };

    const hit = (b: Body, nx: number, ny: number, strength = 1) => {
      b.angle = Math.atan2(ny, nx);
      b.sv += KICK * strength;
    };

    const local = (e: PointerEvent) => {
      const hb = hero.getBoundingClientRect();
      return { x: e.clientX - hb.left, y: e.clientY - hb.top };
    };

    // Screen edges and the text box. A free body bounces; a dragged one is just held inside.
    const constrain = (b: Body, held: boolean) => {
      if (b.x - b.r < 0) {
        b.x = b.r;
        if (!held && b.vx < 0) {
          b.vx = -b.vx;
          hit(b, 1, 0);
        }
      }
      if (b.x + b.r > W) {
        b.x = W - b.r;
        if (!held && b.vx > 0) {
          b.vx = -b.vx;
          hit(b, -1, 0);
        }
      }
      if (b.y - b.r < 0) {
        b.y = b.r;
        if (!held && b.vy < 0) {
          b.vy = -b.vy;
          hit(b, 0, 1);
        }
      }
      if (b.y + b.r > H) {
        b.y = H - b.r;
        if (!held && b.vy > 0) {
          b.vy = -b.vy;
          hit(b, 0, -1);
        }
      }

      const cx = Math.min(Math.max(b.x, rect.l), rect.r);
      const cy = Math.min(Math.max(b.y, rect.t), rect.b);
      let dx = b.x - cx;
      let dy = b.y - cy;
      let d = Math.hypot(dx, dy);
      if (d >= b.r) return;
      if (d === 0) {
        // Center inside the box (e.g. after a resize): leave by the nearest side.
        const exits = [b.x - rect.l, rect.r - b.x, b.y - rect.t, rect.b - b.y];
        const k = exits.indexOf(Math.min(...exits));
        [dx, dy] = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ][k];
        d = 1;
      }
      const nx = dx / d;
      const ny = dy / d;
      b.x = cx + nx * b.r;
      b.y = cy + ny * b.r;
      const vn = b.vx * nx + b.vy * ny;
      if (!held && vn < 0) {
        b.vx -= 2 * vn * nx;
        b.vy -= 2 * vn * ny;
        hit(b, nx, ny);
      }
    };

    const render = () => {
      bodies.forEach((b, i) => {
        const outer = outerRefs.current[i];
        const inner = innerRefs.current[i];
        if (outer)
          outer.style.transform = `translate3d(${b.x - b.r}px, ${b.y - b.r}px, 0)`;
        if (inner) {
          const along = 1 - 0.3 * b.s; // flatten along the hit
          const across = 1 + 0.22 * b.s; // bulge sideways
          const deg = (b.angle * 180) / Math.PI;
          inner.style.transform = `rotate(${deg}deg) scale(${along}, ${across}) rotate(${-deg}deg)`;
        }
      });
    };

    const step = (dt: number, now: number) => {
      bodies.forEach((b, i) => {
        if (drag?.i === i) {
          // Held: follow the pointer; its velocity is the hand's, for shoving the others.
          b.vx = drag.vx;
          b.vy = drag.vy;
          constrain(b, true);
        } else {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          constrain(b, false);
        }
      });

      // Each other. Equal mass between free agents; a held agent is immovable and shoves the other.
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i];
          const c = bodies[j];
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const min = a.r + c.r;
          if (d >= min) continue;
          const nx = dx / d;
          const ny = dy / d;
          const heldA = drag?.i === i;
          const heldC = drag?.i === j;
          const overlap = min - d;
          if (heldA || heldC) {
            const [held, free, sign] = heldA ? [a, c, 1] : [c, a, -1];
            free.x += sign * nx * overlap;
            free.y += sign * ny * overlap;
            const rel =
              (free.vx - held.vx) * nx * sign + (free.vy - held.vy) * ny * sign;
            if (rel < 0) {
              free.vx -= 2 * rel * nx * sign;
              free.vy -= 2 * rel * ny * sign;
              hit(free, sign * nx, sign * ny, Math.min(2, 1 + -rel / 400));
              hit(held, -sign * nx, -sign * ny, 0.5);
            }
            continue;
          }
          a.x -= (nx * overlap) / 2;
          a.y -= (ny * overlap) / 2;
          c.x += (nx * overlap) / 2;
          c.y += (ny * overlap) / 2;
          const va = a.vx * nx + a.vy * ny;
          const vc = c.vx * nx + c.vy * ny;
          if (va - vc > 0) {
            a.vx += (vc - va) * nx;
            a.vy += (vc - va) * ny;
            c.vx += (va - vc) * nx;
            c.vy += (va - vc) * ny;
            const strength = Math.min(2, 1.2 + (va - vc) / 500);
            hit(a, -nx, -ny, strength);
            hit(c, nx, ny, strength);
          }
        }
      }

      // The mouse cursor as a bumper (only while it's moving, and not while dragging).
      if (!drag && cursor.inside && now - cursor.t < 120) {
        for (const b of bodies) {
          const dx = b.x - cursor.x;
          const dy = b.y - cursor.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const min = b.r + CURSOR_R;
          if (d >= min) continue;
          const nx = dx / d;
          const ny = dy / d;
          b.x = cursor.x + nx * min;
          b.y = cursor.y + ny * min;
          const push = cursor.vx * nx + cursor.vy * ny; // how hard the cursor is moving into it
          if (push > 0) {
            b.vx += nx * (push * BUMP + 30);
            b.vy += ny * (push * BUMP + 30);
            hit(b, nx, ny, Math.min(2.2, 0.8 + push / 500));
          }
        }
      }

      bodies.forEach((b, i) => {
        if (drag?.i !== i) {
          // Ease back to the slow DVD drift after a fling or a bump; collisions change direction, not pace.
          const v = Math.hypot(b.vx, b.vy) || 0.001;
          const target = Math.min(
            MAX_SPEED,
            v + (b.speed - v) * Math.min(1, dt * SETTLE),
          );
          b.vx = (b.vx / v) * target;
          b.vy = (b.vy / v) * target;
        }
        const acc = -K * b.s - C * b.sv;
        b.sv += acc * dt;
        b.s = Math.max(-0.9, Math.min(0.9, b.s + b.sv * dt)); // never squash flat or invert
      });
    };

    render();
    if (reduce) return;

    // Pointer: grab (any pointer) and cursor bumps (mouse only).
    const onDown = (i: number) => (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const el = outerRefs.current[i];
      try {
        el?.setPointerCapture(e.pointerId); // keep receiving moves even outside the tile
      } catch {
        // Not every pointer can be captured (e.g. synthetic events); window listeners still track it.
      }
      const p = local(e);
      const b = bodies[i];
      drag = {
        i,
        offX: p.x - b.x,
        offY: p.y - b.y,
        lastX: p.x,
        lastY: p.y,
        lastT: performance.now(),
        vx: 0,
        vy: 0,
      };
      hit(b, 0, -1, 0.9); // a little squeeze in your grip
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      const now = performance.now();
      if (drag) {
        const dtm = Math.max((now - drag.lastT) / 1000, 1 / 240);
        drag.vx = drag.vx * 0.5 + ((p.x - drag.lastX) / dtm) * 0.5;
        drag.vy = drag.vy * 0.5 + ((p.y - drag.lastY) / dtm) * 0.5;
        drag.lastX = p.x;
        drag.lastY = p.y;
        drag.lastT = now;
        const b = bodies[drag.i];
        b.x = p.x - drag.offX;
        b.y = p.y - drag.offY;
        return;
      }
      if (e.pointerType !== "mouse") return;
      const dtc = Math.max((now - cursor.t) / 1000, 1 / 240);
      if (cursor.inside && now - cursor.t < 200) {
        cursor.vx = cursor.vx * 0.5 + ((p.x - cursor.x) / dtc) * 0.5;
        cursor.vy = cursor.vy * 0.5 + ((p.y - cursor.y) / dtc) * 0.5;
      } else {
        cursor.vx = 0;
        cursor.vy = 0;
      }
      cursor.x = p.x;
      cursor.y = p.y;
      cursor.t = now;
      cursor.inside = p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H;
    };
    const onUp = () => {
      if (!drag) return;
      const b = bodies[drag.i];
      // Flung if the hand was still moving when it let go.
      const stale = performance.now() - drag.lastT > 80;
      let vx = stale ? 0 : drag.vx * FLING;
      let vy = stale ? 0 : drag.vy * FLING;
      const v = Math.hypot(vx, vy);
      if (v > MAX_SPEED) {
        vx = (vx / v) * MAX_SPEED;
        vy = (vy / v) * MAX_SPEED;
      }
      if (v < b.speed) {
        // A gentle drop: carry on drifting in a fresh direction.
        const a = Math.random() * Math.PI * 2;
        vx = Math.cos(a) * b.speed;
        vy = Math.sin(a) * b.speed;
      }
      b.vx = vx;
      b.vy = vy;
      hit(b, vx || 1, vy, Math.min(2, 0.8 + v / 600));
      drag = null;
    };

    const downs = bodies.map((_, i) => onDown(i));
    const tiles = [...outerRefs.current]; // the same elements for adding and removing listeners
    tiles.forEach((el, i) => el?.addEventListener("pointerdown", downs[i]));
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    const onLeave = () => (cursor.inside = false);
    hero.addEventListener("pointerleave", onLeave);

    let raf = 0;
    let last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min((t - last) / 1000, 1 / 30); // clamp after tab switches
      last = t;
      step(dt, t);
      render();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const ro = new ResizeObserver(() => {
      measure();
      for (const b of bodies) {
        b.x = Math.min(Math.max(b.x, b.r), Math.max(W - b.r, b.r));
        b.y = Math.min(Math.max(b.y, b.r), Math.max(H - b.r, b.r));
      }
    });
    ro.observe(hero);
    ro.observe(text);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      tiles.forEach((el, i) =>
        el?.removeEventListener("pointerdown", downs[i]),
      );
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      hero.removeEventListener("pointerleave", onLeave);
    };
  }, [avatar]);

  return (
    <section
      ref={heroRef}
      className="relative isolate flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden px-6 py-16"
    >
      <div
        className="hero-backdrop pointer-events-none absolute inset-0 -z-10"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {avatar !== null &&
          SEATS.map((seat, i) => (
            <div
              key={seat}
              ref={(el) => {
                outerRefs.current[i] = el;
              }}
              className="pointer-events-auto absolute left-0 top-0 cursor-grab touch-none select-none will-change-transform active:cursor-grabbing"
              style={{ transform: "translate3d(-200px, -200px, 0)" }}
              title={`${AGENTS[seat].name} · drag me`}
            >
              <div
                ref={(el) => {
                  innerRefs.current[i] = el;
                }}
                className="flex items-center justify-center rounded-full shadow-[0_10px_30px_rgb(40_90_190/0.14)] ring-1 ring-white/70 will-change-transform"
                style={{ background: AGENTS[seat].tint, padding: PAD }}
              >
                <AgentAvatar seat={seat} size={avatar} happy />
              </div>
            </div>
          ))}
      </div>
      <div ref={textRef} className="relative z-10 max-w-xl text-center">
        {children}
      </div>
    </section>
  );
}
