import { NextResponse } from "next/server";

import { adminGuard } from "@/lib/admin-auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Le navigateur de l'admin réduit la photo à 256 px avant l'envoi : ~20 Ko. */
const MAX_BYTES = 400_000;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Reçoit `{ dataUrl: "data:image/jpeg;base64,..." }`, renvoie `{ url }`. */
export async function POST(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const match =
    typeof payload?.dataUrl === "string"
      ? /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(payload.dataUrl)
      : null;

  if (!match || !ALLOWED.has(match[1])) {
    return NextResponse.json({ error: "Image JPEG, PNG ou WebP attendue." }, { status: 400 });
  }
  if ((match[2].length * 3) / 4 > MAX_BYTES) {
    return NextResponse.json({ error: "Photo trop lourde." }, { status: 413 });
  }

  try {
    const id = await (await getStore()).savePhoto(match[1], match[2]);
    return NextResponse.json({ ok: true, url: `/api/photo/${id}` });
  } catch {
    return NextResponse.json({ error: "Impossible d'enregistrer la photo." }, { status: 503 });
  }
}
