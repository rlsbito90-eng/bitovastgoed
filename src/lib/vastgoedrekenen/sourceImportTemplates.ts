import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  SOURCE_IMPORT_COLUMNS,
  type SourceImportField,
} from '@/lib/vastgoedrekenen/sourceImport';
import {
  TAXONOMY_DIMENSION_LABELS,
  type TaxonomyOptionLike,
} from '@/lib/vastgoedrekenen/controlledTaxonomy';

export const SOURCE_IMPORT_TEMPLATE_VERSION = 1 as const;
export const SOURCE_IMPORT_TEMPLATE_DATA_SHEET = 'Kengetallen';
export const SOURCE_IMPORT_TEMPLATE_FILE_BASENAME = 'bito-vastgoed-kengetallen-import-v1';

const CATEGORY_OPTIONS = [
  'rendement',
  'opbrengst',
  'bouwkosten',
  'projectkosten',
  'verkoopkosten',
  'exploitatie',
  'fiscaal',
  'methodologie',
  'overig',
] as const;

const SCENARIO_FIELD_OPTIONS = [
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
] as const;

const PROFILE_BAND_OPTIONS = ['minimum', 'basis', 'maximum', 'niet automatisch'] as const;

export type SourceImportTemplateWorkbook = {
  workbook: XLSX.WorkBook;
  headers: string[];
};

export function sourceImportTemplateHeaders(): string[] {
  return SOURCE_IMPORT_COLUMNS.map((definition) => definition.label);
}

function instructionsRows(): string[][] {
  return [
    ['Bito Vastgoed — gecontroleerd kengetallen-importsjabloon', ''],
    ['Sjabloonversie', String(SOURCE_IMPORT_TEMPLATE_VERSION)],
    ['', ''],
    ['Doel', 'Gebruik uitsluitend het tabblad Kengetallen voor echte bronwaarden.'],
    ['Belangrijk', 'Dit sjabloon bevat geen marktwaarden en bevestigt niet dat ingevoerde waarden marktconform zijn.'],
    ['Bronpakket', 'Maak in de CRM eerst een regulier conceptbronpakket met bron, prijspeil, geldigheid, scope en grondslag.'],
    ['Bandbreedte', 'Minimum moet kleiner dan of gelijk aan basis zijn; basis moet kleiner dan of gelijk aan maximum zijn.'],
    ['Eenheid', 'Gebruik een actieve technische code uit het tabblad _Keuzelijsten, bijvoorbeeld eur_m2_bvo of percent.'],
    ['Btw', 'Bij eurobedragen is een btw-behandeling verplicht.'],
    ['Meerdere keuzes', 'Scheid meerdere codes met een puntkomma, bijvoorbeeld office;residential.'],
    ['Gebieden', 'Gebruik alleen officiële gebiedssleutels die binnen het gekozen bronpakket vallen.'],
    ['Import', 'De CRM toont altijd eerst een preview. Eén fout of conflict blokkeert de volledige import.'],
    ['Scenario', 'Import voegt alleen conceptregisterregels toe en past nooit automatisch waarden op een scenario toe.'],
    ['', ''],
    ['Verplichte kolommen', SOURCE_IMPORT_COLUMNS.filter((item) => item.required).map((item) => item.label).join(', ')],
    ['Optionele kolommen', SOURCE_IMPORT_COLUMNS.filter((item) => !item.required).map((item) => item.label).join(', ')],
  ];
}

function optionRows(options: readonly TaxonomyOptionLike[]): string[][] {
  const rows: string[][] = [['Dimensie', 'Technische code', 'Label']];
  Object.keys(TAXONOMY_DIMENSION_LABELS).forEach((dimension) => {
    options
      .filter((option) => option.active && option.dimension_code === dimension)
      .sort((left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label, 'nl-NL'))
      .forEach((option) => rows.push([
        TAXONOMY_DIMENSION_LABELS[option.dimension_code],
        option.option_code,
        option.label,
      ]));
  });
  return rows;
}

function referenceRows(): string[][] {
  const rows: string[][] = [['Soort', 'Technische waarde', 'Toelichting']];
  CATEGORY_OPTIONS.forEach((value) => rows.push(['Categorie', value, 'Gebruik één categorie per regel.']));
  SCENARIO_FIELD_OPTIONS.forEach((value) => rows.push(['Scenario-koppeling', value, 'Optioneel; alleen gebruiken wanneer de koppeling inhoudelijk klopt.']));
  PROFILE_BAND_OPTIONS.forEach((value) => rows.push(['Profielband', value, 'Geeft aan welke band bij conservatief of optimistisch wordt gebruikt.']));
  return rows;
}

function setColumnWidths(sheet: XLSX.WorkSheet, widths: number[]): void {
  sheet['!cols'] = widths.map((wch) => ({ wch }));
}

export function buildSourceImportTemplateWorkbook(
  taxonomyOptions: readonly TaxonomyOptionLike[],
): SourceImportTemplateWorkbook {
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: 'Bito Vastgoed kengetallen-importsjabloon',
    Subject: 'Gecontroleerde bronimport',
    Author: 'Bito Vastgoed',
    Comments: 'Leeg importsjabloon; bevat geen marktwaarden.',
  };

  const instructions = XLSX.utils.aoa_to_sheet(instructionsRows());
  setColumnWidths(instructions, [28, 115]);
  XLSX.utils.book_append_sheet(workbook, instructions, '_Instructies');

  const headers = sourceImportTemplateHeaders();
  const data = XLSX.utils.aoa_to_sheet([headers]);
  data['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}1` };
  data['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' } as never;
  setColumnWidths(data, headers.map((header) => Math.max(14, Math.min(30, header.length + 4))));
  XLSX.utils.book_append_sheet(workbook, data, SOURCE_IMPORT_TEMPLATE_DATA_SHEET);

  const choices = XLSX.utils.aoa_to_sheet(optionRows(taxonomyOptions));
  setColumnWidths(choices, [28, 34, 40]);
  XLSX.utils.book_append_sheet(workbook, choices, '_Keuzelijsten');

  const references = XLSX.utils.aoa_to_sheet(referenceRows());
  setColumnWidths(references, [24, 42, 90]);
  XLSX.utils.book_append_sheet(workbook, references, '_Categorieen_en_koppelingen');

  return { workbook, headers };
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadSourceImportCsvTemplate(): void {
  const csv = Papa.unparse([sourceImportTemplateHeaders()], {
    delimiter: ';',
    newline: '\r\n',
    quotes: false,
  });
  downloadBlob(
    new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
    `${SOURCE_IMPORT_TEMPLATE_FILE_BASENAME}.csv`,
  );
}

export function downloadSourceImportXlsxTemplate(
  taxonomyOptions: readonly TaxonomyOptionLike[],
): void {
  const { workbook } = buildSourceImportTemplateWorkbook(taxonomyOptions);
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true });
  downloadBlob(
    new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${SOURCE_IMPORT_TEMPLATE_FILE_BASENAME}.xlsx`,
  );
}

export function templateHeaderFieldMap(): Partial<Record<SourceImportField, string>> {
  return Object.fromEntries(
    SOURCE_IMPORT_COLUMNS.map((definition) => [definition.field, definition.label]),
  ) as Partial<Record<SourceImportField, string>>;
}
