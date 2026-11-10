/* Formato es-AR. Server + client safe. */
export function fmtPrecio(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return "$" + Math.round(n).toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

/** fecha ISO dt -> "06/11/26" */
export function fmtDt(dt: string | null | undefined): string {
  if (!dt) return "—";
  const [y, m, d] = dt.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
}
