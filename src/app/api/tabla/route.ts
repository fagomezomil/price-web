import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ultimoDt } from "@/lib/duck";
import { tablaSucursales } from "@/lib/queries/precios";

const schema = z.object({ ean: z.string().regex(/^\d{8,14}$/) });

/** GET /api/tabla?ean= — tabla nacional de sucursales (isla de resultados/PDP). */
export async function GET(req: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "ean inválido" }, { status: 400 });
  }
  const dt = await ultimoDt();
  if (!dt) {
    return NextResponse.json({ error: "sin data curada aún" }, { status: 503 });
  }
  try {
    const filas = await tablaSucursales(parsed.data.ean, { dt });
    return NextResponse.json({ dt, filas }, { headers: { "cache-control": "public, max-age=300" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error desconocido";
    return NextResponse.json({ error: "tabla falló", detail: msg }, { status: 500 });
  }
}
