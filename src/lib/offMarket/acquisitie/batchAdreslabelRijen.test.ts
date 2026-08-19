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

  it('gebruikt op het fysieke label alleen de canonieke persoonsnaam', () => {
    const [rij] = bouwBatchAdreslabelRijen([{
      briefnummer: 'BR2026000005', briefVersieId: 'v5',
      geadresseerde: {
        ...geadresseerde,
        naam: 'Evelyn Sabine Blok Geboren 29-04-1959 te AMSTERDAM',
      },
    }]);
    expect(rij.naamregel).toBe('E.S. Blok');
    expect(rij.attentieregel).toBeNull();
    expect(rij.naamregel).not.toContain('Geboren');
  });

  it('behoudt een bedrijfsnaam exact en voegt de directieregel toe', () => {
    const [rij] = bouwBatchAdreslabelRijen([{
      briefnummer: 'BR2026000002', briefVersieId: 'v2',
      geadresseerde: {
        ...geadresseerde,
        naam: 'Bloemgracht 24 B.V.',
        bedrijfsnaam: 'Bloemgracht 24 B.V.',
      },
    }]);
    expect(rij.naamregel).toBe('Bloemgracht 24 B.V.');
    expect(rij.attentieregel).toBe('T.a.v. de directie');
  });

  it('herkent ook een legacy rechtspersoon zonder apart bedrijfsnaamveld', () => {
    const [rij] = bouwBatchAdreslabelRijen([{
      briefnummer: 'BR2026000003', briefVersieId: 'v3',
      geadresseerde: {
        ...geadresseerde,
        naam: 'Voorbeeld Vastgoed B.V.',
        bedrijfsnaam: null,
      },
    }]);
    expect(rij.naamregel).toBe('Voorbeeld Vastgoed B.V.');
    expect(rij.attentieregel).toBe('T.a.v. de directie');
  });

  it('neemt een buitenlands land als aparte labelregel op en houdt de directieregel leeg', () => {
    const [rij] = bouwBatchAdreslabelRijen([{
      briefnummer: 'BR2026000001', briefVersieId: 'v1',
      geadresseerde: { ...geadresseerde, naam: 'Voorbeeld B.V.', bedrijfsnaam: 'Voorbeeld B.V.', land: 'België' },
    }]);
    expect(rij.landregel).toBe('BELGIË');
    expect(rij.attentieregel).toBeNull();
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
