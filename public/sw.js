// public/sw.js
self.addEventListener('push', function(event) {
    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: '/logo192.png', // Make sure you have a logo in public folder
        badge: '/favicon.ico',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    // Focus the window if open, or open a new one
    event.waitUntil(
        clients.matchAll({type: 'window'}).then( function(clientList) {
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url === '/' && 'focus' in client)
                    return client.focus();
            }
            if (clients.openWindow)
                return clients.openWindow('/');
        })
    );
});