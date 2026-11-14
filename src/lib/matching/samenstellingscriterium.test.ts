import { describe, expect, it } from 'vitest';
import { toetsSamenstelling, type SamenstellingsInvoer, type SamenstellingsEis } from './samenstellingscriterium';

const eis: SamenstellingsEis = {
  gebruiksfunctieCode: 'bedrijfsruimte', operator: 'min', percentage: 70,
  sterkte: 'hard', meetbasis: 'vvo',
};
const complex = (bedrijf: number, kantoor: number): SamenstellingsInvoer => ({
  onderdelen: [
    { id: 'hal', gebruiksfunctieCode: 'bedrijfsruimte', oppervlakteM2: bedrijf, meetbasis: 'vvo' },
    { id: 'kantoor', gebruiksfunctieCode: 'kantoor', oppervlakteM2: kantoor, meetbasis: 'vvo' },
  ],
  volledigheidBevestigd: true,
  zonderOverlapBevestigd: true,
});

describe('Hard 70/30 ruimteverhouding', () => {
  it('voldoet bij 75/25 en precies 70/30', () => {
    expect(toetsSamenstelling(complex(750, 250), eis).status).toBe('voldoet');
    expect(toetsSamenstelling(complex(700, 300), eis).diskwalificatie).toBe(false);
  });
  it('wijkt af bij 65/35 ondanks andere mogelijke matches', () => {
    const r = toetsSamenstelling(complex(650, 350), eis);
    expect(r.status).toBe('wijkt_af');
    expect(r.diskwalificatie).toBe(true);
    expect(r.gemetenPercentage).toBe(65);
  });
  it('een voorkeur is geen harde uitsluiting', () => {
    const r = toetsSamenstelling(complex(650, 350), { ...eis, sterkte: 'voorkeur' });
    expect(r.status).toBe('wijkt_af');
    expect(r.diskwalificatie).toBe(false);
  });
  it('onvolledige, onbekende of overlappende data moet gecontroleerd worden', () => {
    expect(toetsSamenstelling({ ...complex(750, 250), volledigheidBevestigd: false }, eis).status)
      .toBe('controle_nodig');
    expect(toetsSamenstelling({ ...complex(750, 250), zonderOverlapBevestigd: false }, eis).status)
      .toBe('controle_nodig');
  });
  it('GBO en VVO mogen niet gemengd worden', () => {
    const obj = complex(750, 250);
    const mixed = { ...obj, onderdelen: [{ ...obj.onderdelen[0], meetbasis: 'gbo' as const }, obj.onderdelen[1]] };
    expect(toetsSamenstelling(mixed, eis).status).toBe('controle_nodig');
  });
  it('maximaal aandeel is onafhankelijk toetsbaar; 30% kantoor is niet verplicht', () => {
    const max: SamenstellingsEis = { ...eis, gebruiksfunctieCode: 'kantoor', operator: 'max', percentage: 30 };
    expect(toetsSamenstelling(complex(800, 200), max).status).toBe('voldoet');
    expect(toetsSamenstelling(complex(600, 400), max).diskwalificatie).toBe(true);
  });
  it('geen naamsloze of dubbele onderdelen of ongeldige oppervlakte accepteren', () => {
    const obj = complex(750, 250);
    const duplicated = { ...obj, onderdelen: [{ ...obj.onderdelen[0] }, { ...obj.onderdelen[1], id: 'hal' }] };
    expect(toetsSamenstelling(duplicated, eis).status).toBe('controle_nodig');
    expect(toetsSamenstelling(complex(0, 1000), eis).status).toBe('controle_nodig');
    expect(toetsSamenstelling(complex(750, 250), { ...eis, percentage: 101 }).status).toBe('controle_nodig');
  });
});
