/* Bito CRM service worker — push delivery only.
 * Geen asset caching in deze tranche: voorkomt cache-/release-interferentie.
 */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Bito CRM';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192-v3.png',
    badge: payload.badge || '/icon-192-v3.png',
    tag: payload.tag || undefined,
    renotify: Boolean(payload.renotify),
    data: {
      href: payload.href || '/',
      notificationEventId: payload.notificationEventId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawHref = event.notification?.data?.href || '/';

  event.waitUntil((async () => {
    const targetUrl = new URL(rawHref, self.location.origin);
    if (targetUrl.origin !== self.location.origin) targetUrl.pathname = '/';

    const allClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    for (const client of allClients) {
      try {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin) {
          await client.focus();
          client.postMessage({
            type: 'BITO_NOTIFICATION_NAVIGATE',
            href: `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`,
          });
          return;
        }
      } catch {
        // Probeer volgende client.
      }
    }

    await self.clients.openWindow(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
  })());
});
