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
  winner_project_id uuid
);

create table if not exists public.projects (
  id        uuid primary key default gen_random_uuid(),
  track_id  uuid not null references public.tracks(id) on delete cascade,
  name      text not null check (length(btrim(name)) between 1 and 80),
  team      text not null default '',
  brand     text,
  position  integer not null default 0
);

-- Déclarée après projects : les deux tables se référencent mutuellement.
do $$
begin
  alter table public.tracks
    add constraint tracks_winner_fk
    foreign key (winner_project_id) references public.projects(id) on delete set null;
exception when duplicate_object then null;
end $$;

create table if not exists public.bets (
  id          uuid primary key default gen_random_uuid(),
  -- Un pari par appareil, track comprise : changer d'avis met à jour la
  -- ligne existante au lieu d'en créer une seconde.
  voter_id    text not null unique check (length(voter_id) between 8 and 64),
  track_id    uuid not null references public.tracks(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.settings (
  id          integer primary key default 1 check (id = 1),
  voting_open boolean not null default false
);

create index if not exists projects_track_idx on public.projects (track_id, position);
create index if not exists bets_track_idx on public.bets (track_id);

-- ------------------------------------------------------------------- RLS
-- Lecture publique, écriture nulle. Tous les écrits passent par les Route
-- Handlers Next.js avec la clé service_role, qui contourne les RLS : le
-- navigateur ne peut donc ni parier deux fois, ni clôturer le vote, même en
-- rejouant les requêtes à la main avec la clé anon.

alter table public.tracks   enable row level security;
alter table public.projects enable row level security;
alter table public.bets     enable row level security;
alter table public.settings enable row level security;

drop policy if exists "tracks readable by anyone"   on public.tracks;
drop policy if exists "projects readable by anyone" on public.projects;
drop policy if exists "bets readable by anyone"     on public.bets;
drop policy if exists "settings readable by anyone" on public.settings;

create policy "tracks readable by anyone"   on public.tracks   for select using (true);
create policy "projects readable by anyone" on public.projects for select using (true);
create policy "bets readable by anyone"     on public.bets     for select using (true);
create policy "settings readable by anyone" on public.settings for select using (true);

-- -------------------------------------------------------------- realtime
-- replica identity full : sans ça, les évènements DELETE ne portent pas les
-- colonnes filtrantes et les écrans passent à côté.

alter table public.bets     replica identity full;
alter table public.projects replica identity full;
alter table public.tracks   replica identity full;
alter table public.settings replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.bets;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.projects;
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
