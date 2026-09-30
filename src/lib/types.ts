export type Track = {
  id: string;
  /** Identifiant lisible et stable : short-film, animation, ad. */
  key: string;
  name: string;
  /** Une ligne de contexte, la "challenge" du deck. */
  subtitle: string;
  position: number;
  /**
   * Le podium de CETTE track. Chaque track a son 1er, 2e et 3e ; il n'existe
   * aucun classement au-dessus des trois tracks.
   */
  first_project_id: string | null;
  second_project_id: string | null;
  third_project_id: string | null;
};

/** 1, 2 ou 3 — la place sur le podium de sa track. */
export type Place = 1 | 2 | 3;

export type Project = {
  id: string;
  track_id: string;
  name: string;
  team: string;
  /** Renseigné sur la track Ad uniquement : la marque que le projet devait vendre. */
  brand: string | null;
  position: number;
};

/** Une personne de l'équipe d'un projet, avec sa photo éventuelle. */
export type Member = {
  id: string;
  project_id: string;
  name: string;
  /** `/api/photo/<id>` pour une photo envoyée depuis l'admin, sinon `null`. */
  photo_url: string | null;
  position: number;
};

/**
 * Un pari par appareil ET par track : on peut désigner un gagnant dans
 * chacune des tracks. Re-parier dans une track remplace le pari de cette
 * track seulement.
 */
export type Bet = {
  voter_id: string;
  track_id: string;
  project_id: string;
};

/**
 * Journal append-only : une ligne par pari posé ou modifié, jamais écrasée.
 * C'est la seule façon de reconstituer l'évolution des cotes — la table
 * `bets` ne garde que l'état courant.
 */
export type BetEvent = {
  seq: number;
  track_id: string;
  project_id: string;
  voter_id: string;
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
  /** Part des paris de SA track, 0–1. Sert uniquement à la barre de fond. */
  support: number;
  /** Rang partagé : deux projets à égalité portent le même numéro. */
  rank: number;
  /** Place officielle sur le podium de sa track, une fois annoncée. */
  place: Place | null;
  isMine: boolean;
};

/** Un point de la courbe d'un projet : sa cote après le n-ième parieur. */
export type SeriesPoint = {
  /** Nombre de parieurs sur la track à cet instant. */
  bettors: number;
  odds: number;
};

export type ProjectSeries = {
  projectId: string;
  name: string;
  points: SeriesPoint[];
  /** Cote courante — sert à trier les courbes, la plus faible en premier. */
  currentOdds: number;
  place: Place | null;
  isMine: boolean;
};

export type TrackBoard = {
  track: Track;
  standings: Standing[];
  /** Nombre de personnes ayant parié sur cette track. */
  voters: number;
  /** Podium annoncé, dans l'ordre. Vide tant que rien n'est annoncé. */
  podium: Standing[];
  /** Le projet sur lequel j'ai parié dans cette track, s'il y en a un. */
  myProjectId: string | null;
};

export type Board = {
  tracks: TrackBoard[];
  /** Personnes distinctes ayant parié au moins une fois, toutes tracks confondues. */
  totalVoters: number;
  /** Nombre de tracks sur lesquelles j'ai parié. */
  myBetCount: number;
};
