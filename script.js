let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let touchStartX = 0;
let typingTimeout = null;

// SWIPE & TOGGLE
document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
document.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    const sidebar = document.getElementById('sidebar');
    if (diff > 80 && touchStartX < 70) sidebar?.classList.add('open');
    if (diff < -80 && sidebar?.classList.contains('open')) sidebar?.classList.remove('open');
}, {passive: true});

function toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('open'); }

// MESAJLARI EKRANA BASMA (Resim Destekli)
function renderMessage(data) {
    if (!data.id || document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Metin veya Resim içeriği
    let content = data.text || data.content || "";
    if (data.image) content = `<img src="${data.image}" onclick="window.open(this.src)">`;

    const html = `
        <div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">
            ${!isOwn ? `<small style="font-size:10px; color:#a1a1aa; font-weight:bold; display:block; margin-bottom:2px;">${data.user}</small>` : ''}
            <span>${content}</span>
            <div class="msg-info" style="display:flex; justify-content:flex-end; align-items:center; gap:4px; margin-top:2px;">
                <span class="msg-time" style="font-size:10px; opacity:0.6;">${time}</span>
                ${isOwn ? `<span class="tick" style="font-size:10px; opacity:0.8;"> ✓✓</span>` : ''}
            </div>
        </div>`;
    const c = document.getElementById('chat');
    if (c) { c.insertAdjacentHTML('beforeend', html); c.scrollTop = c.scrollHeight; }
}

// YAZIYOR OLAYI
function sendTypingEvent() {
    if (presenceChannel) presenceChannel.trigger('client-typing', { user: loggedInUser, target: activeChat });
}

// PUSHER KURULUMU
function initPusher() {
    if (!loggedInUser) return;
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu', authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}` 
    });
    presenceChannel = pusher.subscribe('presence-chat');
    
    presenceChannel.bind('new-message', d => {
        const isGeneral = d.target === 'general';
        const isDirect = (d.user === activeChat && d.target === loggedInUser) || (d.user === loggedInUser && d.target === activeChat);
        if ((isGeneral && activeChat === 'general') || isDirect) renderMessage(d);
        if (d.user !== loggedInUser) { /* Notification tetiklenebilir */ }
    });

    presenceChannel.bind('client-typing', d => {
        if (d.user !== loggedInUser && d.target === activeChat) {
            const ind = document.getElementById('typing-indicator');
            if(ind) {
                ind.innerText = `${d.user} yazıyor...`;
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => ind.innerText = '', 3000);
            }
        }
    });

    const updateUI = () => {
        const list = document.getElementById('user-list');
        if (!list) return;
        list.innerHTML = `<div class="user-item" onclick="switchChat('general')"><span class="online-dot"></span> 🌍 Genel Mevzu</div>`;
        presenceChannel.members.each(m => {
            if (m.id && m.id !== loggedInUser) list.insertAdjacentHTML('beforeend', `<div class="user-item" onclick="switchChat('${m.id}')"><span class="online-dot"></span> ${m.id}</div>`);
        });
    };
    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
}

// MESAJ VE DOSYA GÖNDERME
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;
    const id = "msg-" + Date.now();
    renderMessage({ user: loggedInUser, text: val, id: id });
    input.value = '';
    await fetch('/api/send-message', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'new', user: loggedInUser, text: val, target: activeChat, id: id })
    });
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const base64 = ev.target.result;
        const id = "msg-" + Date.now();
        renderMessage({ user: loggedInUser, image: base64, id: id });
        await fetch('/api/send-message', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'new', user: loggedInUser, image: base64, target: activeChat, id: id })
        });
    };
    reader.readAsDataURL(file);
}

// BAŞLAT
function login() { const u = document.getElementById('username').value.trim(); if(u) { localStorage.setItem('barzoUser', u); location.reload(); } }

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser && loggedInUser !== "undefined") {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        initPusher(); switchChat('general');
    }
    document.getElementById('msgInput')?.addEventListener('keypress', e => { 
        sendTypingEvent(); 
        if (e.key === 'Enter') sendMessage(); 
    });
    document.getElementById('send-btn')?.addEventListener('click', sendMessage);
    document.getElementById('fileInput')?.addEventListener('change', handleFileUpload);
    document.querySelector('.logout-btn')?.addEventListener('click', () => { localStorage.removeItem('barzoUser'); location.reload(); });
});

async function switchChat(id) {
    activeChat = id;
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('active-chat-title').innerText = id === 'general' ? 'Genel Mevzu' : `👤 ${id}`;
    document.getElementById('chat').innerHTML = '';
    const res = await fetch(`/api/get-messages?dm=${id}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: "msg-"+m.id, image: m.image }));
}
