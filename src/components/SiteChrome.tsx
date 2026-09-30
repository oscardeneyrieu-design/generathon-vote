"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Les onglets du site, comme « Générathons » et « Projets » sur generathon.tech. */
const TABS = [
  { href: "/", label: "Parier" },
  { href: "/board", label: "Classement" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-black/10 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-black/50">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-1 px-4 sm:gap-2 sm:px-6">
        <Link href="/" aria-label="Generathon — accueil des paris" className="wordmark mr-1 text-base sm:mr-2 sm:text-xl">
          GeNerAT<span className="wm-h">h</span>oN
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-2.5 py-1.5 text-sm sm:px-3 ${
                  active
                    ? "bg-black/[.06] font-semibold dark:bg-white/[.1]"
                    : "hover:bg-black/[.05] dark:hover:bg-white/[.06]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/admin"
          className="ml-auto rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-black hover:bg-gold-hover"
        >
          Admin
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-black/10 dark:border-white/10">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 px-4 py-8 text-center text-sm text-black/50 sm:flex-row sm:justify-between sm:px-6 sm:text-left dark:text-white/50">
        <p>Pronostics du public · Generathon #2</p>
        <p>
          Anonyme, un pari par appareil ·{" "}
          <a
            href="https://generathon.tech"
            className="transition hover:text-gold-ink dark:hover:text-gold"
          >
            generathon.tech
          </a>
        </p>
      </div>
    </footer>
  );
}
