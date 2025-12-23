let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let deferredPrompt;

// SW ve Bildirim Kayıtları
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js?v=6').then(reg => {
            reg.update();
        }).catch(err => console.log('SW Hatası:', err));
    });
}

// 1. KAYDIRMA (SWIPE) ÖZELLİĞİ
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
}, false);

document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}, false);

function handleSwipe() {
    const swipeDistance = touchEndX - touchStartX;
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Sağdan Sola Kaydırma (En az 70px) -> MENÜYÜ AÇ
    // Sadece ekranın sol kenarından (ilk 50px) başlarsa çalışması daha sağlıklıdır
    if (swipeDistance > 70 && touchStartX < 80) {
        if (!sidebar.classList.contains('open')) {
            sidebar.classList.add('open');
        }
    }
    
    // Soldan Sağa Kaydırma (En az 70px) -> MENÜYÜ KAPAT
    if (swipeDistance < -70) {
        if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    }
}

// 2. OTOMATİK YÜKLEME İSTEMİ
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

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

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
});

// --- EMOJI VE MENÜ FONKSİYONLARI ---

function toggleEmojiPicker(e) { 
    if(e) e.stopPropagation(); 
    const picker = document.getElementById('custom-emoji-picker');
    if (picker) picker.classList.toggle('show');
}

function addEmoji(emoji) { 
    const input = document.getElementById('msgInput'); 
    if(input) { input.value += emoji; input.focus(); }
}

function hideEmojiPicker() { 
    const picker = document.getElementById('custom-emoji-picker');
    if(picker) picker.classList.remove('show'); 
}

document.addEventListener('click', (e) => {
    const picker = document.getElementById('custom-emoji-picker');
    const emojiBtn = document.querySelector('.emoji-btn');
    if (picker && !picker.contains(e.target) && e.target !== emojiBtn) {
        hideEmojiPicker();
    }
});

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('open')) sidebar.classList.remove('open');
}

// --- SOHBET VE PUSHER ---
async function switchChat(t) {
    activeChat = t;
    closeSidebar();
    const title = document.getElementById('active-chat-title');
    if (title) title.innerText = t === 'general' ? 'Genel Mevzu' : `👤 ${t}`;
    const chatBox = document.getElementById('chat');
    if (chatBox) chatBox.innerHTML = '';
    
    try {
        const res = await fetch(`/api/get-messages?dm=${t}&user=${loggedInUser}`);
        const msgs = await res.json();
        msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: "msg-"+m.id }));
    } catch (err) { console.log(err); }
}

function showTopNotification(data) {
    if ("Notification" in window && Notification.permission === "granted") {
        navigator.serviceWorker.ready.then(registration => {
            const icon = 'https://cdn-icons-png.flaticon.com/512/3601/3601571.png';
            registration.showNotification(data.user, {
                body: data.text,
                icon: icon, badge: icon, vibrate: [200, 100, 200], tag: 'chat-msg', renotify: true
            });
        });
    }
}

function renderMessage(data) {
    if (!data.id || document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const html = `<div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">${!isOwn ? `<small style="font-size:10px; color:#a1a1aa; font-weight:bold; display:block;">${data.user}</small>` : ''}<span>${data.text}</span><div class="msg-info"><span class="msg-time">${time}</span>${isOwn ? `<span class="tick">✓✓</span>` : ''}</div></div>`;
    const c = document.getElementById('chat');
    if (c) { c.insertAdjacentHTML('beforeend', html); c.scrollTop = c.scrollHeight; }
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
    initPusher(); switchChat('general'); 
}

function initPusher() {
    if (!loggedInUser) return;
    const pusher = new Pusher('7c829d72a0184ee33bb3', { cluster: 'eu', authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}` });
    presenceChannel = pusher.subscribe('presence-chat');
    presenceChannel.bind('new-message', data => {
        const isGeneral = data.target === 'general';
        const isDirect = (data.user === activeChat && data.target === loggedInUser) || (data.user === loggedInUser && data.target === activeChat);
        if ((isGeneral && activeChat === 'general') || isDirect) renderMessage(data);
        if (data.user !== loggedInUser) showTopNotification(data);
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
