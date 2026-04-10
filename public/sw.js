// Dash-Q Service Worker - Corrected for Asset Loading & Offline Fallback
const STATIC_CACHE = 'dash-q-static-v3';
const DYNAMIC_CACHE = 'dash-q-dynamic-v3';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/offline.html',
    '/logo192.png',
    '/logo512.png',
    '/manifest.json',
    '/favicon.ico',
    '/queue_sound.mp3',
    '/chat_sound.mp3',
    '/buzzer.mp3'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                .map(key => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 1. Skip non-HTTP requests (fixes Chrome Extension errors) and API calls
    if (!url.protocol.startsWith('http') || url.pathname.startsWith('/api/')) return;
    if (request.method !== 'GET') return;

    // 2. Strategy: Network First for HTML, Cache First for Assets
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    const responseClone = networkResponse.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, responseClone));
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(request)
                        .then((cachedResponse) => cachedResponse || caches.match('/offline.html'));
                })
        );
    } else {
        // Cache First for assets (JS, CSS, Images, Sounds)
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                return cachedResponse || fetch(request).then((networkResponse) => {
                    const responseClone = networkResponse.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, responseClone));
                    return networkResponse;
                });
            })
        );
    }
});

// Push notification listener
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