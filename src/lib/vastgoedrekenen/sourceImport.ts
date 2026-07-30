import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parseDutchNumber } from '@/lib/format/nl';
import {
  CONTROLLED_TAXONOMY_SCHEMA_VERSION,
  UNIT_LEGACY_VALUES,
  type TaxonomyDimension,
  type TaxonomyOptionLike,
} from '@/lib/vastgoedrekenen/controlledTaxonomy';
import type {
  KengetalCategorie,
  KengetalProfielBand,
  KengetalScenarioVeld,
} from '@/lib/vastgoedrekenen/kengetallen';
import type { VastgoedrekenenSourcePackage } from '@/lib/vastgoedrekenen/sourcePackages';

export const SOURCE_IMPORT_MAX_ROWS = 1000;
export const SOURCE_IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;

export type SourceImportFileKind = 'csv' | 'xlsx' | 'xls';
export type SourceImportRowStatus = 'geldig' | 'fout' | 'conflict';

export type SourceImportField =
  | 'code'
  | 'naam'
  | 'categorie'
  | 'unit_code'
  | 'minimum_waarde'
  | 'basis_waarde'
  | 'maximum_waarde'
  | 'vat_treatment_code'
  | 'scenario_veld'
  | 'conservative_band'
  | 'optimistic_band'
  | 'asset_type_codes'
  | 'strategy_codes'
  | 'project_phase_codes'
  | 'risk_class_codes'
  | 'quality_level_codes'
  | 'complexity_codes'
  | 'location_type_codes'
  | 'market_condition_codes'
  | 'scenario_profile_codes'
  | 'location_keys'
  | 'toelichting';

export type SourceImportColumnDefinition = {
  field: SourceImportField;
  label: string;
  required: boolean;
  aliases: string[];
};

export type SourceImportColumnMapping = Partial<Record<SourceImportField, number>>;

export type SourceImportSheet = {
  name: string;
  headers: string[];
  rows: string[][];
};

export type ParsedSourceImportFile = {
  kind: SourceImportFileKind;
  fileName: string;
  fileSize: number;
  sha256: string;
  sheets: SourceImportSheet[];
};

export type SourceImportNormalizedRow = {
  code: string;
  naam: string;
  categorie: KengetalCategorie;
  eenheid: string;
  minimum_waarde: number;
  basis_waarde: number;
  maximum_waarde: number;
  scenario_veld: KengetalScenarioVeld | null;
  conservative_band: KengetalProfielBand | null;
  optimistic_band: KengetalProfielBand | null;
  asset_type_codes: string[];
  strategy_codes: string[];
  project_phase_codes: string[];
  risk_class_codes: string[];
  quality_level_codes: string[];
  complexity_codes: string[];
  location_type_codes: string[];
  market_condition_codes: string[];
  scenario_profile_codes: string[];
  location_keys: string[];
  unit_code: string;
  vat_treatment_code: string | null;
  classification_schema_version: number;
  toelichting: string | null;
};

export type SourceImportPreviewRow = {
  rowNumber: number;
  status: SourceImportRowStatus;
  raw: string[];
  normalized: SourceImportNormalizedRow | null;
  issues: string[];
};

export type SourceImportPreview = {
  rows: SourceImportPreviewRow[];
  validRows: SourceImportNormalizedRow[];
  validCount: number;
  errorCount: number;
  conflictCount: number;
  canImport: boolean;
  globalIssues: string[];
};

export const SOURCE_IMPORT_COLUMNS: SourceImportColumnDefinition[] = [
  { field: 'code', label: 'Unieke code', required: true, aliases: ['code', 'kengetalcode', 'id', 'key'] },
  { field: 'naam', label: 'Naam', required: true, aliases: ['naam', 'name', 'omschrijving', 'kengetal'] },
  { field: 'categorie', label: 'Categorie', required: true, aliases: ['categorie', 'category', 'soort'] },
  { field: 'unit_code', label: 'Eenheid', required: true, aliases: ['eenheid', 'unit', 'unitcode', 'grondslag'] },
  { field: 'minimum_waarde', label: 'Minimum', required: true, aliases: ['minimum', 'min', 'minimumwaarde', 'laag'] },
  { field: 'basis_waarde', label: 'Basis', required: true, aliases: ['basis', 'base', 'basiswaarde', 'gemiddeld', 'realistisch'] },
  { field: 'maximum_waarde', label: 'Maximum', required: true, aliases: ['maximum', 'max', 'maximumwaarde', 'hoog'] },
  { field: 'vat_treatment_code', label: 'Btw-behandeling', required: false, aliases: ['btw', 'vat', 'btwbehandeling', 'vattreatment'] },
  { field: 'scenario_veld', label: 'Scenario-koppeling', required: false, aliases: ['scenarioveld', 'scenariofield', 'koppeling'] },
  { field: 'conservative_band', label: 'Conservatieve band', required: false, aliases: ['conservatief', 'conservativeband', 'conservatieveband'] },
  { field: 'optimistic_band', label: 'Optimistische band', required: false, aliases: ['optimistisch', 'optimisticband', 'optimistischeband'] },
  { field: 'asset_type_codes', label: 'Assettypes', required: false, aliases: ['assettype', 'assettypes', 'assettypecodes'] },
  { field: 'strategy_codes', label: 'Strategieën', required: false, aliases: ['strategie', 'strategieën', 'strategy', 'strategycodes'] },
  { field: 'project_phase_codes', label: 'Projectfasen', required: false, aliases: ['projectfase', 'projectfasen', 'phase', 'projectphasecodes'] },
  { field: 'risk_class_codes', label: 'Risicoklassen', required: false, aliases: ['risico', 'risicoklasse', 'riskclass'] },
  { field: 'quality_level_codes', label: 'Kwaliteitsniveaus', required: false, aliases: ['kwaliteit', 'kwaliteitsniveau', 'qualitylevel'] },
  { field: 'complexity_codes', label: 'Complexiteit', required: false, aliases: ['complexiteit', 'complexity'] },
  { field: 'location_type_codes', label: 'Locatietypes', required: false, aliases: ['locatietype', 'locationtype'] },
  { field: 'market_condition_codes', label: 'Marktomstandigheden', required: false, aliases: ['markt', 'marktomstandigheid', 'marketcondition'] },
  { field: 'scenario_profile_codes', label: 'Scenarioprofielen', required: false, aliases: ['profiel', 'scenarioprofiel', 'scenarioprofile'] },
  { field: 'location_keys', label: 'Officiële gebiedssleutels', required: false, aliases: ['gebied', 'gebieden', 'locationkeys', 'gebiedssleutels'] },
  { field: 'toelichting', label: 'Toelichting', required: false, aliases: ['toelichting', 'notes', 'notities', 'opmerking'] },
];

const CATEGORIES: KengetalCategorie[] = [
  'rendement', 'opbrengst', 'bouwkosten', 'projectkosten', 'verkoopkosten',
  'exploitatie', 'fiscaal', 'methodologie', 'overig',
];

const SCENARIO_FIELDS: KengetalScenarioVeld[] = [
  'sale_target_margin_percentage',
  'sale_target_roi_percentage',
  'sale_target_margin_amount',
  'sale_costs_percentage',
  'unforeseen_percentage',
  'target_bar',
  'vacancy_percentage',
  'operating_cost_percentage',
  'maintenance_reserve_percentage',
  'management_cost_percentage',
];

const PROFILE_BANDS: KengetalProfielBand[] = ['minimum', 'basis', 'maximum'];

const CLASSIFICATION_FIELDS: Array<[keyof SourceImportNormalizedRow, TaxonomyDimension]> = [
  ['asset_type_codes', 'asset_type'],
  ['strategy_codes', 'strategy'],
  ['project_phase_codes', 'project_phase'],
  ['risk_class_codes', 'risk_class'],
  ['quality_level_codes', 'quality_level'],
  ['complexity_codes', 'complexity'],
  ['location_type_codes', 'location_type'],
  ['market_condition_codes', 'market_condition'],
  ['scenario_profile_codes', 'scenario_profile'],
];

function plain(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function rowsToSheet(name: string, input: unknown[][]): SourceImportSheet {
  const rows = input
    .map((row) => row.map(plain))
    .filter((row) => row.some((cell) => cell !== ''));
  const headers = rows[0] ?? [];
  return { name, headers, rows: rows.slice(1) };
}

function fileKind(fileName: string): SourceImportFileKind {
  const extension = fileName.toLowerCase().split('.').pop();
  if (extension === 'csv') return 'csv';
  if (extension === 'xls') return 'xls';
  if (extension === 'xlsx') return 'xlsx';
  throw new Error('Alleen CSV-, XLS- en XLSX-bestanden worden ondersteund.');
}

export async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function parseSourceImportFile(file: File): Promise<ParsedSourceImportFile> {
  if (file.size > SOURCE_IMPORT_MAX_FILE_BYTES) {
    throw new Error('Het bestand is groter dan 10 MB. Splits het bestand in kleinere bronsets.');
  }
  const kind = fileKind(file.name);
  let sheets: SourceImportSheet[];

  if (kind === 'csv') {
    const parsed = Papa.parse<unknown[]>(await file.text(), {
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
    });
    if (parsed.errors.length > 0) {
      throw new Error(`CSV kon niet betrouwbaar worden gelezen: ${parsed.errors[0].message}`);
    }
    sheets = [rowsToSheet('CSV', parsed.data as unknown[][])];
  } else {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
    sheets = workbook.SheetNames.map((name) => rowsToSheet(
      name,
      XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: false, defval: '' }) as unknown[][],
    ));
  }

  const usable = sheets.filter((sheet) => sheet.headers.length > 0 && sheet.rows.length > 0);
  if (usable.length === 0) throw new Error('Er is geen werkblad met een kopregel en gegevens gevonden.');
  if (usable.some((sheet) => sheet.rows.length > SOURCE_IMPORT_MAX_ROWS)) {
    throw new Error(`Een import mag maximaal ${SOURCE_IMPORT_MAX_ROWS} gegevensregels bevatten.`);
  }

  return {
    kind,
    fileName: file.name,
    fileSize: file.size,
    sha256: await sha256Hex(file),
    sheets: usable,
  };
}

export function suggestSourceImportMapping(headers: readonly string[]): SourceImportColumnMapping {
  const normalizedHeaders = headers.map(normalizeKey);
  const mapping: SourceImportColumnMapping = {};
  SOURCE_IMPORT_COLUMNS.forEach((definition) => {
    const aliases = new Set([definition.field, ...definition.aliases].map(normalizeKey));
    const index = normalizedHeaders.findIndex((header) => aliases.has(header));
    if (index >= 0) mapping[definition.field] = index;
  });
  return mapping;
}

function cell(row: readonly string[], mapping: SourceImportColumnMapping, field: SourceImportField): string {
  const index = mapping[field];
  return index === undefined ? '' : plain(row[index]);
}

function parseList(value: string): string[] {
  return Array.from(new Set(value.split(/[;,|\n]+/).map((item) => item.trim()).filter(Boolean)));
}

function resolveTaxonomyCode(
  raw: string,
  dimension: TaxonomyDimension,
  options: readonly TaxonomyOptionLike[],
): string | null {
  const key = normalizeKey(raw);
  if (!key) return null;
  return options.find((option) => option.dimension_code === dimension && option.active
    && (normalizeKey(option.option_code) === key || normalizeKey(option.label) === key))?.option_code ?? null;
}

function resolveTaxonomyCodes(
  raw: string,
  dimension: TaxonomyDimension,
  options: readonly TaxonomyOptionLike[],
  issues: string[],
): string[] {
  const result: string[] = [];
  parseList(raw).forEach((value) => {
    const code = resolveTaxonomyCode(value, dimension, options);
    if (!code) issues.push(`${value} is geen geldige keuze voor ${dimension}.`);
    else result.push(code);
  });
  return Array.from(new Set(result));
}

function resolveCategory(raw: string): KengetalCategorie | null {
  const normalized = normalizeKey(raw);
  const aliases: Record<string, KengetalCategorie> = {
    rendement: 'rendement', return: 'rendement',
    opbrengst: 'opbrengst', revenue: 'opbrengst', value: 'opbrengst',
    bouwkosten: 'bouwkosten', constructioncosts: 'bouwkosten',
    projectkosten: 'projectkosten', projectcosts: 'projectkosten',
    verkoopkosten: 'verkoopkosten', salescosts: 'verkoopkosten',
    exploitatie: 'exploitatie', operation: 'exploitatie', operating: 'exploitatie',
    fiscaal: 'fiscaal', tax: 'fiscaal',
    methodologie: 'methodologie', methodology: 'methodologie',
    overig: 'overig', other: 'overig',
  };
  return aliases[normalized] ?? CATEGORIES.find((item) => normalizeKey(item) === normalized) ?? null;
}

function resolveProfileBand(raw: string): KengetalProfielBand | null {
  const normalized = normalizeKey(raw);
  if (!normalized || ['geen', 'none', 'nietautomatisch'].includes(normalized)) return null;
  const aliases: Record<string, KengetalProfielBand> = {
    minimum: 'minimum', min: 'minimum', laag: 'minimum',
    basis: 'basis', base: 'basis', gemiddeld: 'basis',
    maximum: 'maximum', max: 'maximum', hoog: 'maximum',
  };
  return aliases[normalized] ?? null;
}

function resolveScenarioField(raw: string): KengetalScenarioVeld | null {
  const normalized = raw.trim();
  if (!normalized) return null;
  return SCENARIO_FIELDS.includes(normalized as KengetalScenarioVeld)
    ? normalized as KengetalScenarioVeld
    : null;
}

function isCurrencyUnit(unitCode: string): boolean {
  return unitCode === 'eur' || unitCode.startsWith('eur_');
}

export function validateSourceImport(args: {
  sheet: SourceImportSheet;
  mapping: SourceImportColumnMapping;
  pkg: VastgoedrekenenSourcePackage;
  existingCodes: Iterable<string>;
  taxonomyOptions: readonly TaxonomyOptionLike[];
}): SourceImportPreview {
  const { sheet, mapping, pkg, taxonomyOptions } = args;
  const globalIssues: string[] = [];
  const requiredMissing = SOURCE_IMPORT_COLUMNS
    .filter((definition) => definition.required && mapping[definition.field] === undefined)
    .map((definition) => definition.label);
  if (requiredMissing.length > 0) globalIssues.push(`Verplichte kolommen ontbreken: ${requiredMissing.join(', ')}.`);
  if (pkg.status !== 'concept' || pkg.system_managed) {
    globalIssues.push('Importeren kan alleen in een regulier conceptbronpakket.');
  }
  if (!pkg.prijspeildatum || !pkg.geldig_vanaf || !pkg.vervaldatum) {
    globalIssues.push('Het bronpakket mist prijspeil- of geldigheidsdata.');
  }

  const existing = new Set(Array.from(args.existingCodes, (code) => code.trim().toLowerCase()));
  const fileCodes = new Set<string>();
  const previewRows: SourceImportPreviewRow[] = sheet.rows.map((row, index) => {
    const issues: string[] = [];
    const code = cell(row, mapping, 'code').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    const naam = cell(row, mapping, 'naam');
    const category = resolveCategory(cell(row, mapping, 'categorie'));
    const unitCode = resolveTaxonomyCode(cell(row, mapping, 'unit_code'), 'unit', taxonomyOptions);
    const minimum = parseDutchNumber(cell(row, mapping, 'minimum_waarde'));
    const basis = parseDutchNumber(cell(row, mapping, 'basis_waarde'));
    const maximum = parseDutchNumber(cell(row, mapping, 'maximum_waarde'));

    if (!code || !/^[a-z0-9][a-z0-9_]*$/.test(code)) issues.push('De unieke code ontbreekt of is ongeldig.');
    if (!naam) issues.push('Naam ontbreekt.');
    if (!category) issues.push('Categorie is onbekend.');
    if (!unitCode) issues.push('Eenheid is onbekend of niet actief.');
    if (minimum === null || basis === null || maximum === null) issues.push('Minimum, basis en maximum moeten geldige getallen zijn.');
    if (minimum !== null && basis !== null && maximum !== null && !(minimum <= basis && basis <= maximum)) {
      issues.push('Bandbreedte moet voldoen aan minimum ≤ basis ≤ maximum.');
    }

    const vatRaw = cell(row, mapping, 'vat_treatment_code');
    const vatCode = vatRaw ? resolveTaxonomyCode(vatRaw, 'vat_treatment', taxonomyOptions) : null;
    if (vatRaw && !vatCode) issues.push('Btw-behandeling is onbekend of niet actief.');
    if (unitCode && isCurrencyUnit(unitCode) && !vatCode) issues.push('Een eurogrondslag vereist een btw-behandeling.');

    const scenarioRaw = cell(row, mapping, 'scenario_veld');
    const scenarioField = resolveScenarioField(scenarioRaw);
    if (scenarioRaw && !scenarioField) issues.push('Scenario-koppeling is onbekend.');

    const conservativeRaw = cell(row, mapping, 'conservative_band');
    const conservativeBand = resolveProfileBand(conservativeRaw);
    if (conservativeRaw && !conservativeBand && !['geen', 'none', 'niet automatisch'].includes(conservativeRaw.toLowerCase())) {
      issues.push('Conservatieve profielband is onbekend.');
    }
    const optimisticRaw = cell(row, mapping, 'optimistic_band');
    const optimisticBand = resolveProfileBand(optimisticRaw);
    if (optimisticRaw && !optimisticBand && !['geen', 'none', 'niet automatisch'].includes(optimisticRaw.toLowerCase())) {
      issues.push('Optimistische profielband is onbekend.');
    }

    const classification = Object.fromEntries(CLASSIFICATION_FIELDS.map(([field, dimension]) => [
      field,
      resolveTaxonomyCodes(cell(row, mapping, field as SourceImportField), dimension, taxonomyOptions, issues),
    ])) as Pick<SourceImportNormalizedRow,
      'asset_type_codes' | 'strategy_codes' | 'project_phase_codes' | 'risk_class_codes'
      | 'quality_level_codes' | 'complexity_codes' | 'location_type_codes'
      | 'market_condition_codes' | 'scenario_profile_codes'>;

    const locationKeys = parseList(cell(row, mapping, 'location_keys'));
    const duplicateInFile = code && fileCodes.has(code);
    if (code) fileCodes.add(code);
    const conflict = Boolean(code && (existing.has(code) || duplicateInFile));
    if (existing.has(code)) issues.push('Deze code bestaat al in het kengetallenregister.');
    if (duplicateInFile) issues.push('Deze code komt meerdere keren in het importbestand voor.');

    const normalized: SourceImportNormalizedRow | null = issues.length === 0 && category && unitCode
      && minimum !== null && basis !== null && maximum !== null
      ? {
          code,
          naam,
          categorie: category,
          eenheid: UNIT_LEGACY_VALUES[unitCode] ?? unitCode,
          minimum_waarde: minimum,
          basis_waarde: basis,
          maximum_waarde: maximum,
          scenario_veld: scenarioField,
          conservative_band: conservativeBand,
          optimistic_band: optimisticBand,
          ...classification,
          location_keys: locationKeys,
          unit_code: unitCode,
          vat_treatment_code: vatCode,
          classification_schema_version: CONTROLLED_TAXONOMY_SCHEMA_VERSION,
          toelichting: cell(row, mapping, 'toelichting') || null,
        }
      : null;

    return {
      rowNumber: index + 2,
      status: conflict ? 'conflict' : issues.length > 0 ? 'fout' : 'geldig',
      raw: row,
      normalized,
      issues,
    };
  });

  const validRows = previewRows.filter((row) => row.status === 'geldig' && row.normalized).map((row) => row.normalized!);
  const conflictCount = previewRows.filter((row) => row.status === 'conflict').length;
  const errorCount = previewRows.filter((row) => row.status === 'fout').length;
  return {
    rows: previewRows,
    validRows,
    validCount: validRows.length,
    errorCount,
    conflictCount,
    canImport: globalIssues.length === 0 && validRows.length > 0 && errorCount === 0 && conflictCount === 0,
    globalIssues,
  };
}

export function sourceImportFieldLabel(field: SourceImportField): string {
  return SOURCE_IMPORT_COLUMNS.find((definition) => definition.field === field)?.label ?? field;
}

export function requiredSourceImportFields(): SourceImportColumnDefinition[] {
  return SOURCE_IMPORT_COLUMNS.filter((definition) => definition.required);
}

export function optionalSourceImportFields(): SourceImportColumnDefinition[] {
  return SOURCE_IMPORT_COLUMNS.filter((definition) => !definition.required);
}
