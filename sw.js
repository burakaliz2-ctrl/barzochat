self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Arka planda mesaj yakalama simülasyonu
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const data = event.data.payload;
        const options = {
            body: data.text || data.content,
            icon: 'https://cdn-icons-png.flaticon.com/512/3601/3601571.png',
            badge: 'https://cdn-icons-png.flaticon.com/512/3601/3601571.png',
            vibrate: [200, 100, 200],
            tag: 'barzo-chat',
            renotify: true,
            actions: [{ action: 'open', title: 'Mesajı Aç' }]
        };
        self.registration.showNotification(`Barzo Chat: ${data.user}`, options);
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow('/'));
});
