/* ============================================================
   queries/precios.ts — precios por EAN (día) + series históricas.
   Las SQL van SIEMPRE con dt = ? y ean = ? (hive pruning sobre el glob;
   NUNCA full-scan de los 356M). La mediana sale de la tabla precio_mediana.
   ============================================================ */
import type { FilaSucursal, PrecioSucursal, PuntoSerie } from "@/types";

import { cadenaDe } from "@/lib/cadenas";
import { duckRows } from "@/lib/duck";

/** Precio efectivo del día: promo1 si es válida, si no precio de lista. */
export const SQL_PRECIO_EFECTIVO =
  "COALESCE(CASE WHEN promo1 > 0 AND promo1 < precio_lista THEN promo1 END, precio_lista)";

export interface OpcionesEan {
  dt: string;
  /** provincia ISO (AR-T). Sin zona -> nacional. */
  zona?: string;
  /** si además hay localidad en la zona del user (fino post-MVP) */
  limit?: number;
}

const SELECT_PRECIO = `
  SELECT CAST(dt AS VARCHAR) AS dt, comercio_id, bandera, sucursal_id,
         sucursal_nombre, localidad, provincia,
         ean, descripcion, marca, cantidad, unidad,
         precio_lista, promo1, promo2, promo_sospechosa,
         ${SQL_PRECIO_EFECTIVO} AS precio_efectivo
`;

function filaAPrecio(r: Record<string, unknown>): PrecioSucursal {
  const ean = String(r.ean);
  return {
    dt: String(r.dt),
    fuente: "sepa",
    comercio_id: String(r.comercio_id),
    cadena: cadenaDe(String(r.comercio_id), String(r.bandera ?? "")),
    sucursal_id: String(r.sucursal_id),
    sucursal_nombre: String(r.sucursal_nombre ?? ""),
    localidad: String(r.localidad ?? ""),
    provincia: String(r.provincia ?? ""),
    ean,
    descripcion: String(r.descripcion ?? ""),
    marca: String(r.marca ?? ""),
    cantidad: String(r.cantidad ?? ""),
    unidad: String(r.unidad ?? ""),
    precio_lista: Number(r.precio_lista) || 0,
    promo1: r.promo1 == null ? null : Number(r.promo1),
    promo2: r.promo2 == null ? null : Number(r.promo2),
    precio_efectivo: Number(r.precio_efectivo) || 0,
    // GS1: prefijos 02-29 = peso variable (idéntico a curado.py)
    es_pesable: ean.slice(0, 2) >= "02" && ean.slice(0, 2) <= "29",
    promo_sospechosa: Boolean(r.promo_sospechosa),
    imagen_url: null,
  };
}

/** Precios de un EAN para un dt (opcional zona). Orden ascendente por precio efectivo. */
export async function preciosPorEan(ean: string, opts: OpcionesEan): Promise<PrecioSucursal[]> {
  const { dt, zona } = opts;
  const params: unknown[] = [dt, ean];
  let where = "WHERE dt = ? AND ean = ?";
  if (zona) {
    where += " AND provincia = ?";
    params.push(zona);
  }
  const sql = `${SELECT_PRECIO} FROM v_precio_curado ${where}
    ORDER BY precio_efectivo ASC LIMIT ${opts.limit ?? 500}`;
  const rows = await duckRows(sql, params);
  return rows.map(filaAPrecio);
}

/** Filas para la tabla del PDP (una por sucursal, con flag de mínimo). */
export async function tablaSucursales(
  ean: string,
  opts: OpcionesEan,
): Promise<FilaSucursal[]> {
  const precios = await preciosPorEan(ean, opts);
  const min = precios.length ? Math.min(...precios.map((p) => p.precio_efectivo)) : 0;
  return precios.map((p) => ({
    comercio_id: p.comercio_id,
    provincia: p.provincia,
    cadena: p.cadena,
    sucursal_nombre: p.sucursal_nombre,
    localidad: p.localidad,
    precio_efectivo: p.precio_efectivo,
    precio_lista: p.precio_lista,
    promo_leyenda:
      p.promo1 != null && p.promo1 > 0 && p.promo1 < p.precio_lista
        ? `Promo $${p.promo1.toLocaleString("es-AR")}`
        : null,
    es_minimo: p.precio_efectivo === min && precios.length > 1,
  }));
}

/** Mediana de una lista (para mediana_zona sin ida y vuelta a la DB). */
export function mediana(numeros: number[]): number | null {
  if (!numeros.length) return null;
  const s = [...numeros].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Serie histórica nacional (mediana por dt en precio_mediana). */
export async function serieEan(ean: string, dts = 60): Promise<PuntoSerie[]> {
  const rows = await duckRows(
    `SELECT CAST(dt AS VARCHAR) AS dt,
            median(mediana) AS m, min(pmin) AS pmin, max(pmax) AS pmax
     FROM precio_mediana WHERE ean = ?
     GROUP BY dt ORDER BY dt DESC LIMIT ${dts}`,
    [ean],
  );
  return rows
    .map((r) => ({
      dt: String(r.dt),
      mediana: Number(r.m),
      pmin: Number(r.pmin),
      pmax: Number(r.pmax),
    }))
    .reverse();
}

/** Resumen de la tabla mediana para un comercio+ean en un dt (badge del PDP). */
export async function medianaComercio(
  comercioId: string,
  ean: string,
  dt: string,
): Promise<{ mediana: number; n_sucursales: number } | null> {
  const rows = await duckRows(
    "SELECT mediana, n_sucursales FROM precio_mediana WHERE dt = ? AND comercio_id = ? AND ean = ?",
    [dt, comercioId, ean],
  );
  if (!rows.length) return null;
  return { mediana: Number(rows[0].mediana), n_sucursales: Number(rows[0].n_sucursales) };
}
