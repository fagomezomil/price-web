/* ============================================================
   POST /api/auth/salir — borra la sesión (cookies), redirect /
   ============================================================ */
import { NextResponse, type NextRequest } from "next/server";

import { createSs } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const ss = await createSs();
  await ss.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
