import { describe, expect, it } from 'vitest';
import {
  classifyLostReason,
  DEAL_ARCHIVE_REASONS,
  OBJECT_ARCHIVE_REASONS,
} from '@/lib/lifecycle/lostReasons';

describe('CRM lifecycle lost reasons', () => {
  it('classificeert de belangrijkste commerciële verliesoorzaken stabiel', () => {
    expect(classifyLostReason('Prijs / waarderingsverschil')).toBe('price_gap');
    expect(classifyLostReason('Verkocht extern / aan derde')).toBe('sold_external');
    expect(classifyLostReason('Ingetrokken door eigenaar')).toBe('seller_withdrew');
    expect(classifyLostReason('Koper afgehaakt na bezichtiging')).toBe('buyer_withdrew');
    expect(classifyLostReason('Investment case niet haalbaar door bouwkosten')).toBe('investment_case_failed');
    expect(classifyLostReason('Geen passende koper / kandidaat')).toBe('no_suitable_buyer');
    expect(classifyLostReason('Op Funda gezet')).toBe('public_market');
    expect(classifyLostReason('Onvoldoende informatie beschikbaar')).toBe('insufficient_information');
    expect(classifyLostReason('Proces / timing')).toBe('process_timing');
  });

  it('vereist expliciete succesformulering voor won', () => {
    expect(classifyLostReason('Succesvol afgerond')).toBe('won');
    expect(classifyLostReason('Succesvol afgerond via Bito Vastgoed')).toBe('won');
    // Legacy/default tekst alleen is bewust onvoldoende bewijs voor realized fee.
    expect(classifyLostReason('Verkocht via Bito Vastgoed')).toBe('other');
    expect(classifyLostReason('Handmatig gearchiveerd')).toBe('manual_archive');
  });

  it('behoudt een expliciete Anders-optie in beide canonieke keuzelijsten', () => {
    expect(OBJECT_ARCHIVE_REASONS).toContain('Anders');
    expect(DEAL_ARCHIVE_REASONS).toContain('Anders');
  });

  it('biedt een expliciete won-keuze en externe verkoop als aparte objectredenen', () => {
    expect(OBJECT_ARCHIVE_REASONS).toContain('Succesvol afgerond via Bito Vastgoed');
    expect(OBJECT_ARCHIVE_REASONS).toContain('Verkocht extern / aan derde');
  });

  it('geeft onbekende vrije tekst veilig terug als other', () => {
    expect(classifyLostReason('Onverwachte uitzonderingssituatie')).toBe('other');
    expect(classifyLostReason(undefined)).toBeUndefined();
  });
});
