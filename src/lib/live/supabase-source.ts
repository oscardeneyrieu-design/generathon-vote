"use client";

import { getBrowserClient } from "@/lib/supabase/browser";
import type { Bet, Project, Track } from "@/lib/types";
import type { LiveSource, Snapshot } from "./types";

const WATCHED = ["bets", "projects", "tracks", "settings"] as const;

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

      const [settingsRes, tracksRes, projectsRes, betsRes] = await Promise.all([
        supabase.from("settings").select("voting_open").eq("id", 1).maybeSingle(),
        supabase
          .from("tracks")
          .select("id, key, name, subtitle, position, winner_project_id")
          .order("position"),
        supabase
          .from("projects")
          .select("id, track_id, name, team, brand, position")
          .order("position")
          .order("name"),
        supabase.from("bets").select("voter_id, track_id, project_id"),
      ]);

      for (const result of [settingsRes, tracksRes, projectsRes, betsRes]) {
        if (result.error) throw new Error(result.error.message);
      }

      const settings = settingsRes.data as { voting_open: boolean } | null;

      return {
        votingOpen: settings?.voting_open ?? false,
        tracks: (tracksRes.data as Track[]) ?? [],
        projects: (projectsRes.data as Project[]) ?? [],
        bets: (betsRes.data as Bet[]) ?? [],
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
