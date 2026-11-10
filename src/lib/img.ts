/* ============================================================
   lib/img.ts — imágenes de producto (bucket R2 `precios-img`).
   dim_imagen (ean → key) vive en precios.duckdb; la URL se arma
   acá en un solo lugar. r2.dev = dev (rate-limited): en F6 se le
   pega custom domain al bucket y se cambia IMG_BASE.
   ============================================================ */
import { duckRows } from "@/lib/duck";

/** Public Development URL (ON 09/11). No es secreto (objeto público). */
export const IMG_BASE = "https://pub-c478db7ccd01488da4952346e75618c5.r2.dev";

export function urlImagen(key: string): string {
  return `${IMG_BASE}/${key.replace(/^\/+/, "")}`;
}

/** ean → URL R2 (batched). Mapa vacío si no hay dim_imagen aún (copias viejas). */
export async function mapaImagenes(eans: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const limpios = [...new Set(eans.filter(Boolean))];
  if (!limpios.length) return out;
  try {
    const rows = await duckRows(
      `SELECT ean, key FROM dim_imagen WHERE ean IN (${limpios.map(() => "?").join(",")})`,
      limpios,
    );
    for (const r of rows) {
      if (r.key) out.set(String(r.ean), urlImagen(String(r.key)));
    }
  } catch {
    /* tabla ausente (duckdb viejo sin dim_imagen) → sin imágenes */
  }
  return out;
}
