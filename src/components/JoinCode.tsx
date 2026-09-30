"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * QR code + adresse lisible. Les deux : au fond d'une salle le QR ne
 * s'accroche pas toujours, et une adresse courte se tape.
 */
export function JoinCode({ size = 120 }: { size?: number }) {
  const [origin, setOrigin] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = window.location.origin;
    setOrigin(url);

    QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 0,
      scale: 8,
      color: { dark: "#171717", light: "#ffffff" },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, []);

  return (
    <div className="flex items-center gap-5">
      {/* Fond blanc même en mode sombre : un QR inversé se scanne mal. */}
      <div className="shrink-0 rounded-xl bg-white p-2.5">
        {dataUrl ? (
          <img src={dataUrl} alt="" width={size} height={size} style={{ imageRendering: "pixelated" }} />
        ) : (
          <div className="animate-pulse rounded bg-black/10" style={{ width: size, height: size }} />
        )}
      </div>
      <div>
        <div className="label">Scanne pour parier</div>
        <div className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
          {origin?.replace(/^https?:\/\//, "") ?? "…"}
        </div>
      </div>
    </div>
  );
}
