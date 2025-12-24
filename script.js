let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// 1. GİRİŞ VE KAYIT (api/auth.js ile uyumlu)
async function handleLogin() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();

    if (!u || !p) return alert("Alanları doldur!");

    try {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', username: u, password: p })
        });

        const data = await res.json();

        if (res.ok && data.user) {
            localStorage.setItem('barzoUser', data.user.username);
            location.reload(); // Sayfayı yenile ve chat'e gir
        } else {
            alert(data.error || "Giriş yapılamadı!");
        }
    } catch (err) {
        console.error("Login hatası:", err);
        alert("Sunucuya bağlanılamadı.");
    }
};

// KAYIT OLMA FONKSİYONU
async function handleRegister() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();

    if (!u || !p) return alert("Alanları doldur!");

    try {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'register', username: u, password: p })
        });

        const data = await res.json();

        if (data.success) {
            alert("Kayıt başarılı! Şimdi giriş yapabilirsin.");
        } else {
            alert(data.error || "Kayıt başarısız!");
        }
    } catch (err) {
        console.error("Kayıt hatası:", err);
    }
};
// 2. MESAJ GÖNDERME (api/send-message.js ile uyumlu)
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

    // Not: Mesajı ekrana basmayı Pusher bind yapacak, böylece her iki cihazda da aynı anda görünür.
    input.value = '';

    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(msgData)
    });
}

// 3. PUSHER VE MESAJ YÜKLEME
function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu',
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}`
    });
    presenceChannel = pusher.subscribe('presence-chat');
    presenceChannel.bind('new-message', d => {
        if (d.target === 'general' || d.target === loggedInUser || d.user === loggedInUser) {
            renderMessage(d);
        }
    });
}

async function switchChat(chatId) {
    activeChat = chatId;
    document.getElementById('chat').innerHTML = '';
    const res = await fetch(`/api/get-messages?dm=${chatId}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: m.id }));
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

function logout() { localStorage.removeItem('barzoUser'); location.reload(); }

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        initPusher();
        switchChat('general');
    }
});
// KİŞİ LİSTESİNİ GÜNCELLEME (Online olanlar)
function updatePresenceList() {
    const userList = document.getElementById('user-list');
    const counter = document.getElementById('online-counter');
    if (!presenceChannel || !userList) return;

    let usersHtml = `<div class="user-item ${activeChat === 'general' ? 'active' : ''}" onclick="switchChat('general')">
        <div class="online-dot"></div> Genel Sohbet
    </div>`;

    let count = 0;
    presenceChannel.members.each(member => {
        count++;
        if (member.id !== loggedInUser) {
            usersHtml += `
                <div class="user-item ${activeChat === member.id ? 'active' : ''}" onclick="switchChat('${member.id}')">
                    <div class="online-dot"></div> ${member.id}
                </div>`;
        }
    });

    userList.innerHTML = usersHtml;
    if (counter) counter.innerText = count;
}

// MESAJ GÖNDERME BUTONU İÇİN OLAY DİNLEYİCİ
document.addEventListener('DOMContentLoaded', () => {
    // ... diğer kodlar ...
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        sendBtn.onclick = sendMessage; // HTML'deki onclick yerine buradan bağladık
    }
});
