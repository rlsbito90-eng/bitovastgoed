import { describe, it, expect } from 'vitest';
import {
  SIGNAAL_LEEG, validateSignaal, formStateToPayload, signaalToFormState,
} from '@/lib/offMarket/form';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

describe('off-market validateSignaal', () => {
  it('vereist titel, assettype, bron_type, type_signaal en status', () => {
    const r = validateSignaal({ ...SIGNAAL_LEEG, titel: '   ' });
    expect(r.ok).toBe(false);
    expect(r.errors.titel).toBeTruthy();
  });

  it('keurt geldig minimaal signaal goed', () => {
    const r = validateSignaal({ ...SIGNAAL_LEEG, titel: 'Stationsweg 12' });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual({});
  });

  it('faalt bij ongeldige URL', () => {
    const r = validateSignaal({ ...SIGNAAL_LEEG, titel: 'X', bron_url: 'ftp://x' });
    expect(r.ok).toBe(false);
    expect(r.errors.bron_url).toBeTruthy();
  });

  it('accepteert https URL', () => {
    const r = validateSignaal({ ...SIGNAAL_LEEG, titel: 'X', bron_url: 'https://officielebekendmakingen.nl/abc' });
    expect(r.ok).toBe(true);
  });
});

describe('off-market formStateToPayload', () => {
  it('zet lege strings om naar null', () => {
    const p = formStateToPayload({ ...SIGNAAL_LEEG, titel: 'X' });
    expect(p.titel).toBe('X');
    expect(p.adres).toBeNull();
    expect(p.plaats).toBeNull();
    expect(p.omschrijving).toBeNull();
    expect(p.bron_url).toBeNull();
    expect(p.indicatieve_waarde).toBeNull();
  });

  it('trimt strings', () => {
    const p = formStateToPayload({ ...SIGNAAL_LEEG, titel: '  Hoi  ', plaats: '  Den Bosch  ' });
    expect(p.titel).toBe('Hoi');
    expect(p.plaats).toBe('Den Bosch');
  });

  it('behoudt numerieke velden', () => {
    const p = formStateToPayload({
      ...SIGNAAL_LEEG, titel: 'X', indicatieve_waarde: 850000, mogelijke_fee: 12500,
    });
    expect(p.indicatieve_waarde).toBe(850000);
    expect(p.mogelijke_fee).toBe(12500);
  });
});

describe('off-market signaalToFormState (roundtrip)', () => {
  it('mapt null naar lege strings', () => {
    const row = {
      id: 'a', titel: 'T', assettype: 'kantoor', bron_type: 'handmatig',
      type_signaal: 'handmatige_research', status: 'nieuw_signaal', prioriteit: 'midden',
      adres: null, postcode: null, plaats: null, provincie: null, regio: null,
      omschrijving: null, bron_url: null, bron_referentie: null, bron_datum: null,
      indicatieve_waarde: null, mogelijke_fee: null, potentiele_strategie: null,
      volgende_actie_datum: null, volgende_actie_omschrijving: null, notities: null,
    } as unknown as OffMarketSignaal;
    const f = signaalToFormState(row);
    expect(f.titel).toBe('T');
    expect(f.adres).toBe('');
    expect(f.indicatieve_waarde).toBeNull();
  });
});
