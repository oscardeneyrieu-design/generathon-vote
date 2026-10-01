/**
 * Les paris sont ouverts si l'admin les a ouverts ET que l'heure de clôture,
 * s'il y en a une, n'est pas encore passée. Partagé entre le serveur (qui
 * refuse les paris en retard) et les écrans (qui affichent le compte à
 * rebours et se ferment d'eux-mêmes à l'heure dite).
 */
export function isBettingOpen(votingOpen: boolean, closesAt: string | null, now: number): boolean {
  if (!votingOpen) return false;
  if (!closesAt) return true;
  const deadline = Date.parse(closesAt);
  return Number.isNaN(deadline) || now < deadline;
}

/**
 * Bonus de rapidité d'un pari posé à la dernière seconde, rapporté à un pari
 * posé à l'ouverture. Jamais zéro : un retardataire gagne quand même un peu.
 */
export const MIN_WEIGHT = 0.2;

/** La période de vote : de l'ouverture des paris à leur clôture programmée. */
export type VotingPeriod = { opensAt: string | null; closesAt: string | null };

/**
 * Bonus de rapidité d'un pari selon l'heure où il est posé : 1 à
 * l'ouverture, puis une baisse linéaire jusqu'à `MIN_WEIGHT` à la clôture.
 * Il multiplie les points à gagner. Le but est de faire parier tôt, et donc
 * d'aller voir les équipes tôt.
 *
 * Changer d'avis, c'est reparier : c'est l'heure du DERNIER pari qui compte,
 * sinon on parierait n'importe quoi à l'ouverture pour corriger à la fin.
 *
 * Sans heure de clôture, il n'y a pas de période à découper : tout pari vaut 1.
 * Un pari posé avant l'ouverture (paris ouverts sans heure de fin, puis
 * compte à rebours lancé) vaut 1 lui aussi.
 */
export function betWeight(placedAt: number, period: VotingPeriod): number {
  const bounds = weightedSpan(period);
  if (!bounds || Number.isNaN(placedAt)) return 1;

  const [start, end] = bounds;
  const progress = Math.min(1, Math.max(0, (placedAt - start) / (end - start)));
  // Arrondi au dix-millième (une dizaine de secondes sur un week-end de vote),
  // pour des valeurs qui tombent juste : 0.2, pas 0.19999999999999996.
  return Math.round((1 - (1 - MIN_WEIGHT) * progress) * 10_000) / 10_000;
}

/** Vrai quand un bonus de rapidité s'applique (heure de fin programmée). */
export function isWeighted(period: VotingPeriod): boolean {
  return weightedSpan(period) !== null;
}

function weightedSpan(period: VotingPeriod): [number, number] | null {
  if (!period.opensAt || !period.closesAt) return null;
  const start = Date.parse(period.opensAt);
  const end = Date.parse(period.closesAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return [start, end];
}

/** « 73 % ». Arrondi à l'entier : au-delà, la précision n'aide personne. */
export function formatWeight(weight: number): string {
  return `${Math.round(weight * 100)} %`;
}

/** « 2 j 03:12:45 », « 03:12:45 », « 12:45 ». */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  const clock = hours > 0 || days > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days} j ${clock}` : clock;
}

/** « dimanche 14:00 », dans le fuseau de l'appareil. */
export function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}
