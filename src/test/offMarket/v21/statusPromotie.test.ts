// V2.1 — statuspromotie helper
import { describe, it, expect } from 'vitest';
import { moetPromoverenNaarBenaderd } from '@/lib/offMarket/statusPromotie';

describe('moetPromoverenNaarBenaderd', () => {
  it('null en undefined → true (geen status nog)', () => {
    expect(moetPromoverenNaarBenaderd(null)).toBe(true);
    expect(moetPromoverenNaarBenaderd(undefined)).toBe(true);
  });

  it.each([
    'nieuw_signaal','interessant','twijfel','te_onderzoeken',
    'eigenaar_achterhalen','eigenaar_gevonden','benaderen',
  ])('eerdere status %s → true', (s) => {
    expect(moetPromoverenNaarBenaderd(s)).toBe(true);
  });

  it.each([
    'benaderd','in_gesprek','aanbod_ontvangen','object_ontvangen',
    'dealtraject','niet_interessant','afgevallen','archief',
  ])('latere/eindstatus %s → false', (s) => {
    expect(moetPromoverenNaarBenaderd(s)).toBe(false);
  });
});
