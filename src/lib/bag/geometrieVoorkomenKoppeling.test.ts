import { describe, expect, it } from 'vitest';
import {
  koppelGeometrieAanVoorkomen,
  maakVoorkomenSleutel,
  type BagVoorkomenKandidaat,
  type BagVoorkomenKoppelMetadata,
} from './geometrieVoorkomenKoppeling';

const gevormd: BagVoorkomenKoppelMetadata = {
  objecttype: 'Verblijfsobject',
  identificatie: '0106010000033804',
  voorkomenidentificatie: 1,
  beginGeldigheid: '2008-11-13',
  eindGeldigheid: null,
  tijdstipRegistratie: '2009-11-06 13:37:13',
  eindRegistratie: null,
  tijdstipInactief: null,
};

const inGebruik: BagVoorkomenKoppelMetadata = {
  ...gevormd,
  eindGeldigheid: '2011-01-06',
  tijdstipRegistratie: '2011-07-12 11:03:58',
  eindRegistratie: '2011-07-12 11:03:58',
};

const kandidaat = (
  metadata: BagVoorkomenKoppelMetadata,
  status: string,
): BagVoorkomenKandidaat => ({
  ...metadata,
  voorkomenSleutel: maakVoorkomenSleutel(metadata),
  status,
});

describe('semantische geometrie-voorkomenkoppeling', () => {
  it('maakt de bewezen technische sleutels voor de dubbele Assen-groep', () => {
    expect(maakVoorkomenSleutel(gevormd)).toBe(
      '1|2008-11-13||2009-11-06T13:37:13.000||',
    );
    expect(maakVoorkomenSleutel(inGebruik)).toBe(
      '1|2008-11-13|2011-01-06|2011-07-12T11:03:58.000|2011-07-12T11:03:58.000|',
    );
  });

  it('koppelt iedere geometrie exact aan haar eigen technische voorkomen', () => {
    const kandidaten = [
      kandidaat(inGebruik, 'Verblijfsobject in gebruik'),
      kandidaat(gevormd, 'Verblijfsobject gevormd'),
    ];

    expect(koppelGeometrieAanVoorkomen(gevormd, kandidaten)).toMatchObject({
      status: 'gekoppeld',
      voorkomenSleutel: '1|2008-11-13||2009-11-06T13:37:13.000||',
    });
    expect(koppelGeometrieAanVoorkomen(inGebruik, kandidaten)).toMatchObject({
      status: 'gekoppeld',
      voorkomenSleutel:
        '1|2008-11-13|2011-01-06|2011-07-12T11:03:58.000|2011-07-12T11:03:58.000|',
    });
  });

  it('blokkeert nul matches met kandidaatcontext', () => {
    const kandidaten = [kandidaat(gevormd, 'Verblijfsobject gevormd')];
    const resultaat = koppelGeometrieAanVoorkomen(inGebruik, kandidaten);

    expect(resultaat).toMatchObject({
      status: 'ontbrekende_voorkomenkoppeling',
      voorkomenSleutel: null,
    });
    expect(resultaat.kandidaten).toEqual(kandidaten);
  });

  it('blokkeert meerdere matches en kiest nooit stil de eerste kandidaat', () => {
    const kandidaten = [
      kandidaat(gevormd, 'Verblijfsobject gevormd'),
      kandidaat(gevormd, 'Verblijfsobject gevormd'),
    ];

    expect(koppelGeometrieAanVoorkomen(gevormd, kandidaten)).toMatchObject({
      status: 'ambigue_voorkomenkoppeling',
      voorkomenSleutel: null,
      kandidaten,
    });
  });
});
