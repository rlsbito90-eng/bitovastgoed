export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      deals: {
        Row: {
          bezichtiging_gepland: string | null
          created_at: string
          datum_eerste_contact: string
          datum_follow_up: string | null
          fase: Database["public"]["Enums"]["deal_fase"]
          id: string
          indicatief_bod: number | null
          interessegraad: number | null
          notities: string | null
          object_id: string
          relatie_id: string
          updated_at: string
          verantwoordelijke_id: string | null
        }
        Insert: {
          bezichtiging_gepland?: string | null
          created_at?: string
          datum_eerste_contact?: string
          datum_follow_up?: string | null
          fase?: Database["public"]["Enums"]["deal_fase"]
          id?: string
          indicatief_bod?: number | null
          interessegraad?: number | null
          notities?: string | null
          object_id: string
          relatie_id: string
          updated_at?: string
          verantwoordelijke_id?: string | null
        }
        Update: {
          bezichtiging_gepland?: string | null
          created_at?: string
          datum_eerste_contact?: string
          datum_follow_up?: string | null
          fase?: Database["public"]["Enums"]["deal_fase"]
          id?: string
          indicatief_bod?: number | null
          interessegraad?: number | null
          notities?: string | null
          object_id?: string
          relatie_id?: string
          updated_at?: string
          verantwoordelijke_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objecten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_relatie_id_fkey"
            columns: ["relatie_id"]
            isOneToOne: false
            referencedRelation: "relaties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_verantwoordelijke_id_fkey"
            columns: ["verantwoordelijke_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          bekeken: boolean | null
          created_at: string
          id: string
          matchscore: number
          object_id: string
          toelichting: string | null
          zoekprofiel_id: string
        }
        Insert: {
          bekeken?: boolean | null
          created_at?: string
          id?: string
          matchscore: number
          object_id: string
          toelichting?: string | null
          zoekprofiel_id: string
        }
        Update: {
          bekeken?: boolean | null
          created_at?: string
          id?: string
          matchscore?: number
          object_id?: string
          toelichting?: string | null
          zoekprofiel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objecten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_zoekprofiel_id_fkey"
            columns: ["zoekprofiel_id"]
            isOneToOne: false
            referencedRelation: "zoekprofielen"
            referencedColumns: ["id"]
          },
        ]
      }
      notities: {
        Row: {
          auteur_id: string
          created_at: string
          deal_id: string | null
          id: string
          inhoud: string
          object_id: string | null
          relatie_id: string | null
        }
        Insert: {
          auteur_id: string
          created_at?: string
          deal_id?: string | null
          id?: string
          inhoud: string
          object_id?: string | null
          relatie_id?: string | null
        }
        Update: {
          auteur_id?: string
          created_at?: string
          deal_id?: string | null
          id?: string
          inhoud?: string
          object_id?: string | null
          relatie_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notities_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notities_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objecten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notities_relatie_id_fkey"
            columns: ["relatie_id"]
            isOneToOne: false
            referencedRelation: "relaties"
            referencedColumns: ["id"]
          },
        ]
      }
      objecten: {
        Row: {
          aangemaakt_door: string | null
          aantal_huurders: number | null
          bouwjaar: number | null
          bron: string | null
          created_at: string
          documentatie_beschikbaar: boolean | null
          eigenaar_relatie_id: string | null
          exclusief: boolean | null
          huurinkomsten: number | null
          id: string
          intern_vertrouwelijk: boolean | null
          interne_opmerkingen: string | null
          objectnaam: string
          onderhoudsstaat: string | null
          ontwikkelpotentie: boolean | null
          oppervlakte: number | null
          plaats: string | null
          provincie: string | null
          samenvatting: string | null
          status: Database["public"]["Enums"]["object_status"]
          transformatiepotentie: boolean | null
          type_vastgoed: Database["public"]["Enums"]["asset_class"]
          updated_at: string
          verhuurstatus: Database["public"]["Enums"]["verhuur_status"] | null
          vraagprijs: number | null
        }
        Insert: {
          aangemaakt_door?: string | null
          aantal_huurders?: number | null
          bouwjaar?: number | null
          bron?: string | null
          created_at?: string
          documentatie_beschikbaar?: boolean | null
          eigenaar_relatie_id?: string | null
          exclusief?: boolean | null
          huurinkomsten?: number | null
          id?: string
          intern_vertrouwelijk?: boolean | null
          interne_opmerkingen?: string | null
          objectnaam: string
          onderhoudsstaat?: string | null
          ontwikkelpotentie?: boolean | null
          oppervlakte?: number | null
          plaats?: string | null
          provincie?: string | null
          samenvatting?: string | null
          status?: Database["public"]["Enums"]["object_status"]
          transformatiepotentie?: boolean | null
          type_vastgoed: Database["public"]["Enums"]["asset_class"]
          updated_at?: string
          verhuurstatus?: Database["public"]["Enums"]["verhuur_status"] | null
          vraagprijs?: number | null
        }
        Update: {
          aangemaakt_door?: string | null
          aantal_huurders?: number | null
          bouwjaar?: number | null
          bron?: string | null
          created_at?: string
          documentatie_beschikbaar?: boolean | null
          eigenaar_relatie_id?: string | null
          exclusief?: boolean | null
          huurinkomsten?: number | null
          id?: string
          intern_vertrouwelijk?: boolean | null
          interne_opmerkingen?: string | null
          objectnaam?: string
          onderhoudsstaat?: string | null
          ontwikkelpotentie?: boolean | null
          oppervlakte?: number | null
          plaats?: string | null
          provincie?: string | null
          samenvatting?: string | null
          status?: Database["public"]["Enums"]["object_status"]
          transformatiepotentie?: boolean | null
          type_vastgoed?: Database["public"]["Enums"]["asset_class"]
          updated_at?: string
          verhuurstatus?: Database["public"]["Enums"]["verhuur_status"] | null
          vraagprijs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "objecten_aangemaakt_door_fkey"
            columns: ["aangemaakt_door"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objecten_eigenaar_relatie_id_fkey"
            columns: ["eigenaar_relatie_id"]
            isOneToOne: false
            referencedRelation: "relaties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          telefoon: string | null
          updated_at: string
          volledige_naam: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          telefoon?: string | null
          updated_at?: string
          volledige_naam?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          telefoon?: string | null
          updated_at?: string
          volledige_naam?: string | null
        }
        Relationships: []
      }
      relaties: {
        Row: {
          aangemaakt_door: string | null
          aankoopcriteria: string | null
          asset_classes: Database["public"]["Enums"]["asset_class"][] | null
          bedrijfsnaam: string
          budget_max: number | null
          budget_min: number | null
          contactpersoon: string | null
          created_at: string
          email: string | null
          id: string
          laatste_contactdatum: string | null
          lead_status: Database["public"]["Enums"]["lead_status"]
          notities: string | null
          regio: string[] | null
          telefoon: string | null
          type_partij: Database["public"]["Enums"]["relatie_type"]
          updated_at: string
          verantwoordelijke_id: string | null
          verkoopintentie: string | null
          volgende_actie: string | null
        }
        Insert: {
          aangemaakt_door?: string | null
          aankoopcriteria?: string | null
          asset_classes?: Database["public"]["Enums"]["asset_class"][] | null
          bedrijfsnaam: string
          budget_max?: number | null
          budget_min?: number | null
          contactpersoon?: string | null
          created_at?: string
          email?: string | null
          id?: string
          laatste_contactdatum?: string | null
          lead_status?: Database["public"]["Enums"]["lead_status"]
          notities?: string | null
          regio?: string[] | null
          telefoon?: string | null
          type_partij?: Database["public"]["Enums"]["relatie_type"]
          updated_at?: string
          verantwoordelijke_id?: string | null
          verkoopintentie?: string | null
          volgende_actie?: string | null
        }
        Update: {
          aangemaakt_door?: string | null
          aankoopcriteria?: string | null
          asset_classes?: Database["public"]["Enums"]["asset_class"][] | null
          bedrijfsnaam?: string
          budget_max?: number | null
          budget_min?: number | null
          contactpersoon?: string | null
          created_at?: string
          email?: string | null
          id?: string
          laatste_contactdatum?: string | null
          lead_status?: Database["public"]["Enums"]["lead_status"]
          notities?: string | null
          regio?: string[] | null
          telefoon?: string | null
          type_partij?: Database["public"]["Enums"]["relatie_type"]
          updated_at?: string
          verantwoordelijke_id?: string | null
          verkoopintentie?: string | null
          volgende_actie?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relaties_aangemaakt_door_fkey"
            columns: ["aangemaakt_door"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relaties_verantwoordelijke_id_fkey"
            columns: ["verantwoordelijke_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      taken: {
        Row: {
          aangemaakt_door: string | null
          created_at: string
          deadline: string | null
          deal_id: string | null
          id: string
          notities: string | null
          object_id: string | null
          prioriteit: Database["public"]["Enums"]["taak_prioriteit"]
          relatie_id: string | null
          status: Database["public"]["Enums"]["taak_status"]
          titel: string
          type_taak: string | null
          updated_at: string
          verantwoordelijke_id: string | null
        }
        Insert: {
          aangemaakt_door?: string | null
          created_at?: string
          deadline?: string | null
          deal_id?: string | null
          id?: string
          notities?: string | null
          object_id?: string | null
          prioriteit?: Database["public"]["Enums"]["taak_prioriteit"]
          relatie_id?: string | null
          status?: Database["public"]["Enums"]["taak_status"]
          titel: string
          type_taak?: string | null
          updated_at?: string
          verantwoordelijke_id?: string | null
        }
        Update: {
          aangemaakt_door?: string | null
          created_at?: string
          deadline?: string | null
          deal_id?: string | null
          id?: string
          notities?: string | null
          object_id?: string | null
          prioriteit?: Database["public"]["Enums"]["taak_prioriteit"]
          relatie_id?: string | null
          status?: Database["public"]["Enums"]["taak_status"]
          titel?: string
          type_taak?: string | null
          updated_at?: string
          verantwoordelijke_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "taken_aangemaakt_door_fkey"
            columns: ["aangemaakt_door"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taken_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taken_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objecten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taken_relatie_id_fkey"
            columns: ["relatie_id"]
            isOneToOne: false
            referencedRelation: "relaties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taken_verantwoordelijke_id_fkey"
            columns: ["verantwoordelijke_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      zoekprofielen: {
        Row: {
          aanvullende_criteria: string | null
          created_at: string
          id: string
          object_of_portefeuille: string | null
          ontwikkelpotentie: boolean | null
          oppervlakte_max: number | null
          oppervlakte_min: number | null
          prijs_max: number | null
          prijs_min: number | null
          profielnaam: string
          regio: string[] | null
          relatie_id: string
          rendementseis: number | null
          status: Database["public"]["Enums"]["zoekprofiel_status"]
          steden: string[] | null
          transformatiepotentie: boolean | null
          type_vastgoed: Database["public"]["Enums"]["asset_class"][] | null
          updated_at: string
          verhuur_voorkeur: Database["public"]["Enums"]["verhuur_status"] | null
        }
        Insert: {
          aanvullende_criteria?: string | null
          created_at?: string
          id?: string
          object_of_portefeuille?: string | null
          ontwikkelpotentie?: boolean | null
          oppervlakte_max?: number | null
          oppervlakte_min?: number | null
          prijs_max?: number | null
          prijs_min?: number | null
          profielnaam: string
          regio?: string[] | null
          relatie_id: string
          rendementseis?: number | null
          status?: Database["public"]["Enums"]["zoekprofiel_status"]
          steden?: string[] | null
          transformatiepotentie?: boolean | null
          type_vastgoed?: Database["public"]["Enums"]["asset_class"][] | null
          updated_at?: string
          verhuur_voorkeur?:
            | Database["public"]["Enums"]["verhuur_status"]
            | null
        }
        Update: {
          aanvullende_criteria?: string | null
          created_at?: string
          id?: string
          object_of_portefeuille?: string | null
          ontwikkelpotentie?: boolean | null
          oppervlakte_max?: number | null
          oppervlakte_min?: number | null
          prijs_max?: number | null
          prijs_min?: number | null
          profielnaam?: string
          regio?: string[] | null
          relatie_id?: string
          rendementseis?: number | null
          status?: Database["public"]["Enums"]["zoekprofiel_status"]
          steden?: string[] | null
          transformatiepotentie?: boolean | null
          type_vastgoed?: Database["public"]["Enums"]["asset_class"][] | null
          updated_at?: string
          verhuur_voorkeur?:
            | Database["public"]["Enums"]["verhuur_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "zoekprofielen_relatie_id_fkey"
            columns: ["relatie_id"]
            isOneToOne: false
            referencedRelation: "relaties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_intern_gebruiker: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "medewerker"
      asset_class:
        | "wonen"
        | "winkels"
        | "bedrijfshallen"
        | "logistiek"
        | "industrieel"
        | "kantoren"
        | "hotels"
      deal_fase:
        | "lead"
        | "introductie"
        | "interesse"
        | "bezichtiging"
        | "bieding"
        | "onderhandeling"
        | "closing"
        | "afgerond"
        | "afgevallen"
      lead_status: "koud" | "lauw" | "warm" | "actief"
      object_status:
        | "nieuw"
        | "in_voorbereiding"
        | "beschikbaar"
        | "in_onderhandeling"
        | "verkocht"
        | "ingetrokken"
      relatie_type:
        | "belegger"
        | "ontwikkelaar"
        | "eigenaar"
        | "makelaar"
        | "partner"
        | "overig"
      taak_prioriteit: "laag" | "normaal" | "hoog" | "urgent"
      taak_status: "open" | "in_uitvoering" | "afgerond"
      verhuur_status: "verhuurd" | "leeg" | "gedeeltelijk"
      zoekprofiel_status: "actief" | "gepauzeerd" | "gearchiveerd"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "medewerker"],
      asset_class: [
        "wonen",
        "winkels",
        "bedrijfshallen",
        "logistiek",
        "industrieel",
        "kantoren",
        "hotels",
      ],
      deal_fase: [
        "lead",
        "introductie",
        "interesse",
        "bezichtiging",
        "bieding",
        "onderhandeling",
        "closing",
        "afgerond",
        "afgevallen",
      ],
      lead_status: ["koud", "lauw", "warm", "actief"],
      object_status: [
        "nieuw",
        "in_voorbereiding",
        "beschikbaar",
        "in_onderhandeling",
        "verkocht",
        "ingetrokken",
      ],
      relatie_type: [
        "belegger",
        "ontwikkelaar",
        "eigenaar",
        "makelaar",
        "partner",
        "overig",
      ],
      taak_prioriteit: ["laag", "normaal", "hoog", "urgent"],
      taak_status: ["open", "in_uitvoering", "afgerond"],
      verhuur_status: ["verhuurd", "leeg", "gedeeltelijk"],
      zoekprofiel_status: ["actief", "gepauzeerd", "gearchiveerd"],
    },
  },
} as const
