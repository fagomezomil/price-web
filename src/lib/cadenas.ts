/* ============================================================
   cadenas.ts — comercio_id (+ bandera) -> nombre armónico para UI.
   Fuente: banderas observadas en v_precio_curado (SEPA + scrape propio).
   El id de comercio NO es estable en el dataset externo: si SEPA agrega
   uno nuevo, el fallback usa la bandera cruda (nunca explota).
   ============================================================ */

const POR_COMERCIO: Record<string, string> = {
  "2": "La Anónima",
  "5": "California",
  "6": "Comodín",
  "10": "Carrefour",
  "11": "ChangoMás",
  "12": "Coto",
  "13": "Cooperativa Obrera",
  "15": "Día",
  "20": "La Agrícola",
  "21": "Toledo",
  "23": "Axion",
  "47": "Unicoop",
};

/** Cencosud (comercio 9) expone Vea/Disco/Jumbo como cadenas separadas en UI. */
function cadenaCencosud(bandera: string): string {
  const b = bandera.toLowerCase();
  if (b.includes("jumbo")) return "Jumbo";
  if (b.includes("disco")) return "Disco";
  return "Vea";
}

function tituloCaso(bandera: string): string {
  const t = bandera.trim().toLowerCase();
  if (!t) return "";
  return t
    .split(/\s+/)
    .map((w) => (w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase()))
    .join(" ");
}

/**
 * @param comercioId id de comercio SEPA (v_precio_curado.comercio_id)
 * @param bandera NOMBRE de bandera (columna `bandera`, no id_bandera)
 */
export function cadenaDe(comercioId: string | number, bandera: string): string {
  const b = String(bandera ?? "");
  if (String(comercioId) === "9") return cadenaCencosud(b);
  return POR_COMERCIO[String(comercioId)] ?? (tituloCaso(b) || "Otro");
}
