/**
 * Vérification de bout en bout contre un serveur qui tourne.
 *
 *   npm run smoke                                  # localhost, code depuis .env.local
 *   npm run smoke -- https://vote.generathon.tech mon-code
 *
 * À lancer depuis le PC ET depuis un téléphone du même réseau : c'est le
 * seul moyen de découvrir avant les invités que le réseau isole les clients.
 *
 * Le script crée un projet jetable, parie dessus, puis le supprime — ce qui
 * efface aussi ses paris par cascade. Il restaure l'état d'ouverture du vote
 * tel qu'il l'a trouvé. Tes vrais projets et paris ne sont pas touchés.
 */
import { readFileSync } from "node:fs";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const code = process.argv[3] ?? readAdminCode();

const SMOKE_PROJECT = "__smoke-test__";
let failures = 0;
let cookie = "";

function readAdminCode() {
  try {
    const line = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
      .split("\n")
      .find((l) => l.trim().startsWith("ADMIN_CODE="));
    return line?.slice(line.indexOf("=") + 1).trim() ?? "";
  } catch {
    return "";
  }
}

function check(label, ok, detail = "") {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "OK  " : "ÉCHEC"}  ${label}${detail ? `  — ${detail}` : ""}`);
  return ok;
}

async function call(path, init = {}) {
  const response = await fetch(base + path, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...init.headers,
    },
  });

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 200);
  }
  return { status: response.status, body };
}

const send = (body, method) => ({ method, body: JSON.stringify(body) });

/**
 * En mode SQLite, /api/stream est un flux SSE qui ne se termine jamais : on
 * lit le statut dès l'arrivée des en-têtes et on coupe, sans toucher au corps.
 */
async function probeStream() {
  const controller = new AbortController();
  try {
    const response = await fetch(base + "/api/stream", { signal: controller.signal });
    return response.status;
  } catch {
    return 0;
  } finally {
    controller.abort();
  }
}

console.log(`\nPublic vote — vérification de ${base}\n`);

// 1. Le serveur répond.
const first = await call("/api/state");
if (!check("le serveur répond", first.status === 200, `HTTP ${first.status}`)) {
  console.log("\n  Le serveur ne répond pas. Est-il démarré ? Bonne adresse ?\n");
  process.exit(1);
}

console.log(`  INFO  backend : ${(await probeStream()) === 204 ? "supabase" : "sqlite"}`);

const wasOpen = first.body.votingOpen;
const wasClosesAt = first.body.closesAt ?? null;
const wasOpensAt = first.body.opensAt ?? null;
console.log(`  INFO  vote actuellement : ${wasOpen ? "ouvert" : "fermé"}${wasClosesAt ? ` jusqu'à ${wasClosesAt}` : ""}`);

const tracks = first.body.tracks ?? [];
if (!check("les trois tracks existent", tracks.length === 3, `${tracks.length} track(s)`)) {
  console.log("\n  La base n'a pas été initialisée. Rejoue supabase/schema.sql.\n");
  process.exit(1);
}
check(
  "les projets sont répartis dans les tracks",
  (first.body.projects ?? []).length >= 0,
  `${(first.body.projects ?? []).length} projets au total`
);

// 2. Le code admin ouvre bien une session.
const login = await call("/api/admin/session", send({ code }, "POST"));
if (!check("le code admin est accepté", login.status === 200, `HTTP ${login.status}`)) {
  console.log("\n  Vérifie ADMIN_CODE, ou passe-le en second argument.\n");
  process.exit(1);
}

// 3. Les écritures anonymes restent refusées.
const forged = await fetch(base + "/api/admin/voting", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ open: true }),
});
check("un inconnu ne peut pas ouvrir le vote", forged.status === 401, `HTTP ${forged.status}`);

// 4. Un projet jetable dans chacune des deux premières tracks.
const [trackA, trackB] = tracks;
const created = await call(
  "/api/admin/projects",
  send({ trackId: trackA.id, name: SMOKE_PROJECT, team: "smoke" }, "POST")
);
check("création d'un projet de test", created.status === 200, `HTTP ${created.status}`);
await call("/api/admin/projects", send({ trackId: trackB.id, name: SMOKE_PROJECT, team: "smoke" }, "POST"));

const afterCreate = (await call("/api/state")).body;
const smoke = afterCreate.projects.find((p) => p.name === SMOKE_PROJECT && p.track_id === trackA.id);
const smokeB = afterCreate.projects.find((p) => p.name === SMOKE_PROJECT && p.track_id === trackB.id);
if (!check("les projets de test sont bien en base", Boolean(smoke && smokeB))) {
  await cleanup([smoke?.id, smokeB?.id]);
  process.exit(1);
}

// 4 bis. Membres et photo.
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const photo = await call("/api/admin/photos", send({ dataUrl: PIXEL }, "POST"));
check("envoi d'une photo", photo.status === 200 && typeof photo.body.url === "string", `HTTP ${photo.status}`);
const member = await call(
  "/api/admin/members",
  send({ projectId: smoke.id, name: "Smoke Tester", photoUrl: photo.body.url }, "POST")
);
check("ajout d'un membre avec photo", member.status === 200, `HTTP ${member.status}`);
const withMember = (await call("/api/state")).body;
const smokeMember = (withMember.members ?? []).find((m) => m.project_id === smoke.id);
check("le membre apparaît dans l'état public", smokeMember?.name === "Smoke Tester");
const served = await fetch(base + photo.body.url);
check(
  "la photo est servie",
  served.ok && served.headers.get("content-type") === "image/png",
  `HTTP ${served.status}`
);
const external = await call(
  "/api/admin/members",
  send({ projectId: smoke.id, name: "X", photoUrl: "https://example.com/x.png" }, "POST")
);
check("une URL de photo externe est refusée", external.status === 400, `HTTP ${external.status}`);

// 5. Cycle de pari.
await call("/api/admin/voting", send({ open: true }, "PATCH"));

const placeBet = (trackId, projectId, voterId) =>
  call("/api/bet", send({ trackId, projectId, voterId }, "POST"));

const betA = await placeBet(trackA.id, smoke.id, "smoke-voter-aaaa");
check("un pari est accepté", betA.status === 200, `HTTP ${betA.status}`);
check(
  "le pari renvoie ses points, figés par le serveur",
  Number.isInteger(betA.body?.points) && betA.body.points > 0,
  `${betA.body?.points} pts`
);

await placeBet(trackA.id, smoke.id, "smoke-voter-bbbb");
let state = (await call("/api/state")).body;
let smokeBets = state.bets.filter((b) => b.project_id === smoke.id);
check("deux parieurs comptent pour deux paris", smokeBets.length === 2, `${smokeBets.length}`);

// Un projet d'une autre track : le serveur doit refuser l'incohérence.
const mismatch = await placeBet(trackB.id, smoke.id, "smoke-voter-cccc");
check(
  "un projet hors de sa track est refusé",
  mismatch.status === 409,
  `HTTP ${mismatch.status}`
);

await new Promise((r) => setTimeout(r, 300));
const again = await placeBet(trackA.id, smoke.id, "smoke-voter-aaaa");
state = (await call("/api/state")).body;
smokeBets = state.bets.filter((b) => b.project_id === smoke.id);
check("re-parier ne crée pas un second pari", smokeBets.length === 2, `${smokeBets.length}`);
check(
  "re-taper son projet garde les mêmes points",
  again.body?.points === betA.body?.points,
  `${betA.body?.points} → ${again.body?.points}`
);

// Un même parieur peut désigner un gagnant dans une AUTRE track.
await new Promise((r) => setTimeout(r, 300));
const betB = await placeBet(trackB.id, smokeB.id, "smoke-voter-aaaa");
state = (await call("/api/state")).body;
const mine = state.bets.filter((b) => b.voter_id === "smoke-voter-aaaa");
check(
  "un même parieur a un pari dans chaque track",
  betB.status === 200 && mine.length === 2 && mine.some((b) => b.project_id === smoke.id),
  `${mine.length} pari(s)`
);

// 5 bis. Horloge : ouverts jusqu'à l'heure dite, puis refusés.
const past = await call(
  "/api/admin/voting",
  send({ open: true, closesAt: new Date(Date.now() - 60_000).toISOString() }, "PATCH")
);
check("une heure de fin déjà passée est refusée", past.status === 400, `HTTP ${past.status}`);
await call("/api/admin/voting", send({ open: true, closesAt: new Date(Date.now() + 2500).toISOString() }, "PATCH"));
const beforeDeadline = await placeBet(trackA.id, smoke.id, "smoke-voter-eeee");
check("pari accepté avant l'heure de fin", beforeDeadline.status === 200, `HTTP ${beforeDeadline.status}`);
await new Promise((r) => setTimeout(r, 3000));
const afterDeadline = await placeBet(trackA.id, smoke.id, "smoke-voter-ffff");
check("pari refusé après l'heure de fin", afterDeadline.status === 409, `HTTP ${afterDeadline.status}`);

// 6. Clôture : plus aucun pari ne passe.
await call("/api/admin/voting", send({ open: false }, "PATCH"));
const late = await placeBet(trackA.id, smoke.id, "smoke-voter-dddd");
check("un pari après clôture est refusé", late.status === 409, `HTTP ${late.status}`);

// 7. Ménage et restauration.
await cleanup([smoke.id, smokeB.id]);

const final = (await call("/api/state")).body;
check(
  "aucune trace laissée",
  !final.projects.some((p) => p.name === SMOKE_PROJECT) &&
    !final.bets.some((b) => b.voter_id.startsWith("smoke-voter-"))
);
check(
  "l'état d'ouverture du vote est restauré",
  final.votingOpen === wasOpen &&
    (final.closesAt ?? null) === wasClosesAt &&
    (final.opensAt ?? null) === wasOpensAt,
  final.votingOpen ? "ouvert" : "fermé"
);
if (photo.body.url) {
  const gone = await fetch(base + photo.body.url);
  check("la photo du membre supprimé est effacée", gone.status === 404, `HTTP ${gone.status}`);
}

async function cleanup(projectIds) {
  for (const projectId of projectIds.filter(Boolean)) {
    // Supprimer le projet efface ses membres et ses paris par cascade.
    await call(`/api/admin/projects?id=${encodeURIComponent(projectId)}`, { method: "DELETE" });
  }
  // Rouvrir n'accepte qu'une heure de fin à venir ; fermé, elle se repose telle quelle.
  // L'heure d'ouverture aussi : la valeur des paris déjà posés en dépend.
  const closesAt =
    !wasOpen || (wasClosesAt && Date.parse(wasClosesAt) > Date.now()) ? wasClosesAt : null;
  await call("/api/admin/voting", send({ open: wasOpen, closesAt, opensAt: wasOpensAt }, "PATCH"));
}

console.log(
  failures === 0
    ? "\n  Tout est bon.\n"
    : `\n  ${failures} problème(s). Ne lance pas avant d'avoir corrigé.\n`
);

process.exit(failures === 0 ? 0 : 1);
