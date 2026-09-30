"use client";

import { plural } from "./Bits";
import type { TrackBoard } from "@/lib/types";

type Props = {
  boards: TrackBoard[];
  selectedTrackId: string | null;
  onSelect: (trackId: string) => void;
};

/**
 * Les trois tracks en onglets, sur le modèle des boutons « Vous êtes » de
 * generathon.tech : l'onglet affiché est doré. Chaque track où tu as déjà
 * parié porte la marque bleue « ✓ Ton pari ».
 */
export function TrackTabs({ boards, selectedTrackId, onSelect }: Props) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {boards.map(({ track, standings, voters, myProjectId }) => {
        const selected = selectedTrackId === track.id;

        return (
          <button
            key={track.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(track.id)}
            className={`flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition ${
              selected
                ? "border-gold bg-gold text-black"
                : "border-black/15 hover:border-gold dark:border-white/20"
            }`}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="font-semibold tracking-tight">{track.name}</span>
              {myProjectId && <span className="pill pill-mine">✓ Ton pari</span>}
            </span>
            <span className={`text-xs ${selected ? "text-black/70" : "faint"}`}>
              {plural(standings.length, "projet")} · {plural(voters, "parieur")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
