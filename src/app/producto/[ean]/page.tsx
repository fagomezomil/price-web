/* ============================================================
   /producto/[ean] — PDP (página SEO). ISR on-demand: datos de
   lib/pdp ('use cache' con tag ean:<ean>) — sin generateStaticParams.
   Bloques: principal + trazabilidad, tabla híbrida (isla con
   filtro de zona), banner de faltante regional, alternativas,
   historial dark (SVG server). Alertas + mapa: F4+/post-MVP.
   ============================================================ */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AgregarLista } from "@/components/agregar-lista";
import { AlertaProducto } from "@/components/alerta-producto";
import { Historial } from "@/components/historial";
import { Buscador } from "@/components/buscador";
import { TablaZona } from "@/components/tabla-zona";
import { Pie } from "@/components/sitio";

import { fmtDt, fmtPrecio } from "@/lib/format";
import { datosPdp } from "@/lib/pdp";

const ZONA = "Tucumán";

type Props = { params: Promise<{ ean: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ean } = await params;
  const d = await datosPdp(ean);
  if (!d) return { title: "Producto no encontrado" };
  const precio = d.mejor_local?.precio ?? d.mejor_nacional?.precio;
  return {
    title: `${d.descripcion} — precio de hoy en ${ZONA}`,
    description:
      `Cuánto sale ${d.descripcion} (EAN ${ean}) hoy: mejores precios por sucursal` +
      (precio ? ` — desde ${fmtPrecio(precio)}` : "") +
      `, historial y trazabilidad de data SEPA.`,
    alternates: { canonical: `/producto/${ean}` },
    robots: { index: true },
  };
}

export default function ProductoPage({ params }: Props) {
  // params es runtime → el cuerpo va dentro de <Suspense> para streamear
  return (
    <Suspense
      fallback={
        <div className="wrap" style={{ paddingTop: 24 }}>
          <p className="kpiline">abriendo el producto…</p>
        </div>
      }
    >
      <Cuerpo params={params} />
    </Suspense>
  );
}

async function Cuerpo({ params }: Props) {
  const { ean } = await params;
  if (!/^\d{13}$/.test(ean)) notFound();

  const d = await datosPdp(ean);
  if (!d) notFound();

  const mejor = d.mejor_local ?? d.mejor_nacional;
  const nat = d.mediana_nacional;
  const deltaNat =
    mejor && nat && nat > 0 ? Math.round(((mejor.precio - nat) / nat) * 100) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: d.descripcion,
    productID: `ean:${d.ean}`,
    ...(d.imagen_url ? { image: [d.imagen_url] } : {}),
    ...(d.marca ? { brand: { "@type": "Brand", name: d.marca } } : {}),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "ARS",
      ...(mejor?.precio != null ? { lowPrice: mejor.precio } : {}),
      ...(nat != null ? { price: nat } : {}),
      offerCount: d.filas.length,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* hero con buscador */}
      <div className="hero" style={{ padding: "34px 0 26px" }}>
        <div className="wrap">
          <h1>
            Cuánto sale <span className="hoy">hoy</span> en tu góndola
          </h1>
          <div style={{ marginTop: 18 }}>
            <Buscador inicial={d.descripcion.slice(0, 60)} />
          </div>
        </div>
      </div>

      <div className="wrap" style={{ paddingBottom: 8 }}>
        {/* ============ RESULTADO PRINCIPAL ============ */}
        <div className="sech">
          <h2>Resultados</h2>
          <span className="n sig">
            data del {fmtDt(d.dt)} · fuente sepa (oficial), lectura por sucursal
          </span>
        </div>

        <div className="res">
          <div className="resmain">
            <div className="resimg">
              {d.imagen_url ? (
                // remota de scraper propio — sin next/image para no compilar en build
                <img
                  src={d.imagen_url}
                  alt={d.descripcion}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                />
              ) : (
                <span style={{ fontSize: 11, letterSpacing: ".2em", color: "var(--dim)" }}>
                  {(d.cantidad || "SEPA").toUpperCase()}
                  <br />
                  {(d.unidad || "").toUpperCase()}
                </span>
              )}
            </div>
            <div className="resmid">
              <h3>
                <mark>{d.descripcion}</mark>
              </h3>
              <div className="alias">
                EAN {d.ean}
                {d.marca ? ` · marca ${d.marca}` : ""} · {d.cantidad} {d.unidad}
              </div>
              <div className="sigbar">
                <span className="hl">
                  <span className="sig">
                    <b>FUENTE SEPA</b>
                  </span>
                </span>
                <span>
                  <span className="sig">
                    ACTUALIZADO <b>{fmtDt(d.dt)}</b>
                  </span>
                </span>
                <span>
                  <span className="sig">~ {d.n_zona} SUC. EN TU ZONA</span>
                </span>
              </div>
              <div style={{ marginTop: 14 }}>
                <AgregarLista ean={d.ean} />
              </div>
            </div>
            <div className="respric">
              <div className="p">{mejor ? fmtPrecio(mejor.precio) : "—"}</div>
              <div className="u sig">
                {d.mejor_local ? (
                  <>
                    mejor {ZONA.toLowerCase()} · <b>{mejor?.cadena} {mejor?.sucursal}</b>
                  </>
                ) : (
                  <>mejor nacional · {mejor ? `${mejor.cadena} ${mejor.localidad}` : "sin data"}</>
                )}
              </div>
              {d.mejor_local && nat != null && (
                <div className="nat">
                  <b>{fmtPrecio(nat)}</b> mediana nacional (hoy)
                  {deltaNat != null && (
                    <>
                      {" "}
                      <span className="delta">
                        {deltaNat > 0 ? "+" : ""}
                        {deltaNat}%
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {d.filas.length > 0 && (
            <details className="detalles" open>
              <summary>
                <span className="arr">▸</span> SUCURSAL POR SUCURSAL — {d.filas.length} LECTURAS
              </summary>
              <TablaZona filas={d.filas} dt={fmtDt(d.dt)} />
            </details>
          )}
        </div>

        {/* banner: la mejor cadena del país no opera acá (D1/D3) */}
        {d.sin_zona_en.length > 0 && d.mejor_nacional && d.mejor_local && (
          <div className="alerta">
            <div className="a1">SIN {d.sin_zona_en[0].toUpperCase()} EN TU ZONA</div>
            <div className="a2">
              la lectura más barata del país (<b>{fmtPrecio(d.mejor_nacional.precio)} · {d.mejor_nacional.cadena}</b>)
              no opera en {ZONA}. Las alternativas de abajo <b>sí tienen lectura local de hoy</b>.
            </div>
          </div>
        )}

        {/* ============ ALTERNATIVAS ============ */}
        {d.alternativas.length > 0 && (
          <>
            <div className="sech">
              <h2>Alternativas</h2>
              <span className="n sig">variantes y marcas parecidas con lectura de hoy</span>
            </div>
            {d.alternativas.map((a) => (
              <div key={a.ean} className="alt">
                <div className="l">
                  <b>{a.descripcion}</b>
                  <div className="sm">{a.n} sucursales en tu zona · EAN {a.ean}</div>
                </div>
                <div className="p2">
                  {fmtPrecio(a.precio)}
                  <em>mejor local</em>
                </div>
                <Link className="go" href={`/producto/${a.ean}`}>
                  DETALLE →
                </Link>
              </div>
            ))}
          </>
        )}

        {/* ============ HISTORIAL (dark, SVG server) ============ */}
        <Historial serie={d.serie} titulo={d.descripcion} />

        {/* alerta de precio (F4) */}
        <AlertaProducto
          ean={ean}
          precioHoy={mejor?.precio ?? null}
          nombreCorto={d.descripcion.length > 44 ? `${d.descripcion.slice(0, 44)}…` : d.descripcion}
        />

        {/* mapa de sucursales: post-MVP */}
        <div className="nrank" style={{ marginBottom: 10 }}>
          <b>pronto</b>: mapa de las sucursales con data curada.
        </div>

        <Pie dt={d.dt} />
      </div>
    </>
  );
}
