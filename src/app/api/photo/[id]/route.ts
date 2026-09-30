import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sert la photo d'un membre. Une photo remplacée reçoit un nouvel id, donc
 * une URL donnée ne change jamais : le navigateur peut la garder en cache
 * indéfiniment, et les téléphones ne la téléchargent qu'une fois.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[\w-]{8,64}$/.test(id)) return new Response(null, { status: 404 });

  try {
    const photo = await (await getStore()).getPhoto(id);
    if (!photo) return new Response(null, { status: 404 });

    return new Response(Buffer.from(photo.data, "base64"), {
      headers: {
        "content-type": photo.mime,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
