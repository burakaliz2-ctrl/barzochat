let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let deferredPrompt;

// 1. SERVICE WORKER KAYDI
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js?v=4').then(reg => {
            reg.update();
            console.log('Servis Hazır ✅');
        }).catch(err => console.log('SW Hatası:', err));
    });
}

// 2. OTOMATİK YÜKLEME İSTEMİ
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Kullanıcı bir yere tıkladığında pencereyi açmak için hazırda tutar
});

// Sayfada herhangi bir yere ilk tıklamada yükleme isteğini zorla
window.addEventListener('click', () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt = null;
    }
}, { once: true });

document.addEventListener('DOMContentLoaded', () => {
    const auth = document.getElementById('auth-screen');
    const chat = document.getElementById('chat-screen');

    if (loggedInUser && loggedInUser !== "undefined") {
        showChat();
    } else {
        if (auth) auth.style.display = 'flex';
        if (chat) chat.style.display = 'none';
    }

    const msgInput = document.getElementById('msgInput');
    if (msgInput) {
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // Bildirim izni iste
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
});

// --- MENÜ (SIDEBAR) KONTROLLERİ ---

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

// Menüyü dışarıya tıklayınca veya bir şey seçince kapatmak için
function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }
}

// --- SOHBET DEĞİŞTİRME (Hata burada düzeltildi) ---
async function switchChat(t) {
    activeChat = t;
    
    // 1. Menüyü kapat (Mobilde seçince menünün gitmesi için)
    closeSidebar();
    
    // 2. Başlığı güncelle
    const title = document.getElementById('active-chat-title');
    if (title) title.innerText = t === 'general' ? 'Genel Mevzu' : `👤 ${t}`;
    
    // 3. Mesaj alanını temizle ve yükle
    const chatBox = document.getElementById('chat');
    if (chatBox) chatBox.innerHTML = '';
    
    try {
        const res = await fetch(`/api/get-messages?dm=${t}&user=${loggedInUser}`);
        const msgs = await res.json();
        msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: "msg-"+m.id }));
    } catch (err) {
        console.log("Mesaj yükleme hatası:", err);
    }
}

// --- BİLDİRİM VE DİĞER FONKSİYONLAR ---

function showTopNotification(data) {
    if ("Notification" in window && Notification.permission === "granted") {
        navigator.serviceWorker.ready.then(registration => {
            const icon = 'https://cdn-icons-png.flaticon.com/512/3601/3601571.png';
            registration.showNotification(data.user, {
                body: data.text,
                icon: icon,
                badge: icon,
                vibrate: [200, 100, 200],
                tag: 'chat-msg',
                renotify: true
            });
        });
    }
}

function renderMessage(data) {
    if (!data.id || document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const html = `
        <div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">
            ${!isOwn ? `<small style="font-size:10px; color:#a1a1aa; font-weight:bold;">${data.user}</small>` : ''}
            <span>${data.text}</span>
            <div class="msg-info">
                <span class="msg-time">${time}</span>
                ${isOwn ? `<span class="tick">✓✓</span>` : ''}
            </div>
        </div>`;
    
    const c = document.getElementById('chat');
    if (c) {
        c.insertAdjacentHTML('beforeend', html);
        c.scrollTop = c.scrollHeight;
    }
}

function initPusher() {
    if (!loggedInUser) return;
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu',
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}`
    });
    presenceChannel = pusher.subscribe('presence-chat');

    presenceChannel.bind('new-message', data => {
        const isGeneral = data.target === 'general';
        const isDirect = (data.user === activeChat && data.target === loggedInUser) || 
                         (data.user === loggedInUser && data.target === activeChat);
        
        if ((isGeneral && activeChat === 'general') || isDirect) {
            renderMessage(data);
        }
        if (data.user !== loggedInUser) {
            showTopNotification(data);
        }
    });

    const updateUI = () => {
        const list = document.getElementById('user-list');
        if (!list) return;
        list.innerHTML = `<div class="user-item ${activeChat==='general'?'active':''}" onclick="switchChat('general')"><span class="online-dot"></span> 🌍 Genel Mevzu</div>`;
        presenceChannel.members.each(m => {
            if (m.id && m.id !== loggedInUser) {
                list.insertAdjacentHTML('beforeend', `<div class="user-item ${activeChat===m.id?'active':''}" onclick="switchChat('${m.id}')"><span class="online-dot"></span> ${m.id}</div>`);
            }
        });
    };

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
}

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input ? input.value.trim() : "";
    if (!val) return;
    hideEmojiPicker();
    const messageId = "msg-" + Date.now();
    renderMessage({ user: loggedInUser, text: val, id: messageId });
    input.value = '';
    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'new', user: loggedInUser, text: val, target: activeChat, id: messageId })
    });
}

function login() { const u = document.getElementById('username').value.trim(); if(u) { localStorage.setItem('barzoUser', u); location.reload(); } }
function logout() { localStorage.removeItem('barzoUser'); location.reload(); }
function showChat() { 
    if (document.getElementById('auth-screen')) document.getElementById('auth-screen').style.display = 'none';
    if (document.getElementById('chat-screen')) document.getElementById('chat-screen').style.display = 'flex'; 
    initPusher(); 
    switchChat('general'); 
}
function toggleEmojiPicker(e) { e.stopPropagation(); document.getElementById('custom-emoji-picker').classList.toggle('show'); }
function hideEmojiPicker() { if(document.getElementById('custom-emoji-picker')) document.getElementById('custom-emoji-picker').classList.remove('show'); }
function addEmoji(emoji) { const input = document.getElementById('msgInput'); if(input) { input.value += emoji; input.focus(); } }
