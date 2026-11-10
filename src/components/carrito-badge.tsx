"use client";
/* ============================================================
   carrito-badge.tsx — contador de "mi lista" en la barra.
   Sync via evento 'remito:lista' (lib/lista).
   ============================================================ */
import { useEffect, useState } from "react";

import { EVT, getLista } from "@/lib/lista";

export function CarritoBadge() {
  const [n, setN] = useState(0);

  useEffect(() => {
    const sync = () => setN(getLista().length);
    sync();
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);

  return <b>{n}</b>;
}
