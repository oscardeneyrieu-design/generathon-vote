import { computeOdds } from "./odds.ts";
import { placeOf } from "./standings.ts";
import type { BetEvent, Project, ProjectSeries, SeriesPoint, Track } from "./types.ts";

/**
 * Reconstitue l'évolution des cotes de chaque track dans le temps, à partir
 * du journal des paris.
 *
 * On rejoue les évènements dans l'ordre. Chaque personne a au plus un pari
 * par track : un changement d'avis déplace son pari d'un projet à l'autre
 * sans ajouter de parieur. Chaque pari produit un point par projet de la
 * track, daté de l'heure du pari ; entre deux points la cote ne bouge pas.
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
  const bettors = new Map<string, number>();
  /** Pari courant de chaque personne dans chaque track, clé `voter|track`. */
  const choice = new Map<string, string>();

  /** Fige l'état d'une track à un instant : un point par projet. */
  const snapshot = (trackId: string, time: number) => {
    const inTrack = projectsByTrack.get(trackId);
    if (!inTrack) return;

    const total = bettors.get(trackId) ?? 0;
    for (const project of inTrack) {
      const list = points.get(project.id)!;
      const odds = computeOdds(counts.get(project.id) ?? 0, total, inTrack.length);
      // Deux paris à la même milliseconde : on garde le dernier état.
      if (list.length > 0 && list[list.length - 1].time === time) list[list.length - 1].odds = odds;
      else list.push({ time, odds });
    }
  };

  const ordered = [...events].sort((a, b) => a.seq - b.seq);

  for (const event of ordered) {
    const time = Date.parse(event.created_at);
    if (Number.isNaN(time)) continue;

    // Origine : juste avant le premier pari de la track, tous ses projets
    // partagent la même cote. Ça donne aux courbes un départ commun.
    if (!bettors.has(event.track_id)) {
      bettors.set(event.track_id, 0);
      snapshot(event.track_id, time - 1);
    }

    const key = `${event.voter_id}|${event.track_id}`;
    const previous = choice.get(key);

    if (previous) {
      counts.set(previous, Math.max(0, (counts.get(previous) ?? 0) - 1));
    } else {
      bettors.set(event.track_id, (bettors.get(event.track_id) ?? 0) + 1);
    }

    counts.set(event.project_id, (counts.get(event.project_id) ?? 0) + 1);
    choice.set(key, event.project_id);
    snapshot(event.track_id, time);
  }

  const result = new Map<string, ProjectSeries[]>();

  for (const track of tracks) {
    const inTrack = projectsByTrack.get(track.id) ?? [];
    const total = bettors.get(track.id) ?? 0;

    const series = inTrack.map((project) => {
      const list = points.get(project.id) ?? [];
      return {
        projectId: project.id,
        name: project.name,
        points: list,
        currentOdds:
          list.length > 0 ? list[list.length - 1].odds : computeOdds(0, total, inTrack.length),
        place: placeOf(track, project.id),
        isMine: myVoterId !== null && choice.get(`${myVoterId}|${track.id}`) === project.id,
      } satisfies ProjectSeries;
    });

    // Cotes les plus faibles en premier : ce sont les favoris de la salle.
    series.sort((a, b) => a.currentOdds - b.currentOdds || a.name.localeCompare(b.name, "en"));
    result.set(track.id, series);
  }

  return result;
}
