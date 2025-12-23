let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let touchStartX = 0;

// 1. SERVICE WORKER KAYDI (Bildirimler için şart)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log("SW Aktif");
    }).catch(err => console.error("SW Hatası:", err));
}

// 2. BİLDİRİM GÖSTERME FONKSİYONU
function showNotification(data) {
    if (Notification.permission !== "granted" || data.user === loggedInUser) return;

    // Eğer o an o sohbetteysek bildirim çıkarma
    const isVisible = (data.target === 'general' && activeChat === 'general') || 
                      (data.user === activeChat && data.target === loggedInUser);
    
    if (!isVisible) {
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(data.user, {
                body: data.text || data.content || "Yeni bir mesajınız var",
                icon: '/icon.png',
                tag: 'chat-msg',
                renotify: true
            });
        });
    }
}

// 3. KAYDIRMA (SWIPE) KONTROLÜ
document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
document.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    const sidebar = document.getElementById('sidebar');
    if (diff > 80 && touchStartX < 70) sidebar?.classList.add('open');
    if (diff < -80 && sidebar?.classList.contains('open')) sidebar?.classList.remove('open');
}, {passive: true});

function toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('open'); }

// 4. MESAJ GÖNDERME VE BASMA
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;
    const id = "msg-" + Date.now();
    renderMessage({ user: loggedInUser, text: val, id: id });
    input.value = '';
    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'new', user: loggedInUser, text: val, target: activeChat, id: id })
    });
}

function renderMessage(data) {
    if (!data.id || document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const content = data.text || data.content || "";
    const html = `
        <div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">
            ${!isOwn ? `<small style="font-size:10px; color:#a1a1aa; font-weight:bold; display:block; margin-bottom:2px;">${data.user}</small>` : ''}
            <span>${content}</span>
            <div style="text-align:right; font-size:10px; opacity:0.6; margin-top:2px;">
                ${time} ${isOwn ? '✓✓' : ''}
            </div>
        </div>`;
    const c = document.getElementById('chat');
    if (c) { c.insertAdjacentHTML('beforeend', html); c.scrollTop = c.scrollHeight; }
}

// 5. PUSHER VE KİŞİ LİSTESİ
function initPusher() {
    if (!loggedInUser) return;
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu', authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}` 
    });
    presenceChannel = pusher.subscribe('presence-chat');
    
    presenceChannel.bind('new-message', d => {
        const isGeneral = d.target === 'general';
        const isDirect = (d.user === activeChat && d.target === loggedInUser) || (d.user === loggedInUser && d.target === activeChat);
        
        if ((isGeneral && activeChat === 'general') || isDirect) {
            renderMessage(d);
        }
        // BİLDİRİMİ TETİKLE
        showNotification(d);
    });

    const updateUI = () => {
        const list = document.getElementById('user-list');
        if (!list) return;
        list.innerHTML = `<div class="user-item ${activeChat === 'general' ? 'active' : ''}" onclick="switchChat('general')"><span class="online-dot"></span> 🌍 Genel Mevzu</div>`;
        presenceChannel.members.each(m => {
            if (m.id && m.id !== loggedInUser) {
                list.insertAdjacentHTML('beforeend', `<div class="user-item ${activeChat === m.id ? 'active' : ''}" onclick="switchChat('${m.id}')">
                    <span class="online-dot"></span> ${m.id}</div>`);
            }
        });
    };
    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
}

// 6. BAŞLATMA
async function switchChat(id) {
    activeChat = id;
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('active-chat-title').innerText = id === 'general' ? 'Genel Mevzu' : `👤 ${id}`;
    document.getElementById('chat').innerHTML = '';
    const res = await fetch(`/api/get-messages?dm=${id}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: "msg-"+m.id }));
}

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser && loggedInUser !== "undefined") {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        initPusher(); switchChat('general');
        if (Notification.permission === "default") Notification.requestPermission();
    }
    document.getElementById('msgInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
    document.getElementById('send-btn')?.addEventListener('click', sendMessage);
    document.querySelector('.logout-btn')?.addEventListener('click', () => { localStorage.removeItem('barzoUser'); location.reload(); });
});
