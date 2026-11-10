"use client";
/* ============================================================
   carrito-isla.tsx — página "mi lista" (client pura).
   Lee localStorage (lib/lista) → POST /api/carrito → remito-card
   con el mejor super + ranking por TOTAL REAL (faltante valorado).
   ============================================================ */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { changeCantidad, EVT, getLista, getZona, removeFromList } from "@/lib/lista";

import { fmtPrecio } from "@/lib/format";

import type { ItemCarrito, RankingSucursal } from "@/types";

interface DataCarrito {
  dt: string;
  ranking: RankingSucursal[];
  sin_data: string[];
}

export function CarritoIsla() {
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [data, setData] = useState<DataCarrito | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const sync = () => {
      setItems(getLista());
      setListo(true);
    };
    sync();
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);

  const pedir = useCallback(async (lista: ItemCarrito[]) => {
    if (!lista.length) {
      setData(null);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/carrito", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: lista, zona: getZona().provincia }),
      });
      const txt = await res.text(); // drena SIEMPRE
      if (!res.ok) throw new Error(txt.slice(0, 200) || `HTTP ${res.status}`);
      setData(JSON.parse(txt) as DataCarrito);
    } catch (err) {
      setError(err instanceof Error ? err.message : "error de carrito");
    } finally {
      setCargando(false);
    }
  }, []);

  // re-pedir siempre que cambia la lista (el EVT de lib/lista dispara el sync);
  // items es un array nuevo en cada cambio persistido — así queda 1 fetch por cambio
  useEffect(() => {
    if (!listo) return;
    const t = setTimeout(() => void pedir(items), 0);
    return () => clearTimeout(t);
  }, [listo, items, pedir]);

  if (!listo) return null;

  if (!items.length) {
    return (
      <div className="nrank" style={{ marginTop: 30 }}>
        <b>tu lista está vacía</b> — desde los resultados, tocá «+ mi lista» en cada producto:
        <br />
        <Link href="/buscar?q=leche">empezar por la leche →</Link>
      </div>
    );
  }

  const mejor = data?.ranking[0];
  const resto = data?.ranking.slice(1) ?? [];

  return (
    <div className="cartzone">
      <div>
        <h2>Tu lista, super por super</h2>

        {erroresFaltantes(items, data) && (
          <div className="alerta">
            <div className="a1">SIN DATA HOY</div>
            <div className="a2">
              {erroresFaltantes(items, data)} — no entra al ranking de este {data?.dt}.
            </div>
          </div>
        )}

        {mejor && (
          <div className="remito-card">
            <div className="rhead">
              <span className="t">
                {mejor.cadena.toUpperCase()} · {mejor.sucursal_nombre}
              </span>
              <span className="sello">COBERTURA {mejor.cubre}/{mejor.total_items}</span>
            </div>
            {mejor.items?.map((it) => (
              <div key={it.ean}>
                <FilaItem
                  it={it}
                  onQuitar={() => removeFromList(it.ean)}
                  onCantidad={(d) => changeCantidad(it.ean, d)}
                />
              </div>
            ))}
            {mejor.faltantes.map((f) => (
              <div key={f.ean} className="itm falta">
                <b>{f.descripcion_canonica}</b>
                <span className="q">FALTA</span>
                <span className="m">
                  {f.precio_vecino ? `${fmtPrecio(f.precio_vecino)} en ${f.cadena_vecina}` : "sin data"}
                </span>
              </div>
            ))}
            <div className="cubre">
              {Array.from({ length: mejor.total_items }).map((_, i) => (
                <i key={i} className={i < mejor.cubre ? "on" : "off"} />
              ))}
            </div>
            <div className="subs">
              <div>
                <span>SUBTOTAL AQUÍ ({mejor.cubre}/{mejor.total_items} ÍTEMS)</span>
                <span>{fmtPrecio(mejor.total)}</span>
              </div>
              {mejor.faltantes.some((f) => f.precio_vecino) && (
                <div>
                  <span>COMPLETANDO EL FALTANTE EN OTRO</span>
                  <span>
                    +{fmtPrecio(mejor.faltantes.reduce((a, f) => a + (f.precio_vecino ?? 0), 0))}
                  </span>
                </div>
              )}
              <div className="total">
                <span>TOTAL REAL</span>
                <span>{fmtPrecio(mejor.total + mejor.faltantes.reduce((a, f) => a + (f.precio_vecino ?? 0), 0))} ★</span>
              </div>
            </div>
          </div>
        )}
        <div className="nrank">
          <b>regla de oro</b>: el ranking valora SIEMPRE el faltante al precio más bajo vigente en
          otra góndola — así un super que cubre todo a $X conviene (o no) contra uno más barato que
          te deja en la calle con media lista.
        </div>
      </div>

      <div>
        <h2>
          Ranking <span className="sello">POR TOTAL REAL</span>
        </h2>
        {cargando && <p className="kpiline">calculando ranking…</p>}
        {error && <p className="nrank">el ranking falló — {error}</p>}
        {mejor && (
          <div className="rankrow win">
            <div className="n">
              <b>1 · {mejor.cadena} {mejor.sucursal_nombre}</b>
              <span className="sello">
                {mejor.cubre === mejor.total_items
                  ? "CUBRE TODA LA LISTA"
                  : `Cubre ${mejor.cubre}/${mejor.total_items}`}
              </span>
            </div>
            <div className="t">
              {fmtPrecio(
                mejor.total + mejor.faltantes.reduce((a, f) => a + (f.precio_vecino ?? 0), 0),
              )}
              <u>MINIMO</u>
            </div>
          </div>
        )}
        {resto.map((r, i) => (
          <div key={r.sucursal_id} className="rankrow">
            <div className="n">
              <b>
                {i + 2} · {r.cadena} {r.sucursal_nombre}
              </b>
              <span className="sig">
                Cubre {r.cubre}/{r.total_items}
                {r.faltantes.length ? ` · sin ${r.faltantes.map((f) => (f.descripcion_canonica || "").split(" ")[0]).join(", ")}` : ""}
              </span>
            </div>
            <div className="t">
              {fmtPrecio(r.total + r.faltantes.reduce((a, f) => a + (f.precio_vecino ?? 0), 0))}
              <u>CUBIERTO {fmtPrecio(r.total)}</u>
            </div>
          </div>
        ))}
        {data && data.ranking.length === 0 && !cargando && (
          <p className="nrank">ninguna sucursal de tu zona tiene estos precios hoy — volvé a probar mañana.</p>
        )}
      </div>
    </div>
  );
}

/* ---- fila editable de item dentro del remito-card ---- */
interface ItemDetalle {
  ean: string;
  descripcion: string;
  cantidad: number;
  precio: number;
}

function FilaItem({
  it,
  onQuitar,
  onCantidad,
}: {
  it: ItemDetalle;
  onQuitar: () => void;
  onCantidad: (delta: number) => void;
}) {
  return (
    <div className="itm">
      <b>
        {it.descripcion}{" "}
        <span style={{ fontWeight: 500, color: "var(--dim)" }}>— EAN {it.ean}</span>
      </b>
      <span className="q" style={{ whiteSpace: "nowrap" }}>
        <button type="button" onClick={() => onCantidad(-1)} aria-label="menos">−</button>
        {"×"}
        {it.cantidad}
        <button type="button" onClick={() => onCantidad(1)} aria-label="más">+</button>
        {" · "}
        <button type="button" onClick={onQuitar} aria-label="quitar">✕</button>
      </span>
      <span className="m">{fmtPrecio(it.precio * it.cantidad)}</span>
    </div>
  );
}

/** resume EANs sin lectura para el banner de alerta (D3). */
function erroresFaltantes(items: ItemCarrito[], data: DataCarrito | null): string | null {
  if (!data?.sin_data?.length) return null;
  const eans = new Set(items.map((i) => i.ean));
  const sin = data.sin_data.filter((e) => eans.has(e));
  return sin.length ? `${sin.length} producto(s) sin lectura en la zona` : null;
}
