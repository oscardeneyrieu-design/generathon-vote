import type { Snapshot } from "@/lib/store/types";

export type { Snapshot };

export type TransportStatus = "live" | "reconnecting";

/**
 * Ce dont un écran a besoin pour rester à jour : relire l'état, et être
 * prévenu qu'il a changé. Deux implémentations côté navigateur, choisies par
 * la même variable que le store serveur.
 */
export interface LiveSource {
  fetchSnapshot(): Promise<Snapshot>;
  subscribe(handlers: {
    onChange: () => void;
    onStatus: (status: TransportStatus) => void;
  }): () => void;
}
