import type { Bet, BetEvent, Member, Project, Track } from "@/lib/types";

/** Tout l'état que les écrans lisent, en une fois. */
export type Snapshot = {
  /** Interrupteur de l'admin. L'état réel tient aussi compte de `closesAt`. */
  votingOpen: boolean;
  /** Heure de clôture automatique (ISO), ou `null` sans limite. */
  closesAt: string | null;
  tracks: Track[];
  projects: Project[];
  members: Member[];
  bets: Bet[];
  /** Journal append-only, pour reconstituer l'évolution des cotes. */
  events: BetEvent[];
};

/** Le podium d'une track : 1er, 2e, 3e. `null` = pas encore annoncé. */
export type Podium = {
  first: string | null;
  second: string | null;
  third: string | null;
};

export type ProjectInput = {
  name: string;
  team: string;
  brand: string | null;
  /** Noms des membres, utilisé seulement par l'import en masse. */
  members?: string[];
};

export type Voting = { open: boolean; closesAt: string | null };

/**
 * Tout ce que le serveur sait faire des données, indépendamment de l'endroit
 * où elles vivent. Deux implémentations : Postgres via Supabase pour le
 * déploiement, SQLite sur le disque pour le local.
 */
export interface Store {
  readonly kind: "supabase" | "sqlite";

  snapshot(): Promise<Snapshot>;

  getVoting(): Promise<Voting>;
  setVoting(voting: Voting): Promise<void>;

  /** Valide qu'un projet appartient bien à la track annoncée par le client. */
  projectBelongsToTrack(projectId: string, trackId: string): Promise<boolean>;
  /** Un pari par appareil et par track : re-parier remplace le pari de cette track. */
  placeBet(voterId: string, trackId: string, projectId: string): Promise<void>;
  clearBets(): Promise<void>;

  setPodium(trackId: string, podium: Podium): Promise<void>;
  updateTrack(id: string, name: string, subtitle: string): Promise<void>;

  countProjects(trackId: string): Promise<number>;
  addProject(trackId: string, input: ProjectInput, position: number): Promise<void>;
  updateProject(id: string, input: ProjectInput): Promise<void>;
  deleteProject(id: string): Promise<void>;
  replaceProjects(trackId: string, inputs: ProjectInput[]): Promise<void>;

  addMember(projectId: string, name: string, photoUrl: string | null): Promise<void>;
  updateMember(id: string, name: string, photoUrl: string | null): Promise<void>;
  deleteMember(id: string): Promise<void>;

  /** Photos stockées en base (base64), servies par /api/photo/<id>. */
  savePhoto(mime: string, base64: string): Promise<string>;
  getPhoto(id: string): Promise<{ mime: string; data: string } | null>;

  /**
   * Notifie les écrans connectés. Présent seulement en SQLite : Supabase a
   * son propre canal Realtime, auquel les navigateurs s'abonnent en direct.
   */
  subscribe?(listener: () => void): () => void;
}
