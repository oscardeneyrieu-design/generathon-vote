"use client";

import { getBrowserClient } from "@/lib/supabase/browser";
import type { Bet, BetEvent, Member, Project, Track } from "@/lib/types";
import type { LiveSource, Snapshot } from "./types";

const WATCHED = ["bets", "bet_events", "projects", "members", "tracks", "settings"] as const;

/** Aligné sur la limite serveur : au-delà, le graphe ne gagne plus rien. */
const MAX_EVENTS = 5_000;

/**
 * Lecture directe depuis Supabase, sans passer par nos propres routes. À
 * plusieurs centaines d'écrans qui relisent l'état à chaque pari, faire
 * transiter le trafic par une fonction Vercel coûterait des dizaines de
 * milliers d'appels ; Postgres encaisse ça nativement.
 */
export function createSupabaseSource(): LiveSource {
  return {
    async fetchSnapshot(): Promise<Snapshot> {
      const supabase = getBrowserClient();

      const [settingsRes, tracksRes, projectsRes, membersRes, betsRes, eventsRes] = await Promise.all([
        supabase.from("settings").select("voting_open, closes_at").eq("id", 1).maybeSingle(),
        supabase
          .from("tracks")
          .select(
            "id, key, name, subtitle, position, first_project_id, second_project_id, third_project_id"
          )
          .order("position"),
        supabase
          .from("projects")
          .select("id, track_id, name, team, brand, position")
          .order("position")
          .order("name"),
        supabase
          .from("members")
          .select("id, project_id, name, photo_url, position")
          .order("position")
          .order("name"),
        supabase.from("bets").select("voter_id, track_id, project_id"),
        supabase
          .from("bet_events")
          .select("seq, track_id, project_id, voter_id, created_at")
          .order("seq", { ascending: false })
          .limit(MAX_EVENTS),
      ]);

      for (const result of [settingsRes, tracksRes, projectsRes, membersRes, betsRes, eventsRes]) {
        if (result.error) throw new Error(result.error.message);
      }

      const settings = settingsRes.data as { voting_open: boolean; closes_at: string | null } | null;

      return {
        votingOpen: settings?.voting_open ?? false,
        closesAt: settings?.closes_at ?? null,
        tracks: (tracksRes.data as Track[]) ?? [],
        projects: (projectsRes.data as Project[]) ?? [],
        members: (membersRes.data as Member[]) ?? [],
        bets: (betsRes.data as Bet[]) ?? [],
        events: ((eventsRes.data as BetEvent[]) ?? []).reverse(),
      };
    },

    subscribe({ onChange, onStatus }) {
      const supabase = getBrowserClient();
      let channel = supabase.channel("public-vote-live");

      for (const table of WATCHED) {
        channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
      }

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          onStatus("live");
          onChange(); // rattrape ce qui s'est passé pendant la connexion
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          onStatus("reconnecting");
        }
      });

      return () => {
        void supabase.removeChannel(channel);
      };
    },
  };
}
