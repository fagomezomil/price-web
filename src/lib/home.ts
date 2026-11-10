/* ============================================================
   lib/home.ts — datos de la home (build-time, 'use cache').
   KPIs de un dt + cards "cerca tuyo" (mejor precio local de una
   canasta de queries fijas) + balance índice por cadena.
   Todo zona AR-T (foco). Sin promos en el índice (lista pura).
   ============================================================ */
import { cadenaDe } from "@/lib/cadenas";
import { duckRows } from "@/lib/duck";
import { mapaImagenes } from "@/lib/img";
import { buscarSql } from "@/lib/queries/buscar";

export interface Card {
  /** categoría mostrada en el head de la card */
  cat: string;
  /** query canónica que el usuario puede clickear */
  q: string;
  ean: string;
  descripcion: string;
  cantidad: string;
  unidad: string;
  mejor_precio: number;
  mejor_cadena: string;
  mejor_sucursal: string;
  mejor_localidad: string;
  mediana_zona: number | null;
  n_sucursales: number;
  /** URL R2 de la imagen del producto (null → fallback mono) */
  img: string | null;
}

const SPECS: Array<{ cat: string; q: string; busqueda: string }> = [
  { cat: "Lácteos", q: "leche serenisima entera 1l", busqueda: "leche serenisima entera" },
  { cat: "Yerba", q: "yerba playadito 1kg", busqueda: "yerba playadito" },
  { cat: "Bebidas", q: "coca cola 3l", busqueda: "coca cola" },
  { cat: "Almacén", q: "aceite girasol 900ml", busqueda: "aceite girasol" },
  { cat: "Limpieza", q: "lavadillas 800", busqueda: "detergente lavadillas" },
  { cat: "Panadería", q: "pan lactal", busqueda: "pan lactal" },
];

export interface FilaBalance {
  comercio_id: string;
  cadena: string;
  /** suma de medianas de comercio para la canasta */
  suma: number;
  /** cantidad de productos con mediana para este comercio */
  items: number;
  n_productos: number;
  /** índice: 100 * suma / suma_mediana_zona */
  idx: number;
  /** delta de índice vs dt anterior */
  delta_idx: number | null;
}

export interface DatosHome {
  dt: string;
  dt_prev: string | null;
  n_precios: number;
  n_sucursales: number;
  n_comercios: number;
  cards: Card[];
  balance: FilaBalance[];
  suma_mediana_zona: number;
}

/** Mejor resultado local por query fija (1 resultado por card). */
async function cardPorSpec(s: { cat: string; q: string; busqueda: string }): Promise<Omit<Card, "img"> | null> {
  const { resultados } = await buscarSql(s.busqueda, "AR-T", 5);
  const hit = resultados.find((r) => r.n_sucursales > 0);
  if (!hit) return null;
  return {
    cat: s.cat,
    q: s.q,
    ean: hit.ean,
    descripcion: hit.descripcion_canonica,
    cantidad: hit.cantidad,
    unidad: hit.unidad,
    mejor_precio: hit.mejor_precio,
    mejor_cadena: hit.mejor_cadena,
    mejor_sucursal: hit.mejor_sucursal,
    mejor_localidad: hit.mejor_localidad,
    mediana_zona: hit.mediana_zona,
    n_sucursales: hit.n_sucursales,
  } satisfies Omit<Card, "img">;
}

export async function datosHome(dt: string): Promise<DatosHome> {
  // KPIs del dt (una partición, columnar)
  const kpi = await duckRows(
    `SELECT count(*) AS n, count(DISTINCT sucursal_id) AS nsuc, count(DISTINCT comercio_id) AS ncom
     FROM v_precio_curado WHERE dt = ?`,
    [dt],
  );

  // dt anterior (para delta del balance)
  const prev = await duckRows(
    "SELECT CAST(max(dt) AS VARCHAR) AS dt FROM precio_mediana WHERE dt < ?",
    [dt],
  );
  const dtPrev = prev[0]?.dt ? String(prev[0].dt) : null;

  // canasta = los 6 EANs de las cards
  const cardsRaw = (await Promise.all(SPECS.map(cardPorSpec))).filter((c): c is Card => c !== null);
  // imagen R2 por card (dim_imagen; sin → null y la card cae al fallback mono)
  const imgs = await mapaImagenes(cardsRaw.map((c) => c.ean));
  const cards = cardsRaw.map((c) => ({ ...c, img: imgs.get(c.ean) ?? null }));
  const eans = cards.map((c) => c.ean);

  let balance: FilaBalance[] = [];
  if (eans.length) {
    const inEans = `('${eans.join("','")}')`;

    // mediana de zona por EAN (benchmark: ratio 1 = precio justo de la zona)
    const zona = await duckRows(
      `SELECT ean, median(mediana) AS m FROM precio_mediana
       WHERE dt = ? AND ean IN ${inEans} GROUP BY ean`,
      [dt],
    );
    const medZonaPorEan = new Map(zona.map((r) => [String(r.ean), Number(r.m)]));
    const sumaMedianaZona = zona.reduce((a, r) => a + Number(r.m ?? 0), 0);

    // ratios por comercio: idx = 100 × promedio(mediana_comercio / mediana_zona)
    // en los ítems con datos — fair con cobertura parcial (se reporta cobertura).
    const ratiosPorComercio = new Map<string, number[]>();
    const itemsPorComercio = new Map<string, string[]>();
    const filasComercios = await duckRows(
      `SELECT comercio_id, ean, median(mediana) AS m
       FROM precio_mediana WHERE dt = ? AND ean IN ${inEans}
       GROUP BY comercio_id, ean`,
      [dt],
    );
    for (const r of filasComercios) {
      const cid = String(r.comercio_id);
      const mz = medZonaPorEan.get(String(r.ean));
      if (!mz || mz <= 0) continue;
      push(itemsPorComercio, cid, String(r.ean));
      push(ratiosPorComercio, cid, Number(r.m) / mz);
    }
    const prevRatios = dtPrev
      ? await duckRows(
          `SELECT comercio_id, ean, median(mediana) AS m
           FROM precio_mediana WHERE dt = ? AND ean IN ${inEans}
           GROUP BY comercio_id, ean`,
          [dtPrev],
        )
      : [];
    const prevPorComercio = new Map<string, number[]>();
    for (const r of prevRatios) {
      const mz = medZonaPorEan.get(String(r.ean));
      if (!mz || mz <= 0) continue;
      push(prevPorComercio, String(r.comercio_id), Number(r.m) / mz);
    }

    // bandera por comercio (para cadena armónica) — del propio dt (columnar, barato)
    const nom = await duckRows(
      "SELECT DISTINCT comercio_id, bandera FROM v_precio_curado WHERE dt = ?",
      [dt],
    );
    const banderaPorComercio = new Map(nom.map((r) => [String(r.comercio_id), String(r.bandera ?? "")]));

    balance = [...ratiosPorComercio.keys()]
      .filter((cid) => (itemsPorComercio.get(cid)?.length ?? 0) >= Math.max(3, Math.ceil(eans.length * 0.5)))
      .map((cid) => {
        const ratios = ratiosPorComercio.get(cid) ?? [];
        const idx = Math.round((100 * ratios.reduce((a, b) => a + b, 0)) / (ratios.length || 1));
        const prev = prevPorComercio.get(cid) ?? [];
        const prevIdx =
          prev.length
            ? Math.round((100 * prev.reduce((a, b) => a + b, 0)) / prev.length)
            : null;
        return {
          comercio_id: cid,
          cadena: cadenaDe(cid, banderaPorComercio.get(cid) ?? ""),
          suma: ratios.reduce((a, b) => a + b, 0) / (ratios.length || 1),
          items: ratios.length,
          n_productos: eans.length,
          idx,
          delta_idx: prevIdx == null ? null : idx - prevIdx,
        };
      })
      .sort((a, b) => a.idx - b.idx);

    return {
      dt,
      dt_prev: dtPrev,
      n_precios: Number(kpi[0]?.n ?? 0),
      n_sucursales: Number(kpi[0]?.nsuc ?? 0),
      n_comercios: Number(kpi[0]?.ncom ?? 0),
      cards,
      balance,
      suma_mediana_zona: sumaMedianaZona,
    };
  }

  return {
    dt,
    dt_prev: dtPrev,
    n_precios: Number(kpi[0]?.n ?? 0),
    n_sucursales: Number(kpi[0]?.nsuc ?? 0),
    n_comercios: Number(kpi[0]?.ncom ?? 0),
    cards,
    balance,
    suma_mediana_zona: 0,
  };
}

function push<V>(map: Map<string, V[]>, k: string, v: V) {
  const l = map.get(k);
  if (l) l.push(v);
  else map.set(k, [v]);
}
