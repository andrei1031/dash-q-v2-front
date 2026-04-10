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

// 3. FETCH STRATEGY: Offline Support & Dynamic Caching
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-HTTP requests (like Chrome extensions) and API calls
    if (!url.protocol.startsWith('http') || url.pathname.startsWith('/api/')) {
        return;
    }

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // A. Strategy for HTML: Network First, Fallback to offline.html
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
                        .then((cachedResponse) => {
                            if (cachedResponse) return cachedResponse;
                            // The "Perfect" Fallback: serve the branded offline page
                            return caches.match('/offline.html');
                        });
                })
        );
        return;
    }

    // B. Strategy for Assets (JS, CSS, Images, Sounds): Cache First
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // Return cached version and update in background
                fetch(request).then((networkResponse) => {
                    caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, networkResponse));
                });
                return cachedResponse;
            }

            return fetch(request).then((networkResponse) => {
                const responseClone = networkResponse.clone();
                caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, responseClone));
                return networkResponse;
            });
        })
    );
});

// 4. PUSH NOTIFICATIONS: The "Gmail Killer" system
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push Received.');
    
    let data = { title: 'Dash-Q Update', body: 'You have a new notification.' };
    try {
        data = event.data ? event.data.json() : data;
    } catch (e) {
        console.warn('Push event data was not JSON:', event.data?.text());
        data.body = event.data?.text() || data.body;
    }
    
    const options = {
        body: data.body,
        icon: '/logo192.png',
        badge: '/logo192.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        },
        actions: [
            { action: 'open', title: 'View Status' },
            { action: 'close', title: 'Dismiss' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
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