let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let touchStartX = 0;

// 1. MOBİL SWIPE (SAĞA ÇEKİNCE KİŞİLERİ AÇMA)
document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
document.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    const sidebar = document.getElementById('sidebar');
    // En soldan (ilk 60px) sağa doğru 80px çekilirse aç
    if (diff > 80 && touchStartX < 60) sidebar.classList.add('open');
    // Sola çekilirse kapat
    if (diff < -80 && sidebar.classList.contains('open')) sidebar.classList.remove('open');
}, {passive: true});

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// 2. GİRİŞ & KAYIT
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

async function handleRegister() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'register', username: u, password: p })
    });
    const data = await res.json();
    if (data.success) alert("Kayıt başarılı! Giriş yapabilirsin.");
    else alert(data.error);
}

function logout() { localStorage.removeItem('barzoUser'); location.reload(); }

// 3. MESAJ GÖNDERME (ENTER DESTEĞİ DAHİL)
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;

    const msgData = { 
        action: 'new', 
        user: loggedInUser, 
        text: val, 
        target: activeChat, 
        id: "msg-" + Date.now() 
    };

    input.value = ''; // Inputu hemen temizle

    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(msgData)
    });
}

// 4. BİLDİRİM SİSTEMİ
function showNotification(data) {
    // Mesaj bizden geldiyse veya sayfa o an açıksa bildirim atma
    if (data.user === loggedInUser || document.visibilityState === 'visible') return;

    if (Notification.permission === "granted") {
        const n = new Notification(`Barzo Chat: ${data.user}`, {
            body: data.text || data.content,
            icon: '/favicon.ico'
        });
        n.onclick = () => { window.focus(); n.close(); };
    }
}

// 5. PUSHER & ONLINE LİSTESİ
function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu',
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}`
    });

    presenceChannel = pusher.subscribe('presence-chat');

    const updateUI = () => {
        const userList = document.getElementById('user-list');
        const counter = document.getElementById('online-counter');
        let html = `<div class="user-item ${activeChat==='general'?'active':''}" onclick="switchChat('general')">🌍 Genel Sohbet</div>`;
        
        presenceChannel.members.each(member => {
            if (member.id !== loggedInUser) {
                html += `<div class="user-item ${activeChat===member.id?'active':''}" onclick="switchChat('${member.id}')">
                    <span class="online-dot"></span> ${member.id}
                </div>`;
            }
        });
        userList.innerHTML = html;
        counter.innerText = presenceChannel.members.count;
    };

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
    
    presenceChannel.bind('new-message', d => {
        if (d.target === 'general' || d.target === loggedInUser || d.user === loggedInUser) {
            renderMessage(d);
            showNotification(d);
        }
    });
}

async function switchChat(chatId) {
    activeChat = chatId;
    document.getElementById('chat').innerHTML = '';
    document.getElementById('active-chat-title').innerText = chatId === 'general' ? 'Genel Sohbet' : chatId;
    
    const res = await fetch(`/api/get-messages?dm=${chatId}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: m.id }));
    
    // Mobilde birine tıklayınca menüyü kapat
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

function renderMessage(data) {
    if (document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const html = `<div class="msg ${isOwn ? 'own' : 'other'}" id="${data.id}">
        <small style="display:block; font-size:10px; opacity:0.7;">${data.user}</small>
        ${data.text || data.content}
    </div>`;
    const chatArea = document.getElementById('chat');
    chatArea.insertAdjacentHTML('beforeend', html);
    chatArea.scrollTop = chatArea.scrollHeight;
}

// 6. BAŞLATICI
document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        
        // Enter tuşu dinleyici
        const msgInput = document.getElementById('msgInput');
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // Bildirim izni iste
        if ("Notification" in window) Notification.requestPermission();

        initPusher();
        switchChat('general');
    }
});
