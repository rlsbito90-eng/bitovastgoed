import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { SOURCE_IMPORT_COLUMNS, type SourceImportColumnMapping } from '@/lib/vastgoedrekenen/sourceImport';
import {
  applySourceImportMappingProfile,
  bestSourceImportMappingProfile,
  mappingProfileColumns,
  mappingProfileHasRequiredFields,
  type SourceImportMappingProfile,
} from '@/lib/vastgoedrekenen/sourceImportMappingProfiles';
import {
  buildSourceImportTemplateWorkbook,
  SOURCE_IMPORT_TEMPLATE_DATA_SHEET,
  sourceImportTemplateHeaders,
} from '@/lib/vastgoedrekenen/sourceImportTemplates';
import type { TaxonomyOptionLike } from '@/lib/vastgoedrekenen/controlledTaxonomy';

const taxonomy: TaxonomyOptionLike[] = [
  { dimension_code: 'unit', option_code: 'percent', label: '%', active: true, sort_order: 10 },
  { dimension_code: 'unit', option_code: 'eur_m2_bvo', label: '€ per m² BVO', active: true, sort_order: 20 },
  { dimension_code: 'vat_treatment', option_code: 'exclusive', label: 'Exclusief btw', active: true, sort_order: 10 },
  { dimension_code: 'asset_type', option_code: 'office', label: 'Kantoor', active: true, sort_order: 10 },
];

function profile(overrides: Partial<SourceImportMappingProfile> = {}): SourceImportMappingProfile {
  return {
    id: 'profile-1',
    naam: 'Vaste export',
    bron_naam: 'Leverancier A',
    kolommen: {
      code: 'Code',
      naam: 'Naam',
      categorie: 'Categorie',
      unit_code: 'Eenheid',
      minimum_waarde: 'Minimum',
      basis_waarde: 'Basis',
      maximum_waarde: 'Maximum',
    },
    actief: true,
    system_managed: false,
    schema_version: 1,
    created_by: 'user-1',
    created_at: '2026-07-30T00:00:00Z',
    updated_at: '2026-07-30T00:00:00Z',
    ...overrides,
  };
}

describe('source import templates', () => {
  it('maakt een leeg gegevensblad en gescheiden instructie- en keuzelijsten', () => {
    const { workbook, headers } = buildSourceImportTemplateWorkbook(taxonomy);
    expect(headers).toEqual(sourceImportTemplateHeaders());
    expect(headers).toHaveLength(SOURCE_IMPORT_COLUMNS.length);
    expect(workbook.SheetNames).toEqual([
      '_Instructies',
      SOURCE_IMPORT_TEMPLATE_DATA_SHEET,
      '_Keuzelijsten',
      '_Categorieen_en_koppelingen',
    ]);

    const dataRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[SOURCE_IMPORT_TEMPLATE_DATA_SHEET], {
      header: 1,
      raw: false,
      defval: '',
    });
    expect(dataRows).toHaveLength(1);
    expect(dataRows[0]).toEqual(headers);

    const instructionRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets._Instructies, {
      header: 1,
      raw: false,
      defval: '',
    });
    expect(JSON.stringify(instructionRows)).toContain('bevat geen marktwaarden');
  });
});

describe('source import mapping profiles', () => {
  it('bewaart bronkolomnamen in plaats van kolomnummers', () => {
    const headers = ['Naam', 'Maximum', 'Code', 'Basis', 'Minimum', 'Categorie', 'Eenheid'];
    const mapping: SourceImportColumnMapping = {
      code: 2,
      naam: 0,
      categorie: 5,
      unit_code: 6,
      minimum_waarde: 4,
      basis_waarde: 3,
      maximum_waarde: 1,
    };
    expect(mappingProfileColumns(mapping, headers)).toEqual({
      code: 'Code',
      naam: 'Naam',
      categorie: 'Categorie',
      unit_code: 'Eenheid',
      minimum_waarde: 'Minimum',
      basis_waarde: 'Basis',
      maximum_waarde: 'Maximum',
    });
  });

  it('past een profiel opnieuw toe wanneer de kolomvolgorde verandert', () => {
    const headers = ['Maximum', 'Categorie', 'Naam', 'Minimum', 'Eenheid', 'Code', 'Basis'];
    const applied = applySourceImportMappingProfile(profile(), headers);
    expect(applied.missingFields).toEqual([]);
    expect(applied.mapping).toEqual({
      code: 5,
      naam: 2,
      categorie: 1,
      unit_code: 4,
      minimum_waarde: 3,
      basis_waarde: 6,
      maximum_waarde: 0,
    });
  });

  it('past alleen automatisch toe bij een exacte bron- en headermatch', () => {
    const headers = ['Code', 'Naam', 'Categorie', 'Eenheid', 'Minimum', 'Basis', 'Maximum'];
    expect(bestSourceImportMappingProfile([profile()], headers, 'Leverancier A')?.id).toBe('profile-1');
    expect(bestSourceImportMappingProfile([profile()], headers, 'Andere leverancier')).toBeNull();
  });

  it('vereist alle primaire importvelden in een opgeslagen profiel', () => {
    const required = SOURCE_IMPORT_COLUMNS.filter((item) => item.required).map((item) => item.field);
    expect(mappingProfileHasRequiredFields(profile(), required)).toBe(true);
    expect(mappingProfileHasRequiredFields(profile({ kolommen: { code: 'Code' } }), required)).toBe(false);
  });
});
