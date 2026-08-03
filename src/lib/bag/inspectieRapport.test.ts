import { describe, expect, it } from 'vitest';
import {
  bagInspectieRapportFingerprint,
  normaliseerBagInspectieRapport,
  valideerBagInspectieRapport,
  type BagInspectieRapport,
} from './inspectieRapport';

function geldigRapport(): BagInspectieRapport {
  return {
    gegenereerdOp: '2026-08-02T21:00:00.000Z',
    bronbestanden: [
      {
        naam: 'bag-extract-xsd.zip',
        url: 'https://developer.kadaster.nl/example/xsd.zip',
        sha256: 'a'.repeat(64),
        bytes: 123_456,
        zipLeesbaar: true,
        bestanden: ['imbag.xsd', 'bag-extract.xsd'],
        xsdAantal: 2,
        xmlAantal: 0,
      },
      {
        naam: 'bag-proefbestand-assen.zip',
        url: 'https://service.pdok.nl/example/assen.zip',
        sha256: 'b'.repeat(64),
        bytes: 987_654,
        zipLeesbaar: true,
        bestanden: ['0106Panden.xml', '0106Verblijfsobjecten.xml'],
        xsdAantal: 0,
        xmlAantal: 2,
      },
    ],
    namespaces: [
      'http://www.opengis.net/gml/3.2',
      'http://www.kadaster.nl/schemas/imbag/ingeschrevenPersoon/v20180601',
    ],
    objecttypen: [
      'pand',
      'verblijfsobject',
      'nummeraanduiding',
      'openbare_ruimte',
      'woonplaats',
      'standplaats',
      'ligplaats',
    ],
    xsdValidatieGeslaagd: true,
    gemeenteCode: '0106',
    fouten: [],
  };
}

describe('BAG inspectierapport-vrijgavepoort', () => {
  it('geeft een volledig, officieel inspectierapport vrij', () => {
    const validatie = valideerBagInspectieRapport(geldigRapport());

    expect(validatie.vrijgegeven).toBe(true);
    expect(validatie.fouten).toEqual([]);
  });

  it('blokkeert ontbrekende checksum, ZIP-validatie en inventarisatie', () => {
    const rapport = geldigRapport();
    rapport.bronbestanden[0] = {
      ...rapport.bronbestanden[0],
      sha256: '',
      zipLeesbaar: false,
      bestanden: [],
    };

    const validatie = valideerBagInspectieRapport(rapport);

    expect(validatie.vrijgegeven).toBe(false);
    expect(validatie.fouten).toEqual(expect.arrayContaining([
      'Bron bag-extract-xsd.zip heeft geen geldige SHA-256-checksum.',
      'Bron bag-extract-xsd.zip is niet als leesbaar ZIP-bestand bevestigd.',
      'Bron bag-extract-xsd.zip bevat geen geïnventariseerde bestanden.',
    ]));
  });

  it('blokkeert ontbrekende XSD-validatie en onjuiste gemeente', () => {
    const rapport = geldigRapport();
    rapport.xsdValidatieGeslaagd = false;
    rapport.gemeenteCode = '0855';

    const validatie = valideerBagInspectieRapport(rapport);

    expect(validatie.vrijgegeven).toBe(false);
    expect(validatie.fouten).toEqual(expect.arrayContaining([
      'De officiële XML-proefbestanden zijn niet aantoonbaar tegen de XSD-set gevalideerd.',
      'Het officiële gemeenteproefbestand moet aantoonbaar gemeente Assen (0106) bevatten.',
    ]));
  });

  it('blokkeert wanneer niet alle zeven BAG-objecttypen zijn aangetroffen', () => {
    const rapport = geldigRapport();
    rapport.objecttypen = rapport.objecttypen.filter(type => type !== 'ligplaats');

    const validatie = valideerBagInspectieRapport(rapport);

    expect(validatie.vrijgegeven).toBe(false);
    expect(validatie.fouten).toContain('Niet alle BAG-objecttypen zijn aangetroffen: ligplaats.');
  });

  it('normaliseert bestanden, namespaces en checksums deterministisch', () => {
    const rapport = geldigRapport();
    rapport.namespaces.reverse();
    rapport.namespaces.push(rapport.namespaces[0]);
    rapport.bronbestanden.reverse();
    rapport.bronbestanden[0].sha256 = rapport.bronbestanden[0].sha256.toUpperCase();

    const genormaliseerd = normaliseerBagInspectieRapport(rapport);

    expect(genormaliseerd.namespaces).toEqual([...new Set(genormaliseerd.namespaces)].sort());
    expect(genormaliseerd.bronbestanden.map(bron => bron.naam)).toEqual([
      'bag-extract-xsd.zip',
      'bag-proefbestand-assen.zip',
    ]);
    expect(genormaliseerd.bronbestanden[1].sha256).toBe('b'.repeat(64));
  });

  it('maakt dezelfde fingerprint bij alleen een andere invoervolgorde', () => {
    const eerste = geldigRapport();
    const tweede = geldigRapport();
    tweede.bronbestanden.reverse();
    tweede.namespaces.reverse();
    tweede.objecttypen.reverse();

    expect(bagInspectieRapportFingerprint(eerste)).toBe(
      bagInspectieRapportFingerprint(tweede),
    );
  });
});
