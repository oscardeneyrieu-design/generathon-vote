"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Rule, SectionHeading, StatPair } from "@/components/Bits";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Leaderboard } from "@/components/Leaderboard";
import { BRAND_TRACK_KEY } from "@/lib/tracks";
import { useLive } from "@/lib/use-live";
import type { Project, TrackBoard } from "@/lib/types";

type ActFn = (input: RequestInfo, init: RequestInit, message: string) => Promise<boolean>;
type JsonFn = (body: unknown, method: string) => RequestInit;

/**
 * Tant que l'état n'est pas arrivé, la console ne prétend pas savoir si le
 * vote est ouvert : afficher « Betting is closed » avant d'avoir lu la base
 * pousserait l'organisateur à cliquer sur « Open » alors que c'est déjà fait.
 */
function ConsoleSkeleton() {
  return (
    <main
      className="mx-auto min-h-dvh w-full max-w-[68rem] px-4 pt-6"
      aria-busy="true"
      aria-label="Loading"
    >
      <span className="t-label">Public vote — Admin</span>
      <Rule thick />
      <div className="skeleton mt-8 h-11 w-1/2" />
      <div className="mt-6 flex gap-3">
        <div className="skeleton h-11 w-44" />
        <div className="skeleton h-11 w-40" />
      </div>
      <div className="skeleton mt-14 h-64 w-full" />
    </main>
  );
}

export function AdminConsole() {
  const router = useRouter();
  const live = useLive();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const act: ActFn = async (input, init, successMessage) => {
    setBusy(true);
    setProblem(null);
    setNotice(null);

    try {
      const response = await fetch(input, init);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Action refused.");
      }
      setNotice(successMessage);
      return true;
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : "Action refused.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const json: JsonFn = (body, method) => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const totalProjects = live.projects.length;
  const isLoading = live.status === "loading";

  if (isLoading) return <ConsoleSkeleton />;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[68rem] px-4 pb-28 pt-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="t-label">Public vote — Admin</span>
        <nav className="flex items-center gap-4">
          <Link href="/" className="t-label underline underline-offset-2">
            Vote page
          </Link>
          <Link href="/board" className="t-label underline underline-offset-2">
            Big screen
          </Link>
          <button
            type="button"
            className="t-label underline underline-offset-2"
            onClick={async () => {
              await fetch("/api/admin/session", { method: "DELETE" });
              router.refresh();
            }}
          >
            Sign out
          </button>
        </nav>
      </header>

      <Rule thick />

      {(notice || problem) && (
        <p
          role="status"
          className="mt-4 border-2 border-[color:var(--color-ink)] px-3 py-2 text-sm font-semibold"
        >
          {problem ?? notice}
        </p>
      )}

      {/* ---------------------------------------------------- vote global */}
      <section className="pt-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <h1 className="t-display">
              {live.votingOpen ? "Betting is open" : "Betting is closed"}
            </h1>
            <p className="t-meta mt-1 max-w-[62ch]">
              {live.votingOpen
                ? "Anyone with the link can place or change a bet right now."
                : "Nobody can place or change a bet. Standings stay visible to everyone."}
            </p>
          </div>
          <div className="flex gap-8">
            <StatPair value={live.board.totalVoters} label="Bettors" />
            <StatPair value={totalProjects} label="Projects" />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <ConfirmButton
            label={live.votingOpen ? "Close betting" : "Open betting"}
            confirmLabel={live.votingOpen ? "Confirm close" : "Confirm open"}
            disabled={busy || (!live.votingOpen && totalProjects === 0)}
            onConfirm={() =>
              act(
                "/api/admin/voting",
                json({ open: !live.votingOpen }, "PATCH"),
                live.votingOpen ? "Betting closed." : "Betting open. Bets are being recorded."
              )
            }
          />

          <ConfirmButton
            label="Erase every bet"
            confirmLabel="Confirm: all bets will be lost"
            disabled={busy || live.board.totalVoters === 0}
            onConfirm={() =>
              act("/api/admin/voting", { method: "DELETE" }, "All bets erased.")
            }
          />
        </div>

        {totalProjects === 0 && (
          <p className="t-meta mt-3">
            Add at least one project below before opening the vote.
          </p>
        )}
      </section>

      {/* -------------------------------------------------------- tracks */}
      {live.board.tracks.map((entry, index) => (
        <TrackPanel
          key={entry.track.id}
          index={index + 1}
          entry={entry}
          projects={live.projects.filter((project) => project.track_id === entry.track.id)}
          busy={busy}
          act={act}
          json={json}
        />
      ))}
    </main>
  );
}

function TrackPanel({
  index,
  entry,
  projects,
  busy,
  act,
  json,
}: {
  index: number;
  entry: TrackBoard;
  projects: Project[];
  busy: boolean;
  act: ActFn;
  json: JsonFn;
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

  return (
    <section className="pt-14">
      <SectionHeading
        step={`Track ${index}`}
        title={track.name}
        aside={
          <span className="t-label text-[color:var(--color-ink-muted)]">
            {projects.length} projects · {voters} bettors
          </span>
        }
      />

      <Rule thick />

      {/* titre de la track */}
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <label className="t-label block" htmlFor={`name-${track.id}`}>
            Track name
          </label>
          <input
            id={`name-${track.id}`}
            className="field mt-2"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="min-w-[16rem] flex-[2]">
          <label className="t-label block" htmlFor={`subtitle-${track.id}`}>
            Challenge line
          </label>
          <input
            id={`subtitle-${track.id}`}
            className="field mt-2"
            value={subtitle}
            maxLength={160}
            onChange={(event) => setSubtitle(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn"
          disabled={busy || !headerDirty || name.trim().length === 0}
          onClick={() =>
            act("/api/admin/tracks", json({ id: track.id, name, subtitle }, "PATCH"), "Track updated.")
          }
        >
          Save
        </button>
      </div>

      {/* gagnant */}
      <div className="mt-6">
        <label className="t-label block" htmlFor={`winner-${track.id}`}>
          Winner
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select
            id={`winner-${track.id}`}
            className="field max-w-[24rem]"
            value={track.winner_project_id ?? ""}
            disabled={busy || projects.length === 0}
            onChange={(event) =>
              act(
                "/api/admin/tracks",
                json({ id: track.id, winnerProjectId: event.target.value || null }, "PUT"),
                event.target.value ? "Winner announced." : "Winner cleared."
              )
            }
          >
            <option value="">— none —</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
                {project.team ? ` — ${project.team}` : ""}
              </option>
            ))}
          </select>
          <span className="t-meta">Shows instantly on the vote page and the big screen.</span>
        </div>
      </div>

      {/* classement */}
      {projects.length > 0 && (
        <div className="mt-8">
          <h3 className="t-label mb-3 text-[color:var(--color-ink-muted)]">Live standings</h3>
          <Leaderboard standings={standings} />
        </div>
      )}

      {/* projets */}
      <div className="mt-8">
        <h3 className="t-label text-[color:var(--color-ink-muted)]">Projects</h3>
        <div className="mt-3">
          <Rule />
          {projects.length === 0 ? (
            <p className="t-meta py-4">
              No project yet. Add them one by one, or paste the whole list at once.
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  hasBrands={hasBrands}
                  busy={busy}
                  act={act}
                  json={json}
                />
              ))}
            </ul>
          )}
        </div>

        <form
          className="mt-6 flex flex-wrap items-end gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const done = await act(
              "/api/admin/projects",
              json(
                { trackId: track.id, name: newName, team: newTeam, brand: newBrand },
                "POST"
              ),
              "Project added."
            );
            if (done) {
              setNewName("");
              setNewTeam("");
              setNewBrand("");
            }
          }}
        >
          <div className="min-w-[11rem] flex-1">
            <label className="t-label block" htmlFor={`add-name-${track.id}`}>
              Project
            </label>
            <input
              id={`add-name-${track.id}`}
              className="field mt-2"
              value={newName}
              maxLength={80}
              onChange={(event) => setNewName(event.target.value)}
            />
          </div>
          <div className="min-w-[11rem] flex-1">
            <label className="t-label block" htmlFor={`add-team-${track.id}`}>
              Team
            </label>
            <input
              id={`add-team-${track.id}`}
              className="field mt-2"
              value={newTeam}
              maxLength={80}
              onChange={(event) => setNewTeam(event.target.value)}
            />
          </div>
          {hasBrands && (
            <div className="min-w-[9rem] flex-1">
              <label className="t-label block" htmlFor={`add-brand-${track.id}`}>
                Brand
              </label>
              <input
                id={`add-brand-${track.id}`}
                className="field mt-2"
                value={newBrand}
                maxLength={40}
                onChange={(event) => setNewBrand(event.target.value)}
              />
            </div>
          )}
          <button type="submit" className="btn" disabled={busy || newName.trim().length === 0}>
            Add
          </button>
        </form>

        <div className="mt-7">
          <button
            type="button"
            className="t-label underline underline-offset-2"
            aria-expanded={showBulk}
            onClick={() => setShowBulk((value) => !value)}
          >
            {showBulk ? "Hide bulk import" : "Paste the whole list"}
          </button>

          {showBulk && (
            <div className="mt-3">
              <label className="t-label block" htmlFor={`bulk-${track.id}`}>
                One project per line — {hasBrands ? "Project | Team | Brand" : "Project | Team"}
              </label>
              <textarea
                id={`bulk-${track.id}`}
                className="field mt-2 min-h-[11rem] font-mono text-sm"
                value={bulk}
                placeholder={
                  hasBrands
                    ? "Neon Hours | Studio Kiwi | Converse\nOwl Riot | Team Duo | Duolingo"
                    : "Neon Hours | Studio Kiwi\nThe Long Drive | Atlas"
                }
                onChange={(event) => setBulk(event.target.value)}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <ConfirmButton
                  label={`Replace ${projects.length} with ${bulkRows.length}`}
                  confirmLabel="Confirm: bets on this track will be erased"
                  disabled={busy || bulkRows.length === 0}
                  onConfirm={async () => {
                    const done = await act(
                      "/api/admin/projects",
                      json({ trackId: track.id, rows: bulkRows }, "PUT"),
                      `${bulkRows.length} projects saved.`
                    );
                    if (done) {
                      setBulk("");
                      setShowBulk(false);
                    }
                  }}
                />
                <span className="t-meta">
                  Replacing projects deletes the bets that pointed at them.
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
  hasBrands,
  busy,
  act,
  json,
}: {
  project: Project;
  hasBrands: boolean;
  busy: boolean;
  act: ActFn;
  json: JsonFn;
}) {
  const [name, setName] = useState(project.name);
  const [team, setTeam] = useState(project.team);
  const [brand, setBrand] = useState(project.brand ?? "");

  const dirty =
    (name.trim() !== project.name || team.trim() !== project.team || brand.trim() !== (project.brand ?? "")) &&
    name.trim().length > 0;

  return (
    <li
      className="flex flex-wrap items-center gap-2 py-2"
      style={{ borderBottom: "1px solid var(--color-ink)" }}
    >
      <input
        className="field flex-[2]"
        style={{ minWidth: "10rem", borderWidth: dirty ? "2px" : "1px" }}
        value={name}
        maxLength={80}
        aria-label={`Project name: ${project.name}`}
        onChange={(event) => setName(event.target.value)}
      />
      <input
        className="field flex-1"
        style={{ minWidth: "8rem", borderWidth: dirty ? "2px" : "1px" }}
        value={team}
        maxLength={80}
        placeholder="Team"
        aria-label={`Team for ${project.name}`}
        onChange={(event) => setTeam(event.target.value)}
      />
      {hasBrands && (
        <input
          className="field"
          style={{ minWidth: "7rem", maxWidth: "10rem", borderWidth: dirty ? "2px" : "1px" }}
          value={brand}
          maxLength={40}
          placeholder="Brand"
          aria-label={`Brand for ${project.name}`}
          onChange={(event) => setBrand(event.target.value)}
        />
      )}

      <button
        type="button"
        className="btn"
        disabled={busy || !dirty}
        onClick={() =>
          act(
            "/api/admin/projects",
            json({ id: project.id, name, team, brand }, "PATCH"),
            `Saved “${name.trim()}”.`
          )
        }
      >
        Save
      </button>

      <ConfirmButton
        label="Delete"
        confirmLabel="Confirm"
        disabled={busy}
        onConfirm={() =>
          act(
            `/api/admin/projects?id=${encodeURIComponent(project.id)}`,
            { method: "DELETE" },
            `“${project.name}” deleted.`
          )
        }
      />
    </li>
  );
}

/** `Project | Team | Brand`, séparateur `|` ou tabulation (colle depuis un tableur). */
function parseBulk(
  raw: string,
  hasBrands: boolean
): Array<{ name: string; team: string; brand: string | null }> {
  return raw
    .split("\n")
    .map((line) => line.split(/\t|\|/).map((cell) => cell.trim()))
    .filter((cells) => cells[0]?.length > 0)
    .map((cells) => ({
      name: cells[0],
      team: cells[1] ?? "",
      brand: hasBrands && cells[2] ? cells[2] : null,
    }));
}
