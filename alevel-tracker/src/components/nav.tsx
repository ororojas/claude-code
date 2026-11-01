"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChartLine, FileText, LayoutList, Settings, Sun } from "lucide-react";

const LINKS = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/tracker", label: "Tracker", icon: LayoutList },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/papers", label: "Papers", icon: FileText },
  { href: "/graphs", label: "Graphs", icon: ChartLine },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`) || (href === "/tracker" && pathname.startsWith("/teach"));
}

export function Nav() {
  const pathname = usePathname();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex gap-0.5" aria-hidden>
              <span className="size-2.5 rounded-full bg-red-500" />
              <span className="size-2.5 rounded-full bg-amber-500" />
              <span className="size-2.5 rounded-full bg-green-500" />
            </span>
            Mock Tracker
            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">AAA</span>
          </Link>
          <nav className="hidden gap-1 md:flex" aria-label="Main">
            {LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 aria-[current=page]:bg-slate-900 aria-[current=page]:text-white"
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Main"
      >
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href) ? "page" : undefined}
            className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-slate-500 aria-[current=page]:font-semibold aria-[current=page]:text-slate-900"
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
