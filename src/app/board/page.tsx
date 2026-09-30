"use client";

import { EmptyState, LiveBadge, plural } from "@/components/Bits";
import { Countdown } from "@/components/Countdown";
import { JoinCode } from "@/components/JoinCode";
import { Leaderboard } from "@/components/Leaderboard";
import { OddsChart } from "@/components/OddsChart";
import { Podium } from "@/components/Podium";
import { useLive } from "@/lib/use-live";

/** Au-delà, les colonnes deviennent illisibles de loin. */
const ROWS_PER_TRACK = 5;

/** Proportions communes aux trois graphiques, pour qu'ils soient alignés. */
const CHART = { width: 480, height: 230 };

/**
 * Onglet « Classement », pensé pour le vidéoprojecteur : les trois tracks
 * côte à côte. En haut de chaque colonne, la courbe des cotes — même taille
 * et même hauteur pour les trois — puis le podium et le top 5.
 */
export default function BoardPage() {
  const live = useLive();
  const loading = live.status === "loading";

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col gap-8 px-6 py-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <LiveBadge status={live.status} />
            {!loading && live.status !== "error" && (
              <span className={`pill ${live.bettingOpen ? "pill-solid" : "pill-muted"}`}>
                {live.bettingOpen ? "Paris ouverts" : "Paris clos"}
              </span>
            )}
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Classement en direct</h1>
          <p className="muted max-w-[62ch]">
            Chaque track couronne son propre 1er, 2e et 3e. Tu peux parier sur un gagnant dans chacune.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-10">
          {live.bettingOpen && live.closesAt && <Countdown closesAt={live.closesAt} large />}
          <div className="text-right">
            <div className="label">Parieurs</div>
            <div className="mt-2 text-5xl font-extrabold leading-none tracking-tight sm:text-6xl">
              {loading ? "—" : live.board.totalVoters}
            </div>
          </div>
        </div>
      </header>

      {live.status === "error" ? (
        <EmptyState
          title="Base injoignable"
          body="Cet écran se reconnecte tout seul dès que la connexion revient."
        />
      ) : (
        <div
          className="grid flex-1 items-start gap-6"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}
        >
          {loading
            ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton h-[32rem]" />)
            : live.board.tracks.map(({ track, standings, voters, podium }) => (
                <section key={track.id} className="card flex min-w-0 flex-col gap-5 p-5">
                  {/* Titre sur une seule ligne : les graphiques qui suivent
                      démarrent ainsi à la même hauteur dans les trois colonnes. */}
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="truncate text-2xl font-bold tracking-tight" title={track.name}>
                      {track.name}
                    </h2>
                    <span className="faint shrink-0 text-sm">{plural(voters, "parieur")}</span>
                  </div>

                  <div>
                    <h3 className="label mb-2">Évolution des cotes</h3>
                    <OddsChart series={live.series.get(track.id) ?? []} {...CHART} />
                  </div>

                  <Podium podium={podium} large />

                  {standings.length === 0 ? (
                    <p className="muted text-sm">Pas encore de projet dans cette track.</p>
                  ) : (
                    <div>
                      <Leaderboard standings={standings} limit={ROWS_PER_TRACK} size="lg" />
                      {standings.length > ROWS_PER_TRACK && (
                        <p className="faint mt-2 text-sm">+ {standings.length - ROWS_PER_TRACK} de plus</p>
                      )}
                    </div>
                  )}
                </section>
              ))}
        </div>
      )}

      <div className="card p-5">
        <JoinCode />
      </div>
    </main>
  );
}
