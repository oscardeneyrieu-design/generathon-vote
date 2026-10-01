"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { EmptyState, LiveBadge, Notice, PageHeader, plural } from "@/components/Bits";
import { TimeLeft } from "@/components/Countdown";
import { MyGame } from "@/components/MyGame";
import { ProjectGrid } from "@/components/ProjectGrid";
import { hasSeenRules, RulesIntro } from "@/components/RulesIntro";
import { formatPoints } from "@/lib/points";
import { useLive } from "@/lib/use-live";
import { useNow } from "@/lib/use-now";
import type { Member } from "@/lib/types";
import { betWeight, isWeighted } from "@/lib/voting";

/**
 * Onglet « Parier » : uniquement de quoi parier. La carte « Ton jeu » sert
 * aussi de sélecteur de track ; la grille des projets de la track choisie
 * suit juste en dessous. Le classement en direct, les courbes et le podium
 * vivent dans l'onglet « Classement ».
 */
export default function VotePage() {
  const live = useLive();
  const { board, bettingOpen } = live;
  const weighted = isWeighted(live.period);
  // Les points à gagner baissent avec le bonus de rapidité : on les remet à
  // jour toutes les cinq secondes, assez pour suivre sans faire clignoter.
  const now = useNow(5_000, bettingOpen && weighted);
  const bonus = bettingOpen ? betWeight(now, live.period) : null;

  // On ouvre sur la première track : un nouvel arrivant voit tout de suite
  // des projets et des points à gagner.
  const [browsingTrackId, setBrowsingTrackId] = useState<string | null>(null);
  const selected =
    board.tracks.find((entry) => entry.track.id === browsingTrackId) ?? board.tracks[0] ?? null;
  const trackProjects = live.projects.filter((project) => project.track_id === selected?.track.id);
  const gridRef = useRef<HTMLElement>(null);

  // Après un pari, la prochaine track où il reste à parier (et où on peut encore).
  const nextTrack = board.tracks.find(
    (entry) => entry.myProjectId === null && !entry.decided && entry !== selected
  );

  // Ouvrir une track amène sa grille à l'écran (sur téléphone, elle est sous
  // la carte « Ton jeu »). Le défilement attend que la nouvelle grille soit
  // rendue : d'où un compteur, que l'effet suit, plutôt qu'un appel direct.
  const [scrollRequest, setScrollRequest] = useState(0);
  const openTrack = (trackId: string) => {
    setBrowsingTrackId(trackId);
    setScrollRequest((count) => count + 1);
  };
  useEffect(() => {
    const grid = gridRef.current;
    if (scrollRequest === 0 || !grid) return;
    // Déjà bien placée (haut de l'écran) : on ne bouge pas la page pour rien.
    if (grid.getBoundingClientRect().top < window.innerHeight * 0.35) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    grid.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [scrollRequest]);

  // Les règles en plein écran à la première visite ; relisibles à la demande.
  // Lues après le montage : le serveur ne connaît pas le stockage du téléphone.
  const [rulesOpen, setRulesOpen] = useState(false);
  useEffect(() => {
    if (!hasSeenRules()) setRulesOpen(true);
  }, []);
  const rules = rulesOpen ? <RulesIntro onDone={() => setRulesOpen(false)} /> : null;

  const membersByProject = useMemo(() => {
    const map = new Map<string, Member[]>();
    for (const member of live.members) {
      map.set(member.project_id, [...(map.get(member.project_id) ?? []), member]);
    }
    return map;
  }, [live.members]);

  if (live.status === "loading") {
    return (
      <>
        <LoadingScreen />
        {rules}
      </>
    );
  }

  if (live.status === "error") {
    return (
      <main className="page-in mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
        <PageHeader
          title="Connexion perdue"
          intro={`${live.error ?? "La base ne répond pas."} La page se reconnecte toute seule ; sinon, recharge-la.`}
        />
        <div>
          <button type="button" className="btn btn-gold" onClick={() => window.location.reload()}>
            Recharger
          </button>
        </div>
        {rules}
      </main>
    );
  }

  const allBetsPlaced = board.tracks.length > 0 && board.myBetCount === board.tracks.length;

  return (
    <main className="page-in mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10 sm:gap-10 sm:py-12">
      <div className="flex flex-col gap-3">
        <LiveBadge status={live.status} />
        <PageHeader
          title="Parie sur les gagnants"
          intro={
            bettingOpen
              ? "Choisis une track, touche un projet pour le sélectionner, puis encore une fois pour confirmer ton pari."
              : "Les paris sont clos. Tes points restent figés jusqu'à l'annonce des gagnants."
          }
        />
      </div>

      <MyGame
        board={board}
        projects={live.projects}
        selectedTrackId={selected?.track.id ?? null}
        bettingOpen={bettingOpen}
        onSelectTrack={openTrack}
        onShowRules={() => setRulesOpen(true)}
      />

      {live.error && <Notice onDismiss={live.dismissError}>{live.error}</Notice>}

      {board.tracks.length === 0 || !selected ? (
        <EmptyState
          title="Aucune track pour l'instant"
          body="Les tracks sont créées au premier lancement. Si tu vois ce message, la base n'a pas été initialisée."
        />
      ) : (
        <>
          <section ref={gridRef} aria-labelledby="track-title" className="scroll-mt-24">
            <div key={`head-${selected.track.id}`} className="fade-in mb-5 flex flex-col gap-1">
              <span className="section-title mb-0">Ton gagnant pour</span>
              <h2 id="track-title" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {selected.track.name}
              </h2>
              <p className="muted text-sm">
                {selected.track.subtitle && <>{selected.track.subtitle} · </>}
                {plural(trackProjects.length, "projet")} · {plural(selected.voters, "parieur")}
              </p>
            </div>

            {trackProjects.length === 0 ? (
              <EmptyState
                title="Pas encore de projet dans cette track"
                body="Les projets sont ajoutés par l'organisation. Garde la page ouverte : elle se met à jour toute seule."
              />
            ) : (
              <ProjectGrid
                // Changer de track efface une sélection en attente de confirmation.
                key={`grid-${selected.track.id}`}
                projects={trackProjects}
                standings={selected.standings}
                membersByProject={membersByProject}
                myProjectId={selected.myProjectId}
                myPoints={selected.myPoints}
                myWon={selected.myWon}
                bonus={selected.decided ? null : bonus}
                pendingProjectId={live.pendingProjectId}
                disabled={!bettingOpen || selected.decided}
                onPick={(projectId) => live.placeBet(selected.track.id, projectId)}
              />
            )}

            {bettingOpen && selected.decided && (
              <p className="muted mt-4 text-sm">Le gagnant de cette track est annoncé : les paris y sont clos.</p>
            )}

            {bettingOpen && !selected.decided && selected.myProjectId && (
              <div
                key={`saved-${selected.myProjectId}`}
                className="fade-in mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blue-600/10 px-4 py-3"
                role="status"
              >
                <span className="text-sm">
                  Pari enregistré
                  {selected.myPoints !== null && <> : {formatPoints(selected.myPoints)} points en jeu</>}.{" "}
                  {nextTrack ? (
                    <>
                      Il te reste à parier sur{" "}
                      <strong>{plural(board.tracks.length - board.myBetCount, "track")}</strong>.
                    </>
                  ) : allBetsPlaced ? (
                    "Tes paris sont tous posés. Tu peux encore changer d'avis jusqu'à la clôture."
                  ) : null}
                </span>
                {nextTrack && (
                  <button type="button" className="btn btn-gold" onClick={() => openTrack(nextTrack.track.id)}>
                    {nextTrack.track.name} →
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Le temps restant est déjà dans la barre du haut : ici, en bas, le détail. */}
          <TimeLeft bettingOpen={bettingOpen} votingOpen={live.votingOpen} period={live.period} />

          <p className="muted text-sm">
            Le classement en direct, l&apos;évolution des paris et le podium sont dans l&apos;onglet{" "}
            <Link href="/board" className="font-semibold text-gold-ink underline underline-offset-2 dark:text-gold">
              Classement
            </Link>
            .
          </p>
        </>
      )}

      {rules}
    </main>
  );
}

/** Aucun écran n'affirme avant de savoir : squelettes tant que l'état n'est pas lu. */
function LoadingScreen() {
  return (
    <main
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12"
      aria-busy="true"
      aria-label="Chargement"
    >
      <div className="flex flex-col gap-3">
        <div className="skeleton h-9 w-64" />
        <div className="skeleton h-4 w-80 max-w-full" />
      </div>
      <div className="skeleton h-48" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="skeleton h-44" />
        ))}
      </div>
    </main>
  );
}
