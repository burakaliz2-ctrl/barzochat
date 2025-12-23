let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// 1. GİRİŞ & ÇIKIŞ (auth.js ile uyumlu)
async function login() {
    const u = document.getElementById('username').value.trim();
    if (!u) return;
    
    // Basit giriş: İsmi kaydet ve gir (Eğer şifre paneli istemiyorsan)
    localStorage.setItem('barzoUser', u);
    location.reload();
}

function logout() {
    localStorage.removeItem('barzoUser');
    location.reload();
}

// 2. MESAJLARI TURSO'DAN ÇEK (get-messages.js)
async function loadMessages(chatId) {
    const chatArea = document.getElementById('chat');
    chatArea.innerHTML = ''; // Temizle
    
    try {
        const res = await fetch(`/api/get-messages?dm=${chatId}&user=${loggedInUser}`);
        const msgs = await res.json();
        msgs.forEach(m => renderMessage({ 
            user: m.username, 
            text: m.content, 
            id: m.id,
            target: m.target 
        }));
    } catch (e) { console.error("Mesajlar yüklenemedi:", e); }
}

// 3. MESAJ GÖNDER (send-message.js)
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

    input.value = '';

    await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msgData)
    });
}

// 4. PUSHER DİNLEYİCİSİ
function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu',
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}`
    });
    
    presenceChannel = pusher.subscribe('presence-chat');
    presenceChannel.bind('new-message', d => {
        // Eğer mesaj bizim sohbetimize gelmişse ekrana bas
        if (d.target === 'general' || d.target === loggedInUser || d.user === loggedInUser) {
            renderMessage(d);
        }
    });
}

function renderMessage(data) {
    if (document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const html = `<div class="msg ${isOwn ? 'own' : 'other'}" id="${data.id}">
        <small style="display:block; font-size:10px; opacity:0.7;">${data.user}</small>
        ${data.text || data.content}
    </div>`;
    const chat = document.getElementById('chat');
    chat.insertAdjacentHTML('beforeend', html);
    chat.scrollTop = chat.scrollHeight;
}

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        initPusher();
        loadMessages('general');
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
    }
});
