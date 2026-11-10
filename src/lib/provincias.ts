/* Provincias ISO -> nombre es-AR (SEPA entrega 'AR-T' crudo). */
const PROVINCIAS: Record<string, string> = {
  "AR-A": "Salta",
  "AR-B": "Buenos Aires",
  "AR-C": "Ciudad de Buenos Aires",
  "AR-D": "San Luis",
  "AR-E": "Entre Ríos",
  "AR-F": "La Rioja",
  "AR-G": "Santiago del Estero",
  "AR-H": "Chaco",
  "AR-J": "San Juan",
  "AR-K": "Santa Cruz",
  "AR-L": "La Pampa",
  "AR-M": "Mendoza",
  "AR-N": "Misiones",
  "AR-P": "Formosa",
  "AR-Q": "Neuquén",
  "AR-R": "Río Negro",
  "AR-S": "Santa Fe",
  "AR-T": "Tucumán",
  "AR-U": "Chubut",
  "AR-V": "Tierra del Fuego",
  "AR-W": "Corrientes",
  "AR-X": "Córdoba",
  "AR-Y": "Jujuy",
  "AR-Z": "Catamarca",
};

export function nombreProvincia(iso: string | null | undefined): string {
  if (!iso) return "";
  return PROVINCIAS[iso] ?? iso;
}

export const CODIGOS_PROVINCIA = Object.keys(PROVINCIAS) as Array<keyof typeof PROVINCIAS>;
