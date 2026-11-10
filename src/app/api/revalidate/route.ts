import { type NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { env } from "@/env";
import { TAG_PRECIOS } from "@/lib/duck";

/**
 * POST /api/revalidate — lo golpea el cron de sync del VPS cuando hay dt nuevo.
 * body: {secret}. Revalida la tag 'precios' + las estáticas que la usan.
 */
export async function POST(req: NextRequest) {
  const { secret } = (await req.json().catch(() => ({}))) as { secret?: string };
  if (!env.REVALIDATE_SECRET || secret !== env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  revalidateTag(TAG_PRECIOS, "max");
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
