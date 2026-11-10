/* ============================================================
   /cuenta — favoritos + alertas del usuario. Dinámica (lee
   cookies), sin ISR. El labeling de EANs sale del último día
   de DuckDB (mediana descripta por informante).
   ============================================================ */
import type { Metadata } from "next";
import Link from "next/link";

import { BotonAlerta, BotonFavorito } from "@/components/cuenta-botones";
import { fmtPrecio } from "@/lib/format";
import { consultarEtiquetas } from "@/lib/cuenta-servidor";
import { createSs } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mi cuenta",
  robots: { index: false },
};

/** PDP fallback si el EAN no está en el último día (se bajó de la canasta). */
const linkProducto = (ean: string) => `/producto/${ean}`;

export default async function CuentaPage() {
  const ss = await createSs();
  const { data: sesion } = await ss.auth.getUser();

  if (!sesion.user) {
    return (
      <div className="wrap" style={{ paddingTop: 30, paddingBottom: 40 }}>
        <h1 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 900, textTransform: "uppercase" }}>
          Mi cuenta
        </h1>
        <p className="kpiline" style={{ margin: "10px 0 22px" }}>
          NECESITÁS <b>ENTRAR</b> PARA VER TU COSA
        </p>
        <Link href="/entrar" className="btn" style={{ textDecoration: "none" }}>
          entrar con email
        </Link>
      </div>
    );
  }

  const [misFavs, misAlertas] = await Promise.all([
    ss.from("favoritos").select("ean, sucursal_pref, created_at").order("created_at", { ascending: false }),
    ss.from("alertas").select("*").eq("activa", true).order("created_at", { ascending: false }),
  ]);

  const favs = misFavs.data ?? [];
  const alertas = misAlertas.data ?? [];

  const eans = [...new Set([...favs.map((f) => f.ean), ...alertas.map((a) => a.ean)])];
  // labeling de los EANs con la última lectura conocida
  const etiquetas = await consultarEtiquetas(eans);

  return (
    <div className="wrap" style={{ paddingTop: 30, paddingBottom: 40 }}>
      <h1 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 900, textTransform: "uppercase" }}>
        {sesion.user.email}
      </h1>
      <form action="/api/auth/salir" method="POST" style={{ margin: "12px 0 30px" }}>
        <button className="btn2" type="submit">
          salir
        </button>
      </form>

      {/* ============ ALERTAS ============ */}
      <h2 style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 18 }}>
        Alertas de precio
      </h2>
      {alertas.length === 0 ? (
        <p className="zonenote">
          no tenés ninguna — se crean desde cualquier producto (el bloque “alerta de precio”).
        </p>
      ) : (
        <div style={{ display: "grid", gap: 10, margin: "12px 0 34px" }}>
          {alertas.map((a) => {
            const etiqueta = etiquetas[a.ean];
            return (
              <div
                key={a.id}
                className="alt"
                style={{ border: "var(--bw) solid var(--ink)", background: "#fff", padding: 12 }}
              >
                <div className="l">
                  <b>
                    <Link href={linkProducto(a.ean)} style={{ color: "inherit", textDecoration: "none" }}>
                      {etiqueta?.descripcion ?? `EAN ${a.ean}`}
                    </Link>
                  </b>
                  <div className="sm">
                    avisá cuando baje de <b>{fmtPrecio(Number(a.precio_meta))}</b>
                    {etiqueta?.precio != null && (
                      <> · hoy: <b>{fmtPrecio(etiqueta.precio)}</b></>
                    )}
                  </div>
                </div>
                <BotonAlerta id={a.id} />
              </div>
            );
          })}
        </div>
      )}

      {/* ============ FAVORITOS ============ */}
      <h2 style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 18 }}>Favoritos</h2>
      {favs.length === 0 ? (
        <p className="zonenote">
          no marcaste favoritos todavía — el botón “+ mi lista” está en cada producto.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {favs.map((f) => {
            const etiqueta = etiquetas[f.ean];
            return (
              <div
                key={f.ean}
                className="alt"
                style={{ border: "var(--bw) solid var(--ink)", background: "#fff", padding: 12 }}
              >
                <div className="l">
                  <b>
                    <Link href={linkProducto(f.ean)} style={{ color: "inherit", textDecoration: "none" }}>
                      {etiqueta?.descripcion ?? `EAN ${f.ean}`}
                    </Link>
                  </b>
                  <div className="sm">
                    {etiqueta?.precio != null ? <>mejor hoy: <b>{fmtPrecio(etiqueta.precio)}</b></> : "sin lectura reciente"}
                  </div>
                </div>
                <BotonFavorito ean={f.ean} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
