let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let touchStartX = 0;

// 1. PWA & SERVICE WORKER KAYDI
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

// 2. GİRİŞ VE ÇIKIŞ İŞLEMLERİ (BU KISIM EKLENDİ)
async function handleLogin() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    
    if (!u || !p) return alert("Boş bırakma!");

    try {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'login', username: u, password: p })
        });
        const data = await res.json();
        
        if (data.user) {
            localStorage.setItem('barzoUser', data.user.username);
            location.reload(); // Sayfayı yenileyerek chat ekranına geç
        } else {
            alert(data.error || "Giriş başarısız.");
        }
    } catch (err) {
        console.error("Giriş Hatası:", err);
        alert("Bağlantı sorunu oluştu.");
    }
}

function logout() {
    localStorage.removeItem('barzoUser');
    location.reload(); // Sayfayı yenileyerek giriş ekranına dön
}

// 3. TEMİZ BİLDİRİM TETİKLEYİCİ
function triggerNotification(data) {
    if (data.user === loggedInUser) return;
    
    const isTabHidden = document.visibilityState === 'hidden';
    const isDifferentChat = activeChat !== (data.target === 'general' ? 'general' : data.user);

    if (isTabHidden || isDifferentChat) {
        if (Notification.permission === "granted") {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(data.user, {
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

// 4. MOBİL SWIPE & SIDEBAR
document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
document.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    const sidebar = document.getElementById('sidebar');
    if (diff > 80 && touchStartX < 60) sidebar.classList.add('open');
    if (diff < -80 && sidebar.classList.contains('open')) sidebar.classList.remove('open');
}, {passive: true});

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// 5. MESAJ GÖNDERME (Optimistic UI)
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;

    const msgId = "msg-" + Date.now();
    const msgData = { 
        action: 'new', 
        user: loggedInUser, 
        text: val, 
        target: activeChat, 
        id: msgId 
    };

    renderMessage(msgData); // Anında göster
    input.value = '';

    try {
        await fetch('/api/send-message', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(msgData) 
        });
    } catch (err) { console.error("Gönderilemedi:", err); }
}

// 6. PUSHER & AKIŞ
function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu',
        forceTLS: true,
        activityTimeout: 15000,
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}`
    });

    presenceChannel = pusher.subscribe('presence-chat');

    presenceChannel.bind('new-message', d => {
        if (d.user === loggedInUser && document.getElementById(d.id)) return;
        const isGeneral = (d.target === 'general' && activeChat === 'general');
        const isForMe = (d.target === loggedInUser && activeChat === d.user);
        if (isGeneral || isForMe) { renderMessage(d); }
        triggerNotification(d);
    });

    presenceChannel.bind('pusher:subscription_succeeded', updateOnlineUI);
    presenceChannel.bind('pusher:member_added', updateOnlineUI);
    presenceChannel.bind('pusher:member_removed', updateOnlineUI);
}

function updateOnlineUI() {
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
}

async function switchChat(chatId) {
    activeChat = chatId;
    document.getElementById('chat').innerHTML = '';
    document.getElementById('active-chat-title').innerText = chatId === 'general' ? 'Genel Mevzu' : `@${chatId}`;
    
    const res = await fetch(`/api/get-messages?dm=${chatId}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: m.id }));
    
    if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');
    updateOnlineUI();
}

function renderMessage(data) {
    if (document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const nameLabel = isOwn ? '' : `<small style="display:block; font-size:10px; margin-bottom:2px; opacity:0.8; color:#a855f7;">${data.user}</small>`;
    
    const html = `
        <div class="msg ${isOwn ? 'own' : 'other'}" id="${data.id}">
            ${nameLabel}
            <div class="msg-text">${data.text || data.content}</div>
        </div>`;
    
    const chatArea = document.getElementById('chat');
    chatArea.insertAdjacentHTML('beforeend', html);
    chatArea.scrollTop = chatArea.scrollHeight;
}

// 7. BAŞLATICI
document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        
        const msgInput = document.getElementById('msgInput');
        msgInput.setAttribute('autocomplete', 'one-time-code'); // Klavye simgelerini engeller

        msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

        initPWA();
        initPusher();
        switchChat('general');
    }
});
