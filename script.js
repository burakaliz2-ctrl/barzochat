// 1. TEMEL DEĞİŞKENLER (Kayıtlı bilgilerden alınmıştır)
let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// 2. KAYDIRMA (SWIPE) ÖZELLİĞİ - SOLA KAYDIRINCA KESİN KAPANIR
let touchStartX = 0;

document.addEventListener('touchstart', (e) => { 
    touchStartX = e.changedTouches[0].screenX; 
}, {passive: true});

document.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const diff = touchEndX - touchStartX;
    const sidebar = document.getElementById('sidebar');

    if (!sidebar) return;

    // Sağa kaydır (Aç): Ekranın sol kenarından çekilirse
    if (diff > 80 && touchStartX < 70) {
        sidebar.classList.add('open');
    }
    // Sola kaydır (Kapat): Sidebar açıkken sola çekilirse
    if (diff < -80 && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }
}, {passive: true});

// 3. MENÜYÜ BUTONLA AÇIP KAPATMA
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

// 4. SOHBET GEÇİŞİ (Menüyü Kapatarak)
async function switchChat(userId) {
    activeChat = userId;
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open'); // Menüyü kapat
    
    const title = document.getElementById('active-chat-title');
    if (title) title.innerText = userId === 'general' ? 'Genel Mevzu' : `👤 ${userId}`;
    
    const chatBox = document.getElementById('chat');
    if (chatBox) chatBox.innerHTML = '';
    
    try {
        const res = await fetch(`/api/get-messages?dm=${userId}&user=${loggedInUser}`);
        const msgs = await res.json();
        msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: "msg-"+m.id }));
    } catch (err) { console.error("Hata:", err); }
}

// 5. MESAJLARI EKRANA BASMA
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

// 6. MESAJ GÖNDERME
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

// 7. PUSHER BAĞLANTISI (Kayıtlı bilgiler: 2025-12-12)
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
        if ((isGeneral && activeChat === 'general') || isDirect) renderMessage(data);
    });

    const updateUI = () => {
        const list = document.getElementById('user-list');
        if (!list) return;
        list.innerHTML = `<div class="user-item ${activeChat==='general'?'active':''}" onclick="switchChat('general')"><span class="online-dot"></span> 🌍 Genel Mevzu</div>`;
        
        presenceChannel.members.each(m => {
            if (m.id && m.id !== loggedInUser) {
                list.insertAdjacentHTML('beforeend', `
                    <div class="user-item ${activeChat===m.id?'active':''}" onclick="switchChat('${m.id}')">
                        <span class="online-dot"></span> ${m.id}
                    </div>`);
            }
        });
    };

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
}

// 8. BAŞLATMA VE EKRAN KONTROLÜ (Siyah Ekranı Önleyen Bölüm)
function login() { 
    const u = document.getElementById('username').value.trim(); 
    if(u) { localStorage.setItem('barzoUser', u); location.reload(); } 
}

document.addEventListener('DOMContentLoaded', () => {
    const authScreen = document.getElementById('auth-screen');
    const chatScreen = document.getElementById('chat-screen');

    if (loggedInUser && loggedInUser !== "undefined") {
        if (authScreen) authScreen.style.display = 'none';
        if (chatScreen) chatScreen.style.display = 'flex'; // CSS ile uyumlu Flex yapısı
        initPusher(); 
        switchChat('general');
    } else {
        if (authScreen) authScreen.style.display = 'flex';
        if (chatScreen) chatScreen.style.display = 'none';
    }

    document.getElementById('msgInput')?.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter') sendMessage(); 
    });
});
