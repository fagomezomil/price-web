/* ============================================================
   /buscar — resultados (estado en URL ?q=). La isla hace el
   fetch a /api/search con la zona del user (localStorage).
   Runtime (searchParams + DuckDB) dentro de <Suspense> → streamea.
   ============================================================ */
import type { Metadata } from "next";
import { Suspense } from "react";

import { Buscador } from "@/components/buscador";
import { BuscarIsla } from "@/components/buscar-isla";
import { Pie } from "@/components/sitio";

import { ultimoDt } from "@/lib/duck";
import { fmtDt } from "@/lib/format";

export const metadata: Metadata = {
  title: "Buscar",
  robots: { index: false },
};

async function Cuerpo({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const dt = await ultimoDt();

  return (
    <>
      {/* búsqueda fija arriba (con chips solo si el user todavía no escribió) */}
      <div className="wrap" style={{ paddingTop: 24 }}>
        <Buscador chips={!q} />
        {dt && (
          <p className="kpiline" style={{ marginTop: 10 }}>
            data servida del <b>{fmtDt(dt)}</b> — trazabilidad completa en cada resultado
          </p>
        )}
      </div>

      <div className="wrap" style={{ paddingBottom: 30 }}>
        <BuscarIsla />
        <Pie dt={dt ?? ""} />
      </div>
    </>
  );
}

export default function BuscarPage({
  searchParams,
}: PageProps<"/buscar">) {
  return (
    <Suspense
      fallback={
        <div className="wrap" style={{ paddingTop: 24 }}>
          <p className="kpiline">abriendo el buscador…</p>
        </div>
      }
    >
      <Cuerpo searchParams={searchParams} />
    </Suspense>
  );
}
