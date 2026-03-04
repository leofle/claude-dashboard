self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  console.log('[sw] push received:', data);
  event.waitUntil(
    self.registration.showNotification(data.title || 'Claude Dashboard', {
      body: data.body || '',
      tag: data.tag || 'claude-dashboard',
      renotify: true,
      data: { url: '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.focus) return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
