/* ============================================================
   middleware.ts — refresh de sesión Supabase. Ruta pública.
   @supabase/ssr pattern: copiar cookies refrescadas a la request
   y a la response. En Server Components las cookies quedan
   inmutables, así que el rollo del refresh vive acá.
   ============================================================ */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";

const URL = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON;

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // build sin credenciales todavia: passthrough de cookies, sin refresh
  if (!URL || !ANON) return response;

  const ss = createServerClient(URL, ANON, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (todas) => {
        for (const { name, value, options } of todas) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser fuerza el refresh si el access token venció
  await ss.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // todo salvo assets estáticos y API de files internos
    "/((?!_next/static|_next/image|favicon.ico|hero-bg.jpg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
