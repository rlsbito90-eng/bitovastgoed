// V2.7 — Server-side BAG-cascade guard: matrix van toegestaan/geweigerd voor magBagAutoVerrijken.
import { describe, it, expect } from 'vitest';
import {
  magBagAutoVerrijken,
  type SignaalAutoInput,
} from '../../../../supabase/functions/_shared/offMarketAutoTrigger';

function s(p: Partial<SignaalAutoInput> = {}): SignaalAutoInput {
  return {
    id: 'sig-1',
    titel: 'Voorbeeldpand 1',
    plaats: 'Voorbeeldstad',
    adres: 'Demostraat 12',
    postcode: '1000AA',
    ai_status: 'klaar',
    ai_score: 80,
    bag_status: 'niet_verrijkt',
    ...p,
  };
}

describe('server magBagAutoVerrijken — toegestaan', () => {
  it('score 80 + adres ok + bag niet_verrijkt', () => {
    expect(magBagAutoVerrijken(s()).toegestaan).toBe(true);
  });
  it('score 70 (drempel) + adres ok', () => {
    expect(magBagAutoVerrijken(s({ ai_score: 70 })).toegestaan).toBe(true);
  });
  it('score 60 + strategie-match', () => {
    expect(magBagAutoVerrijken(s({
      ai_score: 60,
      potentiele_strategie: 'Transformatie naar wonen',
    })).toegestaan).toBe(true);
  });
  it('bag_status null wordt behandeld als niet_verrijkt', () => {
    expect(magBagAutoVerrijken(s({ bag_status: null })).toegestaan).toBe(true);
  });
});

describe('server magBagAutoVerrijken — geweigerd', () => {
  it('weigert score < 50', () => {
    expect(magBagAutoVerrijken(s({ ai_score: 49 })).toegestaan).toBe(false);
  });
  it('weigert score 50–69 zonder strategie', () => {
    expect(magBagAutoVerrijken(s({ ai_score: 65 })).toegestaan).toBe(false);
  });
  it('weigert ai_status != klaar', () => {
    expect(magBagAutoVerrijken(s({ ai_status: 'bezig' })).toegestaan).toBe(false);
    expect(magBagAutoVerrijken(s({ ai_status: 'mislukt' })).toegestaan).toBe(false);
    expect(magBagAutoVerrijken(s({ ai_status: 'niet_verrijkt' })).toegestaan).toBe(false);
  });
  it('weigert ai_skip_reden gevuld', () => {
    expect(magBagAutoVerrijken(s({ ai_skip_reden: 'te weinig data' })).toegestaan).toBe(false);
  });
  it('weigert gearchiveerd of afgevallen', () => {
    expect(magBagAutoVerrijken(s({ gearchiveerd_op: '2026-01-01' })).toegestaan).toBe(false);
    expect(magBagAutoVerrijken(s({ status: 'afgevallen' })).toegestaan).toBe(false);
    expect(magBagAutoVerrijken(s({ status: 'niet_interessant' })).toegestaan).toBe(false);
  });
  it('weigert onvoldoende adreskwaliteit', () => {
    expect(magBagAutoVerrijken(s({
      postcode: null, adres: 'Geen huisnummer', plaats: 'Stad',
    })).toegestaan).toBe(false);
  });
  it('weigert bag_status in {bezig, verrijkt, fout, geen_match, meerdere_matches}', () => {
    for (const st of ['bezig', 'verrijkt', 'fout', 'geen_match', 'meerdere_matches']) {
      const r = magBagAutoVerrijken(s({ bag_status: st }));
      expect(r.toegestaan, `bag_status=${st}`).toBe(false);
    }
  });
});
