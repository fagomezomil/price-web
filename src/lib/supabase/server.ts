/* ============================================================
   supabase/server.ts — clientes server-side.
   - createSs(): client con cookies (sesión del usuario, RLS)
   - sa(): client admin (service role, cron alertas, sin cookies)
   Env: SUPABASE_URL / SUPABASE_ANON / SUPABASE_SERVICE (env.ts)
   ============================================================ */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { env } from "@/env";
import type { Database } from "@/types/supabase";

/** Clave requerida: error en el arranque de la request si falta. */
function req(v: string | undefined, nombre: string): string {
  if (!v) throw new Error(`falta ${nombre} en .env.local`);
  return v;
}

const sUrl = () => req(env.SUPABASE_URL, "SUPABASE_URL");
const sAnon = () => req(env.SUPABASE_ANON, "SUPABASE_ANON");
const sService = () => req(env.SUPABASE_SERVICE, "SUPABASE_SERVICE");

export async function createSs() {
  const jar = await cookies();
  return createServerClient(
    sUrl(),
    sAnon(),
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (todos: { name: string; value: string; options?: CookieOptions }[]) => {
          try {
            for (const { name, value, options } of todos) {
              jar.set(name, value, options);
            }
          } catch {
            // Server Component: cookies inmutables — el refresh lo hace el middleware
          }
        },
      },
    },
  );
}

/** Admin bypassea RLS — SOLO server routes / cron, nunca exponer. */
export function sa() {
  return createClient<Database>(sUrl(), sService(), {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "public" },
  });
}

export function anon() {
  return createClient<Database>(sUrl(), sAnon());
}
