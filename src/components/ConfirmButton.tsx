"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Deux temps plutôt qu'une boîte de dialogue : l'organisateur agit devant une
 * salle, il doit voir l'effet annoncé sans que l'écran projeté se couvre d'un
 * modal. Le bouton retombe seul au bout de quatre secondes.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
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
      className={armed ? "btn btn-solid" : "btn"}
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
