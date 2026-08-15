import { describe, expect, it } from 'vitest';
import { patchPayload } from '@/hooks/useVastgoedkansen';

describe('BUILD 2.0C — Vastgoedkans partial-update integriteit', () => {
  it('muteert alleen expliciet aangeleverde velden', () => {
    expect(patchPayload({ status: 'opvolgen', reactieStatus: 'reactie_ontvangen' })).toEqual({
      status: 'opvolgen',
      reactie_status: 'reactie_ontvangen',
    });
  });

  it('wist ontbrekende pand- en BAG-data niet bij een detailformulier-update', () => {
    const patch = patchPayload({
      eigenaarStatus: 'bevestigd',
      eigenaarNaam: 'A.W. Enthoven',
      onderzoeksnotities: 'Gecontroleerd',
    });

    expect(patch).not.toHaveProperty('adres');
    expect(patch).not.toHaveProperty('postcode');
    expect(patch).not.toHaveProperty('plaats');
    expect(patch).not.toHaveProperty('bag_pand_id');
    expect(patch).not.toHaveProperty('bag_verblijfsobject_id');
    expect(patch).not.toHaveProperty('volgende_actie_datum');
    expect(patch).not.toHaveProperty('reden_interessant');
  });

  it('kan een veld nog bewust leegmaken', () => {
    expect(patchPayload({
      eigenaarNaam: '',
      opvolgdatum: null,
      volgendeActieOmschrijving: '',
      eigenaarRelatieId: null,
    })).toEqual({
      eigenaar_naam: null,
      eigenaar_relatie_id: null,
      opvolgdatum: null,
      volgende_actie_omschrijving: null,
    });
  });

  it('maakt geen patch voor een leeg update-object', () => {
    expect(patchPayload({})).toEqual({});
  });
});
