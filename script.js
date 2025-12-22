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
        btn.style.background = "#22c55e";
        
        // Butonu zarifçe gizle ama yerini tutmaya devam etsin (sayfa kaymasın)
        setTimeout(() => {
            btn.classList.add('hidden-btn');
        }, 1500);
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

    // Rastgele renk ataması (İsimlerin her birinde farklı renk olması için basit bir yöntem)
    const nameColor = isOwn ? '#fff' : stringToColor(data.user);

    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${isOwn ? 'own' : 'other'}`;
    msgDiv.innerHTML = `
        ${!isOwn ? `<span class="user-tag" style="color: ${nameColor}">${data.user}</span>` : ''}
        <div class="msg-text">${data.text}</div>
        <span class="time">${timeStr}</span>
    `;
    
    chatDiv.appendChild(msgDiv);
    chatDiv.scrollTo({ top: chatDiv.scrollHeight, behavior: 'smooth' });

    if (!isOwn) {
        const audio = document.getElementById('notifSound');
        audio.play().catch(e => {});
        // ... bildirim kodları ...
    }
});
function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - c.length) + c;
};
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