import { describe, expect, it } from 'vitest';
import {
  BAG_OFFICIELE_BRONNEN,
  officieleXmlMappingMagWordenVrijgegeven,
  valideerBagBronbestandInspectie,
  type BagBronbestandInspectie,
} from './officieleBronAcquisitie';

const inspecties: BagBronbestandInspectie[] = [
  {
    bronId: 'xsd_pakket',
    lokaalAanwezig: true,
    bytes: 25_000,
    sha256: 'a'.repeat(64),
    zipLeesbaar: true,
    bestanden: ['lvbag/extract-deelbestand-lvc.xsd', 'imbag/objecten.xsd'],
    xsdValidatieUitgevoerd: true,
  },
  {
    bronId: 'proefbestand_gemeente',
    lokaalAanwezig: true,
    bytes: 1_000_000,
    sha256: 'b'.repeat(64),
    zipLeesbaar: true,
    bestanden: ['0106PND.xml', '0106VBO.xml', '0106NUM.xml'],
    xsdValidatieUitgevoerd: false,
  },
];

describe('officiële BAG bronacquisitie', () => {
  it('registreert uitsluitend officiële Kadaster-downloadpunten', () => {
    expect(BAG_OFFICIELE_BRONNEN).toHaveLength(2);
    expect(BAG_OFFICIELE_BRONNEN.every(bron => bron.bronhouder === 'Kadaster')).toBe(true);
    expect(BAG_OFFICIELE_BRONNEN.every(bron => bron.url.startsWith('https://'))).toBe(true);
  });

  it('blokkeert een bestand zonder checksum en inhoudsinventarisatie', () => {
    const bron = BAG_OFFICIELE_BRONNEN[0];
    const validatie = valideerBagBronbestandInspectie(bron, {
      ...inspecties[0],
      sha256: null,
      bestanden: [],
    });

    expect(validatie.vrijgegeven).toBe(false);
    expect(validatie.fouten).toEqual(expect.arrayContaining([
      'Een geldige SHA-256-checksum ontbreekt.',
      'De ZIP-inhoud is niet geïnventariseerd.',
    ]));
  });

  it('blokkeert het XSD-pakket zolang XSD-validatie niet is uitgevoerd', () => {
    const bron = BAG_OFFICIELE_BRONNEN[0];
    const validatie = valideerBagBronbestandInspectie(bron, {
      ...inspecties[0],
      xsdValidatieUitgevoerd: false,
    });

    expect(validatie.vrijgegeven).toBe(false);
    expect(validatie.fouten).toContain('XSD-validatie is nog niet uitgevoerd.');
  });

  it('geeft de officiële mapping pas vrij na beide volledige inspecties', () => {
    expect(officieleXmlMappingMagWordenVrijgegeven(inspecties).vrijgegeven).toBe(true);
    expect(officieleXmlMappingMagWordenVrijgegeven(inspecties.slice(0, 1)).vrijgegeven).toBe(false);
  });
});
