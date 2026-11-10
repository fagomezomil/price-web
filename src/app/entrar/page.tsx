/* ============================================================
   /entrar — login por magic link (Supabase). Estática: el form
   es isla y el error de la URL lo lee el cliente.
   ============================================================ */
import type { Metadata } from "next";

import { EntrarForm } from "@/components/entrar-form";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entrar con un link de email para tus listas y alertas de precio.",
  robots: { index: false },
};

export default function EntrarPage() {
  return (
    <div className="wrap" style={{ paddingTop: 30, paddingBottom: 40 }}>
      <h1 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 900, textTransform: "uppercase" }}>
        Entrar
      </h1>
      <p className="kpiline" style={{ margin: "10px 0 22px" }}>
        PARA <b>LISTAS</b> <span className="sep">|</span> <b>ALERTAS</b> <span className="sep">|</span>{" "}
        <b>HISTORIAL GUARDADO</b>
      </p>
      <EntrarForm />
    </div>
  );
}
