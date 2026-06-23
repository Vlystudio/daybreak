/* Daybreak service worker — Web Push handling. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Daybreak", body: "You have a new update.", url: "/dashboard" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_e) {
    // Non-JSON payload — keep the defaults.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: payload.url || "/dashboard" },
    })
  );
});

// Share target: stash the shared image in the cache, then redirect to the
// share page which reads it back and logs it.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname === "/nutrition/share") {
    event.respondWith(
      (async () => {
        try {
          const form = await event.request.formData();
          const file = form.get("image");
          if (file) {
            const cache = await caches.open("daybreak-shared");
            await cache.put(
              "shared-image",
              new Response(file, { headers: { "Content-Type": file.type || "image/jpeg" } })
            );
          }
        } catch (_e) {
          // fall through to the page; it will show an empty state
        }
        return Response.redirect("/nutrition/share?shared=1", 303);
      })()
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
