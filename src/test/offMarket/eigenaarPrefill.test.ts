import { describe, it, expect } from 'vitest';
import {
  signaalNaarRelatiePrefill,
  EIGENAAR_TAAK_TEMPLATES,
  deadlineOverDagen,
} from '@/lib/offMarket/eigenaar';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

const baseSignaal = {
  id: 'sig-1',
  plaats: 'Amsterdam',
  postcode: '1011AB',
  eigenaar_naam: 'Jan Janssen',
  eigenaar_bedrijfsnaam: 'Acme BV',
  eigenaar_type: 'bv',
  eigenaar_telefoon: '0612345678',
  eigenaar_email: 'jan@acme.nl',
  eigenaar_website: 'https://acme.nl',
  eigenaar_linkedin: 'https://linkedin.com/in/jan',
  eigenaar_kvk: '12345678',
} as unknown as OffMarketSignaal;

describe('signaalNaarRelatiePrefill', () => {
  it('mapt eigenaargegevens naar relatie-prefill', () => {
    const p = signaalNaarRelatiePrefill(baseSignaal);
    expect(p.relatie.bedrijfsnaam).toBe('Acme BV');
    expect(p.relatie.type).toBe('eigenaar');
    expect(p.relatie.telefoon).toBe('0612345678');
    expect(p.relatie.email).toBe('jan@acme.nl');
    expect(p.relatie.website).toBe('https://acme.nl');
    expect(p.relatie.linkedinUrl).toBe('https://linkedin.com/in/jan');
    expect(p.relatie.kvkNummer).toBe('12345678');
    expect(p.relatie.vestigingsplaats).toBe('Amsterdam');
    expect(p.relatie.vestigingspostcode).toBe('1011AB');
    expect(p.relatie.bronRelatie).toBe('off_market_radar');
  });

  it('valt terug op eigenaar_naam als bedrijfsnaam ontbreekt', () => {
    const s = { ...baseSignaal, eigenaar_bedrijfsnaam: null } as any;
    expect(signaalNaarRelatiePrefill(s).relatie.bedrijfsnaam).toBe('Jan Janssen');
  });

  it('mapt overheid naar partijtype overig, anders eigenaar', () => {
    expect(signaalNaarRelatiePrefill({ ...baseSignaal, eigenaar_type: 'overheid' } as any).relatie.type).toBe('overig');
    expect(signaalNaarRelatiePrefill({ ...baseSignaal, eigenaar_type: 'particulier' } as any).relatie.type).toBe('eigenaar');
  });

  it('vult primaire contactpersoon prefill correct', () => {
    const p = signaalNaarRelatiePrefill(baseSignaal);
    expect(p.contactpersoon.naam).toBe('Jan Janssen');
    expect(p.contactpersoon.email).toBe('jan@acme.nl');
    expect(p.contactpersoon.telefoon).toBe('0612345678');
  });

  it('werkt zonder eigenaargegevens', () => {
    const p = signaalNaarRelatiePrefill({ id: 'x', plaats: null, postcode: null } as any);
    expect(p.relatie.bedrijfsnaam).toBe('');
    expect(p.relatie.type).toBe('eigenaar');
  });
});

describe('EIGENAAR_TAAK_TEMPLATES', () => {
  it('bevat alle verwachte templates met geldige velden', () => {
    const ids = EIGENAAR_TAAK_TEMPLATES.map(t => t.id);
    for (const id of ['achterhalen','kadaster','kvk','bellen','email','opvolgen','documenten']) {
      expect(ids).toContain(id);
    }
    for (const t of EIGENAAR_TAAK_TEMPLATES) {
      expect(t.titel).toBeTruthy();
      expect(t.type).toBeTruthy();
      expect(['laag','normaal','hoog','urgent']).toContain(t.prioriteit);
      expect(typeof t.dagen).toBe('number');
    }
  });
});

describe('deadlineOverDagen', () => {
  it('formatteert YYYY-MM-DD voor 0 dagen', () => {
    const now = new Date(2026, 5, 7); // 7 juni 2026
    expect(deadlineOverDagen(0, now)).toBe('2026-06-07');
  });
  it('telt dagen op', () => {
    const now = new Date(2026, 5, 7);
    expect(deadlineOverDagen(3, now)).toBe('2026-06-10');
  });
});
