// Arka planda mesaj gelince bildirimi fırlatan kod
self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : { title: 'Yeni Mesaj', body: 'Bir mesajınız var!' };
    
    const options = {
        body: data.body,
        icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
        vibrate: [200, 100, 200],
        data: { url: self.registration.scope }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Bildirime tıklayınca siteyi aç
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});