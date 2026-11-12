/* Generated during the production build; never registered by the dev server. */
const CACHE = "chesslens-__VERSION__";
const PRECACHE = __PRECACHE__;
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        // Limit concurrent large WASM downloads on mobile connections.
        for (let i = 0; i < PRECACHE.length; i += 3) {
          await Promise.all(
            PRECACHE.slice(i, i + 3).map(async (url) => {
              const response = await fetch(
                new Request(url, {
                  cache: "reload",
                  credentials: "same-origin",
                }),
              );
              if (
                !response.ok ||
                response.redirected ||
                new URL(response.url).origin !== self.location.origin
              )
                throw Error("Offline asset unavailable: " + url);
              await cache.put(url, response);
            }),
          );
        }
        await self.skipWaiting();
      } catch (error) {
        await caches.delete(CACHE);
        throw error;
      }
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = (await caches.keys()).filter((key) =>
        key.startsWith("chesslens-"),
      );
      const previous = keys.filter((key) => key !== CACHE).slice(-1);
      await Promise.all(
        keys
          .filter((key) => key !== CACHE && !previous.includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname === "/sw.js"
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        try {
          const response = await fetch(event.request, {
            signal: controller.signal,
          });
          if (response.ok && !response.redirected) return response;
        } catch {
        } finally {
          clearTimeout(timeout);
        }
        return (await caches.open(CACHE)).match("/index.html");
      })(),
    );
    return;
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(url.pathname);
      if (cached) return cached;
      const previous = await caches.match(url.pathname);
      return previous || fetch(event.request);
    })(),
  );
});
// Report readiness from actual stored assets, rather than browser connectivity.
self.addEventListener("message", (event) => {
  if (!["CHECK_OFFLINE", "PREPARE_OFFLINE"].includes(event.data?.type)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      let ready = (
        await Promise.all(PRECACHE.map((url) => cache.match(url)))
      ).every(Boolean);
      if (!ready && event.data.type === "PREPARE_OFFLINE") {
        try {
          for (const url of PRECACHE) {
            if (await cache.match(url)) continue;
            const response = await fetch(
              new Request(url, { cache: "reload", credentials: "same-origin" }),
            );
            if (!response.ok || response.redirected)
              throw Error("Download failed");
            await cache.put(url, response);
          }
          ready = true;
        } catch {
          ready = false;
        }
      }
      event.ports[0]?.postMessage({ ready });
    })(),
  );
});
