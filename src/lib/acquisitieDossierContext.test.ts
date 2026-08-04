import { describe, expect, it } from 'vitest';
import {
  bouwAcquisitieDossierContext,
  VOLLEDIGE_INTERNE_ACQUISITIE_CAPABILITIES,
} from './acquisitieDossierContext';

describe('bouwAcquisitieDossierContext', () => {
  it('normaliseert een vastgoedkans naar één CRM-brede dossiercontext', () => {
    expect(bouwAcquisitieDossierContext('vastgoedkans', {
      id: ' kans-1 ',
      objectId: ' obj-1 ',
      adres: 'Doevenkamp 3',
      postcode: '9401KN',
      plaats: 'Assen',
      eigenaarRelatieId: ' relatie-1 ',
    })).toEqual({
      bronType: 'vastgoedkans',
      bronId: 'kans-1',
      objectId: 'obj-1',
      adres: 'Do evenkamp 3',
      plaats: 'Assen',
      eigenaarRelatieId: 'relatie-1',
    });
  });

  it('accepteert ontbrekende optionele koppelingen', () => {
    expect(bouwAcquisitieDossierContext('off_market_signaal', {
      id: 'signaal-1',
      adres: 'Stationsstraat 1',
    })).toEqual({
      bronType: 'off_market_signaal',
      bronId: 'signaal-1',
      objectId: null,
      adres: 'Stationsstraat 1',
      plaats: null,
      eigenaarRelatieId: null,
    });
  });

  it('weigert een lege bron-ID', () => {
    expect(() => bouwAcquisitieDossierContext('vastgoedkans', { id: '   ' }))
      .toThrow('Acquisitiedossier vereist een bron-ID.');
  });
});

describe('VOLLEDIGE_INTERNE_ACQUISITIE_CAPABILITIES', () => {
  it('houdt Kadasterregistratie handmatig maar beschikbaar voor interne workflows', () => {
    expect(VOLLEDIGE_INTERNE_ACQUISITIE_CAPABILITIES.eigenaar.kanKadasterCheckRegistreren).toBe(true);
    expect(VOLLEDIGE_INTERNE_ACQUISITIE_CAPABILITIES.brieven.kanBriefVoorbereiden).toBe(true);
  });
});
