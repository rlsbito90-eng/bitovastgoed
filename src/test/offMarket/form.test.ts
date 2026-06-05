import { describe, it, expect } from 'vitest';
import {
  SIGNAAL_LEEG, validateSignaal, formStateToPayload, signaalToFormState,
  isValidIsoDate, MAX_INDICATIEVE_WAARDE, MAX_MOGELIJKE_FEE,
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

describe('off-market validateSignaal — numeriek (Bug 3)', () => {
  it('blokkeert negatieve indicatieve waarde', () => {
    const r = validateSignaal({ ...SIGNAAL_LEEG, titel: 'X', indicatieve_waarde: -1 });
    expect(r.ok).toBe(false);
    expect(r.errors.indicatieve_waarde).toMatch(/negatief/i);
  });

  it('blokkeert negatieve mogelijke fee', () => {
    const r = validateSignaal({ ...SIGNAAL_LEEG, titel: 'X', mogelijke_fee: -100 });
    expect(r.ok).toBe(false);
    expect(r.errors.mogelijke_fee).toMatch(/negatief/i);
  });

  it('blokkeert te hoge indicatieve waarde', () => {
    const r = validateSignaal({
      ...SIGNAAL_LEEG, titel: 'X', indicatieve_waarde: MAX_INDICATIEVE_WAARDE + 1,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.indicatieve_waarde).toBeTruthy();
  });

  it('blokkeert te hoge mogelijke fee', () => {
    const r = validateSignaal({
      ...SIGNAAL_LEEG, titel: 'X', mogelijke_fee: MAX_MOGELIJKE_FEE + 1,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.mogelijke_fee).toBeTruthy();
  });

  it('staat 0 toe als indicatieve waarde en fee', () => {
    const r = validateSignaal({
      ...SIGNAAL_LEEG, titel: 'X', indicatieve_waarde: 0, mogelijke_fee: 0,
    });
    expect(r.ok).toBe(true);
  });

  it('staat null toe (leeg gelaten)', () => {
    const r = validateSignaal({
      ...SIGNAAL_LEEG, titel: 'X', indicatieve_waarde: null, mogelijke_fee: null,
    });
    expect(r.ok).toBe(true);
    const p = formStateToPayload({
      ...SIGNAAL_LEEG, titel: 'X', indicatieve_waarde: null, mogelijke_fee: null,
    });
    expect(p.indicatieve_waarde).toBeNull();
    expect(p.mogelijke_fee).toBeNull();
  });

  it('staat realistische bovengrens toe', () => {
    const r = validateSignaal({
      ...SIGNAAL_LEEG, titel: 'X',
      indicatieve_waarde: MAX_INDICATIEVE_WAARDE,
      mogelijke_fee: MAX_MOGELIJKE_FEE,
    });
    expect(r.ok).toBe(true);
  });
});

describe('off-market isValidIsoDate (Bug 4)', () => {
  it('accepteert lege string', () => {
    expect(isValidIsoDate('')).toBe(true);
    expect(isValidIsoDate('   ')).toBe(true);
  });

  it('accepteert geldige datums', () => {
    expect(isValidIsoDate('2026-06-05')).toBe(true);
    expect(isValidIsoDate('2024-02-29')).toBe(true); // schrikkeljaar
    expect(isValidIsoDate('1999-12-31')).toBe(true);
  });

  it('weigert ongeldige datums', () => {
    expect(isValidIsoDate('2025-02-30')).toBe(false);
    expect(isValidIsoDate('2025-13-01')).toBe(false);
    expect(isValidIsoDate('2025-00-10')).toBe(false);
    expect(isValidIsoDate('2023-02-29')).toBe(false); // geen schrikkeljaar
  });

  it('weigert verkeerd formaat', () => {
    expect(isValidIsoDate('05-06-2026')).toBe(false);
    expect(isValidIsoDate('2026/06/05')).toBe(false);
    expect(isValidIsoDate('2026-6-5')).toBe(false);
    expect(isValidIsoDate('abc')).toBe(false);
    expect(isValidIsoDate('2026-06-05T00:00:00')).toBe(false);
  });
});

describe('off-market validateSignaal — datums (Bug 4)', () => {
  it('blokkeert ongeldige bron_datum', () => {
    const r = validateSignaal({ ...SIGNAAL_LEEG, titel: 'X', bron_datum: '2025-02-30' });
    expect(r.ok).toBe(false);
    expect(r.errors.bron_datum).toBeTruthy();
  });

  it('blokkeert ongeldige volgende_actie_datum', () => {
    const r = validateSignaal({ ...SIGNAAL_LEEG, titel: 'X', volgende_actie_datum: 'nope' });
    expect(r.ok).toBe(false);
    expect(r.errors.volgende_actie_datum).toBeTruthy();
  });

  it('accepteert geldige datums', () => {
    const r = validateSignaal({
      ...SIGNAAL_LEEG, titel: 'X',
      bron_datum: '2026-06-05', volgende_actie_datum: '2026-07-01',
    });
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
