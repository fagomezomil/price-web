/* ============================================================
   scripts/build-search-index.ts — índice Meili diario (post-sync VPS).
   Uso (en VPS): MEILI_URL=... MEILI_KEY=... node/tsx scripts/build-search-index.ts
     [--db D:/ruta/precios.duckdb | --db /opt/remito/data/remito.duckdb]
   Docs = EANs con precio en los últimos 7 dts: descripción modal + aliases +
   marca + cantidad/unidad + imagen (v_scrape) + mediana nacional.
   Idempotente: upsert por EAN (primaryKey). Drain de fetchs SIEMPRE.
   ============================================================ */
import path from "node:path";

import { DuckDBInstance } from "@duckdb/node-api";

const dbArg = process.argv.find((a) => a.startsWith("--db="));
const dbPath = dbArg?.slice(5) ?? path.join(".", "data", "remito.duckdb");
const MEILI_URL = process.env.MEILI_URL?.replace(/\/$/, "") ?? "";
const MEILI_KEY = process.env.MEILI_KEY ?? "";
const INDEX = "precios";

if (!MEILI_URL) {
  console.error("Falta MEILI_URL (y opcional MEILI_KEY). Salir.");
  process.exit(1);
}

/** fetch con drain obligatorio en todos los paths (regla del checklist). */
async function meiliFetch(route: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(`${MEILI_URL}${route}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(MEILI_KEY ? { Authorization: `Bearer ${MEILI_KEY}` } : {}),
    },
  });
  const text = await res.text(); // drena el body SIEMPRE
  if (!res.ok) throw new Error(`Meili ${res.status} ${route}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : undefined;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

interface Tarea {
  taskUid: number;
}
async function esperarTareas(tareas: number[], tag: string) {
  await sleep(500);
  for (let i = 0; i < 240; i++) {
    const status = (await meiliFetch(`/tasks?uids=${tareas.join(",")}`, { method: "GET" })) as {
      results: Array<{ status: string; error?: unknown }>;
    };
    const pend = status.results.filter((t) => t.status === "enqueued" || t.status === "processing");
    if (!pend.length) {
      const fallidas = status.results.filter((t) => t.status === "failed");
      if (fallidas.length) throw new Error(`${tag}: tarea fallida ${JSON.stringify(fallidas).slice(0, 400)}`);
      return;
    }
    await sleep(500);
  }
  throw new Error(`${tag}: timeout esperando tareas`);
}

/** variante facet: "1 L", "500 g", "1 un". */
function variante(cantidad: string, unidad: string): string | null {
  const val = Number(String(cantidad ?? "").replace(",", "."));
  if (!Number.isFinite(val) || val <= 0) return null;
  const u = String(unidad ?? "").trim().toLowerCase().replace(/[^a-záéíóúñ.]/g, "");
  if ((u === "ml" || u.startsWith("ml")) && val >= 1000) return `${+(val / 1000).toFixed(2)} L`;
  if ((u === "gr" || u === "gr." || u === "g") && val >= 1000) return `${+(val / 1000).toFixed(2)} kg`;
  if (u.startsWith("ml")) return `${+val.toFixed(0)} ml`;
  if (u === "gr" || u === "gr." || u === "g") return `${+val.toFixed(0)} g`;
  if (u.startsWith("kg")) return `${+val.toFixed(2)} kg`;
  return null;
}

async function main() {
  const instance = await DuckDBInstance.create(dbPath, { access_mode: "READ_ONLY" });
  const con = await instance.connect();

  const diasRes = await con.runAndReadAll(
    "SELECT DISTINCT CAST(dt AS VARCHAR) AS dt FROM precio_mediana ORDER BY dt DESC LIMIT 7",
  );
  const dias = diasRes.getRowObjectsJson() as unknown as Array<{ dt: string }>;
  const inDias = `('${dias.map((d) => String(d.dt)).join("','")}')`;
  const ultimoDt = dias[0]?.dt ?? "";
  console.log(`ventana: ${dias.length} dts (${dias[dias.length - 1]?.dt} .. ${ultimoDt})`);

  const base = await con.runAndReadAll(
    `WITH vars AS (
       SELECT ean, descripcion, marca, cantidad, unidad, count(*) AS n
       FROM v_precio_curado
       WHERE CAST(dt AS VARCHAR) IN ${inDias}
       GROUP BY 1, 2, 3, 4, 5
     ),
     por_ean AS (
       SELECT ean,
              arg_max(descripcion, n) AS descripcion_canonica,
              arg_max(marca, n)       AS marca,
              arg_max(cantidad, n)    AS cantidad,
              arg_max(unidad, n)      AS unidad,
              list(descripcion ORDER BY n DESC) AS descs,
              max(n)                  AS n_ult
       FROM vars GROUP BY ean
     ),
     med AS (
       SELECT ean, median(mediana) AS m, count(DISTINCT comercio_id) AS nc
       FROM precio_mediana WHERE CAST(dt AS VARCHAR) IN ${inDias} GROUP BY ean
     ),
     imgs AS (
       SELECT ean, arg_max(imagen_url, dt) AS img
       FROM v_scrape WHERE imagen_url IS NOT NULL GROUP BY ean
     )
     SELECT b.ean, b.descripcion_canonica, b.descs, b.marca, b.cantidad, b.unidad,
            med.m AS mediana_nacional, med.nc AS n_cadenas, imgs.img AS imagen_url
     FROM por_ean b LEFT JOIN med USING (ean) LEFT JOIN imgs USING (ean)
     WHERE med.m IS NOT NULL`,
  );
  const rows = base.getRowObjectsJson();
  console.log(`EANs con precio reciente: ${rows.length}`);

  // asegurar índice (409 si ya existe: ok)
  await meiliFetch("/indexes", {
    method: "POST",
    body: JSON.stringify({ uid: INDEX, primaryKey: "ean" }),
  }).catch(() => {});

  const t0 = (await meiliFetch(`/indexes/${INDEX}/settings`, {
    method: "PATCH",
    body: JSON.stringify({
      searchableAttributes: ["descripcion_canonica", "aliases", "ean", "marca"],
      filterableAttributes: ["marca", "variante"],
      sortableAttributes: ["mediana_nacional"],
    }),
  })) as Tarea;
  const tSyn = (await meiliFetch(`/indexes/${INDEX}/synonyms`, {
    method: "POST",
    body: JSON.stringify([
      /* la lista crece en src/lib/search/synonyms.json (iterativos) */
      { id: "nescafe", synonyms: ["repuesto fuerte"], },
    ]),
  })) as Tarea;
  await esperarTareas([t0.taskUid, tSyn.taskUid], "settings");
  console.log("settings + synonyms OK");

  // upsert por lotes de 10k
  const tTasks: number[] = [];
  let lote: unknown[] = [];
  const flush = async () => {
    if (!lote.length) return;
    const res = (await meiliFetch(`/indexes/${INDEX}/documents?primaryKey=ean`, {
      method: "POST",
      body: JSON.stringify(lote),
    })) as Tarea;
    tTasks.push(res.taskUid);
    console.log(`  lote enviado: ${lote.length}`);
    lote = [];
  };

  for (const r of rows as Record<string, unknown>[]) {
    const descs = (Array.isArray(r.descs) ? r.descs : []) as string[];
    const canon = String(r.descripcion_canonica ?? "");
    const aliases = [...new Set(descs.slice(0, 6))]
      .filter((d) => d && d !== canon)
      .slice(0, 5);
    lote.push({
      ean: String(r.ean),
      descripcion_canonica: canon,
      aliases,
      marca: String(r.marca ?? ""),
      cantidad: String(r.cantidad ?? ""),
      unidad: String(r.unidad ?? ""),
      imagen_url: (r.imagen_url as string | null) ?? null,
      mediana_nacional: r.mediana_nacional == null ? null : Number(r.mediana_nacional),
      n_cadenas: Number(r.n_cadenas ?? 0),
      variante: variante(String(r.cantidad), String(r.unidad)),
      dt: ultimoDt,
    });
    if (lote.length >= 10_000) await flush();
  }
  await flush();
  await esperarTareas(tTasks, "documentos");
  console.log(`INDEX OK ${INDEX}: ${rows.length} EANs (dt ${ultimoDt})`);
  con.closeSync();
}

main().catch((e) => {
  console.error("build-search-index FAILED:", e);
  process.exit(1);
});
