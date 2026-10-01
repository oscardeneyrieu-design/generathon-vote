"use client";

import { EmptyState, LiveBadge, plural } from "@/components/Bits";
import { TimeLeft } from "@/components/Countdown";
import { JoinCode } from "@/components/JoinCode";
import { Leaderboard } from "@/components/Leaderboard";
import { BetsChart } from "@/components/BetsChart";
import { Podium } from "@/components/Podium";
import { useLive } from "@/lib/use-live";
import { useNow } from "@/lib/use-now";
import { betWeight, isWeighted } from "@/lib/voting";

/** Au-delà, les colonnes deviennent illisibles de loin. */
const ROWS_PER_TRACK = 5;

/** Proportions communes aux trois graphiques, pour qu'ils soient alignés. */
const CHART = { width: 480, height: 230 };

/**
 * Onglet « Classement », pensé pour le vidéoprojecteur : les trois tracks
 * côte à côte. En haut de chaque colonne, la courbe des paris — même taille
 * et même hauteur pour les trois — puis le podium et le top 5, avec les
 * points qu'un pari posé maintenant rapporterait.
 */
export default function BoardPage() {
  const live = useLive();
  const loading = live.status === "loading";
  const now = useNow(5_000, live.bettingOpen && isWeighted(live.period));
  const bonus = live.bettingOpen ? betWeight(now, live.period) : null;

  return (
    <main className="page-in mx-auto flex w-full max-w-[100rem] flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
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

        <div className="text-right">
          <div className="label">Parieurs</div>
          <div className="mt-2 text-5xl font-extrabold leading-none tracking-tight sm:text-6xl">
            {loading ? "—" : live.board.totalVoters}
          </div>
        </div>
      </header>

      {!loading && live.status !== "error" && (
        <TimeLeft bettingOpen={live.bettingOpen} votingOpen={live.votingOpen} period={live.period} />
      )}

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
            : live.board.tracks.map(({ track, standings, voters, podium, decided }) => (
                <section key={track.id} className="card flex min-w-0 flex-col gap-5 p-4 sm:p-5">
                  {/* Titre sur une seule ligne dès qu'il y a plusieurs colonnes : les
                      graphiques qui suivent démarrent ainsi à la même hauteur. Sur
                      téléphone (une colonne), il peut passer à la ligne. */}
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-2xl font-bold tracking-tight sm:truncate" title={track.name}>
                      {track.name}
                    </h2>
                    <span className="faint shrink-0 text-sm">{plural(voters, "parieur")}</span>
                  </div>

                  <div>
                    <h3 className="label mb-2">Évolution des paris</h3>
                    <BetsChart series={live.series.get(track.id) ?? []} {...CHART} closesAt={live.closesAt} />
                  </div>

                  <Podium podium={podium} large />

                  {standings.length === 0 ? (
                    <p className="muted text-sm">Pas encore de projet dans cette track.</p>
                  ) : (
                    <div>
                      <Leaderboard standings={standings} bonus={decided ? null : bonus} limit={ROWS_PER_TRACK} size="lg" />
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
