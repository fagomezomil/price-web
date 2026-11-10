/* ============================================================
   GET /api/auth/session — para las islas client (Barra, PDP).
   → { user: null } | { user: { email } }. Sin PII extra.
   ============================================================ */
import { NextResponse } from "next/server";

import { createSs } from "@/lib/supabase/server";

export async function GET() {
  const ss = await createSs();
  const { data } = await ss.auth.getUser();
  return NextResponse.json(
    { user: data.user ? { email: data.user.email } : null },
    { headers: { "cache-control": "no-store" } },
  );
}
