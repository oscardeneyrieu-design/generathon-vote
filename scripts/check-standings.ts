/**
 * Vérification du calcul des classements — `npm test`.
 * Pure fonction, donc testable sans base : c'est la partie dont une erreur
 * passerait inaperçue en démo (pourcentages plausibles mais faux).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { computeBoard } from "../src/lib/standings.ts";
import type { Bet, Project, Track } from "../src/lib/types.ts";

const tracks: Track[] = [
  { id: "t1", key: "short-film", name: "Short Film", subtitle: "", position: 1, winner_project_id: null },
  { id: "t2", key: "animation", name: "Animation", subtitle: "", position: 2, winner_project_id: null },
  { id: "t3", key: "ad", name: "Ad", subtitle: "", position: 3, winner_project_id: null },
];

const projects: Project[] = [
  { id: "p1", track_id: "t1", name: "Alpha", team: "A", brand: null, position: 1 },
  { id: "p2", track_id: "t1", name: "Bravo", team: "B", brand: null, position: 2 },
  { id: "p3", track_id: "t1", name: "Charlie", team: "C", brand: null, position: 3 },
  { id: "p4", track_id: "t2", name: "Delta", team: "D", brand: null, position: 1 },
  { id: "p5", track_id: "t3", name: "Echo", team: "E", brand: "Jeep", position: 1 },
];

const bet = (voter: string, track: string, project: string): Bet => ({
  voter_id: voter,
  track_id: track,
  project_id: project,
});

test("aucun pari : tout à zéro, aucune division par zéro", () => {
  const board = computeBoard(tracks, projects, [], "me");
  assert.equal(board.totalVoters, 0);
  assert.equal(board.myTrackId, null);
  assert.deepEqual(
    board.tracks.map((t) => [t.track.name, t.voters, t.share]),
    [
      ["Short Film", 0, 0],
      ["Animation", 0, 0],
      ["Ad", 0, 0],
    ]
  );
  assert.deepEqual(board.tracks[0].standings.map((s) => s.share), [0, 0, 0]);
});

test("les pourcentages d'un projet portent sur SA track, pas sur le total", () => {
  // 3 parieurs sur t1, 1 seul sur t2. Delta est seul dans sa track : il doit
  // afficher 100 %, pas 25 %, sinon son avance paraîtrait illégitime.
  const bets = [
    bet("v1", "t1", "p1"),
    bet("v2", "t1", "p1"),
    bet("v3", "t1", "p2"),
    bet("v4", "t2", "p4"),
  ];
  const board = computeBoard(tracks, projects, bets, null);

  assert.equal(board.totalVoters, 4);
  assert.deepEqual(
    board.tracks[0].standings.map((s) => [s.name, s.bets, s.share]),
    [
      ["Alpha", 2, 66.7],
      ["Bravo", 1, 33.3],
      ["Charlie", 0, 0],
    ]
  );
  assert.deepEqual(board.tracks[1].standings.map((s) => [s.name, s.share]), [["Delta", 100]]);
});

test("la part d'une track porte, elle, sur l'ensemble des parieurs", () => {
  const bets = [bet("v1", "t1", "p1"), bet("v2", "t1", "p2"), bet("v3", "t2", "p4")];
  const board = computeBoard(tracks, projects, bets, null);
  assert.deepEqual(
    board.tracks.map((t) => [t.track.name, t.voters, t.share]),
    [
      ["Short Film", 2, 66.7],
      ["Animation", 1, 33.3],
      ["Ad", 0, 0],
    ]
  );
});

test("rangs partagés : deux ex æquo puis un 3e, pas de 2e", () => {
  const bets = [bet("v1", "t1", "p1"), bet("v2", "t1", "p2"), bet("v3", "t1", "p3")];
  const board = computeBoard(tracks, projects, bets, null);
  assert.deepEqual(
    board.tracks[0].standings.map((s) => [s.name, s.rank]),
    [
      ["Alpha", 1],
      ["Bravo", 1],
      ["Charlie", 1],
    ]
  );
});

test("un appareil = un pari : changer d'avis remplace, track comprise", () => {
  // La base garantit l'unicité par voter_id ; on vérifie ici que le repérage
  // de « mon » pari suit bien la dernière ligne connue.
  const board = computeBoard(tracks, projects, [bet("moi", "t2", "p4")], "moi");
  assert.equal(board.myTrackId, "t2");
  assert.equal(board.myProjectId, "p4");
  assert.equal(board.tracks[1].standings[0].isMine, true);
  assert.equal(board.tracks[0].standings.every((s) => !s.isMine), true);
});

test("tri stable à égalité : ordre alphabétique, pas de tremblement", () => {
  const shuffled = [projects[2], projects[0], projects[1]];
  const board = computeBoard(tracks, shuffled, [], null);
  assert.deepEqual(
    board.tracks[0].standings.map((s) => s.name),
    ["Alpha", "Bravo", "Charlie"]
  );
});

test("le gagnant n'est marqué que dans sa propre track", () => {
  const settled = tracks.map((t) => (t.id === "t1" ? { ...t, winner_project_id: "p2" } : t));
  const board = computeBoard(settled, projects, [bet("v1", "t1", "p1")], "v1");
  assert.deepEqual(
    board.tracks[0].standings.map((s) => [s.name, s.isWinner, s.isMine]),
    [
      ["Alpha", false, true],
      ["Bravo", true, false],
      ["Charlie", false, false],
    ]
  );
  assert.equal(board.tracks[1].standings.every((s) => !s.isWinner), true);
});

test("projet supprimé en cours de vote : aucune ligne fantôme", () => {
  // Le pari pointe un projet absent de la liste (course entre suppression
  // admin et rafraîchissement).
  const board = computeBoard(
    tracks,
    [projects[0]],
    [bet("v1", "t1", "p1"), bet("v2", "t1", "disparu")],
    null
  );
  assert.equal(board.tracks[0].standings.length, 1);
  assert.equal(board.tracks[0].voters, 2);
  assert.equal(board.tracks[0].standings[0].share, 50);
});

test("la marque remonte jusqu'au classement, pour la track Ad", () => {
  const board = computeBoard(tracks, projects, [bet("v1", "t3", "p5")], null);
  assert.equal(board.tracks[2].standings[0].brand, "Jeep");
  assert.equal(board.tracks[0].standings[0].brand, null);
});
