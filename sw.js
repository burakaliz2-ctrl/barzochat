// ARKA PLAN BİLDİRİM DİNLEYİCİ
self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : {};
    const title = data.title || "Barzo Chat";
    const options = {
        body: data.text || data.content || "Yeni bir mesajınız var!",
        icon: 'https://cdn-icons-png.flaticon.com/512/3601/3601571.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/3601/3601571.png',
        vibrate: [200, 100, 200],
        tag: 'barzo-mesaj',
        renotify: true
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

// BİLDİRİME TIKLAYINCA UYGULAMAYI AÇ
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url === '/' && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});
