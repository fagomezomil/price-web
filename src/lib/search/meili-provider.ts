/* ============================================================
   search/meili-provider.ts — cliente Meili vía fetch (0 dependencias).
   Regla del checklist: toda respuesta fetch se drena (res.json() en
   todos los paths, error incl.). Índice: 'precios' (docs = Producto).
   ============================================================ */
import { env } from "@/env";
import type { SearchRespuesta } from "@/types";

import type { SearchProvider } from "./provider";

const INDEX = "precios";

export class MeiliProvider implements SearchProvider {
  readonly nombre = "meili";

  private async call(path: string, init: RequestInit): Promise<Response> {
    const res = await fetch(`${env.MEILI_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(env.MEILI_KEY ? { Authorization: `Bearer ${env.MEILI_KEY}` } : {}),
      },
    });
    // drena SIEMPRE el body (undici no libera la conexión por GC)
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      res.body?.cancel?.().catch(() => {});
      throw new Error(`Meili ${res.status} ${path}: ${body.slice(0, 300)}`);
    }
    return res;
  }

  async search(q: string, zona?: string, limit = 30): Promise<SearchRespuesta> {
    if (!env.MEILI_URL) throw new Error("PRECIO_SEARCH=meili pero MEILI_URL vacía");
    const res = await this.call(`/indexes/${INDEX}/search`, {
      method: "POST",
      body: JSON.stringify({ q, limit, attributesToHighlight: [] }),
    });
    const json = (await res.json()) as {
      hits: Array<Record<string, unknown>>;
      estimatedTotalHits: number;
    };
    // el dt lo da el doc con mediana más reciente; el index loader lo guarda en settings
    const dt = json.hits.find((h) => h.dt)?.dt as string | undefined;
    return {
      dt: dt ?? "",
      hits: json.hits.map((h) => ({
        ean: String(h.ean),
        descripcion_canonica: String(h.descripcion_canonica),
        aliases: Array.isArray(h.aliases) ? (h.aliases as string[]) : [],
        marca: String(h.marca ?? ""),
        cantidad: String(h.cantidad ?? ""),
        unidad: String(h.unidad ?? ""),
        imagen_url: (h.imagen_url as string | null) ?? null,
        mediana_nacional: (h.mediana_nacional as number | null) ?? null,
        n_cadenas: Number(h.n_cadenas ?? 0),
        variante: (h.variante as string | null) ?? null,
        ...h,
        score: Number(h._rankingScore ?? h.score ?? 0),
      })) as SearchRespuesta["hits"],
      total: json.estimatedTotalHits ?? json.hits.length,
    };
  }
}
