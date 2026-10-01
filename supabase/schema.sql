-- Generathon public vote — schéma complet.
-- À coller tel quel dans Supabase > SQL Editor > New query > Run.
-- Idempotent : peut être rejoué sans casser une base existante.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table if not exists public.tracks (
  id                uuid primary key default gen_random_uuid(),
  key               text not null unique,
  name              text not null check (length(btrim(name)) between 1 and 80),
  subtitle          text not null default '',
  position          integer not null default 0,
  -- Le podium de CETTE track. Il n'existe aucun classement au-dessus des
  -- trois tracks : chacune a son 1er, son 2e et son 3e.
  first_project_id  uuid,
  second_project_id uuid,
  third_project_id  uuid
);

-- Montée de version depuis le schéma à gagnant unique.
do $$ begin
  alter table public.tracks add column first_project_id uuid;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table public.tracks add column second_project_id uuid;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table public.tracks add column third_project_id uuid;
exception when duplicate_column then null; end $$;
do $$ begin
  update public.tracks set first_project_id = winner_project_id
  where first_project_id is null and winner_project_id is not null;
  alter table public.tracks drop column winner_project_id;
exception when undefined_column then null; end $$;

create table if not exists public.projects (
  id        uuid primary key default gen_random_uuid(),
  track_id  uuid not null references public.tracks(id) on delete cascade,
  name      text not null check (length(btrim(name)) between 1 and 80),
  team      text not null default '',
  brand     text,
  position  integer not null default 0
);

-- Déclarées après projects : les deux tables se référencent mutuellement.
do $$ begin
  alter table public.tracks add constraint tracks_first_fk
    foreign key (first_project_id) references public.projects(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.tracks add constraint tracks_second_fk
    foreign key (second_project_id) references public.projects(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.tracks add constraint tracks_third_fk
    foreign key (third_project_id) references public.projects(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 80),
  -- `/api/photo/<id>` pour une photo envoyée depuis l'admin.
  photo_url  text,
  position   integer not null default 0
);

-- Photos des membres en base64, servies par /api/photo/<id> avec la clé
-- service_role. Aucune policy : illisible directement depuis le navigateur,
-- et jamais incluse dans l'état relu à chaque pari (trop lourd).
create table if not exists public.photos (
  id         uuid primary key default gen_random_uuid(),
  mime       text not null,
  data       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bets (
  id          uuid primary key default gen_random_uuid(),
  -- Un pari par appareil ET par track (contrainte plus bas) : on peut
  -- désigner un gagnant dans chaque track, et changer d'avis dans une track
  -- met à jour la ligne existante.
  voter_id    text not null check (length(voter_id) between 8 and 64),
  track_id    uuid not null references public.tracks(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Points à gagner, figés au moment du pari : popularité du projet à cet
  -- instant × bonus de rapidité. Calculés par le serveur, jamais par le client.
  points      integer not null default 0
);

do $$ begin
  alter table public.bets add column points integer not null default 0;
exception when duplicate_column then null; end $$;

-- Journal append-only : une ligne par pari posé ou modifié. C'est la seule
-- source de l'évolution des cotes, `bets` n'ayant que l'état courant.
-- Pas de clé étrangère vers projects : supprimer un projet ne doit pas
-- réécrire l'histoire, sinon le graphe se déforme rétroactivement.
create table if not exists public.bet_events (
  seq         bigserial primary key,
  track_id    uuid not null,
  project_id  uuid not null,
  voter_id    text not null,
  created_at  timestamptz not null default now()
);

-- Montée de version depuis « un seul pari au total » : on retire l'unicité
-- sur voter_id seul et on la pose sur (voter_id, track_id).
alter table public.bets drop constraint if exists bets_voter_id_key;
create unique index if not exists bets_voter_track_idx on public.bets (voter_id, track_id);

-- Paris posés avant l'existence du journal : on les y reporte, sinon la
-- courbe resterait plate alors que le classement bouge. Rejouable sans doublon.
insert into public.bet_events (track_id, project_id, voter_id, created_at)
select b.track_id, b.project_id, b.voter_id, b.updated_at from public.bets b
where not exists (select 1 from public.bet_events e
                  where e.voter_id = b.voter_id and e.track_id = b.track_id)
order by b.updated_at;

create table if not exists public.settings (
  id          integer primary key default 1 check (id = 1),
  voting_open boolean not null default false,
  -- Clôture automatique : les paris se ferment seuls à cette heure.
  closes_at   timestamptz,
  -- Ouverture des paris. De opens_at à closes_at, un pari perd peu à peu de
  -- sa valeur : 1 à l'ouverture, 0,2 à la clôture.
  opens_at    timestamptz
);

do $$ begin
  alter table public.settings add column closes_at timestamptz;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table public.settings add column opens_at timestamptz;
exception when duplicate_column then null; end $$;

create index if not exists projects_track_idx on public.projects (track_id, position);
create index if not exists members_project_idx on public.members (project_id, position);
create index if not exists bets_track_idx on public.bets (track_id);
create index if not exists bet_events_seq_idx on public.bet_events (seq desc);

-- ------------------------------------------------------------------- RLS
-- Lecture publique, écriture nulle. Tous les écrits passent par les Route
-- Handlers Next.js avec la clé service_role, qui contourne les RLS : le
-- navigateur ne peut donc ni parier deux fois, ni clôturer le vote, ni
-- annoncer un podium, même en rejouant les requêtes avec la clé anon.

alter table public.tracks     enable row level security;
alter table public.projects   enable row level security;
alter table public.members    enable row level security;
alter table public.photos     enable row level security;
alter table public.bets       enable row level security;
alter table public.bet_events enable row level security;
alter table public.settings   enable row level security;

drop policy if exists "tracks readable by anyone"     on public.tracks;
drop policy if exists "projects readable by anyone"   on public.projects;
drop policy if exists "members readable by anyone"    on public.members;
drop policy if exists "bets readable by anyone"       on public.bets;
drop policy if exists "bet_events readable by anyone" on public.bet_events;
drop policy if exists "settings readable by anyone"   on public.settings;

create policy "tracks readable by anyone"     on public.tracks     for select using (true);
create policy "projects readable by anyone"   on public.projects   for select using (true);
create policy "members readable by anyone"    on public.members    for select using (true);
create policy "bets readable by anyone"       on public.bets       for select using (true);
create policy "bet_events readable by anyone" on public.bet_events for select using (true);
create policy "settings readable by anyone"   on public.settings   for select using (true);

-- -------------------------------------------------------------- realtime
-- replica identity full : sans ça, les évènements DELETE ne portent pas les
-- colonnes filtrantes et les écrans passent à côté.

alter table public.bets       replica identity full;
alter table public.bet_events replica identity full;
alter table public.projects   replica identity full;
alter table public.members    replica identity full;
alter table public.tracks     replica identity full;
alter table public.settings   replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.bets;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.bet_events;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.projects;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.members;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.tracks;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.settings;
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------- seed
-- Le vote démarre fermé : on l'ouvre depuis /admin quand tout est prêt.

insert into public.settings (id, voting_open) values (1, false)
on conflict (id) do nothing;

insert into public.tracks (key, name, subtitle, position) values
  ('short-film', 'Three Minutes to Move',
   'Short film — Limbic narration, not just a voice-over.', 1),
  ('animation',  'Animate the Shift',
   'Animation video — The future of the 2D animated sitcom.', 2),
  ('ad',         'Sell the Feeling',
   'Ad — The best emotional ad for one of the six brands.', 3)
on conflict (key) do nothing;

-- Les 36 projets s'ajoutent depuis /admin : ils n'existent qu'une fois les
-- équipes formées, et leurs noms changent jusqu'à la deadline.
