import { describe, expect, it } from 'vitest';
import type { ObjectVastgoed } from '@/data/mock-data';
import type { AcquisitieTarget } from '@/lib/acquisitie';
import { vindAcquisitieObjectKandidaten } from '@/lib/acquisitieObjectKoppeling';

const object = (id: string, patch: Partial<ObjectVastgoed> = {}): ObjectVastgoed => ({
  id,
  titel: `Object ${id}`,
  anoniem: false,
  plaats: 'Tilburg',
  provincie: 'Noord-Brabant',
  adres: 'Markt 1',
  postcode: '5038 AB',
  type: 'winkels',
  status: 'te_beoordelen',
  exclusief: false,
  verhuurStatus: 'leeg',
  ontwikkelPotentie: false,
  transformatiePotentie: false,
  isPortefeuille: false,
  documentenBeschikbaar: false,
  datumToegevoegd: '2026-08-02',
  ...patch,
});

const target = (patch: Partial<AcquisitieTarget> = {}): AcquisitieTarget => ({
  id: 'target-1',
  adres: 'Markt-1',
  postcode: '5038ab',
  plaats: 'tilburg',
  wijk: null,
  typeVastgoed: null,
  redenInteressant: null,
  bron: null,
  campagneId: null,
  eigenaarBekend: 'onbekend',
  eigenaarWoontOpAdres: 'onbekend',
  relatieId: null,
  status: 'potentiele_verkooppositie',
  prioriteit: 3,
  laatsteActieDatum: null,
  volgendeActieDatum: null,
  volgendeActieOmschrijving: null,
  notities: null,
  objectId: null,
  createdAt: '2026-08-02T00:00:00Z',
  updatedAt: '2026-08-02T00:00:00Z',
  ...patch,
});

describe('acquisitie-objectkoppeling', () => {
  it('toont een bestaande volledige adresmatch als kandidaat', () => {
    const kandidaten = vindAcquisitieObjectKandidaten(target(), [object('1')]);
    expect(kandidaten).toHaveLength(1);
    expect(kandidaten[0].object.id).toBe('1');
    expect(kandidaten[0].redenLabel).toContain('volledige adres');
  });

  it('toont geen zwakke of onvolledige adresmatch', () => {
    const kandidaten = vindAcquisitieObjectKandidaten(target({ postcode: null }), [object('1')]);
    expect(kandidaten).toHaveLength(0);
  });

  it('beperkt de preflight tot drie kandidaten', () => {
    const kandidaten = vindAcquisitieObjectKandidaten(target(), [object('1'), object('2'), object('3'), object('4')]);
    expect(kandidaten).toHaveLength(3);
  });
});
