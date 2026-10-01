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
  /** Heure du dernier pari de cette personne dans cette track (ISO). */
  updated_at: string;
  /**
   * Points à gagner, figés au moment du pari : popularité du projet à cet
   * instant × bonus de rapidité. Voir `potentialPoints`.
   */
  points: number;
};

/**
 * Journal append-only : une ligne par pari posé ou modifié, jamais écrasée.
 * C'est la seule façon de reconstituer l'évolution des paris — la table
 * `bets` ne garde que l'état courant.
 */
export type BetEvent = {
  seq: number;
  track_id: string;
  project_id: string;
  voter_id: string;
  /** Heure du pari (ISO) : l'axe horizontal des courbes. */
  created_at: string;
};

/** Une ligne de classement, déjà triée et dénormalisée pour l'affichage. */
export type Standing = {
  projectId: string;
  name: string;
  team: string;
  brand: string | null;
  /** Nombre de personnes qui ont parié sur ce projet. C'est lui qui fait le rang. */
  bets: number;
  /**
   * Ce que rapporterait un pari sur ce projet posé maintenant, avant le bonus
   * de rapidité (qui dépend de l'heure, donc appliqué à l'affichage). Mon
   * propre pari n'y compte pas : je ne suis pas mon propre concurrent.
   */
  gainBase: number;
  /** Part des parieurs de SA track, 0–1. Sert uniquement à la barre de fond. */
  support: number;
  /** Rang partagé : deux projets à égalité portent le même numéro. */
  rank: number;
  /** Place officielle sur le podium de sa track, une fois annoncée. */
  place: Place | null;
  isMine: boolean;
};

/** Un point de la courbe d'un projet : son nombre de paris à un instant donné. */
export type SeriesPoint = {
  /** Instant du changement, en millisecondes depuis 1970. */
  time: number;
  bets: number;
};

export type ProjectSeries = {
  projectId: string;
  name: string;
  points: SeriesPoint[];
  /** Nombre de paris actuel — sert à trier les courbes, le plus soutenu en premier. */
  currentBets: number;
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
  /** Les points que mon pari peut rapporter (figés au moment du pari), ou `null` sans pari. */
  myPoints: number | null;
  /** Vrai dès que le 1er de la track est annoncé : les gains sont alors connus. */
  decided: boolean;
  /** Ce que mon pari a rapporté, une fois la track décidée ; `null` avant ou sans pari. */
  myWon: number | null;
};

export type Board = {
  tracks: TrackBoard[];
  /** Personnes distinctes ayant parié au moins une fois, toutes tracks confondues. */
  totalVoters: number;
  /** Nombre de tracks sur lesquelles j'ai parié. */
  myBetCount: number;
  /** Mes points encore en jeu : paris des tracks pas encore décidées, comptés comme s'ils finissaient 1ers. */
  myPointsAtStake: number;
  /** Mes points gagnés dans les tracks décidées. */
  myPointsWon: number;
  /** Nombre de tracks dont le 1er est annoncé. */
  decidedTracks: number;
};
