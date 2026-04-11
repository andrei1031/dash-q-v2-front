// Dash-Q Service Worker - Optimized for Offline Actions & Real-time Notifications

const STATIC_CACHE = 'dash-q-static-v3';
const DYNAMIC_CACHE = 'dash-q-dynamic-v3';

// Core assets to cache for offline availability
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

// 1. INSTALL: Pre-cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing and pre-caching assets...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                // We use addAll for atomic caching of critical assets
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// 2. ACTIVATE: Clean up old caches and claim clients
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating and cleaning old caches...');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 1. FILTER: Skip non-HTTP (fixes Chrome Extension errors) and non-GET requests
    if (!url.protocol.startsWith('http')) return;
    if (request.method !== 'GET') return;

    // 2. API STRATEGY: Network First, then Cache (The "Gmail Killer" logic)
    // This allows customers to see the barber list and services even when offline.
    if (url.pathname.startsWith('/api/')) {
    event.respondWith(
        fetch(request)
            .then((networkResponse) => {
                // Only cache GET requests (queue details, profiles)
                if (request.method === 'GET') {
                    const responseClone = networkResponse.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, responseClone));
                }
                return networkResponse;
            })
            .catch(() => caches.match(request)) // Fallback to last known queue data
    );
    return;
}

    // 3. HTML STRATEGY: Network First, Fallback to offline.html
    // This ensures they get the latest app version but see your custom offline page if they have no signal.
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    const responseClone = networkResponse.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, responseClone));
                    return networkResponse;
                })
                .catch(async () => {
                    const cachedResponse = await caches.match(request);
                    // Return the specific page if cached, otherwise the fallback branding page
                    return cachedResponse || caches.match('/offline.html');
                })
        );
        return;
    }

    // 4. ASSET STRATEGY: Cache First, then Network
    // This makes JS, CSS, and your sound files load instantly without hitting the network.
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            return cachedResponse || fetch(request).then((networkResponse) => {
                const responseClone = networkResponse.clone();
                caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, responseClone));
                return networkResponse;
            });
        })
    );
});

// 4. PUSH NOTIFICATIONS: The "Gmail Killer" system
self.addEventListener('push', (event) => {
    let data;
    try {
        data = event.data ? event.data.json() : {};
    } catch (err) {
        console.error("Push payload was not JSON", err);
        data = { title: 'Dash-Q Update', body: event.data.text() };
    }

    const options = {
        body: data.body || 'You have a new update!',
        icon: '/logo192.png',
        badge: '/favicon.ico',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/' 
        },
        actions: [
            { action: 'open', title: 'View Details' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Dash-Q Update', options)
    );
});


// 5. NOTIFICATION INTERACTION: Focus app on click
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification click received.');
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // If a window is already open, focus it
                for (const client of windowClients) {
                    if (client.url.includes('dash-q') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // If no window is open, open a new one to the specific URL
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data?.url || '/');
                }
            })
    );
});

// 6. BACKGROUND SYNC: For offline queue joining
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync event:', event.tag);

    if (event.tag === 'sync-queue') {
        // Implementation for syncing offline data from IndexedDB to Backend
        // event.waitUntil(syncQueueRequests()); 
    }
});

// 7. MESSAGE LISTENER: Handle commands from the main app
self.addEventListener('message', (event) => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});