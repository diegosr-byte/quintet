"use client";

// Fades each `.reveal` section in as it scrolls into view. Sections are only hidden once this runs
// (it sets `reveal-ready` on <html>), so without JavaScript everything simply shows.
//
// A section is revealed once its top rises above the bottom 8% of the screen. That also catches
// sections a fast jump skipped over (they're above the screen), which an IntersectionObserver misses.
import { useEffect } from "react";

export function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("reveal-ready");
    let pending = [...document.querySelectorAll<HTMLElement>(".reveal")];
    let raf = 0;

    const check = () => {
      raf = 0;
      const line = window.innerHeight * 0.92;
      pending = pending.filter((el) => {
        if (el.getBoundingClientRect().top >= line) return true;
        el.classList.add("is-visible"); // reveal once, don't fade out again
        return false;
      });
      if (pending.length === 0) stop();
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    const stop = () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    check();
    return () => {
      stop();
      cancelAnimationFrame(raf);
      root.classList.remove("reveal-ready");
    };
  }, []);
  return null;
}
