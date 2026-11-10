/* ============================================================
   lista.ts — "mi lista" + zona en localStorage (solo client).
   Keys: remito.zona ('AR-T'), remito.lista (ItemCarrito[]).
   Avisos de cambio: window event 'remito:lista'.
   ============================================================ */
import type { ItemCarrito, Zona } from "@/types";

export const KEY_ZONA = "remito.zona";
export const KEY_LISTA = "remito.lista";
export const EVT = "remito:lista";

/** Zona default del sitio: Tucumán (foco regional). */
export function getZona(): Zona {
  try {
    const iso = localStorage.getItem(KEY_ZONA);
    if (iso && /^AR-[A-Z]$/.test(iso)) return { provincia: iso };
  } catch {}
  return { provincia: "AR-T" };
}

export function setZona(z: Zona) {
  try {
    localStorage.setItem(KEY_ZONA, z.provincia);
  } catch {}
}

export function getLista(): ItemCarrito[] {
  try {
    const raw = localStorage.getItem(KEY_LISTA);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (i): i is ItemCarrito =>
          typeof i === "object" && i !== null && typeof (i as ItemCarrito).ean === "string",
      )
      .map((i) => ({ ean: i.ean, cantidad: Number(i.cantidad) >= 1 ? Math.floor(Number(i.cantidad)) : 1 }));
  } catch {
    return [];
  }
}

export function setLista(items: ItemCarrito[]) {
  try {
    localStorage.setItem(KEY_LISTA, JSON.stringify(items));
    window.dispatchEvent(new Event(EVT));
  } catch {}
}

export function addToList(ean: string, cantidad = 1) {
  const items = getLista();
  const existing = items.find((i) => i.ean === ean);
  if (existing) existing.cantidad += cantidad;
  else items.push({ ean, cantidad });
  setLista(items);
}

export function removeFromList(ean: string) {
  setLista(getLista().filter((i) => i.ean !== ean));
}

/** cambia la cantidad de un ean (delta ±1, piso 1) — para el carrito editable. */
export function changeCantidad(ean: string, delta: number) {
  const items = getLista();
  const it = items.find((i) => i.ean === ean);
  if (!it) return;
  it.cantidad = Math.max(1, it.cantidad + delta);
  setLista(items);
}

export function enLista(ean: string, items: ItemCarrito[]): boolean {
  return items.some((i) => i.ean === ean);
}
