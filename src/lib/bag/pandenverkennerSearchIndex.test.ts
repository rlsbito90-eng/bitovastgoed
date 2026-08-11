import { describe, expect, it } from 'vitest';
import {
  type BagPandSearchIndexRij,
  valideerBagPandSearchIndexRij,
} from './pandenverkennerSearchIndex';

function basisRij(): BagPandSearchIndexRij {
  return {
    datasetversieId: '123',
    scopeCode: '0363',
    pandIdentificatie: '0363100012345678',
    voorkomenSleutel: 'Pand:0363100012345678:1',
    indexVersie: 'pv2-v1',
    pandstatusHuidig: 'Pand in gebruik',
    oorspronkelijkBouwjaar: 1928,
    heeftVbo: true,
    vboAantal: 3,
    vboOppervlakteSom: 240,
    vboOppervlakteMax: 110,
    gebruiksdoelen: ['kantoorfunctie', 'woonfunctie'],
    isGemengd: true,
    adres: {
      primairAdres: 'Wibautstraat 131',
      primairStraat: 'Wibautstraat',
      primairHuisnummer: '131',
      primairPostcode: '1091GL',
      primairPlaats: 'Amsterdam',
      adresCount: 3,
    },
    gebied: {
      gemeenteCode: 'GM0363',
      gemeenteNaam: 'Amsterdam',
      cbsJaarversie: 2026,
      wijkCode: null,
      wijkNaam: null,
      buurtCode: null,
      buurtNaam: null,
      stadsdeelCode: null,
      stadsdeelNaam: null,
    },
  };
}

describe('Pandenverkenner 2.0 search-index contract', () => {
  it('accepteert een pand met afzonderlijke VBO-som, max en aantal', () => {
    const resultaat = valideerBagPandSearchIndexRij(basisRij());
    expect(resultaat).toEqual({ geldig: true, fouten: [] });
  });

  it('modelleert een pand zonder VBO met NULL-oppervlakten en vboAantal=0', () => {
    const rij = basisRij();
    rij.heeftVbo = false;
    rij.vboAantal = 0;
    rij.vboOppervlakteSom = null;
    rij.vboOppervlakteMax = null;
    rij.gebruiksdoelen = [];
    rij.isGemengd = false;
    rij.adres = {
      primairAdres: null,
      primairStraat: null,
      primairHuisnummer: null,
      primairPostcode: null,
      primairPlaats: null,
      adresCount: 0,
    };

    expect(valideerBagPandSearchIndexRij(rij)).toEqual({ geldig: true, fouten: [] });
  });

  it('verbiedt dat ontbrekende VBO-oppervlakte als 0 wordt voorgesteld', () => {
    const rij = basisRij();
    rij.heeftVbo = false;
    rij.vboAantal = 0;
    rij.vboOppervlakteSom = 0;
    rij.vboOppervlakteMax = 0;
    rij.gebruiksdoelen = [];
    rij.isGemengd = false;

    const resultaat = valideerBagPandSearchIndexRij(rij);
    expect(resultaat.geldig).toBe(false);
    expect(resultaat.fouten).toContain('heeftVbo=false vereist vboOppervlakteSom=NULL.');
    expect(resultaat.fouten).toContain('heeftVbo=false vereist vboOppervlakteMax=NULL.');
  });

  it('borgt dat max-oppervlakte nooit groter is dan de som', () => {
    const rij = basisRij();
    rij.vboOppervlakteSom = 100;
    rij.vboOppervlakteMax = 120;

    expect(valideerBagPandSearchIndexRij(rij).fouten)
      .toContain('vboOppervlakteMax mag niet groter zijn dan vboOppervlakteSom.');
  });

  it('leidt gemengd gebruik deterministisch af uit meerdere gebruiksdoelen', () => {
    const rij = basisRij();
    rij.gebruiksdoelen = ['woonfunctie'];
    rij.isGemengd = true;

    expect(valideerBagPandSearchIndexRij(rij).fouten)
      .toContain('isGemengd moet deterministisch volgen uit meerdere gebruiksdoelen.');
  });

  it('vereist een primair adres wanneer adressen aanwezig zijn', () => {
    const rij = basisRij();
    rij.adres.primairAdres = null;

    expect(valideerBagPandSearchIndexRij(rij).fouten)
      .toContain('adresCount>0 vereist een deterministisch primairAdres.');
  });

  it('vereist provenance en scope', () => {
    const rij = basisRij();
    rij.datasetversieId = '';
    rij.scopeCode = '';
    rij.indexVersie = '';

    const resultaat = valideerBagPandSearchIndexRij(rij);
    expect(resultaat.geldig).toBe(false);
    expect(resultaat.fouten).toEqual(expect.arrayContaining([
      'datasetversieId is verplicht.',
      'scopeCode is ongeldig.',
      'indexVersie is verplicht.',
    ]));
  });
});
