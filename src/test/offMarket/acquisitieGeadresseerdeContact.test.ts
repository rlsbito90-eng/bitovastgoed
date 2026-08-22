import { describe, expect, it } from 'vitest';
import { isEmailContactwaarde } from '@/components/offmarket/acquisitie/GeadresseerdenLijst';

describe('acquisitie geadresseerde contactpresentatie', () => {
  it('herkent een legacy e-mailadres in verzendadres als e-mailcontact', () => {
    expect(isEmailContactwaarde('info@berlagevastgoed.com')).toBe(true);
    expect(isEmailContactwaarde('De Lairessestraat 145-A 1075 HJ AMSTERDAM')).toBe(false);
  });
});
