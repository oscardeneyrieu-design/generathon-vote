/**
 * Vérification des points, des classements, du podium et des courbes.
 * `npm test`. Pures fonctions, donc testables sans base : c'est la partie
 * dont une erreur passerait inaperçue en soirée (chiffres plausibles mais
 * faux).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { computeSeries } from "../src/lib/history.ts";
import { formatPoints, popularityPoints, potentialPoints, wonPoints } from "../src/lib/points.ts";
import { computeBoard } from "../src/lib/standings.ts";
import { betWeight, formatCountdown, formatWeight, isBettingOpen, MIN_WEIGHT } from "../src/lib/voting.ts";
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

const bet = (voter: string, t: string, project: string, points = 100): Bet => ({
  voter_id: voter,
  track_id: t,
  project_id: project,
  updated_at: "2026-10-03T14:00:00.000Z",
  points,
});

/** Les tracks, avec le podium de t1 annoncé. */
const settle = (first: string | null, second: string | null = null, third: string | null = null) =>
  tracks.map((t) =>
    t.id === "t1" ? { ...t, first_project_id: first, second_project_id: second, third_project_id: third } : t
  );

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

// ----------------------------------------------------------------- points

test("points : track vide, tous les projets rapportent pareil, jamais l'infini", () => {
  assert.equal(popularityPoints(0, 0, 12), 1200);
  assert.equal(Number.isFinite(popularityPoints(0, 70, 12)), true);
});

test("points : un projet peu soutenu rapporte plus qu'un favori", () => {
  assert.equal(popularityPoints(1, 40, 12) > popularityPoints(9, 40, 12), true);
  assert.equal(popularityPoints(9, 40, 12), 520); // 100 × 52 / 10
  assert.equal(popularityPoints(0, 40, 12), 5200); // 100 × 52 / 1
});

test("points : le bonus de rapidité multiplie, arrondi à l'unité", () => {
  assert.equal(potentialPoints(9, 40, 12, 1), 520);
  assert.equal(potentialPoints(9, 40, 12, 0.2), 104);
  assert.equal(potentialPoints(2, 7, 3, 0.6), 200); // 100 × 10 / 3 × 0.6
});

test("points : 1er tout, 2e la moitié, 3e un quart, sinon rien", () => {
  assert.equal(wonPoints(1000, 1), 1000);
  assert.equal(wonPoints(1000, 2), 500);
  assert.equal(wonPoints(1000, 3), 250);
  assert.equal(wonPoints(1000, null), 0);
  assert.equal(wonPoints(333, 2), 167);
});

test("points : séparateur des milliers à la française", () => {
  assert.equal(formatPoints(1240).replace(/\s/g, " "), "1 240");
  assert.equal(formatPoints(87.6), "88");
});

// ------------------------------------------------------------- classement

test("aucun pari : tous les projets rapportent pareil", () => {
  const board = computeBoard(tracks, projects, [], "me");
  assert.equal(board.totalVoters, 0);
  assert.deepEqual(board.tracks[0].standings.map((s) => s.gainBase), [300, 300, 300]);
});

test("le rang suit le nombre de parieurs, les gains se calculent sur SA track", () => {
  const bets = [bet("v1", "t1", "p1"), bet("v2", "t1", "p1"), bet("v3", "t1", "p2"), bet("v4", "t2", "p4")];
  const board = computeBoard(tracks, projects, bets, null);

  assert.deepEqual(
    board.tracks[0].standings.map((s) => [s.name, s.rank, s.bets, s.gainBase]),
    [
      ["Alpha", 1, 2, 200], // 100 × (3+3) / (2+1)
      ["Bravo", 2, 1, 300], // 100 × 6 / 2
      ["Charlie", 3, 0, 600], // 100 × 6 / 1
    ]
  );
  assert.deepEqual(board.tracks[1].standings.map((s) => s.gainBase), [100]); // 100 × 2 / 2
});

test("mon propre pari ne compte pas dans ce que je gagnerais en reposant un pari", () => {
  const bets = [bet("moi", "t1", "p1"), bet("v2", "t1", "p1")];
  const mine = computeBoard(tracks, projects, bets, "moi").tracks[0].standings;
  const theirs = computeBoard(tracks, projects, bets, null).tracks[0].standings;

  // Pour moi, Alpha a un seul autre parieur, et la track un seul autre parieur.
  assert.equal(mine.find((s) => s.name === "Alpha")!.gainBase, 200); // 100 × (1+3) / (1+1)
  assert.equal(mine.find((s) => s.name === "Bravo")!.gainBase, 400); // 100 × 4 / 1
  assert.equal(Math.round(theirs.find((s) => s.name === "Alpha")!.gainBase), 167); // 100 × 5 / 3
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

// ------------------------------------------------------------- mes points

test("mes points : figés au pari, en jeu tant que la track n'est pas décidée", () => {
  const bets = [bet("moi", "t1", "p2", 840), bet("moi", "t2", "p4", 120), bet("autre", "t1", "p2", 5000)];
  const board = computeBoard(tracks, projects, bets, "moi");

  assert.deepEqual(board.tracks.map((t) => t.myPoints), [840, 120, null]);
  assert.deepEqual(board.tracks.map((t) => t.myWon), [null, null, null]);
  assert.equal(board.myPointsAtStake, 960);
  assert.equal(board.myPointsWon, 0);
  assert.equal(board.decidedTracks, 0);
});

test("mes points : une fois le 1er annoncé, gain selon la place de mon projet", () => {
  const bets = [bet("moi", "t1", "p2", 840), bet("moi", "t2", "p4", 120)];

  const second = computeBoard(settle("p1", "p2"), projects, bets, "moi");
  assert.equal(second.tracks[0].decided, true);
  assert.equal(second.tracks[0].myWon, 420);
  assert.equal(second.myPointsWon, 420);
  assert.equal(second.myPointsAtStake, 120); // t2 n'est pas décidée

  const outside = computeBoard(settle("p1", "p3"), projects, bets, "moi");
  assert.equal(outside.tracks[0].myWon, 0);

  const winner = computeBoard(settle("p2"), projects, bets, "moi");
  assert.equal(winner.tracks[0].myWon, 840);
});

test("mes points : une 2e place annoncée seule ne décide pas la track", () => {
  const board = computeBoard(settle(null, "p2"), projects, [bet("moi", "t1", "p2", 840)], "moi");
  assert.equal(board.tracks[0].decided, false);
  assert.equal(board.tracks[0].myWon, null);
  assert.equal(board.myPointsAtStake, 840);
});

// ----------------------------------------------------------------- podium

test("podium : 1er, 2e et 3e sont marqués dans leur propre track", () => {
  const board = computeBoard(settle("p2", "p3", "p1"), projects, [], null);

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
  const board = computeBoard(settle("p2", "p1"), projects, [bet("v1", "t1", "p1")], null);

  assert.deepEqual(
    board.tracks[0].podium.map((s) => [s.place, s.name]),
    [
      [1, "Bravo"],
      [2, "Alpha"],
    ]
  );
});

test("podium : partiel tant que les places ne sont pas toutes annoncées", () => {
  const board = computeBoard(settle("p1"), projects, [], null);
  assert.deepEqual(board.tracks[0].podium.map((s) => s.name), ["Alpha"]);
  assert.deepEqual(board.tracks[1].podium, []);
});

test("podium : avoir parié sur un projet du podium, les deux états coexistent", () => {
  const board = computeBoard(settle(null, "p1"), projects, [bet("moi", "t1", "p1")], "moi");
  const row = board.tracks[0].standings.find((s) => s.name === "Alpha")!;
  assert.equal(row.place, 2);
  assert.equal(row.isMine, true);
});

// ----------------------------------------------------------------- courbes

test("courbe : aucune courbe tant que personne n'a parié", () => {
  const t1 = computeSeries(tracks, projects, [], null).get("t1")!;
  assert.equal(t1.length, 3);
  assert.equal(t1.every((s) => s.points.length === 0), true);
  assert.deepEqual(t1.map((s) => s.currentBets), [0, 0, 0]);
});

test("courbe : l'axe est le temps, avec une origine commune juste avant le premier pari", () => {
  seq = 0;
  const events = [event("v1", "t1", "p1"), event("v2", "t1", "p1"), event("v3", "t1", "p2")];
  const t1 = computeSeries(tracks, projects, events, null).get("t1")!;
  const alpha = t1.find((s) => s.name === "Alpha")!;
  const charlie = t1.find((s) => s.name === "Charlie")!;

  assert.deepEqual(alpha.points, [
    { time: at(1) - 1, bets: 0 }, // origine
    { time: at(1), bets: 1 },
    { time: at(2), bets: 2 },
  ]);
  assert.equal(alpha.currentBets, 2);
  // Personne sur Charlie : seule l'origine, la courbe reste à plat.
  assert.deepEqual(charlie.points, [{ time: at(1) - 1, bets: 0 }]);
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
  const alpha = t1.find((s) => s.name === "Alpha")!;
  assert.equal(alpha.currentBets, 0);
  assert.deepEqual(alpha.points.map((p) => p.bets), [0, 1, 0]);
  assert.equal(t1.find((s) => s.name === "Bravo")!.currentBets, 1);
});

test("courbe : re-parier sur le même projet ne bouge rien", () => {
  seq = 0;
  const events = [event("v1", "t1", "p1"), event("v1", "t1", "p1")];
  const alpha = computeSeries(tracks, projects, events, null).get("t1")!.find((s) => s.name === "Alpha")!;
  assert.deepEqual(alpha.points.map((p) => p.bets), [0, 1]);
});

test("courbe : deux paris à la même milliseconde ne font qu'un point", () => {
  const same = new Date(T0).toISOString();
  const events: BetEvent[] = [
    { seq: 1, voter_id: "v1", track_id: "t1", project_id: "p1", created_at: same },
    { seq: 2, voter_id: "v2", track_id: "t1", project_id: "p1", created_at: same },
  ];
  const alpha = computeSeries(tracks, projects, events, null).get("t1")!.find((s) => s.name === "Alpha")!;
  assert.deepEqual(alpha.points, [
    { time: T0 - 1, bets: 0 },
    { time: T0, bets: 2 },
  ]);
});

test("courbe : triées du plus soutenu au moins soutenu", () => {
  seq = 0;
  const events = [event("v1", "t1", "p3"), event("v2", "t1", "p3"), event("v3", "t1", "p2")];
  const t1 = computeSeries(tracks, projects, events, null).get("t1")!;
  assert.deepEqual(t1.map((s) => s.name), ["Charlie", "Bravo", "Alpha"]);
});

test("courbe : le podium et mon pari remontent jusqu'aux courbes", () => {
  seq = 0;
  const t1 = computeSeries(settle("p2"), projects, [event("moi", "t1", "p1")], "moi").get("t1")!;
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

test("à 70 parieurs, les gains restent dans une plage lisible", () => {
  const many: Project[] = Array.from({ length: 12 }, (_, i) => ({
    id: `x${i}`,
    track_id: "t1",
    name: `Project ${i}`,
    team: "",
    brand: null,
    position: i,
  }));
  const bets: Bet[] = Array.from({ length: 70 }, (_, i) => bet(`v${i}`, "t1", `x${i % 6}`));
  const gains = computeBoard(tracks, many, bets, null).tracks[0].standings.map((s) => s.gainBase);

  assert.equal(Math.min(...gains) >= 100, true); // jamais moins qu'un pari « tout le monde pareil »
  assert.equal(Math.max(...gains) <= 8200, true); // 100 × (70 + 12) / 1
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

// ------------------------------------------------------ bonus de rapidité

/** Période de vote de 10 h : de 10 h à 20 h. */
const PERIOD = { opensAt: "2026-10-03T10:00:00.000Z", closesAt: "2026-10-03T20:00:00.000Z" };
const hour = (h: number) => Date.parse(PERIOD.opensAt) + h * 3_600_000;

test("bonus : 1 à l'ouverture, MIN_WEIGHT à la clôture, linéaire entre les deux", () => {
  assert.equal(betWeight(hour(0), PERIOD), 1);
  assert.equal(betWeight(hour(10), PERIOD), MIN_WEIGHT);
  assert.equal(betWeight(hour(5), PERIOD), (1 + MIN_WEIGHT) / 2);
  assert.equal(betWeight(hour(2), PERIOD) > betWeight(hour(8), PERIOD), true);
});

test("bonus : avant l'ouverture 1, sans heure de fin pas de bonus", () => {
  assert.equal(betWeight(hour(-3), PERIOD), 1);
  assert.equal(betWeight(hour(12), PERIOD), MIN_WEIGHT);
  assert.equal(betWeight(hour(5), { opensAt: PERIOD.opensAt, closesAt: null }), 1);
  assert.equal(betWeight(hour(5), { opensAt: null, closesAt: PERIOD.closesAt }), 1);
});

test("bonus : affiché en pourcentage entier", () => {
  assert.equal(formatWeight(1), "100 %");
  assert.equal(formatWeight(0.7333), "73 %");
});

test("bonus : parier tôt sur un favori peut valoir plus que parier tard sur un outsider", () => {
  const earlyFavourite = potentialPoints(9, 40, 12, betWeight(hour(0), PERIOD)); // 520 × 1
  const lateOutsider = potentialPoints(4, 40, 12, betWeight(hour(10), PERIOD)); // 1 040 × 0.2
  assert.equal(earlyFavourite, 520);
  assert.equal(lateOutsider, 208);
});
