"use client";

import { useEffect, useState } from "react";

import { formatCountdown, formatDeadline } from "@/lib/voting";

/**
 * Compte à rebours jusqu'à la clôture automatique des paris. Il ne décide de
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
