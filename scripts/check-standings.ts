/**
 * Vérification du calcul des cotes et des classements — `npm test`.
 * Pure fonction, donc testable sans base : c'est la partie dont une erreur
 * passerait inaperçue en soirée (cotes plausibles mais fausses).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { computeOdds, formatOdds, MAX_ODDS } from "../src/lib/odds.ts";
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

// ------------------------------------------------------------------ cotes

test("cote : jamais infinie, même sans aucun pari", () => {
  // Une cote brute vaudrait total/0. Le lissage donne (0+3)/(0+1) = 3.
  assert.equal(computeOdds(0, 0, 3), 3);
  assert.equal(Number.isFinite(computeOdds(0, 50, 12)), true);
});

test("cote : jamais sous 1.00, même si tout le monde parie pareil", () => {
  // Une cote sous 1 ferait perdre de l'argent à un pari gagnant.
  assert.equal(computeOdds(5, 5, 3) >= 1, true);
  assert.equal(computeOdds(100, 100, 3) >= 1, true);
  assert.equal(computeOdds(1, 1, 1) >= 1, true);
});

test("cote : elle raccourcit quand le soutien monte", () => {
  const outsider = computeOdds(1, 20, 12);
  const milieu = computeOdds(5, 20, 12);
  const favori = computeOdds(12, 20, 12);
  assert.equal(outsider > milieu, true);
  assert.equal(milieu > favori, true);
});

test("formatOdds : deux décimales sous 10, une au-dessus, plafond à 99+", () => {
  assert.equal(formatOdds(2), "2.00");
  assert.equal(formatOdds(4.2), "4.20");
  assert.equal(formatOdds(12.5), "12.5");
  assert.equal(formatOdds(MAX_ODDS), `${MAX_ODDS}+`);
  assert.equal(formatOdds(480), `${MAX_ODDS}+`);
});

// ------------------------------------------------------------- classement

test("aucun pari : tous les projets à la même cote, ce qui est tout ce qu'on sait", () => {
  const board = computeBoard(tracks, projects, [], "me");
  assert.equal(board.totalVoters, 0);
  assert.equal(board.myTrackId, null);
  assert.deepEqual(board.tracks[0].standings.map((s) => s.odds), [3, 3, 3]);
  assert.deepEqual(board.tracks[0].standings.map((s) => s.support), [0, 0, 0]);
});

test("les cotes d'un projet se calculent sur SA track, pas sur le total", () => {
  // 3 parieurs sur t1, 1 seul sur t2. Delta est seul dans sa track : sa cote
  // ne doit pas être diluée par les parieurs des autres tracks.
  const bets = [
    bet("v1", "t1", "p1"),
    bet("v2", "t1", "p1"),
    bet("v3", "t1", "p2"),
    bet("v4", "t2", "p4"),
  ];
  const board = computeBoard(tracks, projects, bets, null);

  assert.equal(board.totalVoters, 4);
  assert.deepEqual(
    board.tracks[0].standings.map((s) => [s.name, s.bets, s.odds]),
    [
      ["Alpha", 2, 2],
      ["Bravo", 1, 3],
      ["Charlie", 0, 6],
    ]
  );
  // t2 : (1 + 1) / (1 + 1) = 1.00
  assert.deepEqual(board.tracks[1].standings.map((s) => [s.name, s.odds]), [["Delta", 1]]);
});

test("les trois tracks ne se classent pas entre elles", () => {
  // Régression : aucune part d'une track dans le total ne doit réapparaître,
  // sinon l'écran laisserait croire à un vainqueur au-dessus des trois.
  const board = computeBoard(tracks, projects, [bet("v1", "t1", "p1")], null);
  assert.equal("share" in board.tracks[0], false);
  assert.deepEqual(
    board.tracks.map((t) => [t.track.name, t.voters]),
    [
      ["Short Film", 1],
      ["Animation", 0],
      ["Ad", 0],
    ]
  );
});

test("rangs partagés : trois ex æquo, tous premiers", () => {
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
  const board = computeBoard(tracks, projects, [bet("moi", "t2", "p4")], "moi");
  assert.equal(board.myTrackId, "t2");
  assert.equal(board.myProjectId, "p4");
  assert.equal(board.tracks[1].standings[0].isMine, true);
  assert.equal(board.tracks[0].standings.every((s) => !s.isMine), true);
});

test("tri stable à égalité : ordre alphabétique, pas de tremblement", () => {
  const shuffled = [projects[2], projects[0], projects[1]];
  const board = computeBoard(tracks, shuffled, [], null);
  assert.deepEqual(board.tracks[0].standings.map((s) => s.name), ["Alpha", "Bravo", "Charlie"]);
});

test("un gagnant par track, marqué dans la sienne seulement", () => {
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
  assert.equal(board.tracks[2].standings.every((s) => !s.isWinner), true);
});

test("avoir parié sur le gagnant : les deux états coexistent", () => {
  const settled = tracks.map((t) => (t.id === "t1" ? { ...t, winner_project_id: "p1" } : t));
  const board = computeBoard(settled, projects, [bet("moi", "t1", "p1")], "moi");
  const row = board.tracks[0].standings[0];
  assert.equal(row.isWinner, true);
  assert.equal(row.isMine, true);
});

test("projet supprimé en cours de vote : aucune ligne fantôme", () => {
  const board = computeBoard(
    tracks,
    [projects[0]],
    [bet("v1", "t1", "p1"), bet("v2", "t1", "disparu")],
    null
  );
  assert.equal(board.tracks[0].standings.length, 1);
  assert.equal(board.tracks[0].voters, 2);
  assert.equal(board.tracks[0].standings[0].support, 0.5);
});

test("la marque remonte jusqu'au classement, pour la track Ad", () => {
  const board = computeBoard(tracks, projects, [bet("v1", "t3", "p5")], null);
  assert.equal(board.tracks[2].standings[0].brand, "Jeep");
  assert.equal(board.tracks[0].standings[0].brand, null);
});

test("à 70 parieurs, les cotes restent dans une plage lisible", () => {
  // Le cas réel : ~70 personnes, 12 projets par track. Aucune cote ne doit
  // sortir en « 99+ » ni tomber sous 1.
  const many: Project[] = Array.from({ length: 12 }, (_, i) => ({
    id: `x${i}`,
    track_id: "t1",
    name: `Project ${i}`,
    team: "",
    brand: null,
    position: i,
  }));
  const bets: Bet[] = Array.from({ length: 35 }, (_, i) =>
    bet(`v${i}`, "t1", `x${i % 6}`)
  );

  const board = computeBoard(tracks, many, bets, null);
  const odds = board.tracks[0].standings.map((s) => s.odds);

  assert.equal(Math.min(...odds) >= 1, true);
  assert.equal(Math.max(...odds) < MAX_ODDS, true);
});
