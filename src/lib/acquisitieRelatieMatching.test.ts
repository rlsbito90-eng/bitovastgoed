import { describe, expect, it } from 'vitest';
import { bouwAcquisitieRelatieMatchReadModel } from './acquisitieRelatieMatching';

const relaties = [
  {
    id: 'rel-1',
    bedrijfsnaam: 'Voorbeeld Vastgoed B.V.',
    contactpersoon: 'Jan de Vries',
    vestigingsplaats: 'Amsterdam',
  },
  {
    id: 'rel-2',
    bedrijfsnaam: 'Voorbeeld Ontwikkeling',
    contactpersoon: 'Piet Jansen',
    vestigingsplaats: 'Utrecht',
  },
  {
    id: 'rel-3',
    bedrijfsnaam: 'Verwijderde Relatie',
    contactpersoon: 'Jan de Vries',
    vestigingsplaats: 'Amsterdam',
    softDeletedAt: '2026-01-01T00:00:00Z',
  },
];

describe('bouwAcquisitieRelatieMatchReadModel', () => {
  it('vindt een eenduidige exacte bedrijfsnaammatch zonder automatisch te koppelen', () => {
    const model = bouwAcquisitieRelatieMatchReadModel(
      { eigenaarNaam: 'Voorbeeld Vastgoed BV', plaats: 'Amsterdam' },
      relaties,
    );

    expect(model.heeftEenduidigeExacteMatch).toBe(true);
    expect(model.exacteMatch?.relatieId).toBe('rel-1');
    expect(model.exacteMatch?.niveau).toBe('exact');
    expect(model.primaireActie.toLowerCase()).toContain('controleer');
    expect(model.veiligheidsmelding).toContain('nooit automatisch');
  });

  it('kan exact op contactpersoon matchen', () => {
    const model = bouwAcquisitieRelatieMatchReadModel(
      { eigenaarNaam: 'Jan de Vries', plaats: 'Amsterdam' },
      relaties,
    );

    expect(model.matches).toHaveLength(1);
    expect(model.matches[0].relatieId).toBe('rel-1');
    expect(model.matches[0].niveau).toBe('exact');
  });

  it('rangschikt een gedeeltelijke naammatch als mogelijke of waarschijnlijke relatie', () => {
    const model = bouwAcquisitieRelatieMatchReadModel(
      { eigenaarNaam: 'Voorbeeld Vastgoed Ontwikkeling' },
      relaties,
    );

    expect(model.matches.length).toBeGreaterThan(0);
    expect(model.matches[0].score).toBeGreaterThanOrEqual(model.matches.at(-1)?.score ?? 0);
    expect(['waarschijnlijk', 'mogelijk']).toContain(model.matches[0].niveau);
  });

  it('negeert soft-deleted relaties', () => {
    const model = bouwAcquisitieRelatieMatchReadModel(
      { eigenaarNaam: 'Verwijderde Relatie', plaats: 'Amsterdam' },
      relaties,
    );

    expect(model.matches).toHaveLength(0);
  });

  it('vraagt eerst om een eigenaar wanneer geen zoeknaam beschikbaar is', () => {
    const model = bouwAcquisitieRelatieMatchReadModel({}, relaties);

    expect(model.matches).toHaveLength(0);
    expect(model.primaireActie).toContain('Registreer eerst');
  });
});
