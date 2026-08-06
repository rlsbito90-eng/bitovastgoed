import { describe, expect, it, vi } from 'vitest';
import { groepeerTargetsPerEigenaar } from '@/components/acquisitie/AcquisitieEigenarenOverzicht';

vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));

function target(extra: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    adres: 'Voorbeeldstraat 1',
    postcode: '5000AA',
    plaats: 'Tilburg',
    wijk: null,
    typeVastgoed: 'wonen',
    redenInteressant: null,
    bron: null,
    campagneId: null,
    eigenaarBekend: 'ja',
    eigenaarWoontOpAdres: 'onbekend',
    relatieId: 'rel-1',
    status: 'eerste_benadering',
    prioriteit: 3,
    laatsteActieDatum: null,
    volgendeActieDatum: '2026-08-10',
    volgendeActieOmschrijving: null,
    notities: null,
    objectId: null,
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-01T10:00:00Z',
    ...extra,
  } as any;
}

describe('groepeerTargetsPerEigenaar', () => {
  it('bundelt targets en unieke objecten onder dezelfde CRM-relatie', () => {
    const groepen = groepeerTargetsPerEigenaar([
      target({ id: 't1', relatieId: 'rel-1', objectId: 'obj-1' }),
      target({ id: 't2', relatieId: 'rel-1', objectId: 'obj-1' }),
      target({ id: 't3', relatieId: 'rel-1', objectId: 'obj-2' }),
    ], () => 'Eigenaar BV');

    expect(groepen).toHaveLength(1);
    expect(groepen[0]).toMatchObject({
      relatieId: 'rel-1',
      naam: 'Eigenaar BV',
      openActies: 3,
      objectIds: ['obj-1', 'obj-2'],
    });
    expect(groepen[0].targets).toHaveLength(3);
  });

  it('houdt onbekende eigenaren apart per target zodat adressen niet fout worden samengevoegd', () => {
    const groepen = groepeerTargetsPerEigenaar([
      target({ id: 't1', relatieId: null }),
      target({ id: 't2', relatieId: null }),
    ], () => null);

    expect(groepen).toHaveLength(2);
    expect(groepen.every((g) => g.relatieId === null)).toBe(true);
  });

  it('zet verlopen en warme groepen bovenaan', () => {
    const groepen = groepeerTargetsPerEigenaar([
      target({ id: 'later', relatieId: 'rel-later', volgendeActieDatum: '2026-08-20' }),
      target({
        id: 'warm',
        relatieId: 'rel-warm',
        status: 'potentiele_verkooppositie',
        volgendeActieDatum: '2026-08-05',
      }),
      target({
        id: 'verlopen',
        relatieId: 'rel-verlopen',
        volgendeActieDatum: '2026-07-20',
      }),
    ], (id) => id);

    expect(groepen.map((g) => g.relatieId)).toEqual([
      'rel-verlopen', 'rel-warm', 'rel-later',
    ]);
  });

  it('sluit afgeronde targets uit van open acties', () => {
    const groepen = groepeerTargetsPerEigenaar([
      target({ status: 'object_aangemaakt', volgendeActieDatum: '2026-07-20' }),
      target({ status: 'niet_interessant', volgendeActieDatum: null }),
    ], () => 'Eigenaar');

    expect(groepen[0].openActies).toBe(0);
    expect(groepen[0].verlopenActies).toBe(0);
  });
});
