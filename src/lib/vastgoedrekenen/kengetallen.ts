import type { Scenario } from './types';

export type KengetalCategorie =
  | 'rendement'
  | 'opbrengst'
  | 'bouwkosten'
  | 'projectkosten'
  | 'verkoopkosten'
  | 'exploitatie'
  | 'fiscaal'
  | 'methodologie'
  | 'overig';

export type KengetalBetrouwbaarheid = 'laag' | 'middel' | 'hoog';
export type KengetalBand = 'minimum' | 'basis' | 'maximum' | 'handmatig';
export type KengetalBronType = 'extern' | 'intern' | 'interne_werkhypothese' | 'projectspecifiek' | 'methodologie';
export type KengetalScenarioVeld =
  | 'sale_target_margin_percentage'
  | 'sale_target_roi_percentage'
  | 'sale_target_margin_amount'
  | 'sale_costs_percentage'
  | 'unforeseen_percentage'
  | 'target_bar'
  | 'vacancy_percentage'
  | 'operating_cost_percentage'
  | 'maintenance_reserve_percentage'
  | 'management_cost_percentage';

export type VastgoedrekenenKengetal = {
  id: string;
  code: string;
  naam: string;
  categorie: KengetalCategorie;
  eenheid: string;
  minimum_waarde: number;
  basis_waarde: number;
  maximum_waarde: number;
  scenario_veld: KengetalScenarioVeld | null;
  bron_type: KengetalBronType;
  bron_naam: string;
  bron_referentie: string | null;
  bron_peildatum: string;
  geldig_vanaf: string | null;
  vervaldatum: string;
  toepassingsgebied: string[];
  regio: string[];
  projectfase: string[];
  risicoklasse: string[];
  betrouwbaarheid: KengetalBetrouwbaarheid;
  toelichting: string | null;
  actief: boolean;
  versie: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ScenarioKengetalSnapshot = {
  id: string;
  scenario_id: string;
  kengetal_id: string | null;
  kengetal_code: string;
  kengetal_naam: string;
  categorie: KengetalCategorie;
  eenheid: string;
  gekozen_band: KengetalBand;
  gekozen_waarde: number;
  minimum_waarde: number;
  basis_waarde: number;
  maximum_waarde: number;
  scenario_veld: KengetalScenarioVeld | null;
  bron_type: KengetalBronType;
  bron_naam: string;
  bron_referentie: string | null;
  bron_peildatum: string;
  vervaldatum: string;
  toepassingsgebied: string[];
  regio: string[];
  projectfase: string[];
  risicoklasse: string[];
  betrouwbaarheid: KengetalBetrouwbaarheid;
  register_versie: number;
  overschreven: boolean;
  override_reden: string | null;
  snapshot_op: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type KengetalDraft = Omit<
  VastgoedrekenenKengetal,
  'id' | 'created_by' | 'created_at' | 'updated_at' | 'versie'
> & { versie?: number };

export const KENGETAL_CATEGORIE_LABELS: Record<KengetalCategorie, string> = {
  rendement: 'Rendement',
  opbrengst: 'Opbrengst',
  bouwkosten: 'Bouwkosten',
  projectkosten: 'Projectkosten',
  verkoopkosten: 'Verkoopkosten',
  exploitatie: 'Exploitatie',
  fiscaal: 'Fiscaal',
  methodologie: 'Methodologie',
  overig: 'Overig',
};

export const KENGETAL_BETROUWBAARHEID_LABELS: Record<KengetalBetrouwbaarheid, string> = {
  laag: 'Laag',
  middel: 'Middel',
  hoog: 'Hoog',
};

export const KENGETAL_SCENARIOVELD_LABELS: Record<KengetalScenarioVeld, string> = {
  sale_target_margin_percentage: 'Doelwinst op GDV (%)',
  sale_target_roi_percentage: 'Doelwinst op kosten (%)',
  sale_target_margin_amount: 'Vaste doelwinst (€)',
  sale_costs_percentage: 'Verkoopkosten (%)',
  unforeseen_percentage: 'Onvoorzien (%)',
  target_bar: 'Doel-BAR (%)',
  vacancy_percentage: 'Leegstand (%)',
  operating_cost_percentage: 'Exploitatiekosten (%)',
  maintenance_reserve_percentage: 'Onderhoudsreserve (%)',
  management_cost_percentage: 'Beheerkosten (%)',
};

export function valueForBand(
  kengetal: Pick<VastgoedrekenenKengetal, 'minimum_waarde' | 'basis_waarde' | 'maximum_waarde'>,
  band: Exclude<KengetalBand, 'handmatig'>,
): number {
  if (band === 'minimum') return Number(kengetal.minimum_waarde);
  if (band === 'maximum') return Number(kengetal.maximum_waarde);
  return Number(kengetal.basis_waarde);
}

export function isKengetalExpired(
  item: Pick<VastgoedrekenenKengetal | ScenarioKengetalSnapshot, 'vervaldatum'>,
  todayIso = new Date().toISOString().slice(0, 10),
): boolean {
  return item.vervaldatum < todayIso;
}

export function isSnapshotOutdated(
  snapshot: Pick<ScenarioKengetalSnapshot, 'register_versie'>,
  current: Pick<VastgoedrekenenKengetal, 'versie'> | null | undefined,
): boolean {
  return !!current && Number(current.versie) > Number(snapshot.register_versie);
}

export function buildScenarioPatchForKengetal(
  scenarioField: KengetalScenarioVeld | null,
  value: number,
): Partial<Scenario> {
  if (!scenarioField || !Number.isFinite(value)) return {};
  return { [scenarioField]: value } as Partial<Scenario>;
}

export function buildSnapshotPayload(args: {
  scenarioId: string;
  kengetal: VastgoedrekenenKengetal;
  band: KengetalBand;
  manualValue?: number | null;
  overrideReason?: string | null;
  userId?: string | null;
  nowIso?: string;
}): Omit<ScenarioKengetalSnapshot, 'id' | 'created_at' | 'updated_at'> {
  const { scenarioId, kengetal, band } = args;
  const manual = band === 'handmatig';
  const chosen = manual
    ? Number(args.manualValue)
    : valueForBand(kengetal, band);

  if (!Number.isFinite(chosen)) throw new Error('Gekozen kengetalwaarde is ongeldig.');
  if (manual && !args.overrideReason?.trim()) {
    throw new Error('Leg bij een handmatige waarde de reden vast.');
  }

  return {
    scenario_id: scenarioId,
    kengetal_id: kengetal.id,
    kengetal_code: kengetal.code,
    kengetal_naam: kengetal.naam,
    categorie: kengetal.categorie,
    eenheid: kengetal.eenheid,
    gekozen_band: band,
    gekozen_waarde: chosen,
    minimum_waarde: Number(kengetal.minimum_waarde),
    basis_waarde: Number(kengetal.basis_waarde),
    maximum_waarde: Number(kengetal.maximum_waarde),
    scenario_veld: kengetal.scenario_veld,
    bron_type: kengetal.bron_type,
    bron_naam: kengetal.bron_naam,
    bron_referentie: kengetal.bron_referentie,
    bron_peildatum: kengetal.bron_peildatum,
    vervaldatum: kengetal.vervaldatum,
    toepassingsgebied: [...kengetal.toepassingsgebied],
    regio: [...kengetal.regio],
    projectfase: [...kengetal.projectfase],
    risicoklasse: [...kengetal.risicoklasse],
    betrouwbaarheid: kengetal.betrouwbaarheid,
    register_versie: Number(kengetal.versie),
    overschreven: manual,
    override_reden: manual ? args.overrideReason!.trim() : null,
    snapshot_op: args.nowIso ?? new Date().toISOString(),
    created_by: args.userId ?? null,
  };
}
