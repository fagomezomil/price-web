"use client";
/* ============================================================
   tabla-zona.tsx — isla del PDP sobre la tabla nacional (ISR):
   filtra por la zona del user (localStorage, default AR-T).
   Si la zona no tiene lectura, muestra el país entero con aviso.
   ============================================================ */
import { useEffect, useMemo, useState } from "react";

import { fmtPrecio } from "@/lib/format";
import { KEY_ZONA } from "@/lib/lista";

import type { FilaSucursal } from "@/types";

function nombreProvincia(iso: string): string {
  if (iso === "AR-T") return "Tucumán";
  return iso.replace("AR-", "");
}

export function TablaZona({ filas, dt }: { filas: FilaSucursal[]; dt: string }) {
  const [zonaDefault, setZonaDefault] = useState("AR-T");
  const [ver, setVer] = useState<"zona" | "pais">("zona");

  // zona del user = estado externo (localStorage) → sincronizar post-microtask
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const iso = localStorage.getItem(KEY_ZONA);
        if (iso && /^AR-[A-Z]$/.test(iso)) setZonaDefault(iso);
      } catch {}
    });
  }, []);

  const zonas = useMemo(
    () => [...new Set(filas.map((f) => f.provincia))].sort(),
    [filas],
  );

  const [mostradas, sinZona] = useMemo(() => {
    const deZona = filas.filter((f) => f.provincia === zonaDefault);
    if (!deZona.length) return [filas, true];
    return [ver === "zona" ? deZona : filas, false];
  }, [filas, zonaDefault, ver]);

  if (!filas.length) return null;

  const min = Math.min(...mostradas.map((f) => f.precio_efectivo));

  return (
    <div className="in">
      <div className="zonebar" style={{ marginBottom: 12 }}>
        {zonas.includes(zonaDefault) && !sinZona && (
          <>
            <button
              type="button"
              className={`chip ${ver === "zona" ? "on" : ""}`}
              onClick={() => setVer("zona")}
            >
              <span className="dot" />
              Zona: {nombreProvincia(zonaDefault)} · {filas.filter((f) => f.provincia === zonaDefault).length} suc.
            </button>
            <button
              type="button"
              className={`chip ${ver === "pais" ? "on" : ""}`}
              onClick={() => setVer("pais")}
            >
              <span className="dot" />
              Todo el país · {filas.length} suc.
            </button>
          </>
        )}
        {sinZona && (
          <span className="upd">
            <span className="dot" />
            sin lectura en tu zona hoy — mostrando el país · actualizado <b>{dt}</b>
          </span>
        )}
      </div>
      <div className="sucwrap">
        <table className="suc">
          <tbody>
            <tr>
              <th style={{ width: "34%" }}>Sucursal</th>
              <th>Precio</th>
              <th>Promo</th>
              <th>Lista</th>
              <th>Fecha</th>
            </tr>
            {mostradas.map((f) => (
              <tr key={`${f.sucursal_nombre}-${f.localidad}-${f.precio_efectivo}`} className={esGold(f, min) ? "gold" : undefined}>
                <td>
                  <span className="dotc" />
                  {f.sucursal_nombre || f.cadena}
                  <span style={{ color: "var(--dim)" }}> · {f.localidad}</span>
                </td>
                <td className="n">{fmtPrecio(f.precio_efectivo)}</td>
                <td>{f.promo_leyenda ? <span className="promo">{f.promo_leyenda}</span> : "—"}</td>
                <td>{fmtPrecio(f.precio_lista)}</td>
                <td>{dt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function esGold(f: FilaSucursal, min: number): boolean {
  return f.precio_efectivo === min && f.precio_efectivo > 0;
}
