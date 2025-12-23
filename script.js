let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser && loggedInUser !== "undefined") showChat();
    else document.getElementById('auth-screen').style.display = 'flex';
});

async function auth(action) {
    const u = document.getElementById('auth-user').value.trim();
    const p = document.getElementById('auth-pass').value.trim();
    if(!u || !p) return alert("Eksik bilgi!");

    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action, username: u, password: p })
    });
    
    if (res.ok) {
        if(action === 'login') {
            localStorage.setItem('barzoUser', u);
            location.reload();
        } else alert("Kayıt ok! Giriş yap.");
    } else alert("Hata oluştu.");
};

function showChat() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    initPusher();
    switchChat('general');
};

function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu',
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}`
    });

    presenceChannel = pusher.subscribe('presence-chat');

    presenceChannel.bind('new-message', data => {
        if ((data.target === 'general' && activeChat === 'general') || 
            (data.user === activeChat && data.target === loggedInUser) || 
            (data.user === loggedInUser && data.target === activeChat)) {
            renderMessage(data);
            
            // Eğer gelen mesaj bizim az önce gönderdiğimiz mesajsa tık işaretini güncelle
            if (data.user === loggedInUser) {
                const tick = document.querySelector(`#msg-${data.id} .tick`);
                if (tick) {
                    tick.innerText = ' ✓✓';
                    tick.style.color = '#4fc3f7'; // Mavi tık rengi
                }
            }
        }
    });

    const updateUI = () => {
        const list = document.getElementById('user-list');
        list.innerHTML = `<div class="user-item ${activeChat==='general'?'active':''}" onclick="switchChat('general')">🌍 Genel Mevzu</div>`;
        presenceChannel.members.each(m => {
            if (m.id && m.id !== "undefined" && m.id !== loggedInUser) {
                list.insertAdjacentHTML('beforeend', `<div class="user-item ${activeChat===m.id?'active':''}" onclick="switchChat('${m.id}')">🟢 ${m.id}</div>`);
            }
        });
        document.getElementById('online-counter').innerText = presenceChannel.members.count;
    };

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
};

async function switchChat(t) {
    activeChat = t;
    document.getElementById('active-chat-title').innerText = t === 'general' ? 'Genel Mevzu' : `👤 ${t}`;
    document.getElementById('chat').innerHTML = '<div style="color:gray; padding:10px;">Yükleniyor...</div>';
    if(window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');

    const res = await fetch(`/api/get-messages?dm=${t}&user=${loggedInUser}`);
    const msgs = await res.json();
    document.getElementById('chat').innerHTML = '';
    msgs.forEach(m => renderMessage({ 
        user: m.username, 
        text: m.content, 
        id: m.id, 
        time: m.created_at,
        isHistory: true // Eski mesajlar zaten ✓✓ ile gelir
    }));
};

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;
    
    const messageId = Date.now().toString();
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    const messageData = { 
        action: 'new', 
        user: loggedInUser, 
        text: val, 
        target: activeChat, 
        id: messageId,
        time: timeStr
    };

    // 1. ADIM: Ekrana hemen bas (Tek tıkla)
    renderMessage(messageData);

    // 2. ADIM: Kutuyu hemen temizle
    input.value = '';

    // 3. ADIM: Sunucuya gönder
    try {
        await fetch('/api/send-message', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(messageData)
        });
    } catch (error) {
        console.error("Hata:", error);
        const tick = document.querySelector(`#msg-${messageId} .tick`);
        if (tick) tick.innerText = ' ⚠️'; // Hata durumunda uyarı
    }
};

function renderMessage(data) {
    if (!data.id || !data.text) return;
    if (document.getElementById(`msg-${data.id}`)) return;

    const isOwn = data.user === loggedInUser;
    
    // Zaman bilgisini ayarla
    let displayTime = data.time || "";
    if (data.isHistory && !displayTime) {
        // Geçmiş mesajlarda tarih verisi varsa işle
        displayTime = ""; 
    }

    const html = `
        <div id="msg-${data.id}" class="msg ${isOwn ? 'own' : 'other'}">
            <small style="font-size:10px; display:block; opacity:0.7;">${data.user}</small>
            <div class="msg-content">
                ${data.text}
                <span style="font-size:9px; opacity:0.5; margin-left:8px;">
                    ${displayTime} 
                    ${isOwn ? `<span class="tick">${data.isHistory ? ' ✓✓' : ' ✓'}</span>` : ''}
                </span>
            </div>
        </div>`;

    const c = document.getElementById('chat');
    if (c) {
        c.insertAdjacentHTML('beforeend', html);
        c.scrollTop = c.scrollHeight;
    }
};

function logout() { localStorage.removeItem('barzoUser'); location.reload(); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
