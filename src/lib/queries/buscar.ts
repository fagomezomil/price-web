/* ============================================================
   queries/buscar.ts — buscador modo 'sql' (dev / plan B sin Meili).
   Degradación documentada: LIKE sobre descripcion canónica + prefijo EAN,
   SIN typo tolerance. Prod usa el provider Meili (F2).
   Agrupado por EAN: descripción modal + mejor precio + rango de zona.
   ============================================================ */
import type { ResultadoLocal } from "@/types";

import { cadenaDe } from "@/lib/cadenas";
import { duckRows, ultimoDt } from "@/lib/duck";

import { mediana, SQL_PRECIO_EFECTIVO } from "./precios";

/** normalización leve: lowercase + sin acentos. */
const norm = (q: string) =>
  q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/** tokens del query (hasta 6 — más tokens = menor recall). */
function tokens(q: string): string[] {
  const t = norm(q)
    .split(/[\s,.]+/)
    .filter((w) => w.length >= 2)
    .slice(0, 6);
  return t.length ? t : [];
}

/**
 * Busca por EAN/descripción el último dt curado. Sin zona: nacional.
 * La query solo toca los parquets de UN dt (pruning por hive partition).
 * @param q query libre (texto o EAN crudo)
 */
export async function buscarSql(
  q: string,
  zona?: string,
  limit = 30,
): Promise<{ dt: string; resultados: ResultadoLocal[] }> {
  const query = norm(q);
  if (query.length < 2) return { dt: "", resultados: [] };

  const dt = await ultimoDt();
  if (!dt) return { dt: "", resultados: [] };

  // EAN crudo -> prefijo; texto -> todos los tokens deben aparecer (LIKE %tok%)
  const esEan = /^\d{8,14}$/.test(query);
  const toks = esEan ? [] : tokens(query);
  if (!esEan && !toks.length) return { dt: "", resultados: [] };

  // $1 dt; $2.. matchers; zona al final
  const params: unknown[] = [dt];
  let where = "AND (";
  if (esEan) {
    params.push(`${query}%`);
    where += `ean LIKE $${params.length}`;
  } else {
    where += toks
      .map((t) => {
        params.push(`%${t}%`);
        return `lower(descripcion) LIKE $${params.length}`;
      })
      .join(" AND ");
  }
  where += ")";
  if (zona) {
    where += ` AND provincia = $${params.length + 1}`;
    params.push(zona);
  }

  // 1 fila por (ean, sucursal) del último dt, luego agregado por EAN en SQL
  const rows = await duckRows(
    `WITH p AS (
       SELECT comercio_id, bandera, sucursal_id, sucursal_nombre, localidad,
              ean, descripcion, marca, cantidad, unidad,
              ${SQL_PRECIO_EFECTIVO} AS pe
       FROM v_precio_curado WHERE dt = $1 ${where}
     )
     SELECT ean,
            arg_min(descripcion, pe) AS descripcion_encontrada,
            arg_min(marca, pe)       AS marca,
            arg_min(cantidad, pe)    AS cantidad,
            arg_min(unidad, pe)      AS unidad,
            min(pe)  AS mejor_precio
     FROM p GROUP BY ean
     HAVING min(pe) > 0
     ORDER BY mejor_precio ASC LIMIT ?`,
    [...params, limit],
  );
  if (!rows.length) return { dt, resultados: [] };

  // detalle de sucursales por EAN (solo los hits devueltos, acotado)
  const eans = rows.slice(0, limit).map((r) => String(r.ean));
  const detParams: unknown[] = [dt, ...eans];
  const pl = eans.map((_, i) => `$${i + 2}`);
  let detWhere = `WHERE dt = $1 AND ean IN (${pl.join(", ")})`;
  if (zona) {
    detWhere += " AND provincia = ?";
    detParams.push(zona);
  }
  const det = (await duckRows(
    `SELECT ean, sucursal_id, sucursal_nombre, localidad, comercio_id, bandera,
            ${SQL_PRECIO_EFECTIVO} AS pe
     FROM v_precio_curado ${detWhere}`,
    detParams,
  )) as unknown as Array<{
    ean: string;
    sucursal_id: string;
    sucursal_nombre: string;
    localidad: string;
    comercio_id: string;
    bandera: string;
    pe: number;
  }>;

  const detPorEan = new Map<string, typeof det>();
  for (const d of det) {
    let l = detPorEan.get(d.ean);
    if (!l) detPorEan.set(d.ean, (l = []));
    l.push(d);
  }

  const resultados: ResultadoLocal[] = rows.map((r) => {
    const ean = String(r.ean);
    const d = detPorEan.get(ean) ?? [];
    const mejor = d.reduce(
      (acc, x) => (x.pe < acc.pe ? x : acc),
      d[0] ?? { pe: Infinity, sucursal_id: "", sucursal_nombre: "", localidad: "", comercio_id: "0", bandera: "", ean },
    );
    const precios = d.map((x) => Number(x.pe));
    const m = mediana(precios);
    const pe0 = precios.length ? Math.max(...precios) : 0;
    return {
      ean,
      descripcion_canonica: String(r.descripcion_encontrada ?? ""),
      descripcion_encontrada: String(r.descripcion_encontrada ?? ""),
      marca: String(r.marca ?? ""),
      cantidad: String(r.cantidad ?? ""),
      unidad: String(r.unidad ?? ""),
      imagen_url: null, // se enriquece con R2 (dim_imagen) en /api/search
      mejor_precio: Number(r.mejor_precio) || 0,
      mejor_sucursal: mejor.sucursal_nombre ?? "",
      mejor_cadena: cadenaDe(mejor.comercio_id, mejor.bandera),
      mejor_localidad: mejor.localidad ?? "",
      n_sucursales: new Set(d.map((x) => x.sucursal_id)).size,
      mediana_zona: m,
      spread: m && m > 0 ? pe0 / m : null,
    };
  });
  return { dt, resultados };
}
