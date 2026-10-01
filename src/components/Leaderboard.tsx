"use client";

import { useRef } from "react";

import { placeLabel, plural } from "./Bits";
import { formatPoints } from "@/lib/points";
import type { Standing } from "@/lib/types";
import { useFlip } from "@/lib/use-flip";

type Props = {
  standings: Standing[];
  /**
   * Bonus de rapidité du moment, 0.2–1, tant que les paris sont ouverts :
   * la colonne « À gagner » en dépend. `null` une fois clos : il n'y a plus
   * rien à gagner, seul le nombre de paris reste.
   */
  bonus: number | null;
  /** Tronque la liste. Le grand écran n'en montre que quelques-uns. */
  limit?: number;
  /** `lg` pour le grand écran, lisible à trois mètres. */
  size?: "md" | "lg";
};

// Plus serré sur téléphone : le nom du projet doit garder la place de se lire.
const WITH_GAIN = "grid-cols-[1.25rem_1fr_2.25rem_4.25rem] sm:grid-cols-[1.75rem_1fr_2.75rem_4.75rem]";
const WITHOUT_GAIN = "grid-cols-[1.25rem_1fr_3.5rem] sm:grid-cols-[1.75rem_1fr_4rem]";

/**
 * Classement d'une track : rang, projet, nombre de paris, et les points
 * qu'un pari posé maintenant rapporterait si le projet gagne. Tes paris
 * ressortent en bleu.
 */
export function Leaderboard({ standings, bonus, limit, size = "md" }: Props) {
  const rows = limit ? standings.slice(0, limit) : standings;
  const large = size === "lg";
  const open = bonus !== null;
  const columns = open ? WITH_GAIN : WITHOUT_GAIN;
  const listRef = useRef<HTMLOListElement>(null);
  useFlip(listRef);

  return (
    <div className="card overflow-hidden">
      {/* Sans en-tête, un nombre comme 1 240 ne se lit pas comme des points à gagner. */}
      <div
        className={`label grid ${columns} gap-2 border-b border-black/10 px-3 py-2 sm:gap-3 sm:px-4 dark:border-white/10`}
      >
        <span>#</span>
        <span>Projet</span>
        <span className="text-right">Paris</span>
        {open && <span className="whitespace-nowrap text-right">À gagner</span>}
      </div>

      <ol ref={listRef}>
        {rows.map((row) => (
          <li
            key={row.projectId}
            data-flip={row.projectId}
            className={`relative isolate grid ${columns} items-center gap-2 border-b border-black/5 px-3 last:border-0 sm:gap-3 sm:px-4 dark:border-white/5 ${
              large ? "py-3" : "py-2.5"
            }`}
          >
            <span
              aria-hidden="true"
              className={`rank-bar${row.isMine ? " rank-bar-mine" : ""}`}
              style={{ transform: `scaleX(${row.support})` }}
            />

            <span className="faint text-sm font-semibold">{row.rank}</span>

            <span className="flex min-w-0 flex-col">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`truncate font-semibold tracking-tight ${large ? "text-base sm:text-lg" : ""} ${
                    row.isMine ? "text-blue-700 dark:text-blue-400" : ""
                  }`}
                >
                  {row.name}
                </span>
                {row.place !== null && (
                  <span className="pill pill-gold">🏆 {placeLabel(row.place)}</span>
                )}
                {row.isMine && <span className="pill pill-mine">✓ Ton pari</span>}
              </span>
              {(row.team || row.brand) && (
                <span className="faint truncate text-xs">
                  {[row.team, row.brand].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>

            <span
              className={
                open
                  ? "muted text-right text-sm tabular-nums"
                  : `text-right font-bold leading-none tracking-tight tabular-nums ${large ? "text-xl sm:text-2xl" : "text-lg"}`
              }
              aria-label={plural(row.bets, "pari")}
            >
              {row.bets}
            </span>
            {open && (
              <span
                className={`text-right font-bold leading-none tracking-tight tabular-nums ${
                  large ? "text-xl sm:text-2xl" : "text-lg"
                }`}
                aria-label={`${formatPoints(row.gainBase * bonus)} points à gagner`}
              >
                {formatPoints(row.gainBase * bonus)}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
