"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { placeLabel, plural } from "./Bits";
import { MemberStack } from "./Members";
import { formatPoints } from "@/lib/points";
import type { Member, Project, Standing } from "@/lib/types";

type Props = {
  projects: Project[];
  standings: Standing[];
  membersByProject: Map<string, Member[]>;
  myProjectId: string | null;
  /** Les points que mon pari peut rapporter, figés au moment où je l'ai posé. */
  myPoints: number | null;
  /** Ce que mon pari a rapporté, une fois le podium de la track annoncé. */
  myWon: number | null;
  /** Bonus de rapidité du moment tant que les paris sont ouverts, sinon `null`. */
  bonus: number | null;
  pendingProjectId: string | null;
  disabled: boolean;
  onPick: (projectId: string) => void;
};

/** Sans second tap dans ce délai, la sélection retombe : un téléphone posé ne doit pas parier tout seul. */
const ARMED_MS = 8_000;

/**
 * Les projets d'une track, en cartes, quatre par ligne sur grand écran. Ordre
 * fixe défini en admin, jamais trié par popularité : une grille qui se
 * réordonne sous le pouce fait parier sur le mauvais projet.
 *
 * Parier se fait en deux taps sur la même carte : le premier la sélectionne
 * et affiche « Touche encore pour confirmer », le second pose le pari.
 *
 * La teinte de chaque carte va du froid (favori, peu de points à gagner) au
 * chaud (outsider, beaucoup de points). Le chiffre reste écrit sur la carte :
 * la couleur ne fait que l'appuyer.
 */
export function ProjectGrid({
  projects,
  standings,
  membersByProject,
  myProjectId,
  myPoints,
  myWon,
  bonus,
  pendingProjectId,
  disabled,
  onPick,
}: Props) {
  const byId = new Map(standings.map((standing) => [standing.projectId, standing]));
  const [armedId, setArmedId] = useState<string | null>(null);
  /** La carte qui vient de recevoir le pari, le temps de son animation. */
  const [justPickedId, setJustPickedId] = useState<string | null>(null);

  useEffect(() => {
    if (!armedId) return;
    const timer = setTimeout(() => setArmedId(null), ARMED_MS);
    return () => clearTimeout(timer);
  }, [armedId]);

  useEffect(() => {
    if (!justPickedId) return;
    const timer = setTimeout(() => setJustPickedId(null), 700);
    return () => clearTimeout(timer);
  }, [justPickedId]);

  // Paris fermés entre les deux taps : plus rien à confirmer.
  useEffect(() => {
    if (disabled) setArmedId(null);
  }, [disabled]);

  const heat = bonus === null ? null : heatScale(standings.map((standing) => standing.gainBase));
  const armed = projects.find((project) => project.id === armedId) ?? null;

  return (
    <div onKeyDown={(event) => event.key === "Escape" && setArmedId(null)}>
      {heat && <HeatLegend />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {projects.map((project, index) => {
          const standing = byId.get(project.id);
          const isMine = myProjectId === project.id;
          const isArmed = armedId === project.id;
          const place = standing?.place ?? null;
          const gainNow = bonus !== null && standing ? standing.gainBase * bonus : null;
          const tint = heat && standing ? heat(standing.gainBase) : null;

          return (
            <button
              key={project.id}
              type="button"
              aria-pressed={isMine}
              disabled={disabled || pendingProjectId === project.id}
              onClick={() => {
                if (isMine) return; // déjà mon pari : rien à confirmer
                if (isArmed) {
                  setArmedId(null);
                  setJustPickedId(project.id);
                  onPick(project.id);
                } else {
                  setArmedId(project.id);
                }
              }}
              style={{ "--i": index, ...(tint ? { "--tint": tint } : {}) } as CSSProperties}
              className={`project-card stagger-in relative flex min-h-36 flex-col sm:min-h-44 overflow-hidden rounded-2xl border text-left shadow-sm transition disabled:cursor-not-allowed ${
                isMine ? "cursor-default" : "enabled:hover:-translate-y-0.5 enabled:hover:shadow-md enabled:active:scale-[0.98]"
              } ${tint ? "project-card-tinted" : ""} ${isMine && justPickedId === project.id ? "just-picked" : ""} ${
                isMine
                  ? "border-blue-600 ring-2 ring-blue-600 dark:border-blue-400 dark:ring-blue-400"
                  : isArmed
                    ? "border-gold ring-2 ring-gold"
                    : place !== null
                      ? "border-gold"
                      : "border-black/10 dark:border-white/15"
              } ${disabled && !isMine && place === null ? "opacity-60" : ""}`}
            >
              {/* Bandeau de couleur : la teinte de la carte, à pleine intensité. */}
              <span aria-hidden="true" className="project-card-band h-1.5 w-full shrink-0" />

              <span className="flex flex-1 flex-col gap-3 p-3.5 sm:p-4">
                {(place !== null || isMine) && (
                  <span className="flex flex-wrap gap-1">
                    {place !== null && <span className="pill pill-gold">🏆 {placeLabel(place)}</span>}
                    {isMine && <span className="pill pill-mine">✓ Ton pari</span>}
                  </span>
                )}

                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-base font-bold leading-tight tracking-tight sm:text-lg">{project.name}</span>
                  {(project.team || project.brand) && (
                    <span className="truncate text-xs text-black/55 dark:text-white/55">
                      {[project.team, project.brand].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>

                <MemberStack members={membersByProject.get(project.id) ?? []} />

                <CardFooter
                  bets={standing?.bets ?? 0}
                  {...(isMine && myWon !== null
                    ? { caption: "Tu as gagné", points: myWon }
                    : isMine && myPoints !== null
                      ? { caption: "Tes points en jeu", points: myPoints }
                      : gainNow !== null
                        ? { caption: "À gagner", points: gainNow }
                        : { caption: null, points: null })}
                />
              </span>

              {isArmed && (
                <span className="armed-overlay absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/80 p-3 text-center text-white backdrop-blur-[2px]">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
                    Sélectionné
                  </span>
                  <span className="text-base font-bold leading-snug">Touche encore pour confirmer</span>
                  {gainNow !== null && (
                    <span className="text-sm text-white/70">
                      {formatPoints(gainNow)} pts à gagner
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Pour les lecteurs d'écran : l'étape de confirmation ne se voit pas qu'à l'œil. */}
      <p className="sr-only" aria-live="polite">
        {armed ? `${armed.name} sélectionné. Appuie encore sur la carte pour confirmer ton pari.` : ""}
      </p>
    </div>
  );
}

/**
 * Associe à chaque gain une couleur entre « froid » et « chaud ». Échelle
 * logarithmique : les gains vont de quelques centaines à plusieurs milliers,
 * en linéaire tous les favoris auraient la même teinte.
 */
function heatScale(gains: number[]): ((gain: number) => string) | null {
  const positive = gains.filter((gain) => gain > 0);
  if (positive.length === 0) return null;
  const low = Math.log(Math.min(...positive));
  const high = Math.log(Math.max(...positive));

  return (gain) => {
    const t = high === low ? 0.5 : (Math.log(Math.max(gain, 1)) - low) / (high - low);
    const percent = Math.round(Math.min(1, Math.max(0, t)) * 100);
    return `color-mix(in oklab, var(--heat-high) ${percent}%, var(--heat-low))`;
  };
}

/** La clé des couleurs, au-dessus de la grille. */
function HeatLegend() {
  return (
    <div className="mb-3 flex items-center gap-3 text-xs text-black/55 dark:text-white/55">
      <span className="shrink-0">Moins de points</span>
      <span aria-hidden="true" className="heat-bar h-1.5 min-w-8 flex-1 rounded-full" />
      <span className="shrink-0">Plus de points</span>
    </div>
  );
}

/**
 * Le chiffre de la carte : les points en jeu. Les miens sont figés au moment
 * du pari ; ceux des autres projets sont ce que rapporterait un pari posé
 * maintenant. Une fois les paris clos, il ne reste que le nombre de paris.
 */
function CardFooter({ bets, caption, points }: { bets: number; caption: string | null; points: number | null }) {
  return (
    <span className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-1 border-t border-black/10 pt-3 dark:border-white/10">
      <span className="flex flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/45 dark:text-white/45">
          {caption ?? "Paris"}
        </span>
        <span className="text-2xl font-extrabold leading-none tracking-tight tabular-nums">
          {points === null ? bets : formatPoints(points)}
          {points !== null && <span className="ml-1 text-xs font-semibold text-black/45 dark:text-white/45">pts</span>}
        </span>
      </span>
      {points !== null && <span className="text-xs text-black/45 dark:text-white/45">{plural(bets, "pari")}</span>}
    </span>
  );
}
