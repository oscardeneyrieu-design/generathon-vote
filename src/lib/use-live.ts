"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getLiveSource } from "./live";
import { computeBoard } from "./standings";
import { getVoterId } from "./voter";
import type { Bet, Board, Project, Track } from "./types";

/**
 * Un rafraîchissement au plus toutes les 400 ms. Quand la salle se met à
 * parier en même temps, les notifications arrivent par rafales ; sans ce
 * throttle on repeindrait les classements vingt fois par seconde.
 */
const THROTTLE_MS = 400;

/** Filet de sécurité si le canal meurt sans prévenir (wifi de salle). */
const SAFETY_POLL_MS = 15_000;

export type ConnectionStatus = "loading" | "live" | "reconnecting" | "error";

export type LiveState = {
  status: ConnectionStatus;
  error: string | null;
  votingOpen: boolean;
  tracks: Track[];
  projects: Project[];
  board: Board;
  voterId: string | null;
  pendingProjectId: string | null;
  placeBet: (trackId: string, projectId: string) => Promise<void>;
  dismissError: () => void;
};

export function useLive(): LiveState {
  const [votingOpen, setVotingOpen] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [voterId, setVoterId] = useState<string | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);

  const aliveRef = useRef(true);
  const lastRunRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVoterId(getVoterId());
  }, []);

  /**
   * Relit l'état complet plutôt que d'appliquer des deltas. Les volumes sont
   * minuscules (3 tracks, 36 projets, quelques centaines de paris) et ça
   * élimine toute dérive possible après une coupure réseau.
   */
  const refresh = useCallback(async () => {
    try {
      const snapshot = await getLiveSource().fetchSnapshot();
      if (!aliveRef.current) return;

      setVotingOpen(snapshot.votingOpen);
      setTracks(snapshot.tracks);
      setProjects(snapshot.projects);
      setBets(snapshot.bets);
      setError(null);
      setStatus("live");
    } catch (cause) {
      if (!aliveRef.current) return;
      setError(cause instanceof Error ? cause.message : "Connection failed.");
      setStatus("error");
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    const elapsed = Date.now() - lastRunRef.current;

    if (elapsed >= THROTTLE_MS) {
      lastRunRef.current = Date.now();
      void refresh();
      return;
    }
    if (timerRef.current) return;

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      lastRunRef.current = Date.now();
      void refresh();
    }, THROTTLE_MS - elapsed);
  }, [refresh]);

  useEffect(() => {
    aliveRef.current = true;
    void refresh();

    const unsubscribe = getLiveSource().subscribe({
      onChange: scheduleRefresh,
      onStatus: (transportStatus) => {
        if (!aliveRef.current) return;
        // Une perte de canal ne vide pas l'écran : les chiffres affichés
        // restent les derniers connus, seul l'indicateur change.
        setStatus((current) =>
          transportStatus === "reconnecting"
            ? "reconnecting"
            : current === "error"
              ? current
              : "live"
        );
      },
    });

    const poll = setInterval(scheduleRefresh, SAFETY_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      aliveRef.current = false;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      if (timerRef.current) clearTimeout(timerRef.current);
      unsubscribe();
    };
  }, [refresh, scheduleRefresh]);

  const placeBet = useCallback(
    async (trackId: string, projectId: string) => {
      if (!votingOpen || !voterId) return;

      setPendingProjectId(projectId);

      // Bascule immédiate : le retour doit précéder la latence réseau, la
      // source de vérité reprend la main au prochain refresh.
      setBets((current) => [
        ...current.filter((bet) => bet.voter_id !== voterId),
        { voter_id: voterId, track_id: trackId, project_id: projectId },
      ]);

      try {
        const response = await fetch("/api/bet", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trackId, projectId, voterId }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Bet rejected.");
        }
        setError(null);
      } catch (cause) {
        if (!aliveRef.current) return;
        setError(cause instanceof Error ? cause.message : "Bet rejected.");
        void refresh(); // annule l'optimisme
      } finally {
        if (aliveRef.current) setPendingProjectId(null);
      }
    },
    [refresh, voterId, votingOpen]
  );

  const board = useMemo(
    () => computeBoard(tracks, projects, bets, voterId),
    [bets, projects, tracks, voterId]
  );

  return {
    status,
    error,
    votingOpen,
    tracks,
    projects,
    board,
    voterId,
    pendingProjectId,
    placeBet,
    dismissError: useCallback(() => setError(null), []),
  };
}
