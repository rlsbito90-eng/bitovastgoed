
-- ============= ENUMS =============
CREATE TYPE public.vr_calc_status AS ENUM ('concept','indicatief','gecontroleerd','voor_bieding','afgewezen','afgerond');
CREATE TYPE public.vr_input_reliability AS ENUM ('laag','middel','hoog');
CREATE TYPE public.vr_strategy_type AS ENUM (
  'belegging','huur_optimaliseren','renoveren_verhuren','transformeren','splitsen',
  'uitponden','verkopen_geheel','verkoop_per_unit','bedrijfsunits_los',
  'buy_fix_hold','buy_fix_sell','buy_split_sell','buy_transform_hold','buy_transform_sell',
  'sale_leaseback','herontwikkeling','overig'
);
CREATE TYPE public.vr_object_type AS ENUM ('enkelvoudig','mixed_use');
CREATE TYPE public.vr_component_type AS ENUM (
  'woning','appartement','winkelruimte','kantoorruimte','bedrijfsruimte','bedrijfsunit',
  'opslagruimte','kelder','parkeerplaats','garagebox','berging','horeca','maatschappelijk','ontwikkelgrond','overig'
);
CREATE TYPE public.vr_ovb_classification AS ENUM (
  'eigen_woning','woning_belegging','niet_woning','mixed_use','vrijgesteld','handmatig'
);
CREATE TYPE public.vr_ovb_allocation_method AS ENUM ('value','m2','manual','extern');
CREATE TYPE public.vr_ovb_mode AS ENUM ('auto','manual','per_component');
CREATE TYPE public.vr_rent_segment AS ENUM ('sociaal','middenhuur','vrije_sector','onbekend');
CREATE TYPE public.vr_quality_level AS ENUM ('eenvoudig','standaard','luxe','maatwerk');
CREATE TYPE public.vr_risk_level AS ENUM ('laag','middel','hoog');
CREATE TYPE public.vr_complexity_level AS ENUM ('laag','middel','hoog','zeer_hoog');
CREATE TYPE public.vr_deal_score AS ENUM ('A','B','C','reject');
CREATE TYPE public.vr_view_mode AS ENUM ('begeleid','compact','expert');
CREATE TYPE public.vr_huurtype_voor_bieding AS ENUM ('huidig','markt','wws','handmatig');

-- ============= TABELLEN =============

CREATE TABLE public.real_estate_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id uuid NOT NULL,
  calculation_name text NOT NULL,
  status public.vr_calc_status NOT NULL DEFAULT 'concept',
  main_strategy public.vr_strategy_type NOT NULL DEFAULT 'belegging',
  object_type public.vr_object_type NOT NULL DEFAULT 'enkelvoudig',
  input_reliability public.vr_input_reliability NOT NULL DEFAULT 'laag',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vr_calc_object ON public.real_estate_calculations(object_id);

CREATE TABLE public.calculation_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id uuid NOT NULL,
  object_id uuid NOT NULL,
  scenario_name text NOT NULL,
  description text,
  status public.vr_calc_status NOT NULL DEFAULT 'concept',
  strategy_type public.vr_strategy_type NOT NULL DEFAULT 'belegging',
  asking_price bigint,
  purchase_price bigint,
  -- OVB
  ovb_mode public.vr_ovb_mode NOT NULL DEFAULT 'auto',
  ovb_classification public.vr_ovb_classification NOT NULL DEFAULT 'woning_belegging',
  transfer_tax_percentage numeric,
  transfer_tax_amount bigint,
  -- Aankoopkosten
  buyer_fee_percentage numeric DEFAULT 2.0,
  buyer_fee_amount bigint,
  buyer_fee_vat_percentage numeric DEFAULT 21.0,
  notary_costs bigint DEFAULT 0,
  advisory_costs bigint DEFAULT 0,
  due_diligence_costs bigint DEFAULT 0,
  other_acquisition_costs bigint DEFAULT 0,
  safety_margin bigint DEFAULT 0,
  -- Huur defaults
  vacancy_percentage numeric DEFAULT 3.0,
  operating_cost_percentage numeric DEFAULT 5.0,
  maintenance_reserve_percentage numeric DEFAULT 3.0,
  management_cost_percentage numeric DEFAULT 3.0,
  other_annual_costs bigint DEFAULT 0,
  current_monthly_rent bigint,
  market_monthly_rent bigint,
  manual_corrected_monthly_rent bigint,
  rent_choice public.vr_huurtype_voor_bieding DEFAULT 'huidig',
  -- Bieding
  target_bar numeric DEFAULT 6.0,
  target_factor numeric,
  target_margin numeric,
  financing_costs bigint DEFAULT 0,
  unforeseen_percentage numeric DEFAULT 10.0,
  -- Transformatie/exit (lichte velden, exit_assumptions tabel voor detail)
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vr_scen_calc ON public.calculation_scenarios(calculation_id);
CREATE INDEX idx_vr_scen_object ON public.calculation_scenarios(object_id);

CREATE TABLE public.calculation_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL,
  component_name text NOT NULL,
  component_type public.vr_component_type NOT NULL DEFAULT 'overig',
  floor_or_location text,
  surface_gbo integer,
  surface_bvo integer,
  surface_vvo integer,
  current_monthly_rent bigint,
  current_annual_rent bigint,
  market_monthly_rent bigint,
  market_annual_rent bigint,
  rent_per_m2 numeric,
  vacant boolean DEFAULT false,
  has_contract boolean DEFAULT false,
  contract_start_date date,
  contract_end_date date,
  tenant_name text,
  wws_relevant boolean DEFAULT false,
  uitpond_relevant boolean DEFAULT false,
  sale_per_unit_possible boolean DEFAULT false,
  expected_sale_value_vacant bigint,
  expected_sale_value_rented bigint,
  allocated_component_value bigint,
  transfer_tax_classification public.vr_ovb_classification,
  transfer_tax_percentage numeric,
  transfer_tax_amount bigint,
  transfer_tax_allocation_method public.vr_ovb_allocation_method DEFAULT 'value',
  transfer_tax_manual_override boolean DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vr_comp_scen ON public.calculation_components(scenario_id);

CREATE TABLE public.residential_wws_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL,
  component_id uuid,
  unit_name text NOT NULL,
  independent_unit boolean DEFAULT true,
  floor text,
  rooms integer,
  living_area_m2 integer,
  other_indoor_space_m2 integer DEFAULT 0,
  outdoor_space_m2 integer DEFAULT 0,
  storage boolean DEFAULT false,
  parking boolean DEFAULT false,
  current_monthly_rent bigint,
  service_costs bigint,
  contract_start_date date,
  vacant boolean DEFAULT false,
  woz_value bigint,
  woz_reference_date date,
  energy_label text,
  energy_label_date date,
  kitchen_quality public.vr_quality_level DEFAULT 'standaard',
  bathroom_quality public.vr_quality_level DEFAULT 'standaard',
  heating_type text,
  cooling boolean DEFAULT false,
  monument_status boolean DEFAULT false,
  protected_cityscape boolean DEFAULT false,
  wws_points integer,
  wws_max_monthly_rent bigint,
  wws_max_annual_rent bigint,
  rent_segment public.vr_rent_segment,
  corrected_monthly_rent bigint,
  corrected_annual_rent bigint,
  report_available boolean DEFAULT false,
  report_date date,
  report_source text,
  reliability_status public.vr_input_reliability DEFAULT 'laag',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vr_wws_scen ON public.residential_wws_units(scenario_id);
CREATE INDEX idx_vr_wws_comp ON public.residential_wws_units(component_id);

CREATE TABLE public.scenario_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL,
  cost_category text NOT NULL,
  description text,
  amount bigint NOT NULL DEFAULT 0,
  vat_applicable boolean DEFAULT false,
  reliability_status public.vr_input_reliability DEFAULT 'middel',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vr_cost_scen ON public.scenario_costs(scenario_id);

CREATE TABLE public.exit_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL,
  exit_type text,
  exit_year integer,
  expected_sale_value bigint,
  expected_rent_at_exit bigint,
  exit_factor numeric,
  exit_yield numeric,
  selling_cost_percentage numeric,
  selling_cost_amount bigint,
  net_exit_value bigint,
  profit bigint,
  profit_margin numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vr_exit_scen ON public.exit_assumptions(scenario_id);

CREATE TABLE public.sell_off_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL,
  component_id uuid,
  unit_name text NOT NULL,
  unit_type public.vr_component_type DEFAULT 'woning',
  surface_gbo integer,
  surface_bvo integer,
  surface_vvo integer,
  current_rent bigint,
  vacant_or_rented boolean DEFAULT false,
  lease_term text,
  wws_points integer,
  wws_segment public.vr_rent_segment,
  expected_sale_value_vacant bigint,
  expected_sale_value_rented bigint,
  sale_value_per_m2 numeric,
  renovation_costs bigint DEFAULT 0,
  splitting_costs bigint DEFAULT 0,
  legal_costs bigint DEFAULT 0,
  selling_cost_percentage numeric DEFAULT 2.0,
  selling_cost_amount bigint,
  expected_sale_period_months integer,
  net_sale_proceeds bigint,
  risk_level public.vr_risk_level DEFAULT 'middel',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vr_selloff_scen ON public.sell_off_units(scenario_id);

CREATE TABLE public.calculation_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL UNIQUE,
  total_transfer_tax bigint,
  total_acquisition_costs bigint,
  total_costs bigint,
  total_investment bigint,
  current_annual_rent bigint,
  market_annual_rent bigint,
  wws_corrected_annual_rent bigint,
  corrected_annual_rent bigint,
  noi bigint,
  price_per_m2_gbo numeric,
  price_per_m2_bvo numeric,
  price_per_m2_vvo numeric,
  bar_purchase_price numeric,
  bar_total_investment numeric,
  factor_purchase_price numeric,
  factor_total_investment numeric,
  maximum_all_in_value bigint,
  maximum_bid bigint,
  conservative_bid bigint,
  realistic_bid bigint,
  aggressive_bid bigint,
  not_interesting_above bigint,
  difference_with_asking_price bigint,
  required_discount bigint,
  exit_value bigint,
  profit bigint,
  profit_margin numeric,
  deal_score public.vr_deal_score,
  risk_score public.vr_risk_level,
  complexity_score public.vr_complexity_level,
  input_reliability public.vr_input_reliability,
  conclusion text,
  recommended_next_step text,
  warnings jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.risk_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL,
  risk_category text NOT NULL,
  risk_level public.vr_risk_level NOT NULL DEFAULT 'laag',
  description text,
  action_required boolean DEFAULT false,
  responsible_person text,
  deadline date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vr_risk_scen ON public.risk_analysis(scenario_id);

CREATE TABLE public.user_calculation_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  vastgoedrekenen_view_mode public.vr_view_mode NOT NULL DEFAULT 'begeleid',
  default_buyer_fee_percentage numeric DEFAULT 2.0,
  default_target_bar numeric DEFAULT 6.0,
  default_vacancy_percentage numeric DEFAULT 3.0,
  default_operating_cost_percentage numeric DEFAULT 5.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vastgoedrekenen_tax_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_name text NOT NULL DEFAULT 'standaard',
  transfer_tax_primary_residence_percentage numeric NOT NULL DEFAULT 2.0,
  transfer_tax_residential_investment_percentage numeric NOT NULL DEFAULT 8.0,
  transfer_tax_non_residential_percentage numeric NOT NULL DEFAULT 10.4,
  wws_euro_per_point numeric NOT NULL DEFAULT 6.0,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============= TRIGGERS updated_at =============
CREATE TRIGGER trg_vr_calc_upd BEFORE UPDATE ON public.real_estate_calculations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vr_scen_upd BEFORE UPDATE ON public.calculation_scenarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vr_comp_upd BEFORE UPDATE ON public.calculation_components FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vr_wws_upd BEFORE UPDATE ON public.residential_wws_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vr_cost_upd BEFORE UPDATE ON public.scenario_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vr_exit_upd BEFORE UPDATE ON public.exit_assumptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vr_selloff_upd BEFORE UPDATE ON public.sell_off_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vr_out_upd BEFORE UPDATE ON public.calculation_outputs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vr_risk_upd BEFORE UPDATE ON public.risk_analysis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vr_prefs_upd BEFORE UPDATE ON public.user_calculation_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vr_tax_upd BEFORE UPDATE ON public.vastgoedrekenen_tax_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= RLS =============
ALTER TABLE public.real_estate_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residential_wws_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exit_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sell_off_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_calculation_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vastgoedrekenen_tax_settings ENABLE ROW LEVEL SECURITY;

-- intern voor de calc-tabellen
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'real_estate_calculations','calculation_scenarios','calculation_components',
    'residential_wws_units','scenario_costs','exit_assumptions','sell_off_units',
    'calculation_outputs','risk_analysis'
  ]
  LOOP
    EXECUTE format('CREATE POLICY "Intern leest %1$s" ON public.%1$s FOR SELECT TO authenticated USING (is_intern_gebruiker(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "Intern voegt %1$s toe" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (is_intern_gebruiker(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "Intern wijzigt %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (is_intern_gebruiker(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "Intern verwijdert %1$s" ON public.%1$s FOR DELETE TO authenticated USING (is_intern_gebruiker(auth.uid()))', t);
  END LOOP;
END$$;

-- user_calculation_preferences: eigen rijen
CREATE POLICY "Eigen prefs select" ON public.user_calculation_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Eigen prefs insert" ON public.user_calculation_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Eigen prefs update" ON public.user_calculation_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Eigen prefs delete" ON public.user_calculation_preferences FOR DELETE TO authenticated USING (user_id = auth.uid());

-- tax_settings: lezen intern, schrijven admin
CREATE POLICY "Intern leest tax_settings" ON public.vastgoedrekenen_tax_settings FOR SELECT TO authenticated USING (is_intern_gebruiker(auth.uid()));
CREATE POLICY "Admin voegt tax_settings toe" ON public.vastgoedrekenen_tax_settings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admin wijzigt tax_settings" ON public.vastgoedrekenen_tax_settings FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admin verwijdert tax_settings" ON public.vastgoedrekenen_tax_settings FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- ============= SEED =============
INSERT INTO public.vastgoedrekenen_tax_settings (setting_name, transfer_tax_primary_residence_percentage, transfer_tax_residential_investment_percentage, transfer_tax_non_residential_percentage, wws_euro_per_point, notes)
VALUES ('standaard', 2.0, 8.0, 10.4, 6.0, 'Standaard OVB-tarieven 2026. Aanpasbaar door admin.');
