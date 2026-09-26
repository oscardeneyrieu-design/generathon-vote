"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Client navigateur, clé anon. Lecture seule : les RLS n'accordent que le
 * SELECT, tout écrit passe par /api. Instancié une seule fois pour qu'un
 * seul socket realtime serve toutes les souscriptions de la page.
 */
export function getBrowserClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY manquants. " +
        "Copie .env.local.example vers .env.local et relance le serveur."
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false },
    // 200 votants qui changent d'avis, c'est au pire quelques dizaines
    // d'évènements par seconde ; on plafonne pour ne pas saturer le socket.
    realtime: { params: { eventsPerSecond: 20 } },
  });

  return client;
}
