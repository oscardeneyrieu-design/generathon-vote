"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Notice, PageHeader, placeLabel, plural, Stat } from "@/components/Bits";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Countdown } from "@/components/Countdown";
import { Leaderboard } from "@/components/Leaderboard";
import { Avatar } from "@/components/Members";
import { BRAND_TRACK_KEY } from "@/lib/tracks";
import { useLive } from "@/lib/use-live";
import { formatDeadline } from "@/lib/voting";
import type { Member, Place, Project, TrackBoard } from "@/lib/types";

/**
 * Envoie une action à l'API et affiche le résultat. Renvoie la réponse JSON
 * si elle a réussi, `null` sinon (le message d'erreur est déjà affiché).
 */
type Act = (
  url: string,
  method: string,
  body: unknown,
  success: string
) => Promise<Record<string, unknown> | null>;

export function AdminConsole() {
  const router = useRouter();
  const live = useLive();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const act: Act = async (url, method, body, success) => {
    setBusy(true);
    setProblem(null);
    setNotice(null);

    try {
      const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = ((await response.json().catch(() => null)) ?? {}) as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Action refusée.");
      setNotice(success);
      return payload;
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : "Action refusée.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  // Tant que l'état n'est pas lu, la console ne prétend pas savoir si le vote
  // est ouvert : l'organisateur pourrait cliquer « Ouvrir » alors que c'est fait.
  if (live.status === "loading") {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12" aria-busy="true">
        <div className="skeleton h-9 w-72" />
        <div className="skeleton h-40" />
        <div className="skeleton h-80" />
      </main>
    );
  }

  const totalProjects = live.projects.length;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10 sm:py-12">
      <PageHeader
        title="Espace organisateur"
        intro="Ouvre les paris, programme leur fermeture, saisis les projets et annonce les podiums."
        aside={
          <div className="flex gap-8">
            <Stat value={live.board.totalVoters} label="Parieurs" />
            <Stat value={totalProjects} label="Projets" />
          </div>
        }
      />

      <VotingPanel
        votingOpen={live.votingOpen}
        bettingOpen={live.bettingOpen}
        closesAt={live.closesAt}
        hasProjects={totalProjects > 0}
        hasBets={live.board.totalVoters > 0}
        busy={busy}
        act={act}
        onSignOut={async () => {
          await fetch("/api/admin/session", { method: "DELETE" });
          router.refresh();
        }}
      />

      {problem && <Notice>{problem}</Notice>}
      {notice && !problem && (
        <p role="status" className="rounded-lg bg-gold/15 px-3.5 py-2.5 text-sm font-medium">
          {notice}
        </p>
      )}

      {live.board.tracks.map((entry) => (
        <TrackPanel
          key={entry.track.id}
          entry={entry}
          projects={live.projects.filter((project) => project.track_id === entry.track.id)}
          members={live.members}
          busy={busy}
          act={act}
        />
      ))}
    </main>
  );
}

// ------------------------------------------------------------------ horloge

/** `2026-10-04T14:00`, l'heure locale au format attendu par <input type="datetime-local">. */
function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/** Proposition par défaut : le prochain dimanche à 14 h. */
function nextSundayAt14(): Date {
  const date = new Date();
  date.setHours(14, 0, 0, 0);
  const daysToSunday = (7 - date.getDay()) % 7;
  date.setDate(date.getDate() + daysToSunday);
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 7);
  return date;
}

function VotingPanel({
  votingOpen,
  bettingOpen,
  closesAt,
  hasProjects,
  hasBets,
  busy,
  act,
  onSignOut,
}: {
  votingOpen: boolean;
  bettingOpen: boolean;
  closesAt: string | null;
  hasProjects: boolean;
  hasBets: boolean;
  busy: boolean;
  act: Act;
  onSignOut: () => void;
}) {
  const [deadline, setDeadline] = useState(() =>
    toLocalInput(closesAt && Date.parse(closesAt) > Date.now() ? new Date(closesAt) : nextSundayAt14())
  );

  // `new Date("2026-10-04T14:00")` se lit dans le fuseau de l'appareil : on
  // envoie donc au serveur une heure absolue, sans ambiguïté.
  const deadlineDate = new Date(deadline);
  const deadlineValid = !Number.isNaN(deadlineDate.getTime()) && deadlineDate.getTime() > Date.now();
  const deadlinePassed = votingOpen && closesAt !== null && !bettingOpen;

  const status = bettingOpen
    ? closesAt
      ? "Les paris sont ouverts, fermeture automatique programmée."
      : "Les paris sont ouverts, sans heure de fin."
    : deadlinePassed
      ? `Les paris se sont fermés automatiquement le ${formatDeadline(closesAt!)}.`
      : "Les paris sont fermés.";

  return (
    <section className="card flex flex-col gap-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight">{bettingOpen ? "Paris ouverts" : "Paris fermés"}</h2>
          <p className="muted text-sm">{status}</p>
        </div>
        {bettingOpen && closesAt && <Countdown closesAt={closesAt} large />}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[15rem] flex-col gap-1.5">
          <label className="label" htmlFor="deadline">
            Fin des paris (jour et heure)
          </label>
          <input
            id="deadline"
            type="datetime-local"
            className="field"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
        </div>
        <ConfirmButton
          variant="gold"
          label={bettingOpen && closesAt ? "Changer l'heure de fin" : "Lancer le compte à rebours"}
          confirmLabel={`Confirmer : fin le ${deadlineValid ? formatDeadline(deadlineDate.toISOString()) : "?"}`}
          disabled={busy || !hasProjects || !deadlineValid}
          onConfirm={() =>
            act(
              "/api/admin/voting",
              "PATCH",
              { open: true, closesAt: deadlineDate.toISOString() },
              `Paris ouverts jusqu'au ${formatDeadline(deadlineDate.toISOString())}.`
            )
          }
        />
      </div>
      {!deadlineValid && <p className="text-sm text-red-600">Choisis une date et une heure dans le futur.</p>}
      {!hasProjects && (
        <p className="muted text-sm">Ajoute au moins un projet ci-dessous avant d&apos;ouvrir les paris.</p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-black/10 pt-5 dark:border-white/10">
        {bettingOpen ? (
          <ConfirmButton
            label="Fermer les paris maintenant"
            confirmLabel="Confirmer la fermeture"
            disabled={busy}
            onConfirm={() => act("/api/admin/voting", "PATCH", { open: false }, "Paris fermés.")}
          />
        ) : (
          <ConfirmButton
            label="Ouvrir sans heure de fin"
            confirmLabel="Confirmer l'ouverture"
            disabled={busy || !hasProjects}
            onConfirm={() => act("/api/admin/voting", "PATCH", { open: true }, "Paris ouverts, sans heure de fin.")}
          />
        )}
        <ConfirmButton
          label="Effacer tous les paris"
          confirmLabel="Confirmer : tous les paris seront perdus"
          disabled={busy || !hasBets}
          onConfirm={() => act("/api/admin/voting", "DELETE", undefined, "Tous les paris ont été effacés.")}
        />
        <button type="button" className="btn ml-auto text-black/60 hover:underline dark:text-white/60" onClick={onSignOut}>
          Se déconnecter
        </button>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------- tracks

function TrackPanel({
  entry,
  projects,
  members,
  busy,
  act,
}: {
  entry: TrackBoard;
  projects: Project[];
  members: Member[];
  busy: boolean;
  act: Act;
}) {
  const { track, standings, voters } = entry;
  const hasBrands = track.key === BRAND_TRACK_KEY;

  const [name, setName] = useState(track.name);
  const [subtitle, setSubtitle] = useState(track.subtitle);
  const [newName, setNewName] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const headerDirty = name.trim() !== track.name || subtitle.trim() !== track.subtitle;
  const bulkRows = parseBulk(bulk, hasBrands);

  const podium: Record<Place, string | null> = {
    1: track.first_project_id,
    2: track.second_project_id,
    3: track.third_project_id,
  };

  return (
    <section className="card flex flex-col gap-7 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{track.name}</h2>
        <span className="faint text-sm">
          {plural(projects.length, "projet")} · {plural(voters, "parieur")}
        </span>
      </div>

      {/* Nom et ligne de challenge */}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Nom de la track" id={`name-${track.id}`} className="min-w-[12rem] flex-1">
          <input
            id={`name-${track.id}`}
            className="field"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Challenge" id={`subtitle-${track.id}`} className="min-w-[16rem] flex-[2]">
          <input
            id={`subtitle-${track.id}`}
            className="field"
            value={subtitle}
            maxLength={160}
            onChange={(event) => setSubtitle(event.target.value)}
          />
        </Field>
        <button
          type="button"
          className="btn btn-outline"
          disabled={busy || !headerDirty || name.trim().length === 0}
          onClick={() => act("/api/admin/tracks", "PATCH", { id: track.id, name, subtitle }, "Track mise à jour.")}
        >
          Enregistrer
        </button>
      </div>

      {/* Podium */}
      <div>
        <h3 className="section-title mb-3">Podium</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {([1, 2, 3] as Place[]).map((place) => (
            <Field key={place} label={`${placeLabel(place)} place`} id={`place-${place}-${track.id}`}>
              <select
                id={`place-${place}-${track.id}`}
                className="field"
                value={podium[place] ?? ""}
                disabled={busy || projects.length === 0}
                onChange={(event) => {
                  const next = { ...podium, [place]: event.target.value || null };
                  void act(
                    "/api/admin/tracks",
                    "PUT",
                    { id: track.id, first: next[1], second: next[2], third: next[3] },
                    event.target.value ? `${placeLabel(place)} place annoncée.` : `${placeLabel(place)} place retirée.`
                  );
                }}
              >
                <option value="">— personne —</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                    {project.team ? ` — ${project.team}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
        <p className="faint mt-2 text-sm">
          Chaque place s&apos;affiche aussitôt sur les téléphones et le grand écran. Laisse « personne »
          tant que le résultat n&apos;est pas annoncé.
        </p>
      </div>

      {projects.length > 0 && (
        <div>
          <h3 className="section-title mb-3">Classement en direct</h3>
          <Leaderboard standings={standings} />
        </div>
      )}

      {/* Projets */}
      <div>
        <h3 className="section-title mb-3">Projets et équipes</h3>

        {projects.length === 0 ? (
          <p className="muted text-sm">
            Aucun projet pour l&apos;instant. Ajoute-les un par un, ou colle toute la liste d&apos;un coup.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                members={members.filter((member) => member.project_id === project.id)}
                hasBrands={hasBrands}
                busy={busy}
                act={act}
              />
            ))}
          </ul>
        )}

        <form
          className="mt-5 flex flex-wrap items-end gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const done = await act(
              "/api/admin/projects",
              "POST",
              { trackId: track.id, name: newName, team: newTeam, brand: newBrand },
              "Projet ajouté."
            );
            if (done) {
              setNewName("");
              setNewTeam("");
              setNewBrand("");
            }
          }}
        >
          <Field label="Nouveau projet" id={`add-name-${track.id}`} className="min-w-[11rem] flex-1">
            <input
              id={`add-name-${track.id}`}
              className="field"
              value={newName}
              maxLength={80}
              onChange={(event) => setNewName(event.target.value)}
            />
          </Field>
          <Field label="Nom d'équipe" id={`add-team-${track.id}`} className="min-w-[11rem] flex-1">
            <input
              id={`add-team-${track.id}`}
              className="field"
              value={newTeam}
              maxLength={80}
              onChange={(event) => setNewTeam(event.target.value)}
            />
          </Field>
          {hasBrands && (
            <Field label="Marque" id={`add-brand-${track.id}`} className="min-w-[9rem] flex-1">
              <input
                id={`add-brand-${track.id}`}
                className="field"
                value={newBrand}
                maxLength={40}
                onChange={(event) => setNewBrand(event.target.value)}
              />
            </Field>
          )}
          <button type="submit" className="btn btn-gold" disabled={busy || newName.trim().length === 0}>
            Ajouter
          </button>
        </form>

        <div className="mt-5">
          <button
            type="button"
            className="text-sm font-semibold text-gold-ink underline underline-offset-2 dark:text-gold"
            aria-expanded={showBulk}
            onClick={() => setShowBulk((value) => !value)}
          >
            {showBulk ? "Masquer l'import en masse" : "Coller toute la liste"}
          </button>

          {showBulk && (
            <div className="mt-3 flex flex-col gap-3">
              <Field
                label={`Un projet par ligne — ${
                  hasBrands ? "Projet | Équipe | Marque | Membres" : "Projet | Équipe | Membres"
                } (membres séparés par des virgules)`}
                id={`bulk-${track.id}`}
              >
                <textarea
                  id={`bulk-${track.id}`}
                  className="field min-h-[11rem] font-mono"
                  value={bulk}
                  placeholder={
                    hasBrands
                      ? "Neon Hours | Studio Kiwi | Converse | Léa Martin, Tom Durand\nOwl Riot | Team Duo | Duolingo | Sami Benali"
                      : "Neon Hours | Studio Kiwi | Léa Martin, Tom Durand\nThe Long Drive | Atlas | Sami Benali"
                  }
                  onChange={(event) => setBulk(event.target.value)}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <ConfirmButton
                  label={`Remplacer les ${projects.length} projets par ${bulkRows.length}`}
                  confirmLabel="Confirmer : les paris de cette track seront effacés"
                  disabled={busy || bulkRows.length === 0}
                  onConfirm={async () => {
                    const done = await act(
                      "/api/admin/projects",
                      "PUT",
                      { trackId: track.id, rows: bulkRows },
                      `${plural(bulkRows.length, "projet")} enregistré${bulkRows.length > 1 ? "s" : ""}.`
                    );
                    if (done) {
                      setBulk("");
                      setShowBulk(false);
                    }
                  }}
                />
                <span className="faint text-sm">
                  Remplacer la liste supprime les paris qui visaient les anciens projets. Les photos
                  s&apos;ajoutent ensuite, personne par personne.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ProjectRow({
  project,
  members,
  hasBrands,
  busy,
  act,
}: {
  project: Project;
  members: Member[];
  hasBrands: boolean;
  busy: boolean;
  act: Act;
}) {
  const [name, setName] = useState(project.name);
  const [team, setTeam] = useState(project.team);
  const [brand, setBrand] = useState(project.brand ?? "");
  const [open, setOpen] = useState(false);

  const dirty =
    (name.trim() !== project.name || team.trim() !== project.team || brand.trim() !== (project.brand ?? "")) &&
    name.trim().length > 0;

  return (
    <li className="rounded-xl bg-black/[.02] p-3 dark:bg-white/[.03]">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`field flex-[2] ${dirty ? "border-gold" : ""}`}
          style={{ minWidth: "10rem" }}
          value={name}
          maxLength={80}
          aria-label={`Nom du projet ${project.name}`}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          className={`field flex-1 ${dirty ? "border-gold" : ""}`}
          style={{ minWidth: "8rem" }}
          value={team}
          maxLength={80}
          placeholder="Nom d'équipe"
          aria-label={`Équipe de ${project.name}`}
          onChange={(event) => setTeam(event.target.value)}
        />
        {hasBrands && (
          <input
            className={`field ${dirty ? "border-gold" : ""}`}
            style={{ minWidth: "7rem", maxWidth: "10rem" }}
            value={brand}
            maxLength={40}
            placeholder="Marque"
            aria-label={`Marque de ${project.name}`}
            onChange={(event) => setBrand(event.target.value)}
          />
        )}
        <button
          type="button"
          className="btn btn-outline"
          disabled={busy || !dirty}
          onClick={() =>
            act("/api/admin/projects", "PATCH", { id: project.id, name, team, brand }, `« ${name.trim()} » enregistré.`)
          }
        >
          Enregistrer
        </button>
        <ConfirmButton
          label="Supprimer"
          confirmLabel="Confirmer"
          disabled={busy}
          onConfirm={() =>
            act(
              `/api/admin/projects?id=${encodeURIComponent(project.id)}`,
              "DELETE",
              undefined,
              `« ${project.name} » supprimé.`
            )
          }
        />
      </div>

      <button
        type="button"
        className="mt-2 flex items-center gap-2 text-sm font-semibold"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex">
          {members.slice(0, 5).map((member) => (
            <span key={member.id} className="-mr-2">
              <Avatar member={member} size={24} />
            </span>
          ))}
        </span>
        <span className={members.length > 0 ? "ml-2" : ""}>
          {members.length === 0 ? "+ Ajouter les membres" : `${plural(members.length, "membre")} ${open ? "▴" : "▾"}`}
        </span>
      </button>

      {open && <MembersEditor projectId={project.id} members={members} busy={busy} act={act} />}
    </li>
  );
}

// ------------------------------------------------------------------ membres

/**
 * Réduit la photo choisie en carré de 256 px (JPEG ~20 Ko) avant l'envoi :
 * une photo de téléphone brute pèse plusieurs Mo.
 */
async function toSquareJpeg(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext("2d")!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function uploadPhoto(file: File, act: Act): Promise<string | null> {
  let dataUrl: string;
  try {
    dataUrl = await toSquareJpeg(file);
  } catch {
    await act("/api/admin/photos", "POST", { dataUrl: "" }, ""); // affiche l'erreur de format
    return null;
  }
  const result = await act("/api/admin/photos", "POST", { dataUrl }, "Photo envoyée.");
  return typeof result?.url === "string" ? result.url : null;
}

function MembersEditor({
  projectId,
  members,
  busy,
  act,
}: {
  projectId: string;
  members: Member[];
  busy: boolean;
  act: Act;
}) {
  const [newName, setNewName] = useState("");
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-black/10 pt-3 dark:border-white/10">
      {members.map((member) => (
        <MemberRow key={member.id} member={member} busy={busy} act={act} />
      ))}

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          let photoUrl: string | null = null;
          if (newPhoto) {
            photoUrl = await uploadPhoto(newPhoto, act);
            if (!photoUrl) return;
          }
          const done = await act(
            "/api/admin/members",
            "POST",
            { projectId, name: newName, photoUrl },
            `${newName.trim()} ajouté·e.`
          );
          if (done) {
            setNewName("");
            setNewPhoto(null);
            setInputKey((key) => key + 1);
          }
        }}
      >
        <input
          className="field flex-1"
          style={{ minWidth: "10rem" }}
          placeholder="Prénom Nom"
          value={newName}
          maxLength={80}
          aria-label="Nom de la personne à ajouter"
          onChange={(event) => setNewName(event.target.value)}
        />
        <label className="btn btn-outline cursor-pointer">
          {newPhoto ? "Photo choisie ✓" : "Photo (optionnel)"}
          <input
            key={inputKey}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => setNewPhoto(event.target.files?.[0] ?? null)}
          />
        </label>
        <button type="submit" className="btn btn-gold" disabled={busy || newName.trim().length === 0}>
          Ajouter la personne
        </button>
      </form>
    </div>
  );
}

function MemberRow({ member, busy, act }: { member: Member; busy: boolean; act: Act }) {
  const [name, setName] = useState(member.name);
  const dirty = name.trim() !== member.name && name.trim().length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Avatar member={member} size={40} />
      <input
        className={`field flex-1 ${dirty ? "border-gold" : ""}`}
        style={{ minWidth: "10rem" }}
        value={name}
        maxLength={80}
        aria-label={`Nom de ${member.name}`}
        onChange={(event) => setName(event.target.value)}
      />
      <button
        type="button"
        className="btn btn-outline"
        disabled={busy || !dirty}
        onClick={() =>
          act("/api/admin/members", "PATCH", { id: member.id, name, photoUrl: member.photo_url }, "Nom enregistré.")
        }
      >
        Enregistrer
      </button>
      <label className={`btn btn-outline ${busy ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
        {member.photo_url ? "Changer la photo" : "Ajouter une photo"}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const photoUrl = await uploadPhoto(file, act);
            if (photoUrl) {
              await act(
                "/api/admin/members",
                "PATCH",
                { id: member.id, name: member.name, photoUrl },
                `Photo de ${member.name} enregistrée.`
              );
            }
          }}
        />
      </label>
      <ConfirmButton
        label="Retirer"
        confirmLabel="Confirmer"
        disabled={busy}
        onConfirm={() =>
          act(`/api/admin/members?id=${encodeURIComponent(member.id)}`, "DELETE", undefined, `${member.name} retiré·e.`)
        }
      />
    </div>
  );
}

function Field({
  label,
  id,
  className = "",
  children,
}: {
  label: string;
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * `Projet | Équipe | Membres` (ou `Projet | Équipe | Marque | Membres` sur la
 * track Ad). Séparateur `|` ou tabulation, pour coller depuis un tableur ;
 * les membres sont séparés par des virgules.
 */
function parseBulk(raw: string, hasBrands: boolean) {
  return raw
    .split("\n")
    .map((line) => line.split(/\t|\|/).map((cell) => cell.trim()))
    .filter((cells) => cells[0]?.length > 0)
    .map((cells) => ({
      name: cells[0],
      team: cells[1] ?? "",
      brand: hasBrands && cells[2] ? cells[2] : null,
      members: (cells[hasBrands ? 3 : 2] ?? "")
        .split(",")
        .map((member) => member.trim())
        .filter(Boolean),
    }));
}
