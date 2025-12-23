let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// 1. SERVICE WORKER KAYDI (Üstten bildirim için)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Bildirim servisi aktif ✅'))
            .catch(err => console.log('Servis hatası:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // EKRAN KONTROLÜ
    if (loggedInUser && loggedInUser !== "undefined") {
        showChat();
    } else {
        const auth = document.getElementById('auth-screen');
        if (auth) auth.style.display = 'flex';
    }

    // ENTER TUŞU DİNLEYİCİ
    const msgInput = document.getElementById('msgInput');
    if (msgInput) {
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // BİLDİRİM İZNİ İSTE
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
});

// ÜSTTEN BİLDİRİM GÖSTERME (Sessiz Kayan Bildirim)
// ÜSTTEN BİLDİRİM GÖSTERME (Klasik Mesaj İkonlu)
function showTopNotification(data) {
    if ("Notification" in window && Notification.permission === "granted") {
        navigator.serviceWorker.ready.then(registration => {
            const classicIcon = 'https://cdn-icons-png.flaticon.com/512/589/589708.png?v=1';
            
            registration.showNotification(data.user, {
                body: data.text,
                icon: classicIcon,   // Büyük ikon (Mesaj balonu)
                badge: classicIcon,  // Bildirim çubuğundaki küçük ikon
                image: classicIcon,  // Bazı cihazlarda bildirimi genişletince çıkan büyük resim
                vibrate: [200, 100, 200],
                tag: 'chat-msg',
                renotify: true,
                data: { url: window.location.origin } // Tıklayınca siteye gitmesi için
            });
        });
    }
}

// EMOJI & SIDEBAR FONKSİYONLARI
function toggleEmojiPicker(e) { e.stopPropagation(); document.getElementById('custom-emoji-picker').classList.toggle('show'); }
function hideEmojiPicker() { document.getElementById('custom-emoji-picker').classList.remove('show'); }
function addEmoji(emoji) { const input = document.getElementById('msgInput'); if(input) { input.value += emoji; input.focus(); } }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// MESAJI EKRANA YAZDIRMA
function renderMessage(data) {
    if (!data.id || document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const html = `
        <div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">
            ${!isOwn ? `<small style="font-size:10px; color:#a1a1aa; font-weight:bold; margin-bottom:2px;">${data.user}</small>` : ''}
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

// PUSHER VE ÇEVRİMİÇİ LİSTESİ
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

        // SADECE BİLDİRİM (Ses Yok)
        if (data.user !== loggedInUser) {
            showTopNotification(data);
        }
    });

    const updateUI = () => {
        const list = document.getElementById('user-list');
        if (!list) return;
        list.innerHTML = `
            <div class="user-item ${activeChat==='general'?'active':''}" onclick="switchChat('general')">
                <span class="online-dot"></span> 🌍 Genel Mevzu
            </div>`;
        
        presenceChannel.members.each(m => {
            if (m.id && m.id !== loggedInUser) {
                list.insertAdjacentHTML('beforeend', `
                    <div class="user-item ${activeChat===m.id?'active':''}" onclick="switchChat('${m.id}')">
                        <span class="online-dot"></span> ${m.id}
                    </div>`);
            }
        });
        const counter = document.getElementById('online-counter');
        if (counter) counter.innerText = presenceChannel.members.count;
    };

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
}

// MESAJ GÖNDERME
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

// SOHBET DEĞİŞTİRME
async function switchChat(t) {
    activeChat = t;
    const title = document.getElementById('active-chat-title');
    if (title) title.innerText = t === 'general' ? 'Genel Mevzu' : `👤 ${t}`;
    
    const chatBox = document.getElementById('chat');
    if (chatBox) chatBox.innerHTML = '';
    
    if(window.innerWidth <= 768) {
        const side = document.getElementById('sidebar');
        if (side) side.classList.remove('open');
    }
    
    const res = await fetch(`/api/get-messages?dm=${t}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: "msg-"+m.id }));
}

function login() { 
    const uInput = document.getElementById('username');
    const u = uInput ? uInput.value.trim() : ""; 
    if(u) { localStorage.setItem('barzoUser', u); location.reload(); } 
}

function logout() { localStorage.removeItem('barzoUser'); location.reload(); }

function showChat() { 
    const auth = document.getElementById('auth-screen');
    const chat = document.getElementById('chat-screen');
    if (auth) auth.style.display = 'none';
    if (chat) chat.style.display = 'flex'; 
    initPusher(); 
    switchChat('general'); 
}


