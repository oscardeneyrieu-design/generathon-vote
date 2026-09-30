"use client";

import { useMemo, useState } from "react";

import { EmptyState, LiveBadge, Notice, PageHeader, plural, Stat } from "@/components/Bits";
import { Countdown } from "@/components/Countdown";
import { Leaderboard } from "@/components/Leaderboard";
import { OddsChart } from "@/components/OddsChart";
import { Podium } from "@/components/Podium";
import { ProjectGrid } from "@/components/ProjectGrid";
import { TrackTabs } from "@/components/TrackTabs";
import { THIN_MARKET } from "@/lib/odds";
import { useLive } from "@/lib/use-live";
import { formatDeadline } from "@/lib/voting";
import type { Member } from "@/lib/types";

export default function VotePage() {
  const live = useLive();
  const { board, bettingOpen } = live;

  // On ouvre sur la première track : un nouvel arrivant voit tout de suite
  // des projets et des cotes.
  const [browsingTrackId, setBrowsingTrackId] = useState<string | null>(null);
  const selected =
    board.tracks.find((entry) => entry.track.id === browsingTrackId) ?? board.tracks[0] ?? null;
  const trackProjects = live.projects.filter((project) => project.track_id === selected?.track.id);

  // Après un pari, la prochaine track où il reste à parier.
  const nextTrack = board.tracks.find((entry) => entry.myProjectId === null && entry !== selected);

  const membersByProject = useMemo(() => {
    const map = new Map<string, Member[]>();
    for (const member of live.members) {
      map.set(member.project_id, [...(map.get(member.project_id) ?? []), member]);
    }
    return map;
  }, [live.members]);

  if (live.status === "loading") return <LoadingScreen />;

  if (live.status === "error") {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
        <PageHeader
          title="Connexion perdue"
          intro={`${live.error ?? "La base ne répond pas."} La page se reconnecte toute seule ; sinon, recharge-la.`}
        />
        <div>
          <button type="button" className="btn btn-gold" onClick={() => window.location.reload()}>
            Recharger
          </button>
        </div>
      </main>
    );
  }

  const deadlinePassed = live.votingOpen && live.closesAt !== null && !bettingOpen;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-10 sm:py-12">
      <div className="flex flex-col gap-3">
        <LiveBadge status={live.status} />
        <PageHeader
          title="Parie sur les gagnants"
          intro={
            bettingOpen
              ? "Désigne le projet qui va gagner chaque track : un pari par track, modifiable jusqu'à la clôture."
              : "Les paris sont clos. Voici ce que la salle avait prédit."
          }
          aside={
            <div className="flex gap-8">
              <Stat value={`${board.myBetCount}/${board.tracks.length}`} label="Tes paris" />
              <Stat value={board.totalVoters} label={board.totalVoters > 1 ? "parieurs" : "parieur"} />
            </div>
          }
        />
      </div>

      {bettingOpen && live.closesAt && (
        <div className="card p-4">
          <Countdown closesAt={live.closesAt} />
        </div>
      )}

      {!bettingOpen && (
        <div className="rounded-xl border border-gold bg-gold/10 px-4 py-3 font-semibold">
          {deadlinePassed
            ? `Les paris sont clos depuis ${formatDeadline(live.closesAt!)}.`
            : "Les paris sont clos"}{" "}
          <span className="font-normal">Les classements restent visibles.</span>
        </div>
      )}

      {live.error && <Notice onDismiss={live.dismissError}>{live.error}</Notice>}

      {board.tracks.length === 0 || !selected ? (
        <EmptyState
          title="Aucune track pour l'instant"
          body="Les tracks sont créées au premier lancement. Si tu vois ce message, la base n'a pas été initialisée."
        />
      ) : (
        <>
          <section>
            <h2 className="section-title">1 · Choisis une track</h2>
            <TrackTabs
              boards={board.tracks}
              selectedTrackId={selected.track.id}
              onSelect={setBrowsingTrackId}
            />
            {selected.track.subtitle && <p className="muted mt-3 text-sm">{selected.track.subtitle}</p>}
          </section>

          <section>
            <h2 className="section-title">2 · Ton gagnant pour {selected.track.name}</h2>

            {trackProjects.length === 0 ? (
              <EmptyState
                title="Pas encore de projet dans cette track"
                body="Les projets sont ajoutés par l'organisation. Garde la page ouverte : elle se met à jour toute seule."
              />
            ) : (
              <ProjectGrid
                projects={trackProjects}
                standings={selected.standings}
                membersByProject={membersByProject}
                myProjectId={selected.myProjectId}
                pendingProjectId={live.pendingProjectId}
                disabled={!bettingOpen}
                onPick={(projectId) => live.placeBet(selected.track.id, projectId)}
              />
            )}

            {bettingOpen && selected.myProjectId && nextTrack && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blue-600/10 px-4 py-3">
                <span className="text-sm">
                  Pari enregistré. Il te reste à parier sur{" "}
                  <strong>{plural(board.tracks.length - board.myBetCount, "track")}</strong>.
                </span>
                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={() => {
                    setBrowsingTrackId(nextTrack.track.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  {nextTrack.track.name} →
                </button>
              </div>
            )}
          </section>

          {trackProjects.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="section-title mb-0">Classement en direct</h2>
                <span className="faint text-sm">{plural(selected.voters, "parieur")}</span>
              </div>

              <Podium podium={selected.podium} />
              <Leaderboard standings={selected.standings} />

              <p className="muted text-sm">
                {selected.voters === 0
                  ? "Personne n'a encore parié ici : tous les projets partent à la même cote."
                  : selected.voters < THIN_MARKET
                    ? `Seulement ${plural(selected.voters, "pari")} pour l'instant : les cotes vont encore beaucoup bouger.`
                    : "La cote indique ce que rapporterait une mise de 1 si le projet gagne : moins il est soutenu, plus elle est haute."}
              </p>
            </section>
          )}

          {trackProjects.length > 0 && selected.voters > 0 && (
            <section>
              <h2 className="section-title">Évolution des cotes</h2>
              <div className="card p-4">
                <OddsChart series={live.series.get(selected.track.id) ?? []} height={210} />
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

/** Aucun écran n'affirme avant de savoir : squelettes tant que l'état n'est pas lu. */
function LoadingScreen() {
  return (
    <main
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12"
      aria-busy="true"
      aria-label="Chargement"
    >
      <div className="skeleton h-9 w-64" />
      <div className="skeleton h-4 w-80 max-w-full" />
      <div className="grid gap-2 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="skeleton h-16" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton h-32" />
        ))}
      </div>
    </main>
  );
}
