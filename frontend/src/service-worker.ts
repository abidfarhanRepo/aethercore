// Cache version strategy
const CACHE_VERSION = 'v1'
const CACHE_NAMES = {
  static: `aethercore-static-${CACHE_VERSION}`,
  api: `aethercore-api-${CACHE_VERSION}`,
  images: `aethercore-images-${CACHE_VERSION}`,
}

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

const API_CACHE_ROUTES = [
  '/api/products',
  '/api/inventory',
  '/api/users',
  '/api/categories',
]

// Install event - cache static assets
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[Service Worker] Installing...')

  event.waitUntil(
    caches.open(CACHE_NAMES.static).then((cache) => {
      console.log('[Service Worker] Caching static assets')
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.warn('[Service Worker] Failed to cache some assets:', error)
      })
    })
  )

  // Force the waiting service worker to become the active one
  ;(self as any).skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[Service Worker] Activating...')

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!Object.values(CACHE_NAMES).includes(cacheName)) {
            console.log('[Service Worker] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )

  ;(self as any).clients.claim()
})

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event
  const { url, method } = request

  // Don't intercept:
  // - chrome extensions
  // - non-GET requests (except for caching API responses)
  // - WebSocket upgrades
  if (
    url.includes('chrome-extension://') ||
    url.includes('moz-extension://') ||
    request.destination === 'webmanifest'
  ) {
    return
  }

  // Handle API requests
  if (url.includes('/api/')) {
    if (method === 'GET') {
      // Serve from network, fallback to cache (Network First strategy)
      event.respondWith(
        fetch(request)
          .then((response) => {
            // Cache successful responses
            if (response.ok && API_CACHE_ROUTES.some((route) => url.includes(route))) {
              const responseClone = response.clone()
              caches.open(CACHE_NAMES.api).then((cache) => {
                cache.put(request, responseClone)
              })
            }
            return response
          })
          .catch(() => {
            // Offline or network error, try cache
            return caches
              .match(request)
              .then((cachedResponse) => {
                if (cachedResponse) {
                  console.log('[Service Worker] Serving from cache:', url)
                  return cachedResponse
                }

                // Return offline placeholder for JSON requests
                return new Response(
                  JSON.stringify({
                    error: 'offline',
                    message: 'You are currently offline',
                  }),
                  {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: new Headers({
                      'Content-Type': 'application/json',
                    }),
                  }
                )
              })
          })
      )
    } else {
      // For non-GET requests, queue them for sync
      event.respondWith(handleOfflineRequest(request))
    }
    return
  }

  // Handle static assets (Cache First strategy)
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image'
  ) {
    event.respondWith(
      caches
        .match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse
          }

          return fetch(request).then((response) => {
            if (response.ok) {
              const responseClone = response.clone()
              const cacheName =
                request.destination === 'image' ? CACHE_NAMES.images : CACHE_NAMES.static
              caches.open(cacheName).then((cache) => {
                cache.put(request, responseClone)
              })
            }
            return response
          })
        })
        .catch(() => {
          // Return fallback
          if (request.destination === 'image') {
            return new Response(
              '<svg><rect fill="#f0f0f0" width="1" height="1"/></svg>',
              {
                headers: { 'Content-Type': 'image/svg+xml' },
              }
            )
          }
          return fetch(request)
        })
    )
    return
  }

  // Handle HTML (Network First)
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone()
          caches.open(CACHE_NAMES.static).then((cache) => {
            cache.put(request, responseClone)
          })
          return response
        })
        .catch(() => {
          return (
            caches
              .match(request)
              .then((cachedResponse) => {
                return (
                  cachedResponse ||
                  caches.match('/index.html').then((indexPage) => {
                    return indexPage || new Response('Offline - Application shell not found')
                  })
                )
              })
          )
        })
    )
    return
  }

  // Default: Network First
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone()
          caches.open(CACHE_NAMES.api).then((cache) => {
            cache.put(request, responseClone)
          })
        }
        return response
      })
      .catch(() => {
        return caches
          .match(request)
          .then((cachedResponse) => cachedResponse || new Response('Offline'))
      })
  )
})

/**
 * Handle requests that fail when offline
 * Queue them for sync when connection is restored
 */
async function handleOfflineRequest(request: Request): Promise<Response> {
  try {
    // Try to send the request
    return await fetch(request)
  } catch (error) {
    // Offline - queue for sync
    const data = await request.json().catch(() => null)

    // Notify all clients about queued request
    const clients = await (self as any).clients.matchAll()
    clients.forEach((client: any) => {
      client.postMessage({
        type: 'offline-request-queued',
        method: request.method,
        url: request.url,
        data,
      })
    })

    // Return acceptable response (request will be synced later)
    return new Response(
      JSON.stringify({
        queued: true,
        message: 'Request queued for later sync',
      }),
      {
        status: 202,
        statusText: 'Accepted',
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      }
    )
  }
}

// Handle messages from clients
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'skip-waiting') {
    ;(self as any).skipWaiting()
  }

  if (event.data?.type === 'clear-cache') {
    caches.delete(CACHE_NAMES.api)
    caches.delete(CACHE_NAMES.static)
    event.ports[0]?.postMessage({ success: true })
  }
})

export {}
