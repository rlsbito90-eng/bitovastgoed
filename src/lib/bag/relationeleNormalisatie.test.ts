import { describe, expect, it } from 'vitest';
import { groepeerVoorkomens, isActueelVoorkomen, normaliseerBagRelaties, type BagVoorkomenKern } from './relationeleNormalisatie';

const basis = (overrides: Partial<BagVoorkomenKern>): BagVoorkomenKern => ({
  objecttype: 'Pand',
  identificatie: 'id',
  voorkomenidentificatie: 1,
  beginGeldigheid: '2020-01-01',
  eindGeldigheid: null,
  tijdstipRegistratie: '2020-01-01T00:00:00Z',
  eindRegistratie: null,
  tijdstipInactief: null,
  status: 'Pand in gebruik',
  relaties: {},
  velden: {},
  ...overrides,
});

describe('relationele BAG-normalisatie', () => {
  it('herkent een actueel voorkomen uitsluitend zonder eind- of inactiviteitsmoment', () => {
    expect(isActueelVoorkomen(basis({}))).toBe(true);
    expect(isActueelVoorkomen(basis({ eindGeldigheid: '2022-01-01' }))).toBe(false);
    expect(isActueelVoorkomen(basis({ eindRegistratie: '2022-01-01T00:00:00Z' }))).toBe(false);
    expect(isActueelVoorkomen(basis({ tijdstipInactief: '2022-01-01T00:00:00Z' }))).toBe(false);
  });

  it('selecteert het actuele voorkomen en behoudt alle overige voorkomens als historie', () => {
    const oud = basis({ voorkomenidentificatie: 1, eindGeldigheid: '2021-01-01' });
    const actueel = basis({ voorkomenidentificatie: 2, beginGeldigheid: '2021-01-01' });
    const resultaat = groepeerVoorkomens([oud, actueel]);
    expect(resultaat.objecten[0].actueel?.voorkomenidentificatie).toBe(2);
    expect(resultaat.objecten[0].historie).toHaveLength(1);
  });

  it('rapporteert meerdere actuele voorkomens maar kiest deterministisch de nieuwste', () => {
    const resultaat = groepeerVoorkomens([
      basis({ voorkomenidentificatie: 1, beginGeldigheid: '2020-01-01' }),
      basis({ voorkomenidentificatie: 2, beginGeldigheid: '2021-01-01' }),
    ]);
    expect(resultaat.objecten[0].actueel?.voorkomenidentificatie).toBe(2);
    expect(resultaat.fouten[0].code).toBe('meerdere_actuele_voorkomens');
  });

  it('bouwt een volledig adres via nummeraanduiding, openbare ruimte en woonplaats', () => {
    const resultaat = normaliseerBagRelaties([
      basis({ objecttype: 'Woonplaats', identificatie: 'wp1', velden: { naam: 'Assen' } }),
      basis({ objecttype: 'OpenbareRuimte', identificatie: 'or1', relaties: { ligtIn: ['wp1'] }, velden: { naam: 'Markt' } }),
      basis({ objecttype: 'Nummeraanduiding', identificatie: 'na1', relaties: { ligtAan: ['or1'] }, velden: { huisnummer: 5, huisletter: 'A', huisnummertoevoeging: '02', postcode: '9401 AA' } }),
    ]);
    expect(resultaat.adressen[0]).toMatchObject({ adresregel: 'Markt 5A-02', postcode: '9401AA', woonplaatsnaam: 'Assen' });
    expect(resultaat.fouten).toHaveLength(0);
  });

  it('scheidt hoofdadres en nevenadressen en bewaart gekoppelde panden', () => {
    const resultaat = normaliseerBagRelaties([
      basis({ objecttype: 'Woonplaats', identificatie: 'wp1', velden: { naam: 'Assen' } }),
      basis({ objecttype: 'OpenbareRuimte', identificatie: 'or1', relaties: { ligtIn: ['wp1'] }, velden: { naam: 'Brink' } }),
      basis({ objecttype: 'Nummeraanduiding', identificatie: 'na1', relaties: { ligtAan: ['or1'] }, velden: { huisnummer: 1 } }),
      basis({ objecttype: 'Nummeraanduiding', identificatie: 'na2', relaties: { ligtAan: ['or1'] }, velden: { huisnummer: 1, huisletter: 'B' } }),
      basis({ objecttype: 'Verblijfsobject', identificatie: 'vbo1', relaties: { hoofdadres: ['na1'], nevenadres: ['na2'], maaktDeelUitVan: ['p1'] } }),
    ]);
    expect(resultaat.adresseerbareObjecten[0].hoofdadres?.nummeraanduidingId).toBe('na1');
    expect(resultaat.adresseerbareObjecten[0].nevenadressen.map(item => item.nummeraanduidingId)).toEqual(['na2']);
    expect(resultaat.adresseerbareObjecten[0].pandIds).toEqual(['p1']);
  });

  it('rapporteert ontbrekende relaties zonder het bronobject te verwijderen', () => {
    const resultaat = normaliseerBagRelaties([
      basis({ objecttype: 'Nummeraanduiding', identificatie: 'na1', relaties: { ligtAan: ['or-ontbreekt'] }, velden: { huisnummer: 1 } }),
      basis({ objecttype: 'Verblijfsobject', identificatie: 'vbo1', relaties: { hoofdadres: ['na-ontbreekt'] } }),
    ]);
    expect(resultaat.objecten).toHaveLength(2);
    expect(resultaat.fouten.map(fout => fout.code)).toEqual(['ontbrekende_nummeraanduiding', 'ontbrekende_openbare_ruimte']);
  });
});
