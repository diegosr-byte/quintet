"use client";

// The app's sidebar: the pages, the five agents (with live status), and the demo tools that run on
// other devices. On phones it folds into a top bar with a menu button.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  LayoutDashboard,
  Menu,
  PhoneIncoming,
  ScrollText,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import { AgentAvatar, AGENTS, TEAM } from "@/components/agents";
import { SyntheticBadge } from "@/components/case-ui";
import { StatusDot, useTeamStatus } from "@/components/team-status";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { cn } from "@/lib/utils";

const PAGES = [
  { href: "/board", label: "Ops board", icon: LayoutDashboard },
  { href: "/console", label: "Try it yourself", icon: Sparkles },
  { href: "/scorecard", label: "Scorecard", icon: BarChart3 },
  { href: "/policy", label: "Policy", icon: ScrollText },
];

// Run on a second device (a phone, or the "vendor's" laptop), so they open in a new tab.
const TOOLS = [
  { href: "/upload", label: "Receipt upload", icon: Smartphone },
  { href: "/vendor", label: "Vendor phone", icon: PhoneIncoming },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Close the mobile drawer after navigating.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Phone top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur md:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Menu className="size-6" aria-hidden />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-[#1C2B45]/30 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border/70 bg-card transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Quintet"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <Brand />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted md:hidden"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          <NavGroup title="App">
            {PAGES.map((p) => (
              <NavLink
                key={p.href}
                href={p.href}
                active={
                  pathname === p.href ||
                  (p.href === "/board" && pathname.startsWith("/case/"))
                }
              >
                <p.icon className="size-[18px]" aria-hidden />
                {p.label}
              </NavLink>
            ))}
          </NavGroup>

          <TeamGroup active={pathname === "/agents"} />

          <NavGroup title="Demo tools">
            {TOOLS.map((t) => (
              <NavLink key={t.href} href={t.href} newTab>
                <t.icon className="size-[18px]" aria-hidden />
                {t.label}
              </NavLink>
            ))}
          </NavGroup>
        </nav>

        <div className="flex items-center justify-between border-t border-border/70 px-5 py-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            About Quintet
          </Link>
          <ThemeSwitch />
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="text-xl font-bold tracking-tight text-primary">
        Quintet
      </span>
      <SyntheticBadge />
    </Link>
  );
}

function NavGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function NavLink({
  href,
  active = false,
  newTab = false,
  children,
}: {
  href: string;
  active?: boolean;
  newTab?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        {...(newTab && { target: "_blank", rel: "noreferrer" })}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2 text-base transition-colors",
          active
            ? "bg-accent font-semibold text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {children}
      </Link>
    </li>
  );
}

function TeamGroup({ active }: { active: boolean }) {
  const { workload } = useTeamStatus();
  return (
    <NavGroup title="Your team">
      <li>
        <Link
          href="/agents"
          aria-current={active ? "page" : undefined}
          className={cn(
            "mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2 text-base transition-colors",
            active
              ? "bg-accent font-semibold text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Meet the team
        </Link>
      </li>
      {TEAM.map((seat) => (
        <li key={seat}>
          <Link
            href={`/agents#${seat}`}
            className="flex items-center gap-2.5 rounded-xl px-3 py-1.5 transition-colors hover:bg-muted"
          >
            <AgentAvatar
              seat={seat}
              size={26}
              busy={(workload.get(seat) ?? 0) > 0}
            />
            <span className="min-w-0 flex-1">
              <span
                className="block text-sm font-semibold leading-tight"
                style={{ color: AGENTS[seat].ink }}
              >
                {AGENTS[seat].name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {AGENTS[seat].role}
              </span>
            </span>
            <StatusDot seat={seat} count={workload.get(seat) ?? 0} />
          </Link>
        </li>
      ))}
    </NavGroup>
  );
}
