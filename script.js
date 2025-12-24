let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let touchStartX = 0;

// 1. PWA & SERVICE WORKER KAYDI
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log("SW Kayıt Hatası:", err));
    });
}

// 2. MOBİL SWIPE (SAĞA ÇEKİNCE SIDEBAR AÇMA)
document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
document.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    const sidebar = document.getElementById('sidebar');
    if (diff > 80 && touchStartX < 60) sidebar.classList.add('open');
    if (diff < -80 && sidebar.classList.contains('open')) sidebar.classList.remove('open');
}, {passive: true});

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// 3. GİRİŞ & ÇIKIŞ (auth.js ile uyumlu)
async function handleLogin() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    if (!u || !p) return alert("Alanları doldur!");

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

function logout() { localStorage.removeItem('barzoUser'); location.reload(); }

// 4. MESAJ GÖNDERME (ENTER DESTEKLİ)
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

    input.value = ''; // Hemen temizle

    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(msgData)
    });
}

// 5. ÖZEL MESAJ VE KİŞİ SEÇİMİ
async function switchChat(chatId) {
    activeChat = chatId;
    document.getElementById('chat').innerHTML = '';
    document.getElementById('active-chat-title').innerText = chatId === 'general' ? 'Genel Mevzu' : `@${chatId}`;
    
    // Aktif kişiyi sidebar'da görsel olarak işaretle
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));

    // Geçmişi Turso'dan çek (get-messages.js)
    const res = await fetch(`/api/get-messages?dm=${chatId}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: m.id, target: m.target }));
    
    if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');
}

// 6. BİLDİRİMLER
function showNotification(data) {
    if (data.user === loggedInUser || document.visibilityState === 'visible') return;

    if (Notification.permission === "granted") {
        const n = new Notification(`Barzo Chat: ${data.user}`, {
            body: data.text || data.content,
            icon: '/icon.png'
        });
        n.onclick = () => { window.focus(); n.close(); };
    }
}

// 7. PUSHER & ONLINE LİSTESİ (presence-chat)
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
        if (counter) counter.innerText = presenceChannel.members.count;
    };

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
    
    presenceChannel.bind('new-message', d => {
        // Filtreleme: Mesaj genel mi, bize özel mi yoksa bizden mi?
        const isGeneral = (d.target === 'general' && activeChat === 'general');
        const isForMe = (d.target === loggedInUser && activeChat === d.user);
        const isFromMe = (d.user === loggedInUser);

        if (isGeneral || isForMe || isFromMe) {
            renderMessage(d);
        } else {
            showNotification(d); // Başka sohbetten gelirse bildir
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
    const chatArea = document.getElementById('chat');
    chatArea.insertAdjacentHTML('beforeend', html);
    chatArea.scrollTop = chatArea.scrollHeight;
}

// 8. BAŞLATICI
document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        
        // Enter Tuşu
        const msgInput = document.getElementById('msgInput');
        if (msgInput) {
            msgInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage();
            });
        }

        // Bildirim İzni İste
        if ("Notification" in window && Notification.permission !== "denied") {
            setTimeout(() => Notification.requestPermission(), 3000);
        }

        initPusher();
        switchChat('general');
    }
});
