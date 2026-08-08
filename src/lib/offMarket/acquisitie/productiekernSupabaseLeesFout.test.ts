import { describe, expect, it } from 'vitest';

import { normaliseerProductiekernLeesFout } from './productiekernSupabaseLeesFout';

describe('normaliseerProductiekernLeesFout', () => {
  it('classificeert autorisatie-, cardinaliteits- en schemafouten', () => {
    expect(normaliseerProductiekernLeesFout({ code: '42501', message: 'secret' }))
      .toMatchObject({ code: 'niet_geautoriseerd', herstelbaar: false });
    expect(normaliseerProductiekernLeesFout({ code: 'PGRST116' }))
      .toMatchObject({ code: 'record_niet_uniek', herstelbaar: false });
    expect(normaliseerProductiekernLeesFout({ code: '42P01' }))
      .toMatchObject({ code: 'schema_niet_beschikbaar', herstelbaar: false });
  });

  it('classificeert het lokale leesbudget afzonderlijk en niet-herstelbaar', () => {
    expect(normaliseerProductiekernLeesFout({
      code: 'ACQUISITIE_PRODUCTIEKERN_LEESBUDGET_OVERSCHREDEN',
      message: 'interne details',
    })).toEqual({
      code: 'leesbudget_overschreden',
      herstelbaar: false,
      publiekeMelding: 'Het begrensde productiekern-leesbudget is overschreden.',
    });
  });

  it('markeert alleen tijdelijke transportfouten als herstelbaar', () => {
    expect(normaliseerProductiekernLeesFout({ status: 503 })).toEqual({
      code: 'transport_tijdelijk_onbeschikbaar',
      herstelbaar: true,
      publiekeMelding: 'De productiekern-read is tijdelijk niet beschikbaar.',
    });
    expect(normaliseerProductiekernLeesFout(new Error('timeout')))
      .toMatchObject({ code: 'onbekende_leesfout', herstelbaar: false });
  });

  it('lekt geen ruwe foutmelding, SQL of persoonsgegevens', () => {
    const geheim = 'select * from klanten where naam = Ramysh';
    const resultaat = normaliseerProductiekernLeesFout({
      code: 'XX000',
      message: geheim,
      details: 'vertrouwelijk',
    });

    expect(JSON.stringify(resultaat)).not.toContain(geheim);
    expect(JSON.stringify(resultaat)).not.toContain('vertrouwelijk');
    expect(resultaat.publiekeMelding).toBe('De productiekern-read is veilig afgebroken.');
  });
});
