"use client";

import { placeLabel, plural } from "./Bits";
import { MemberList } from "./Members";
import { formatOdds } from "@/lib/odds";
import type { Member, Project, Standing } from "@/lib/types";

type Props = {
  projects: Project[];
  standings: Standing[];
  membersByProject: Map<string, Member[]>;
  myProjectId: string | null;
  pendingProjectId: string | null;
  disabled: boolean;
  onPick: (projectId: string) => void;
};

/**
 * Les projets d'une track, en cartes comme la page « Projets » de
 * generathon.tech, avec les personnes de l'équipe et leur photo. Ordre fixe
 * défini en admin, jamais trié par cote : une grille qui se réordonne sous
 * le pouce fait parier sur le mauvais projet.
 */
export function ProjectGrid({
  projects,
  standings,
  membersByProject,
  myProjectId,
  pendingProjectId,
  disabled,
  onPick,
}: Props) {
  const byId = new Map(standings.map((standing) => [standing.projectId, standing]));

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => {
        const standing = byId.get(project.id);
        const isMine = myProjectId === project.id;
        const place = standing?.place ?? null;

        return (
          <button
            key={project.id}
            type="button"
            aria-pressed={isMine}
            disabled={disabled || pendingProjectId === project.id}
            onClick={() => onPick(project.id)}
            className={`flex min-h-32 flex-col gap-2 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed ${
              isMine
                ? "border-blue-600 bg-blue-600/10 ring-1 ring-blue-600 dark:border-blue-400 dark:ring-blue-400"
                : "border-black/10 enabled:hover:border-gold dark:border-white/15"
            } ${disabled && !isMine && place === null ? "opacity-60" : ""}`}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold tracking-tight">{project.name}</span>
                {(project.team || project.brand) && (
                  <span className="text-sm text-black/55 dark:text-white/55">
                    {[project.team, project.brand].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <span className="flex flex-wrap justify-end gap-1">
                {place !== null && <span className="pill pill-gold">🏆 {placeLabel(place)}</span>}
                {isMine && <span className="pill pill-mine">✓ Ton pari</span>}
              </span>
            </span>

            <MemberList members={membersByProject.get(project.id) ?? []} />

            <span className="mt-auto flex items-end justify-between gap-2 pt-2">
              <span className="faint text-xs">Cote · {plural(standing?.bets ?? 0, "pari")}</span>
              <span className="text-2xl font-bold leading-none tracking-tight">
                {standing ? formatOdds(standing.odds) : "—"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
