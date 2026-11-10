"use client";
/* ============================================================
   cuenta-botones.tsx — acciones en /cuenta: desuscribir alerta
   (desactiva) y quitar favorito. La isla viva es el botón: al
   confirmar pasa al estado final (ok/error).
   ============================================================ */
import { useState } from "react";

type Estado = "idle" | "cargando" | "ok" | "error";

async function postFavoritos(ean: string): Promise<boolean> {
  const r = await fetch("/api/favoritos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ean, on: false }),
  });
  await r.json().catch(() => ({}));
  return r.ok;
}

export function BotonAlerta({ id }: { id: number }) {
  const [est, setEst] = useState<Estado>("idle");

  if (est === "ok") return <span className="kpiline">desuscripto ✓</span>;

  return (
    <button
      className="btn2"
      disabled={est === "cargando"}
      onClick={async () => {
        setEst("cargando");
        try {
          const r = await fetch(`/api/alertas?id=${id}`, { method: "DELETE" });
          await r.json().catch(() => ({}));
          setEst(r.ok ? "ok" : "error");
        } catch {
          setEst("error");
        }
      }}
    >
      {est === "cargando" ? "…" : est === "error" ? "error, probá de nuevo" : "dejar de avisar"}
    </button>
  );
}

export function BotonFavorito({ ean }: { ean: string }) {
  const [est, setEst] = useState<Estado>("idle");

  if (est === "ok") return <span className="kpiline">quitado ✓</span>;

  return (
    <button
      className="btn2"
      disabled={est === "cargando"}
      onClick={async () => {
        setEst("cargando");
        try {
          const ok = await postFavoritos(ean);
          setEst(ok ? "ok" : "error");
        } catch {
          setEst("error");
        }
      }}
    >
      {est === "cargando" ? "…" : est === "error" ? "error, probá de nuevo" : "quitar"}
    </button>
  );
}
