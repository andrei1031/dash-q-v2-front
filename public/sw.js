const CACHE_NAME = 'dash-q-v3';
const OFFLINE_URL = '/offline.html';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    OFFLINE_URL,
    '/manifest.json',
    '/logo192.png',
    '/logo512.png',
    '/favicon.ico'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            })
        ))
    );
});

// public/sw.js
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Skip non-GET and API calls
    if (request.method !== 'GET' || request.url.includes('/api/')) return;

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchedResponse = fetch(request).then((networkResponse) => {
                // Update the cache with the fresh version from the network
                if (networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, responseClone));
                }
                return networkResponse;
            }).catch(() => {
                // If network fails and we have no cache, show offline page for HTML
                if (request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('/offline.html');
                }
            });

            // Return cached version immediately if we have it, else wait for network
            return cachedResponse || fetchedResponse;
        })
    );
});

// Push Listener
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : { title: 'Dash-Q', body: 'New update!' };
    const options = {
        body: data.body,
        icon: '/logo192.png',
        badge: '/logo192.png',
        vibrate: [100, 50, 100],
        data: { url: data.url || '/' }
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
});