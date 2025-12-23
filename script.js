let touchStartX = 0;
let loggedInUser = localStorage.getItem('barzoUser');

// SWIPE (KAYDIRMA) MANTIĞI
document.addEventListener('touchstart', (e) => { 
    touchStartX = e.changedTouches[0].screenX; 
}, {passive: true});

document.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const diff = touchEndX - touchStartX;
    const sidebar = document.getElementById('sidebar');

    // Sağa kaydır (Aç): Ekranın solundan başlarsa
    if (diff > 70 && touchStartX < 60) {
        sidebar.classList.add('open');
    }
    // Sola kaydır (Kapat): Herhangi bir yerden sola çekince
    if (diff < -70) {
        sidebar.classList.remove('open');
    }
}, {passive: true});

// SIDEBAR TOGGLE (Buton için)
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// SOHBET DEĞİŞTİRME (Kişi seçince menüyü kapatır)
async function switchChat(userId) {
    activeChat = userId;
    document.getElementById('sidebar').classList.remove('open'); // Menüyü kapat
    // ... geri kalan mesaj yükleme kodların ...
}

// PUSHER VE DİĞER FONKSİYONLARINI BURANIN ALTINA EKLEYEBİLİRSİN
