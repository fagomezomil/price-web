/* ============================================================
   POST /api/favoritos — { ean, on: boolean } alta/baja.
   PUT  /api/favoritos — { ean, sucursal_pref } setea sucursal preferida.
   La sesión manda: supabase-js con cookies del user (RLS).
   ============================================================ */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createSs } from "@/lib/supabase/server";

const toggle = z.object({
  ean: z.string().regex(/^\d{13}$/),
  on: z.boolean(),
});
const pref = z.object({
  ean: z.string().regex(/^\d{13}$/),
  sucursal_pref: z.string().max(40).nullable(),
});

export async function POST(request: NextRequest) {
  const parsed = toggle.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "cuerpo inválido" }, { status: 400 });

  const ss = await createSs();
  const { data: sesion } = await ss.auth.getUser();
  if (!sesion.user) return NextResponse.json({ error: "no estás entrado" }, { status: 401 });

  const { ean, on } = parsed.data;
  if (on) {
    const { error } = await ss.from("favoritos").upsert({ user_id: sesion.user.id, ean });
    if (error) return NextResponse.json({ error: "no se pudo guardar" }, { status: 500 });
  } else {
    const { error } = await ss
      .from("favoritos")
      .delete()
      .eq("user_id", sesion.user.id)
      .eq("ean", ean);
    if (error) return NextResponse.json({ error: "no se pudo quitar" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(request: NextRequest) {
  const parsed = pref.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "cuerpo inválido" }, { status: 400 });

  const ss = await createSs();
  const { data: sesion } = await ss.auth.getUser();
  if (!sesion.user) return NextResponse.json({ error: "no estás entrado" }, { status: 401 });

  const { ean, sucursal_pref } = parsed.data;
  const { error } = await ss
    .from("favoritos")
    .update({ sucursal_pref })
    .eq("user_id", sesion.user.id)
    .eq("ean", ean);
  if (error) return NextResponse.json({ error: "no se pudo actualizar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
