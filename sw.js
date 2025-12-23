self.addEventListener('push', function(event) {
    // Sunucudan gelen bildirim verisi
});

// Manuel tetiklenen bildirimleri göster
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({type: 'window'}).then(windowClients => {
            if (windowClients.length > 0) {
                windowClients[0].focus();
            } else {
                clients.openWindow('/');
            }
        })
    );
});
