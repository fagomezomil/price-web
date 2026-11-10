/* ============================================================
   Home — hero buscador + cerca tuyo (canasta de queries fijas) +
   balance índice + rail mínimos. ISR: 'use cache' + tag 'precios'
   → el sync diario golpea /api/revalidate.
   ============================================================ */
import { cacheTag } from "next/cache";

import { Buscador } from "@/components/buscador";
import { CardCerca, CardRail } from "@/components/cards";
import { Pie } from "@/components/sitio";

import { TAG_PRECIOS, ultimoDt } from "@/lib/duck";
import { fmtDt, fmtNum } from "@/lib/format";
import { datosHome } from "@/lib/home";

export default async function Home() {
  "use cache";
  cacheTag(TAG_PRECIOS);

  const dt = await ultimoDt();
  if (!dt) {
    return (
      <div className="wrap" style={{ paddingTop: 40 }}>
        <h1>Estamos cocinando la data…</h1>
        <p className="subhero">El primer ciclo curado todavía no aterrizó. Volvé en un rato.</p>
      </div>
    );
  }

  const d = await datosHome(dt);
  const dtTxt = fmtDt(dt);
  const winner = d.balance[0];

  return (
    <>
      {/* ============ HERO full-bleed ============ */}
      <div className="hero">
        <div className="wrap">
          <span className="plus" style={{ top: 16, left: -6 }}>+</span>
          <span className="plus" style={{ top: 16, right: -6 }}>+</span>
          <h1>
            Todos los precios
            <br />
            de <span className="hoy">hoy</span>, a una vuelta
          </h1>
          <div className="zone">
            <span className="zonechip">
              <span className="dot" />
              Zona: TUCUMÁN
            </span>
            <span className="kpiline">
              <b>{fmtNum(d.n_precios)}</b> precios <span className="sep">·</span>{" "}
              <b>{d.n_sucursales}</b> suc. activas <span className="sep">·</span>{" "}
              <b>{d.n_comercios}</b> cadenas
            </span>
            <span className="upd">
              <span className="dot" />
              precios actualizados: <b>{dtTxt}</b>
            </span>
          </div>
          <span className="zonenote">
            relevamiento SEPA (oficial) curado a mano — sin cuentas ni datos personales
          </span>
          <div style={{ marginTop: 20 }}>
            <Buscador chips />
          </div>
        </div>
      </div>

      <div className="wrap">
        {/* ============ CERCA TUYO ============ */}
        <div className="sech">
          <h2>Cerca tuyo</h2>
          <span className="n">
            <span className="desc">el mejor precio local de cada canasta, relevado el {dtTxt}</span>
          </span>
          <a className="more" href="/buscar?q=leche">
            COMPARAR PRECIOS →
          </a>
        </div>

        <div className="cats">
          {d.cards.map((c) => (
            <CardCerca key={c.ean} c={c} />
          ))}
        </div>

        {/* ============ BALANCE DEL DÍA ============ */}
        {d.balance.length > 0 && winner && (
          <>
            <div className="sech">
              <h2>El balance del día</h2>
              <span className="n">
                <span className="desc">
                  quién sale más barato hoy en tu zona — canasta fija de {d.cards.length} ítems
                </span>
              </span>
            </div>

            <div className="balance">
              <div className="bhead">
                <span className="bt">Índice REMITO · {dtTxt}</span>
                <span className="sello">100 = MEDIANA DE LA ZONA</span>
              </div>
              <table className="bal">
                <tbody>
                  <tr>
                    <th style={{ width: "34%" }}>Cadena</th>
                    <th style={{ width: "16%" }}>Índice</th>
                    <th style={{ width: "16%" }}>vs ayer</th>
                    <th>Cobertura</th>
                  </tr>
                  {d.balance.map((b, i) => (
                    <tr key={b.comercio_id} className={i === 0 ? "winner" : undefined}>
                      <td>{b.cadena}</td>
                      <td className="idx">
                        {b.idx} {i === 0 ? "· barato" : ""}
                      </td>
                      <td>
                        {b.delta_idx == null
                          ? "—"
                          : b.delta_idx === 0
                            ? "▬ estable"
                            : b.delta_idx > 0
                              ? `▲ +${b.delta_idx}`
                              : `▼ ${b.delta_idx}`}
                      </td>
                      <td>
                        {b.items} de {b.n_productos} ítems
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bnote">
              <b>método en abierto</b>: el índice compara la MISMA canasta de {d.cards.length} ítems
              en cada cadena contra la mediana de la zona (100). Cada número baja al detalle del
              producto, con fecha de lectura y EAN — auditable de punta a punta.
            </div>
          </>
        )}

        {/* ============ RAIL MÍNIMOS ============ */}
        <div className="sech">
          <h2>Lo que la canasta mira hoy</h2>
          <span className="n">
            <span className="desc">
              los mínimos de la zona por producto — siempre el precio más bajo vigente
            </span>
          </span>
        </div>

        <div className="rail">
          {d.cards.map((c, i) => (
            <CardRail key={c.ean} c={c} rango={i + 1} />
          ))}
        </div>

        <Pie dt={dt} />
      </div>
    </>
  );
}
