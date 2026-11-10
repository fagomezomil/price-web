import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ultimoDt } from "@/lib/duck";
import { rankingSucursales } from "@/lib/queries/carrito";

const schema = z.object({
  items: z
    .array(
      z.object({
        ean: z.string().trim().regex(/^\d{8,14}$/, "EAN inválido"),
        cantidad: z.number().int().min(1).max(99).default(1),
      }),
    )
    .min(1)
    .max(50),
  zona: z.string().regex(/^AR-[A-Z]$/).optional(),
});

/** POST /api/carrito — {items:[{ean,cantidad}], zona} -> {ranking, sin_data} */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "carrito inválido", detail: z.treeifyError(parsed.error) }, { status: 400 });
  }
  const { items, zona } = parsed.data;
  const dt = await ultimoDt();
  if (!dt) return NextResponse.json({ error: "sin data todavía", dt: null }, { status: 503 });
  const { ranking, sin_data } = await rankingSucursales(items, zona, dt);
  return NextResponse.json({ dt, ranking, sin_data }, { headers: { "cache-control": "no-store" } });
}
