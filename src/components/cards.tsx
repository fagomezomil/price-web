/* ============================================================
   cards.tsx — cards del home (server): "cerca tuyo" (.ccat) y
   "lo más buscado" (.cfind). Foto real del producto cuando hay
   (v_scrape); los EANs del rubro van a la PDP.
   ============================================================ */
import Link from "next/link";

import type { Card } from "@/lib/home";

/** texto mono del recorte de imagen faltante: "1 L" / "500 G" */
function monoCant(cantidad: string, unidad: string): string {
  return `${cantidad} ${unidad}`.trim().toUpperCase().slice(0, 12) || "SEPA";
}

export function CardCerca({ c }: { c: Card }) {
  return (
    <Link className="ccat" href={`/producto/${c.ean}`}>
      <div className="chead">
        <span className="c">{c.cat}</span>
        <span className="sig">{c.n_sucursales} suc. cerca</span>
      </div>
      <div className="cbody">
        <div className="imgbox">
          {c.img ? (
            <img
              src={c.img}
              alt={c.descripcion}
              width={108}
              height={118}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: 11, letterSpacing: ".2em", color: "var(--dim)" }}>
              {monoCant(c.cantidad.length ? c.cantidad.replace(",", ".") : "", "")}
            </span>
          )}
        </div>
        <div className="info">
          <div className="prod">{c.descripcion}</div>
          <div className="pprice">
            <span className="n">{c.mejor_precio > 0 ? fmtP(c.mejor_precio) : "—"}</span>
            <span className="w">
              {c.mejor_cadena}
              <br />
              {c.mejor_sucursal}
              {c.mejor_localidad ? ` · ${c.mejor_localidad}` : ""}
            </span>
          </div>
          <div className="pfrom">
            <span className="phead-dot" />
            mediana zona <b>{fmtP(c.mediana_zona)}</b> · {c.n_sucursales} sucursales
          </div>
        </div>
      </div>
    </Link>
  );
}

export function CardRail({ c, rango }: { c: Card; rango: number }) {
  const vsMediana =
    c.mediana_zona && c.mediana_zona > 0
      ? Math.round(((c.mejor_precio - c.mediana_zona) / c.mediana_zona) * 100)
      : null;
  return (
    <Link className="cfind" href={`/producto/${c.ean}`}>
      <div className="rank">#{rango} · {monoCant(c.cantidad, c.unidad)}</div>
      <div className="ph">
        {c.img ? (
          <img
            src={c.img}
            alt={c.descripcion}
            width={108}
            height={118}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ color: "var(--dim)", fontSize: 12, letterSpacing: ".2em" }}>
            {monoCant(c.cantidad, c.unidad)}
          </span>
        )}
      </div>
      <div className="prod">{c.descripcion}</div>
      <div className="price">{fmtP(c.mejor_precio)}</div>
      <div className="via">
        <b>{c.mejor_cadena}</b> · mediana de la zona en {fmtP(c.mediana_zona)}
      </div>
      <div className="foot">
        <span className="med">MÍNIMO ZONA</span>
        <span>DETALLE →</span>
      </div>
      <div className="trend">
        {vsMediana == null ? "▬ sin mediana" : vsMediana < 0 ? `▼ ${vsMediana}% vs mediana` : `▲ +${vsMediana}% vs mediana`}
      </div>
    </Link>
  );
}

/** fmt local para server (mismo estilo que lib/format) */
function fmtP(n: number | null): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  return "$" + Math.round(n).toLocaleString("es-AR", { maximumFractionDigits: 0 });
}
