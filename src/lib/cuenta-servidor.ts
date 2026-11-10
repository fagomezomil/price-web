/* ============================================================
   cuenta-servidor.ts — helpers server de /cuenta: labeling de
   EANs con la última lectura (DuckDB, dt del ciclo con hive
   pruning SIEMPRE). Solo server (duck.ts es server-only).
   ============================================================ */
import { duckRows, ultimoDt } from "@/lib/duck";

export interface EtiquetaEan {
  descripcion: string;
  precio: number | null;
}

/** Descripción + mejor precio del día por EAN (con dt fijo → hive pruning). */
export async function consultarEtiquetas(
  eans: string[],
): Promise<Record<string, EtiquetaEan>> {
  if (eans.length === 0) return {};
  const dt = await ultimoDt();
  if (!dt) return {};

  const lista = eans.slice(0, 200); // cap defensivo
  const sql = `
    SELECT ean,
           max(descripcion) AS descripcion,
           min(COALESCE(CASE WHEN promo1 > 0 AND promo1 < precio_lista THEN promo1 END, precio_lista)) AS mejor
    FROM v_precio_curado
    WHERE CAST(dt AS VARCHAR) = ? AND ean IN (${lista.map(() => "?").join(", ")})
    GROUP BY ean
  `;
  const filas = await duckRows(sql, [dt, ...lista]);
  const out: Record<string, EtiquetaEan> = {};
  for (const f of filas) {
    out[String(f.ean)] = {
      descripcion: String(f.descripcion ?? ""),
      precio: f.mejor == null ? null : Number(f.mejor),
    };
  }
  // EANs que no salieron (se bajaron de la canasta): etiqueta vacía
  for (const e of eans) out[e] ??= { descripcion: "", precio: null };
  return out;
}
