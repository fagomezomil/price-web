/* ============================================================
   duck.ts — acceso server-only a la DuckDB consolidada.
   Reglas (del checklist del repo gestación):
   - read_only SIEMPRE (nunca escribir acá; la escritura vive en curado.py).
   - INSTANCIA NUEVA POR LLAMADA con closeSync garantizado: la
     instance-cache de DuckDB mantenía el file-lock abierto para
     siempre y el pipeline diario (curado.py) no podía abrir la
     DB días enteros (bug real del 07-08/11). Costo: ~100ms por
     query — aceptable para PPR/ISR (las páginas raramente corren queries).
   - IO Error → 1 retry con instancia nueva (el .duckdb puede rotar por sync).
   ============================================================ */
import { DuckDBConnection, type DuckDBMaterializedResult } from "@duckdb/node-api";
import path from "node:path";

import { env } from "@/env";

export const TAG_PRECIOS = "precios" as const;

const dbPath = env.PRECIO_DB_PATH ?? path.join(env.PRECIO_DATA_DIR, "duckdb", "precios.duckdb");

type WithDuck<T> = (con: DuckDBConnection) => Promise<T>;

/**
 * Ejecuta `fn` con una instancia read_only NUEVA. Cierra conexión e instancia
 * en finally SIEMPRE (lock liberado apenas termina la query).
 */
export async function withDuck<T>(fn: WithDuck<T>): Promise<T> {
  for (let intento = 0; intento < 2; intento++) {
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const instance = await DuckDBInstance.create(dbPath, { access_mode: "READ_ONLY" });
    const con = await instance.connect();
    try {
      return await fn(con);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (intento === 0 && /IO Error|Failed to open|Cannot open/i.test(msg)) {
        // instancia posiblemente vencida (db rotada por el sync); 1 retry limpio
        continue;
      }
      throw err;
    } finally {
      con.closeSync();
      instance.closeSync();
    }
  }
  throw new Error("withDuck: unreachable");
}

/** Resultado ya materializado como objetos JSON-safe por fila. */
export type DuckRow = Record<string, unknown>;

export async function duckRows(sql: string, values: unknown[] = []): Promise<DuckRow[]> {
  return withDuck(async (con) => {
    const res: DuckDBMaterializedResult = await con.run(sql, values as never);
    return (await res.getRowObjectsJson()) as unknown as DuckRow[];
  });
}

/** Último dt servido (de la tabla mediana — es la que garantiza el ciclo completo curado). */
export async function ultimoDt(): Promise<string | null> {
  const rows = await duckRows("SELECT CAST(max(dt) AS VARCHAR) AS dt FROM precio_mediana");
  return (rows[0]?.dt as string) ?? null;
}
