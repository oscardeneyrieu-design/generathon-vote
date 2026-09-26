"use client";

import { formatOdds } from "@/lib/odds";
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
 * Étape 2 : le projet. Ordre stable défini en admin, jamais trié par cote —
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
        if (isWinner) classes.push("tile-win");

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
                  <span className="text-xs leading-snug" style={{ opacity: 0.72 }}>
                    {[project.team, project.brand].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>

              <span className="flex w-full items-end justify-between gap-2">
                <span className="t-label" style={{ opacity: 0.85 }}>
                  {/* L'état ne repose jamais sur la seule couleur. */}
                  {isWinner && isMine
                    ? "Winner · yours"
                    : isWinner
                      ? "Winner"
                      : isMine
                        ? "● Your bet"
                        : "Odds"}
                </span>
                <span
                  className="font-extrabold leading-none"
                  style={{ fontSize: "1.25rem", fontStretch: "90%", letterSpacing: "-0.02em" }}
                >
                  {standing ? formatOdds(standing.odds) : "—"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
