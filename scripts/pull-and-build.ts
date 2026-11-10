/* ============================================================
   scripts/pull-and-build.ts — sync R2 → data (F5, lado web).
   Descarga manifest.json + duckdb/precios.duckdb del bucket y
   los deja en PRECIO_DATA_DIR (marker data/.sync_dt para no
   re-descargar el mismo dt). Build/restart: F6 (systemd).
   Uso: npx tsx scripts/pull-and-build.ts [--force]
   Creds: .env.local (R2_ACCOUNT_ID/ACCESS_KEY/SECRET/BUCKET).
   ============================================================ */
import { GetObjectCommand, GetObjectCommandOutput, S3Client } from "@aws-sdk/client-s3";
import { DuckDBInstance } from "@duckdb/node-api";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

// ---- creds y rutas ---------------------------------------------------------
async function main() {
  const RAW = await readFile(path.join(".", ".env.local"), "utf-8").catch(() => "");
  const env: Record<string, string> = {};
  for (const line of RAW.split("\n")) {
    const l = line.trim();
    if (l && !l.startsWith("#") && l.includes("=")) {
      const i = l.indexOf("=");
      env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    }
  }
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET, R2_BUCKET } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET || !R2_BUCKET) {
    console.error("faltan R2_* en .env.local");
    process.exit(1);
  }
  const dataDir = env.PRECIO_DATA_DIR ? path.resolve(env.PRECIO_DATA_DIR) : path.resolve(".", "data");
  const marker = path.join(dataDir, ".sync_dt");
  const force = process.argv.includes("--force");

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET },
  });

  const get = async (key: string): Promise<GetObjectCommandOutput> =>
    await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));

  // manifest: solo se descarga el BODY chico; drain + parse
  const mani = await get("manifest.json");
  const manText = await mani.Body!.transformToString();
  const manifest = JSON.parse(manText) as { dt: string; completo?: boolean };
  if (!manifest.completo) {
    console.error("manifest incompleto (push en marcha o fallado) — salir");
    process.exit(2);
  }

  const sincronizado = await readFile(marker, "utf8").catch(() => null);
  if (!force && sincronizado?.trim() === manifest.dt) {
    console.log(`al día (dt=${manifest.dt}) — nada que descargar`);
    process.exit(0);
  }

  // descargar duckdb atómicamente (.part → rename)
  const destino = path.join(dataDir, "duckdb", "precios.duckdb");
  await mkdir(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.part`;
  await rm(tmp, { force: true });
  console.log(`descargando precios.duckdb (dt=${manifest.dt})…`);
  const obj = await get("duckdb/precios.duckdb");
  await pipeline(obj.Body as unknown as Readable, createWriteStream(tmp));

  // destino final; en Windows falla EPERM si otro proceso (dev server con la
  // DB abierta) tiene lock — dejamos el .part y avisamos (en Linux no ocurre)
  let final = destino;
  try {
    await rename(tmp, destino);
  } catch (e) {
    final = tmp;
    console.warn(
      `no se pudo reemplazar ${destino} (lock Windows? dev server con la DB abierta) — quedó en ${tmp}: ${(e as Error).message}`,
    );
  }

  // verificación contra la DB recién bajada (read_only)
  const inst = await DuckDBInstance.create(final, { access_mode: "READ_ONLY" });
  const con = await inst.connect();
  try {
    const res = await con.run("SELECT count(*) AS n, CAST(max(dt) AS VARCHAR) AS dt FROM precio_mediana");
    const filas = (await res.getRowObjectsJson()) as unknown as { n: unknown; dt: unknown }[];
    console.log(`verificado: precio_mediana ${filas[0]?.n} filas · dt=${filas[0]?.dt}`);
  } finally {
    con.closeSync();
  }

  await writeFile(marker, manifest.dt, "utf8");
  console.log("sync completo ✓");
}

main().catch((e) => {
  console.error("pull-and-build falló:", e);
  process.exit(1);
});
