"use client";

import { JoinCode } from "@/components/JoinCode";
import { Leaderboard } from "@/components/Leaderboard";
import { formatOdds } from "@/lib/odds";
import { useLive } from "@/lib/use-live";

/** Au-delà, les colonnes deviennent illisibles de loin. */
const ROWS_PER_TRACK = 5;

/**
 * Écran de projection. Surface distincte tirée du même état : les trois
 * tracks côte à côte, typographie doublée, aucune interaction. Ce n'est pas
 * la page de vote en plus grand.
 */
export default function BoardPage() {
  const live = useLive();
  const isLoading = live.status === "loading";

  const kicker = isLoading
    ? "Connecting"
    : live.status === "error"
      ? "Offline"
      : live.votingOpen
        ? "Betting open"
        : "Betting closed";

  return (
    <main className="board mx-auto flex min-h-dvh w-full max-w-[110rem] flex-col px-6 py-6">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-5">
        <div className="min-w-0 flex-1">
          <div
            className={`t-label${
              live.votingOpen && !isLoading
                ? " ink-accent"
                : !live.votingOpen && !isLoading && live.status !== "error"
                  ? " ink-result"
                  : " text-[color:var(--color-ink-muted)]"
            }`}
          >
            {kicker}
          </div>
          <h1 className="t-score mt-2">Public vote</h1>
        </div>

        <div className="text-right">
          <div
            // Le pouls de la salle, en bleu : c'est le chiffre qui bouge tout
            // seul pendant toute la soirée.
            className="font-extrabold leading-none"
            style={{
              fontSize: "clamp(2.5rem, 7vw, 4.5rem)",
              fontStretch: "80%",
              letterSpacing: "-0.035em",
              color: isLoading ? undefined : "var(--color-accent)",
            }}
          >
            {isLoading ? "—" : live.board.totalVoters}
          </div>
          <div className="t-label mt-2 text-[color:var(--color-ink-muted)]">Bettors</div>
        </div>
      </header>

      {live.status === "error" ? (
        <p className="t-display flex-1 pt-10">
          Database unreachable. This screen reconnects on its own.
        </p>
      ) : (
        <div
          className="grid flex-1 gap-6"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}
        >
          {isLoading
            ? Array.from({ length: 3 }).map((_, index) => <ColumnSkeleton key={index} />)
            : live.board.tracks.map(({ track, standings, voters }) => {
                const winner = standings.find((standing) => standing.isWinner) ?? null;

                return (
                  <section key={track.id} className="flex min-w-0 flex-col">
                    <div className="pb-3">
                      <h2
                        className="font-extrabold leading-none"
                        style={{
                          fontSize: "clamp(1.5rem, 2.6vw, 2.25rem)",
                          fontStretch: "84%",
                          letterSpacing: "-0.03em",
                        }}
                      >
                        {track.name}
                      </h2>
                      <p className="t-label mt-2 text-[color:var(--color-ink-muted)]">
                        {voters} {voters === 1 ? "bettor" : "bettors"}
                      </p>
                    </div>

                    {winner && (
                      <div className="banner banner-win mb-3">
                        <span className="t-label">Winner</span>
                        <span
                          className="font-extrabold"
                          style={{ fontSize: "1.25rem", fontStretch: "88%", letterSpacing: "-0.02em" }}
                        >
                          {winner.name}
                        </span>
                        <span className="t-label">
                          {winner.bets} {winner.bets === 1 ? "bet" : "bets"} at {formatOdds(winner.odds)}
                        </span>
                      </div>
                    )}

                    {standings.length === 0 ? (
                      <p className="t-meta pt-4">No projects in this track yet.</p>
                    ) : (
                      <>
                        <Leaderboard
                          standings={standings}
                          limit={ROWS_PER_TRACK}
                          scale="board"
                        />
                        {standings.length > ROWS_PER_TRACK && (
                          <p className="t-label mt-2 text-[color:var(--color-ink-muted)]">
                            +{standings.length - ROWS_PER_TRACK} more
                          </p>
                        )}
                      </>
                    )}
                  </section>
                );
              })}
        </div>
      )}

      <footer className="pt-8">
        <JoinCode />
      </footer>
    </main>
  );
}

function ColumnSkeleton() {
  return (
    <div>
      <div className="skeleton h-9 w-3/4" />
      <div className="mt-5" style={{ borderTop: "3px solid var(--color-ink)" }}>
        {Array.from({ length: ROWS_PER_TRACK }).map((_, index) => (
          <div
            key={index}
            className="skeleton"
            style={{ height: "3.5rem", marginBottom: 1, opacity: 1 - index * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}
