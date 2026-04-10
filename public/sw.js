// Dash-Q Service Worker - Optimized for Offline Actions & Real-time Notifications
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

// --- OFFLINE STRATEGY ---
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-HTTP and API calls
    if (!url.protocol.startsWith('http') || url.pathname.startsWith('/api/')) return;
    if (request.method !== 'GET') return;

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

// --- NOTIFICATION HANDLERS ---
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : { title: 'Dash-Q', body: 'Queue update available!' };
    const options = {
        body: data.body,
        icon: '/logo192.png',
        badge: '/logo192.png',
        vibrate: [100, 50, 100],
        data: { url: data.url || '/' },
        actions: [
            { action: 'open', title: 'View Status' },
            { action: 'close', title: 'Dismiss' }
        ]
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
});

// This opens the app when the user clicks the notification
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'close') return;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // If the app is already open, focus it
            for (const client of windowClients) {
                if (client.url.includes('dash-q') && 'focus' in client) return client.focus();
            }
            // If not open, open a new window to the status page
            if (clients.openWindow) return clients.openWindow(event.notification.data?.url || '/');
        })
    );
});

// --- BACKGROUND SYNC (For Offline Queue Joining) ---
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-queue') {
        console.log('[Service Worker] Syncing queue data...');
        // Implement logic to send stored queue requests to the backend
    }
});