"use client";
/* ============================================================
   sesion-chip.tsx — isla en la Barra: link entrar o estado del
   user (email + salir). Isa server: la Barra queda estática y
   esto consulta /api/auth/session al montar.
   ============================================================ */
import { useEffect, useState } from "react";

type Sesion = { user: { email: string } | null };

export function SesionChip() {
  const [s, setS] = useState<Sesion | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/auth/session")
        .then((x) => x.json())
        .then((d: Sesion) => setS(d))
        .catch(() => setS({ user: null }));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  if (!s) return null; // sin parpadeo: hasta cargar, nada

  if (!s.user) {
    return (
      <a className="chip" href="/entrar" style={{ textDecoration: "none" }}>
        entrar
      </a>
    );
  }

  const corto = s.user.email.split("@")[0].slice(0, 14);
  return (
    <form action="/api/auth/salir" method="POST">
      <button type="submit" className="chip" title={`sección de ${s.user.email}`}>
        {corto} · salir
      </button>
    </form>
  );
}
