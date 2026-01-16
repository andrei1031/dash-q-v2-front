// public/sw.js

self.addEventListener('push', function(event) {
    console.log('[Service Worker] Push Received.');
    
    const data = event.data ? event.data.json() : {};
    
    const title = data.title || 'Dash-Q Update';
    const options = {
        body: data.body || 'You have a new notification.',
        icon: '/icon-192x192.png', // Ensure this image exists in public folder
        badge: '/badge-72x72.png', // Optional small icon
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    console.log('[Service Worker] Notification click received.');
    
    event.notification.close();

    event.waitUntil(
        clients.matchAll({type: 'window'}).then(windowClients => {
            // Check if there is already a window/tab open with the target URL
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                // If so, focus it.
                if (client.url === event.notification.data.url && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});