import { describe, expect, it } from 'vitest';

import { bouwBatchAdreslabelRijen } from './batchAdreslabelRijen';

const geadresseerde = {
  naam: 'Eigenaar', bedrijfsnaam: null, aanhef: null,
  straatHuisnummer: 'Straat 1', postcode: '1234 ab', plaats: 'Amsterdam',
  land: 'Nederland', bron: null, verificatiestatus: 'handmatig_gecontroleerd' as const,
  relatieId: null,
};

describe('bouwBatchAdreslabelRijen', () => {
  it('sorteert deterministisch en normaliseert Nederlandse adresregels', () => {
    const rijen = bouwBatchAdreslabelRijen([
      { briefnummer: 'BR2026000002', briefVersieId: 'v2', geadresseerde },
      { briefnummer: 'BR2026000001', briefVersieId: 'v1', geadresseerde },
    ]);

    expect(rijen.map((rij) => rij.briefnummer)).toEqual(['BR2026000001', 'BR2026000002']);
    expect(rijen[0]).toMatchObject({ volgnummer: 1, postcode: '1234AB', landregel: null });
  });

  it('neemt een buitenlands land als aparte labelregel op', () => {
    const [rij] = bouwBatchAdreslabelRijen([{
      briefnummer: 'BR2026000001', briefVersieId: 'v1',
      geadresseerde: { ...geadresseerde, land: 'België' },
    }]);
    expect(rij.landregel).toBe('BELGIË');
  });

  it('neutraliseert spreadsheetformules in tekstvelden', () => {
    const [rij] = bouwBatchAdreslabelRijen([{
      briefnummer: 'BR2026000001', briefVersieId: 'v1',
      geadresseerde: { ...geadresseerde, naam: '=HYPERLINK("x")' },
    }]);
    expect(rij.naamregel.startsWith("'=")).toBe(true);
  });

  it('weigert lege, dubbele en onbegrensde invoer', () => {
    expect(() => bouwBatchAdreslabelRijen([])).toThrow('minimaal één');
    expect(() => bouwBatchAdreslabelRijen([
      { briefnummer: 'BR2026000001', briefVersieId: 'v1', geadresseerde },
      { briefnummer: 'BR2026000001', briefVersieId: 'v2', geadresseerde },
    ])).toThrow('Briefnummer dubbel');
    expect(() => bouwBatchAdreslabelRijen(Array.from({ length: 1001 }, (_, i) => ({
      briefnummer: `BR${String(i).padStart(10, '0')}`,
      briefVersieId: `v${i}`,
      geadresseerde,
    })))).toThrow('maximaal 1000');
  });
});
