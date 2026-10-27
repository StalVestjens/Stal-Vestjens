// Minimale service worker: nodig zodat de app geïnstalleerd kan worden (en zo het deel-doel voor WhatsApp werkt).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
