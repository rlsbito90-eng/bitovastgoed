export interface ServiceWorkerNavigationMessage {
  type?: unknown;
  href?: unknown;
}

/**
 * Accepteert alleen interne navigatieberichten van de service worker.
 * Externe of ongeldige URL's worden genegeerd.
 */
export function normaliseerServiceWorkerNotificatieHref(
  data: ServiceWorkerNavigationMessage | null | undefined,
  origin?: string,
): string | null {
  if (data?.type !== 'BITO_NOTIFICATION_NAVIGATE' || typeof data.href !== 'string') return null;

  const basisOrigin = origin ?? (typeof window !== 'undefined' ? window.location.origin : null);
  if (!basisOrigin) return null;

  try {
    const url = new URL(data.href, basisOrigin);
    if (url.origin !== basisOrigin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
