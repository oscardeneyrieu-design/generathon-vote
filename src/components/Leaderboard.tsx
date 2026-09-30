import { placeLabel, plural } from "./Bits";
import { formatOdds } from "@/lib/odds";
import type { Standing } from "@/lib/types";

type Props = {
  standings: Standing[];
  /** Tronque la liste. Le grand écran n'en montre que quelques-uns. */
  limit?: number;
  /** `lg` pour le grand écran, lisible à trois mètres. */
  size?: "md" | "lg";
};

const COLUMNS = "grid-cols-[1.75rem_1fr_auto_4.5ch]";

/** Classement d'une track : rang, projet, nombre de paris, cote. Tes paris ressortent en bleu. */
export function Leaderboard({ standings, limit, size = "md" }: Props) {
  const rows = limit ? standings.slice(0, limit) : standings;
  const large = size === "lg";

  return (
    <div className="card overflow-hidden">
      {/* Sans en-tête, un nombre comme 4.20 ne se lit pas comme une cote. */}
      <div
        className={`label grid ${COLUMNS} gap-3 border-b border-black/10 px-4 py-2 dark:border-white/10`}
      >
        <span>#</span>
        <span>Projet</span>
        <span className="text-right">Paris</span>
        <span className="text-right">Cote</span>
      </div>

      <ol>
        {rows.map((row) => (
          <li
            key={row.projectId}
            className={`relative isolate grid ${COLUMNS} items-center gap-3 border-b border-black/5 px-4 last:border-0 dark:border-white/5 ${
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
                  className={`truncate font-semibold tracking-tight ${large ? "text-lg" : ""} ${
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

            <span className="muted text-right text-sm" aria-label={plural(row.bets, "pari")}>
              {row.bets}
            </span>
            <span
              className={`text-right font-bold leading-none tracking-tight ${
                large ? "text-2xl" : "text-lg"
              }`}
            >
              {formatOdds(row.odds)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
