import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import type { Bet, BetEvent, Member, Project, Track } from "@/lib/types";
import type { Podium, Snapshot, Store, Voting } from "./types";

/** Au-delà, on ne garde que les plus récents pour le graphe. */
const MAX_EVENTS = 5_000;

/** Toute erreur Postgres remonte en exception : les routes les traduisent en 503. */
function unwrap<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

/** Identifiant d'une photo stockée ici, d'après son URL publique. */
function photoIdOf(url: string | null | undefined): string | null {
  return url?.startsWith("/api/photo/") ? url.slice("/api/photo/".length).split("?")[0] : null;
}

export function createSupabaseStore(): Store {
  const db = getAdminClient();

  const readVoting = async (): Promise<Voting> => {
    const data = unwrap(
      await db.from("settings").select("voting_open, closes_at").eq("id", 1).maybeSingle()
    ) as { voting_open: boolean; closes_at: string | null } | null;
    return { open: data?.voting_open ?? false, closesAt: data?.closes_at ?? null };
  };

  const deletePhotos = async (urls: Array<string | null>) => {
    const ids = urls.map(photoIdOf).filter((id): id is string => id !== null);
    if (ids.length > 0) unwrap(await db.from("photos").delete().in("id", ids));
  };

  return {
    kind: "supabase",

    async snapshot(): Promise<Snapshot> {
      const [voting, tracksRes, projectsRes, membersRes, betsRes, eventsRes] = await Promise.all([
        readVoting(),
        db
          .from("tracks")
          .select("id, key, name, subtitle, position, first_project_id, second_project_id, third_project_id")
          .order("position"),
        db.from("projects").select("id, track_id, name, team, brand, position").order("position").order("name"),
        db.from("members").select("id, project_id, name, photo_url, position").order("position").order("name"),
        db.from("bets").select("voter_id, track_id, project_id"),
        db
          .from("bet_events")
          .select("seq, track_id, project_id, voter_id, created_at")
          .order("seq", { ascending: false })
          .limit(MAX_EVENTS),
      ]);

      return {
        votingOpen: voting.open,
        closesAt: voting.closesAt,
        tracks: (unwrap(tracksRes) as Track[]) ?? [],
        projects: (unwrap(projectsRes) as Project[]) ?? [],
        members: (unwrap(membersRes) as Member[]) ?? [],
        bets: (unwrap(betsRes) as Bet[]) ?? [],
        events: ((unwrap(eventsRes) as BetEvent[]) ?? []).reverse(),
      };
    },

    getVoting: readVoting,

    async setVoting({ open, closesAt }) {
      unwrap(await db.from("settings").update({ voting_open: open, closes_at: closesAt }).eq("id", 1));
    },

    async projectBelongsToTrack(projectId, trackId) {
      const data = unwrap(
        await db.from("projects").select("id").eq("id", projectId).eq("track_id", trackId).maybeSingle()
      );
      return data !== null;
    },

    async placeBet(voterId, trackId, projectId) {
      unwrap(
        await db.from("bets").upsert(
          { voter_id: voterId, track_id: trackId, project_id: projectId, updated_at: new Date().toISOString() },
          { onConflict: "voter_id,track_id" }
        )
      );
      unwrap(await db.from("bet_events").insert({ track_id: trackId, project_id: projectId, voter_id: voterId }));
    },

    async clearBets() {
      unwrap(await db.from("bets").delete().not("voter_id", "is", null));
      // Le graphe repart de zéro avec les paris.
      unwrap(await db.from("bet_events").delete().gt("seq", 0));
    },

    async setPodium(trackId, podium: Podium) {
      unwrap(
        await db
          .from("tracks")
          .update({
            first_project_id: podium.first,
            second_project_id: podium.second,
            third_project_id: podium.third,
          })
          .eq("id", trackId)
      );
    },

    async updateTrack(id, name, subtitle) {
      unwrap(await db.from("tracks").update({ name, subtitle }).eq("id", id));
    },

    async countProjects(trackId) {
      const { count, error } = await db
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("track_id", trackId);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },

    async addProject(trackId, { name, team, brand }, position) {
      unwrap(await db.from("projects").insert({ track_id: trackId, name, team, brand, position }));
    },

    async updateProject(id, { name, team, brand }) {
      unwrap(await db.from("projects").update({ name, team, brand }).eq("id", id));
    },

    async deleteProject(id) {
      const members = (unwrap(await db.from("members").select("photo_url").eq("project_id", id)) ??
        []) as Array<{ photo_url: string | null }>;
      unwrap(await db.from("projects").delete().eq("id", id)); // membres et paris en cascade
      unwrap(await db.from("bet_events").delete().eq("project_id", id));
      await deletePhotos(members.map((member) => member.photo_url));
    },

    async replaceProjects(trackId, inputs) {
      unwrap(await db.from("projects").delete().eq("track_id", trackId));
      unwrap(await db.from("bet_events").delete().eq("track_id", trackId));
      if (inputs.length === 0) return;

      const created = unwrap(
        await db
          .from("projects")
          .insert(
            inputs.map(({ name, team, brand }, index) => ({ track_id: trackId, name, team, brand, position: index + 1 }))
          )
          .select("id, position")
      ) as Array<{ id: string; position: number }>;

      const members = created.flatMap(({ id, position }) =>
        (inputs[position - 1]?.members ?? []).map((name, index) => ({
          project_id: id,
          name,
          position: index + 1,
        }))
      );
      if (members.length > 0) unwrap(await db.from("members").insert(members));
    },

    async addMember(projectId, name, photoUrl) {
      const { count, error } = await db
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId);
      if (error) throw new Error(error.message);
      unwrap(
        await db.from("members").insert({ project_id: projectId, name, photo_url: photoUrl, position: (count ?? 0) + 1 })
      );
    },

    async updateMember(id, name, photoUrl) {
      const previous = unwrap(await db.from("members").select("photo_url").eq("id", id).maybeSingle()) as {
        photo_url: string | null;
      } | null;
      unwrap(await db.from("members").update({ name, photo_url: photoUrl }).eq("id", id));
      if (previous && previous.photo_url !== photoUrl) await deletePhotos([previous.photo_url]);
    },

    async deleteMember(id) {
      const previous = unwrap(await db.from("members").select("photo_url").eq("id", id).maybeSingle()) as {
        photo_url: string | null;
      } | null;
      unwrap(await db.from("members").delete().eq("id", id));
      await deletePhotos([previous?.photo_url ?? null]);
    },

    async savePhoto(mime, base64) {
      const row = unwrap(await db.from("photos").insert({ mime, data: base64 }).select("id").single()) as {
        id: string;
      };
      return row.id;
    },

    async getPhoto(id) {
      const { data, error } = await db.from("photos").select("mime, data").eq("id", id).maybeSingle();
      if (error) return null;
      return (data as { mime: string; data: string } | null) ?? null;
    },
  };
}
