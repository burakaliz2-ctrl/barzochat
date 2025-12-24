let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let touchStartX = 0;

// 1. SERVICE WORKER & BİLDİRİM İZNİ (Kesin Çözüm İçin)
async function initPWAandNotifications() {
    if ('serviceWorker' in navigator) {
        try {
            // sw.js dosyasını kaydet
            const reg = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker Kayıtlı:', reg);

            // Bildirim İzni İste
            if ("Notification" in window) {
                const permission = await Notification.requestPermission();
                if (permission === "granted") {
                    console.log("Bildirim izni verildi.");
                }
            }
        } catch (err) {
            console.error('PWA/Bildirim Hatası:', err);
        }
    }
}

// 2. ARKA PLAN BİLDİRİM TETİKLEYİCİ
function triggerNotification(data) {
    // Mesaj bizden geldiyse veya sekme o an açıksa bildirim atma
    if (data.user === loggedInUser || document.visibilityState === 'visible') return;

    if (Notification.permission === "granted") {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(`Barzo Chat: ${data.user}`, {
                body: data.text || data.content,
                icon: '/icon.png',
                badge: '/icon.png',
                vibrate: [200, 100, 200],
                tag: 'new-msg-' + data.user, // Aynı kişiden gelenleri grupla
                renotify: true,
                data: { url: window.location.origin }
            });
        });
    }
}

// 3. MOBİL SWIPE (SIDEBAR)
document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
document.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    const sidebar = document.getElementById('sidebar');
    if (diff > 80 && touchStartX < 60) sidebar.classList.add('open');
    if (diff < -80 && sidebar.classList.contains('open')) sidebar.classList.remove('open');
}, {passive: true});

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// 4. GİRİŞ & MESAJ GÖNDERME (ENTER DAHİL)
async function handleLogin() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'login', username: u, password: p })
    });
    const data = await res.json();
    if (data.user) {
        localStorage.setItem('barzoUser', data.user.username);
        location.reload();
    } else alert(data.error);
}

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;
    const msgData = { action: 'new', user: loggedInUser, text: val, target: activeChat, id: "msg-" + Date.now() };
    input.value = '';
    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(msgData)
    });
}

// 5. PUSHER & ÖZEL MESAJLAŞMA
function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu',
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}`
    });
    presenceChannel = pusher.subscribe('presence-chat');

    presenceChannel.bind('new-message', d => {
        const isGeneral = (d.target === 'general' && activeChat === 'general');
        const isForMe = (d.target === loggedInUser && activeChat === d.user);
        const isFromMe = (d.user === loggedInUser);

        if (isGeneral || isForMe || isFromMe) {
            renderMessage(d);
        } else {
            // Başka odadaysak veya ekran kapalıysa bildirimi patlat
            triggerNotification(d);
        }
    });

    presenceChannel.bind('pusher:subscription_succeeded', updateOnlineUI);
    presenceChannel.bind('pusher:member_added', updateOnlineUI);
    presenceChannel.bind('pusher:member_removed', updateOnlineUI);
}

function updateOnlineUI() {
    const userList = document.getElementById('user-list');
    let html = `<div class="user-item ${activeChat==='general'?'active':''}" onclick="switchChat('general')">🌍 Genel Sohbet</div>`;
    presenceChannel.members.each(member => {
        if (member.id !== loggedInUser) {
            html += `<div class="user-item ${activeChat===member.id?'active':''}" onclick="switchChat('${member.id}')">
                <span class="online-dot"></span> ${member.id}
            </div>`;
        }
    });
    userList.innerHTML = html;
    document.getElementById('online-counter').innerText = presenceChannel.members.count;
}

async function switchChat(chatId) {
    activeChat = chatId;
    document.getElementById('chat').innerHTML = '';
    document.getElementById('active-chat-title').innerText = chatId === 'general' ? 'Genel Mevzu' : `@${chatId}`;
    const res = await fetch(`/api/get-messages?dm=${chatId}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: m.id, target: m.target }));
    if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');
}

function renderMessage(data) {
    if (document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const html = `<div class="msg ${isOwn ? 'own' : 'other'}" id="${data.id}">
        <small style="display:block; font-size:10px; opacity:0.7;">${data.user}</small>${data.text || data.content}</div>`;
    const chatArea = document.getElementById('chat');
    chatArea.insertAdjacentHTML('beforeend', html);
    chatArea.scrollTop = chatArea.scrollHeight;
}

// 6. DOM BAŞLATICI
document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        
        const msgInput = document.getElementById('msgInput');
        msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

        initPWAandNotifications();
        initPusher();
        switchChat('general');
    }
});
