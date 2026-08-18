let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerBitoServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (registrationPromise) return registrationPromise;

  registrationPromise = (async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

    try {
      return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch (error) {
      console.warn('Bito service worker registratie mislukt', error);
      return null;
    }
  })();

  return registrationPromise;
}

export function installServiceWorkerNavigationBridge(navigate: (href: string) => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    const data = event.data;
    if (!data || data.type !== 'BITO_NOTIFICATION_NAVIGATE' || typeof data.href !== 'string') return;
    if (!data.href.startsWith('/')) return;
    navigate(data.href);
  };

  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}
