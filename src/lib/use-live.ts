"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { computeSeries } from "./history";
import { getLiveSource } from "./live";
import { computeBoard } from "./standings";
import { getVoterId } from "./voter";
import { isBettingOpen } from "./voting";
import type { Bet, BetEvent, Board, Member, Project, ProjectSeries, Track } from "./types";

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
  /** Paris réellement ouverts : interrupteur admin ET heure de clôture pas passée. */
  bettingOpen: boolean;
  /** Heure de clôture automatique (ISO), ou `null`. */
  closesAt: string | null;
  /** Interrupteur brut de l'admin (utile à la console admin). */
  votingOpen: boolean;
  tracks: Track[];
  projects: Project[];
  members: Member[];
  board: Board;
  /** Évolution des cotes par track, courbes triées cote la plus faible en tête. */
  series: Map<string, ProjectSeries[]>;
  voterId: string | null;
  pendingProjectId: string | null;
  placeBet: (trackId: string, projectId: string) => Promise<void>;
  dismissError: () => void;
};

export function useLive(): LiveState {
  const [votingOpen, setVotingOpen] = useState(false);
  const [closesAt, setClosesAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tracks, setTracks] = useState<Track[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [events, setEvents] = useState<BetEvent[]>([]);
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
      setClosesAt(snapshot.closesAt);
      setNow(Date.now());
      setTracks(snapshot.tracks);
      setProjects(snapshot.projects);
      setMembers(snapshot.members);
      setBets(snapshot.bets);
      setEvents(snapshot.events);
      setError(null);
      setStatus("live");
    } catch (cause) {
      if (!aliveRef.current) return;
      setError(cause instanceof Error ? cause.message : "Connexion impossible.");
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

  // À l'heure de clôture, tous les écrans basculent d'eux-mêmes, sans
  // attendre une notification : un minuteur se déclenche pile à l'échéance.
  useEffect(() => {
    if (!votingOpen || !closesAt) return;
    const remaining = Date.parse(closesAt) - Date.now();
    if (Number.isNaN(remaining) || remaining <= 0) return;
    // setTimeout plafonne à ~24,8 jours ; au-delà on revérifie plus tard.
    const timer = setTimeout(() => setNow(Date.now()), Math.min(remaining + 50, 2_000_000_000));
    return () => clearTimeout(timer);
  }, [closesAt, now, votingOpen]);

  const bettingOpen = isBettingOpen(votingOpen, closesAt, now);

  const placeBet = useCallback(
    async (trackId: string, projectId: string) => {
      if (!voterId) return;
      if (!isBettingOpen(votingOpen, closesAt, Date.now())) {
        setNow(Date.now());
        return;
      }

      setPendingProjectId(projectId);

      // Bascule immédiate : le retour doit précéder la latence réseau, la
      // source de vérité reprend la main au prochain refresh.
      setBets((current) => [
        ...current.filter((bet) => !(bet.voter_id === voterId && bet.track_id === trackId)),
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
          throw new Error(body?.error ?? "Pari refusé.");
        }
        setError(null);
      } catch (cause) {
        if (!aliveRef.current) return;
        setError(cause instanceof Error ? cause.message : "Pari refusé.");
        void refresh(); // annule l'optimisme
      } finally {
        if (aliveRef.current) setPendingProjectId(null);
      }
    },
    [closesAt, refresh, voterId, votingOpen]
  );

  const board = useMemo(
    () => computeBoard(tracks, projects, bets, voterId),
    [bets, projects, tracks, voterId]
  );

  // Le rejeu du journal est plus coûteux que le reste : on ne le refait que
  // quand le journal change réellement, pas à chaque rendu.
  const series = useMemo(
    () => computeSeries(tracks, projects, events, voterId),
    [events, projects, tracks, voterId]
  );

  return {
    status,
    error,
    bettingOpen,
    closesAt,
    votingOpen,
    tracks,
    projects,
    members,
    board,
    series,
    voterId,
    pendingProjectId,
    placeBet,
    dismissError: useCallback(() => setError(null), []),
  };
}
