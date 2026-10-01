import { placeOf } from "./standings.ts";
import type { BetEvent, Project, ProjectSeries, SeriesPoint, Track } from "./types.ts";

/**
 * Reconstitue l'évolution du nombre de paris de chaque projet dans le temps,
 * à partir du journal des paris.
 *
 * On rejoue les évènements dans l'ordre. Chaque personne a au plus un pari
 * par track : un changement d'avis déplace son pari d'un projet à l'autre
 * sans ajouter de parieur. Chaque pari produit un point pour chaque projet
 * dont le compte change, daté de l'heure du pari ; entre deux points le
 * compte ne bouge pas.
 */
export function computeSeries(
  tracks: Track[],
  projects: Project[],
  events: BetEvent[],
  myVoterId: string | null
): Map<string, ProjectSeries[]> {
  const projectsByTrack = new Map<string, Project[]>();
  for (const project of projects) {
    const list = projectsByTrack.get(project.track_id) ?? [];
    list.push(project);
    projectsByTrack.set(project.track_id, list);
  }

  const points = new Map<string, SeriesPoint[]>();
  for (const project of projects) points.set(project.id, []);

  const counts = new Map<string, number>();
  const started = new Set<string>();
  /** Pari courant de chaque personne dans chaque track, clé `voter|track`. */
  const choice = new Map<string, string>();

  const record = (projectId: string, time: number) => {
    const list = points.get(projectId);
    if (!list) return; // projet supprimé depuis : il reste au journal, pas à l'écran
    const bets = counts.get(projectId) ?? 0;
    // Deux paris à la même milliseconde : on garde le dernier état.
    if (list.length > 0 && list[list.length - 1].time === time) list[list.length - 1].bets = bets;
    else list.push({ time, bets });
  };

  const ordered = [...events].sort((a, b) => a.seq - b.seq);

  for (const event of ordered) {
    const time = Date.parse(event.created_at);
    if (Number.isNaN(time)) continue;

    // Origine : juste avant le premier pari de la track, tous ses projets
    // partent de zéro. Ça donne aux courbes un départ commun.
    if (!started.has(event.track_id)) {
      started.add(event.track_id);
      for (const project of projectsByTrack.get(event.track_id) ?? []) record(project.id, time - 1);
    }

    const key = `${event.voter_id}|${event.track_id}`;
    const previous = choice.get(key);
    if (previous === event.project_id) continue;

    if (previous) {
      counts.set(previous, Math.max(0, (counts.get(previous) ?? 0) - 1));
      record(previous, time);
    }
    counts.set(event.project_id, (counts.get(event.project_id) ?? 0) + 1);
    choice.set(key, event.project_id);
    record(event.project_id, time);
  }

  const result = new Map<string, ProjectSeries[]>();

  for (const track of tracks) {
    const inTrack = projectsByTrack.get(track.id) ?? [];

    const series = inTrack.map((project) => ({
      projectId: project.id,
      name: project.name,
      points: points.get(project.id) ?? [],
      currentBets: counts.get(project.id) ?? 0,
      place: placeOf(track, project.id),
      isMine: myVoterId !== null && choice.get(`${myVoterId}|${track.id}`) === project.id,
    }) satisfies ProjectSeries);

    // Les plus soutenus en premier : ce sont les favoris de la salle.
    series.sort((a, b) => b.currentBets - a.currentBets || a.name.localeCompare(b.name, "en"));
    result.set(track.id, series);
  }

  return result;
}
