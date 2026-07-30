import { describe, expect, it } from 'vitest';
import {
  suggestSourceImportMapping,
  validateSourceImport,
  type SourceImportSheet,
} from '@/lib/vastgoedrekenen/sourceImport';
import type { TaxonomyOptionLike } from '@/lib/vastgoedrekenen/controlledTaxonomy';
import type { VastgoedrekenenSourcePackage } from '@/lib/vastgoedrekenen/sourcePackages';

const options: TaxonomyOptionLike[] = [
  { dimension_code: 'unit', option_code: 'percent', label: 'Percentage (%)', active: true, sort_order: 1 },
  { dimension_code: 'unit', option_code: 'eur_m2_bvo', label: '€ per m² BVO', active: true, sort_order: 2 },
  { dimension_code: 'vat_treatment', option_code: 'ex_vat', label: 'Exclusief btw', active: true, sort_order: 1 },
  { dimension_code: 'asset_type', option_code: 'office', label: 'Kantoor', active: true, sort_order: 1 },
  { dimension_code: 'strategy', option_code: 'transform', label: 'Transformeren', active: true, sort_order: 1 },
  { dimension_code: 'project_phase', option_code: 'quickscan', label: 'Quickscan', active: true, sort_order: 1 },
  { dimension_code: 'risk_class', option_code: 'high', label: 'Hoog', active: true, sort_order: 1 },
  { dimension_code: 'quality_level', option_code: 'average', label: 'Gemiddeld', active: true, sort_order: 1 },
  { dimension_code: 'complexity', option_code: 'medium', label: 'Gemiddeld', active: true, sort_order: 1 },
  { dimension_code: 'location_type', option_code: 'urban', label: 'Stedelijk', active: true, sort_order: 1 },
  { dimension_code: 'market_condition', option_code: 'normal', label: 'Normaal', active: true, sort_order: 1 },
  { dimension_code: 'scenario_profile', option_code: 'base', label: 'Basis', active: true, sort_order: 1 },
];

const pkg: VastgoedrekenenSourcePackage = {
  id: 'package-1',
  code: 'test_package',
  versie: 1,
  naam: 'Testpakket',
  status: 'concept',
  bron_type: 'extern',
  bron_naam: 'Controleerbare bron',
  bron_referentie: 'referentie',
  bron_versie: '2026',
  prijspeildatum: '2026-07-01',
  geldig_vanaf: '2026-07-01',
  vervaldatum: '2027-07-01',
  valuta_code: 'EUR',
  geografische_scope: 'Nederland',
  location_keys: ['municipality:GM0518'],
  meetgrondslag: 'Per m² BVO',
  scope_inclusief: 'Bouwkosten',
  scope_exclusief: 'Grondkosten',
  indexeringsmethode: 'Jaarlijks vervangen',
  betrouwbaarheid: 'middel',
  toelichting: null,
  system_managed: false,
  goedgekeurd_door: null,
  goedgekeurd_op: null,
  created_by: null,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

function sheet(rows: string[][]): SourceImportSheet {
  return {
    name: 'Kengetallen',
    headers: ['Code', 'Naam', 'Categorie', 'Eenheid', 'Minimum', 'Basis', 'Maximum', 'Btw', 'Assettype', 'Strategie'],
    rows,
  };
}

describe('gecontroleerde bronimport', () => {
  it('herkent Nederlandse standaardkolommen', () => {
    const mapping = suggestSourceImportMapping(sheet([]).headers);
    expect(mapping).toMatchObject({
      code: 0,
      naam: 1,
      categorie: 2,
      unit_code: 3,
      minimum_waarde: 4,
      basis_waarde: 5,
      maximum_waarde: 6,
      vat_treatment_code: 7,
      asset_type_codes: 8,
      strategy_codes: 9,
    });
  });

  it('normaliseert Nederlandse getallen en taxonomielabels', () => {
    const importSheet = sheet([
      ['transformatie_kosten', 'Transformatiekosten', 'Bouwkosten', '€ per m² BVO', '1.250,50', '1.500,00', '1.850,75', 'Exclusief btw', 'Kantoor', 'Transformeren'],
    ]);
    const preview = validateSourceImport({
      sheet: importSheet,
      mapping: suggestSourceImportMapping(importSheet.headers),
      pkg,
      existingCodes: [],
      taxonomyOptions: options,
    });

    expect(preview.canImport).toBe(true);
    expect(preview.validRows[0]).toMatchObject({
      code: 'transformatie_kosten',
      categorie: 'bouwkosten',
      unit_code: 'eur_m2_bvo',
      vat_treatment_code: 'ex_vat',
      minimum_waarde: 1250.5,
      basis_waarde: 1500,
      maximum_waarde: 1850.75,
      asset_type_codes: ['office'],
      strategy_codes: ['transform'],
    });
  });

  it('blokkeert een bestaande registercode', () => {
    const importSheet = sheet([
      ['bestaand', 'Bestaand kengetal', 'Exploitatie', 'Percentage (%)', '1', '2', '3', '', '', ''],
    ]);
    const preview = validateSourceImport({
      sheet: importSheet,
      mapping: suggestSourceImportMapping(importSheet.headers),
      pkg,
      existingCodes: ['bestaand'],
      taxonomyOptions: options,
    });

    expect(preview.canImport).toBe(false);
    expect(preview.conflictCount).toBe(1);
    expect(preview.rows[0].issues.join(' ')).toContain('bestaat al');
  });

  it('blokkeert een onjuiste bandvolgorde', () => {
    const importSheet = sheet([
      ['onjuiste_band', 'Onjuiste band', 'Projectkosten', 'Percentage (%)', '10', '8', '12', '', '', ''],
    ]);
    const preview = validateSourceImport({
      sheet: importSheet,
      mapping: suggestSourceImportMapping(importSheet.headers),
      pkg,
      existingCodes: [],
      taxonomyOptions: options,
    });

    expect(preview.canImport).toBe(false);
    expect(preview.errorCount).toBe(1);
    expect(preview.rows[0].issues.join(' ')).toContain('minimum ≤ basis ≤ maximum');
  });

  it('vereist btw-behandeling bij een eurogrondslag', () => {
    const importSheet = sheet([
      ['zonder_btw', 'Zonder btw', 'Bouwkosten', '€ per m² BVO', '1000', '1200', '1400', '', 'Kantoor', 'Transformeren'],
    ]);
    const preview = validateSourceImport({
      sheet: importSheet,
      mapping: suggestSourceImportMapping(importSheet.headers),
      pkg,
      existingCodes: [],
      taxonomyOptions: options,
    });

    expect(preview.canImport).toBe(false);
    expect(preview.rows[0].issues.join(' ')).toContain('btw-behandeling');
  });

  it('blokkeert import in een goedgekeurd pakket', () => {
    const importSheet = sheet([
      ['nieuw', 'Nieuw', 'Exploitatie', 'Percentage (%)', '1', '2', '3', '', '', ''],
    ]);
    const preview = validateSourceImport({
      sheet: importSheet,
      mapping: suggestSourceImportMapping(importSheet.headers),
      pkg: { ...pkg, status: 'goedgekeurd' },
      existingCodes: [],
      taxonomyOptions: options,
    });

    expect(preview.canImport).toBe(false);
    expect(preview.globalIssues.join(' ')).toContain('conceptbronpakket');
  });
});
