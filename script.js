let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let soundEnabled = true;
const notifySound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser && loggedInUser !== "undefined") showChat();
    else document.getElementById('auth-screen').style.display = 'flex';
});

// SES KONTROLÜ
function toggleSound(status) {
    soundEnabled = status;
    document.getElementById('sound-on').style.opacity = status ? "1" : "0.3";
    document.getElementById('sound-off').style.opacity = status ? "0.3" : "1";
};

// EMOJİ EKLEME
function addEmoji(emoji) {
    const input = document.getElementById('msgInput');
    input.value += emoji;
    input.focus();
};

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
        } else alert("Kayıt başarılı! Giriş yap.");
    } else {
        const data = await res.json();
        alert(data.error || "Hata!");
    }
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
        const isGeneral = (data.target === 'general' && activeChat === 'general');
        const isDM = (data.user === activeChat && data.target === loggedInUser) || 
                     (data.user === loggedInUser && data.target === activeChat);

        if (isGeneral || isDM) {
            renderMessage(data);
            if (data.user !== loggedInUser && soundEnabled) notifySound.play().catch(() => {});
            
            if (data.user === loggedInUser) {
                const tick = document.querySelector(`#${data.id} .tick`);
                if (tick) { tick.innerText = ' ✓✓'; tick.style.color = '#4fc3f7'; }
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
    document.getElementById('chat').innerHTML = '';
    if(window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');

    const res = await fetch(`/api/get-messages?dm=${t}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: "msg-"+m.id, isHistory: true }));
};

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;
    
    const messageId = "msg-" + Date.now();
    const messageData = { action: 'new', user: loggedInUser, text: val, target: activeChat, id: messageId };

    renderMessage(messageData);
    input.value = '';

    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(messageData)
    });
};

function renderMessage(data) {
    if (!data.id || !data.text || document.getElementById(data.id)) return;

    const isOwn = data.user === loggedInUser;
    const html = `
        <div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">
            ${!isOwn ? `<small style="font-size:10px; display:block; opacity:0.7;">${data.user}</small>` : ''}
            <div style="display:flex; align-items:flex-end; gap:5px;">
                <span>${data.text}</span>
                ${isOwn ? `<span class="tick" style="font-size:9px; opacity:0.6;">${data.isHistory ? ' ✓✓' : ' ✓'}</span>` : ''}
            </div>
        </div>`;

    const c = document.getElementById('chat');
    c.insertAdjacentHTML('beforeend', html);
    c.scrollTop = c.scrollHeight;
};

function logout() { localStorage.removeItem('barzoUser'); location.reload(); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
