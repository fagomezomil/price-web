"use client";
/* ============================================================
   entrar-form.tsx — email → magic link. Muestra el estado
   (error de URL, enviando, revisá tu correo) sin SSR.
   ============================================================ */
import { useEffect, useState } from "react";

type Estado = "init" | "enviando" | "enviado" | "error";

export function EntrarForm() {
  const [estado, setEstado] = useState<Estado>("init");
  const [errorUrl, setErrorUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams(window.location.search);
      const e = p.get("error");
      if (e) setErrorUrl(e);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!email.trim()) return;
    setEstado("enviando");
    const r = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim(), redirect: "/cuenta" }),
    });
    await r.json().catch(() => ({}));
    setEstado(r.ok ? "enviado" : "error");
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {errorUrl && <div className="note-err">{decodeURIComponent(errorUrl)}</div>}

      {estado === "enviado" ? (
        <div className="note-ok">
          Listo — te mandamos un link a <b>{email}</b>. Abrilo en este navegador y queda la sesión
          abierta.
        </div>
      ) : (
        <form onSubmit={enviar} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
          <label className="sig" htmlFor="email-entrar">
            tu email
          </label>
          <input
            id="email-entrar"
            className="inp"
            type="email"
            required
            autoComplete="email"
            placeholder="vos@ejemplo.com"
            value={email}
            onChange={(x) => setEmail(x.target.value)}
          />
          <button className="btn" type="submit" disabled={estado === "enviando"}>
            {estado === "enviando" ? "enviando…" : "entrar con el link"}
          </button>
          {estado === "error" && (
            <div className="note-err">no pudimos enviar el correo — probá de nuevo</div>
          )}
          <p className="zonenote">
            sin clave de la vida: mandamos un link de un solo uso, y con eso entrás. Lo usamos
            únicamente para tus listas y alertas de precio.
          </p>
        </form>
      )}
    </div>
  );
}
