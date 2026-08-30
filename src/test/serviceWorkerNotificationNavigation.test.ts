import { describe, expect, it } from 'vitest';

import { normaliseerServiceWorkerNotificatieHref } from '@/lib/notifications/serviceWorkerNavigation';

describe('service-worker notificatierouting', () => {
  const origin = 'https://bitovastgoed.vercel.app';

  it('accepteert een interne deep-link uit BITO_NOTIFICATION_NAVIGATE', () => {
    expect(normaliseerServiceWorkerNotificatieHref({
      type: 'BITO_NOTIFICATION_NAVIGATE',
      href: '/off-market?tab=acquisitieselectie&werkbak=actie&subfilter=opvolgen&bron=radar&sortering=opvolgdatum_oudste',
    }, origin)).toBe('/off-market?tab=acquisitieselectie&werkbak=actie&subfilter=opvolgen&bron=radar&sortering=opvolgdatum_oudste');
  });

  it('weigert externe bestemmingen', () => {
    expect(normaliseerServiceWorkerNotificatieHref({
      type: 'BITO_NOTIFICATION_NAVIGATE',
      href: 'https://example.com/phishing',
    }, origin)).toBeNull();
  });

  it('negeert andere service-worker berichten', () => {
    expect(normaliseerServiceWorkerNotificatieHref({ type: 'ANDER_BERICHT', href: '/off-market' }, origin)).toBeNull();
  });
});
