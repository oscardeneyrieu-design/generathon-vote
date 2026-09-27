"use client";

import type { TrackBoard } from "@/lib/types";

type Props = {
  boards: TrackBoard[];
  selectedTrackId: string | null;
  /** La track sur laquelle le pari est réellement enregistré, si pari il y a. */
  betTrackId: string | null;
  projectCounts: Map<string, number>;
  disabled: boolean;
  onSelect: (trackId: string) => void;
};

/**
 * Étape 1 : une track, une seule. Les trois choix sont côte à côte plutôt
 * qu'en menu déroulant — c'est le choix structurant du parcours, il mérite
 * la pleine largeur et le nom complet du challenge.
 *
 * Aucune part du total n'est affichée ici : les trois tracks ne se classent
 * pas entre elles, chacune a son gagnant.
 */
export function TrackPicker({
  boards,
  selectedTrackId,
  betTrackId,
  projectCounts,
  disabled,
  onSelect,
}: Props) {
  return (
    <ul
      className="grid list-none gap-2 p-0"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}
    >
      {boards.map(({ track, voters }) => {
        const isSelected = selectedTrackId === track.id;
        const isBet = betTrackId === track.id;
        const count = projectCounts.get(track.id) ?? 0;

        // Trois états distincts : ton pari (aplat bleu plein), la track que
        // tu consultes (cadre bleu), et les autres. Confondre les deux
        // premiers laisserait croire qu'on a parié en se contentant de
        // regarder.
        const classes = ["tile", "w-full"];
        if (isBet) classes.push("tile-mine");
        else if (isSelected) classes.push("tile-viewing");

        return (
          <li key={track.id}>
            <button
              type="button"
              className={classes.join(" ")}
              style={{ minHeight: 148 }}
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onSelect(track.id)}
            >
              <span className="flex w-full flex-col gap-1.5">
                <span
                  className={`t-label${isBet ? "" : " ink-accent"}`}
                  style={{ opacity: isBet ? 0.85 : 1 }}
                >
                  {isBet ? "● Your bet is here" : `${count} ${count === 1 ? "project" : "projects"}`}
                </span>
                <span className="tile-name">{track.name}</span>
                <span className="text-[0.8125rem] leading-snug" style={{ opacity: 0.75 }}>
                  {track.subtitle}
                </span>
              </span>

              <span className="t-label w-full" style={{ opacity: 0.85 }}>
                {voters} {voters === 1 ? "bettor" : "bettors"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
