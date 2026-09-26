// Extension explicite : les tests tournent sous le type-stripping de Node,
// qui n'a pas la résolution du bundler.
import { computeOdds } from "./odds.ts";
import type { Bet, Board, Project, Standing, Track, TrackBoard } from "./types";

/**
 * Dénormalise paris + projets en trois classements indépendants.
 *
 * Les trois tracks ne se comparent pas : chacune a son gagnant, aucune
 * n'est « devant » une autre. Rien ici ne produit donc de part d'une track
 * dans le total, ni de classement global.
 */
export function computeBoard(
  tracks: Track[],
  projects: Project[],
  bets: Bet[],
  myVoterId: string | null
): Board {
  const perProject = new Map<string, number>();
  const perTrack = new Map<string, number>();
  let myTrackId: string | null = null;
  let myProjectId: string | null = null;

  for (const bet of bets) {
    perProject.set(bet.project_id, (perProject.get(bet.project_id) ?? 0) + 1);
    perTrack.set(bet.track_id, (perTrack.get(bet.track_id) ?? 0) + 1);

    if (myVoterId && bet.voter_id === myVoterId) {
      myTrackId = bet.track_id;
      myProjectId = bet.project_id;
    }
  }

  const boards: TrackBoard[] = [...tracks]
    .sort((a, b) => a.position - b.position)
    .map((track) => {
      const voters = perTrack.get(track.id) ?? 0;
      const inTrack = projects.filter((project) => project.track_id === track.id);

      const sorted = [...inTrack].sort((a, b) => {
        const diff = (perProject.get(b.id) ?? 0) - (perProject.get(a.id) ?? 0);
        if (diff !== 0) return diff;
        // Sans ce second critère, les projets à zéro pari se réordonneraient
        // à chaque recalcul et le classement tremblerait avant le premier pari.
        return a.name.localeCompare(b.name, "en");
      });

      let previousBets = -1;
      let previousRank = 0;

      const standings = sorted.map((project, index) => {
        const count = perProject.get(project.id) ?? 0;
        // Rang partagé : trois projets à 5 paris sont tous 1ers, le suivant 4e.
        const rank = count === previousBets ? previousRank : index + 1;
        previousBets = count;
        previousRank = rank;

        return {
          projectId: project.id,
          name: project.name,
          team: project.team,
          brand: project.brand,
          bets: count,
          odds: computeOdds(count, voters, inTrack.length),
          support: voters === 0 ? 0 : count / voters,
          rank,
          isWinner: track.winner_project_id === project.id,
          isMine: myProjectId === project.id,
        } satisfies Standing;
      });

      return { track, standings, voters } satisfies TrackBoard;
    });

  return {
    tracks: boards,
    totalVoters: bets.length,
    myTrackId,
    myProjectId,
  };
}
