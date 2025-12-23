let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let touchStartX = 0;
// Orijinal değişkenlerinin altına ekle
let typingTimeout = null;

// GİRİŞ FONKSİYONU (Düzeltildi)
function login() {
    const user = document.getElementById('username').value.trim();
    if (user) {
        localStorage.setItem('barzoUser', user);
        location.reload();
    }
}

function logout() {
    localStorage.removeItem('barzoUser');
    location.reload();
}

// YAZIYOR OLAYI
function sendTypingEvent() {
    if (presenceChannel) presenceChannel.trigger('client-typing', { user: loggedInUser, target: activeChat });
}

// PUSHER BAĞLANTISI (Yazıyor Bind'ı Eklendi)
// initPusher fonksiyonu içindeki bind'ların arasına ekle:
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

// RESİM SIKIŞTIRMA VE GÖNDERME
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

// Mesaj basma fonksiyonuna resim desteği ekle
function renderMessage(data) {
    if (!data.id || document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    let content = data.text || data.content || "";
    if (data.image) content = `<img src="${data.image}" onclick="window.open(this.src)">`;

    const html = `<div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">
        ${!isOwn ? `<small>${data.user}</small>` : ''}
        <span>${content}</span>
    </div>`;
    // ... geri kalan render kodların
}

// DOMContentLoaded içine ekle:
document.getElementById('fileInput')?.addEventListener('change', handleFileUpload);
document.getElementById('msgInput')?.addEventListener('input', sendTypingEvent);
// 1. SERVICE WORKER KAYDI (Zorunlu)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log("Service Worker aktif.");
    }).catch(err => console.error("SW Kayıt Hatası:", err));
}

// 2. BİLDİRİM GÖNDERME FONKSİYONU (Geliştirildi)
function showNotification(data) {
    // Eğer tarayıcıda bildirim izni yoksa hiçbir şey yapma
    if (Notification.permission !== "granted") return;

    // Eğer mesajı gönderen bizsek bildirim çıkarma
    if (data.user === loggedInUser) return;

    // Service Worker üzerinden bildirimi tetikle
    navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(data.user || "Yeni Mesaj", {
            body: data.text || data.content || "Bir mesajınız var", // Veri formatına göre ikisini de kontrol eder
            icon: '/icon.png', // İkon yolunuza göre güncelleyin
            badge: '/icon.png',
            tag: 'chat-notification',
            renotify: true,
            vibrate: [100, 50, 100],
            data: { url: window.location.href }
        });
    });
}

// 3. SWIPE (KAYDIRMA) KONTROLÜ
document.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
document.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    const sidebar = document.getElementById('sidebar');
    if (diff > 80 && touchStartX < 70) sidebar?.classList.add('open');
    if (diff < -80 && sidebar?.classList.contains('open')) sidebar?.classList.remove('open');
}, {passive: true});

function toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('open'); }

// 4. SOHBET VE MESAJ İŞLEMLERİ
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
            <span>${data.text || data.content}</span>
            <div class="msg-info">
                <span class="msg-time">${time}</span>
                ${isOwn ? `<span class="tick"> ✓✓</span>` : ''}
            </div>
        </div>`;
    const c = document.getElementById('chat');
    if (c) { c.insertAdjacentHTML('beforeend', html); c.scrollTop = c.scrollHeight; }
}

// 5. PUSHER BAĞLANTISI VE BİLDİRİM TETİKLEME
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
        
        // Ekrana mesajı bas
        if ((isGeneral && activeChat === 'general') || isDirect) {
            renderMessage(d);
        }
        
        // Bildirim gönder (Sadece mesaj başkasından gelmişse)
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

// 6. SAYFA BAŞLATMA
document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser && loggedInUser !== "undefined") {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        initPusher(); 
        switchChat('general');
        
        // İlk girişte izin iste
        if (Notification.permission === "default") {
            Notification.requestPermission();
        }
    }
    
    document.getElementById('send-btn')?.addEventListener('click', sendMessage);
    document.getElementById('msgInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
});

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

