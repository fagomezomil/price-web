/* ============================================================
   types/supabase.ts — tipos de la DB F4 (a mano, sin CLI).
   OJO: son `type` y NO `interface` — GenericTable de
   supabase-js exige asignabilidad a Record<string, unknown> y
   las interfaces de TS no la tienen (quirk de TS).
   ============================================================ */
export type AlertaTipo = "meta" | "baja";

export type Profile = {
  id: string;
  display_name: string | null;
  created_at: string;
};

export type FavoritoRow = {
  user_id: string;
  ean: string;
  sucursal_pref: string | null;
  created_at: string;
};

export type Alerta = {
  id: number;
  user_id: string;
  ean: string;
  tipo: AlertaTipo;
  precio_meta: number | null;
  precio_ref: number | null;
  provincia: string | null;
  sucursal_id: string | null;
  activa: boolean;
  last_notified_at: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      favoritos: {
        Row: FavoritoRow;
        Insert: Partial<FavoritoRow> & Pick<FavoritoRow, "user_id" | "ean">;
        Update: Partial<FavoritoRow>;
        Relationships: [];
      };
      alertas: {
        Row: Alerta;
        Insert: Partial<Alerta> & Pick<Alerta, "user_id" | "ean">;
        Update: Partial<Alerta>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
