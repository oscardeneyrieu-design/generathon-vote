import { computeOdds } from "./odds.ts";
import { placeOf } from "./standings.ts";
import type { BetEvent, Project, ProjectSeries, SeriesPoint, Track } from "./types.ts";

/**
 * Reconstitue l'évolution des cotes de chaque track à partir du journal.
 *
 * On rejoue les évènements dans l'ordre. Chaque personne a au plus un pari
 * par track : un changement d'avis dans une track déplace son pari d'un
 * projet à l'autre sans ajouter de parieur.
 *
 * L'axe des abscisses est le nombre de parieurs distincts sur la track, pas
 * le temps : une nuit de hackathon créerait des heures de plat, et ce qui
 * intéresse le public c'est « comment ça bouge à mesure que les gens
 * parient », pas l'horloge.
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

  // Points par projet, indexés pour un remplissage en O(1).
  const points = new Map<string, SeriesPoint[]>();
  for (const project of projects) points.set(project.id, []);

  const counts = new Map<string, number>();
  const bettors = new Map<string, number>();
  /** Pari courant de chaque personne dans chaque track, clé `voter|track`. */
  const choice = new Map<string, string>();

  /** Fige l'état d'une track : un point par projet, à l'abscisse courante. */
  const snapshot = (trackId: string) => {
    const inTrack = projectsByTrack.get(trackId);
    if (!inTrack) return;

    const total = bettors.get(trackId) ?? 0;
    for (const project of inTrack) {
      points.get(project.id)?.push({
        bettors: total,
        odds: computeOdds(counts.get(project.id) ?? 0, total, inTrack.length),
      });
    }
  };

  // Origine : avant tout pari, tous les projets d'une track partagent la
  // même cote. C'est exactement ce qu'on sait d'eux, et ça donne aux
  // courbes un point de départ commun.
  for (const track of tracks) snapshot(track.id);

  const ordered = [...events].sort((a, b) => a.seq - b.seq);

  for (const event of ordered) {
    const key = `${event.voter_id}|${event.track_id}`;
    const previous = choice.get(key);

    if (previous) {
      counts.set(previous, Math.max(0, (counts.get(previous) ?? 0) - 1));
    } else {
      bettors.set(event.track_id, (bettors.get(event.track_id) ?? 0) + 1);
    }

    counts.set(event.project_id, (counts.get(event.project_id) ?? 0) + 1);
    choice.set(key, event.project_id);
    snapshot(event.track_id);
  }

  const result = new Map<string, ProjectSeries[]>();

  for (const track of tracks) {
    const inTrack = projectsByTrack.get(track.id) ?? [];

    const series = inTrack.map((project) => {
      const series = points.get(project.id) ?? [];
      return {
        projectId: project.id,
        name: project.name,
        points: series,
        currentOdds: series.length > 0 ? series[series.length - 1].odds : 0,
        place: placeOf(track, project.id),
        isMine: myVoterId !== null && choice.get(`${myVoterId}|${track.id}`) === project.id,
      } satisfies ProjectSeries;
    });

    // Cotes les plus faibles en premier : ce sont les favoris de la salle,
    // et c'est l'ordre dans lequel le public veut les lire.
    series.sort((a, b) => a.currentOdds - b.currentOdds || a.name.localeCompare(b.name, "en"));
    result.set(track.id, series);
  }

  return result;
}
