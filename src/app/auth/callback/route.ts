/* ============================================================
   /auth/callback — Supabase detecta el token del magic link en
   el query y se lo cambia por una sesión de cookies. Es la
   emailRedirectTo de signInWithOtp.
   Creado con cookies() de next/headers (mutables en route
   handlers), que ya setea las cookies de sesión.
   ============================================================ */
import { NextResponse, type NextRequest } from "next/server";

import { createSs } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const codigo = searchParams.get("code");
  // en flujo con error, Supabase redirige con error_description
  const error = searchParams.get("error_description");
  // redirect: volver al contexto del login (PDP, buscar) — solo paths internos
  const bruto = searchParams.get("redirect");
  const redirect = bruto && bruto.startsWith("/") && !bruto.startsWith("//") ? bruto : null;

  if (codigo) {
    const ss = await createSs();
    const { error: err } = await ss.auth.exchangeCodeForSession(codigo);
    if (!err) return NextResponse.redirect(`${origin}${redirect ?? "/cuenta"}`);
  }

  const motivo = encodeURIComponent(`no pudimos validar el link${error ? ` (${error})` : ""}`);
  return NextResponse.redirect(`${origin}/entrar?error=${motivo}`);
}
