import { describe, expect, it } from 'vitest';
import { acquisitieSignaalLabel } from '@/lib/offMarket/acquisitie/signaalLabel';

const basis = {
  type_signaal: 'vergunning_bekendmaking',
  bron_type: 'bekendmaking',
  vergunningtype: null,
} as any;

describe('acquisitieSignaalLabel', () => {
  it('toont het concrete vergunningtype in plaats van Vergunning/bekendmaking', () => {
    expect(acquisitieSignaalLabel({ ...basis, vergunningtype: 'splitsing' })).toBe('Splitsingsvergunning');
    expect(acquisitieSignaalLabel({ ...basis, vergunningtype: 'woonvorming' })).toBe('Woonvorming');
    expect(acquisitieSignaalLabel({ ...basis, vergunningtype: 'omzetting' })).toBe('Omzettingsvergunning');
  });

  it('toont Pandenverkenner voor BAG-signalen', () => {
    expect(acquisitieSignaalLabel({ ...basis, bron_type: 'bag', type_signaal: 'handmatige_research' })).toBe('Pandenverkenner');
  });

  it('valt zonder vergunningtype terug op de werkelijke bronsoort', () => {
    expect(acquisitieSignaalLabel({ ...basis, bron_type: 'vergunning' })).toBe('Vergunning');
    expect(acquisitieSignaalLabel({ ...basis, bron_type: 'bekendmaking' })).toBe('Bekendmaking');
  });
});
