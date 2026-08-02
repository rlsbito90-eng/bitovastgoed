import { describe, expect, it } from 'vitest';
import {
  totaleFaseTijdMs,
  totaleOpslagBytes,
  valideerBagVolumeproefConfiguratie,
  valideerBagVolumeproefResultaat,
  type BagVolumeproefConfiguratie,
  type BagVolumeproefResultaat,
} from './volumeproef';

const veiligeConfiguratie: BagVolumeproefConfiguratie = {
  naam: 'Tilburg volledige gemeenteproef',
  omgeving: 'tijdelijk',
  scope: 'gemeente',
  scopeCode: '0855',
  scopeNaam: 'Tilburg',
  bronbestand: 'bag-tilburg-2026-08.zip',
  bronPeildatum: '2026-08-08',
  maximaleViewportResultaten: 2_500,
  productieSchrijfactiesToegestaan: false,
  crmPromotieToegestaan: false,
};

function geldigResultaat(): BagVolumeproefResultaat {
  return {
    configuratie: veiligeConfiguratie,
    objectTellingen: {
      panden: 70_000,
      verblijfsobjecten: 115_000,
      nummeraanduidingen: 118_000,
      openbareRuimten: 3_000,
      woonplaatsen: 4,
      pandVboRelaties: 116_000,
      vboAdresRelaties: 118_000,
      geweigerd: 12,
    },
    faseTijdenMs: {
      uitpakken: 1_000,
      parsen: 8_000,
      stagingLoad: 6_000,
      valideren: 2_000,
      publiceren: 1_000,
      zoekindexOpbouwen: 4_000,
      ruimtelijkKoppelen: 5_000,
    },
    opslagBytes: {
      staging: 100,
      bronlaag: 200,
      zoekindex: 50,
      geometrieIndexen: 80,
      overigeIndexen: 40,
    },
    queryMetingen: [
      {
        queryType: 'viewport_punten',
        runs: 20,
        p50Ms: 45,
        p95Ms: 120,
        maximumMs: 180,
        resultaatAantal: 2_500,
        afgekapt: true,
        cache: 'warm',
      },
    ],
    checksumGeverifieerd: true,
    importIdempotent: true,
    stilleUitval: 0,
  };
}

describe('BAG volumeproefcontract', () => {
  it('accepteert een geïsoleerde gemeenteproef zonder CRM-promotie', () => {
    const validatie = valideerBagVolumeproefConfiguratie(veiligeConfiguratie);

    expect(validatie.geldig).toBe(true);
    expect(validatie.fouten).toEqual([]);
  });

  it('blokkeert een proef die productie of CRM schrijft', () => {
    const validatie = valideerBagVolumeproefConfiguratie({
      ...veiligeConfiguratie,
      omgeving: 'productie',
      productieSchrijfactiesToegestaan: true,
      crmPromotieToegestaan: true,
    });

    expect(validatie.geldig).toBe(false);
    expect(validatie.fouten).toEqual(expect.arrayContaining([
      'BUILD 2A.1 mag niet in productie worden uitgevoerd.',
      'Productieschrijfacties zijn binnen BUILD 2A.1 verboden.',
      'Automatische CRM-promotie is binnen de BAG-volumeproef verboden.',
    ]));
  });

  it('waarschuwt bij een te brede eerste proefscope en zware viewportlimiet', () => {
    const validatie = valideerBagVolumeproefConfiguratie({
      ...veiligeConfiguratie,
      scope: 'landelijk',
      maximaleViewportResultaten: 20_000,
    });

    expect(validatie.geldig).toBe(true);
    expect(validatie.waarschuwingen).toHaveLength(2);
  });

  it('telt fase- en opslagmetingen deterministisch op', () => {
    const resultaat = geldigResultaat();

    expect(totaleFaseTijdMs(resultaat.faseTijdenMs)).toBe(27_000);
    expect(totaleOpslagBytes(resultaat.opslagBytes)).toBe(470);
  });

  it('accepteert een sluitend, idempotent proefresultaat', () => {
    const validatie = valideerBagVolumeproefResultaat(geldigResultaat());

    expect(validatie.geldig).toBe(true);
    expect(validatie.fouten).toEqual([]);
  });

  it('weigert stille uitval, ontbrekende checksum en niet-idempotente import', () => {
    const resultaat = geldigResultaat();
    resultaat.checksumGeverifieerd = false;
    resultaat.importIdempotent = false;
    resultaat.stilleUitval = 3;

    const validatie = valideerBagVolumeproefResultaat(resultaat);

    expect(validatie.geldig).toBe(false);
    expect(validatie.fouten).toEqual(expect.arrayContaining([
      'De checksum van het bronbestand is niet geverifieerd.',
      'De import is niet aantoonbaar idempotent.',
      'De proef bevat stille uitval; ieder geweigerd record moet een reden hebben.',
    ]));
  });

  it('blokkeert een onbegrensde viewportresponse boven de limiet', () => {
    const resultaat = geldigResultaat();
    resultaat.queryMetingen[0] = {
      ...resultaat.queryMetingen[0],
      resultaatAantal: 3_000,
      afgekapt: false,
    };

    const validatie = valideerBagVolumeproefResultaat(resultaat);

    expect(validatie.geldig).toBe(false);
    expect(validatie.fouten).toContain(
      'Viewportquery viewport_punten overschrijdt de limiet zonder afkappingsindicatie.',
    );
  });
});