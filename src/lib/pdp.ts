"use cache";
/* ============================================================
   lib/pdp.ts — datos del PDP, cacheados por EAN (ISR on-demand).
   2 cache tags: 'precios' (flush diario) + 'ean:<ean>'.
   ============================================================ */
import { cacheTag } from "next/cache";

import { duckRows, TAG_PRECIOS, ultimoDt } from "@/lib/duck";
import { mapaImagenes } from "@/lib/img";
import { buscarSql } from "@/lib/queries/buscar";
import { mediana, preciosPorEan, serieEan, tablaSucursales } from "@/lib/queries/precios";

import type { FilaSucursal, PuntoSerie } from "@/types";

export interface DatosPdp {
  dt: string;
  ean: string;
  descripcion: string;
  marca: string;
  cantidad: string;
  unidad: string;
  imagen_url: string | null;
  filas: FilaSucursal[]; /* nacionales (la isla filtra por zona) */
  serie: PuntoSerie[];
  mejor_local: { precio: number; cadena: string; sucursal: string; localidad: string } | null;
  mejor_nacional: { precio: number; cadena: string; sucursal: string; localidad: string } | null;
  mediana_nacional: number | null;
  n_zona: number;
  sin_zona_en: string[]; /* cadenas del mejor país que no operan en AR-T */
  alternativas: Array<{ ean: string; descripcion: string; precio: number | null; n: number }>;
}

export async function datosPdp(ean: string): Promise<DatosPdp | null> {
  cacheTag(TAG_PRECIOS, `ean:${ean}`);

  const dt = await ultimoDt();
  if (!dt) return null;

  const [filas, serie, local, meta, scrape, imgMap] = await Promise.all([
    tablaSucursales(ean, { dt }),
    serieEan(ean, 90),
    preciosPorEan(ean, { dt, zona: "AR-T" }),
    metaModal(ean, dt),
    imagenScrape(ean),
    mapaImagenes([ean]),
  ]);

  if (!filas.length && !local.length) return null;

  // descripción modal del dt (la que más sucursales leen) + marca/cant/unidad
  const descripcion = meta?.descripcion ?? "";
  const muestra = { marca: meta?.marca ?? "", cantidad: meta?.cantidad ?? "", unidad: meta?.unidad ?? "" };

  const mejorLocal = local.length ? local[0] : null;
  const mejorNacional = filas.length ? filas[0] : null;
  // mediana nacional del dt (de la serie, último punto)
  const medNac = serie.length ? serie[serie.length - 1].mediana : mediana(filas.map((f) => f.precio_efectivo));

  // cadenas que NO operan en la zona del user (si es la mejor del país)
  const cadenasZona = new Set(local.map((p) => p.cadena));
  const sinZona = mejorNacional && !cadenasZona.has(mejorNacional.cadena) ? [mejorNacional.cadena] : [];

  // alternativas: misma marca y cantidad, otros EANs, con lectura en AR-T
  const altQ = [muestra.marca, muestra.cantidad].filter((t) => t?.trim()).join(" ");
  let alternativas: DatosPdp["alternativas"] = [];
  if (altQ.length >= 2) {
    const { resultados } = await buscarSql(altQ, "AR-T", 6);
    alternativas = resultados
      .filter((r) => r.ean !== ean)
      .slice(0, 3)
      .map((r) => ({
        ean: r.ean,
        descripcion: r.descripcion_canonica,
        precio: r.mejor_precio > 0 ? r.mejor_precio : null,
        n: r.n_sucursales,
      }));
  }

  return {
    dt,
    ean,
    descripcion,
    marca: muestra.marca,
    cantidad: muestra.cantidad,
    unidad: muestra.unidad,
    imagen_url: imgMap.get(ean) ?? scrape, /* R2 (dim_imagen) primero, scrape remoto fallback */
    filas,
    serie,
    mejor_local: mejorLocal
      ? {
          precio: mejorLocal.precio_efectivo,
          cadena: mejorLocal.cadena,
          sucursal: mejorLocal.sucursal_nombre,
          localidad: mejorLocal.localidad,
        }
      : null,
    mejor_nacional: mejorNacional
      ? {
          precio: mejorNacional.precio_efectivo,
          cadena: mejorNacional.cadena,
          sucursal: mejorNacional.sucursal_nombre,
          localidad: mejorNacional.localidad,
        }
      : null,
    mediana_nacional: medNac,
    n_zona: new Set(local.map((p) => p.sucursal_id)).size,
    sin_zona_en: sinZona,
    alternativas,
  };
}

/** descripción modal + atributos del dt (1 query barato sobre la partición). */
async function metaModal(
  ean: string,
  dt: string,
): Promise<{ descripcion: string; marca: string; cantidad: string; unidad: string } | null> {
  const rows = await duckRows(
    `SELECT descripcion, marca, cantidad, unidad
     FROM v_precio_curado WHERE dt = ? AND ean = ?
     GROUP BY descripcion, marca, cantidad, unidad
     ORDER BY count(*) DESC, descripcion ASC
     LIMIT 1`,
    [dt, ean],
  );
  if (!rows.length) return null;
  return {
    descripcion: String(rows[0].descripcion ?? ""),
    marca: String(rows[0].marca ?? ""),
    cantidad: String(rows[0].cantidad ?? ""),
    unidad: String(rows[0].unidad ?? ""),
  };
}

/** imagen de producto enriquecida del scrape propio si existe (v_scrape). */
async function imagenScrape(ean: string): Promise<string | null> {
  const rows = await duckRows(
    `SELECT imagen_url FROM v_scrape
     WHERE ean = ? AND imagen_url IS NOT NULL
     ORDER BY dt DESC LIMIT 1`,
    [ean],
  );
  const u = rows[0]?.imagen_url ? String(rows[0].imagen_url) : "";
  return /^https?:\/\//.test(u) ? u : null;
}
