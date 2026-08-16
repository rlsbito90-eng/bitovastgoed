import { describe, expect, it } from 'vitest';

import {
  ACQUISITIE_KOSTENCATEGORIEEN,
  COMMERCIELE_KWALIFICATIES,
  dossierPastBijBron,
  heeftExactEenAcquisitieDossier,
  isAcquisitieKostencategorie,
  isCommercieleKwalificatie,
} from './commercialOutcomeContract';

describe('TRACK-8A kosten- en kwalificatiecontract', () => {
  it('houdt Kadaster buiten de generieke kostenledger', () => {
    expect(ACQUISITIE_KOSTENCATEGORIEEN).toEqual([
      'postage',
      'printing',
      'envelope',
      'mailhouse',
      'other',
    ]);
    expect(isAcquisitieKostencategorie('kadaster')).toBe(false);
  });

  it('legt de commerciële kwalificaties expliciet en los van sentiment vast', () => {
    expect(COMMERCIELE_KWALIFICATIES).toEqual([
      'potential_seller',
      'buyer',
      'both',
      'recontact_later',
      'no_commercial_chance',
      'other',
    ]);
    expect(isCommercieleKwalificatie('positive')).toBe(false);
    expect(isCommercieleKwalificatie('potential_seller')).toBe(true);
  });

  it('accepteert exact één dossierbron en bewaakt dat die bij de bron hoort', () => {
    expect(heeftExactEenAcquisitieDossier({ vastgoedkansId: 'vk-1', signaalId: null })).toBe(true);
    expect(heeftExactEenAcquisitieDossier({ vastgoedkansId: null, signaalId: 'sig-1' })).toBe(true);
    expect(heeftExactEenAcquisitieDossier({ vastgoedkansId: 'vk-1', signaalId: 'sig-1' })).toBe(false);
    expect(heeftExactEenAcquisitieDossier({ vastgoedkansId: null, signaalId: null })).toBe(false);

    expect(dossierPastBijBron({
      bron: 'vastgoedkansen',
      vastgoedkansId: 'vk-1',
      signaalId: null,
    })).toBe(true);
    expect(dossierPastBijBron({
      bron: 'off_market_radar',
      vastgoedkansId: null,
      signaalId: 'sig-1',
    })).toBe(true);
    expect(dossierPastBijBron({
      bron: 'vastgoedkansen',
      vastgoedkansId: null,
      signaalId: 'sig-1',
    })).toBe(false);
  });
});
