/* ============================================================
   POST /api/auth/magic-link — { email, redirect? } → envía el
   mail del Supabase con el link. redirect permite volver al
   contexto (ej: la PDP donde se iba a crear la alerta).
   ============================================================ */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createSs } from "@/lib/supabase/server";

const cuerpo = z.object({
  email: z.string().email().max(200),
  redirect: z
    .string()
    .max(200)
    .refine((r) => r.startsWith("/") && !r.startsWith("//"))
    .optional(),
});

export async function POST(request: NextRequest) {
  const parsed = cuerpo.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "email inválido" }, { status: 400 });
  }

  const { email, redirect } = parsed.data;
  const origin = new URL(request.url).origin;
  const ss = await createSs();
  const { error } = await ss.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}` },
  });

  // respuesta misma siempre (no filtrar si el email existe o no)
  if (error) {
    console.error("magic-link:", error.message);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: true });
}
