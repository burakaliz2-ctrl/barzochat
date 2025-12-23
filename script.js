let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// GİRİŞ FONKSİYONU (auth.js ile uyumlu)
async function login() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    
    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'login', username: u, password: p })
    });
    
    const data = await res.json();
    if (data.user) {
        localStorage.setItem('barzoUser', u);
        location.reload();
    } else {
        alert(data.error || "Giriş başarısız!");
    }
}

// KAYIT FONKSİYONU
async function register() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    
    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'register', username: u, password: p })
    });
    
    const data = await res.json();
    if (data.success) {
        alert("Kayıt başarılı, şimdi giriş yap!");
    } else {
        alert(data.error || "Kayıt hatası!");
    }
}

// MESAJ GÖNDERME (send-message.js'deki 'action: new' yapısına uygun)
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;

    const messageId = "msg-" + Date.now();
    
    // Not: Ekrana basma işlemini Pusher'dan gelen veri yapacak (Senkronizasyon için)
    // Ama hız için istersen renderMessage({ user: loggedInUser, text: val, id: messageId }) buraya eklenebilir.

    input.value = '';

    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
            action: 'new', 
            user: loggedInUser, 
            text: val, 
            target: activeChat, 
            id: messageId 
        })
    });
}

// PUSHER DİNLEYİCİSİ (Sadece mesaj başkasından gelince değil, her durumda tetiklenir)
function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu',
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}`
    });
    presenceChannel = pusher.subscribe('presence-chat');
    
    presenceChannel.bind('new-message', d => {
        // Gelen mesaj şu anki sohbete aitse ekrana bas
        if (d.target === 'general' || d.target === loggedInUser || d.user === loggedInUser) {
            renderMessage(d);
        }
    });
}

function renderMessage(data) {
    if (document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const html = `
        <div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">
            <small style="display:block; font-size:10px; opacity:0.7;">${data.user}</small>
            <span>${data.text || data.content}</span>
        </div>`;
    const chat = document.getElementById('chat');
    chat.insertAdjacentHTML('beforeend', html);
    chat.scrollTop = chat.scrollHeight;
}

function logout() { localStorage.removeItem('barzoUser'); location.reload(); }

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        initPusher();
        switchChat('general');
    }
});

async function switchChat(chatId) {
    activeChat = chatId;
    document.getElementById('chat').innerHTML = '';
    // Eski mesajları Turso'dan çek (get-messages.js ile uyumlu)
    const res = await fetch(`/api/get-messages?dm=${chatId}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: "msg-" + m.id }));
}
