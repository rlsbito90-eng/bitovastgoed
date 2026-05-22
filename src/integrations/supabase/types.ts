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
      acquisitie_campagnes: {
        Row: {
          aangemaakt_door: string | null
          created_at: string
          gebied: string | null
          id: string
          kanaal: Database["public"]["Enums"]["campagne_kanaal"]
          naam: string
          notities: string | null
          startdatum: string | null
          status: Database["public"]["Enums"]["campagne_status"]
          updated_at: string
        }
        Insert: {
          aangemaakt_door?: string | null
          created_at?: string
          gebied?: string | null
          id?: string
          kanaal?: Database["public"]["Enums"]["campagne_kanaal"]
          naam: string
          notities?: string | null
          startdatum?: string | null
          status?: Database["public"]["Enums"]["campagne_status"]
          updated_at?: string
        }
        Update: {
          aangemaakt_door?: string | null
          created_at?: string
          gebied?: string | null
          id?: string
          kanaal?: Database["public"]["Enums"]["campagne_kanaal"]
          naam?: string
          notities?: string | null
          startdatum?: string | null
          status?: Database["public"]["Enums"]["campagne_status"]
          updated_at?: string
        }
        Relationships: []
      }
      acquisitie_targets: {
        Row: {
          aangemaakt_door: string | null
          adres: string | null
          bron: string | null
          campagne_id: string | null
          created_at: string
          eigenaar_bekend: Database["public"]["Enums"]["eigenaar_bekend"]
          eigenaar_woont_op_adres: Database["public"]["Enums"]["eigenaar_bekend"]
          id: string
          laatste_actie_datum: string | null
          notities: string | null
          object_id: string | null
          plaats: string | null
          postcode: string | null
          prioriteit: number
          reden_interessant: string | null
          relatie_id: string | null
          status: Database["public"]["Enums"]["acquisitie_status"]
          type_vastgoed: string | null
          updated_at: string
          volgende_actie_datum: string | null
          volgende_actie_omschrijving: string | null
          wijk: string | null
        }
        Insert: {
          aangemaakt_door?: string | null
          adres?: string | null
          bron?: string | null
          campagne_id?: string | null
          created_at?: string
          eigenaar_bekend?: Database["public"]["Enums"]["eigenaar_bekend"]
          eigenaar_woont_op_adres?: Database["public"]["Enums"]["eigenaar_bekend"]
          id?: string
          laatste_actie_datum?: string | null
          notities?: string | null
          object_id?: string | null
          plaats?: string | null
          postcode?: string | null
          prioriteit?: number
          reden_interessant?: string | null
          relatie_id?: string | null
          status?: Database["public"]["Enums"]["acquisitie_status"]
          type_vastgoed?: string | null
          updated_at?: string
          volgende_actie_datum?: string | null
          volgende_actie_omschrijving?: string | null
          wijk?: string | null
        }
        Update: {
          aangemaakt_door?: string | null
          adres?: string | null
          bron?: string | null
          campagne_id?: string | null
          created_at?: string
          eigenaar_bekend?: Database["public"]["Enums"]["eigenaar_bekend"]
          eigenaar_woont_op_adres?: Database["public"]["Enums"]["eigenaar_bekend"]
          id?: string
          laatste_actie_datum?: string | null
          notities?: string | null
          object_id?: string | null
          plaats?: string | null
          postcode?: string | null
          prioriteit?: number
          reden_interessant?: string | null
          relatie_id?: string | null
          status?: Database["public"]["Enums"]["acquisitie_status"]
          type_vastgoed?: string | null
          updated_at?: string
          volgende_actie_datum?: string | null
          volgende_actie_omschrijving?: string | null
          wijk?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acquisitie_targets_campagne_id_fkey"
            columns: ["campagne_id"]
            isOneToOne: false
            referencedRelation: "acquisitie_campagnes"
            referencedColumns: ["id"]
          },
        ]
      }
      biedingen: {
        Row: {
          aangemaakt_door: string | null
          accepted_at: string | null
          bedrag: number | null
          bieddatum: string
          bron: string | null
          counter_offer_to_id: string | null
          created_at: string
          currency: string
          dd_voorbehoud: Database["public"]["Enums"]["voorbehoud_status"]
          deal_id: string | null
          expired_at: string | null
          financieringsvoorbehoud: Database["public"]["Enums"]["voorbehoud_status"]
          geldig_tot: string | null
          gewenste_levering: string | null
          gewenste_levering_tekst: string | null
          id: string
          interne_notities: string | null
          is_best_offer: boolean
          is_final_offer: boolean
          kosten_type: string | null
          notities: string | null
          object_id: string
          object_pipeline_id: string | null
          offer_type: Database["public"]["Enums"]["biedingtype"]
          rejected_at: string | null
          rejected_reason: string | null
          relatie_id: string
          status: Database["public"]["Enums"]["biedingstatus"]
          updated_at: string
          voorwaarden: string | null
          waarborgsom_bedrag: number | null
          waarborgsom_pct: number | null
          withdrawn_at: string | null
        }
        Insert: {
          aangemaakt_door?: string | null
          accepted_at?: string | null
          bedrag?: number | null
          bieddatum?: string
          bron?: string | null
          counter_offer_to_id?: string | null
          created_at?: string
          currency?: string
          dd_voorbehoud?: Database["public"]["Enums"]["voorbehoud_status"]
          deal_id?: string | null
          expired_at?: string | null
          financieringsvoorbehoud?: Database["public"]["Enums"]["voorbehoud_status"]
          geldig_tot?: string | null
          gewenste_levering?: string | null
          gewenste_levering_tekst?: string | null
          id?: string
          interne_notities?: string | null
          is_best_offer?: boolean
          is_final_offer?: boolean
          kosten_type?: string | null
          notities?: string | null
          object_id: string
          object_pipeline_id?: string | null
          offer_type?: Database["public"]["Enums"]["biedingtype"]
          rejected_at?: string | null
          rejected_reason?: string | null
          relatie_id: string
          status?: Database["public"]["Enums"]["biedingstatus"]
          updated_at?: string
          voorwaarden?: string | null
          waarborgsom_bedrag?: number | null
          waarborgsom_pct?: number | null
          withdrawn_at?: string | null
        }
        Update: {
          aangemaakt_door?: string | null
          accepted_at?: string | null
          bedrag?: number | null
          bieddatum?: string
          bron?: string | null
          counter_offer_to_id?: string | null
          created_at?: string
          currency?: string
          dd_voorbehoud?: Database["public"]["Enums"]["voorbehoud_status"]
          deal_id?: string | null
          expired_at?: string | null
          financieringsvoorbehoud?: Database["public"]["Enums"]["voorbehoud_status"]
          geldig_tot?: string | null
          gewenste_levering?: string | null
          gewenste_levering_tekst?: string | null
          id?: string
          interne_notities?: string | null
          is_best_offer?: boolean
          is_final_offer?: boolean
          kosten_type?: string | null
          notities?: string | null
          object_id?: string
          object_pipeline_id?: string | null
          offer_type?: Database["public"]["Enums"]["biedingtype"]
          rejected_at?: string | null
          rejected_reason?: string | null
          relatie_id?: string
          status?: Database["public"]["Enums"]["biedingstatus"]
          updated_at?: string
          voorwaarden?: string | null
          waarborgsom_bedrag?: number | null
          waarborgsom_pct?: number | null
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      calculation_components: {
        Row: {
          allocated_component_value: number | null
          component_name: string
          component_type: Database["public"]["Enums"]["vr_component_type"]
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string
          current_annual_rent: number | null
          current_monthly_rent: number | null
          expected_sale_value_rented: number | null
          expected_sale_value_vacant: number | null
          floor_or_location: string | null
          has_contract: boolean | null
          id: string
          market_annual_rent: number | null
          market_monthly_rent: number | null
          notes: string | null
          rent_per_m2: number | null
          sale_per_unit_possible: boolean | null
          scenario_id: string
          surface_bvo: number | null
          surface_gbo: number | null
          surface_vvo: number | null
          tenant_name: string | null
          transfer_tax_allocation_method:
            | Database["public"]["Enums"]["vr_ovb_allocation_method"]
            | null
          transfer_tax_amount: number | null
          transfer_tax_classification:
            | Database["public"]["Enums"]["vr_ovb_classification"]
            | null
          transfer_tax_manual_override: boolean | null
          transfer_tax_percentage: number | null
          uitpond_relevant: boolean | null
          updated_at: string
          vacant: boolean | null
          wws_relevant: boolean | null
        }
        Insert: {
          allocated_component_value?: number | null
          component_name: string
          component_type?: Database["public"]["Enums"]["vr_component_type"]
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          current_annual_rent?: number | null
          current_monthly_rent?: number | null
          expected_sale_value_rented?: number | null
          expected_sale_value_vacant?: number | null
          floor_or_location?: string | null
          has_contract?: boolean | null
          id?: string
          market_annual_rent?: number | null
          market_monthly_rent?: number | null
          notes?: string | null
          rent_per_m2?: number | null
          sale_per_unit_possible?: boolean | null
          scenario_id: string
          surface_bvo?: number | null
          surface_gbo?: number | null
          surface_vvo?: number | null
          tenant_name?: string | null
          transfer_tax_allocation_method?:
            | Database["public"]["Enums"]["vr_ovb_allocation_method"]
            | null
          transfer_tax_amount?: number | null
          transfer_tax_classification?:
            | Database["public"]["Enums"]["vr_ovb_classification"]
            | null
          transfer_tax_manual_override?: boolean | null
          transfer_tax_percentage?: number | null
          uitpond_relevant?: boolean | null
          updated_at?: string
          vacant?: boolean | null
          wws_relevant?: boolean | null
        }
        Update: {
          allocated_component_value?: number | null
          component_name?: string
          component_type?: Database["public"]["Enums"]["vr_component_type"]
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          current_annual_rent?: number | null
          current_monthly_rent?: number | null
          expected_sale_value_rented?: number | null
          expected_sale_value_vacant?: number | null
          floor_or_location?: string | null
          has_contract?: boolean | null
          id?: string
          market_annual_rent?: number | null
          market_monthly_rent?: number | null
          notes?: string | null
          rent_per_m2?: number | null
          sale_per_unit_possible?: boolean | null
          scenario_id?: string
          surface_bvo?: number | null
          surface_gbo?: number | null
          surface_vvo?: number | null
          tenant_name?: string | null
          transfer_tax_allocation_method?:
            | Database["public"]["Enums"]["vr_ovb_allocation_method"]
            | null
          transfer_tax_amount?: number | null
          transfer_tax_classification?:
            | Database["public"]["Enums"]["vr_ovb_classification"]
            | null
          transfer_tax_manual_override?: boolean | null
          transfer_tax_percentage?: number | null
          uitpond_relevant?: boolean | null
          updated_at?: string
          vacant?: boolean | null
          wws_relevant?: boolean | null
        }
        Relationships: []
      }
      calculation_outputs: {
        Row: {
          aggressive_bid: number | null
          bar_purchase_price: number | null
          bar_total_investment: number | null
          complexity_score:
            | Database["public"]["Enums"]["vr_complexity_level"]
            | null
          conclusion: string | null
          conservative_bid: number | null
          corrected_annual_rent: number | null
          created_at: string
          current_annual_rent: number | null
          deal_score: Database["public"]["Enums"]["vr_deal_score"] | null
          difference_with_asking_price: number | null
          exit_value: number | null
          factor_purchase_price: number | null
          factor_total_investment: number | null
          id: string
          input_reliability:
            | Database["public"]["Enums"]["vr_input_reliability"]
            | null
          market_annual_rent: number | null
          maximum_all_in_value: number | null
          maximum_bid: number | null
          noi: number | null
          not_interesting_above: number | null
          price_per_m2_bvo: number | null
          price_per_m2_gbo: number | null
          price_per_m2_vvo: number | null
          profit: number | null
          profit_margin: number | null
          realistic_bid: number | null
          recommended_next_step: string | null
          required_discount: number | null
          risk_score: Database["public"]["Enums"]["vr_risk_level"] | null
          scenario_id: string
          total_acquisition_costs: number | null
          total_costs: number | null
          total_investment: number | null
          total_transfer_tax: number | null
          updated_at: string
          warnings: Json | null
          wws_corrected_annual_rent: number | null
        }
        Insert: {
          aggressive_bid?: number | null
          bar_purchase_price?: number | null
          bar_total_investment?: number | null
          complexity_score?:
            | Database["public"]["Enums"]["vr_complexity_level"]
            | null
          conclusion?: string | null
          conservative_bid?: number | null
          corrected_annual_rent?: number | null
          created_at?: string
          current_annual_rent?: number | null
          deal_score?: Database["public"]["Enums"]["vr_deal_score"] | null
          difference_with_asking_price?: number | null
          exit_value?: number | null
          factor_purchase_price?: number | null
          factor_total_investment?: number | null
          id?: string
          input_reliability?:
            | Database["public"]["Enums"]["vr_input_reliability"]
            | null
          market_annual_rent?: number | null
          maximum_all_in_value?: number | null
          maximum_bid?: number | null
          noi?: number | null
          not_interesting_above?: number | null
          price_per_m2_bvo?: number | null
          price_per_m2_gbo?: number | null
          price_per_m2_vvo?: number | null
          profit?: number | null
          profit_margin?: number | null
          realistic_bid?: number | null
          recommended_next_step?: string | null
          required_discount?: number | null
          risk_score?: Database["public"]["Enums"]["vr_risk_level"] | null
          scenario_id: string
          total_acquisition_costs?: number | null
          total_costs?: number | null
          total_investment?: number | null
          total_transfer_tax?: number | null
          updated_at?: string
          warnings?: Json | null
          wws_corrected_annual_rent?: number | null
        }
        Update: {
          aggressive_bid?: number | null
          bar_purchase_price?: number | null
          bar_total_investment?: number | null
          complexity_score?:
            | Database["public"]["Enums"]["vr_complexity_level"]
            | null
          conclusion?: string | null
          conservative_bid?: number | null
          corrected_annual_rent?: number | null
          created_at?: string
          current_annual_rent?: number | null
          deal_score?: Database["public"]["Enums"]["vr_deal_score"] | null
          difference_with_asking_price?: number | null
          exit_value?: number | null
          factor_purchase_price?: number | null
          factor_total_investment?: number | null
          id?: string
          input_reliability?:
            | Database["public"]["Enums"]["vr_input_reliability"]
            | null
          market_annual_rent?: number | null
          maximum_all_in_value?: number | null
          maximum_bid?: number | null
          noi?: number | null
          not_interesting_above?: number | null
          price_per_m2_bvo?: number | null
          price_per_m2_gbo?: number | null
          price_per_m2_vvo?: number | null
          profit?: number | null
          profit_margin?: number | null
          realistic_bid?: number | null
          recommended_next_step?: string | null
          required_discount?: number | null
          risk_score?: Database["public"]["Enums"]["vr_risk_level"] | null
          scenario_id?: string
          total_acquisition_costs?: number | null
          total_costs?: number | null
          total_investment?: number | null
          total_transfer_tax?: number | null
          updated_at?: string
          warnings?: Json | null
          wws_corrected_annual_rent?: number | null
        }
        Relationships: []
      }
      calculation_scenarios: {
        Row: {
          advisory_costs: number | null
          asking_price: number | null
          assumption_profile: string | null
          assumption_profile_reason: string | null
          assumptions_manual: boolean | null
          assumptions_reliability: string | null
          assumptions_source: string | null
          buyer_fee_amount: number | null
          buyer_fee_percentage: number | null
          buyer_fee_vat_percentage: number | null
          calculation_id: string
          contract_checked: boolean | null
          cost_structure: string | null
          created_at: string
          current_monthly_rent: number | null
          description: string | null
          due_diligence_costs: number | null
          financing_costs: number | null
          id: string
          incentive_reserve: boolean | null
          maintenance_reserve_percentage: number | null
          management_cost_percentage: number | null
          manual_corrected_monthly_rent: number | null
          market_monthly_rent: number | null
          mjop_present: string | null
          notary_costs: number | null
          notes: string | null
          object_id: string
          operating_cost_percentage: number | null
          other_acquisition_costs: number | null
          other_annual_costs: number | null
          ovb_classification: Database["public"]["Enums"]["vr_ovb_classification"]
          ovb_mode: Database["public"]["Enums"]["vr_ovb_mode"]
          purchase_price: number | null
          rent_choice:
            | Database["public"]["Enums"]["vr_huurtype_voor_bieding"]
            | null
          rent_source: string | null
          safety_margin: number | null
          scenario_name: string
          service_costs_checked: boolean | null
          status: Database["public"]["Enums"]["vr_calc_status"]
          strategy_type: Database["public"]["Enums"]["vr_strategy_type"]
          target_bar: number | null
          target_factor: number | null
          target_margin: number | null
          transfer_tax_amount: number | null
          transfer_tax_percentage: number | null
          unforeseen_percentage: number | null
          updated_at: string
          vacancy_percentage: number | null
        }
        Insert: {
          advisory_costs?: number | null
          asking_price?: number | null
          assumption_profile?: string | null
          assumption_profile_reason?: string | null
          assumptions_manual?: boolean | null
          assumptions_reliability?: string | null
          assumptions_source?: string | null
          buyer_fee_amount?: number | null
          buyer_fee_percentage?: number | null
          buyer_fee_vat_percentage?: number | null
          calculation_id: string
          contract_checked?: boolean | null
          cost_structure?: string | null
          created_at?: string
          current_monthly_rent?: number | null
          description?: string | null
          due_diligence_costs?: number | null
          financing_costs?: number | null
          id?: string
          incentive_reserve?: boolean | null
          maintenance_reserve_percentage?: number | null
          management_cost_percentage?: number | null
          manual_corrected_monthly_rent?: number | null
          market_monthly_rent?: number | null
          mjop_present?: string | null
          notary_costs?: number | null
          notes?: string | null
          object_id: string
          operating_cost_percentage?: number | null
          other_acquisition_costs?: number | null
          other_annual_costs?: number | null
          ovb_classification?: Database["public"]["Enums"]["vr_ovb_classification"]
          ovb_mode?: Database["public"]["Enums"]["vr_ovb_mode"]
          purchase_price?: number | null
          rent_choice?:
            | Database["public"]["Enums"]["vr_huurtype_voor_bieding"]
            | null
          rent_source?: string | null
          safety_margin?: number | null
          scenario_name: string
          service_costs_checked?: boolean | null
          status?: Database["public"]["Enums"]["vr_calc_status"]
          strategy_type?: Database["public"]["Enums"]["vr_strategy_type"]
          target_bar?: number | null
          target_factor?: number | null
          target_margin?: number | null
          transfer_tax_amount?: number | null
          transfer_tax_percentage?: number | null
          unforeseen_percentage?: number | null
          updated_at?: string
          vacancy_percentage?: number | null
        }
        Update: {
          advisory_costs?: number | null
          asking_price?: number | null
          assumption_profile?: string | null
          assumption_profile_reason?: string | null
          assumptions_manual?: boolean | null
          assumptions_reliability?: string | null
          assumptions_source?: string | null
          buyer_fee_amount?: number | null
          buyer_fee_percentage?: number | null
          buyer_fee_vat_percentage?: number | null
          calculation_id?: string
          contract_checked?: boolean | null
          cost_structure?: string | null
          created_at?: string
          current_monthly_rent?: number | null
          description?: string | null
          due_diligence_costs?: number | null
          financing_costs?: number | null
          id?: string
          incentive_reserve?: boolean | null
          maintenance_reserve_percentage?: number | null
          management_cost_percentage?: number | null
          manual_corrected_monthly_rent?: number | null
          market_monthly_rent?: number | null
          mjop_present?: string | null
          notary_costs?: number | null
          notes?: string | null
          object_id?: string
          operating_cost_percentage?: number | null
          other_acquisition_costs?: number | null
          other_annual_costs?: number | null
          ovb_classification?: Database["public"]["Enums"]["vr_ovb_classification"]
          ovb_mode?: Database["public"]["Enums"]["vr_ovb_mode"]
          purchase_price?: number | null
          rent_choice?:
            | Database["public"]["Enums"]["vr_huurtype_voor_bieding"]
            | null
          rent_source?: string | null
          safety_margin?: number | null
          scenario_name?: string
          service_costs_checked?: boolean | null
          status?: Database["public"]["Enums"]["vr_calc_status"]
          strategy_type?: Database["public"]["Enums"]["vr_strategy_type"]
          target_bar?: number | null
          target_factor?: number | null
          target_margin?: number | null
          transfer_tax_amount?: number | null
          transfer_tax_percentage?: number | null
          unforeseen_percentage?: number | null
          updated_at?: string
          vacancy_percentage?: number | null
        }
        Relationships: []
      }
      contact_moments: {
        Row: {
          aangemaakt_door: string | null
          acquisitie_target_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          direction: Database["public"]["Enums"]["contact_moment_direction"]
          follow_up_date: string | null
          follow_up_required: boolean
          id: string
          is_system: boolean
          moment_date: string
          moment_time: string | null
          object_id: string | null
          outcome: string | null
          relatie_id: string | null
          system_key: string | null
          taak_id: string | null
          title: string
          type: Database["public"]["Enums"]["contact_moment_type"]
          updated_at: string
        }
        Insert: {
          aangemaakt_door?: string | null
          acquisitie_target_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["contact_moment_direction"]
          follow_up_date?: string | null
          follow_up_required?: boolean
          id?: string
          is_system?: boolean
          moment_date?: string
          moment_time?: string | null
          object_id?: string | null
          outcome?: string | null
          relatie_id?: string | null
          system_key?: string | null
          taak_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["contact_moment_type"]
          updated_at?: string
        }
        Update: {
          aangemaakt_door?: string | null
          acquisitie_target_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["contact_moment_direction"]
          follow_up_date?: string | null
          follow_up_required?: boolean
          id?: string
          is_system?: boolean
          moment_date?: string
          moment_time?: string | null
          object_id?: string | null
          outcome?: string | null
          relatie_id?: string | null
          system_key?: string | null
          taak_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["contact_moment_type"]
          updated_at?: string
        }
        Relationships: []
      }
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
      deal_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      deals: {
        Row: {
          afwijzingsreden: string | null
          archived_at: string | null
          archived_note: string | null
          archived_reason: string | null
          bank: string | null
          bezichtiging_gepland: string | null
          bezichtiging_tijd: string | null
          closed_at: string | null
          commissie_bedrag: number | null
          commissie_pct: number | null
          created_at: string
          datum_eerste_contact: string
          datum_follow_up: string | null
          dd_status: Database["public"]["Enums"]["dd_status"] | null
          fase: Database["public"]["Enums"]["deal_fase"]
          fee_structuur: string | null
          follow_up_tijd: string | null
          id: string
          indicatief_bod: number | null
          interessegraad: number | null
          is_archived: boolean
          notaris: string | null
          notities: string | null
          object_id: string
          referentieanalyse_zichtbaar: boolean
          relatie_id: string
          soft_deleted_at: string | null
          tegenpartij_makelaar: string | null
          updated_at: string
          verantwoordelijke_id: string | null
          verwachte_closingdatum: string | null
        }
        Insert: {
          afwijzingsreden?: string | null
          archived_at?: string | null
          archived_note?: string | null
          archived_reason?: string | null
          bank?: string | null
          bezichtiging_gepland?: string | null
          bezichtiging_tijd?: string | null
          closed_at?: string | null
          commissie_bedrag?: number | null
          commissie_pct?: number | null
          created_at?: string
          datum_eerste_contact?: string
          datum_follow_up?: string | null
          dd_status?: Database["public"]["Enums"]["dd_status"] | null
          fase?: Database["public"]["Enums"]["deal_fase"]
          fee_structuur?: string | null
          follow_up_tijd?: string | null
          id?: string
          indicatief_bod?: number | null
          interessegraad?: number | null
          is_archived?: boolean
          notaris?: string | null
          notities?: string | null
          object_id: string
          referentieanalyse_zichtbaar?: boolean
          relatie_id: string
          soft_deleted_at?: string | null
          tegenpartij_makelaar?: string | null
          updated_at?: string
          verantwoordelijke_id?: string | null
          verwachte_closingdatum?: string | null
        }
        Update: {
          afwijzingsreden?: string | null
          archived_at?: string | null
          archived_note?: string | null
          archived_reason?: string | null
          bank?: string | null
          bezichtiging_gepland?: string | null
          bezichtiging_tijd?: string | null
          closed_at?: string | null
          commissie_bedrag?: number | null
          commissie_pct?: number | null
          created_at?: string
          datum_eerste_contact?: string
          datum_follow_up?: string | null
          dd_status?: Database["public"]["Enums"]["dd_status"] | null
          fase?: Database["public"]["Enums"]["deal_fase"]
          fee_structuur?: string | null
          follow_up_tijd?: string | null
          id?: string
          indicatief_bod?: number | null
          interessegraad?: number | null
          is_archived?: boolean
          notaris?: string | null
          notities?: string | null
          object_id?: string
          referentieanalyse_zichtbaar?: boolean
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
      exit_assumptions: {
        Row: {
          created_at: string
          exit_factor: number | null
          exit_type: string | null
          exit_year: number | null
          exit_yield: number | null
          expected_rent_at_exit: number | null
          expected_sale_value: number | null
          id: string
          net_exit_value: number | null
          profit: number | null
          profit_margin: number | null
          scenario_id: string
          selling_cost_amount: number | null
          selling_cost_percentage: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          exit_factor?: number | null
          exit_type?: string | null
          exit_year?: number | null
          exit_yield?: number | null
          expected_rent_at_exit?: number | null
          expected_sale_value?: number | null
          id?: string
          net_exit_value?: number | null
          profit?: number | null
          profit_margin?: number | null
          scenario_id: string
          selling_cost_amount?: number | null
          selling_cost_percentage?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          exit_factor?: number | null
          exit_type?: string | null
          exit_year?: number | null
          exit_yield?: number | null
          expected_rent_at_exit?: number | null
          expected_sale_value?: number | null
          id?: string
          net_exit_value?: number | null
          profit?: number | null
          profit_margin?: number | null
          scenario_id?: string
          selling_cost_amount?: number | null
          selling_cost_percentage?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      feed_tokens: {
        Row: {
          aangemaakt_op: string
          gebruiker_id: string
          id: string
          ingetrokken_op: string | null
          laatst_gebruikt: string | null
          naam: string
          token: string
        }
        Insert: {
          aangemaakt_op?: string
          gebruiker_id: string
          id?: string
          ingetrokken_op?: string | null
          laatst_gebruikt?: string | null
          naam?: string
          token: string
        }
        Update: {
          aangemaakt_op?: string
          gebruiker_id?: string
          id?: string
          ingetrokken_op?: string | null
          laatst_gebruikt?: string | null
          naam?: string
          token?: string
        }
        Relationships: []
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
      object_aanbiedingsteksten: {
        Row: {
          created_at: string
          email_tekst: string | null
          externe_aandachtspunten: string | null
          fee_tekst: string | null
          highlights: string | null
          id: string
          korte_teaser: string | null
          nda_tekst: string | null
          object_id: string
          uitgebreide_omschrijving: string | null
          updated_at: string
          whatsapp_tekst: string | null
        }
        Insert: {
          created_at?: string
          email_tekst?: string | null
          externe_aandachtspunten?: string | null
          fee_tekst?: string | null
          highlights?: string | null
          id?: string
          korte_teaser?: string | null
          nda_tekst?: string | null
          object_id: string
          uitgebreide_omschrijving?: string | null
          updated_at?: string
          whatsapp_tekst?: string | null
        }
        Update: {
          created_at?: string
          email_tekst?: string | null
          externe_aandachtspunten?: string | null
          fee_tekst?: string | null
          highlights?: string | null
          id?: string
          korte_teaser?: string | null
          nda_tekst?: string | null
          object_id?: string
          uitgebreide_omschrijving?: string | null
          updated_at?: string
          whatsapp_tekst?: string | null
        }
        Relationships: []
      }
      object_aandachtspunten: {
        Row: {
          created_at: string
          ernst: string | null
          id: string
          intern_only: boolean
          notitie: string | null
          object_id: string
          status: string
          titel: string
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ernst?: string | null
          id?: string
          intern_only?: boolean
          notitie?: string | null
          object_id: string
          status?: string
          titel: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ernst?: string | null
          id?: string
          intern_only?: boolean
          notitie?: string | null
          object_id?: string
          status?: string
          titel?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
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
      object_dossier_items: {
        Row: {
          bron: string | null
          category: string
          created_at: string
          document_id: string | null
          id: string
          is_custom: boolean
          item_key: string
          label: string | null
          notitie: string | null
          object_id: string
          opgevraagd_op: string | null
          status: string | null
          updated_at: string
          weight: number
        }
        Insert: {
          bron?: string | null
          category: string
          created_at?: string
          document_id?: string | null
          id?: string
          is_custom?: boolean
          item_key: string
          label?: string | null
          notitie?: string | null
          object_id: string
          opgevraagd_op?: string | null
          status?: string | null
          updated_at?: string
          weight?: number
        }
        Update: {
          bron?: string | null
          category?: string
          created_at?: string
          document_id?: string | null
          id?: string
          is_custom?: boolean
          item_key?: string
          label?: string | null
          notitie?: string | null
          object_id?: string
          opgevraagd_op?: string | null
          status?: string | null
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      object_fotos: {
        Row: {
          bestandsgrootte_bytes: number | null
          bijschrift: string | null
          created_at: string
          id: string
          is_hoofdfoto: boolean
          is_plattegrond: boolean
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
          is_plattegrond?: boolean
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
          is_plattegrond?: boolean
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
      object_pipeline: {
        Row: {
          aangemaakt_door: string | null
          bezichtiging_datum: string | null
          bieding_bedrag: number | null
          bieding_voorwaarden: string | null
          created_at: string
          fee_akkoord: boolean
          financieringsvoorbehoud: boolean | null
          gewenste_levering: string | null
          id: string
          informatie_gedeeld: boolean
          informatie_gedeeld_op: string | null
          interesse_niveau: Database["public"]["Enums"]["interesse_niveau"]
          laatste_contactdatum: string | null
          matchscore: number | null
          nda_getekend: boolean
          nda_getekend_op: string | null
          nda_verstuurd: boolean
          nda_verstuurd_op: string | null
          notities: string | null
          object_id: string
          pipeline_fase: Database["public"]["Enums"]["pipeline_fase"]
          reden_afgevallen: string | null
          relatie_id: string
          soft_deleted_at: string | null
          teaser_verstuurd: boolean
          teaser_verstuurd_op: string | null
          updated_at: string
          volgende_actie:
            | Database["public"]["Enums"]["volgende_actie_type"]
            | null
          volgende_actie_datum: string | null
          volgende_actie_omschrijving: string | null
          zoekprofiel_id: string | null
        }
        Insert: {
          aangemaakt_door?: string | null
          bezichtiging_datum?: string | null
          bieding_bedrag?: number | null
          bieding_voorwaarden?: string | null
          created_at?: string
          fee_akkoord?: boolean
          financieringsvoorbehoud?: boolean | null
          gewenste_levering?: string | null
          id?: string
          informatie_gedeeld?: boolean
          informatie_gedeeld_op?: string | null
          interesse_niveau?: Database["public"]["Enums"]["interesse_niveau"]
          laatste_contactdatum?: string | null
          matchscore?: number | null
          nda_getekend?: boolean
          nda_getekend_op?: string | null
          nda_verstuurd?: boolean
          nda_verstuurd_op?: string | null
          notities?: string | null
          object_id: string
          pipeline_fase?: Database["public"]["Enums"]["pipeline_fase"]
          reden_afgevallen?: string | null
          relatie_id: string
          soft_deleted_at?: string | null
          teaser_verstuurd?: boolean
          teaser_verstuurd_op?: string | null
          updated_at?: string
          volgende_actie?:
            | Database["public"]["Enums"]["volgende_actie_type"]
            | null
          volgende_actie_datum?: string | null
          volgende_actie_omschrijving?: string | null
          zoekprofiel_id?: string | null
        }
        Update: {
          aangemaakt_door?: string | null
          bezichtiging_datum?: string | null
          bieding_bedrag?: number | null
          bieding_voorwaarden?: string | null
          created_at?: string
          fee_akkoord?: boolean
          financieringsvoorbehoud?: boolean | null
          gewenste_levering?: string | null
          id?: string
          informatie_gedeeld?: boolean
          informatie_gedeeld_op?: string | null
          interesse_niveau?: Database["public"]["Enums"]["interesse_niveau"]
          laatste_contactdatum?: string | null
          matchscore?: number | null
          nda_getekend?: boolean
          nda_getekend_op?: string | null
          nda_verstuurd?: boolean
          nda_verstuurd_op?: string | null
          notities?: string | null
          object_id?: string
          pipeline_fase?: Database["public"]["Enums"]["pipeline_fase"]
          reden_afgevallen?: string | null
          relatie_id?: string
          soft_deleted_at?: string | null
          teaser_verstuurd?: boolean
          teaser_verstuurd_op?: string | null
          updated_at?: string
          volgende_actie?:
            | Database["public"]["Enums"]["volgende_actie_type"]
            | null
          volgende_actie_datum?: string | null
          volgende_actie_omschrijving?: string | null
          zoekprofiel_id?: string | null
        }
        Relationships: []
      }
      object_referenties: {
        Row: {
          created_at: string
          id: string
          notities: string | null
          object_id: string
          referentie_object_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notities?: string | null
          object_id: string
          referentie_object_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notities?: string | null
          object_id?: string
          referentie_object_id?: string
        }
        Relationships: []
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
          aanbiedingswijze: Database["public"]["Enums"]["aanbiedingswijze"]
          aangemaakt_door: string | null
          aantal_huurders: number | null
          aantal_units: number | null
          aantal_verdiepingen: number | null
          achterstallig_onderhoud: string | null
          acquisitie_target_id: string | null
          adres: string | null
          anoniem: boolean
          archived_at: string | null
          archived_note: string | null
          archived_reason: string | null
          asbestinventarisatie_aanwezig: boolean | null
          beschikbaar_vanaf: string | null
          bestemmingsinformatie: string | null
          bouwjaar: number | null
          bron: string | null
          bruto_aanvangsrendement: number | null
          contact_email: string | null
          contact_functie: string | null
          contact_naam: string | null
          contact_telefoon: string | null
          created_at: string
          dataroom_url: string | null
          deal_type_ids: string[]
          documentatie_beschikbaar: boolean | null
          documentatie_status: Json
          eigenaar_relatie_id: string | null
          eigendomssituatie: string | null
          energielabel: string | null
          energielabel_v2: Database["public"]["Enums"]["energielabel_v2"] | null
          erfpachtinformatie: string | null
          exclusief: boolean | null
          financiele_scenarios: Json
          huidig_gebruik: string | null
          huur_per_m2: number | null
          huurinkomsten: number | null
          id: string
          im_secties_zichtbaar: Json
          intern_referentienummer: string | null
          intern_vertrouwelijk: boolean | null
          interne_opmerkingen: string | null
          investeringsthese: string | null
          is_archived: boolean
          is_portefeuille: boolean
          kadastraal_nummer: string | null
          kadastrale_gemeente: string | null
          kadastrale_sectie: string | null
          leegstand_pct: number | null
          locatie_omschrijving: string | null
          marktwaarde_bron: string | null
          marktwaarde_indicatie: number | null
          netto_aanvangsrendement: number | null
          noi: number | null
          objectnaam: string
          objectomschrijving: string | null
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
          oppervlakten_per_verdieping: Json
          parent_object_id: string | null
          perceel_oppervlakte: number | null
          pipeline_id: string | null
          pipeline_stage_id: string | null
          pipeline_stage_locked: boolean
          pipeline_updated_at: string | null
          plaats: string | null
          postcode: string | null
          prijsindicatie: string | null
          proces_voorwaarden: string | null
          property_subtype_ids: string[]
          property_type_id: string | null
          propositie: string | null
          provincie: string | null
          publieke_naam: string | null
          publieke_regio: string | null
          recente_investeringen: string | null
          referentieanalyse_zichtbaar: boolean
          risicos: string | null
          samenvatting: string | null
          servicekosten_jaar: number | null
          soft_deleted_at: string | null
          status: Database["public"]["Enums"]["object_status"]
          subcategorie: string | null
          subcategorie_id: string | null
          taxatiedatum: string | null
          taxatiewaarde: number | null
          technische_staat_omschrijving: string | null
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
          aanbiedingswijze?: Database["public"]["Enums"]["aanbiedingswijze"]
          aangemaakt_door?: string | null
          aantal_huurders?: number | null
          aantal_units?: number | null
          aantal_verdiepingen?: number | null
          achterstallig_onderhoud?: string | null
          acquisitie_target_id?: string | null
          adres?: string | null
          anoniem?: boolean
          archived_at?: string | null
          archived_note?: string | null
          archived_reason?: string | null
          asbestinventarisatie_aanwezig?: boolean | null
          beschikbaar_vanaf?: string | null
          bestemmingsinformatie?: string | null
          bouwjaar?: number | null
          bron?: string | null
          bruto_aanvangsrendement?: number | null
          contact_email?: string | null
          contact_functie?: string | null
          contact_naam?: string | null
          contact_telefoon?: string | null
          created_at?: string
          dataroom_url?: string | null
          deal_type_ids?: string[]
          documentatie_beschikbaar?: boolean | null
          documentatie_status?: Json
          eigenaar_relatie_id?: string | null
          eigendomssituatie?: string | null
          energielabel?: string | null
          energielabel_v2?:
            | Database["public"]["Enums"]["energielabel_v2"]
            | null
          erfpachtinformatie?: string | null
          exclusief?: boolean | null
          financiele_scenarios?: Json
          huidig_gebruik?: string | null
          huur_per_m2?: number | null
          huurinkomsten?: number | null
          id?: string
          im_secties_zichtbaar?: Json
          intern_referentienummer?: string | null
          intern_vertrouwelijk?: boolean | null
          interne_opmerkingen?: string | null
          investeringsthese?: string | null
          is_archived?: boolean
          is_portefeuille?: boolean
          kadastraal_nummer?: string | null
          kadastrale_gemeente?: string | null
          kadastrale_sectie?: string | null
          leegstand_pct?: number | null
          locatie_omschrijving?: string | null
          marktwaarde_bron?: string | null
          marktwaarde_indicatie?: number | null
          netto_aanvangsrendement?: number | null
          noi?: number | null
          objectnaam: string
          objectomschrijving?: string | null
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
          oppervlakten_per_verdieping?: Json
          parent_object_id?: string | null
          perceel_oppervlakte?: number | null
          pipeline_id?: string | null
          pipeline_stage_id?: string | null
          pipeline_stage_locked?: boolean
          pipeline_updated_at?: string | null
          plaats?: string | null
          postcode?: string | null
          prijsindicatie?: string | null
          proces_voorwaarden?: string | null
          property_subtype_ids?: string[]
          property_type_id?: string | null
          propositie?: string | null
          provincie?: string | null
          publieke_naam?: string | null
          publieke_regio?: string | null
          recente_investeringen?: string | null
          referentieanalyse_zichtbaar?: boolean
          risicos?: string | null
          samenvatting?: string | null
          servicekosten_jaar?: number | null
          soft_deleted_at?: string | null
          status?: Database["public"]["Enums"]["object_status"]
          subcategorie?: string | null
          subcategorie_id?: string | null
          taxatiedatum?: string | null
          taxatiewaarde?: number | null
          technische_staat_omschrijving?: string | null
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
          aanbiedingswijze?: Database["public"]["Enums"]["aanbiedingswijze"]
          aangemaakt_door?: string | null
          aantal_huurders?: number | null
          aantal_units?: number | null
          aantal_verdiepingen?: number | null
          achterstallig_onderhoud?: string | null
          acquisitie_target_id?: string | null
          adres?: string | null
          anoniem?: boolean
          archived_at?: string | null
          archived_note?: string | null
          archived_reason?: string | null
          asbestinventarisatie_aanwezig?: boolean | null
          beschikbaar_vanaf?: string | null
          bestemmingsinformatie?: string | null
          bouwjaar?: number | null
          bron?: string | null
          bruto_aanvangsrendement?: number | null
          contact_email?: string | null
          contact_functie?: string | null
          contact_naam?: string | null
          contact_telefoon?: string | null
          created_at?: string
          dataroom_url?: string | null
          deal_type_ids?: string[]
          documentatie_beschikbaar?: boolean | null
          documentatie_status?: Json
          eigenaar_relatie_id?: string | null
          eigendomssituatie?: string | null
          energielabel?: string | null
          energielabel_v2?:
            | Database["public"]["Enums"]["energielabel_v2"]
            | null
          erfpachtinformatie?: string | null
          exclusief?: boolean | null
          financiele_scenarios?: Json
          huidig_gebruik?: string | null
          huur_per_m2?: number | null
          huurinkomsten?: number | null
          id?: string
          im_secties_zichtbaar?: Json
          intern_referentienummer?: string | null
          intern_vertrouwelijk?: boolean | null
          interne_opmerkingen?: string | null
          investeringsthese?: string | null
          is_archived?: boolean
          is_portefeuille?: boolean
          kadastraal_nummer?: string | null
          kadastrale_gemeente?: string | null
          kadastrale_sectie?: string | null
          leegstand_pct?: number | null
          locatie_omschrijving?: string | null
          marktwaarde_bron?: string | null
          marktwaarde_indicatie?: number | null
          netto_aanvangsrendement?: number | null
          noi?: number | null
          objectnaam?: string
          objectomschrijving?: string | null
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
          oppervlakten_per_verdieping?: Json
          parent_object_id?: string | null
          perceel_oppervlakte?: number | null
          pipeline_id?: string | null
          pipeline_stage_id?: string | null
          pipeline_stage_locked?: boolean
          pipeline_updated_at?: string | null
          plaats?: string | null
          postcode?: string | null
          prijsindicatie?: string | null
          proces_voorwaarden?: string | null
          property_subtype_ids?: string[]
          property_type_id?: string | null
          propositie?: string | null
          provincie?: string | null
          publieke_naam?: string | null
          publieke_regio?: string | null
          recente_investeringen?: string | null
          referentieanalyse_zichtbaar?: boolean
          risicos?: string | null
          samenvatting?: string | null
          servicekosten_jaar?: number | null
          soft_deleted_at?: string | null
          status?: Database["public"]["Enums"]["object_status"]
          subcategorie?: string | null
          subcategorie_id?: string | null
          taxatiedatum?: string | null
          taxatiewaarde?: number | null
          technische_staat_omschrijving?: string | null
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
          {
            foreignKeyName: "objecten_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objecten_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objecten_property_type_id_fkey"
            columns: ["property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          is_lost: boolean
          is_won: boolean
          name: string
          pipeline_id: string
          probability: number | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_lost?: boolean
          is_won?: boolean
          name: string
          pipeline_id: string
          probability?: number | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_lost?: boolean
          is_won?: boolean
          name?: string
          pipeline_id?: string
          probability?: number | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          entity_type: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
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
      property_subtypes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          property_type_id: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          property_type_id: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          property_type_id?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_subtypes_property_type_id_fkey"
            columns: ["property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
        ]
      }
      property_type_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          mapped_property_subtype_id: string | null
          mapped_property_type_id: string | null
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          mapped_property_subtype_id?: string | null
          mapped_property_type_id?: string | null
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          mapped_property_subtype_id?: string | null
          mapped_property_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_type_aliases_mapped_property_subtype_id_fkey"
            columns: ["mapped_property_subtype_id"]
            isOneToOne: false
            referencedRelation: "property_subtypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_type_aliases_mapped_property_type_id_fkey"
            columns: ["mapped_property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
        ]
      }
      property_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      real_estate_calculations: {
        Row: {
          calculation_name: string
          created_at: string
          created_by: string | null
          id: string
          input_reliability: Database["public"]["Enums"]["vr_input_reliability"]
          main_strategy: Database["public"]["Enums"]["vr_strategy_type"]
          notes: string | null
          object_id: string
          object_type: Database["public"]["Enums"]["vr_object_type"]
          status: Database["public"]["Enums"]["vr_calc_status"]
          updated_at: string
        }
        Insert: {
          calculation_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          input_reliability?: Database["public"]["Enums"]["vr_input_reliability"]
          main_strategy?: Database["public"]["Enums"]["vr_strategy_type"]
          notes?: string | null
          object_id: string
          object_type?: Database["public"]["Enums"]["vr_object_type"]
          status?: Database["public"]["Enums"]["vr_calc_status"]
          updated_at?: string
        }
        Update: {
          calculation_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          input_reliability?: Database["public"]["Enums"]["vr_input_reliability"]
          main_strategy?: Database["public"]["Enums"]["vr_strategy_type"]
          notes?: string | null
          object_id?: string
          object_type?: Database["public"]["Enums"]["vr_object_type"]
          status?: Database["public"]["Enums"]["vr_calc_status"]
          updated_at?: string
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
          telefoon_mobiel: string | null
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
          telefoon_mobiel?: string | null
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
          telefoon_mobiel?: string | null
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
          deal_type_ids: string[]
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
          property_subtype_ids: string[]
          property_type_ids: string[]
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
          deal_type_ids?: string[]
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
          property_subtype_ids?: string[]
          property_type_ids?: string[]
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
          deal_type_ids?: string[]
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
          property_subtype_ids?: string[]
          property_type_ids?: string[]
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
      residential_wws_units: {
        Row: {
          bathroom_quality:
            | Database["public"]["Enums"]["vr_quality_level"]
            | null
          component_id: string | null
          contract_start_date: string | null
          cooling: boolean | null
          corrected_annual_rent: number | null
          corrected_monthly_rent: number | null
          created_at: string
          current_monthly_rent: number | null
          energy_label: string | null
          energy_label_date: string | null
          floor: string | null
          heating_type: string | null
          id: string
          independent_unit: boolean | null
          kitchen_quality:
            | Database["public"]["Enums"]["vr_quality_level"]
            | null
          living_area_m2: number | null
          monument_status: boolean | null
          notes: string | null
          other_indoor_space_m2: number | null
          outdoor_space_m2: number | null
          parking: boolean | null
          protected_cityscape: boolean | null
          reliability_status:
            | Database["public"]["Enums"]["vr_input_reliability"]
            | null
          rent_segment: Database["public"]["Enums"]["vr_rent_segment"] | null
          report_available: boolean | null
          report_date: string | null
          report_source: string | null
          rooms: number | null
          scenario_id: string
          service_costs: number | null
          storage: boolean | null
          unit_name: string
          updated_at: string
          vacant: boolean | null
          woz_reference_date: string | null
          woz_value: number | null
          wws_max_annual_rent: number | null
          wws_max_monthly_rent: number | null
          wws_points: number | null
        }
        Insert: {
          bathroom_quality?:
            | Database["public"]["Enums"]["vr_quality_level"]
            | null
          component_id?: string | null
          contract_start_date?: string | null
          cooling?: boolean | null
          corrected_annual_rent?: number | null
          corrected_monthly_rent?: number | null
          created_at?: string
          current_monthly_rent?: number | null
          energy_label?: string | null
          energy_label_date?: string | null
          floor?: string | null
          heating_type?: string | null
          id?: string
          independent_unit?: boolean | null
          kitchen_quality?:
            | Database["public"]["Enums"]["vr_quality_level"]
            | null
          living_area_m2?: number | null
          monument_status?: boolean | null
          notes?: string | null
          other_indoor_space_m2?: number | null
          outdoor_space_m2?: number | null
          parking?: boolean | null
          protected_cityscape?: boolean | null
          reliability_status?:
            | Database["public"]["Enums"]["vr_input_reliability"]
            | null
          rent_segment?: Database["public"]["Enums"]["vr_rent_segment"] | null
          report_available?: boolean | null
          report_date?: string | null
          report_source?: string | null
          rooms?: number | null
          scenario_id: string
          service_costs?: number | null
          storage?: boolean | null
          unit_name: string
          updated_at?: string
          vacant?: boolean | null
          woz_reference_date?: string | null
          woz_value?: number | null
          wws_max_annual_rent?: number | null
          wws_max_monthly_rent?: number | null
          wws_points?: number | null
        }
        Update: {
          bathroom_quality?:
            | Database["public"]["Enums"]["vr_quality_level"]
            | null
          component_id?: string | null
          contract_start_date?: string | null
          cooling?: boolean | null
          corrected_annual_rent?: number | null
          corrected_monthly_rent?: number | null
          created_at?: string
          current_monthly_rent?: number | null
          energy_label?: string | null
          energy_label_date?: string | null
          floor?: string | null
          heating_type?: string | null
          id?: string
          independent_unit?: boolean | null
          kitchen_quality?:
            | Database["public"]["Enums"]["vr_quality_level"]
            | null
          living_area_m2?: number | null
          monument_status?: boolean | null
          notes?: string | null
          other_indoor_space_m2?: number | null
          outdoor_space_m2?: number | null
          parking?: boolean | null
          protected_cityscape?: boolean | null
          reliability_status?:
            | Database["public"]["Enums"]["vr_input_reliability"]
            | null
          rent_segment?: Database["public"]["Enums"]["vr_rent_segment"] | null
          report_available?: boolean | null
          report_date?: string | null
          report_source?: string | null
          rooms?: number | null
          scenario_id?: string
          service_costs?: number | null
          storage?: boolean | null
          unit_name?: string
          updated_at?: string
          vacant?: boolean | null
          woz_reference_date?: string | null
          woz_value?: number | null
          wws_max_annual_rent?: number | null
          wws_max_monthly_rent?: number | null
          wws_points?: number | null
        }
        Relationships: []
      }
      risk_analysis: {
        Row: {
          action_required: boolean | null
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          responsible_person: string | null
          risk_category: string
          risk_level: Database["public"]["Enums"]["vr_risk_level"]
          scenario_id: string
          updated_at: string
        }
        Insert: {
          action_required?: boolean | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          responsible_person?: string | null
          risk_category: string
          risk_level?: Database["public"]["Enums"]["vr_risk_level"]
          scenario_id: string
          updated_at?: string
        }
        Update: {
          action_required?: boolean | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          responsible_person?: string | null
          risk_category?: string
          risk_level?: Database["public"]["Enums"]["vr_risk_level"]
          scenario_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      scenario_costs: {
        Row: {
          amount: number
          cost_category: string
          created_at: string
          description: string | null
          id: string
          notes: string | null
          reliability_status:
            | Database["public"]["Enums"]["vr_input_reliability"]
            | null
          scenario_id: string
          updated_at: string
          vat_applicable: boolean | null
        }
        Insert: {
          amount?: number
          cost_category: string
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          reliability_status?:
            | Database["public"]["Enums"]["vr_input_reliability"]
            | null
          scenario_id: string
          updated_at?: string
          vat_applicable?: boolean | null
        }
        Update: {
          amount?: number
          cost_category?: string
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          reliability_status?:
            | Database["public"]["Enums"]["vr_input_reliability"]
            | null
          scenario_id?: string
          updated_at?: string
          vat_applicable?: boolean | null
        }
        Relationships: []
      }
      sell_off_units: {
        Row: {
          component_id: string | null
          created_at: string
          current_rent: number | null
          expected_sale_period_months: number | null
          expected_sale_value_rented: number | null
          expected_sale_value_vacant: number | null
          id: string
          lease_term: string | null
          legal_costs: number | null
          net_sale_proceeds: number | null
          notes: string | null
          renovation_costs: number | null
          risk_level: Database["public"]["Enums"]["vr_risk_level"] | null
          sale_value_per_m2: number | null
          scenario_id: string
          selling_cost_amount: number | null
          selling_cost_percentage: number | null
          splitting_costs: number | null
          surface_bvo: number | null
          surface_gbo: number | null
          surface_vvo: number | null
          unit_name: string
          unit_type: Database["public"]["Enums"]["vr_component_type"] | null
          updated_at: string
          vacant_or_rented: boolean | null
          wws_points: number | null
          wws_segment: Database["public"]["Enums"]["vr_rent_segment"] | null
        }
        Insert: {
          component_id?: string | null
          created_at?: string
          current_rent?: number | null
          expected_sale_period_months?: number | null
          expected_sale_value_rented?: number | null
          expected_sale_value_vacant?: number | null
          id?: string
          lease_term?: string | null
          legal_costs?: number | null
          net_sale_proceeds?: number | null
          notes?: string | null
          renovation_costs?: number | null
          risk_level?: Database["public"]["Enums"]["vr_risk_level"] | null
          sale_value_per_m2?: number | null
          scenario_id: string
          selling_cost_amount?: number | null
          selling_cost_percentage?: number | null
          splitting_costs?: number | null
          surface_bvo?: number | null
          surface_gbo?: number | null
          surface_vvo?: number | null
          unit_name: string
          unit_type?: Database["public"]["Enums"]["vr_component_type"] | null
          updated_at?: string
          vacant_or_rented?: boolean | null
          wws_points?: number | null
          wws_segment?: Database["public"]["Enums"]["vr_rent_segment"] | null
        }
        Update: {
          component_id?: string | null
          created_at?: string
          current_rent?: number | null
          expected_sale_period_months?: number | null
          expected_sale_value_rented?: number | null
          expected_sale_value_vacant?: number | null
          id?: string
          lease_term?: string | null
          legal_costs?: number | null
          net_sale_proceeds?: number | null
          notes?: string | null
          renovation_costs?: number | null
          risk_level?: Database["public"]["Enums"]["vr_risk_level"] | null
          sale_value_per_m2?: number | null
          scenario_id?: string
          selling_cost_amount?: number | null
          selling_cost_percentage?: number | null
          splitting_costs?: number | null
          surface_bvo?: number | null
          surface_gbo?: number | null
          surface_vvo?: number | null
          unit_name?: string
          unit_type?: Database["public"]["Enums"]["vr_component_type"] | null
          updated_at?: string
          vacant_or_rented?: boolean | null
          wws_points?: number | null
          wws_segment?: Database["public"]["Enums"]["vr_rent_segment"] | null
        }
        Relationships: []
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
      user_calculation_preferences: {
        Row: {
          created_at: string
          default_buyer_fee_percentage: number | null
          default_operating_cost_percentage: number | null
          default_target_bar: number | null
          default_vacancy_percentage: number | null
          id: string
          updated_at: string
          user_id: string
          vastgoedrekenen_view_mode: Database["public"]["Enums"]["vr_view_mode"]
        }
        Insert: {
          created_at?: string
          default_buyer_fee_percentage?: number | null
          default_operating_cost_percentage?: number | null
          default_target_bar?: number | null
          default_vacancy_percentage?: number | null
          id?: string
          updated_at?: string
          user_id: string
          vastgoedrekenen_view_mode?: Database["public"]["Enums"]["vr_view_mode"]
        }
        Update: {
          created_at?: string
          default_buyer_fee_percentage?: number | null
          default_operating_cost_percentage?: number | null
          default_target_bar?: number | null
          default_vacancy_percentage?: number | null
          id?: string
          updated_at?: string
          user_id?: string
          vastgoedrekenen_view_mode?: Database["public"]["Enums"]["vr_view_mode"]
        }
        Relationships: []
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
      vastgoedrekenen_tax_settings: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          setting_name: string
          transfer_tax_non_residential_percentage: number
          transfer_tax_primary_residence_percentage: number
          transfer_tax_residential_investment_percentage: number
          updated_at: string
          wws_euro_per_point: number
        }
        Insert: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          setting_name?: string
          transfer_tax_non_residential_percentage?: number
          transfer_tax_primary_residence_percentage?: number
          transfer_tax_residential_investment_percentage?: number
          updated_at?: string
          wws_euro_per_point?: number
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          setting_name?: string
          transfer_tax_non_residential_percentage?: number
          transfer_tax_primary_residence_percentage?: number
          transfer_tax_residential_investment_percentage?: number
          updated_at?: string
          wws_euro_per_point?: number
        }
        Relationships: []
      }
      zoekprofielen: {
        Row: {
          aanvullende_criteria: string | null
          bouwjaar_max: number | null
          bouwjaar_min: number | null
          created_at: string
          deal_type_ids: string[]
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
          property_subtype_ids_v2: string[]
          property_type_ids: string[]
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
          deal_type_ids?: string[]
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
          property_subtype_ids_v2?: string[]
          property_type_ids?: string[]
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
          deal_type_ids?: string[]
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
          property_subtype_ids_v2?: string[]
          property_type_ids?: string[]
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
      aanbiedingswijze:
        | "off_market"
        | "stille_verkoop"
        | "openbaar"
        | "via_makelaar"
      acquisitie_status:
        | "target_gevonden"
        | "eigenaar_achterhalen"
        | "eerste_benadering"
        | "follow_up_gepland"
        | "reactie_ontvangen"
        | "verkoopbereidheid_peilen"
        | "potentiele_verkooppositie"
        | "object_aangemaakt"
        | "niet_interessant"
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
      biedingstatus:
        | "concept"
        | "ontvangen"
        | "in_behandeling"
        | "tegenvoorstel_gedaan"
        | "aangepast_bod_gevraagd"
        | "geaccepteerd"
        | "afgewezen"
        | "ingetrokken"
        | "verlopen"
      biedingtype:
        | "indicatief"
        | "openingsbod"
        | "voorwaardelijk"
        | "onvoorwaardelijk"
        | "eindbod"
        | "tegenvoorstel"
        | "verhoogd_bod"
        | "schriftelijk"
        | "mondeling"
      campagne_kanaal:
        | "brief"
        | "bellen"
        | "linkedin"
        | "email"
        | "netwerk"
        | "anders"
      campagne_status: "concept" | "actief" | "gepauzeerd" | "afgerond"
      communicatie_kanaal:
        | "whatsapp"
        | "email"
        | "telefoon"
        | "signal"
        | "linkedin"
      contact_moment_direction: "inkomend" | "uitgaand" | "intern" | "n_v_t"
      contact_moment_type:
        | "telefoon"
        | "email"
        | "whatsapp"
        | "linkedin"
        | "afspraak"
        | "bezichtiging"
        | "notitie"
        | "document_gedeeld"
        | "teaser_verstuurd"
        | "nda_verstuurd"
        | "nda_ontvangen"
        | "informatie_gedeeld"
        | "bod_ontvangen"
        | "bod_uitgebracht"
        | "status_gewijzigd"
        | "taak_aangemaakt"
        | "taak_afgerond"
        | "kandidaat_toegevoegd"
        | "archief"
        | "algemeen"
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
      eigenaar_bekend: "ja" | "nee" | "onbekend"
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
      interesse_niveau: "koud" | "lauw" | "warm" | "zeer_warm"
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
        | "te_beoordelen"
        | "beschikbaar"
        | "on_hold"
        | "onder_optie"
        | "verkocht"
        | "ingetrokken"
        | "afgevallen"
      onderhoudsstaat_niveau:
        | "uitstekend"
        | "goed"
        | "redelijk"
        | "matig"
        | "slecht"
      pipeline_fase:
        | "match_gevonden"
        | "teaser_verstuurd"
        | "interesse_ontvangen"
        | "nda_verstuurd"
        | "nda_getekend"
        | "informatie_gedeeld"
        | "bezichtiging_gepland"
        | "bezichtiging_geweest"
        | "indicatieve_bieding"
        | "onderhandeling"
        | "loi_ontvangen"
        | "due_diligence"
        | "koopovereenkomst_concept"
        | "koopovereenkomst_getekend"
        | "transport_closing"
        | "afgerond"
        | "afgevallen"
      relatie_type:
        | "belegger"
        | "ontwikkelaar"
        | "eigenaar"
        | "makelaar"
        | "partner"
        | "overig"
      taak_prioriteit: "laag" | "normaal" | "hoog" | "urgent"
      taak_status:
        | "open"
        | "in_uitvoering"
        | "afgerond"
        | "wacht_op_reactie"
        | "geannuleerd"
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
      volgende_actie_type:
        | "bellen"
        | "mailen"
        | "whatsapp"
        | "nda_sturen"
        | "stukken_delen"
        | "bezichtiging_plannen"
        | "bieding_opvolgen"
        | "onderhandelen"
        | "overig"
      voorbehoud_status: "geen" | "ja" | "onbekend" | "nader_te_bepalen"
      vr_calc_status:
        | "concept"
        | "indicatief"
        | "gecontroleerd"
        | "voor_bieding"
        | "afgewezen"
        | "afgerond"
      vr_complexity_level: "laag" | "middel" | "hoog" | "zeer_hoog"
      vr_component_type:
        | "woning"
        | "appartement"
        | "winkelruimte"
        | "kantoorruimte"
        | "bedrijfsruimte"
        | "bedrijfsunit"
        | "opslagruimte"
        | "kelder"
        | "parkeerplaats"
        | "garagebox"
        | "berging"
        | "horeca"
        | "maatschappelijk"
        | "ontwikkelgrond"
        | "overig"
      vr_deal_score: "A" | "B" | "C" | "reject"
      vr_huurtype_voor_bieding: "huidig" | "markt" | "wws" | "handmatig"
      vr_input_reliability: "laag" | "middel" | "hoog"
      vr_object_type: "enkelvoudig" | "mixed_use"
      vr_ovb_allocation_method: "value" | "m2" | "manual" | "extern"
      vr_ovb_classification:
        | "eigen_woning"
        | "woning_belegging"
        | "niet_woning"
        | "mixed_use"
        | "vrijgesteld"
        | "handmatig"
      vr_ovb_mode: "auto" | "manual" | "per_component"
      vr_quality_level: "eenvoudig" | "standaard" | "luxe" | "maatwerk"
      vr_rent_segment: "sociaal" | "middenhuur" | "vrije_sector" | "onbekend"
      vr_risk_level: "laag" | "middel" | "hoog"
      vr_strategy_type:
        | "belegging"
        | "huur_optimaliseren"
        | "renoveren_verhuren"
        | "transformeren"
        | "splitsen"
        | "uitponden"
        | "verkopen_geheel"
        | "verkoop_per_unit"
        | "bedrijfsunits_los"
        | "buy_fix_hold"
        | "buy_fix_sell"
        | "buy_split_sell"
        | "buy_transform_hold"
        | "buy_transform_sell"
        | "sale_leaseback"
        | "herontwikkeling"
        | "overig"
      vr_view_mode: "begeleid" | "compact" | "expert"
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
      aanbiedingswijze: [
        "off_market",
        "stille_verkoop",
        "openbaar",
        "via_makelaar",
      ],
      acquisitie_status: [
        "target_gevonden",
        "eigenaar_achterhalen",
        "eerste_benadering",
        "follow_up_gepland",
        "reactie_ontvangen",
        "verkoopbereidheid_peilen",
        "potentiele_verkooppositie",
        "object_aangemaakt",
        "niet_interessant",
      ],
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
      biedingstatus: [
        "concept",
        "ontvangen",
        "in_behandeling",
        "tegenvoorstel_gedaan",
        "aangepast_bod_gevraagd",
        "geaccepteerd",
        "afgewezen",
        "ingetrokken",
        "verlopen",
      ],
      biedingtype: [
        "indicatief",
        "openingsbod",
        "voorwaardelijk",
        "onvoorwaardelijk",
        "eindbod",
        "tegenvoorstel",
        "verhoogd_bod",
        "schriftelijk",
        "mondeling",
      ],
      campagne_kanaal: [
        "brief",
        "bellen",
        "linkedin",
        "email",
        "netwerk",
        "anders",
      ],
      campagne_status: ["concept", "actief", "gepauzeerd", "afgerond"],
      communicatie_kanaal: [
        "whatsapp",
        "email",
        "telefoon",
        "signal",
        "linkedin",
      ],
      contact_moment_direction: ["inkomend", "uitgaand", "intern", "n_v_t"],
      contact_moment_type: [
        "telefoon",
        "email",
        "whatsapp",
        "linkedin",
        "afspraak",
        "bezichtiging",
        "notitie",
        "document_gedeeld",
        "teaser_verstuurd",
        "nda_verstuurd",
        "nda_ontvangen",
        "informatie_gedeeld",
        "bod_ontvangen",
        "bod_uitgebracht",
        "status_gewijzigd",
        "taak_aangemaakt",
        "taak_afgerond",
        "kandidaat_toegevoegd",
        "archief",
        "algemeen",
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
      eigenaar_bekend: ["ja", "nee", "onbekend"],
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
      interesse_niveau: ["koud", "lauw", "warm", "zeer_warm"],
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
        "te_beoordelen",
        "beschikbaar",
        "on_hold",
        "onder_optie",
        "verkocht",
        "ingetrokken",
        "afgevallen",
      ],
      onderhoudsstaat_niveau: [
        "uitstekend",
        "goed",
        "redelijk",
        "matig",
        "slecht",
      ],
      pipeline_fase: [
        "match_gevonden",
        "teaser_verstuurd",
        "interesse_ontvangen",
        "nda_verstuurd",
        "nda_getekend",
        "informatie_gedeeld",
        "bezichtiging_gepland",
        "bezichtiging_geweest",
        "indicatieve_bieding",
        "onderhandeling",
        "loi_ontvangen",
        "due_diligence",
        "koopovereenkomst_concept",
        "koopovereenkomst_getekend",
        "transport_closing",
        "afgerond",
        "afgevallen",
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
      taak_status: [
        "open",
        "in_uitvoering",
        "afgerond",
        "wacht_op_reactie",
        "geannuleerd",
      ],
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
      volgende_actie_type: [
        "bellen",
        "mailen",
        "whatsapp",
        "nda_sturen",
        "stukken_delen",
        "bezichtiging_plannen",
        "bieding_opvolgen",
        "onderhandelen",
        "overig",
      ],
      voorbehoud_status: ["geen", "ja", "onbekend", "nader_te_bepalen"],
      vr_calc_status: [
        "concept",
        "indicatief",
        "gecontroleerd",
        "voor_bieding",
        "afgewezen",
        "afgerond",
      ],
      vr_complexity_level: ["laag", "middel", "hoog", "zeer_hoog"],
      vr_component_type: [
        "woning",
        "appartement",
        "winkelruimte",
        "kantoorruimte",
        "bedrijfsruimte",
        "bedrijfsunit",
        "opslagruimte",
        "kelder",
        "parkeerplaats",
        "garagebox",
        "berging",
        "horeca",
        "maatschappelijk",
        "ontwikkelgrond",
        "overig",
      ],
      vr_deal_score: ["A", "B", "C", "reject"],
      vr_huurtype_voor_bieding: ["huidig", "markt", "wws", "handmatig"],
      vr_input_reliability: ["laag", "middel", "hoog"],
      vr_object_type: ["enkelvoudig", "mixed_use"],
      vr_ovb_allocation_method: ["value", "m2", "manual", "extern"],
      vr_ovb_classification: [
        "eigen_woning",
        "woning_belegging",
        "niet_woning",
        "mixed_use",
        "vrijgesteld",
        "handmatig",
      ],
      vr_ovb_mode: ["auto", "manual", "per_component"],
      vr_quality_level: ["eenvoudig", "standaard", "luxe", "maatwerk"],
      vr_rent_segment: ["sociaal", "middenhuur", "vrije_sector", "onbekend"],
      vr_risk_level: ["laag", "middel", "hoog"],
      vr_strategy_type: [
        "belegging",
        "huur_optimaliseren",
        "renoveren_verhuren",
        "transformeren",
        "splitsen",
        "uitponden",
        "verkopen_geheel",
        "verkoop_per_unit",
        "bedrijfsunits_los",
        "buy_fix_hold",
        "buy_fix_sell",
        "buy_split_sell",
        "buy_transform_hold",
        "buy_transform_sell",
        "sale_leaseback",
        "herontwikkeling",
        "overig",
      ],
      vr_view_mode: ["begeleid", "compact", "expert"],
      zoekprofiel_status: ["actief", "gepauzeerd", "gearchiveerd", "pauze"],
    },
  },
} as const
