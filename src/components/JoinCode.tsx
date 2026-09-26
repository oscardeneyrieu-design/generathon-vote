"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * QR + URL lisible. Les deux, pas l'un ou l'autre : au fond d'une salle le
 * QR ne s'accroche pas toujours, et une URL courte se tape.
 */
export function JoinCode({ size = 132 }: { size?: number }) {
  const [origin, setOrigin] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = window.location.origin;
    setOrigin(url);

    void QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 0,
      scale: 8,
      color: { dark: "#282828", light: "#f7f7f7" },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, []);

  const label = origin?.replace(/^https?:\/\//, "") ?? "…";

  return (
    <div className="flex items-center gap-4">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt=""
          width={size}
          height={size}
          style={{ width: size, height: size, imageRendering: "pixelated" }}
        />
      ) : (
        <div className="skeleton" style={{ width: size, height: size }} />
      )}
      <div>
        <div className="t-label text-[color:var(--color-ink-muted)]">Scan to bet</div>
        <div
          className="font-extrabold leading-none"
          style={{
            fontSize: "clamp(1.1rem, 2vw, 1.75rem)",
            fontStretch: "88%",
            letterSpacing: "-0.02em",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}
