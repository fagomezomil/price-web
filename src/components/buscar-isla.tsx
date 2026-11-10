"use client";
/* ============================================================
   buscar-isla.tsx — página de resultados (client, fetch /api/search).
   Estado en URL (?q=). Zona del user via localStorage (default AR-T).
   Markup: .res principal + .alt alternativas, trazabilidad en sigbar.
   ============================================================ */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AgregarLista } from "@/components/agregar-lista";
import { TablaZona } from "@/components/tabla-zona";

import { fmtPrecio } from "@/lib/format";
import { getZona } from "@/lib/lista";

import type { FilaSucursal, SearchRespuesta } from "@/types";

interface Estado {
  data: SearchRespuesta | null;
  cargando: boolean;
  error: string | null;
}

/** tabla extendida de la API: /api/search + opcional detalle por EAN */
type RespSearch = SearchRespuesta;

export function BuscarIsla() {
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const [estado, setEstado] = useState<Estado>({ data: null, cargando: false, error: null });
  const [abiertas, setAbiertas] = useState<string | null>(null);

  const leer = useCallback(async (query: string) => {
    setEstado({ data: null, cargando: true, error: null });
    try {
      const zona = getZona();
      const us = new URL("/api/search", window.location.origin);
      us.searchParams.set("q", query);
      us.searchParams.set("zona", zona.provincia);
      const res = await fetch(us, { headers: { accept: "application/json" } });
      const txt = await res.text(); // drena SIEMPRE
      if (!res.ok) throw new Error(txt.slice(0, 200) || `HTTP ${res.status}`);
      setEstado({ data: JSON.parse(txt) as RespSearch, cargando: false, error: null });
    } catch (err) {
      setEstado({
        data: null,
        cargando: false,
        error: err instanceof Error ? err.message : "error de búsqueda",
      });
    }
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return;
    let alive = true;
    // microtask hop: el setState de arranque no corriendo sync en el effect body
    const t = setTimeout(() => {
      if (alive) void leer(q);
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, leer]);

  if (!q || q.trim().length < 2) {
    return (
      <p className="nrank" style={{ marginTop: 30 }}>
        escribí qué precio querés saber — <b>leche</b>, <b>yerba</b>, un <b>EAN</b>…
      </p>
    );
  }

  if (estado.cargando) {
    return (
      <p className="kpiline" style={{ padding: "26px 0" }}>
        buscando <b>«{q}»</b>…
      </p>
    );
  }

  if (estado.error || !estado.data) {
    return <p className="nrank">la búsqueda falló — {estado.error ?? "sin data"}</p>;
  }

  const { hits, dt } = estado.data;
  if (!hits.length) {
    return (
      <p className="nrank" style={{ marginTop: 26 }}>
        <b>cero resultados</b> para «{q}» en la data del {dt}. Probá con menos palabras o el nombre
        de marca.
      </p>
    );
  }

  const [prin, ...altos] = hits;

  return (
    <>
      <div className="sech">
        <h2>Resultados</h2>
        <span className="n sig">
          {hits.length} producto{hits.length === 1 ? "" : "s"} · data del {dt}
        </span>
      </div>

      {/* principal */}
      <div className="res">
        <div className="resmain">
          <div className="resimg">
            {prin.imagen_url ? (
              <img
                src={prin.imagen_url}
                alt={prin.descripcion_canonica}
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 11, letterSpacing: ".2em" }}>
                {formatoMono(prin.cantidad, prin.unidad)}
              </span>
            )}
          </div>
          <div className="resmid">
            <h3>{prin.descripcion_canonica}</h3>
            {prin.aliases.length > 0 && (
              <div className="alias">
                también vista como {prin.aliases.map((a) => `«${a}»`).join(" · ")} — EAN {prin.ean}
              </div>
            )}
            <div className="sigbar">
              <span className="hl">
                <span className="sig">
                  MATCH {Math.round(prin.score * 100)}%
                </span>
              </span>
              <span>
                <span className="sig">
                  FUENTE <b>SEPA OFICIAL</b>
                </span>
              </span>
              <span>
                <span className="sig">
                  ACTUALIZADO <b>{dt}</b>
                </span>
              </span>
              <span>
                <span className="sig">{prin.n_cadenas || "—"} CADENAS</span>
              </span>
            </div>
            <div style={{ marginTop: 14 }}>
              <AgregarLista ean={prin.ean} />
            </div>
          </div>
          <div className="respric">
            <div className="p">{fmtPrecio(prin.mediana_nacional)}</div>
            <div className="u sig">
              mediana nacional · <b>{prin.n_cadenas} cadenas</b>
            </div>
            <div className="nat">
              la tabla de abajo trae sucursal por sucursal del {dt}
            </div>
          </div>
        </div>
        <DetallesEan ean={prin.ean} abierto={abiertas === null} dt={dt} onToggle={(v) => setAbiertas(v)} />
      </div>

      {/* alternativas */}
      {altos.length > 0 && (
        <>
          <div className="sech">
            <h2>Alternativas</h2>
            <span className="n sig">variantes y marcas parecidas con lectura de hoy</span>
          </div>
          {altos.map((a) => (
            <div key={a.ean} className="alt">
              <div className="altimg">
                {a.imagen_url ? (
                  <img
                    src={a.imagen_url}
                    alt={a.descripcion_canonica}
                    loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ fontSize: 9, letterSpacing: ".15em" }}>
                    {formatoMono(a.cantidad, a.unidad)}
                  </span>
                )}
              </div>
              <div className="l">
                <b>{a.descripcion_canonica}</b>
                <div className="sm">
                  {a.variante ?? (a.cantidad ? `${a.cantidad} ${a.unidad}` : "")} · EAN {a.ean}
                  {a.marca ? ` · ${a.marca}` : ""}
                </div>
              </div>
              <div className="p2">
                {fmtPrecio(a.mediana_nacional)}
                <em>{a.n_cadenas} cadenas</em>
              </div>
              <Link className="go" href={`/producto/${a.ean}`}>
                DETALLE →
              </Link>
            </div>
          ))}
        </>
      )}
    </>
  );
}

/** details con la tabla nacional del EAN (fetch on-demand al abrir). */
function DetallesEan({
  ean,
  abierto,
  dt,
  onToggle,
}: {
  ean: string;
  abierto: boolean;
  dt: string;
  onToggle: (v: string) => void;
}) {
  const [filas, setFilas] = useState<FilaSucursal[] | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!abierto || filas) return;
    const t = setTimeout(() => {
      setCargando(true);
      void (async () => {
        try {
          const res = await fetch(`/api/tabla?ean=${ean}`, {
            headers: { accept: "application/json" },
          });
          const txt = await res.text(); // drena SIEMPRE
          if (res.ok) setFilas((JSON.parse(txt) as { filas: FilaSucursal[] }).filas);
        } finally {
          setCargando(false);
        }
      })();
    }, 0);
    return () => clearTimeout(t);
  }, [abierto, ean, filas]);

  return (
    <details
      className="detalles"
      open={abierto}
      onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open ? ean : "")}
    >
      <summary>
        <span className="arr">▸</span> VER TODAS LAS SUCURSALES CON ESTE PRODUCTO
      </summary>
      {cargando && <div className="in">cargando sucursales…</div>}
      {filas && <TablaZona filas={filas} dt={dt} />}
    </details>
  );
}

/** texto mono del fallback de imagen: "1L" / "500G" */
function formatoMono(cantidad: string, unidad: string): string {
  const c = cantidad.trim();
  const u = unidad.trim().toUpperCase();
  if (!c && !u) return "SEPA";
  return `${c} ${u}`.trim().slice(0, 12).toUpperCase();
}
