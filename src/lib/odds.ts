/** Au-delà, la cote cesse d'informer : on affiche « 99+ ». */
export const MAX_ODDS = 99;

/** En dessous, une track a trop peu de parieurs pour que ses cotes veuillent dire quoi que ce soit. */
export const THIN_MARKET = 8;

/**
 * Cote décimale pari-mutuel, lissée.
 *
 * La cote brute d'un pool, c'est `total ÷ paris sur ce projet`. À l'échelle
 * d'une soirée — une soixantaine de parieurs répartis sur trois tracks — ça
 * casse de deux façons : un projet sans pari donne une cote infinie, et une
 * track à trois parieurs voit ses cotes tripler à chaque clic.
 *
 * On ajoute donc un pari virtuel sur chaque projet (lissage de Laplace) :
 *
 *     cote = (total + nbProjets) / (paris + 1)
 *
 * Conséquences voulues :
 * - toujours finie, même à zéro pari ;
 * - toujours ≥ 1.00, puisque `total + n ≥ paris + 1` par construction ;
 * - au démarrage, tous les projets sortent à la même cote — ce qui est
 *   exactement ce qu'on sait d'eux ;
 * - elle bouge d'autant moins brusquement que la track est peu fournie.
 *
 * Ce n'est pas une cote de bookmaker : il n'y a ni marge ni argent. C'est
 * la redistribution équitable d'un pool où chacun mise une unité.
 */
export function computeOdds(betsOnProject: number, trackTotal: number, projectCount: number): number {
  const odds = (trackTotal + projectCount) / (betsOnProject + 1);
  return Math.round(odds * 100) / 100;
}

/** « 4.20 », « 12.5 », « 99+ ». Deux décimales sous 10, une au-dessus : la précision ne sert plus au-delà. */
export function formatOdds(odds: number): string {
  if (odds >= MAX_ODDS) return `${MAX_ODDS}+`;
  if (odds >= 10) return odds.toFixed(1);
  return odds.toFixed(2);
}
