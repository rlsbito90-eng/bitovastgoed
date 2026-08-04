import { describe, expect, it } from 'vitest';
import { bouwAcquisitieDossierContext } from './acquisitieDossierContext';
import {
  bouwAcquisitieEigenaarWerkstroomModel,
  normaliseerAcquisitieEigenaarStatus,
} from './acquisitieEigenaarWerkstroom';

describe('normaliseerAcquisitieEigenaarStatus', () => {
  it('behoudt bekende statussen en valt veilig terug', () => {
    expect(normaliseerAcquisitieEigenaarStatus('gevonden')).toBe('gevonden');
    expect(normaliseerAcquisitieEigenaarStatus('legacy_status')).toBe('niet_gestart');
  });
});

describe('bouwAcquisitieEigenaarWerkstroomModel', () => {
  it('maakt relatie- en briefacties beschikbaar zodra een eigenaar bekend is', () => {
    const dossier = bouwAcquisitieDossierContext('vastgoedkans', {
      id: 'kans-1',
      adres: 'Doevenkamp 3',
      postcode: '9401 KN',
      plaats: 'Assen',
    });

    const model = bouwAcquisitieEigenaarWerkstroomModel({
      dossier,
      status: 'gevonden',
      eigenaarNaam: 'Voorbeeld Vastgoed B.V.',
      eigenaarBron: 'Kadaster',
      kadastraleAanduiding: 'ASN00 A 1234',
    });

    expect(model.heeftEigenaar).toBe(true);
    expect(model.kanRelatieKoppelen).toBe(true);
    expect(model.kanBriefVoorbereiden).toBe(true);
    expect(model.kanEigenaarZoeken).toBe(true);
  });

  it('herkent een bestaande eigenaarrelatie zonder losse naam', () => {
    const dossier = bouwAcquisitieDossierContext('off_market_signaal', {
      id: 'signaal-1',
      adres: 'Stationsstraat 1',
      eigenaarRelatieId: 'relatie-1',
    });

    const model = bouwAcquisitieEigenaarWerkstroomModel({ dossier });

    expect(model.heeftEigenaar).toBe(true);
    expect(model.heeftRelatiekoppeling).toBe(true);
    expect(model.kanBriefVoorbereiden).toBe(true);
  });

  it('blokkeert geen handmatig onderzoek maar houdt vervolgacties dicht zonder eigenaar', () => {
    const dossier = bouwAcquisitieDossierContext('vastgoedkans', {
      id: 'kans-2',
      adres: 'Markt 1',
    });

    const model = bouwAcquisitieEigenaarWerkstroomModel({ dossier });

    expect(model.kanEigenaarZoeken).toBe(true);
    expect(model.kanRelatieKoppelen).toBe(false);
    expect(model.kanBriefVoorbereiden).toBe(false);
  });
});
