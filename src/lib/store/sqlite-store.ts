import "server-only";

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { SEED_TRACKS } from "@/lib/tracks";
import type { Bet, Project, Track } from "@/lib/types";
import type { ProjectInput, Snapshot, Store } from "./types";

const DEFAULT_PATH = ".data/votes.db";

const SCHEMA = `
pragma journal_mode = WAL;
pragma foreign_keys = ON;

create table if not exists tracks (
  id                text primary key,
  key               text not null unique,
  name              text not null,
  subtitle          text not null default '',
  position          integer not null default 0,
  winner_project_id text
);

create table if not exists projects (
  id        text primary key,
  track_id  text not null references tracks(id) on delete cascade,
  name      text not null,
  team      text not null default '',
  brand     text,
  position  integer not null default 0
);

create table if not exists bets (
  id          text primary key,
  voter_id    text not null unique,
  track_id    text not null references tracks(id) on delete cascade,
  project_id  text not null references projects(id) on delete cascade,
  created_at  text not null,
  updated_at  text not null
);

create table if not exists settings (
  id           integer primary key check (id = 1),
  voting_open  integer not null default 0
);

create index if not exists projects_track_idx on projects (track_id, position);
create index if not exists bets_track_idx on bets (track_id);
`;

type Handle = {
  db: DatabaseSync;
  listeners: Set<() => void>;
};

// Next recharge les modules à chaud en développement : sans ce cache global,
// chaque rechargement ouvrirait une connexion de plus sur le même fichier et
// perdrait les abonnés SSE déjà connectés.
const globalRef = globalThis as typeof globalThis & { __voteSqlite?: Handle };

function handle(): Handle {
  if (globalRef.__voteSqlite) return globalRef.__voteSqlite;

  const file = resolve(process.cwd(), process.env.SQLITE_PATH ?? DEFAULT_PATH);
  mkdirSync(dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  db.exec(SCHEMA);

  const created: Handle = { db, listeners: new Set() };
  globalRef.__voteSqlite = created;

  seed(created);
  return created;
}

function seed({ db }: Handle) {
  db.prepare("insert or ignore into settings (id, voting_open) values (1, 0)").run();

  const insert = db.prepare(
    "insert or ignore into tracks (id, key, name, subtitle, position) values (?, ?, ?, ?, ?)"
  );
  for (const track of SEED_TRACKS) {
    insert.run(crypto.randomUUID(), track.key, track.name, track.subtitle, track.position);
  }
}

function notify(h: Handle) {
  for (const listener of h.listeners) {
    try {
      listener();
    } catch {
      // Un écran déconnecté ne doit pas faire échouer l'écriture.
    }
  }
}

export function createSqliteStore(): Store {
  const h = handle();
  const { db } = h;

  const write = <T>(run: () => T): T => {
    const result = run();
    notify(h);
    return result;
  };

  return {
    kind: "sqlite",

    async snapshot(): Promise<Snapshot> {
      const votingOpen =
        ((db.prepare("select voting_open from settings where id = 1").get() as
          | { voting_open: number }
          | undefined)?.voting_open ?? 0) === 1;

      const tracks = db
        .prepare(
          `select id, key, name, subtitle, position, winner_project_id
           from tracks order by position`
        )
        .all() as unknown as Track[];

      const projects = db
        .prepare(
          `select id, track_id, name, team, brand, position
           from projects order by position, name`
        )
        .all() as unknown as Project[];

      const bets = db
        .prepare("select voter_id, track_id, project_id from bets")
        .all() as unknown as Bet[];

      return { votingOpen, tracks, projects, bets };
    },

    async isVotingOpen() {
      const row = db.prepare("select voting_open from settings where id = 1").get() as
        | { voting_open: number }
        | undefined;
      return (row?.voting_open ?? 0) === 1;
    },

    async setVotingOpen(open) {
      write(() =>
        db.prepare("update settings set voting_open = ? where id = 1").run(open ? 1 : 0)
      );
    },

    async projectBelongsToTrack(projectId, trackId) {
      return (
        db
          .prepare("select 1 from projects where id = ? and track_id = ?")
          .get(projectId, trackId) !== undefined
      );
    },

    async placeBet(voterId, trackId, projectId) {
      const now = new Date().toISOString();
      write(() =>
        db
          .prepare(
            `insert into bets (id, voter_id, track_id, project_id, created_at, updated_at)
             values (?, ?, ?, ?, ?, ?)
             on conflict (voter_id) do update set
               track_id = excluded.track_id,
               project_id = excluded.project_id,
               updated_at = excluded.updated_at`
          )
          .run(crypto.randomUUID(), voterId, trackId, projectId, now, now)
      );
    },

    async clearBets() {
      write(() => db.prepare("delete from bets").run());
    },

    async setWinner(trackId, projectId) {
      write(() =>
        db.prepare("update tracks set winner_project_id = ? where id = ?").run(projectId, trackId)
      );
    },

    async updateTrack(id, name, subtitle) {
      write(() =>
        db.prepare("update tracks set name = ?, subtitle = ? where id = ?").run(name, subtitle, id)
      );
    },

    async countProjects(trackId) {
      return (
        db.prepare("select count(*) as n from projects where track_id = ?").get(trackId) as {
          n: number;
        }
      ).n;
    },

    async addProject(trackId, input, position) {
      write(() =>
        db
          .prepare(
            "insert into projects (id, track_id, name, team, brand, position) values (?, ?, ?, ?, ?, ?)"
          )
          .run(crypto.randomUUID(), trackId, input.name, input.team, input.brand, position)
      );
    },

    async updateProject(id, input) {
      write(() =>
        db
          .prepare("update projects set name = ?, team = ?, brand = ? where id = ?")
          .run(input.name, input.team, input.brand, id)
      );
    },

    async deleteProject(id) {
      write(() => db.prepare("delete from projects where id = ?").run(id));
    },

    async replaceProjects(trackId, inputs) {
      write(() => {
        db.exec("begin");
        try {
          db.prepare("delete from projects where track_id = ?").run(trackId);
          const insert = db.prepare(
            "insert into projects (id, track_id, name, team, brand, position) values (?, ?, ?, ?, ?, ?)"
          );
          inputs.forEach((input, index) => {
            insert.run(crypto.randomUUID(), trackId, input.name, input.team, input.brand, index + 1);
          });
          db.exec("commit");
        } catch (cause) {
          db.exec("rollback");
          throw cause;
        }
      });
    },

    subscribe(listener) {
      h.listeners.add(listener);
      return () => h.listeners.delete(listener);
    },
  };
}
