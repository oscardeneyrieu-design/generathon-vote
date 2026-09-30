"use client";

import { useEffect, useState } from "react";

import { formatCountdown, formatDeadline } from "@/lib/voting";

/**
 * Bandeau discret pour les parieurs : le temps restant pour parier, sur la
 * page Parier comme sur le Classement. Toujours présent, pour qu'on sache
 * où on en est même sans heure de fin programmée.
 */
export function TimeLeft({
  bettingOpen,
  votingOpen,
  closesAt,
}: {
  bettingOpen: boolean;
  votingOpen: boolean;
  closesAt: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!bettingOpen || !closesAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [bettingOpen, closesAt]);

  let content: React.ReactNode;
  if (bettingOpen && closesAt) {
    content = (
      <>
        Temps restant pour parier :{" "}
        <strong className="font-bold text-gold-ink tabular-nums dark:text-gold" role="timer">
          {formatCountdown(Date.parse(closesAt) - now)}
        </strong>{" "}
        <span className="faint">· jusqu&apos;au {formatDeadline(closesAt)}</span>
      </>
    );
  } else if (bettingOpen) {
    content = <span>Paris ouverts · l&apos;heure de fin n&apos;est pas encore annoncée.</span>;
  } else {
    content = (
      <span>
        <strong className="font-semibold">Paris clos</strong>
        {votingOpen && closesAt ? ` depuis le ${formatDeadline(closesAt)}` : ""} · les classements
        restent visibles.
      </span>
    );
  }

  return (
    <div
      className={`rounded-lg border px-3.5 py-2 text-sm leading-relaxed ${
        bettingOpen ? "border-gold/40 bg-gold/10" : "border-black/15 bg-black/[.04] dark:border-white/20 dark:bg-white/[.06]"
      }`}
    >
      <span aria-hidden="true">⏱ </span>
      {content}
    </div>
  );
}

/**
 * Grand compte à rebours, pour l'espace organisateur. Il ne décide de
 * rien : c'est `useLive` qui ferme les paris à l'heure dite, et le serveur
 * qui refuse les paris en retard. Lui ne fait que défiler.
 */
export function Countdown({ closesAt, large = false }: { closesAt: string; large?: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = Date.parse(closesAt) - now;

  return (
    <div className={large ? "text-right" : ""}>
      <div className="label">{remaining > 0 ? "Clôture des paris dans" : "Paris clos"}</div>
      <div
        className={`font-extrabold leading-none tracking-tight text-gold-ink dark:text-gold ${
          large ? "mt-2 text-5xl sm:text-6xl" : "mt-1 text-3xl"
        }`}
        role="timer"
      >
        {formatCountdown(remaining)}
      </div>
      <div className="faint mt-1 text-sm">{formatDeadline(closesAt)}</div>
    </div>
  );
}
