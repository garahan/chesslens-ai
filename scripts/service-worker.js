/* Generated during the production build; never registered by the dev server. */
const CACHE = "chesslens-__VERSION__";
const PRECACHE = __PRECACHE__;
const ASSET_HASHES = __ASSET_HASHES__;
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const prior = [];
        for (const name of (await caches.keys())
          .filter((name) => name.startsWith("chesslens-") && name !== CACHE)
          .reverse()) {
          const stored = await caches.open(name);
          const metadata = await stored.match("/__offline_hashes__");
          if (metadata) {
            try {
              prior.push({ cache: stored, hashes: await metadata.json() });
            } catch {}
          }
        }
        // Limit concurrent large WASM downloads on mobile connections.
        for (let i = 0; i < PRECACHE.length; i += 3) {
          await Promise.all(
            PRECACHE.slice(i, i + 3).map(async (url) => {
              for (const previous of prior) {
                if (previous.hashes[url] === ASSET_HASHES[url]) {
                  const cached = await previous.cache.match(url);
                  if (cached) {
                    await cache.put(url, cached);
                    return;
                  }
                }
              }
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
        await cache.put(
          "/__offline_hashes__",
          new Response(JSON.stringify(ASSET_HASHES), {
            headers: { "Content-Type": "application/json" },
          }),
        );
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
