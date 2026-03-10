// Dash-Q Service Worker - Enhanced for Offline Support

const CACHE_NAME = 'dash-q-v2-offline-v1';
const STATIC_CACHE = 'dash-q-static-v1';
const DYNAMIC_CACHE = 'dash-q-dynamic-v1';

// Static assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/logo192.png',
    '/logo512.png',
    '/manifest.json',
    '/favicon.ico'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map((key) => {
                        console.log('[Service Worker] Removing old cache:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip API calls from being cached (always go to network)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .catch(() => {
                    // Return offline response for API calls
                    return new Response(
                        JSON.stringify({ error: 'Offline', offline: true }),
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                })
        );
        return;
    }

    // For HTML pages - Network First strategy
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone and cache the response
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // If network fails, try cache
                    return caches.match(request)
                        .then((cachedResponse) => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // Return offline page as last resort
                            return caches.match('/');
                        });
                })
        );
        return;
    }

    // For other assets - Cache First strategy
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached response and update cache in background
                    fetch(request).then((response) => {
                        caches.open(DYNAMIC_CACHE).then((cache) => {
                            cache.put(request, response);
                        });
                    });
                    return cachedResponse;
                }

                // Not in cache, fetch from network
                return fetch(request).then((response) => {
                    // Cache the new response
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                });
            })
    );
});

// Push notification handler
self.addEventListener('push', function(event) {
    console.log('[Service Worker] Push Received.');
    
    const data = event.data ? event.data.json() : {};
    
    const title = data.title || 'Dash-Q Update';
    const options = {
        body: data.body || 'You have a new notification.',
        icon: '/logo192.png',
        badge: '/logo192.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        },
        actions: [
            { action: 'open', title: 'Open App' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', function(event) {
    console.log('[Service Worker] Notification click received.');
    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Check if there is already a window/tab open
                for (const client of windowClients) {
                    if (client.url.includes('dash-q') && 'focus' in client) {
                        client.focus();
                        return;
                    }
                }
                // Open new window if none found
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data?.url || '/');
                }
            })
    );
});

// Background sync for offline queue actions
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync:', event.tag);

    if (event.tag === 'sync-queue') {
        event.waitUntil(syncQueueData());
    }
});

// Sync queued data when back online
async function syncQueueData() {
    // Get pending queue actions from IndexedDB
    // This is a placeholder - you'd need to implement the actual sync logic
    console.log('[Service Worker] Syncing queue data...');
    
    // Notify all clients that sync is complete
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'SYNC_COMPLETE' });
    });
}

// Handle messages from the main app
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Message received:', event.data);

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'CACHE_URLS') {
        const urls = event.data.urls;
        caches.open(DYNAMIC_CACHE).then(cache => {
            cache.addAll(urls);
        });
    }
});

