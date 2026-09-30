/**
 * Vérification des cotes, des classements, du podium et des courbes.
 * `npm test`. Pures fonctions, donc testables sans base : c'est la partie
 * dont une erreur passerait inaperçue en soirée (chiffres plausibles mais
 * faux).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { computeSeries } from "../src/lib/history.ts";
import { computeOdds, formatOdds, MAX_ODDS } from "../src/lib/odds.ts";
import { computeBoard } from "../src/lib/standings.ts";
import { formatCountdown, isBettingOpen } from "../src/lib/voting.ts";
import type { Bet, BetEvent, Project, Track } from "../src/lib/types.ts";

const track = (id: string, key: string, name: string, position: number): Track => ({
  id,
  key,
  name,
  subtitle: "",
  position,
  first_project_id: null,
  second_project_id: null,
  third_project_id: null,
});

const tracks: Track[] = [
  track("t1", "short-film", "Short Film", 1),
  track("t2", "animation", "Animation", 2),
  track("t3", "ad", "Ad", 3),
];

const projects: Project[] = [
  { id: "p1", track_id: "t1", name: "Alpha", team: "A", brand: null, position: 1 },
  { id: "p2", track_id: "t1", name: "Bravo", team: "B", brand: null, position: 2 },
  { id: "p3", track_id: "t1", name: "Charlie", team: "C", brand: null, position: 3 },
  { id: "p4", track_id: "t2", name: "Delta", team: "D", brand: null, position: 1 },
  { id: "p5", track_id: "t3", name: "Echo", team: "E", brand: "Jeep", position: 1 },
];

const bet = (voter: string, t: string, project: string): Bet => ({
  voter_id: voter,
  track_id: t,
  project_id: project,
});

let seq = 0;
/** Un pari par minute à partir de 14 h : `seq` sert aussi d'horloge. */
const T0 = Date.parse("2026-10-03T14:00:00.000Z");
const at = (n: number) => T0 + n * 60_000;
const event = (voter: string, t: string, project: string): BetEvent => ({
  seq: (seq += 1),
  voter_id: voter,
  track_id: t,
  project_id: project,
  created_at: new Date(at(seq)).toISOString(),
});

// ------------------------------------------------------------------ cotes

test("cote : jamais infinie, même sans aucun pari", () => {
  assert.equal(computeOdds(0, 0, 3), 3);
  assert.equal(Number.isFinite(computeOdds(0, 50, 12)), true);
});

test("cote : jamais sous 1.00, même si tout le monde parie pareil", () => {
  assert.equal(computeOdds(5, 5, 3) >= 1, true);
  assert.equal(computeOdds(100, 100, 3) >= 1, true);
});

test("cote : elle raccourcit quand le soutien monte", () => {
  assert.equal(computeOdds(1, 20, 12) > computeOdds(5, 20, 12), true);
  assert.equal(computeOdds(5, 20, 12) > computeOdds(12, 20, 12), true);
});

test("formatOdds : deux décimales sous 10, une au-dessus, plafond à 99+", () => {
  assert.equal(formatOdds(2), "2.00");
  assert.equal(formatOdds(12.5), "12.5");
  assert.equal(formatOdds(480), `${MAX_ODDS}+`);
});

// ------------------------------------------------------------- classement

test("aucun pari : tous les projets à la même cote", () => {
  const board = computeBoard(tracks, projects, [], "me");
  assert.equal(board.totalVoters, 0);
  assert.deepEqual(board.tracks[0].standings.map((s) => s.odds), [3, 3, 3]);
});

test("les cotes d'un projet se calculent sur SA track, pas sur le total", () => {
  const bets = [
    bet("v1", "t1", "p1"),
    bet("v2", "t1", "p1"),
    bet("v3", "t1", "p2"),
    bet("v4", "t2", "p4"),
  ];
  const board = computeBoard(tracks, projects, bets, null);

  assert.deepEqual(
    board.tracks[0].standings.map((s) => [s.name, s.bets, s.odds]),
    [
      ["Alpha", 2, 2],
      ["Bravo", 1, 3],
      ["Charlie", 0, 6],
    ]
  );
  assert.deepEqual(board.tracks[1].standings.map((s) => s.odds), [1]);
});

test("les trois tracks ne se classent pas entre elles", () => {
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

test("un pari par track : on peut désigner un gagnant dans chaque track", () => {
  const bets = [bet("moi", "t1", "p2"), bet("moi", "t2", "p4"), bet("autre", "t1", "p1")];
  const board = computeBoard(tracks, projects, bets, "moi");

  assert.equal(board.totalVoters, 2); // personnes distinctes, pas paris
  assert.equal(board.myBetCount, 2);
  assert.equal(board.tracks[0].myProjectId, "p2");
  assert.equal(board.tracks[1].myProjectId, "p4");
  assert.equal(board.tracks[2].myProjectId, null);
  assert.deepEqual(
    board.tracks[0].standings.filter((s) => s.isMine).map((s) => s.name),
    ["Bravo"]
  );
  assert.deepEqual(board.tracks.map((t) => t.voters), [2, 1, 0]);
});

// ----------------------------------------------------------------- podium

test("podium : 1er, 2e et 3e sont marqués dans leur propre track", () => {
  const settled = tracks.map((t) =>
    t.id === "t1"
      ? { ...t, first_project_id: "p2", second_project_id: "p3", third_project_id: "p1" }
      : t
  );
  const board = computeBoard(settled, projects, [], null);

  assert.deepEqual(
    board.tracks[0].standings.map((s) => [s.name, s.place]),
    [
      ["Alpha", 3],
      ["Bravo", 1],
      ["Charlie", 2],
    ]
  );
  assert.equal(board.tracks[1].standings.every((s) => s.place === null), true);
  assert.equal(board.tracks[2].standings.every((s) => s.place === null), true);
});

test("podium : rendu dans l'ordre des places, pas dans celui des paris", () => {
  // Bravo est 1er alors qu'Alpha a tous les paris : un outsider peut gagner,
  // et c'est précisément ce qu'on veut pouvoir montrer.
  const settled = tracks.map((t) =>
    t.id === "t1" ? { ...t, first_project_id: "p2", second_project_id: "p1" } : t
  );
  const board = computeBoard(settled, projects, [bet("v1", "t1", "p1")], null);

  assert.deepEqual(
    board.tracks[0].podium.map((s) => [s.place, s.name]),
    [
      [1, "Bravo"],
      [2, "Alpha"],
    ]
  );
});

test("podium : partiel tant que les places ne sont pas toutes annoncées", () => {
  const settled = tracks.map((t) => (t.id === "t1" ? { ...t, first_project_id: "p1" } : t));
  const board = computeBoard(settled, projects, [], null);
  assert.deepEqual(board.tracks[0].podium.map((s) => s.name), ["Alpha"]);
  assert.deepEqual(board.tracks[1].podium, []);
});

test("podium : avoir parié sur un projet du podium, les deux états coexistent", () => {
  const settled = tracks.map((t) => (t.id === "t1" ? { ...t, second_project_id: "p1" } : t));
  const board = computeBoard(settled, projects, [bet("moi", "t1", "p1")], "moi");
  const row = board.tracks[0].standings.find((s) => s.name === "Alpha")!;
  assert.equal(row.place, 2);
  assert.equal(row.isMine, true);
});

// ----------------------------------------------------------------- courbes

test("courbe : aucune courbe tant que personne n'a parié", () => {
  const t1 = computeSeries(tracks, projects, [], null).get("t1")!;
  assert.equal(t1.length, 3);
  assert.equal(t1.every((s) => s.points.length === 0), true);
  assert.deepEqual(t1.map((s) => s.currentOdds), [3, 3, 3]);
});

test("courbe : l'axe est le temps, avec une origine commune juste avant le premier pari", () => {
  seq = 0;
  const events = [event("v1", "t1", "p1"), event("v2", "t1", "p1"), event("v3", "t1", "p2")];
  const alpha = computeSeries(tracks, projects, events, null).get("t1")!.find((s) => s.name === "Alpha")!;

  assert.deepEqual(alpha.points, [
    { time: at(1) - 1, odds: 3 }, // origine
    { time: at(1), odds: 2 }, // (1+3)/(1+1)
    { time: at(2), odds: 1.67 }, // (2+3)/(2+1)
    { time: at(3), odds: 2 }, // (3+3)/(2+1)
  ]);
  assert.equal(alpha.currentOdds, 2);
});

test("courbe : parier dans une seconde track ne touche pas la première", () => {
  seq = 0;
  const events = [event("v1", "t1", "p1"), event("v1", "t2", "p4")];
  const series = computeSeries(tracks, projects, events, null);

  const alpha = series.get("t1")!.find((s) => s.name === "Alpha")!;
  const delta = series.get("t2")!.find((s) => s.name === "Delta")!;
  assert.deepEqual(alpha.points.map((p) => p.time), [at(1) - 1, at(1)]);
  assert.deepEqual(delta.points.map((p) => p.time), [at(2) - 1, at(2)]);
});

test("courbe : changer d'avis dans une track déplace le pari sans ajouter de parieur", () => {
  seq = 0;
  const events = [event("v1", "t1", "p1"), event("v1", "t1", "p2")];
  const t1 = computeSeries(tracks, projects, events, null).get("t1")!;
  assert.equal(t1.find((s) => s.name === "Alpha")!.currentOdds, 4); // (1+3)/(0+1)
  assert.equal(t1.find((s) => s.name === "Bravo")!.currentOdds, 2); // (1+3)/(1+1)
});

test("courbe : deux paris à la même milliseconde ne font qu'un point", () => {
  const same = new Date(T0).toISOString();
  const events: BetEvent[] = [
    { seq: 1, voter_id: "v1", track_id: "t1", project_id: "p1", created_at: same },
    { seq: 2, voter_id: "v2", track_id: "t1", project_id: "p1", created_at: same },
  ];
  const alpha = computeSeries(tracks, projects, events, null).get("t1")!.find((s) => s.name === "Alpha")!;
  assert.deepEqual(alpha.points, [
    { time: T0 - 1, odds: 3 },
    { time: T0, odds: 1.67 },
  ]);
});

test("courbe : triées cote la plus faible en premier", () => {
  seq = 0;
  const events = [event("v1", "t1", "p3"), event("v2", "t1", "p3"), event("v3", "t1", "p2")];
  const t1 = computeSeries(tracks, projects, events, null).get("t1")!;
  assert.deepEqual(t1.map((s) => s.name), ["Charlie", "Bravo", "Alpha"]);
});

test("courbe : le podium et mon pari remontent jusqu'aux courbes", () => {
  seq = 0;
  const settled = tracks.map((t) => (t.id === "t1" ? { ...t, first_project_id: "p2" } : t));
  const t1 = computeSeries(settled, projects, [event("moi", "t1", "p1")], "moi").get("t1")!;
  assert.equal(t1.find((s) => s.name === "Bravo")!.place, 1);
  assert.equal(t1.find((s) => s.name === "Alpha")!.isMine, true);
  assert.equal(t1.find((s) => s.name === "Charlie")!.isMine, false);
});

test("courbe : un projet supprimé n'apparaît pas, même s'il reste au journal", () => {
  seq = 0;
  const events = [event("v1", "t1", "disparu"), event("v2", "t1", "p1")];
  const t1 = computeSeries(tracks, projects, events, null).get("t1")!;
  assert.deepEqual(t1.map((s) => s.name).sort(), ["Alpha", "Bravo", "Charlie"]);
});

test("à 70 parieurs, les cotes restent dans une plage lisible", () => {
  const many: Project[] = Array.from({ length: 12 }, (_, i) => ({
    id: `x${i}`,
    track_id: "t1",
    name: `Project ${i}`,
    team: "",
    brand: null,
    position: i,
  }));
  const bets: Bet[] = Array.from({ length: 35 }, (_, i) => bet(`v${i}`, "t1", `x${i % 6}`));
  const odds = computeBoard(tracks, many, bets, null).tracks[0].standings.map((s) => s.odds);

  assert.equal(Math.min(...odds) >= 1, true);
  assert.equal(Math.max(...odds) < MAX_ODDS, true);
});

// ---------------------------------------------------------------- horloge

test("horloge : ouvert tant que l'heure de clôture n'est pas passée", () => {
  const deadline = "2026-10-04T12:00:00.000Z";
  const t = Date.parse(deadline);
  assert.equal(isBettingOpen(true, deadline, t - 1000), true);
  assert.equal(isBettingOpen(true, deadline, t), false);
  assert.equal(isBettingOpen(true, deadline, t + 1000), false);
});

test("horloge : fermé par l'admin, l'heure ne rouvre rien ; sans heure, ouvert", () => {
  assert.equal(isBettingOpen(false, "2999-01-01T00:00:00.000Z", Date.now()), false);
  assert.equal(isBettingOpen(true, null, Date.now()), true);
});

test("horloge : compte à rebours lisible", () => {
  assert.equal(formatCountdown(65_000), "01:05");
  assert.equal(formatCountdown(3_723_000), "01:02:03");
  assert.equal(formatCountdown(90_061_000), "1 j 01:01:01");
  assert.equal(formatCountdown(-5), "00:00");
});
