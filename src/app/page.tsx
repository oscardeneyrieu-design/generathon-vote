"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Rule, SectionHeading, StatPair } from "@/components/Bits";
import { Leaderboard } from "@/components/Leaderboard";
import { THIN_MARKET } from "@/lib/odds";
import { ProjectGrid } from "@/components/ProjectGrid";
import { TrackPicker } from "@/components/TrackPicker";
import { useLive, type ConnectionStatus } from "@/lib/use-live";

export default function VotePage() {
  const live = useLive();
  const { board, votingOpen } = live;

  // La track affichée : celle du pari si pari il y a, sinon celle que la
  // personne vient de toucher. Distinguer les deux permet de parcourir une
  // autre track sans perdre son pari en cours.
  const [browsingTrackId, setBrowsingTrackId] = useState<string | null>(null);

  useEffect(() => {
    if (board.myTrackId) setBrowsingTrackId(board.myTrackId);
  }, [board.myTrackId]);

  // Sans pari ni sélection, on ouvre sur la première track plutôt que sur
  // rien : autrement un nouvel arrivant n'a sous les yeux que trois tuiles
  // et pas une seule cote, alors que les cotes sont le sujet de la page.
  const selectedTrackId =
    browsingTrackId ?? board.myTrackId ?? board.tracks[0]?.track.id ?? null;
  const selected = board.tracks.find((entry) => entry.track.id === selectedTrackId) ?? null;

  const projectCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const project of live.projects) {
      counts.set(project.track_id, (counts.get(project.track_id) ?? 0) + 1);
    }
    return counts;
  }, [live.projects]);

  const trackProjects = useMemo(
    () => live.projects.filter((project) => project.track_id === selectedTrackId),
    [live.projects, selectedTrackId]
  );

  const betIsElsewhere =
    board.myTrackId !== null && selectedTrackId !== null && board.myTrackId !== selectedTrackId;

  if (live.status === "loading") return <LoadingScreen />;
  if (live.status === "error") return <ErrorScreen message={live.error} />;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[52rem] px-4 pb-20 pt-6">
      <header className="flex items-baseline justify-between gap-3">
        <span className="t-label">Public vote</span>
        <ConnectionDot status={live.status} />
      </header>

      <Rule thick />

      <section className="pb-7 pt-5">
        <h1 className="t-display">Bet on the winners</h1>
        <p className="t-meta mt-2 max-w-[65ch]">
          {votingOpen
            ? "Pick one track, then the project you think will win it. One bet per person — you can change it until voting closes."
            : "Voting is closed. Here is what the room predicted."}
        </p>
        <p className="t-meta mt-2 max-w-[65ch]">
          Odds are pari-mutuel: they show what 1 unit on a project would return if it wins.
          The fewer people backing a project, the longer its odds. Each track has its own
          winner — the three do not compete with each other.
        </p>
      </section>

      {!votingOpen && (
        <div className="banner banner-closed mb-6">
          <span className="t-label">Closed</span>
          <span className="font-bold" style={{ fontStretch: "92%" }}>
            No more bets
          </span>
        </div>
      )}

      {live.error && (
        <p
          role="status"
          className="mb-5 flex items-center justify-between gap-3 border-2 border-[color:var(--color-ink)] px-3 py-2 text-sm font-semibold"
        >
          {live.error}
          <button type="button" className="t-label underline" onClick={live.dismissError}>
            Dismiss
          </button>
        </p>
      )}

      {live.tracks.length === 0 ? (
        <EmptyState
          title="No tracks yet"
          body="The tracks are created on first launch. If you see this, the database has not been seeded."
        />
      ) : (
        <>
          <section>
            <SectionHeading
              step="Step 1"
              title="Your track"
              aside={
                <StatPair value={board.totalVoters} label={board.totalVoters === 1 ? "bettor" : "bettors"} />
              }
            />
            <TrackPicker
              boards={board.tracks}
              selectedTrackId={selectedTrackId}
              betTrackId={board.myTrackId}
              projectCounts={projectCounts}
              disabled={!votingOpen && board.myTrackId === null}
              onSelect={setBrowsingTrackId}
            />
          </section>

          {selected && (
            <>
              <section className="mt-11">
                <SectionHeading step="Step 2" title={`Winner of ${selected.track.name}`} />

                {betIsElsewhere && votingOpen && (
                  <p className="t-meta mb-3 border-2 border-[color:var(--color-ink)] px-3 py-2">
                    Your bet is currently on{" "}
                    <strong>
                      {board.tracks.find((entry) => entry.track.id === board.myTrackId)?.track.name}
                    </strong>
                    . Picking a project here moves it to this track.
                  </p>
                )}

                {trackProjects.length === 0 ? (
                  <EmptyState
                    title="No projects in this track yet"
                    body="Submissions are added from the admin screen. Keep this page open — it updates on its own."
                  />
                ) : (
                  <ProjectGrid
                    projects={trackProjects}
                    standings={selected.standings}
                    myProjectId={board.myProjectId}
                    pendingProjectId={live.pendingProjectId}
                    disabled={!votingOpen}
                    onPick={(projectId) => live.placeBet(selected.track.id, projectId)}
                  />
                )}
              </section>

              {trackProjects.length > 0 && (
                <section className="mt-11">
                  <SectionHeading
                    title={`${selected.track.name} — live standings`}
                    aside={
                      <StatPair
                        value={selected.voters}
                        label={selected.voters === 1 ? "bettor" : "bettors"}
                      />
                    }
                  />
                  <Leaderboard standings={selected.standings} />
                  {selected.voters === 0 ? (
                    <p className="t-meta mt-3">
                      No bets on this track yet, so every project sits at the same odds. Be
                      the first and they start moving.
                    </p>
                  ) : (
                    selected.voters < THIN_MARKET && (
                      <p className="t-meta mt-3">
                        Only {selected.voters} {selected.voters === 1 ? "bet" : "bets"} so far —
                        odds will swing a lot until more people join.
                      </p>
                    )
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}

      <footer className="mt-14">
        <Rule />
        <p className="t-meta pt-3">
          Anonymous, one bet per device.{" "}
          <Link href="/board" className="link-accent">
            Big screen
          </Link>
        </p>
      </footer>
    </main>
  );
}

function ConnectionDot({ status }: { status: ConnectionStatus }) {
  const copy =
    status === "live" ? "Live" : status === "reconnecting" ? "Reconnecting" : "Offline";

  return (
    <span className="t-label flex items-center gap-2 text-[color:var(--color-ink-muted)]">
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          background: status === "live" ? "var(--color-accent)" : "transparent",
          boxShadow: `inset 0 0 0 2px ${
            status === "live" ? "var(--color-accent)" : "var(--color-ink-faint)"
          }`,
        }}
      />
      {copy}
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-2 border-[color:var(--color-ink)] px-4 py-5">
      <p className="font-bold" style={{ fontStretch: "92%" }}>
        {title}
      </p>
      <p className="t-meta mt-1 max-w-[60ch]">{body}</p>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main
      className="mx-auto min-h-dvh w-full max-w-[52rem] px-4 pt-6"
      aria-busy="true"
      aria-label="Loading"
    >
      <span className="t-label">Public vote</span>
      <Rule thick />
      <div className="skeleton mt-6 h-11 w-2/3" />
      <div
        className="mt-8 grid gap-2"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}
      >
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="skeleton" style={{ height: 148 }} />
        ))}
      </div>
    </main>
  );
}

function ErrorScreen({ message }: { message: string | null }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[52rem] px-4 pt-6">
      <span className="t-label">Public vote</span>
      <Rule thick />
      <h1 className="t-display pt-8">Connection lost</h1>
      <p className="t-meta mt-3 max-w-[65ch]">
        {message ?? "The database is not responding."} This page reconnects on its own; if
        nothing comes back, reload.
      </p>
      <button type="button" className="btn mt-6" onClick={() => window.location.reload()}>
        Reload
      </button>
    </main>
  );
}
