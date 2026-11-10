/* ============================================================
   /carrito — "mi lista" comparador (client pura sobre /api/carrito).
   Ranking por TOTAL REAL con faltantes valorados por el vecino.
   Runtime (DuckDB) dentro de <Suspense> → streamea.
   ============================================================ */
import type { Metadata } from "next";
import { Suspense } from "react";

import { CarritoIsla } from "@/components/carrito-isla";
import { Pie } from "@/components/sitio";

import { ultimoDt } from "@/lib/duck";
import { fmtDt } from "@/lib/format";

export const metadata: Metadata = {
  title: "Mi lista",
  robots: { index: false },
};

async function Cuerpo() {
  const dt = await ultimoDt();

  return (
    <div className="wrap" style={{ paddingBottom: 30 }}>
      {dt && (
        <p className="kpiline" style={{ marginTop: 18 }}>
          <b>lista</b> <span className="sep">·</span> comparada contra la data del{" "}
          <b>{fmtDt(dt)}</b>
        </p>
      )}
      <CarritoIsla />
      <Pie dt={dt ?? ""} />
    </div>
  );
}

export default function CarritoPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap" style={{ paddingTop: 24 }}>
          <p className="kpiline">abriendo tu lista…</p>
        </div>
      }
    >
      <Cuerpo />
    </Suspense>
  );
}
