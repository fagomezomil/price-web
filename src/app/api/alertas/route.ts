/* ============================================================
   POST /api/alertas — { ean, tipo: 'meta', precio_meta, provincia? }.
   DELETE /api/alertas?id=N — desuscribir propia.
   La sesión manda: supabase-js con cookies del user (RLS).
   ============================================================ */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createSs } from "@/lib/supabase/server";

const alta = z.object({
  ean: z.string().regex(/^\d{13}$/),
  tipo: z.literal("meta"), // 'baja' queda para cuando haya UI de histórico-por-item
  precio_meta: z.number().positive().max(10_000_000),
  provincia: z
    .string()
    .regex(/^AR-[A-Z]$/)
    .nullable()
    .optional(),
});

export async function POST(request: NextRequest) {
  const parsed = alta.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "cuerpo inválido" }, { status: 400 });

  const ss = await createSs();
  const { data: sesion } = await ss.auth.getUser();
  if (!sesion.user) return NextResponse.json({ error: "no estás entrado" }, { status: 401 });

  const { ean, precio_meta, provincia } = parsed.data;
  // upsert por (user, ean) activa: si ya tenía una, reemplaza el precio objetivo
  const { data: previas } = await ss
    .from("alertas")
    .select("id")
    .eq("user_id", sesion.user.id)
    .eq("ean", ean)
    .eq("activa", true);

  if (previas && previas.length > 0) {
    const { error } = await ss
      .from("alertas")
      .update({ tipo: "meta", precio_meta, provincia: provincia ?? null })
      .eq("id", previas[0].id);
    if (error) return NextResponse.json({ error: "no se pudo actualizar" }, { status: 500 });
  } else {
    const { error } = await ss.from("alertas").insert({
      user_id: sesion.user.id,
      ean,
      tipo: "meta",
      precio_meta,
      provincia: provincia ?? null,
    });
    if (error) return NextResponse.json({ error: "no se pudo crear" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0 || id > Number.MAX_SAFE_INTEGER) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const ss = await createSs();
  const { data: sesion } = await ss.auth.getUser();
  if (!sesion.user) return NextResponse.json({ error: "no estás entrado" }, { status: 401 });

  // RLS limita a las propias; el update en vez de delete conserva el historial
  const { error } = await ss.from("alertas").update({ activa: false }).eq("id", id);
  if (error) return NextResponse.json({ error: "no se pudo desactivar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
