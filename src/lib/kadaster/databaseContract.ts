export const KADASTER_BRON_MODULES = [
  'vastgoedkansen',
  'off_market_radar',
  'objecten',
  'acquisitie',
  'deals',
  'pandenverkenner',
  'snelle_pandcheck',
  'referentieobjecten',
  'vastgoedrekenen',
] as const;

export type KadasterBronModule = typeof KADASTER_BRON_MODULES[number];
export type KadasterBudgetScope = 'bedrijf' | 'gebruiker' | 'campagne' | 'module';
export type KadasterKostenStatus =
  | 'geraamd'
  | 'bevestigd'
  | 'geleverd'
  | 'gedeeltelijk_geleverd'
  | 'mislukt'
  | 'geannuleerd'
  | 'hergebruikt';

export interface CrmObjectregistratieRow {
  id: string;
  object_type: 'pand' | 'verblijfsobject' | 'adres' | 'complex';
  bag_pand_id: string | null;
  bag_verblijfsobject_id: string | null;
  adres_sleutel: string | null;
  status: 'actief' | 'samengevoegd';
  samengevoegd_in_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmObjectbronkoppelingRow {
  id: string;
  crm_objectregistratie_id: string;
  bron_type: 'vastgoedkans' | 'object' | 'off_market_signaal' | 'deal' | 'acquisitie_target';
  bron_id: string;
  created_at: string;
}

export interface KadasterProductRow {
  code: string;
  naam: string;
  categorie: 'gratis' | 'betaald';
  tarief_per_eenheid: number | null;
  valuta: string;
  actief: boolean;
  bevestiging_verplicht: boolean;
  tarief_geldig_vanaf: string | null;
  bron_url: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface KadasterBudgetRow {
  id: string;
  scope_type: KadasterBudgetScope;
  scope_id: string;
  daglimiet: number | null;
  maandlimiet: number | null;
  bevestiging_vanaf: number | null;
  harde_blokkade: boolean;
  beheerder_override: boolean;
  waarschuwing_percentages: number[];
  geldig_vanaf: string;
  geldig_tot: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface KadasterKostenEventRow {
  id: string;
  product_code: string;
  status: KadasterKostenStatus;
  bron_module: KadasterBronModule;
  bron_record_id: string | null;
  aantal_eenheden: number;
  geraamde_kosten: number;
  werkelijke_kosten: number | null;
  valuta: string;
  gebruiker_id: string;
  crm_objectregistratie_id: string | null;
  vastgoedkans_id: string | null;
  object_id: string | null;
  campagne_id: string | null;
  adres_label: string | null;
  externe_request_id: string | null;
  hergebruikt_van_event_id: string | null;
  aangevraagd_op: string;
  geleverd_op: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const KADASTER_SCHEMA_TABLES = [
  'crm_objectregistraties',
  'crm_objectbronkoppelingen',
  'kadaster_producten',
  'kadaster_budgetten',
  'kadaster_kosten_events',
] as const;
