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

        return (
          <li key={track.id}>
            <button
              type="button"
              className={`tile w-full${isSelected ? " tile-mine" : ""}`}
              style={{ minHeight: 148 }}
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onSelect(track.id)}
            >
              <span className="flex w-full flex-col gap-1.5">
                <span
                  // Le bleu ne désigne que toi : il n'apparaît que sur la
                  // track qui porte ton pari, et seulement quand la tuile
                  // n'est pas déjà remplie en bleu.
                  className={`t-label${isBet && !isSelected ? " ink-mine" : ""}`}
                  style={{ opacity: isSelected ? 0.85 : 1 }}
                >
                  {isBet ? "● Your track" : `${count} ${count === 1 ? "project" : "projects"}`}
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
