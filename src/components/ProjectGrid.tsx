"use client";

import { formatShare } from "./Bits";
import type { Project, Standing } from "@/lib/types";

type Props = {
  projects: Project[];
  standings: Standing[];
  myProjectId: string | null;
  pendingProjectId: string | null;
  disabled: boolean;
  onPick: (projectId: string) => void;
};

/**
 * Étape 2 : le projet. Ordre stable défini en admin, jamais trié par score —
 * une grille qui se réordonne sous le pouce fait parier sur le mauvais projet.
 */
export function ProjectGrid({
  projects,
  standings,
  myProjectId,
  pendingProjectId,
  disabled,
  onPick,
}: Props) {
  const byId = new Map(standings.map((standing) => [standing.projectId, standing]));

  return (
    <ul
      className="grid list-none gap-2 p-0"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}
    >
      {projects.map((project) => {
        const standing = byId.get(project.id);
        const isMine = myProjectId === project.id;
        const isWinner = standing?.isWinner ?? false;
        const isPending = pendingProjectId === project.id;

        const classes = ["tile"];
        if (isMine) classes.push("tile-mine");
        if (isWinner) classes.push("tile-correct");

        return (
          <li key={project.id}>
            <button
              type="button"
              className={`${classes.join(" ")} w-full`}
              disabled={disabled || isPending}
              aria-pressed={isMine}
              onClick={() => onPick(project.id)}
            >
              <span className="flex w-full flex-col gap-1">
                <span className="tile-name">{project.name}</span>
                {(project.team || project.brand) && (
                  <span className="text-xs leading-snug" style={{ opacity: 0.7 }}>
                    {[project.team, project.brand].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>

              <span className="flex w-full items-baseline justify-between gap-2">
                <span className="t-label">
                  {/* L'état ne repose jamais sur la seule inversion. */}
                  {isWinner ? "Winner" : isMine ? "● Your bet" : ""}
                </span>
                <span className="text-sm font-bold" style={{ opacity: isMine ? 1 : 0.65 }}>
                  {standing ? `${formatShare(standing.share)} %` : "—"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
