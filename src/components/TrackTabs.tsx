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
 * generathon.tech : l'onglet affiché est doré. Sert à l'espace organisateur
 * (côté public, c'est la carte « Ton jeu » qui choisit la track).
 */
export function TrackTabs({ boards, selectedTrackId, onSelect }: Props) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {boards.map(({ track, standings, voters, decided }) => {
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
              {decided && <span className={`pill ${selected ? "bg-black/15 text-black" : "pill-gold"}`}>🏆 Décidée</span>}
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
