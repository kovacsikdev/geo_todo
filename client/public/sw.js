const CACHE_NAME = 'mapitin-runtime-v2'
const APP_SHELL = [
  '/',
  '/app',
  '/manifest.webmanifest',
  '/favion-32.png',
  '/logo-180.png',
  '/logo-192.png',
  '/logo-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin) {
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match('/app')
        return cached ?? Response.error()
      }),
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then(async (cachedResponse) => {
      if (cachedResponse) {
        void fetch(event.request)
          .then(async (networkResponse) => {
            const cache = await caches.open(CACHE_NAME)
            await cache.put(event.request, networkResponse.clone())
          })
          .catch(() => undefined)
        return cachedResponse
      }

      const networkResponse = await fetch(event.request)
      const cache = await caches.open(CACHE_NAME)
      await cache.put(event.request, networkResponse.clone())
      return networkResponse
    }),
  )
})
