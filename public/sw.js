/* Daybreak service worker — Web Push handling. */

// Same-origin relative-path guard, mirrored from src/lib/security/safe-url.ts.
// Keeps a malicious push payload from navigating the app off-origin or into a
// javascript:/data: scheme. Keep the two implementations in sync.
function safeNotificationUrl(url) {
  if (typeof url !== "string") return "/dashboard";
  var u = url.trim();
  if (u.length === 0 || u.length > 512) return "/dashboard";
  if (u[0] !== "/") return "/dashboard";
  if (u[1] === "/" || u[1] === "\\") return "/dashboard";
  for (var i = 0; i < u.length; i++) {
    var c = u.charCodeAt(i);
    if (c < 0x20 || c === 0x7f || c === 0x5c) return "/dashboard";
  }
  return u;
}

var SHARED_CACHE = "daybreak-shared";
var MAX_SHARE_BYTES = 12 * 1024 * 1024; // 12 MB — a generous phone-photo ceiling.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Claim clients and drop any leftover shared image so a sensitive photo never
  // persists in CacheStorage across sessions/updates.
  event.waitUntil(Promise.all([self.clients.claim(), caches.delete(SHARED_CACHE)]));
});

self.addEventListener("push", (event) => {
  let payload = { title: "Daybreak", body: "You have a new update.", url: "/dashboard" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Non-JSON payload — keep the defaults.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: safeNotificationUrl(payload.url) },
    })
  );
});

// Share target: stash the shared image in the cache, then redirect to the
// share page which reads it back and logs it. Only same-session image data is
// accepted, validated by MIME + size before it ever touches CacheStorage.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname === "/nutrition/share") {
    event.respondWith(
      (async () => {
        try {
          const form = await event.request.formData();
          const file = form.get("image");
          if (
            file &&
            typeof file.type === "string" &&
            file.type.indexOf("image/") === 0 &&
            typeof file.size === "number" &&
            file.size > 0 &&
            file.size <= MAX_SHARE_BYTES
          ) {
            const cache = await caches.open(SHARED_CACHE);
            await cache.put(
              "shared-image",
              new Response(file, { headers: { "Content-Type": file.type } })
            );
          }
        } catch {
          // fall through to the page; it will show an empty state
        }
        return Response.redirect("/nutrition/share?shared=1", 303);
      })()
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeNotificationUrl(event.notification.data && event.notification.data.url);
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
