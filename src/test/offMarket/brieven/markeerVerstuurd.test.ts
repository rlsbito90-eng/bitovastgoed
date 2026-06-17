import { describe, it, expect } from 'vitest';
import { berekenFollowUpDeadline } from '@/lib/offMarket/brieven/markeerVerstuurd';

describe('berekenFollowUpDeadline', () => {
  it('postdatum + 21 dagen is de default', () => {
    expect(berekenFollowUpDeadline('2026-06-01')).toBe('2026-06-22');
  });
  it('werkt over maandgrens', () => {
    expect(berekenFollowUpDeadline('2026-06-20')).toBe('2026-07-11');
  });
  it('werkt over jaargrens', () => {
    expect(berekenFollowUpDeadline('2026-12-20')).toBe('2027-01-10');
  });
  it('werkt over schrikkeljaargrens', () => {
    expect(berekenFollowUpDeadline('2028-02-20')).toBe('2028-03-12');
  });
  it('faalt op ongeldig formaat', () => {
    expect(() => berekenFollowUpDeadline('01-06-2026' as any)).toThrow();
  });
});
