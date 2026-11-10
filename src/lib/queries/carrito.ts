/* ============================================================
   queries/carrito.ts — ranking de sucursales para la "mi lista".
   1 query acotada (dt + eans de la lista + provincia) y el resto en TS:
   el ranking con faltantes valorados por vecino (D3) es lógica de app.
   ============================================================ */
import type { ItemCarrito, RankingSucursal } from "@/types";

import { cadenaDe } from "@/lib/cadenas";
import { duckRows } from "@/lib/duck";

import { SQL_PRECIO_EFECTIVO } from "./precios";

interface FilaCarrito {
  comercio_id: string;
  bandera: string;
  sucursal_id: string;
  sucursal_nombre: string;
  localidad: string;
  ean: string;
  descripcion: string;
  precio_efectivo: number;
}

/** Ranking por TOTAL + detalle de items + eans sin data en la zona. */
export async function rankingSucursales(
  items: ItemCarrito[],
  zona: string | undefined,
  dt: string,
): Promise<{ ranking: RankingSucursal[]; sin_data: string[] }> {
  if (!items.length) return { ranking: [], sin_data: [] };
  const cantidades = new Map(items.map((i) => [i.ean, i.cantidad]));
  const eans = items.map((i) => i.ean);

  // $1 = dt, $2.. = eans, último = zona (si hay)
  const params: unknown[] = [dt, ...eans];
  const pl = eans.map((_, i) => `$${i + 2}`);
  let where = `WHERE dt = $1 AND ean IN (${pl.join(", ")})`;
  if (zona) {
    where += ` AND provincia = $${params.length + 1}`;
    params.push(zona);
  }

  const rows = (await duckRows(
    // arg_min: 1 fila por (sucursal, ean) al precio más barato (por si hay banderas duplicadas)
    `SELECT comercio_id, bandera, sucursal_id, sucursal_nombre, localidad, ean,
            arg_min(descripcion, precio_efectivo) AS descripcion,
            min(precio_efectivo) AS precio_efectivo
     FROM (SELECT comercio_id, bandera, sucursal_id, sucursal_nombre, localidad, ean, descripcion,
                  ${SQL_PRECIO_EFECTIVO} AS precio_efectivo
           FROM v_precio_curado ${where})
     GROUP BY comercio_id, bandera, sucursal_id, sucursal_nombre, localidad, ean`,
    params,
  )) as unknown as FilaCarrito[];

  // por ean: mejor precio en la zona (para valuar faltantes)
  const mejorPorEan = new Map<string, FilaCarrito>();
  for (const r of rows) {
    const prev = mejorPorEan.get(r.ean);
    if (!prev || r.precio_efectivo < prev.precio_efectivo) mejorPorEan.set(r.ean, r);
  }

  type Acum = Omit<RankingSucursal, "items" | "faltantes" | "total_items"> & {
    cubiertos: Set<string>;
    items: RankingSucursal["items"];
  };
  const sucursales = new Map<string, Acum>();
  for (const r of rows) {
    let s = sucursales.get(r.sucursal_id);
    if (!s) {
      s = {
        sucursal_id: r.sucursal_id,
        sucursal_nombre: r.sucursal_nombre,
        cadena: cadenaDe(r.comercio_id, r.bandera),
        localidad: r.localidad,
        cubre: 0,
        cubiertos: new Set(),
        items: [],
        total: 0,
      };
      sucursales.set(r.sucursal_id, s);
    }
    s.cubiertos.add(r.ean);
    s.items.push({
      ean: r.ean,
      descripcion: String(r.descripcion ?? ""),
      cantidad: cantidades.get(r.ean) ?? 1,
      precio: r.precio_efectivo,
    });
    s.total += r.precio_efectivo * (cantidades.get(r.ean) ?? 1);
  }

  // descripción por EAN (de la primera fila leída)
  const descPorEan = new Map<string, string>();
  for (const r of rows) {
    if (!descPorEan.has(r.ean)) descPorEan.set(r.ean, String(r.descripcion ?? ""));
  }

  const out: RankingSucursal[] = [];
  for (const s of sucursales.values()) {
    const faltantes: RankingSucursal["faltantes"] = [];
    for (const it of items) {
      if (s.cubiertos.has(it.ean)) continue;
      const vecino = mejorPorEan.get(it.ean);
      faltantes.push({
        ean: it.ean,
        descripcion_canonica: descPorEan.get(it.ean) ?? "",
        precio_vecino: vecino?.precio_efectivo ?? null,
        sucursal_vecina: vecino ? cadenaDe(vecino.comercio_id, vecino.bandera) : null,
        cadena_vecina: vecino ? cadenaDe(vecino.comercio_id, vecino.bandera) : null,
        distancia_vecino: null,
      });
    }
    out.push({
      sucursal_id: s.sucursal_id,
      sucursal_nombre: s.sucursal_nombre,
      cadena: s.cadena,
      localidad: s.localidad,
      cubre: s.cubiertos.size,
      total_items: items.length,
      items: s.items.sort((a, b) => a.descripcion.localeCompare(b.descripcion)),
      total: Math.round(s.total * 100) / 100,
      faltantes,
    });
  }
  out.sort((a, b) => (b.cubre - a.cubre) || (a.total - b.total));

  // EANs de la lista que NADIE de la zona informa hoy
  const leidos = new Set(rows.map((r) => r.ean));
  const sinData = items.filter((i) => !leidos.has(i.ean)).map((i) => i.ean);

  return { ranking: out, sin_data: sinData };
}
