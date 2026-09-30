"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useLive } from "@/lib/use-live";
import { formatCountdown } from "@/lib/voting";

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

        <div className="flex-1" />
        <HeaderTimer variant="inline" />

        <Link
          href="/admin"
          className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-black hover:bg-gold-hover"
        >
          Admin
        </Link>
      </div>
      <HeaderTimer variant="strip" />
    </header>
  );
}

/**
 * Le temps restant pour parier, toujours visible dans la barre de menu :
 * une pastille à côté du bouton Admin sur ordinateur, une fine bande sous la
 * barre sur téléphone (la place y manque). Rien tant qu'aucune heure de fin
 * n'est programmée.
 */
function HeaderTimer({ variant }: { variant: "inline" | "strip" }) {
  const { status, bettingOpen, votingOpen, closesAt } = useLive();
  const counting = bettingOpen && closesAt !== null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!counting) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  if (status === "loading" || status === "error") return null;
  const closed = !bettingOpen && (votingOpen || closesAt !== null);
  if (!counting && !closed) return null;

  const remaining = counting ? formatCountdown(Date.parse(closesAt!) - now) : null;

  if (variant === "inline") {
    return (
      <span
        className={`mr-2 hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm sm:inline-flex ${
          counting ? "bg-gold/15" : "bg-black/[.06] dark:bg-white/[.08]"
        }`}
        title={counting ? "Temps restant pour parier" : undefined}
      >
        <span aria-hidden="true">⏱</span>
        {counting ? (
          <>
            <span className="muted">Fin des paris</span>
            <strong className="font-bold text-gold-ink tabular-nums dark:text-gold" role="timer">
              {remaining}
            </strong>
          </>
        ) : (
          <span className="font-semibold">Paris clos</span>
        )}
      </span>
    );
  }

  return (
    <div
      className={`border-t px-4 py-1.5 text-center text-sm sm:hidden ${
        counting
          ? "border-gold/30 bg-gold/15"
          : "border-black/10 bg-black/[.04] dark:border-white/10 dark:bg-white/[.06]"
      }`}
    >
      <span aria-hidden="true">⏱ </span>
      {counting ? (
        <>
          Temps restant pour parier :{" "}
          <strong className="font-bold text-gold-ink tabular-nums dark:text-gold" role="timer">
            {remaining}
          </strong>
        </>
      ) : (
        <strong className="font-semibold">Paris clos</strong>
      )}
    </div>
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
