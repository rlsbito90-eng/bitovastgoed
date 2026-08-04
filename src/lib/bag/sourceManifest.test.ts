import { describe, expect, it } from 'vitest';
import {
  bouwBagDatasetversieIdentiteit,
  valideerBagBronpakketManifest,
  type BagBronpakketManifest,
} from './sourceManifest';

const checksum = (teken: string) => teken.repeat(64);

function geldigManifest(): BagBronpakketManifest {
  return {
    manifestVersie: 1,
    scopeCode: '0363',
    scopeNaam: 'Amsterdam',
    leverancier: 'Kadaster',
    product: 'BAG Extract',
    leverdatum: '2026-08-01',
    ontvangenOp: '2026-08-04',
    bronUrlRegistratie: 'https://example.invalid/kadaster-bag-extract-registratie',
    bestanden: [
      { pad: 'objecten.xml', sha256: checksum('a'), bytes: 100, type: 'objecten' },
      { pad: 'voorkomens.xml', sha256: checksum('b'), bytes: 200, type: 'voorkomens' },
      { pad: 'relaties.xml', sha256: checksum('c'), bytes: 300, type: 'relaties' },
      { pad: 'geometrieen.xml', sha256: checksum('d'), bytes: 400, type: 'geometrieen' },
    ],
    verwachteTellingen: {
      objecten: 1,
      voorkomens: 2,
      relaties: 3,
      geometrieen: 1,
    },
  };
}

describe('BAG-bronpakketmanifest', () => {
  it('accepteert een compleet officieel Amsterdam-manifest', () => {
    const resultaat = valideerBagBronpakketManifest(geldigManifest(), '0363');
    expect(resultaat.geldig).toBe(true);
    expect(resultaat.fouten).toEqual([]);
    expect(resultaat.totaalBytes).toBe(1000);
  });

  it('blokkeert een verkeerde gemeentecode', () => {
    const resultaat = valideerBagBronpakketManifest(geldigManifest(), '0599');
    expect(resultaat.geldig).toBe(false);
    expect(resultaat.fouten).toContain('Scopecode komt niet overeen met de bedoelde importscope.');
  });

  it('blokkeert onvolledige bestandstypen en ongeldige checksums', () => {
    const manifest = geldigManifest();
    manifest.bestanden = [{ pad: 'objecten.xml', sha256: 'niet-geldig', bytes: 100, type: 'objecten' }];
    const resultaat = valideerBagBronpakketManifest(manifest, '0363');
    expect(resultaat.geldig).toBe(false);
    expect(resultaat.fouten).toContain('Ongeldige SHA-256 voor objecten.xml.');
    expect(resultaat.fouten).toContain('Ontbrekende bronbestandstypen: voorkomens, relaties, geometrieen.');
  });

  it('maakt een deterministische datasetversie-identiteit onafhankelijk van bestandsvolgorde', () => {
    const links = geldigManifest();
    const rechts = geldigManifest();
    rechts.bestanden.reverse();
    expect(bouwBagDatasetversieIdentiteit(links)).toBe(bouwBagDatasetversieIdentiteit(rechts));
  });
});
