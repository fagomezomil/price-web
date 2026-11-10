/* ============================================================
   Types del dominio — definidos UNA sola vez a acá.
   Fuente de columnas: schemas DuckDB de la gestación
   (v_precio_curado, v_scrape, dim_sucursal, precio_mediana).
   ============================================================ */

/** Origen de la data del precio. */
export type Fuente = "sepa" | "propio";

/** Categorías de producto para la UI (alta: derivable de sinónimos later). */
export const CATEGORIAS = [
  "lácteos",
  "almacén",
  "bebidas",
  "limpieza",
  "conservas",
  "perfumería",
  "congelados",
  "panadería",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** Zona del usuario (por ahora provincia ISO + localidad opcional). */
export interface Zona {
  /** código ISO como 'AR-T' (viene así de SEPA) */
  provincia: string;
  localidad?: string;
}

/** Un precio por sucursal (fila de v_precio_curado o v_scrape). */
export interface PrecioSucursal {
  dt: string; /* ISO date */
  fuente: Fuente;
  comercio_id: string;
  /** nombre armónico de cadena para UI: 'Carrefour', 'Vea', 'La Anónima'... */
  cadena: string;
  sucursal_id: string;
  sucursal_nombre: string;
  localidad: string;
  provincia: string; /* ISO, se resuelve a nombre en UI */
  ean: string;
  descripcion: string;
  marca: string;
  cantidad: string;
  unidad: string;
  precio_lista: number;
  promo1: number | null;
  promo2: number | null;
  /** precio efectivo del día: promo1 si es válida, si no lista */
  precio_efectivo: number;
  es_pesable: boolean;
  promo_sospechosa: boolean;
  imagen_url?: string | null;
  /** distancia a mediana del comercio para el dt (viene de mediana o calc) */
}

/** Mejor resultado de un EAN para una zona (card de resultados). */
export interface ResultadoLocal {
  ean: string;
  descripcion_canonica: string;
  descripcion_encontrada: string;
  marca: string;
  cantidad: string;
  unidad: string;
  imagen_url: string | null;
  mejor_precio: number;
  mejor_sucursal: string;
  mejor_cadena: string;
  mejor_localidad: string;
  /** cuántas sucursales de la zona lo tienen (DISTINCT sucursal_id) */
  n_sucursales: number;
  mediana_zona: number | null;
  spread: number | null;
}

/** Fila de la tabla por sucursal del PDP. */
export interface FilaSucursal {
  comercio_id: string;
  provincia: string; /* ISO, para el filtro por zona (isla client) */
  cadena: string;
  sucursal_nombre: string;
  localidad: string;
  precio_efectivo: number;
  precio_lista: number;
  promo_leyenda: string | null;
  /** 1 = mismo precio; 0/1 = vs mediana del comercio en el dt */
  es_minimo: boolean;
}

/** Punto de serie histórica (mediana por dt para un comercio o nacional). */
export interface PuntoSerie {
  dt: string; /* ISO date */
  mediana: number;
  pmin: number;
  pmax: number;
}

export interface MedianaEan {
  ean: string;
  serie: PuntoSerie[];
  ultimo: PuntoSerie | null;
}

/**
 * Item del carrito comparador ("mi lista"): 1 EAN = 1 ítem.
 * Cantidad ≥1 (unidades del mismo EAN).
 */
export interface ItemCarrito {
  ean: string;
  cantidad: number;
}

/**
 * Ranking de carrito: por sucursal, cuántos items cubre y el TOTAL.
 * Faltante valorado con vecino (D3): "cubre 3/4 · te falta X ($N)".
 */
export interface RankingSucursal {
  sucursal_id: string;
  sucursal_nombre: string;
  cadena: string;
  localidad: string;
  /** items presentes en esta sucursal (de n total) */
  cubre: number;
  total_items: number;
  /** suma de precio_efectivo de los cubiertos */
  total: number;
  /** detalle de los ítems que esta sucursal tiene (1 fila por ean) */
  items: Array<{ ean: string; descripcion: string; cantidad: number; precio: number }>;
  faltantes: Array<{
    ean: string;
    descripcion_canonica: string;
    precio_vecino: number | null;
    sucursal_vecina: string | null;
    cadena_vecina: string | null;
    distancia_vecino: string | null; /* texto "Vea YB (2,1 km)" si hay geo */
  }>;
}

// TODO(F4): Alerta cuando entre el schema de Supabase
export interface Alerta {
  id: string;
  user_id: string | null;
  email: string;
  ean: string;
  tipo: "pct_target" | "absoluto" | "cobertura";
  valor: number | null;
  activa: boolean;
}

/** Doc del índice de búsqueda (Meili) / resultado de search. */
export interface Producto {
  ean: string;
  descripcion_canonica: string;
  aliases: string[];
  marca: string;
  cantidad: string;
  unidad: string;
  imagen_url: string | null;
  mediana_nacional: number | null;
  n_cadenas: number;
  /** facet para chips de variante: "1 L", "500 g" */
  variante: string | null;
}

export interface SearchRespuesta {
  dt: string; /* dt servido, para trazabilidad */
  hits: Array<
    Producto & {
      /** score de match para el badge de trazabilidad del buscador */
      score: number;
    }
  >;
  total: number;
  /** si la zona activa del user no tiene cobertura total, alternativas por categoría */
  coberturas?: Record<string, { sin_cobertura_local: boolean; alternativas_ean: string[] }>;
}
