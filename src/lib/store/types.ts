import type { Bet, Project, Track } from "@/lib/types";

export type Snapshot = {
  votingOpen: boolean;
  tracks: Track[];
  projects: Project[];
  bets: Bet[];
};

export type ProjectInput = {
  name: string;
  team: string;
  brand: string | null;
};

/**
 * Tout ce que le serveur sait faire des données, indépendamment de l'endroit
 * où elles vivent. Deux implémentations : Postgres via Supabase pour le
 * déploiement, SQLite sur le disque pour un repli hors ligne.
 */
export interface Store {
  readonly kind: "supabase" | "sqlite";

  snapshot(): Promise<Snapshot>;

  isVotingOpen(): Promise<boolean>;
  setVotingOpen(open: boolean): Promise<void>;

  /** Valide qu'un projet appartient bien à la track annoncée par le client. */
  projectBelongsToTrack(projectId: string, trackId: string): Promise<boolean>;
  /** Un pari par appareil : un second appel remplace le premier, track comprise. */
  placeBet(voterId: string, trackId: string, projectId: string): Promise<void>;
  clearBets(): Promise<void>;

  setWinner(trackId: string, projectId: string | null): Promise<void>;
  updateTrack(id: string, name: string, subtitle: string): Promise<void>;

  countProjects(trackId: string): Promise<number>;
  addProject(trackId: string, input: ProjectInput, position: number): Promise<void>;
  updateProject(id: string, input: ProjectInput): Promise<void>;
  deleteProject(id: string): Promise<void>;
  replaceProjects(trackId: string, inputs: ProjectInput[]): Promise<void>;

  /**
   * Notifie les écrans connectés. Présent seulement en SQLite : Supabase a
   * son propre canal Realtime, auquel les navigateurs s'abonnent en direct.
   */
  subscribe?(listener: () => void): () => void;
}
