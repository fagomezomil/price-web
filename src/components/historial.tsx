/* ============================================================
   historial.tsx — panel dark del PDP: SVG server-rendered (sin
   recharts ni JS client). Serie nacional: banda pmin–pmax + línea
   de mediana. Ancho viewBox fijo, escala responsiva vía CSS.
   ============================================================ */
import type { PuntoSerie } from "@/types";

import { fmtDt, fmtPrecio } from "@/lib/format";

const W = 640;
const H = 240;
const M_LEFT = 56;
const M_RIGHT = 14;
const M_TOP = 26;
const M_BOTTOM = 34;

export function Historial({ serie, titulo }: { serie: PuntoSerie[]; titulo: string }) {
  if (serie.length < 2) {
    return (
      <div className="hist">
        <div className="hhead">
          <h3>Historial de precio · {titulo}</h3>
          <span className="sig">MÁS DATA CADA DÍA — LLEVAMOS SOLO {serie.length} DÍA(S)</span>
        </div>
      </div>
    );
  }

  const todos = serie.flatMap((p) => [p.pmin, p.pmax]).filter((v) => v > 0);
  const lo = Math.min(...todos) * 0.96;
  const hi = Math.max(...todos) * 1.04;
  const x = (i: number) => M_LEFT + (i * (W - M_LEFT - M_RIGHT)) / (serie.length - 1);
  const y = (v: number) => M_TOP + (H - M_TOP - M_BOTTOM) * (1 - (v - lo) / (hi - lo || 1));

  const banda = `${serie.map((p, i) => `${x(i)},${y(p.pmax)}`).join(" L")} L ${serie
    .map((p, i) => `${x(serie.length - 1 - i)},${y(serie[serie.length - 1 - i].pmin)}`)
    .join(" L")} Z`;
  const linea = serie.map((p, i) => `${x(i)},${y(p.mediana)}`).join(" ");
  const ult = serie[serie.length - 1];
  const primero = serie[0];

  // 4 marcas de precio equidistantes
  const ticks = [0, 1 / 3, 2 / 3, 1].map((t) => lo + t * (hi - lo));
  // etiquetas de fecha: primer, medio y último punto
  const marcas = [0, Math.floor(serie.length / 2), serie.length - 1];

  const delta = primero.mediana > 0 ? ((ult.mediana - primero.mediana) / primero.mediana) * 100 : 0;

  return (
    <div className="hist">
      <div className="hhead">
        <h3>Historial de precio · {titulo}</h3>
        <span className="sig">
          MEDIANA NACIONAL POR DÍA · <b>{fmtDt(primero.dt)} → {fmtDt(ult.dt)}</b> · MÁS DATA CADA DÍA
        </span>
      </div>
      <div className="hbody">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Historial de precio: ${titulo}`}>
          <g stroke="#252830" strokeWidth="1">
            {[0, 1 / 3, 2 / 3, 1].map((t) => (
              <line
                key={t}
                x1={M_LEFT}
                x2={W - M_RIGHT}
                y1={M_TOP + t * (H - M_TOP - M_BOTTOM)}
                y2={M_TOP + t * (H - M_TOP - M_BOTTOM)}
              />
            ))}
          </g>
          <g fill="#6b7078" fontFamily="var(--font-jbmono), monospace" fontSize="10" textAnchor="end">
            {ticks.map((v, i) => (
              <text key={i} x={M_LEFT - 8} y={M_TOP + i * ((H - M_TOP - M_BOTTOM) / 3) + 4}>
                {fmtPrecio(v)}
              </text>
            ))}
          </g>
          {/* banda pmin–pmax (llegan N sucursales por día) */}
          <polygon points={banda} fill="#2a2d35" />
          {/* línea mediana */}
          <polyline fill="none" stroke="#ffe600" strokeWidth="2.5" points={linea} />
          {/* último punto */}
          <circle cx={x(serie.length - 1)} cy={y(ult.mediana)} r="4" fill="#ffe600" />
          <text
            x={x(serie.length - 1) - 6}
            y={y(ult.mediana) - 10}
            fill="#ffe600"
            fontFamily="var(--font-jbmono), monospace"
            fontWeight="800"
            fontSize="12"
            textAnchor="end"
          >
            {fmtPrecio(ult.mediana)}
          </text>
          {/* ejes */}
          <g fill="#6b7078" fontFamily="var(--font-jbmono), monospace" fontSize="9.5" textAnchor="middle">
            {marcas.map((i) => (
              <text key={i} x={x(i)} y={H - 12}>
                {fmtDt(serie[i].dt)}
              </text>
            ))}
          </g>
          <line x1={M_LEFT} y1={M_TOP} x2={M_LEFT} y2={H - M_BOTTOM} stroke="#252830" />
        </svg>
        <div className="hside">
          <div className="row">
            <span>mediana</span>
            <span className="cur">{fmtPrecio(ult.mediana)}</span>
          </div>
          <div className="row">
            <span>banda del día</span>
            <span>
              {fmtPrecio(ult.pmin)} – {fmtPrecio(ult.pmax)}
            </span>
          </div>
          <div className="row">
            <span>desde {fmtDt(primero.dt)}</span>
            <span style={{ color: delta > 0 ? "#e5311f" : "#b8e986" }}>
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}%
            </span>
          </div>
          <p className="nota">
            {"// UNA FOTO POR DÍA DE LA MEDIANA NACIONAL. LA PROMO SI ESTÁ, SE LEE EN LA TABLA — LA LÍNEA SIEMPRE GRAFICA LA MISMA ESCALA."}
            <br />
            <br />
            {"// EL HISTORIAL ARRANCA CON ~25 DÍAS DE DATA Y CRECE TODOS LOS DÍAS."}
          </p>
        </div>
      </div>
    </div>
  );
}
