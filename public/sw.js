// Dash-Q Service Worker - Optimized for Offline Support & Seamless Updates

const STATIC_CACHE = 'dash-q-static-v2'; // Incremented version
const DYNAMIC_CACHE = 'dash-q-dynamic-v2';

// 1. Static assets to cache immediately (Pre-caching)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/offline.html', // Essential for the "Perfect" PWA score
    '/logo192.png',
    '/logo512.png',
    '/manifest.json',
    '/favicon.ico',
    '/queue_sound.mp3', // Add this
    '/chat_sound.mp3',  // Add this
    '/buzzer.mp3' // Added common build files if applicable
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing and pre-caching assets...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting()) // Force the waiting service worker to become active
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating and cleaning old caches...');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - cache-first for assets, network-first for HTML
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests (like POSTing a new booking)
    if (request.method !== 'GET') return;

    // API calls: Network only (with a JSON error fallback)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request).catch(() => {
                return new Response(
                    JSON.stringify({ error: 'Offline', offline: true }),
                    { headers: { 'Content-Type': 'application/json' } }
                );
            })
        );
        return;
    }

    // HTML Pages: Network First strategy (Fallback to offline.html)
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, responseClone));
                    return response;
                })
                .catch(async () => {
                    const cachedResponse = await caches.match(request);
                    if (cachedResponse) return cachedResponse;
                    
                    // The "Perfect" Fallback: serve the offline page
                    return caches.match('/offline.html');
                })
        );
        return;
    }

    // Static Assets: Cache First strategy
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;

            return fetch(request).then((response) => {
                const responseClone = response.clone();
                caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, responseClone));
                return response;
            });
        })
    );
});

// Push notification handler
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Dash-Q Update';
    const options = {
        body: data.body || 'New queue status update available.',
        icon: '/logo192.png',
        badge: '/logo192.png',
        vibrate: [100, 50, 100],
        data: { url: data.url || '/' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.includes('dash-q') && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(event.notification.data?.url || '/');
        })
    );
});

// Message listener for skipWaiting
self.addEventListener('message', (event) => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});