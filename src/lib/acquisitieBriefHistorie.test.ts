import { describe, expect, it } from 'vitest';
import { bouwAcquisitieDossierContext } from './acquisitieDossierContext';
import { bouwAcquisitieBriefDossierReadModel } from './acquisitieBriefHistorie';

const dossier = bouwAcquisitieDossierContext('vastgoedkans', {
  id: 'kans-1',
  adres: 'Stationsstraat 1',
  plaats: 'Oisterwijk',
});

describe('bouwAcquisitieBriefDossierReadModel', () => {
  it('sorteert geregistreerde historie van nieuw naar oud en leidt registraties af', () => {
    const model = bouwAcquisitieBriefDossierReadModel(dossier, {
      briefKenmerk: ' BR-2026-001 ',
      briefGeadresseerde: ' Eigenaar BV ',
      gebeurtenissen: [
        { id: 'pdf-1', type: 'pdf_gegenereerd', datum: '2026-08-01T10:00:00Z', pdfBestandsnaam: 'brief.pdf' },
        { id: 'print-1', type: 'geprint', datum: '2026-08-02T10:00:00Z' },
        { id: 'send-1', type: 'verzonden', datum: '2026-08-03T10:00:00Z', verzendwijze: 'post' },
      ],
    });

    expect(model.historie.map((item) => item.id)).toEqual(['send-1', 'print-1', 'pdf-1']);
    expect(model.huidigKenmerk).toBe('BR-2026-001');
    expect(model.huidigeGeadresseerde).toBe('Eigenaar BV');
    expect(model.laatstVerzondenOp).toBe('2026-08-03T10:00:00Z');
    expect(model.heeftPdfRegistratie).toBe(true);
    expect(model.heeftPrintregistratie).toBe(true);
    expect(model.heeftVerzendregistratie).toBe(true);
  });

  it('geeft een expliciet lege read-only historie zonder activiteit te suggereren', () => {
    const model = bouwAcquisitieBriefDossierReadModel(dossier, {});

    expect(model.historie).toEqual([]);
    expect(model.heeftPdfRegistratie).toBe(false);
    expect(model.heeftPrintregistratie).toBe(false);
    expect(model.heeftVerzendregistratie).toBe(false);
    expect(model.veiligheidsmelding).toContain('uitsluitend geregistreerde historie');
  });

  it('negeert onbruikbare gebeurtenissen zonder id of datum', () => {
    const model = bouwAcquisitieBriefDossierReadModel(dossier, {
      gebeurtenissen: [
        { id: '', type: 'geprint', datum: '2026-08-01' },
        { id: 'zonder-datum', type: 'verzonden', datum: '' },
      ],
    });

    expect(model.historie).toEqual([]);
    expect(model.heeftVerzendregistratie).toBe(false);
  });
});
