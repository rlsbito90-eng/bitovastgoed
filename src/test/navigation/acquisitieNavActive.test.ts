import { describe, expect, it } from 'vitest';
import { isNavItemActive } from '@/components/AppLayout';

describe('acquisitie navigatie actieve route', () => {
  it('markeert alleen Acquisitie op de hoofdroute', () => {
    expect(isNavItemActive('/acquisitie', '/acquisitie')).toBe(true);
    expect(isNavItemActive('/acquisitie/funnel', '/acquisitie')).toBe(false);
  });

  it('markeert alleen Acquisitie-funnel op de funnelroute', () => {
    expect(isNavItemActive('/acquisitie', '/acquisitie/funnel')).toBe(false);
    expect(isNavItemActive('/acquisitie/funnel', '/acquisitie/funnel')).toBe(true);
  });

  it('houdt Acquisitie actief op target- en campagnedetails', () => {
    expect(isNavItemActive('/acquisitie', '/acquisitie/targets/abc')).toBe(true);
    expect(isNavItemActive('/acquisitie', '/acquisitie/campagnes/abc')).toBe(true);
  });
});
