"use client";

import { useEffect, useState } from "react";

/**
 * L'heure courante, rafraîchie à intervalle régulier tant que `active`.
 * Sert aux chiffres qui dépendent de l'heure : compte à rebours, bonus de
 * rapidité, points à gagner.
 */
export function useNow(intervalMs: number, active = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);

  return now;
}
