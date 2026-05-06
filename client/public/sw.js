const CACHE_NAME = 'geo-todo-runtime-v1'
const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.svg', '/icon-512.svg']

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
        const cached = await caches.match('/')
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
