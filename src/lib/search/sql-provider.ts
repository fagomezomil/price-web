/* Fallback SQL: multi-token LIKE + prefijo EAN. Sin typo tolerance. */
import type { SearchRespuesta } from "@/types";

import { buscarSql } from "@/lib/queries/buscar";

import type { SearchProvider } from "./provider";

/** score heurístico para el badge de trazabilidad (el real lo da Meili). */
function puntaje(q: string, ean: string, desc: string): number {
  const t = q.toLowerCase().trim();
  if (/^\d{8,14}$/.test(t) && ean.startsWith(t)) return 1;
  const toks = t.split(/\s+/).filter((w) => w.length >= 2);
  const d = desc.toLowerCase();
  if (toks.every((w) => d.includes(w))) return toks.length > 1 ? 0.9 : 0.7;
  return 0.5;
}

export class SqlProvider implements SearchProvider {
  readonly nombre = "sql";

  async search(q: string, zona?: string, limit = 30): Promise<SearchRespuesta> {
    const { dt, resultados } = await buscarSql(q, zona, limit);
    return {
      dt,
      hits: resultados.map((r) => ({
        // extras del ResultadoLocal para las cards
        ...r,
        aliases: [] as string[],
        mediana_nacional: null,
        n_cadenas: 0,
        variante: null,
        score: puntaje(q, r.ean, r.descripcion_canonica),
      })),
      total: resultados.length,
    };
  }
}
