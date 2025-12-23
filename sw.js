// sw.js
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Yeni versiyonu beklemeden hemen aktif et
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim()); // Kontrolü hemen ele al
});

// Bildirim gösterme olayı
self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : {};
    const title = data.user || "Yeni Mesaj";
    const options = {
        body: data.text || "Bir mesajınız var",
        icon: 'https://cdn-icons-png.flaticon.com/512/3601/3601571.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/3601/3601571.png',
        vibrate: [200, 100, 200],
        tag: 'chat-msg'
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

// Bildirime tıklandığında uygulamayı aç
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            if (windowClients.length > 0) {
                return windowClients[0].focus();
            }
            return clients.openWindow('/');
        })
    );
});
