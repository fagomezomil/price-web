"use client";
/* ============================================================
   agregar-lista.tsx — botón "+ mi lista" (alta/baja por EAN).
   ============================================================ */
import { useEffect, useState } from "react";

import { addToList, enLista, EVT, getLista, removeFromList } from "@/lib/lista";

export function AgregarLista({ ean }: { ean: string }) {
  const [items, setItems] = useState<{ ean: string; cantidad: number }[]>([]);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const sync = () => {
      setItems(getLista());
      setListo(true);
    };
    sync();
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);

  const dentro = enLista(ean, items);
  return (
    <button
      type="button"
      className="chip"
      disabled={!listo}
      onClick={() => (dentro ? removeFromList(ean) : addToList(ean))}
      style={dentro ? { background: "var(--ink)", color: "var(--yel)" } : undefined}
    >
      {dentro ? "− en mi lista" : "+ mi lista"}
    </button>
  );
}
