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
      deal_kandidaten: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          notities: string | null
          relatie_id: string
          status: Database["public"]["Enums"]["kandidaat_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          notities?: string | null
          relatie_id: string
          status?: Database["public"]["Enums"]["kandidaat_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          notities?: string | null
          relatie_id?: string
          status?: Database["public"]["Enums"]["kandidaat_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_kandidaten_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_kandidaten_relatie_id_fkey"
            columns: ["relatie_id"]
            isOneToOne: false
            referencedRelation: "relaties"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_objecten: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          is_primair: boolean
          notities: string | null
          object_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          is_primair?: boolean
          notities?: string | null
          object_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          is_primair?: boolean
          notities?: string | null
          object_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_objecten_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_objecten_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "object_huur_metrics"
            referencedColumns: ["object_id"]
          },
          {
            foreignKeyName: "deal_objecten_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objecten"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_referenties: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          notities: string | null
          referentie_object_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          notities?: string | null
          referentie_object_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          notities?: string | null
          referentie_object_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_referenties_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_referenties_referentie_object_id_fkey"
            columns: ["referentie_object_id"]
            isOneToOne: false
            referencedRelation: "referentie_objecten"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          afwijzingsreden: string | null
          bank: string | null
          bezichtiging_gepland: string | null
          commissie_bedrag: number | null
          commissie_pct: number | null
          created_at: string
          datum_eerste_contact: string
          datum_follow_up: string | null
          dd_status: Database["public"]["Enums"]["dd_status"] | null
          fase: Database["public"]["Enums"]["deal_fase"]
          fee_structuur: string | null
          id: string
          indicatief_bod: number | null
          interessegraad: number | null
          notaris: string | null
          notities: string | null
          object_id: string
          relatie_id: string
          soft_deleted_at: string | null
          tegenpartij_makelaar: string | null
          updated_at: string
          verantwoordelijke_id: string | null
          verwachte_closingdatum: string | null
        }
        Insert: {
          afwijzingsreden?: string | null
          bank?: string | null
          bezichtiging_gepland?: string | null
          commissie_bedrag?: number | null
          commissie_pct?: number | null
          created_at?: string
          datum_eerste_contact?: string
          datum_follow_up?: string | null
          dd_status?: Database["public"]["Enums"]["dd_status"] | null
          fase?: Database["public"]["Enums"]["deal_fase"]
          fee_structuur?: string | null
          id?: string
          indicatief_bod?: number | null
          interessegraad?: number | null
          notaris?: string | null
          notities?: string | null
          object_id: string
          relatie_id: string
          soft_deleted_at?: string | null
          tegenpartij_makelaar?: string | null
          updated_at?: string
          verantwoordelijke_id?: string | null
          verwachte_closingdatum?: string | null
        }
        Update: {
          afwijzingsreden?: string | null
          bank?: string | null
          bezichtiging_gepland?: string | null
          commissie_bedrag?: number | null
          commissie_pct?: number | null
          created_at?: string
          datum_eerste_contact?: string
          datum_follow_up?: string | null
          dd_status?: Database["public"]["Enums"]["dd_status"] | null
          fase?: Database["public"]["Enums"]["deal_fase"]
          fee_structuur?: string | null
          id?: string
          indicatief_bod?: number | null
          interessegraad?: number | null
          notaris?: string | null
          notities?: string | null
          object_id?: string
          relatie_id?: string
          soft_deleted_at?: string | null
          tegenpartij_makelaar?: string | null
          updated_at?: string
          verantwoordelijke_id?: string | null
          verwachte_closingdatum?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "object_huur_metrics"
            referencedColumns: ["object_id"]
          },
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
      jaar_doelen: {
        Row: {
          aangemaakt_door: string | null
          commissie_doel_bedrag: number | null
          created_at: string
          dealwaarde_doel_bedrag: number | null
          id: string
          jaar: number
          notities: string | null
          updated_at: string
        }
        Insert: {
          aangemaakt_door?: string | null
          commissie_doel_bedrag?: number | null
          created_at?: string
          dealwaarde_doel_bedrag?: number | null
          id?: string
          jaar: number
          notities?: string | null
          updated_at?: string
        }
        Update: {
          aangemaakt_door?: string | null
          commissie_doel_bedrag?: number | null
          created_at?: string
          dealwaarde_doel_bedrag?: number | null
          id?: string
          jaar?: number
          notities?: string | null
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "object_huur_metrics"
            referencedColumns: ["object_id"]
          },
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
            referencedRelation: "object_huur_metrics"
            referencedColumns: ["object_id"]
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
      object_documenten: {
        Row: {
          bestandsgrootte_bytes: number | null
          bestandsnaam: string
          created_at: string
          documenttype: Database["public"]["Enums"]["document_type"]
          geupload_door: string | null
          id: string
          mime_type: string | null
          notities: string | null
          object_id: string
          storage_path: string
          vertrouwelijk: boolean
        }
        Insert: {
          bestandsgrootte_bytes?: number | null
          bestandsnaam: string
          created_at?: string
          documenttype?: Database["public"]["Enums"]["document_type"]
          geupload_door?: string | null
          id?: string
          mime_type?: string | null
          notities?: string | null
          object_id: string
          storage_path: string
          vertrouwelijk?: boolean
        }
        Update: {
          bestandsgrootte_bytes?: number | null
          bestandsnaam?: string
          created_at?: string
          documenttype?: Database["public"]["Enums"]["document_type"]
          geupload_door?: string | null
          id?: string
          mime_type?: string | null
          notities?: string | null
          object_id?: string
          storage_path?: string
          vertrouwelijk?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "object_documenten_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "object_huur_metrics"
            referencedColumns: ["object_id"]
          },
          {
            foreignKeyName: "object_documenten_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objecten"
            referencedColumns: ["id"]
          },
        ]
      }
      object_fotos: {
        Row: {
          bestandsgrootte_bytes: number | null
          bijschrift: string | null
          created_at: string
          id: string
          is_hoofdfoto: boolean
          object_id: string
          storage_path: string
          updated_at: string
          volgorde: number
        }
        Insert: {
          bestandsgrootte_bytes?: number | null
          bijschrift?: string | null
          created_at?: string
          id?: string
          is_hoofdfoto?: boolean
          object_id: string
          storage_path: string
          updated_at?: string
          volgorde?: number
        }
        Update: {
          bestandsgrootte_bytes?: number | null
          bijschrift?: string | null
          created_at?: string
          id?: string
          is_hoofdfoto?: boolean
          object_id?: string
          storage_path?: string
          updated_at?: string
          volgorde?: number
        }
        Relationships: [
          {
            foreignKeyName: "object_fotos_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "object_huur_metrics"
            referencedColumns: ["object_id"]
          },
          {
            foreignKeyName: "object_fotos_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objecten"
            referencedColumns: ["id"]
          },
        ]
      }
      object_huurders: {
        Row: {
          branche: string | null
          created_at: string
          einddatum: string | null
          huurder_naam: string
          id: string
          indexatie_basis: Database["public"]["Enums"]["indexatie_basis"] | null
          indexatie_pct: number | null
          ingangsdatum: string | null
          jaarhuur: number | null
          notities: string | null
          object_id: string
          oppervlakte_m2: number | null
          opzegmogelijkheid: string | null
          servicekosten_jaar: number | null
          updated_at: string
        }
        Insert: {
          branche?: string | null
          created_at?: string
          einddatum?: string | null
          huurder_naam: string
          id?: string
          indexatie_basis?:
            | Database["public"]["Enums"]["indexatie_basis"]
            | null
          indexatie_pct?: number | null
          ingangsdatum?: string | null
          jaarhuur?: number | null
          notities?: string | null
          object_id: string
          oppervlakte_m2?: number | null
          opzegmogelijkheid?: string | null
          servicekosten_jaar?: number | null
          updated_at?: string
        }
        Update: {
          branche?: string | null
          created_at?: string
          einddatum?: string | null
          huurder_naam?: string
          id?: string
          indexatie_basis?:
            | Database["public"]["Enums"]["indexatie_basis"]
            | null
          indexatie_pct?: number | null
          ingangsdatum?: string | null
          jaarhuur?: number | null
          notities?: string | null
          object_id?: string
          oppervlakte_m2?: number | null
          opzegmogelijkheid?: string | null
          servicekosten_jaar?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "object_huurders_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "object_huur_metrics"
            referencedColumns: ["object_id"]
          },
          {
            foreignKeyName: "object_huurders_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objecten"
            referencedColumns: ["id"]
          },
        ]
      }
      object_subcategorieen: {
        Row: {
          actief: boolean
          asset_class: Database["public"]["Enums"]["asset_class"]
          beschrijving: string | null
          created_at: string
          id: string
          label: string
          subcategorie_key: string
          updated_at: string
          volgorde: number
        }
        Insert: {
          actief?: boolean
          asset_class: Database["public"]["Enums"]["asset_class"]
          beschrijving?: string | null
          created_at?: string
          id?: string
          label: string
          subcategorie_key: string
          updated_at?: string
          volgorde?: number
        }
        Update: {
          actief?: boolean
          asset_class?: Database["public"]["Enums"]["asset_class"]
          beschrijving?: string | null
          created_at?: string
          id?: string
          label?: string
          subcategorie_key?: string
          updated_at?: string
          volgorde?: number
        }
        Relationships: []
      }
      objecten: {
        Row: {
          aangemaakt_door: string | null
          aantal_huurders: number | null
          aantal_units: number | null
          aantal_verdiepingen: number | null
          achterstallig_onderhoud: string | null
          adres: string | null
          anoniem: boolean
          asbestinventarisatie_aanwezig: boolean | null
          beschikbaar_vanaf: string | null
          bestemmingsinformatie: string | null
          bouwjaar: number | null
          bron: string | null
          bruto_aanvangsrendement: number | null
          created_at: string
          documentatie_beschikbaar: boolean | null
          eigenaar_relatie_id: string | null
          eigendomssituatie: string | null
          energielabel: string | null
          energielabel_v2: Database["public"]["Enums"]["energielabel_v2"] | null
          erfpachtinformatie: string | null
          exclusief: boolean | null
          huidig_gebruik: string | null
          huur_per_m2: number | null
          huurinkomsten: number | null
          id: string
          intern_referentienummer: string | null
          intern_vertrouwelijk: boolean | null
          interne_opmerkingen: string | null
          investeringsthese: string | null
          is_portefeuille: boolean
          kadastraal_nummer: string | null
          kadastrale_gemeente: string | null
          kadastrale_sectie: string | null
          leegstand_pct: number | null
          netto_aanvangsrendement: number | null
          noi: number | null
          objectnaam: string
          onderhoudsstaat: string | null
          onderhoudsstaat_niveau:
            | Database["public"]["Enums"]["onderhoudsstaat_niveau"]
            | null
          onderscheidende_kenmerken: string | null
          ontwikkelpotentie: boolean | null
          opmerkingen: string | null
          oppervlakte: number | null
          oppervlakte_bvo: number | null
          oppervlakte_gbo: number | null
          oppervlakte_vvo: number | null
          parent_object_id: string | null
          perceel_oppervlakte: number | null
          plaats: string | null
          postcode: string | null
          prijsindicatie: string | null
          provincie: string | null
          publieke_naam: string | null
          publieke_regio: string | null
          recente_investeringen: string | null
          risicos: string | null
          samenvatting: string | null
          servicekosten_jaar: number | null
          soft_deleted_at: string | null
          status: Database["public"]["Enums"]["object_status"]
          subcategorie: string | null
          subcategorie_id: string | null
          taxatiedatum: string | null
          taxatiewaarde: number | null
          transformatiepotentie: boolean | null
          type_vastgoed: Database["public"]["Enums"]["asset_class"]
          updated_at: string
          verhuurstatus: Database["public"]["Enums"]["verhuur_status"] | null
          verkoopmotivatie: string | null
          verkoper_email: string | null
          verkoper_naam: string | null
          verkoper_rol: string | null
          verkoper_telefoon: string | null
          verkoper_via: Database["public"]["Enums"]["verkoper_via"] | null
          vraagprijs: number | null
          woz_peildatum: string | null
          woz_waarde: number | null
        }
        Insert: {
          aangemaakt_door?: string | null
          aantal_huurders?: number | null
          aantal_units?: number | null
          aantal_verdiepingen?: number | null
          achterstallig_onderhoud?: string | null
          adres?: string | null
          anoniem?: boolean
          asbestinventarisatie_aanwezig?: boolean | null
          beschikbaar_vanaf?: string | null
          bestemmingsinformatie?: string | null
          bouwjaar?: number | null
          bron?: string | null
          bruto_aanvangsrendement?: number | null
          created_at?: string
          documentatie_beschikbaar?: boolean | null
          eigenaar_relatie_id?: string | null
          eigendomssituatie?: string | null
          energielabel?: string | null
          energielabel_v2?:
            | Database["public"]["Enums"]["energielabel_v2"]
            | null
          erfpachtinformatie?: string | null
          exclusief?: boolean | null
          huidig_gebruik?: string | null
          huur_per_m2?: number | null
          huurinkomsten?: number | null
          id?: string
          intern_referentienummer?: string | null
          intern_vertrouwelijk?: boolean | null
          interne_opmerkingen?: string | null
          investeringsthese?: string | null
          is_portefeuille?: boolean
          kadastraal_nummer?: string | null
          kadastrale_gemeente?: string | null
          kadastrale_sectie?: string | null
          leegstand_pct?: number | null
          netto_aanvangsrendement?: number | null
          noi?: number | null
          objectnaam: string
          onderhoudsstaat?: string | null
          onderhoudsstaat_niveau?:
            | Database["public"]["Enums"]["onderhoudsstaat_niveau"]
            | null
          onderscheidende_kenmerken?: string | null
          ontwikkelpotentie?: boolean | null
          opmerkingen?: string | null
          oppervlakte?: number | null
          oppervlakte_bvo?: number | null
          oppervlakte_gbo?: number | null
          oppervlakte_vvo?: number | null
          parent_object_id?: string | null
          perceel_oppervlakte?: number | null
          plaats?: string | null
          postcode?: string | null
          prijsindicatie?: string | null
          provincie?: string | null
          publieke_naam?: string | null
          publieke_regio?: string | null
          recente_investeringen?: string | null
          risicos?: string | null
          samenvatting?: string | null
          servicekosten_jaar?: number | null
          soft_deleted_at?: string | null
          status?: Database["public"]["Enums"]["object_status"]
          subcategorie?: string | null
          subcategorie_id?: string | null
          taxatiedatum?: string | null
          taxatiewaarde?: number | null
          transformatiepotentie?: boolean | null
          type_vastgoed: Database["public"]["Enums"]["asset_class"]
          updated_at?: string
          verhuurstatus?: Database["public"]["Enums"]["verhuur_status"] | null
          verkoopmotivatie?: string | null
          verkoper_email?: string | null
          verkoper_naam?: string | null
          verkoper_rol?: string | null
          verkoper_telefoon?: string | null
          verkoper_via?: Database["public"]["Enums"]["verkoper_via"] | null
          vraagprijs?: number | null
          woz_peildatum?: string | null
          woz_waarde?: number | null
        }
        Update: {
          aangemaakt_door?: string | null
          aantal_huurders?: number | null
          aantal_units?: number | null
          aantal_verdiepingen?: number | null
          achterstallig_onderhoud?: string | null
          adres?: string | null
          anoniem?: boolean
          asbestinventarisatie_aanwezig?: boolean | null
          beschikbaar_vanaf?: string | null
          bestemmingsinformatie?: string | null
          bouwjaar?: number | null
          bron?: string | null
          bruto_aanvangsrendement?: number | null
          created_at?: string
          documentatie_beschikbaar?: boolean | null
          eigenaar_relatie_id?: string | null
          eigendomssituatie?: string | null
          energielabel?: string | null
          energielabel_v2?:
            | Database["public"]["Enums"]["energielabel_v2"]
            | null
          erfpachtinformatie?: string | null
          exclusief?: boolean | null
          huidig_gebruik?: string | null
          huur_per_m2?: number | null
          huurinkomsten?: number | null
          id?: string
          intern_referentienummer?: string | null
          intern_vertrouwelijk?: boolean | null
          interne_opmerkingen?: string | null
          investeringsthese?: string | null
          is_portefeuille?: boolean
          kadastraal_nummer?: string | null
          kadastrale_gemeente?: string | null
          kadastrale_sectie?: string | null
          leegstand_pct?: number | null
          netto_aanvangsrendement?: number | null
          noi?: number | null
          objectnaam?: string
          onderhoudsstaat?: string | null
          onderhoudsstaat_niveau?:
            | Database["public"]["Enums"]["onderhoudsstaat_niveau"]
            | null
          onderscheidende_kenmerken?: string | null
          ontwikkelpotentie?: boolean | null
          opmerkingen?: string | null
          oppervlakte?: number | null
          oppervlakte_bvo?: number | null
          oppervlakte_gbo?: number | null
          oppervlakte_vvo?: number | null
          parent_object_id?: string | null
          perceel_oppervlakte?: number | null
          plaats?: string | null
          postcode?: string | null
          prijsindicatie?: string | null
          provincie?: string | null
          publieke_naam?: string | null
          publieke_regio?: string | null
          recente_investeringen?: string | null
          risicos?: string | null
          samenvatting?: string | null
          servicekosten_jaar?: number | null
          soft_deleted_at?: string | null
          status?: Database["public"]["Enums"]["object_status"]
          subcategorie?: string | null
          subcategorie_id?: string | null
          taxatiedatum?: string | null
          taxatiewaarde?: number | null
          transformatiepotentie?: boolean | null
          type_vastgoed?: Database["public"]["Enums"]["asset_class"]
          updated_at?: string
          verhuurstatus?: Database["public"]["Enums"]["verhuur_status"] | null
          verkoopmotivatie?: string | null
          verkoper_email?: string | null
          verkoper_naam?: string | null
          verkoper_rol?: string | null
          verkoper_telefoon?: string | null
          verkoper_via?: Database["public"]["Enums"]["verkoper_via"] | null
          vraagprijs?: number | null
          woz_peildatum?: string | null
          woz_waarde?: number | null
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
      referentie_objecten: {
        Row: {
          aangemaakt_door: string | null
          adres: string
          asset_class: Database["public"]["Enums"]["asset_class"]
          bouwjaar: number
          bron: string | null
          created_at: string
          energielabel: Database["public"]["Enums"]["energielabel_v2"] | null
          huurprijs_per_jaar: number | null
          huurprijs_per_maand: number | null
          huurstatus: Database["public"]["Enums"]["verhuur_status"] | null
          id: string
          m2: number
          notities: string | null
          plaats: string
          postcode: string
          prijs_per_m2: number | null
          soft_deleted_at: string | null
          updated_at: string
          vraagprijs: number
        }
        Insert: {
          aangemaakt_door?: string | null
          adres: string
          asset_class: Database["public"]["Enums"]["asset_class"]
          bouwjaar: number
          bron?: string | null
          created_at?: string
          energielabel?: Database["public"]["Enums"]["energielabel_v2"] | null
          huurprijs_per_jaar?: number | null
          huurprijs_per_maand?: number | null
          huurstatus?: Database["public"]["Enums"]["verhuur_status"] | null
          id?: string
          m2: number
          notities?: string | null
          plaats: string
          postcode: string
          prijs_per_m2?: number | null
          soft_deleted_at?: string | null
          updated_at?: string
          vraagprijs: number
        }
        Update: {
          aangemaakt_door?: string | null
          adres?: string
          asset_class?: Database["public"]["Enums"]["asset_class"]
          bouwjaar?: number
          bron?: string | null
          created_at?: string
          energielabel?: Database["public"]["Enums"]["energielabel_v2"] | null
          huurprijs_per_jaar?: number | null
          huurprijs_per_maand?: number | null
          huurstatus?: Database["public"]["Enums"]["verhuur_status"] | null
          id?: string
          m2?: number
          notities?: string | null
          plaats?: string
          postcode?: string
          prijs_per_m2?: number | null
          soft_deleted_at?: string | null
          updated_at?: string
          vraagprijs?: number
        }
        Relationships: [
          {
            foreignKeyName: "referentie_objecten_aangemaakt_door_fkey"
            columns: ["aangemaakt_door"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      relatie_contactpersonen: {
        Row: {
          created_at: string
          decision_maker: boolean
          email: string | null
          functie: string | null
          id: string
          is_primair: boolean
          linkedin_url: string | null
          naam: string
          notities: string | null
          relatie_id: string
          telefoon: string | null
          updated_at: string
          voorkeur_kanaal:
            | Database["public"]["Enums"]["communicatie_kanaal"]
            | null
          voorkeur_taal: string | null
        }
        Insert: {
          created_at?: string
          decision_maker?: boolean
          email?: string | null
          functie?: string | null
          id?: string
          is_primair?: boolean
          linkedin_url?: string | null
          naam: string
          notities?: string | null
          relatie_id: string
          telefoon?: string | null
          updated_at?: string
          voorkeur_kanaal?:
            | Database["public"]["Enums"]["communicatie_kanaal"]
            | null
          voorkeur_taal?: string | null
        }
        Update: {
          created_at?: string
          decision_maker?: boolean
          email?: string | null
          functie?: string | null
          id?: string
          is_primair?: boolean
          linkedin_url?: string | null
          naam?: string
          notities?: string | null
          relatie_id?: string
          telefoon?: string | null
          updated_at?: string
          voorkeur_kanaal?:
            | Database["public"]["Enums"]["communicatie_kanaal"]
            | null
          voorkeur_taal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatie_contactpersonen_relatie_id_fkey"
            columns: ["relatie_id"]
            isOneToOne: false
            referencedRelation: "relaties"
            referencedColumns: ["id"]
          },
        ]
      }
      relaties: {
        Row: {
          aangemaakt_door: string | null
          aankoopcriteria: string | null
          asset_classes: Database["public"]["Enums"]["asset_class"][] | null
          bedrijfsnaam: string
          bron_relatie: string | null
          budget_max: number | null
          budget_min: number | null
          contactpersoon: string | null
          created_at: string
          eigen_vermogen_pct: number | null
          email: string | null
          id: string
          investeerder_subtype:
            | Database["public"]["Enums"]["investeerder_subtype"]
            | null
          kapitaalsituatie:
            | Database["public"]["Enums"]["kapitaal_situatie"]
            | null
          kvk_nummer: string | null
          laatste_contactdatum: string | null
          lead_status: Database["public"]["Enums"]["lead_status"]
          linkedin_url: string | null
          nda_datum: string | null
          nda_getekend: boolean
          notities: string | null
          regio: string[] | null
          rendementseis: number | null
          soft_deleted_at: string | null
          telefoon: string | null
          type_partij: Database["public"]["Enums"]["relatie_type"]
          updated_at: string
          verantwoordelijke_id: string | null
          verkoopintentie: string | null
          vestigingsadres: string | null
          vestigingsland: string | null
          vestigingsplaats: string | null
          vestigingspostcode: string | null
          volgende_actie: string | null
          voorkeur_dealstructuur:
            | Database["public"]["Enums"]["dealstructuur"][]
            | null
          voorkeur_kanaal:
            | Database["public"]["Enums"]["communicatie_kanaal"]
            | null
          voorkeur_taal: string | null
          website: string | null
        }
        Insert: {
          aangemaakt_door?: string | null
          aankoopcriteria?: string | null
          asset_classes?: Database["public"]["Enums"]["asset_class"][] | null
          bedrijfsnaam: string
          bron_relatie?: string | null
          budget_max?: number | null
          budget_min?: number | null
          contactpersoon?: string | null
          created_at?: string
          eigen_vermogen_pct?: number | null
          email?: string | null
          id?: string
          investeerder_subtype?:
            | Database["public"]["Enums"]["investeerder_subtype"]
            | null
          kapitaalsituatie?:
            | Database["public"]["Enums"]["kapitaal_situatie"]
            | null
          kvk_nummer?: string | null
          laatste_contactdatum?: string | null
          lead_status?: Database["public"]["Enums"]["lead_status"]
          linkedin_url?: string | null
          nda_datum?: string | null
          nda_getekend?: boolean
          notities?: string | null
          regio?: string[] | null
          rendementseis?: number | null
          soft_deleted_at?: string | null
          telefoon?: string | null
          type_partij?: Database["public"]["Enums"]["relatie_type"]
          updated_at?: string
          verantwoordelijke_id?: string | null
          verkoopintentie?: string | null
          vestigingsadres?: string | null
          vestigingsland?: string | null
          vestigingsplaats?: string | null
          vestigingspostcode?: string | null
          volgende_actie?: string | null
          voorkeur_dealstructuur?:
            | Database["public"]["Enums"]["dealstructuur"][]
            | null
          voorkeur_kanaal?:
            | Database["public"]["Enums"]["communicatie_kanaal"]
            | null
          voorkeur_taal?: string | null
          website?: string | null
        }
        Update: {
          aangemaakt_door?: string | null
          aankoopcriteria?: string | null
          asset_classes?: Database["public"]["Enums"]["asset_class"][] | null
          bedrijfsnaam?: string
          bron_relatie?: string | null
          budget_max?: number | null
          budget_min?: number | null
          contactpersoon?: string | null
          created_at?: string
          eigen_vermogen_pct?: number | null
          email?: string | null
          id?: string
          investeerder_subtype?:
            | Database["public"]["Enums"]["investeerder_subtype"]
            | null
          kapitaalsituatie?:
            | Database["public"]["Enums"]["kapitaal_situatie"]
            | null
          kvk_nummer?: string | null
          laatste_contactdatum?: string | null
          lead_status?: Database["public"]["Enums"]["lead_status"]
          linkedin_url?: string | null
          nda_datum?: string | null
          nda_getekend?: boolean
          notities?: string | null
          regio?: string[] | null
          rendementseis?: number | null
          soft_deleted_at?: string | null
          telefoon?: string | null
          type_partij?: Database["public"]["Enums"]["relatie_type"]
          updated_at?: string
          verantwoordelijke_id?: string | null
          verkoopintentie?: string | null
          vestigingsadres?: string | null
          vestigingsland?: string | null
          vestigingsplaats?: string | null
          vestigingspostcode?: string | null
          volgende_actie?: string | null
          voorkeur_dealstructuur?:
            | Database["public"]["Enums"]["dealstructuur"][]
            | null
          voorkeur_kanaal?:
            | Database["public"]["Enums"]["communicatie_kanaal"]
            | null
          voorkeur_taal?: string | null
          website?: string | null
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
          deadline_tijd: string | null
          deal_id: string | null
          id: string
          notities: string | null
          object_id: string | null
          prioriteit: Database["public"]["Enums"]["taak_prioriteit"]
          relatie_id: string | null
          soft_deleted_at: string | null
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
          deadline_tijd?: string | null
          deal_id?: string | null
          id?: string
          notities?: string | null
          object_id?: string | null
          prioriteit?: Database["public"]["Enums"]["taak_prioriteit"]
          relatie_id?: string | null
          soft_deleted_at?: string | null
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
          deadline_tijd?: string | null
          deal_id?: string | null
          id?: string
          notities?: string | null
          object_id?: string | null
          prioriteit?: Database["public"]["Enums"]["taak_prioriteit"]
          relatie_id?: string | null
          soft_deleted_at?: string | null
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
            referencedRelation: "object_huur_metrics"
            referencedColumns: ["object_id"]
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
          bouwjaar_max: number | null
          bouwjaar_min: number | null
          created_at: string
          energielabel_min:
            | Database["public"]["Enums"]["energielabel_v2"]
            | null
          exclusiviteit_voorkeur:
            | Database["public"]["Enums"]["exclusiviteit_voorkeur"]
            | null
          id: string
          leegstand_max_pct: number | null
          object_of_portefeuille: string | null
          ontwikkelpotentie: boolean | null
          oppervlakte_max: number | null
          oppervlakte_min: number | null
          prijs_max: number | null
          prijs_min: number | null
          prioriteit: number
          profielnaam: string
          regio: string[] | null
          relatie_id: string
          rendementseis: number | null
          status: Database["public"]["Enums"]["zoekprofiel_status"]
          steden: string[] | null
          subcategorie_ids: string[] | null
          transactietype_voorkeur:
            | Database["public"]["Enums"]["transactietype"][]
            | null
          transformatiepotentie: boolean | null
          type_vastgoed: Database["public"]["Enums"]["asset_class"][] | null
          updated_at: string
          verhuur_voorkeur: Database["public"]["Enums"]["verhuur_status"] | null
          walt_min: number | null
        }
        Insert: {
          aanvullende_criteria?: string | null
          bouwjaar_max?: number | null
          bouwjaar_min?: number | null
          created_at?: string
          energielabel_min?:
            | Database["public"]["Enums"]["energielabel_v2"]
            | null
          exclusiviteit_voorkeur?:
            | Database["public"]["Enums"]["exclusiviteit_voorkeur"]
            | null
          id?: string
          leegstand_max_pct?: number | null
          object_of_portefeuille?: string | null
          ontwikkelpotentie?: boolean | null
          oppervlakte_max?: number | null
          oppervlakte_min?: number | null
          prijs_max?: number | null
          prijs_min?: number | null
          prioriteit?: number
          profielnaam: string
          regio?: string[] | null
          relatie_id: string
          rendementseis?: number | null
          status?: Database["public"]["Enums"]["zoekprofiel_status"]
          steden?: string[] | null
          subcategorie_ids?: string[] | null
          transactietype_voorkeur?:
            | Database["public"]["Enums"]["transactietype"][]
            | null
          transformatiepotentie?: boolean | null
          type_vastgoed?: Database["public"]["Enums"]["asset_class"][] | null
          updated_at?: string
          verhuur_voorkeur?:
            | Database["public"]["Enums"]["verhuur_status"]
            | null
          walt_min?: number | null
        }
        Update: {
          aanvullende_criteria?: string | null
          bouwjaar_max?: number | null
          bouwjaar_min?: number | null
          created_at?: string
          energielabel_min?:
            | Database["public"]["Enums"]["energielabel_v2"]
            | null
          exclusiviteit_voorkeur?:
            | Database["public"]["Enums"]["exclusiviteit_voorkeur"]
            | null
          id?: string
          leegstand_max_pct?: number | null
          object_of_portefeuille?: string | null
          ontwikkelpotentie?: boolean | null
          oppervlakte_max?: number | null
          oppervlakte_min?: number | null
          prijs_max?: number | null
          prijs_min?: number | null
          prioriteit?: number
          profielnaam?: string
          regio?: string[] | null
          relatie_id?: string
          rendementseis?: number | null
          status?: Database["public"]["Enums"]["zoekprofiel_status"]
          steden?: string[] | null
          subcategorie_ids?: string[] | null
          transactietype_voorkeur?:
            | Database["public"]["Enums"]["transactietype"][]
            | null
          transformatiepotentie?: boolean | null
          type_vastgoed?: Database["public"]["Enums"]["asset_class"][] | null
          updated_at?: string
          verhuur_voorkeur?:
            | Database["public"]["Enums"]["verhuur_status"]
            | null
          walt_min?: number | null
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
      object_huur_metrics: {
        Row: {
          aantal_huurders: number | null
          object_id: string | null
          totale_jaarhuur: number | null
          verhuurde_m2: number | null
          walb_jaren: number | null
          walt_jaren: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_refnummer: { Args: never; Returns: string }
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
        | "zorgvastgoed"
        | "mixed_use"
        | "ontwikkellocatie"
      communicatie_kanaal:
        | "whatsapp"
        | "email"
        | "telefoon"
        | "signal"
        | "linkedin"
      dd_status:
        | "niet_gestart"
        | "in_uitvoering"
        | "afgerond"
        | "niet_van_toepassing"
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
      dealstructuur: "direct" | "jv" | "fonds" | "asset_deal" | "share_deal"
      document_type:
        | "huurovereenkomst"
        | "taxatierapport"
        | "mjop"
        | "asbestinventarisatie"
        | "bouwkundig_rapport"
        | "energielabel_rapport"
        | "informatiememorandum"
        | "plattegrond"
        | "kadasterbericht"
        | "wozbeschikking"
        | "jaarrekening_huurder"
        | "fotorapport"
        | "dd_overzicht"
        | "anders"
      energielabel_v2:
        | "A++++"
        | "A+++"
        | "A++"
        | "A+"
        | "A"
        | "B"
        | "C"
        | "D"
        | "E"
        | "F"
        | "G"
        | "onbekend"
      exclusiviteit_voorkeur: "alleen_off_market" | "beide" | "geen_voorkeur"
      indexatie_basis: "CPI" | "vast_pct" | "geen" | "custom"
      investeerder_subtype:
        | "private_belegger"
        | "hnwi"
        | "family_office"
        | "institutioneel"
        | "fonds"
        | "bv"
        | "nv"
        | "cv"
      kandidaat_status:
        | "geinteresseerd"
        | "bezichtiging"
        | "bod"
        | "afgevallen"
        | "gewonnen"
      kapitaal_situatie:
        | "cash_ready"
        | "financiering_vereist"
        | "hybride"
        | "onbekend"
      lead_status: "koud" | "lauw" | "warm" | "actief"
      object_status:
        | "nieuw"
        | "in_voorbereiding"
        | "beschikbaar"
        | "in_onderhandeling"
        | "verkocht"
        | "ingetrokken"
      onderhoudsstaat_niveau:
        | "uitstekend"
        | "goed"
        | "redelijk"
        | "matig"
        | "slecht"
      relatie_type:
        | "belegger"
        | "ontwikkelaar"
        | "eigenaar"
        | "makelaar"
        | "partner"
        | "overig"
      taak_prioriteit: "laag" | "normaal" | "hoog" | "urgent"
      taak_status: "open" | "in_uitvoering" | "afgerond"
      transactietype:
        | "losse_aankoop"
        | "portefeuille"
        | "jv"
        | "asset_deal"
        | "share_deal"
      verhuur_status: "verhuurd" | "leeg" | "gedeeltelijk"
      verkoper_via:
        | "rechtstreeks_eigenaar"
        | "via_makelaar"
        | "via_beheerder"
        | "via_adviseur"
        | "via_netwerk"
        | "onbekend"
      zoekprofiel_status: "actief" | "gepauzeerd" | "gearchiveerd" | "pauze"
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
        "zorgvastgoed",
        "mixed_use",
        "ontwikkellocatie",
      ],
      communicatie_kanaal: [
        "whatsapp",
        "email",
        "telefoon",
        "signal",
        "linkedin",
      ],
      dd_status: [
        "niet_gestart",
        "in_uitvoering",
        "afgerond",
        "niet_van_toepassing",
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
      dealstructuur: ["direct", "jv", "fonds", "asset_deal", "share_deal"],
      document_type: [
        "huurovereenkomst",
        "taxatierapport",
        "mjop",
        "asbestinventarisatie",
        "bouwkundig_rapport",
        "energielabel_rapport",
        "informatiememorandum",
        "plattegrond",
        "kadasterbericht",
        "wozbeschikking",
        "jaarrekening_huurder",
        "fotorapport",
        "dd_overzicht",
        "anders",
      ],
      energielabel_v2: [
        "A++++",
        "A+++",
        "A++",
        "A+",
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "onbekend",
      ],
      exclusiviteit_voorkeur: ["alleen_off_market", "beide", "geen_voorkeur"],
      indexatie_basis: ["CPI", "vast_pct", "geen", "custom"],
      investeerder_subtype: [
        "private_belegger",
        "hnwi",
        "family_office",
        "institutioneel",
        "fonds",
        "bv",
        "nv",
        "cv",
      ],
      kandidaat_status: [
        "geinteresseerd",
        "bezichtiging",
        "bod",
        "afgevallen",
        "gewonnen",
      ],
      kapitaal_situatie: [
        "cash_ready",
        "financiering_vereist",
        "hybride",
        "onbekend",
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
      onderhoudsstaat_niveau: [
        "uitstekend",
        "goed",
        "redelijk",
        "matig",
        "slecht",
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
      transactietype: [
        "losse_aankoop",
        "portefeuille",
        "jv",
        "asset_deal",
        "share_deal",
      ],
      verhuur_status: ["verhuurd", "leeg", "gedeeltelijk"],
      verkoper_via: [
        "rechtstreeks_eigenaar",
        "via_makelaar",
        "via_beheerder",
        "via_adviseur",
        "via_netwerk",
        "onbekend",
      ],
      zoekprofiel_status: ["actief", "gepauzeerd", "gearchiveerd", "pauze"],
    },
  },
} as const
