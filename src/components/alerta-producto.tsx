"use client";
/* ============================================================
   alerta-producto.tsx — bloque de la PDP: alerta por email
   cuando el precio baja al que esperás. Sin sesión → email
   inline (magic link con redirect a la PDP). Con sesión →
   input del precio objetivo. Consulta /api/auth/session.
   ============================================================ */
import { useEffect, useState } from "react";

type Sesion = { user: { email: string } | null };
type Estado = "init" | "enviando" | "enviado" | "error";

export function AlertaProducto({
  ean,
  precioHoy,
  nombreCorto,
}: {
  ean: string;
  precioHoy: number | null;
  nombreCorto: string;
}) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [meta, setMeta] = useState(precioHoy ? Math.round(precioHoy * 0.9).toLocaleString("es-AR") : "");
  const [estado, setEstado] = useState<Estado>("init");

  useEffect(() => {
    const t = setTimeout(() => {
      (async () => {
        // 1. sesión (body SIEMPRE consumido)
        let sesionActiva: Sesion = { user: null };
        try {
          const x = await fetch("/api/auth/session");
          const xs = (await x.json()) as Sesion;
          if ("user" in xs) sesionActiva = xs;
        } catch {}
        setSesion(sesionActiva);

        // 2. intención guardada antes del magic link → crear la alerta
        if (!sesionActiva.user) return;
        const key = `alerta-pend:${ean}`;
        let bruto: string | null = null;
        try {
          bruto = localStorage.getItem(key);
        } catch {}
        if (!bruto) return;
        try {
          const p = JSON.parse(bruto) as { precio_meta?: number };
          if (typeof p.precio_meta === "number" && p.precio_meta > 0) {
            localStorage.removeItem(key);
            setMeta(p.precio_meta.toLocaleString("es-AR"));
            const r = await fetch("/api/alertas", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ean, tipo: "meta", precio_meta: p.precio_meta }),
            });
            await r.json().catch(() => ({}));
            setEstado(r.ok ? "enviado" : "error");
          }
        } catch {
          try {
            localStorage.removeItem(key);
          } catch {}
        }
      })();
    }, 0);
    return () => clearTimeout(t);
  }, [ean]);

  const parseMeta = () => {
    const n = Number(meta.replace(/[^\d,.-]/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  async function crear(email?: string) {
    const precioMeta = parseMeta();
    if (!precioMeta) return;
    setEstado("enviando");

    const redirect = `/producto/${ean}`;

    if (email) {
      // flujo sin sesión: guardar la intención + mandar el link. Al
      // volver con sesión (redirect a la PDP), el effect crea la alerta.
      try {
        localStorage.setItem(
          `alerta-pend:${ean}`,
          JSON.stringify({ precio_meta: precioMeta, ts: Date.now() }),
        );
      } catch {}
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, redirect }),
      });
      await res.json().catch(() => ({}));
      setEstado(res.ok ? "enviado" : "error");
      return;
    }

    const res = await fetch("/api/alertas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ean, tipo: "meta", precio_meta: precioMeta }),
    });
    await res.json().catch(() => ({}));
    setEstado(res.ok ? "enviado" : "error");
  }

  const cargando = sesion === null;

  return (
    <div className="alerta" style={{ border: "var(--bw) solid var(--ink)", padding: 14, background: "#fff" }}>
      <div className="a1">ALERTA DE PRECIO</div>
      <div className="a2" style={{ marginBottom: 12 }}>
        avisame cuando <b>{nombreCorto}</b> baje a
      </div>

      {estado === "enviado" ? (
        <div className="note-ok">
          {sesion?.user
            ? "Listo — te avisa por email cuando llegue a ese precio."
            : "Te mandamos un link al correo — abrilo en este navegador y el precio objetivo queda registrado."}
        </div>
      ) : cargando ? (
        <div className="kpiline">cargando…</div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", width: 160, flex: "0 0 auto" }}>
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                fontWeight: 800,
              }}
            >
              $
            </span>
            <input
              className="inp"
              inputMode="decimal"
              aria-label="precio objetivo"
              value={meta}
              onChange={(x) => setMeta(x.target.value)}
              style={{ paddingLeft: 24 }}
            />
          </div>
          {sesion?.user ? (
            <button className="btn" onClick={() => crear()} disabled={estado === "enviando"}>
              {estado === "enviando" ? "…" : "avisame"}
            </button>
          ) : (
            <form
              style={{ display: "flex", gap: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const email = String(data.get("email") ?? "").trim();
                if (email) crear(email);
              }}
            >
              <input
                className="inp"
                type="email"
                name="email"
                required
                placeholder="tu email"
                style={{ width: 220 }}
              />
              <button className="btn" type="submit" disabled={estado === "enviando"}>
                {estado === "enviando" ? "…" : "avisame"}
              </button>
            </form>
          )}
          {estado === "error" && <span className="note-err">no se pudo — probá de nuevo</span>}
        </div>
      )}

      {sesion?.user ? null : (
        <p className="zonenote">
          con el mail te creamos la cuenta: nada de claves, solo para tus alertas.
        </p>
      )}
    </div>
  );
}
