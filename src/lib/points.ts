import type { Place } from "./types.ts";

/** Ce que rapporte un pari sur un projet que personne n'a encore choisi, dans une track vide. */
export const BASE_POINTS = 100;

/** En dessous, une track a trop peu de parieurs pour que ses gains veuillent dire quoi que ce soit. */
export const THIN_MARKET = 8;

/** Part des points gagnée selon la place du projet sur le podium de sa track. */
export const PODIUM_SHARE: Record<Place, number> = { 1: 1, 2: 0.5, 3: 0.25 };

/**
 * Points que rapporterait un pari sur ce projet, selon sa popularité au
 * moment où on parie, avant le bonus de rapidité.
 *
 * C'est l'ancienne cote pari-mutuel lissée, multipliée par 100 :
 *
 *     points = 100 × (parieurs de la track + nbProjets) / (parieurs du projet + 1)
 *
 * Les comptes excluent le parieur lui-même : changer d'avis ne doit pas se
 * compter comme un concurrent. Le lissage (un pari virtuel par projet) garde
 * le gain fini à zéro pari, et l'empêche de tripler à chaque clic quand la
 * track est encore peu fournie. Moins un projet est soutenu, plus il rapporte.
 */
export function popularityPoints(betsOnProject: number, trackBettors: number, projectCount: number): number {
  return (BASE_POINTS * (trackBettors + projectCount)) / (betsOnProject + 1);
}

/**
 * Points à gagner, figés au moment du pari : popularité × bonus de rapidité
 * (`betWeight`, de 1 à l'ouverture à 0,2 à la clôture). Arrondis à l'unité.
 */
export function potentialPoints(
  betsOnProject: number,
  trackBettors: number,
  projectCount: number,
  weight: number
): number {
  return Math.round(popularityPoints(betsOnProject, trackBettors, projectCount) * weight);
}

/** Ce que rapporte réellement un pari une fois le podium annoncé. */
export function wonPoints(potential: number, place: Place | null): number {
  return place === null ? 0 : Math.round(potential * PODIUM_SHARE[place]);
}

/** « 1 240 », séparateur des milliers à la française (espace insécable). */
export function formatPoints(points: number): string {
  return Math.round(points).toLocaleString("fr-FR");
}
