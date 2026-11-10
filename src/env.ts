/* Env vars con Zod (límite de sistema, regla core). Importar en server only. */
import { z } from "zod";

/** .env.example deja las URLs con "" — vacío = sin definir (si falla el url()). */
const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const urlOpt = () => z.preprocess(emptyToUndef, z.string().url().optional());

const schema = z.object({
  PRECIO_DATA_DIR: z.string().min(1).default("./data"),
  /** DuckDB consolidada (vistas + dim + mediana). Prod: remito.duckdb del VPS. */
  PRECIO_DB_PATH: z.string().min(1).optional(),
  PRECIO_SEARCH: z.enum(["sql", "meili"]).default("sql"),
  MEILI_URL: urlOpt(),
  MEILI_KEY: z.string().optional(),
  SUPABASE_URL: urlOpt(),
  SUPABASE_ANON: z.string().optional(),
  SUPABASE_SERVICE: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY: z.string().optional(),
  R2_SECRET: z.string().optional(),
  R2_BUCKET: z.string().default("precios-sepa"),
  REVALIDATE_SECRET: z.string().optional(),
  RESEND_KEY: z.string().optional(),
  /** From del email (Resend): default onboarding@resend.dev (free, solo a tu propio correo). */
  RESEND_FROM: urlOpt(),
  NEXT_PUBLIC_SITE_URL: z.string().default("http://localhost:3000"),
});

export const env = schema.parse(process.env);
