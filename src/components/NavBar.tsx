"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Library" },
  { href: "/workspace", label: "Workspace" },
  { href: "/titles", label: "Titles" },
  { href: "/saved", label: "Saved" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0.5 text-[13px] font-medium">
      {TABS.map(t => {
        const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className="px-3 py-1.5 rounded-md transition-colors"
            style={{
              color: active ? "var(--text)" : "var(--muted)",
              background: active ? "var(--bg-elev)" : "transparent",
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
