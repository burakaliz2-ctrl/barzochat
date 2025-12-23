let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let deferredPrompt;

// 1. SW ve Kayıtlar
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js?v=7').then(reg => reg.update());
    });
}

// 2. KAYDIRMA (SWIPE) ÖZELLİĞİ
let touchStartX = 0;
let touchEndX = 0;
document.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, false);
document.addEventListener('touchend', (e) => { touchEndX = e.changedTouches[0].screenX; handleSwipe(); }, false);

function handleSwipe() {
    const swipeDistance = touchEndX - touchStartX;
    const sidebar = document.getElementById('sidebar');
    if (swipeDistance > 70 && touchStartX < 80) sidebar?.classList.add('open');
    if (swipeDistance < -70) sidebar?.classList.remove('open');
}

// 3. EMOJI SİSTEMİ (Çoklu Seçim Fix)
function toggleEmojiPicker(e) { 
    if(e) e.stopPropagation(); 
    const picker = document.getElementById('custom-emoji-picker');
    picker?.classList.toggle('show');
}

function addEmoji(emoji) { 
    const input = document.getElementById('msgInput'); 
    if(input) { 
        input.value += emoji; 
        input.focus(); 
    }
    // Burada asla hideEmojiPicker() çağrılmıyor!
}

function hideEmojiPicker() { 
    document.getElementById('custom-emoji-picker')?.classList.remove('show'); 
}

// EKranın boş yerine tıklandığında kapatma kontrolü (Emoji paneli hariç)
document.addEventListener('click', (e) => {
    const picker = document.getElementById('custom-emoji-picker');
    const emojiBtn = document.querySelector('.emoji-btn'); // HTML'deki emoji butonu class'ın
    
    // Eğer tıklanan yer picker'ın kendisi DEĞİLSE ve emoji butonu DEĞİLSE kapat
    if (picker && picker.classList.contains('show')) {
        if (!picker.contains(e.target) && e.target !== emojiBtn && !emojiBtn?.contains(e.target)) {
            hideEmojiPicker();
        }
    }
});

// 4. MESAJ VE DİĞER FONKSİYONLAR
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input ? input.value.trim() : "";
    if (!val) return;
    
    hideEmojiPicker(); // Sadece mesaj gönderince kapat
    
    const messageId = "msg-" + Date.now();
    renderMessage({ user: loggedInUser, text: val, id: messageId });
    input.value = '';
    
    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'new', user: loggedInUser, text: val, target: activeChat, id: messageId })
    });
}

function toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('open'); }
function closeSidebar() { document.getElementById('sidebar')?.classList.remove('open'); }

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

function renderMessage(data) {
    if (!data.id || document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const html = `<div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">${!isOwn ? `<small style="font-size:10px; color:#a1a1aa; font-weight:bold; display:block;">${data.user}</small>` : ''}<span>${data.text}</span><div class="msg-info"><span class="msg-time">${time}</span>${isOwn ? `<span class="tick">✓✓</span>` : ''}</div></div>`;
    const c = document.getElementById('chat');
    if (c) { c.insertAdjacentHTML('beforeend', html); c.scrollTop = c.scrollHeight; }
}

function showTopNotification(data) {
    if (Notification.permission === "granted") {
        navigator.serviceWorker.ready.then(reg => {
            const icon = 'https://cdn-icons-png.flaticon.com/512/3601/3601571.png';
            reg.showNotification(data.user, { body: data.text, icon: icon, badge: icon, tag: 'chat-msg', renotify: true });
        });
    }
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

function login() { const u = document.getElementById('username').value.trim(); if(u) { localStorage.setItem('barzoUser', u); location.reload(); } }
function logout() { localStorage.removeItem('barzoUser'); location.reload(); }
function showChat() { 
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex'; 
    initPusher(); switchChat('general'); 
}

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser && loggedInUser !== "undefined") showChat();
    else document.getElementById('auth-screen').style.display = 'flex';
    
    document.getElementById('msgInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
    if (Notification.permission === "default") Notification.requestPermission();
});
