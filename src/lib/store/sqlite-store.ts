import "server-only";

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { SEED_TRACKS } from "@/lib/tracks";
import type { Bet, BetEvent, Member, Project, Track } from "@/lib/types";
import type { Podium, ProjectInput, Snapshot, Store, Voting } from "./types";

const DEFAULT_PATH = ".data/votes.db";

/** Au-delà, on ne garde que les plus récents pour le graphe. */
const MAX_EVENTS = 5_000;

/** Un pari par appareil ET par track. Réutilisé par la migration. */
const BETS_TABLE = `
create table if not exists bets (
  id          text primary key,
  voter_id    text not null,
  track_id    text not null references tracks(id) on delete cascade,
  project_id  text not null references projects(id) on delete cascade,
  created_at  text not null,
  updated_at  text not null,
  unique (voter_id, track_id)
);`;

const SCHEMA = `
pragma journal_mode = WAL;
pragma foreign_keys = ON;

create table if not exists tracks (
  id                text primary key,
  key               text not null unique,
  name              text not null,
  subtitle          text not null default '',
  position          integer not null default 0,
  first_project_id  text,
  second_project_id text,
  third_project_id  text
);

create table if not exists projects (
  id        text primary key,
  track_id  text not null references tracks(id) on delete cascade,
  name      text not null,
  team      text not null default '',
  brand     text,
  position  integer not null default 0
);

create table if not exists members (
  id          text primary key,
  project_id  text not null references projects(id) on delete cascade,
  name        text not null,
  photo_url   text,
  position    integer not null default 0
);

-- Photos des membres, en base64. Servies par /api/photo/<id>, jamais
-- incluses dans l'état lu à chaque pari (trop lourd).
create table if not exists photos (
  id          text primary key,
  mime        text not null,
  data        text not null,
  created_at  text not null
);

${BETS_TABLE}

-- Journal append-only. Pas de clé étrangère vers projects : supprimer un
-- projet ne doit pas réécrire l'histoire, sinon le graphe se déforme
-- rétroactivement.
create table if not exists bet_events (
  seq         integer primary key autoincrement,
  track_id    text not null,
  project_id  text not null,
  voter_id    text not null,
  created_at  text not null
);

create table if not exists settings (
  id           integer primary key check (id = 1),
  voting_open  integer not null default 0,
  closes_at    text
);

create index if not exists projects_track_idx on projects (track_id, position);
create index if not exists members_project_idx on members (project_id, position);
create index if not exists bets_track_idx on bets (track_id);
create index if not exists bet_events_seq_idx on bet_events (seq);
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
  migrate(db);

  const created: Handle = { db, listeners: new Set() };
  globalRef.__voteSqlite = created;

  seed(created);
  return created;
}

const columnsOf = (db: DatabaseSync, table: string) =>
  new Set((db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name));

/**
 * Met à niveau une base créée par une version précédente. `create table if
 * not exists` ne touche pas une table existante, d'où ces rattrapages.
 */
function migrate(db: DatabaseSync) {
  // Podium à trois places (ancienne version : un seul gagnant).
  const trackColumns = columnsOf(db, "tracks");
  for (const column of ["first_project_id", "second_project_id", "third_project_id"]) {
    if (!trackColumns.has(column)) db.exec(`alter table tracks add column ${column} text`);
  }
  if (trackColumns.has("winner_project_id")) {
    db.exec(`update tracks set first_project_id = winner_project_id
             where first_project_id is null and winner_project_id is not null`);
    db.exec("alter table tracks drop column winner_project_id");
  }

  // Clôture programmée.
  if (!columnsOf(db, "settings").has("closes_at")) {
    db.exec("alter table settings add column closes_at text");
  }

  // Un pari par track (ancienne version : un seul pari au total, `voter_id
  // unique`). SQLite ne sait pas retirer une contrainte : on recrée la table.
  const betsSql =
    (db.prepare("select sql from sqlite_master where type = 'table' and name = 'bets'").get() as
      | { sql: string }
      | undefined)?.sql ?? "";
  if (/voter_id\s+text\s+not\s+null\s+unique/i.test(betsSql)) {
    db.exec("begin");
    try {
      db.exec("alter table bets rename to bets_old");
      db.exec(BETS_TABLE);
      db.exec("insert into bets select id, voter_id, track_id, project_id, created_at, updated_at from bets_old");
      db.exec("drop table bets_old");
      db.exec("create index if not exists bets_track_idx on bets (track_id)");
      db.exec("commit");
    } catch (cause) {
      db.exec("rollback");
      throw cause;
    }
  }

  // Paris posés avant l'existence du journal : sans ligne au journal, la
  // courbe resterait plate alors que le classement bouge.
  db.exec(`insert into bet_events (track_id, project_id, voter_id, created_at)
           select b.track_id, b.project_id, b.voter_id, b.updated_at from bets b
           where not exists (select 1 from bet_events e
                             where e.voter_id = b.voter_id and e.track_id = b.track_id)
           order by b.updated_at`);
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

/** Identifiant d'une photo stockée ici, d'après son URL publique. */
function photoIdOf(url: string | null | undefined): string | null {
  return url?.startsWith("/api/photo/") ? url.slice("/api/photo/".length).split("?")[0] : null;
}

export function createSqliteStore(): Store {
  const h = handle();
  const { db } = h;

  const write = <T>(run: () => T): T => {
    const result = run();
    notify(h);
    return result;
  };

  const transaction = (run: () => void) => {
    db.exec("begin");
    try {
      run();
      db.exec("commit");
    } catch (cause) {
      db.exec("rollback");
      throw cause;
    }
  };

  const readVoting = (): Voting => {
    const row = db.prepare("select voting_open, closes_at from settings where id = 1").get() as
      | { voting_open: number; closes_at: string | null }
      | undefined;
    return { open: (row?.voting_open ?? 0) === 1, closesAt: row?.closes_at ?? null };
  };

  const insertMember = db.prepare(
    "insert into members (id, project_id, name, photo_url, position) values (?, ?, ?, ?, ?)"
  );

  return {
    kind: "sqlite",

    async snapshot(): Promise<Snapshot> {
      const voting = readVoting();

      const tracks = db
        .prepare(
          `select id, key, name, subtitle, position,
                  first_project_id, second_project_id, third_project_id
           from tracks order by position`
        )
        .all() as unknown as Track[];

      const projects = db
        .prepare("select id, track_id, name, team, brand, position from projects order by position, name")
        .all() as unknown as Project[];

      const members = db
        .prepare("select id, project_id, name, photo_url, position from members order by position, name")
        .all() as unknown as Member[];

      const bets = db
        .prepare("select voter_id, track_id, project_id from bets")
        .all() as unknown as Bet[];

      const events = db
        .prepare(
          `select seq, track_id, project_id, voter_id from bet_events
           order by seq desc limit ${MAX_EVENTS}`
        )
        .all() as unknown as BetEvent[];

      return {
        votingOpen: voting.open,
        closesAt: voting.closesAt,
        tracks,
        projects,
        members,
        bets,
        events: events.reverse(),
      };
    },

    async getVoting() {
      return readVoting();
    },

    async setVoting({ open, closesAt }) {
      write(() =>
        db
          .prepare("update settings set voting_open = ?, closes_at = ? where id = 1")
          .run(open ? 1 : 0, closesAt)
      );
    },

    async projectBelongsToTrack(projectId, trackId) {
      return (
        db.prepare("select 1 from projects where id = ? and track_id = ?").get(projectId, trackId) !==
        undefined
      );
    },

    async placeBet(voterId, trackId, projectId) {
      const now = new Date().toISOString();
      write(() => {
        db.prepare(
          `insert into bets (id, voter_id, track_id, project_id, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?)
           on conflict (voter_id, track_id) do update set
             project_id = excluded.project_id,
             updated_at = excluded.updated_at`
        ).run(crypto.randomUUID(), voterId, trackId, projectId, now, now);

        db.prepare(
          "insert into bet_events (track_id, project_id, voter_id, created_at) values (?, ?, ?, ?)"
        ).run(trackId, projectId, voterId, now);
      });
    },

    async clearBets() {
      write(() => {
        db.prepare("delete from bets").run();
        // Le graphe repart de zéro avec les paris.
        db.prepare("delete from bet_events").run();
      });
    },

    async setPodium(trackId, podium: Podium) {
      write(() =>
        db
          .prepare(
            `update tracks set first_project_id = ?, second_project_id = ?, third_project_id = ?
             where id = ?`
          )
          .run(podium.first, podium.second, podium.third, trackId)
      );
    },

    async updateTrack(id, name, subtitle) {
      write(() => db.prepare("update tracks set name = ?, subtitle = ? where id = ?").run(name, subtitle, id));
    },

    async countProjects(trackId) {
      return (db.prepare("select count(*) as n from projects where track_id = ?").get(trackId) as { n: number }).n;
    },

    async addProject(trackId, input, position) {
      write(() =>
        db
          .prepare("insert into projects (id, track_id, name, team, brand, position) values (?, ?, ?, ?, ?, ?)")
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
      write(() =>
        transaction(() => {
          const photos = db
            .prepare("select photo_url from members where project_id = ?")
            .all(id) as Array<{ photo_url: string | null }>;
          for (const { photo_url } of photos) {
            const photoId = photoIdOf(photo_url);
            if (photoId) db.prepare("delete from photos where id = ?").run(photoId);
          }
          db.prepare("delete from projects where id = ?").run(id); // membres et paris en cascade
          db.prepare("delete from bet_events where project_id = ?").run(id);
          // Pas de clé étrangère sur le podium en SQLite : on libère la place
          // à la main, comme le fait `on delete set null` côté Postgres.
          db.prepare(
            `update tracks set
               first_project_id  = nullif(first_project_id, ?),
               second_project_id = nullif(second_project_id, ?),
               third_project_id  = nullif(third_project_id, ?)`
          ).run(id, id, id);
        })
      );
    },

    async replaceProjects(trackId, inputs) {
      write(() =>
        transaction(() => {
          db.prepare("delete from projects where track_id = ?").run(trackId);
          db.prepare("delete from bet_events where track_id = ?").run(trackId);
          db.prepare(
            `update tracks set first_project_id = null, second_project_id = null,
             third_project_id = null where id = ?`
          ).run(trackId);
          const insert = db.prepare(
            "insert into projects (id, track_id, name, team, brand, position) values (?, ?, ?, ?, ?, ?)"
          );
          inputs.forEach((input, index) => {
            const projectId = crypto.randomUUID();
            insert.run(projectId, trackId, input.name, input.team, input.brand, index + 1);
            (input.members ?? []).forEach((name, memberIndex) => {
              insertMember.run(crypto.randomUUID(), projectId, name, null, memberIndex + 1);
            });
          });
        })
      );
    },

    async addMember(projectId, name, photoUrl) {
      const { n } = db
        .prepare("select count(*) as n from members where project_id = ?")
        .get(projectId) as { n: number };
      write(() => insertMember.run(crypto.randomUUID(), projectId, name, photoUrl, n + 1));
    },

    async updateMember(id, name, photoUrl) {
      write(() => {
        const previous = db.prepare("select photo_url from members where id = ?").get(id) as
          | { photo_url: string | null }
          | undefined;
        db.prepare("update members set name = ?, photo_url = ? where id = ?").run(name, photoUrl, id);
        const oldPhoto = photoIdOf(previous?.photo_url);
        if (oldPhoto && previous?.photo_url !== photoUrl) {
          db.prepare("delete from photos where id = ?").run(oldPhoto);
        }
      });
    },

    async deleteMember(id) {
      write(() => {
        const previous = db.prepare("select photo_url from members where id = ?").get(id) as
          | { photo_url: string | null }
          | undefined;
        db.prepare("delete from members where id = ?").run(id);
        const oldPhoto = photoIdOf(previous?.photo_url);
        if (oldPhoto) db.prepare("delete from photos where id = ?").run(oldPhoto);
      });
    },

    async savePhoto(mime, base64) {
      const id = crypto.randomUUID();
      db.prepare("insert into photos (id, mime, data, created_at) values (?, ?, ?, ?)").run(
        id,
        mime,
        base64,
        new Date().toISOString()
      );
      return id;
    },

    async getPhoto(id) {
      return (
        (db.prepare("select mime, data from photos where id = ?").get(id) as
          | { mime: string; data: string }
          | undefined) ?? null
      );
    },

    subscribe(listener) {
      h.listeners.add(listener);
      return () => h.listeners.delete(listener);
    },
  };
}
