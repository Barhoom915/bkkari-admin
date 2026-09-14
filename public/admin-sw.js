self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: "Bkkari Tech", body: event.data?.text?.() || "عندك تحديث جديد" };
  }
  const title = data.title || "Bkkari Tech";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "عندك تحديث جديد",
    icon: data.icon || "/brand/bkkari-tech-logo.png",
    badge: data.badge || "/brand/bkkari-tech-logo.png",
    tag: data.tag || data.eventId || "bkkari-admin-notification",
    renotify: false,
    requireInteraction: false,
    data: { href: data.href || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(href);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(href);
    })
  );
});
