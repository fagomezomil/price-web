/* ============================================================
   POST /api/cron/alertas { secret } — cruza alertas activas vs
   los precios del último día (DuckDB) y notifica por Resend.
   Lo llama el cron diario DESPUÉS del revalidate (curado listo).
   Nota: Resend free sin dominio verificado ⇒ solo llega al
   correo del owner (suficiente para MVP; en F6 se verifica el
   dominio y RESEND_FROM sale alertas@tubonito.com.ar).
   ============================================================ */
import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

import { env } from "@/env";
import { duckRows, ultimoDt } from "@/lib/duck";
import { sa } from "@/lib/supabase/server";
import { fmtPrecio } from "@/lib/format";

/** No re-notificar el mismo hit si ya avisamos hace poco. */
const GAP_NOTIFICACION_MS = 72 * 24 * 3600 * 1000;

interface FilaAlerta {
  id: number;
  user_id: string;
  ean: string;
  tipo: "meta" | "baja";
  precio_meta: number | null;
  provincia: string | null;
  last_notified_at: string | null;
}

const SITE = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
const FROM = env.RESEND_FROM ?? "REMITO <onboarding@resend.dev>";

function htmlAlerta({
  descripcion,
  precioMeta,
  precioHoy,
  ean,
}: {
  descripcion: string;
  precioMeta: number;
  precioHoy: number | null;
  ean: string;
}) {
  return `
  <div style="font-family:JetBrains Mono,Arial,monospace;max-width:560px;margin:0 auto;border:2px solid #111;padding:0">
    <div style="background:#ffe600;padding:14px 18px;border-bottom:2px solid #111">
      <b style="font-size:15px;letter-spacing:.08em">REMITO.COM.AR — ALERTA DE PRECIO</b>
    </div>
    <div style="padding:18px">
      <p style="margin:0 0 14px;font-size:14px">El precio que esperaste llegó 👇</p>
      <p style="margin:0 0 6px;font-size:16px"><b>${descripcion}</b></p>
      <p style="margin:0 0 14px;font-size:13px;color:#555">EAN ${ean}</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#555">el objetivo era</td><td style="text-align:right"><b>${fmtPrecio(precioMeta)}</b></td></tr>
        <tr><td style="padding:6px 0;color:#555">hoy está a</td>
            <td style="text-align:right;font-size:18px"><b>${precioHoy ? fmtPrecio(precioHoy) : "—"}</b></td></tr>
      </table>
      <p style="margin:18px 0">
        <a href="${SITE}/producto/${ean}" style="background:#ffe600;border:2px solid #111;padding:10px 16px;text-decoration:none;font-weight:800;color:#111;display:inline-block">VER POR SUCURSAL →</a>
      </p>
      <p style="margin:0;font-size:11px;color:#888">data SEPA (oficial) del último relevamiento. Para desuscribirte: ${SITE}/cuenta</p>
    </div>
  </div>`;
}

export async function POST(req: NextRequest) {
  const { secret } = (await req.json().catch(() => ({}))) as { secret?: string };
  if (!env.REVALIDATE_SECRET || secret !== env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!env.RESEND_KEY) {
    return NextResponse.json({ error: "sin RESEND_KEY en env" }, { status: 422 });
  }

  const dt = await ultimoDt();
  if (!dt) return NextResponse.json({ error: "sin data en duckdb" }, { status: 503 });

  const admin = sa();

  // 1. alertas activas + emails del user (admin bypassea RLS)
  const { data: alertasBrutas, error: errAlertas } = await admin
    .from("alertas")
    .select("id, user_id, ean, tipo, precio_meta, provincia, last_notified_at")
    .eq("activa", true);
  if (errAlertas) {
    return NextResponse.json({ error: errAlertas.message }, { status: 500 });
  }
  const alertas = (alertasBrutas ?? []) as unknown as FilaAlerta[];
  const soloMeta = alertas.filter((a) => a.tipo === "meta" && a.precio_meta != null);

  if (soloMeta.length === 0) {
    return NextResponse.json({ ok: true, activas: 0, disparadas: 0 });
  }

  const { data: usersRes } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const emails = new Map<string, string>();
  for (const u of usersRes?.users ?? []) if (u.email) emails.set(u.id, u.email);

  // 2. precios de hoy: nacional + por provincia (una query por bloque)
  const eansUnicos = [...new Set(soloMeta.map((a) => a.ean))];
  const eanIn = `(${eansUnicos.map(() => "?").join(", ")})`;
  const MEJOR = "min(COALESCE(CASE WHEN promo1 > 0 AND promo1 < precio_lista THEN promo1 END, precio_lista))";

  const [nac, prov] = await Promise.all([
    duckRows(
      `SELECT ean, ${MEJOR} AS mejor, count(DISTINCT sucursal_id) AS suc
       FROM v_precio_curado WHERE CAST(dt AS VARCHAR) = ? AND ean IN ${eanIn}
       GROUP BY ean`,
      [dt, ...eansUnicos],
    ),
    duckRows(
      `SELECT ean, provincia, ${MEJOR} AS mejor
       FROM v_precio_curado WHERE CAST(dt AS VARCHAR) = ? AND provincia IS NOT NULL
         AND ean IN ${eanIn}
       GROUP BY ean, provincia`,
      [dt, ...eansUnicos],
    ),
  ]);

  const precioNac = new Map<string, { mejor: number; suc: number }>();
  for (const f of nac) {
    precioNac.set(String(f.ean), { mejor: Number(f.mejor), suc: Number(f.suc ?? 0) });
  }
  const precioProv = new Map<string, number>();
  for (const f of prov) {
    if (f.mejor != null) precioProv.set(`${f.ean}|${f.provincia}`, Number(f.mejor));
  }

  const precioDe = (a: FilaAlerta): number | null =>
    a.provincia ? (precioProv.get(`${a.ean}|${a.provincia}`) ?? precioNac.get(a.ean)?.mejor ?? null) : (precioNac.get(a.ean)?.mejor ?? null);

  // 3. disparar: mejor < meta y respetando el gap
  const ahora = Date.now();
  const disparadas = soloMeta.filter((a) => {
    const hoy = precioDe(a);
    if (hoy == null || hoy >= (a.precio_meta ?? 0)) return false;
    if (a.last_notified_at && ahora - Date.parse(a.last_notified_at) < GAP_NOTIFICACION_MS) {
      return false;
    }
    return true;
  });

  if (disparadas.length === 0) {
    return NextResponse.json({ ok: true, dt, activas: soloMeta.length, disparadas: 0 });
  }

  // 4. una sola por user con todas sus alertas
  const porUser = new Map<string, FilaAlerta[]>();
  for (const a of disparadas) {
    const arr = porUser.get(a.user_id) ?? [];
    arr.push(a);
    porUser.set(a.user_id, arr);
  }

  const etiquetas = await duckRows(
    `SELECT ean, max(descripcion) AS descripcion
     FROM v_precio_curado WHERE CAST(dt AS VARCHAR) = ? AND ean IN ${eanIn}
     GROUP BY ean`,
    [dt, ...eansUnicos],
  );
  const descPor = new Map<string, string>(
    etiquetas.map((f) => [String(f.ean), String(f.descripcion ?? "")]),
  );

  const resend = new Resend(env.RESEND_KEY);
  let enviados = 0;
  const idsOk: number[] = [];
  const errores: string[] = [];

  for (const [userId, listaDeAlertas] of porUser) {
    const email = emails.get(userId);
    if (!email) continue;

    const html = listaDeAlertas
      .map((a) =>
        htmlAlerta({
          descripcion: descPor.get(a.ean) || `EAN ${a.ean}`,
          precioMeta: Number(a.precio_meta),
          precioHoy: precioDe(a),
          ean: a.ean,
        }),
      )
      .join("");
    const unica = listaDeAlertas.length === 1;

    const { error } = await resend.emails.send({
      from: FROM,
      to: email,
      subject: unica
        ? `📉 ${descPor.get(listaDeAlertas[0].ean) || "tu producto"} bajó al precio que esperabas`
        : `📉 ${listaDeAlertas.length} productos pegaron tu precio objetivo`,
      html,
    });

    if (error) {
      errores.push(`${email}: ${error.message}`);
      continue;
    }
    enviados += 1;
    idsOk.push(...listaDeAlertas.map((a) => a.id));
  }

  // 5. last_notified_at (id por id — el .in() en cadena envenena el genérico)
  for (const id of idsOk) {
    const { error } = await admin
      .from("alertas")
      .update({ last_notified_at: new Date().toISOString() })
      .eq("id", id);
    if (error) errores.push(`update id ${id}: ${error.message}`);
  }

  return NextResponse.json({
    ok: errores.length === 0,
    dt,
    activas: soloMeta.length,
    disparadas: disparadas.length,
    enviados,
    errores,
  });
}
