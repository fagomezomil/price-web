"use client";
/* ============================================================
   buscador.tsx — isla del buscador (hero y header de resultados).
   El estado vive en la URL: /buscar?q=… — la página resultados lee q.
   ============================================================ */
import { useRouter } from "next/navigation";
import { useState } from "react";

const QUICK = ["leche", "coca 3l", "yerba", "harina", "aceite", "pan lactal"];

export function Buscador({ inicial, chips }: { inicial?: string; chips?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(inicial ?? "");

  const ir = (valor: string) => {
    const v = valor.trim();
    if (v.length < 2) return;
    router.push(`/buscar?q=${encodeURIComponent(v)}`);
  };

  return (
    <>
      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          ir(q);
        }}
        role="search"
      >
        <input
          placeholder="leche · yerba · coca 3L · Nescafé →"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="buscar un producto"
        />
        <button type="submit">Precio →</button>
      </form>
      {chips && (
        <div className="quick">
          {QUICK.map((c) => (
            <button key={c} type="button" className="qchip" onClick={() => ir(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
