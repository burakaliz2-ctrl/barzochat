let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let touchStartX = 0;

// 1. SERVICE WORKER & BİLDİRİM İZNİ (Yeni Eklendi)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('SW Kayıtlı');
            reg.update();
        });
    });
}

function showNotification(data) {
    // Sadece ekran kapalıyken veya başka bir sohbetteyken bildirim gönder
    const isThisChat = (data.target === 'general' && activeChat === 'general') || 
                       (data.user === activeChat && data.target === loggedInUser);

    if (Notification.permission === "granted" && !isThisChat) {
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(data.user, {
                body: data.text,
                icon: 'https://cdn-icons-png.flaticon.com/512/3601/3601571.png', // Logo yolunu kontrol et
                tag: 'chat-msg',
                renotify: true
            });
        });
    }
}

// 2. SWIPE (KAYDIRMA) KONTROLÜ
document.addEventListener('touchstart', (e) => { 
    touchStartX = e.changedTouches[0].screenX; 
}, {passive: true});

document.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (diff > 80 && touchStartX < 70) sidebar.classList.add('open');
    if (diff < -80 && sidebar.classList.contains('open')) sidebar.classList.remove('open');
}, {passive: true});

// 3. TEMEL FONKSİYONLAR
function toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('open');
}

async function switchChat(userId) {
    activeChat = userId;
    document.getElementById('sidebar')?.classList.remove('open');
    const title = document.getElementById('active-chat-title');
    if (title) title.innerText = userId === 'general' ? 'Genel Mevzu' : `👤 ${userId}`;
    const chatBox = document.getElementById('chat');
    if (chatBox) chatBox.innerHTML = '';
    
    try {
        const res = await fetch(`/api/get-messages?dm=${userId}&user=${loggedInUser}`);
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
            ${!isOwn ? `<small style="font-size:10px; color:#a1a1aa; font-weight:bold; display:block; margin-bottom:2px;">${data.user}</small>` : ''}
            <span>${data.text}</span>
            <div class="msg-info">
                <span class="msg-time">${time}</span>
                ${isOwn ? `<span class="tick"> ✓✓</span>` : ''}
            </div>
        </div>`;
    const c = document.getElementById('chat');
    if (c) {
        c.insertAdjacentHTML('beforeend', html);
        c.scrollTop = c.scrollHeight;
    }
}

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input ? input.value.trim() : "";
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

// 4. PUSHER & BİLDİRİM TETİKLEME
function initPusher() {
    if (!loggedInUser) return;
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu', 
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}` 
    });
    presenceChannel = pusher.subscribe('presence-chat');
    
    presenceChannel.bind('new-message', d => {
        const isGeneral = d.target === 'general';
        const isDirect = (d.user === activeChat && d.target === loggedInUser) || (d.user === loggedInUser && d.target === activeChat);
        
        // Mesajı ekrana bas
        if ((isGeneral && activeChat === 'general') || isDirect) renderMessage(d);
        
        // BİLDİRİM GÖNDER (Mesaj benden değilse)
        if (d.user !== loggedInUser) {
            showNotification(d);
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

// 5. BAŞLATMA
document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser && loggedInUser !== "undefined") {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        initPusher(); 
        switchChat('general');
        
        // Bildirim İzni İste
        if (Notification.permission === "default") {
            Notification.requestPermission();
        }
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
    }

    document.getElementById('msgInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
    document.getElementById('send-btn')?.addEventListener('click', sendMessage);
    document.querySelector('.logout-btn')?.addEventListener('click', () => { localStorage.removeItem('barzoUser'); location.reload(); });
});
