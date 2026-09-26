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
  /**
   * Cote décimale, jamais inférieure à 1.00 : ce que rapporterait une mise
   * de 1 sur ce projet. Voir `computeOdds` pour le lissage.
   */
  odds: number;
  /**
   * Part des paris de SA track, 0–1. Sert uniquement à la largeur de la
   * barre de fond — elle n'est plus affichée en chiffre nulle part.
   */
  support: number;
  /** Rang partagé : deux projets à égalité portent le même numéro. */
  rank: number;
  isWinner: boolean;
  isMine: boolean;
};

export type TrackBoard = {
  track: Track;
  standings: Standing[];
  /**
   * Nombre de personnes ayant parié sur cette track. Volontairement pas de
   * part du total : les trois tracks ne se classent pas entre elles, chacune
   * a son gagnant et il n'y a pas de vainqueur au-dessus des trois.
   */
  voters: number;
};

export type Board = {
  tracks: TrackBoard[];
  totalVoters: number;
  myTrackId: string | null;
  myProjectId: string | null;
};
