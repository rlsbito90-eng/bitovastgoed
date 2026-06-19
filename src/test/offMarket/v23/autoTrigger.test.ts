// V2.3 — Auto-trigger helpers.
import { describe, it, expect } from 'vitest';
import {
  magAiAutoVerrijken, magBagAutoVerrijken,
  strategieMatchVoorBag, adresKwaliteitVoldoende,
} from '@/lib/offMarket/bag/autoTrigger';
import type { SignaalBagInput } from '@/lib/offMarket/bag/types';

function s(p: Partial<SignaalBagInput> = {}): SignaalBagInput {
  return {
    id: 's1',
    titel: 'Testpand 1',
    plaats: 'Voorbeeldstad',
    adres: 'Demostraat 12',
    postcode: '1000AA',
    ai_status: 'niet_verrijkt',
    bag_status: 'niet_verrijkt',
    ...p,
  };
}

describe('magAiAutoVerrijken', () => {
  it('staat toe bij volledig signaal zonder AI-verrijking', () => {
    expect(magAiAutoVerrijken(s()).toegestaan).toBe(true);
  });
  it('weigert gearchiveerd signaal', () => {
    expect(magAiAutoVerrijken(s({ gearchiveerd_op: '2026-01-01' })).toegestaan).toBe(false);
  });
  it('weigert afgevallen status', () => {
    expect(magAiAutoVerrijken(s({ status: 'afgevallen' })).toegestaan).toBe(false);
  });
  it('weigert wanneer AI bezig is', () => {
    expect(magAiAutoVerrijken(s({ ai_status: 'bezig' })).toegestaan).toBe(false);
  });
  it('weigert wanneer AI in wachtrij of klaar staat', () => {
    expect(magAiAutoVerrijken(s({ ai_status: 'in_wachtrij' })).toegestaan).toBe(false);
    expect(magAiAutoVerrijken(s({ ai_status: 'klaar' })).toegestaan).toBe(false);
  });
  it('weigert bij onvoldoende data (geen titel)', () => {
    expect(magAiAutoVerrijken(s({ titel: '' })).toegestaan).toBe(false);
  });
  it('weigert bij ontbrekende locatie', () => {
    expect(magAiAutoVerrijken(s({ plaats: null, adres: null, bron_url: null })).toegestaan).toBe(false);
  });
});

describe('magBagAutoVerrijken', () => {
  const klaar = (extra: Partial<SignaalBagInput>) =>
    s({ ai_status: 'klaar', ai_score: 75, ...extra });

  it('staat toe bij ai_score >= 70', () => {
    expect(magBagAutoVerrijken(klaar({})).toegestaan).toBe(true);
  });
  it('staat toe bij score 50–69 + strategie-match', () => {
    expect(magBagAutoVerrijken(klaar({
      ai_score: 60, potentiele_strategie: 'Splitsingspotentie',
    })).toegestaan).toBe(true);
  });
  it('weigert bij score < 50', () => {
    expect(magBagAutoVerrijken(klaar({ ai_score: 40 })).toegestaan).toBe(false);
  });
  it('weigert bij slechte adreskwaliteit', () => {
    expect(magBagAutoVerrijken(klaar({
      postcode: null, adres: null, plaats: null,
    })).toegestaan).toBe(false);
  });
  it('weigert bij gearchiveerd of afgevallen', () => {
    expect(magBagAutoVerrijken(klaar({ gearchiveerd_op: '2026-01-01' })).toegestaan).toBe(false);
    expect(magBagAutoVerrijken(klaar({ status: 'afgevallen' })).toegestaan).toBe(false);
  });
  it('weigert wanneer ai_status nog niet klaar is', () => {
    expect(magBagAutoVerrijken(s({ ai_status: 'bezig', ai_score: 90 })).toegestaan).toBe(false);
  });
  it('weigert wanneer AI heeft geskipt', () => {
    expect(magBagAutoVerrijken(klaar({ ai_skip_reden: 'te_weinig_data' })).toegestaan).toBe(false);
  });
  it('weigert wanneer BAG al bezig of verrijkt is', () => {
    expect(magBagAutoVerrijken(klaar({ bag_status: 'bezig' })).toegestaan).toBe(false);
    expect(magBagAutoVerrijken(klaar({ bag_status: 'verrijkt' })).toegestaan).toBe(false);
  });
});

describe('strategieMatchVoorBag', () => {
  it('herkent splitsing/transformatie/kamerverhuur', () => {
    expect(strategieMatchVoorBag(s({ potentiele_strategie: 'Splitsingspotentie' }))).toBe(true);
    expect(strategieMatchVoorBag(s({ ai_strategie_suggestie: 'Transformatie naar wonen' }))).toBe(true);
    expect(strategieMatchVoorBag(s({ ai_strategie_suggestie: 'Kamerverhuur optimaliseren' }))).toBe(true);
  });
  it('herkent geen match bij algemene tekst', () => {
    expect(strategieMatchVoorBag(s({ potentiele_strategie: 'Verkoop aan belegger' }))).toBe(false);
  });
});

describe('adresKwaliteitVoldoende', () => {
  it('accepteert postcode + huisnummer', () => {
    expect(adresKwaliteitVoldoende(s({ postcode: '1234AB', adres: 'Straat 12' }))).toBe(true);
  });
  it('accepteert straat + huisnummer + plaats zonder postcode', () => {
    expect(adresKwaliteitVoldoende(s({ postcode: null, adres: 'Straat 12', plaats: 'Stad' }))).toBe(true);
  });
  it('weigert zonder huisnummer', () => {
    expect(adresKwaliteitVoldoende(s({ postcode: null, adres: 'Straat', plaats: 'Stad' }))).toBe(false);
  });
});
