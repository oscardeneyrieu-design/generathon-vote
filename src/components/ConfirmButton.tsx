"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Confirmation en deux temps plutôt qu'une boîte de dialogue : l'organisateur
 * agit devant une salle, il doit voir l'effet annoncé sans qu'un modal
 * recouvre l'écran. Le bouton se désarme seul au bout de quatre secondes.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
  variant = "outline",
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  variant?: "outline" | "gold";
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function disarm() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setArmed(false);
  }

  return (
    <button
      type="button"
      className={`btn ${armed ? "btn-danger" : variant === "gold" ? "btn-gold" : "btn-outline"}`}
      disabled={disabled}
      onBlur={disarm}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 4000);
          return;
        }
        disarm();
        onConfirm();
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
