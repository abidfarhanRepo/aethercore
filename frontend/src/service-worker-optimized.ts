/**
 * Frontend Service Worker caching strategy optimization
 * Implements efficient caching with stale-while-revalidate pattern
 */

const CACHE_NAME = 'aether-pos-v1';
const API_CACHE_NAME = 'aether-pos-api-v1';
const IMAGE_CACHE_NAME = 'aether-pos-images-v1';
const STATIC_CACHE_NAME = 'aether-pos-static-v1';

// Cache durations
const CACHE_DURATIONS = {
  API: 5 * 60 * 1000, // 5 minutes
  IMAGES: 7 * 24 * 60 * 60 * 1000, // 7 days
  STATIC: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// API endpoints to cache
const CACHEABLE_ENDPOINTS = [
  '/api/products',
  '/api/inventory',
  '/api/categories',
  '/api/reports',
  '/api/user/profile',
];

// Files to precache on installation
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

/**
 * Install event - precache essential files
 */
self.addEventListener('install', (event: ExtendedEvent) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event: ExtendedEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== CACHE_NAME &&
            cacheName !== API_CACHE_NAME &&
            cacheName !== IMAGE_CACHE_NAME &&
            cacheName !== STATIC_CACHE_NAME
          ) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/**
 * Fetch event - implement caching strategies
 */
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API requests - stale-while-revalidate
  if (url.pathname.startsWith('/api/')) {
    return event.respondWith(handleAPIRequest(request));
  }

  // Image requests - cache first
  if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(url.pathname)) {
    return event.respondWith(handleImageRequest(request));
  }

  // Static assets - cache first with fallback
  if (/\.(js|css|woff|woff2|ttf|eot)$/i.test(url.pathname)) {
    return event.respondWith(handleStaticAsset(request));
  }

  // HTML pages - network first
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    return event.respondWith(handleHTMLRequest(request));
  }

  // Default - network first
  return event.respondWith(handleDefaultRequest(request));
});

/**
 * Handle API requests with stale-while-revalidate
 */
async function handleAPIRequest(request: Request): Promise<Response> {
  const cache = await caches.open(API_CACHE_NAME);
  const cached = await cache.match(request);
  const now = Date.now();

  // If we have a cached response
  if (cached) {
    const cacheTime = cached.headers.get('x-cache-time');
    const age = cacheTime ? now - parseInt(cacheTime) : Infinity;

    // If cache is fresh (< 5 minutes), return it immediately
    if (age < CACHE_DURATIONS.API) {
      return cached;
    }

    // Otherwise, fetch fresh data in background
    const fetchPromise = fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const responseToCache = response.clone();
          const headers = new Headers(responseToCache.headers);
          headers.set('x-cache-time', String(now));
          const clonedResponse = new Response(responseToCache.body, {
            status: responseToCache.status,
            statusText: responseToCache.statusText,
            headers: headers,
          });
          cache.put(request, clonedResponse);
        }
        return response;
      })
      .catch(() => cached); // Use cached if fetch fails

    return fetchPromise;
  }

  // No cached response, fetch and cache
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('x-cache-time', String(now));
      const clonedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });
      await cache.put(request, clonedResponse);
    }
    return response;
  } catch {
    // Return offline response if available
    return new Response(
      JSON.stringify({ error: 'Offline - no cached data available' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Handle image requests - cache first
 */
async function handleImageRequest(request: Request): Promise<Response> {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return placeholder image if offline
    return new Response(
      '<svg><rect width="200" height="200" fill="#ddd"/></svg>',
      {
        headers: { 'Content-Type': 'image/svg+xml' },
      }
    );
  }
}

/**
 * Handle static assets - cache first
 */
async function handleStaticAsset(request: Request): Promise<Response> {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Graceful degradation for offline
    return new Response('Resource unavailable offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Handle HTML requests - network first
 */
async function handleHTMLRequest(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch {
    // Fallback to cached HTML
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    return (
      cached ||
      new Response('Offline - page unavailable', {
        status: 503,
      })
    );
  }
}

/**
 * Handle other requests - network first with fallback
 */
async function handleDefaultRequest(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return (
      cached ||
      new Response('Offline', {
        status: 503,
      })
    );
  }
}

// TypeScript helpers
interface ExtendedEvent extends Event {
  waitUntil(fn: Promise<any>): void;
}

interface FetchEvent extends Event {
  request: Request;
  respondWith(fn: Promise<Response> | Response): void;
}
