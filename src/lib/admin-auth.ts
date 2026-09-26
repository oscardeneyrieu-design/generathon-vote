import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "pv_admin";

function adminCode(): string {
  const code = process.env.ADMIN_CODE;
  if (!code || code.length < 4) {
    throw new Error("ADMIN_CODE manquant ou trop court (4 caractères minimum).");
  }
  return code;
}

/**
 * Jeton de session admin. Le code lui-même n'est jamais posé en cookie : on
 * stocke un HMAC dont la clé EST le code, donc le jeton n'est forgeable que
 * par quelqu'un qui connaît déjà le code, et changer ADMIN_CODE invalide
 * toutes les sessions ouvertes.
 */
function tokenFor(code: string): string {
  return createHmac("sha256", code).update("public-vote-admin-v1").digest("hex");
}

export function isValidCode(candidate: string): boolean {
  const expected = Buffer.from(adminCode(), "utf8");
  const given = Buffer.from(candidate, "utf8");
  // timingSafeEqual exige des longueurs égales : on compare d'abord un HMAC
  // de chaque côté pour ne pas divulguer la longueur du code par le timing.
  const a = createHmac("sha256", "len").update(expected).digest();
  const b = createHmac("sha256", "len").update(given).digest();
  return timingSafeEqual(a, b);
}

export function sessionToken(): string {
  return tokenFor(adminCode());
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return false;

  const expected = Buffer.from(sessionToken(), "hex");
  let given: Buffer;
  try {
    given = Buffer.from(token, "hex");
  } catch {
    return false;
  }
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}
