import { describe, expect, it } from 'vitest';

import { bouwBatchProductiepakketManifest } from './batchProductiepakket';

const plan = {
  batchId: 'batch-1', batchnummer: 'BAT2026080601', documentversie: 1,
  briefAantal: 2, geadresseerdeAantal: 2, waarschuwingen: [],
  documenten: [
    { documenttype: 'batchvoorblad' as const, bestandsnaam: 'voorblad.pdf', documentversie: 1, briefVersieIds: ['v1', 'v2'] },
    { documenttype: 'controlelijst' as const, bestandsnaam: 'controle.pdf', documentversie: 1, briefVersieIds: ['v1', 'v2'] },
    { documenttype: 'brieven_pdf' as const, bestandsnaam: 'brieven.pdf', documentversie: 1, briefVersieIds: ['v1', 'v2'] },
    { documenttype: 'adreslabels' as const, bestandsnaam: 'labels.csv', documentversie: 1, briefVersieIds: ['v1', 'v2'] },
  ],
};
const controlelijst = {
  batchId: 'batch-1', batchnummer: 'BAT2026080601', documentversie: 1,
  totaal: 2, nietGeverifieerd: 0, pdfOntbreekt: 0,
  rijen: [
    { volgnummer: 1, briefnummer: 'BR1', briefVersieId: 'v1', geadresseerde: 'A', plaats: 'A', adresGeverifieerd: true, pdfBeschikbaar: true },
    { volgnummer: 2, briefnummer: 'BR2', briefVersieId: 'v2', geadresseerde: 'B', plaats: 'B', adresGeverifieerd: true, pdfBeschikbaar: true },
  ],
};
const voorblad = {
  batchnummer: 'BAT2026080601', documentversie: 1, status: 'documenten_gegenereerd' as const,
  briefAantal: 2, nietGeverifieerdeAdressen: 0, ontbrekendePdfs: 0,
  gereedVoorPrint: true, waarschuwingen: [],
};
const labels = [
  { volgnummer: 1, briefnummer: 'BR1', briefVersieId: 'v1', naamregel: 'A', adresregel: 'A 1', postcode: '1000AA', plaats: 'A', landregel: null },
  { volgnummer: 2, briefnummer: 'BR2', briefVersieId: 'v2', naamregel: 'B', adresregel: 'B 1', postcode: '2000BB', plaats: 'B', landregel: null },
];

describe('bouwBatchProductiepakketManifest', () => {
  it('accepteert één volledig samenhangend productiepakket', () => {
    expect(bouwBatchProductiepakketManifest({ plan, controlelijst, voorblad, labels }))
      .toMatchObject({ gereedVoorRender: true, blokkades: [], briefVersieIds: ['v1', 'v2'] });
  });

  it('blokkeert afwijkende batch-, versie- en aantalkoppelingen', () => {
    const resultaat = bouwBatchProductiepakketManifest({
      plan,
      controlelijst: { ...controlelijst, batchId: 'anders', documentversie: 2, totaal: 1 },
      voorblad: { ...voorblad, gereedVoorPrint: false },
      labels: labels.slice(0, 1),
    });
    expect(resultaat.gereedVoorRender).toBe(false);
    expect(resultaat.blokkades).toHaveLength(5);
  });

  it('blokkeert afwijkende volgorde en dubbele bestandsnamen', () => {
    const resultaat = bouwBatchProductiepakketManifest({
      plan: {
        ...plan,
        documenten: plan.documenten.map((item, index) => ({
          ...item,
          bestandsnaam: index < 2 ? 'dubbel.pdf' : item.bestandsnaam,
        })),
      },
      controlelijst: { ...controlelijst, rijen: [...controlelijst.rijen].reverse() },
      voorblad,
      labels,
    });
    expect(resultaat.blokkades).toContain('Volgorde of inhoud van controlelijst wijkt af van het documentplan.');
    expect(resultaat.blokkades).toContain('Documentplan bevat dubbele bestandsnamen.');
  });
});
