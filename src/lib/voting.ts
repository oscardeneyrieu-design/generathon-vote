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
