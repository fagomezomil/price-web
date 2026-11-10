import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { mapaImagenes } from "@/lib/img";
import { getSearchProvider } from "@/lib/search/provider";

const schema = z.object({
  q: z.string().trim().min(2).max(120),
  /** provincia ISO opcional (AR-T) */
  zona: z.string().regex(/^AR-[A-Z]$/).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

/** GET /api/search?q=&zona=&limit= — provider según env (meili|sql). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const parsed = schema.safeParse(Object.fromEntries(sp));
  if (!parsed.success) {
    return NextResponse.json({ error: "q inválida", detail: z.treeifyError(parsed.error) }, { status: 400 });
  }
  const { q, zona, limit } = parsed.data;
  try {
    const resp = await getSearchProvider().search(q, zona, limit);
    /* enriquecimiento de imágenes (bucket R2): provider-agnostic, para cards de resultados */
    const imgs = await mapaImagenes(resp.hits.map((h) => h.ean));
    for (const h of resp.hits) {
      const u = imgs.get(h.ean);
      if (u) h.imagen_url = u;
    }
    return NextResponse.json(resp, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error desconocido";
    return NextResponse.json({ error: "búsqueda falló", detail: msg }, { status: 500 });
  }
}
