let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// BAŞLANGIÇ
document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) showChat();
    else document.getElementById('auth-screen').style.display = 'flex';
});

// GİRİŞ & KAYIT
async function auth(action) {
    const user = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    if(!user || !pass) return alert("Bilgileri gir!");

    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action, username: user, password: pass })
    });
    
    if (res.ok) {
        if(action === 'login') {
            localStorage.setItem('barzoUser', user);
            location.reload();
        } else alert("Kayıt başarılı!");
    } else {
        const data = await res.json();
        alert(data.error);
    }
}

// CHAT EKRANINI AÇ
function showChat() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    initPusher();
    switchChat('general');
}

// PUSHER BAĞLANTISI
function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu',
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}`
    });

    presenceChannel = pusher.subscribe('presence-chat');

    presenceChannel.bind('new-message', data => {
        const isGeneral = data.target === 'general' && activeChat === 'general';
        const isDM = (data.user === activeChat && data.target === loggedInUser) || 
                     (data.user === loggedInUser && data.target === activeChat);
        if (isGeneral || isDM) renderMessage(data);
    });

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
}

function updateUI() {
    const listDiv = document.getElementById('user-list');
    listDiv.innerHTML = `<div class="user-item ${activeChat === 'general' ? 'active' : ''}" onclick="switchChat('general')">🌍 Genel</div>`;
    presenceChannel.members.each(m => {
        if (m.id !== loggedInUser && m.id !== "undefined") {
            listDiv.insertAdjacentHTML('beforeend', `<div class="user-item ${activeChat === m.id ? 'active' : ''}" onclick="switchChat('${m.id}')">🟢 ${m.id}</div>`);
        }
    });
}

// MESAJ GÖNDERME (Hatalar giderildi)
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if(!text) return;

    const payload = { action: 'new', user: loggedInUser, text, target: activeChat, id: Date.now().toString() };
    input.value = '';

    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
}

function renderMessage(data) {
    const isOwn = data.user === loggedInUser;
    const html = `<div class="msg ${isOwn ? 'own' : 'other'}"><b>${data.user}:</b><br>${data.text}</div>`;
    const chat = document.getElementById('chat');
    chat.insertAdjacentHTML('beforeend', html);
    chat.scrollTop = chat.scrollHeight;
}

// ÇIKIŞ YAP (Kesin çözüm)
function logout() {
    localStorage.removeItem('barzoUser');
    location.href = "/"; // Sayfayı ana dizine yönlendir ve temizle
}

async function switchChat(t) {
    activeChat = t;
    document.getElementById('chat').innerHTML = '';
    const res = await fetch(`/api/get-messages?dm=${t}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(renderMessage);
    updateUI();
}