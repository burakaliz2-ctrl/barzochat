let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let touchStartX = 0;
let typingTimeout = null;

// 1. SERVICE WORKER & BİLDİRİM (Senin orijinal yapın)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.error(err));
}

function showNotification(data) {
    if (Notification.permission !== "granted" || data.user === loggedInUser) return;
    navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(data.user || "Yeni Mesaj", {
            body: data.text || data.content || "Bir dosya gönderdi",
            icon: '/icon.png',
            tag: 'chat-notification',
            renotify: true
        });
    });
}

// 2. RESİM SIKIŞTIRMA VE GÖNDERME
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
        const img = new Image();
        img.src = ev.target.result;
        img.onload = async () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 600; 
            let width = img.width;
            let height = img.height;
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
            const id = "msg-" + Date.now();
            
            renderMessage({ user: loggedInUser, image: compressedBase64, id: id });
            await fetch('/api/send-message', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'new', user: loggedInUser, image: compressedBase64, target: activeChat, id: id })
            });
        };
    };
    reader.readAsDataURL(file);
}

// 3. YAZIYOR OLAYI
function sendTypingEvent() {
    if (presenceChannel) presenceChannel.trigger('client-typing', { user: loggedInUser, target: activeChat });
}

// 4. PUSHER & KİŞİ LİSTESİ (Senin orijinal yapın)
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
        showNotification(d);
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

// 5. MESAJI EKRANA BASMA
function renderMessage(data) {
    if (!data.id || document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let content = data.text || data.content || "";
    if (data.image) content = `<img src="${data.image}" onclick="window.open(this.src)">`;

    const html = `<div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">
        ${!isOwn ? `<small style="font-size:10px; color:#a1a1aa; font-weight:bold; display:block; margin-bottom:2px;">${data.user}</small>` : ''}
        <span>${content}</span>
        <div style="text-align:right; font-size:10px; opacity:0.6; margin-top:2px;">${time} ${isOwn ? '✓✓' : ''}</div>
    </div>`;
    const c = document.getElementById('chat');
    if (c) { c.insertAdjacentHTML('beforeend', html); c.scrollTop = c.scrollHeight; }
}

// 6. SAYFA BAŞLATMA
document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser && loggedInUser !== "undefined") {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        initPusher(); switchChat('general');
        if (Notification.permission === "default") Notification.requestPermission();
    }
    
    document.getElementById('msgInput')?.addEventListener('keypress', e => { 
        sendTypingEvent();
        if (e.key === 'Enter') sendMessage(); 
    });
    document.getElementById('send-btn')?.addEventListener('click', sendMessage);
    document.getElementById('fileInput')?.addEventListener('change', handleFileUpload);
});

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

async function switchChat(userId) {
    activeChat = userId;
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('active-chat-title').innerText = userId === 'general' ? 'Genel Mevzu' : `👤 ${userId}`;
    document.getElementById('chat').innerHTML = '';
    const res = await fetch(`/api/get-messages?dm=${userId}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: "msg-"+m.id, image: m.image }));
}
