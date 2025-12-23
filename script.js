let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// SWIPE (KAYDIRMA) AYARI
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', (e) => { 
    touchStartX = e.changedTouches[0].screenX; 
    touchStartY = e.changedTouches[0].screenY;
}, {passive: true});

document.addEventListener('touchend', (e) => {
    const diffX = e.changedTouches[0].screenX - touchStartX;
    const diffY = e.changedTouches[0].screenY - touchStartY;
    const sidebar = document.getElementById('sidebar');

    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 80 && touchStartX < 70) sidebar?.classList.add('open'); // Sağa çek: Aç
        if (diffX < -80) sidebar?.classList.remove('open'); // Sola çek: Kapat
    }
}, {passive: true});

function toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('open'); }

// SOHBET İŞLEMLERİ
async function switchChat(t) {
    activeChat = t;
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('active-chat-title').innerText = t === 'general' ? 'Genel Mevzu' : `👤 ${t}`;
    const chatBox = document.getElementById('chat');
    chatBox.innerHTML = '';
    
    try {
        const res = await fetch(`/api/get-messages?dm=${t}&user=${loggedInUser}`);
        const msgs = await res.json();
        msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: "msg-"+m.id }));
    } catch (err) { console.log(err); }
}

function renderMessage(data) {
    if (!data.id || document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const html = `
        <div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">
            ${!isOwn ? `<small style="font-size:10px; color:#a1a1aa; font-weight:bold; display:block;">${data.user}</small>` : ''}
            <span>${data.text}</span>
            <div class="msg-info"><span>${time}</span>${isOwn ? `<span>✓✓</span>` : ''}</div>
        </div>`;
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

// PUSHER & LOGIN (2025-12-12 Tabanlı)
function initPusher() {
    if (!loggedInUser) return;
    const pusher = new Pusher('7c829d72a0184ee33bb3', { cluster: 'eu', authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}` });
    presenceChannel = pusher.subscribe('presence-chat');
    
    presenceChannel.bind('new-message', d => {
        if ((d.target === 'general' && activeChat === 'general') || (d.user === activeChat && d.target === loggedInUser) || (d.user === loggedInUser && d.target === activeChat)) renderMessage(d);
    });

    const updateUI = () => {
        const list = document.getElementById('user-list');
        if (!list) return;
        list.innerHTML = `<div class="user-item ${activeChat==='general'?'active':''}" onclick="switchChat('general')"><span class="online-dot"></span> 🌍 Genel Mevzu</div>`;
        presenceChannel.members.each(m => {
            if (m.id && m.id !== loggedInUser) list.insertAdjacentHTML('beforeend', `<div class="user-item ${activeChat===m.id?'active':''}" onclick="switchChat('${m.id}')"><span class="online-dot"></span> ${m.id}</div>`);
        });
    };
    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
}

function login() { 
    const u = document.getElementById('username').value.trim(); 
    if(u) { localStorage.setItem('barzoUser', u); location.reload(); } 
}

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser && loggedInUser !== "undefined") {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex'; 
        initPusher(); switchChat('general');
    }
    document.getElementById('msgInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
});
