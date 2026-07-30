export type SourcePackageStatus = 'concept' | 'goedgekeurd' | 'gearchiveerd';
export type SourcePackageHealthStatus = 'concept' | 'gereed' | 'goedgekeurd' | 'verlopen' | 'gearchiveerd' | 'ongeldig';

export type VastgoedrekenenSourcePackage = {
  id: string;
  code: string;
  versie: number;
  naam: string;
  status: SourcePackageStatus;
  bron_type: string;
  bron_naam: string;
  bron_referentie: string | null;
  bron_versie: string | null;
  prijspeildatum: string | null;
  geldig_vanaf: string | null;
  vervaldatum: string | null;
  valuta_code: string;
  geografische_scope: string | null;
  location_keys: string[];
  meetgrondslag: string | null;
  scope_inclusief: string | null;
  scope_exclusief: string | null;
  indexeringsmethode: string | null;
  betrouwbaarheid: 'laag' | 'middel' | 'hoog';
  toelichting: string | null;
  system_managed: boolean;
  goedgekeurd_door: string | null;
  goedgekeurd_op: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SourcePackageDraft = Omit<
  VastgoedrekenenSourcePackage,
  'id' | 'status' | 'goedgekeurd_door' | 'goedgekeurd_op' | 'created_by' | 'created_at' | 'updated_at'
>;

export type SourcePackageEntry = {
  id: string;
  code: string;
  naam: string;
  actief: boolean;
  bronpakket_id: string | null;
  bron_type: string;
  bron_naam: string;
  bron_peildatum: string;
  geldig_vanaf: string | null;
  vervaldatum: string;
  unit_code: string | null;
  vat_treatment_code: string | null;
};

export type SourcePackageIssueCode =
  | 'missing_package_field'
  | 'invalid_date_range'
  | 'invalid_currency'
  | 'no_entries'
  | 'inactive_entry'
  | 'expired_entry'
  | 'missing_unit'
  | 'missing_vat_treatment'
  | 'source_type_mismatch'
  | 'source_name_mismatch'
  | 'price_level_mismatch'
  | 'validity_mismatch';

export type SourcePackageIssue = {
  code: SourcePackageIssueCode;
  message: string;
  entryId?: string;
};

export type SourcePackageAssessment = {
  issues: SourcePackageIssue[];
  canApprove: boolean;
  healthy: boolean;
  healthStatus: SourcePackageHealthStatus;
  linkedEntries: number;
  activeEntries: number;
  expiredEntries: number;
};

export const SOURCE_PACKAGE_STATUS_LABELS: Record<SourcePackageStatus, string> = {
  concept: 'Concept',
  goedgekeurd: 'Goedgekeurd',
  gearchiveerd: 'Gearchiveerd',
};

export const SOURCE_PACKAGE_HEALTH_LABELS: Record<SourcePackageHealthStatus, string> = {
  concept: 'Concept — aanvullen',
  gereed: 'Gereed voor goedkeuring',
  goedgekeurd: 'Goedgekeurd en geldig',
  verlopen: 'Verlopen',
  gearchiveerd: 'Gearchiveerd',
  ongeldig: 'Inhoudelijk ongeldig',
};

export function isCurrencyUnitCode(unitCode: string | null | undefined): boolean {
  return unitCode === 'eur' || Boolean(unitCode?.startsWith('eur_'));
}

function blank(value: string | null | undefined): boolean {
  return !value?.trim();
}

function requiredPackageIssues(pkg: VastgoedrekenenSourcePackage): SourcePackageIssue[] {
  const issues: SourcePackageIssue[] = [];
  const required: Array<[string | null | undefined, string]> = [
    [pkg.code, 'Pakketcode ontbreekt.'],
    [pkg.naam, 'Pakketnaam ontbreekt.'],
    [pkg.bron_type, 'Brontype ontbreekt.'],
    [pkg.bron_naam, 'Bronnaam ontbreekt.'],
    [pkg.bron_referentie, 'Controleerbare bronreferentie ontbreekt.'],
    [pkg.prijspeildatum, 'Prijspeildatum ontbreekt.'],
    [pkg.geldig_vanaf, 'Geldig-vanafdatum ontbreekt.'],
    [pkg.vervaldatum, 'Vervaldatum ontbreekt.'],
    [pkg.geografische_scope, 'Geografische scope ontbreekt.'],
    [pkg.meetgrondslag, 'Meet- of rekengrondslag ontbreekt.'],
    [pkg.scope_inclusief, 'Inbegrepen scope ontbreekt.'],
    [pkg.scope_exclusief, 'Uitgesloten scope ontbreekt.'],
    [pkg.indexeringsmethode, 'Indexerings- of vernieuwingsmethode ontbreekt.'],
  ];

  required.forEach(([value, message]) => {
    if (blank(value)) issues.push({ code: 'missing_package_field', message });
  });

  if (!/^[A-Z]{3}$/.test(pkg.valuta_code)) {
    issues.push({ code: 'invalid_currency', message: 'Valutacode moet uit drie hoofdletters bestaan, bijvoorbeeld EUR.' });
  }
  if (pkg.geldig_vanaf && pkg.vervaldatum && pkg.geldig_vanaf > pkg.vervaldatum) {
    issues.push({ code: 'invalid_date_range', message: 'Geldig vanaf mag niet na de vervaldatum liggen.' });
  }
  if (pkg.prijspeildatum && pkg.vervaldatum && pkg.prijspeildatum > pkg.vervaldatum) {
    issues.push({ code: 'invalid_date_range', message: 'Prijspeildatum mag niet na de vervaldatum liggen.' });
  }

  return issues;
}

function entryIssues(
  pkg: VastgoedrekenenSourcePackage,
  entries: readonly SourcePackageEntry[],
  todayIso: string,
): SourcePackageIssue[] {
  if (entries.length === 0) {
    return [{ code: 'no_entries', message: 'Koppel minimaal één kengetal voordat het pakket wordt goedgekeurd.' }];
  }

  return entries.flatMap((entry) => {
    const issues: SourcePackageIssue[] = [];
    const add = (code: SourcePackageIssueCode, message: string) => issues.push({ code, message, entryId: entry.id });

    if (!entry.actief) add('inactive_entry', `${entry.naam} is niet actief.`);
    if (entry.vervaldatum < todayIso) add('expired_entry', `${entry.naam} is verlopen.`);
    if (!entry.unit_code) add('missing_unit', `${entry.naam} heeft geen vaste eenheid.`);
    if (isCurrencyUnitCode(entry.unit_code) && !entry.vat_treatment_code) {
      add('missing_vat_treatment', `${entry.naam} heeft een valutagrondslag maar geen btw-behandeling.`);
    }
    if (entry.bron_type !== pkg.bron_type) add('source_type_mismatch', `${entry.naam} heeft een ander brontype dan het pakket.`);
    if (entry.bron_naam.trim() !== pkg.bron_naam.trim()) add('source_name_mismatch', `${entry.naam} verwijst naar een andere bronnaam.`);
    if (pkg.prijspeildatum && entry.bron_peildatum !== pkg.prijspeildatum) {
      add('price_level_mismatch', `${entry.naam} heeft een andere bron- of prijspeildatum.`);
    }
    if (pkg.geldig_vanaf && entry.geldig_vanaf !== pkg.geldig_vanaf) {
      add('validity_mismatch', `${entry.naam} heeft een andere geldig-vanafdatum.`);
    }
    if (pkg.vervaldatum && entry.vervaldatum !== pkg.vervaldatum) {
      add('validity_mismatch', `${entry.naam} heeft een andere vervaldatum.`);
    }

    return issues;
  });
}

export function assessSourcePackage(
  pkg: VastgoedrekenenSourcePackage,
  entries: readonly SourcePackageEntry[],
  todayIso = new Date().toISOString().slice(0, 10),
): SourcePackageAssessment {
  const issues = [...requiredPackageIssues(pkg), ...entryIssues(pkg, entries, todayIso)];
  const expired = Boolean(pkg.vervaldatum && pkg.vervaldatum < todayIso);
  const activeEntries = entries.filter((entry) => entry.actief).length;
  const expiredEntries = entries.filter((entry) => entry.vervaldatum < todayIso).length;

  let healthStatus: SourcePackageHealthStatus;
  if (pkg.status === 'gearchiveerd') healthStatus = 'gearchiveerd';
  else if (expired) healthStatus = 'verlopen';
  else if (issues.length > 0 && pkg.status === 'goedgekeurd') healthStatus = 'ongeldig';
  else if (pkg.status === 'goedgekeurd') healthStatus = 'goedgekeurd';
  else if (issues.length === 0) healthStatus = 'gereed';
  else healthStatus = 'concept';

  return {
    issues,
    canApprove: pkg.status === 'concept' && !expired && issues.length === 0,
    healthy: pkg.status === 'goedgekeurd' && !expired && issues.length === 0,
    healthStatus,
    linkedEntries: entries.length,
    activeEntries,
    expiredEntries,
  };
}

export function packageSnapshot(pkg: VastgoedrekenenSourcePackage): Record<string, unknown> {
  return {
    id: pkg.id,
    code: pkg.code,
    versie: pkg.versie,
    naam: pkg.naam,
    bron_type: pkg.bron_type,
    bron_naam: pkg.bron_naam,
    bron_referentie: pkg.bron_referentie,
    bron_versie: pkg.bron_versie,
    prijspeildatum: pkg.prijspeildatum,
    geldig_vanaf: pkg.geldig_vanaf,
    vervaldatum: pkg.vervaldatum,
    valuta_code: pkg.valuta_code,
    geografische_scope: pkg.geografische_scope,
    location_keys: [...pkg.location_keys],
    meetgrondslag: pkg.meetgrondslag,
    scope_inclusief: pkg.scope_inclusief,
    scope_exclusief: pkg.scope_exclusief,
    indexeringsmethode: pkg.indexeringsmethode,
    betrouwbaarheid: pkg.betrouwbaarheid,
    goedgekeurd_op: pkg.goedgekeurd_op,
  };
}
