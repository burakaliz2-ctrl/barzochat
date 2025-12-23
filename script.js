let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// 1. KAYDIRMA (SWIPE) ÖZELLİĞİ
let touchStartX = 0;
document.addEventListener('touchstart', (e) => { 
    touchStartX = e.changedTouches[0].screenX; 
}, {passive: true});

document.addEventListener('touchend', (e) => {
    const diffX = e.changedTouches[0].screenX - touchStartX;
    const sidebar = document.getElementById('sidebar');
    // Sağa çekince aç, sola çekince kapat (80px hassasiyet)
    if (diffX > 80 && touchStartX < 60) sidebar?.classList.add('open');
    if (diffX < -80) sidebar?.classList.remove('open');
}, {passive: true});

// 2. TEMEL FONKSİYONLAR
function toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('open'); }

async function switchChat(t) {
    activeChat = t;
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('active-chat-title').innerText = t === 'general' ? 'Genel Mevzu' : `👤 ${t}`;
    const chatBox = document.getElementById('chat');
    chatBox.innerHTML = '';
    const res = await fetch(`/api/get-messages?dm=${t}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: "msg-"+m.id }));
}

function renderMessage(data) {
    if (!data.id || document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const html = `<div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">${!isOwn ? `<small style="display:block; font-size:10px; opacity:0.6;">${data.user}</small>` : ''}<span>${data.text}</span><div style="font-size:10px; text-align:right; opacity:0.5; margin-top:4px;">${time}</div></div>`;
    const c = document.getElementById('chat');
    c.insertAdjacentHTML('beforeend', html);
    c.scrollTop = c.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;
    const messageId = "msg-" + Date.now();
    renderMessage({ user: loggedInUser, text: val, id: messageId });
    input.value = '';
    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'new', user: loggedInUser, text: val, target: activeChat, id: messageId })
    });
}

// 3. PUSHER & GİRİŞ
function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { cluster: 'eu', authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}` });
    presenceChannel = pusher.subscribe('presence-chat');
    presenceChannel.bind('new-message', d => {
        if ((d.target === 'general' && activeChat === 'general') || (d.user === activeChat && d.target === loggedInUser) || (d.user === loggedInUser && d.target === activeChat)) renderMessage(d);
    });
    const updateUI = () => {
        const list = document.getElementById('user-list');
        list.innerHTML = `<div class="user-item ${activeChat==='general'?'active':''}" onclick="switchChat('general')">🌍 Genel Mevzu</div>`;
        presenceChannel.members.each(m => {
            if (m.id && m.id !== loggedInUser) list.insertAdjacentHTML('beforeend', `<div class="user-item ${activeChat===m.id?'active':''}" onclick="switchChat('${m.id}')">👤 ${m.id}</div>`);
        });
    };
    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
}

function login() { const u = document.getElementById('username').value.trim(); if(u) { localStorage.setItem('barzoUser', u); location.reload(); } }

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser && loggedInUser !== "undefined") {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex'; 
        initPusher(); switchChat('general');
    }
    document.getElementById('msgInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
});
