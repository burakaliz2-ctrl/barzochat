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
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: m.id }));
};

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if(!val) return;
    
    // Mesaj verisini hazırla
    const messageData = { 
        action: 'new', 
        user: loggedInUser, 
        text: val, 
        target: activeChat, 
        id: Date.now().toString() 
    };
try {
        await fetch('/api/send-message', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(messageData)
        });
    } catch (error) {
        console.error("Mesaj gönderilemedi:", error);
        alert("Mesaj gönderilirken bir hata oluştu.");
    }
};
function renderMessage(data) {
    // Eğer mesaj zaten ekrandaysa tekrar ekleme (ID kontrolü)
    if (document.getElementById(`msg-${data.id}`)) return;

    const isOwn = data.user === loggedInUser;
    const html = `<div id="msg-${data.id}" class="msg ${isOwn ? 'own' : 'other'}">
        <small style="font-size:10px; display:block; opacity:0.7;">${data.user}</small>
        ${data.text}
    </div>`;
    const c = document.getElementById('chat');
    c.insertAdjacentHTML('beforeend', html);
    c.scrollTop = c.scrollHeight;
};

function logout() { localStorage.removeItem('barzoUser'); location.reload(); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
