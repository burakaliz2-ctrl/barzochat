// Kullanıcı ismi yönetimi
let userName = localStorage.getItem('chatUser');
if (!userName) {
    userName = prompt("Racon için bir isim gir:") || "Barzo_" + Math.floor(Math.random() * 1000);
    localStorage.setItem('chatUser', userName);
}

// Ses ve Bildirim Başlatma
function initNotifications() {
    Notification.requestPermission();
    const audio = document.getElementById('notifSound');
    
    audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        
        const btn = document.getElementById('notify-btn');
        btn.innerHTML = "✅ Ses Aktif";
        btn.classList.add('active');
        
        // 2 saniye sonra butonu gizle
        setTimeout(() => {
            btn.style.opacity = "0";
            setTimeout(() => btn.style.display = "none", 500);
        }, 2000);
    }).catch(e => console.error("Ses başlatılamadı:", e));
}

// Pusher Yapılandırması
const pusher = new Pusher('7c829d72a0184ee33bb3', { 
    cluster: 'eu',
    authEndpoint: '/api/pusher-auth',
    auth: { params: { username: userName } }
});

// Presence Kanalı (Online Takibi ve Mesajlar)
const channel = pusher.subscribe('presence-chat');

// Online Sayacı Güncellemeleri
const updateOnlineCount = () => {
    document.getElementById('online-counter').innerText = "Online: " + channel.members.count;
};

channel.bind('pusher:subscription_succeeded', updateOnlineCount);
channel.bind('pusher:member_added', updateOnlineCount);
channel.bind('pusher:member_removed', updateOnlineCount);

// Yeni Mesaj Geldiğinde
channel.bind('new-message', function(data) {
    const chatDiv = document.getElementById('chat');
    const isOwn = data.user === userName;
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${isOwn ? 'own' : 'other'}`;
    msgDiv.innerHTML = `
        ${!isOwn ? `<span class="user-tag">${data.user}</span>` : ''}
        <div class="msg-text">${data.text}</div>
        <span class="time">${timeStr}</span>
    `;
    
    chatDiv.appendChild(msgDiv);
    chatDiv.scrollTo({ top: chatDiv.scrollHeight, behavior: 'smooth' });

    // Kendi mesajımız değilse ses çal ve bildirim gönder
    if (!isOwn) {
        const audio = document.getElementById('notifSound');
        audio.play().catch(e => {});

        if (document.hidden && Notification.permission === "granted") {
            new Notification("Barzo Chat", { 
                body: `${data.user}: ${data.text}`,
                icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png'
            });
        }
    }
});

// Mesaj Gönderme Fonksiyonu
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if(!text) return;

    input.value = '';

    try {
        await fetch('/api/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: userName, text: text })
        });
    } catch (err) {
        console.error("Mesaj gönderilemedi:", err);
    }
}