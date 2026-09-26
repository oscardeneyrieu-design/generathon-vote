import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Un ping régulier empêche proxys et navigateurs de fermer un flux inactif. */
const PING_MS = 25_000;

/**
 * Notifications temps réel du mode SQLite. En mode Supabase la route répond
 * 204 : les navigateurs y ont leur propre canal, et un flux SSE persistant
 * ne survivrait de toute façon pas au modèle serverless de Vercel.
 */
export async function GET(request: Request) {
  const store = await getStore();

  if (!store.subscribe) {
    return new Response(null, { status: 204 });
  }

  const subscribe = store.subscribe.bind(store);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;

      const send = (data: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          open = false;
        }
      };

      const unsubscribe = subscribe(() => send("change"));
      const ping = setInterval(() => send("ping"), PING_MS);

      send("ready");

      const close = () => {
        if (!open) return;
        open = false;
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // déjà fermé par le client
        }
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Empêche le tampon d'un éventuel reverse proxy d'avaler les évènements.
      "x-accel-buffering": "no",
    },
  });
}
