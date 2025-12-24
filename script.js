let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let touchStartX = 0;

// 1. PWA & BİLDİRİM KAYDI
async function initPWA() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/sw.js');
            if (loggedInUser && "Notification" in window) {
                await Notification.requestPermission();
            }
        } catch (err) { console.log('SW Hatası:', err); }
    }
}

// 2. GELİŞMİŞ BİLDİRİM TETİKLEYİCİ (Ekran Kontrollü)
function triggerNotification(data) {
    // Mesajı biz attıysak bildirim gelmesin
    if (data.user === loggedInUser) return;

    // EĞER: Sekme gizliyse (arka plandaysa) VEYA aktif sohbet bu mesajın sahibi değilse
    const isTabHidden = document.visibilityState === 'hidden';
    const isDifferentChat = activeChat !== (data.target === 'general' ? 'general' : data.user);

    if (isTabHidden || isDifferentChat) {
        if (Notification.permission === "granted") {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(`Barzo: ${data.user}`, {
                    body: data.text || data.content,
                    icon: 'https://cdn-icons-png.flaticon.com/512/3601/3601571.png',
                    badge: 'https://cdn-icons-png.flaticon.com/512/3601/3601571.png',
                    vibrate: [200, 100, 200],
                    tag: 'barzo-msg',
                    renotify: true
                });
            });
        }
    }
}

// 3. MOBİL SWIPE
document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
document.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    const sidebar = document.getElementById('sidebar');
    if (diff > 80 && touchStartX < 60) sidebar.classList.add('open');
    if (diff < -80 && sidebar.classList.contains('open')) sidebar.classList.remove('open');
}, {passive: true});

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// 4. GİRİŞ & MESAJ GÖNDERME
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
    if (!input.value.trim()) return;
    const msgData = { action: 'new', user: loggedInUser, text: input.value, target: activeChat, id: "msg-" + Date.now() };
    input.value = '';
    await fetch('/api/send-message', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(msgData) });
}

// 5. PUSHER & GERÇEK ZAMANLI AKIŞ
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

        // Mesajı ekrana sadece uygunsa bas, ama her zaman bildirimi kontrol et
        if (isGeneral || isForMe || isFromMe) {
            renderMessage(d);
        }
        
        // Ekran kapalıysa veya başka sohbetteysek bildirimi ÇALIŞTIR
        triggerNotification(d);
    });

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
}

function updateUI() {
    const userList = document.getElementById('user-list');
    if(!userList) return;
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
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: m.id }));
    if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');
    updateUI();
}

function renderMessage(data) {
    if (document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const html = `<div class="msg ${isOwn ? 'own' : 'other'}" id="${data.id}"><small>${data.user}</small>${data.text || data.content}</div>`;
    const chatArea = document.getElementById('chat');
    chatArea.insertAdjacentHTML('beforeend', html);
    chatArea.scrollTop = chatArea.scrollHeight;
}

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        document.getElementById('msgInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
        initPWA();
        initPusher();
        switchChat('general');
    }
});
