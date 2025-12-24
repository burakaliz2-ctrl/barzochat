// sw.js içeriği
self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : {};
    event.waitUntil(
        self.registration.showNotification(data.title || "Barzo Chat", {
            body: data.message || "Yeni bir mesajınız var!",
            icon: 'https://cdn-icons-png.flaticon.com/512/3601/3601571.png'
        })
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(clients.openWindow('/'));
});
