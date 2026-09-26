export type Track = {
  id: string;
  /** Identifiant lisible et stable, utilisé dans les URL : short-film, animation, ad. */
  key: string;
  name: string;
  /** Une ligne de contexte, la "challenge" du deck. */
  subtitle: string;
  position: number;
  winner_project_id: string | null;
};

export type Project = {
  id: string;
  track_id: string;
  name: string;
  team: string;
  /** Renseigné sur la track Ad uniquement : la marque que le projet devait vendre. */
  brand: string | null;
  position: number;
};

/** Un pari, et un seul, par appareil : choisir une track, puis un projet dedans. */
export type Bet = {
  voter_id: string;
  track_id: string;
  project_id: string;
};

export type Settings = {
  voting_open: boolean;
};

/** Une ligne de classement, déjà triée et dénormalisée pour l'affichage. */
export type Standing = {
  projectId: string;
  name: string;
  team: string;
  brand: string | null;
  bets: number;
  /** 0–100, arrondi à une décimale. Part des paris de SA track, pas du total. */
  share: number;
  /** Rang partagé : deux projets à égalité portent le même numéro. */
  rank: number;
  isWinner: boolean;
  isMine: boolean;
};

export type TrackBoard = {
  track: Track;
  standings: Standing[];
  /** Nombre de personnes ayant parié sur cette track. */
  voters: number;
  /** Part de ces parieurs dans l'ensemble des parieurs, 0–100. */
  share: number;
};

export type Board = {
  tracks: TrackBoard[];
  totalVoters: number;
  myTrackId: string | null;
  myProjectId: string | null;
};
