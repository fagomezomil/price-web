/* ============================================================
   sitio.tsx — Barra + Pie del sitio (server) con isla CarritoBadge.
   Markup espejo de los mockups 5/6 (.bar/.brand/.topnav/.cartb).
   ============================================================ */
import Link from "next/link";

import { CarritoBadge } from "@/components/carrito-badge";
import { SesionChip } from "@/components/sesion-chip";

export function Barra() {
  return (
    <div className="bar">
      <div className="brand">
        REMITO<i>.com.ar</i>
      </div>
      <nav className="topnav">
        <Link href="/buscar">Buscar</Link>
        <Link href="/carrito">Mi lista</Link>
        <Link href="/cuenta">Alertas</Link>
      </nav>
      <SesionChip />
      <Link href="/carrito" className="cartb">
        MI LISTA <CarritoBadge />
      </Link>
    </div>
  );
}

export function Pie({ dt }: { dt: string }) {
  return (
    <div className="wrap">
      <footer className="site">
        <span className="flinks">
          <span className="sig">
            <b>REMITO.COM.AR</b>
          </span>
          <a className="sig" href="https://www.argentina.gob.ar/economia/ventas/sepa">
            sepa oficial
          </a>
          <span className="sig">método del índice</span>
        </span>
        <span className="sig">
          DATA SEPA (OFICIAL) · <b>PRECIOS DEL {dt.split("-").reverse().join("/")}</b>
        </span>
      </footer>
    </div>
  );
}
