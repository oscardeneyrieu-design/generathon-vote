import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import type { Bet, Project, Track } from "@/lib/types";
import type { ProjectInput, Snapshot, Store } from "./types";

/** Toute erreur Postgres remonte en exception : les routes les traduisent en 503. */
function unwrap<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export function createSupabaseStore(): Store {
  const db = getAdminClient();

  return {
    kind: "supabase",

    async snapshot(): Promise<Snapshot> {
      const [settingsRes, tracksRes, projectsRes, betsRes] = await Promise.all([
        db.from("settings").select("voting_open").eq("id", 1).maybeSingle(),
        db
          .from("tracks")
          .select("id, key, name, subtitle, position, winner_project_id")
          .order("position"),
        db
          .from("projects")
          .select("id, track_id, name, team, brand, position")
          .order("position")
          .order("name"),
        db.from("bets").select("voter_id, track_id, project_id"),
      ]);

      const settings = unwrap(settingsRes) as { voting_open: boolean } | null;

      return {
        votingOpen: settings?.voting_open ?? false,
        tracks: (unwrap(tracksRes) as Track[]) ?? [],
        projects: (unwrap(projectsRes) as Project[]) ?? [],
        bets: (unwrap(betsRes) as Bet[]) ?? [],
      };
    },

    async isVotingOpen() {
      const data = unwrap(
        await db.from("settings").select("voting_open").eq("id", 1).maybeSingle()
      ) as { voting_open: boolean } | null;
      return data?.voting_open ?? false;
    },

    async setVotingOpen(open) {
      unwrap(await db.from("settings").update({ voting_open: open }).eq("id", 1));
    },

    async projectBelongsToTrack(projectId, trackId) {
      const data = unwrap(
        await db
          .from("projects")
          .select("id")
          .eq("id", projectId)
          .eq("track_id", trackId)
          .maybeSingle()
      );
      return data !== null;
    },

    async placeBet(voterId, trackId, projectId) {
      unwrap(
        await db.from("bets").upsert(
          {
            voter_id: voterId,
            track_id: trackId,
            project_id: projectId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "voter_id" }
        )
      );
    },

    async clearBets() {
      unwrap(await db.from("bets").delete().not("voter_id", "is", null));
    },

    async setWinner(trackId, projectId) {
      unwrap(await db.from("tracks").update({ winner_project_id: projectId }).eq("id", trackId));
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

    async addProject(trackId, input, position) {
      unwrap(await db.from("projects").insert({ track_id: trackId, ...input, position }));
    },

    async updateProject(id, input) {
      unwrap(await db.from("projects").update(input).eq("id", id));
    },

    async deleteProject(id) {
      unwrap(await db.from("projects").delete().eq("id", id));
    },

    async replaceProjects(trackId, inputs) {
      unwrap(await db.from("projects").delete().eq("track_id", trackId));
      if (inputs.length === 0) return;
      unwrap(
        await db
          .from("projects")
          .insert(inputs.map((input, index) => ({ track_id: trackId, ...input, position: index + 1 })))
      );
    },
  };
}
