"use client";

import { useId } from "react";

import { placeLabel } from "./Bits";
import { formatPoints } from "@/lib/points";
import type { Board, Project } from "@/lib/types";

type Props = {
  board: Board;
  projects: Project[];
  selectedTrackId: string | null;
  bettingOpen: boolean;
  onSelectTrack: (trackId: string) => void;
  onShowRules: () => void;
};

/**
 * « Ton jeu » : où j'en suis, en une carte. Mes points en jeu (et gagnés,
 * une fois des gagnants annoncés), puis mon pari dans chaque track. Toucher
 * une track l'ouvre juste en dessous.
 */
export function MyGame({ board, projects, selectedTrackId, bettingOpen, onSelectTrack, onShowRules }: Props) {
  const titleId = useId();
  const nameOf = (projectId: string | null) => projects.find((project) => project.id === projectId)?.name ?? null;

  return (
    <section aria-labelledby={titleId} className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-5 py-3.5 dark:border-white/10">
        <h2 id={titleId} className="text-lg font-bold tracking-tight">
          Ton jeu
        </h2>
        <button type="button" className="btn btn-outline" onClick={onShowRules}>
          <span aria-hidden="true">?</span> Revoir les règles
        </button>
      </div>

      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <dl className="flex flex-wrap content-center items-center gap-x-10 gap-y-5 border-b border-black/10 p-5 md:border-b-0 md:border-r dark:border-white/10">
          {board.decidedTracks < board.tracks.length && (
            <Figure label="Points en jeu" value={formatPoints(board.myPointsAtStake)} accent />
          )}
          {board.decidedTracks > 0 && (
            <Figure label="Points gagnés" value={formatPoints(board.myPointsWon)} accent />
          )}
          <Figure label="Paris posés" value={`${board.myBetCount}/${board.tracks.length}`} />
        </dl>

        <ul className="flex flex-col gap-2 p-3 sm:p-4">
          {board.tracks.map((entry) => {
            const project = nameOf(entry.myProjectId);
            const place = entry.decided && entry.myProjectId
              ? entry.standings.find((standing) => standing.projectId === entry.myProjectId)?.place ?? null
              : null;
            const current = entry.track.id === selectedTrackId;

            return (
              <li key={entry.track.id}>
                <button
                  type="button"
                  aria-current={current ? "true" : undefined}
                  onClick={() => onSelectTrack(entry.track.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                    current
                      ? "border-gold bg-gold/10"
                      : "border-black/10 hover:border-gold dark:border-white/15"
                  }`}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-xs font-semibold uppercase tracking-[0.1em] text-black/45 dark:text-white/45">
                      {entry.track.name}
                    </span>
                    {project ? (
                      <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                        <span aria-hidden="true" className="text-blue-600 dark:text-blue-400">
                          ✓
                        </span>
                        <span className="truncate">{project}</span>
                        {place !== null && <span className="pill pill-gold">🏆 {placeLabel(place)}</span>}
                      </span>
                    ) : (
                      <span className="text-black/55 dark:text-white/55">Pas encore de pari</span>
                    )}
                  </span>

                  <span className="shrink-0 text-right">
                    {entry.myWon !== null ? (
                      <TrackPoints value={entry.myWon} caption="gagnés" />
                    ) : entry.myPoints !== null ? (
                      <TrackPoints value={entry.myPoints} caption="en jeu" />
                    ) : bettingOpen && !entry.decided ? (
                      <span className="text-sm font-semibold text-gold-ink dark:text-gold">Parier →</span>
                    ) : (
                      <span className="text-sm text-black/45 dark:text-white/45">—</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Figure({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    // dt avant dd (exigé par <dl>), affichés dans l'autre sens : le chiffre en haut.
    <div className="flex flex-col-reverse justify-end">
      <dt className="label mt-1">{label}</dt>
      <dd
        className={`text-4xl font-extrabold leading-none tracking-tight tabular-nums ${
          accent ? "text-gold-ink dark:text-gold" : ""
        }`}
      >
        {/* La clé relance l'animation à chaque nouveau chiffre. */}
        <span key={value} className="value-bump">
          {value}
        </span>
      </dd>
    </div>
  );
}

function TrackPoints({ value, caption }: { value: number; caption: string }) {
  return (
    <span className="flex flex-col items-end leading-tight">
      <span key={value} className="value-bump font-bold tabular-nums">
        {formatPoints(value)} <span className="text-xs font-semibold text-black/45 dark:text-white/45">pts</span>
      </span>
      <span className="text-xs text-black/45 dark:text-white/45">{caption}</span>
    </span>
  );
}
