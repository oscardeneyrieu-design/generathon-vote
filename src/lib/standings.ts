// Extension explicite : les tests tournent sous le type-stripping de Node,
// qui n'a pas la résolution du bundler.
import { popularityPoints, wonPoints } from "./points.ts";
import type { Bet, Board, Place, Project, Standing, Track, TrackBoard } from "./types.ts";

/** La place d'un projet sur le podium de sa track, si elle est annoncée. */
export function placeOf(track: Track, projectId: string): Place | null {
  if (track.first_project_id === projectId) return 1;
  if (track.second_project_id === projectId) return 2;
  if (track.third_project_id === projectId) return 3;
  return null;
}

/**
 * Dénormalise paris + projets en trois classements indépendants.
 *
 * Chaque personne peut parier dans chacune des tracks (un pari par track).
 * Les trois tracks ne se comparent pas : chacune a son podium et aucune
 * n'est « devant » une autre.
 *
 * Le rang suit le nombre de parieurs. Pour chaque projet, on calcule aussi
 * ce que rapporterait un pari posé maintenant (`gainBase`), et pour moi ce
 * que mes paris peuvent rapporter ou ont rapporté.
 */
export function computeBoard(
  tracks: Track[],
  projects: Project[],
  bets: Bet[],
  myVoterId: string | null
): Board {
  const perProject = new Map<string, number>();
  const perTrack = new Map<string, number>();
  const mine = new Map<string, Bet>();
  const voters = new Set<string>();

  for (const bet of bets) {
    perProject.set(bet.project_id, (perProject.get(bet.project_id) ?? 0) + 1);
    perTrack.set(bet.track_id, (perTrack.get(bet.track_id) ?? 0) + 1);
    voters.add(bet.voter_id);
    if (myVoterId && bet.voter_id === myVoterId) mine.set(bet.track_id, bet);
  }

  const boards: TrackBoard[] = [...tracks]
    .sort((a, b) => a.position - b.position)
    .map((track) => {
      const trackVoters = perTrack.get(track.id) ?? 0;
      const inTrack = projects.filter((project) => project.track_id === track.id);
      const myBet = mine.get(track.id) ?? null;
      const myProjectId = myBet?.project_id ?? null;
      // Les gains se calculent sans mon propre pari : le reposer ailleurs ne
      // doit pas me compter comme un concurrent.
      const othersInTrack = trackVoters - (myBet ? 1 : 0);

      const sorted = [...inTrack].sort((a, b) => {
        const diff = (perProject.get(b.id) ?? 0) - (perProject.get(a.id) ?? 0);
        if (diff !== 0) return diff;
        // Sans ce second critère, les projets à zéro pari se réordonneraient
        // à chaque recalcul et le classement tremblerait.
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
        const others = count - (myProjectId === project.id ? 1 : 0);

        return {
          projectId: project.id,
          name: project.name,
          team: project.team,
          brand: project.brand,
          bets: count,
          gainBase: popularityPoints(others, othersInTrack, inTrack.length),
          support: trackVoters === 0 ? 0 : count / trackVoters,
          rank,
          place: placeOf(track, project.id),
          isMine: myProjectId === project.id,
        } satisfies Standing;
      });

      // Le podium suit l'ordre annoncé, pas l'ordre des paris : un outsider
      // peut gagner, et c'est précisément ce qu'on veut pouvoir montrer.
      const podium = ([1, 2, 3] as Place[])
        .map((place) => standings.find((standing) => standing.place === place))
        .filter((standing): standing is Standing => standing !== undefined);

      const decided = track.first_project_id !== null;

      return {
        track,
        standings,
        voters: trackVoters,
        podium,
        myProjectId,
        myPoints: myBet?.points ?? null,
        decided,
        myWon: decided && myBet ? wonPoints(myBet.points, placeOf(track, myBet.project_id)) : null,
      } satisfies TrackBoard;
    });

  let myPointsAtStake = 0;
  let myPointsWon = 0;
  for (const entry of boards) {
    if (entry.decided) myPointsWon += entry.myWon ?? 0;
    else myPointsAtStake += entry.myPoints ?? 0;
  }

  return {
    tracks: boards,
    totalVoters: voters.size,
    myBetCount: mine.size,
    myPointsAtStake,
    myPointsWon,
    decidedTracks: boards.filter((entry) => entry.decided).length,
  };
}
