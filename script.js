let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let touchStartX = 0;
let typingTimeout = null;

// 1. SERVICE WORKER & BİLDİRİM
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.error("SW Hatası:", err));
}

function showNotification(data) {
    if (Notification.permission !== "granted" || data.user === loggedInUser) return;
    navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(data.user, {
            body: data.text || "Bir resim gönderdi",
            icon: '/icon.png',
            tag: 'chat-notification',
            renotify: true
        });
    });
}

// 2. RESİM GÖNDERME İŞLEMİ
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const base64Data = event.target.result;
        const messageId = "msg-" + Date.now();
        
        // Ekranda göster
        renderMessage({ user: loggedInUser, image: base64Data, id: messageId });

        // Sunucuya gönder
        await fetch('/api/send-message', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                action: 'new', 
                user: loggedInUser, 
                image: base64Data, 
                target: activeChat, 
                id: messageId 
            })
        });
    };
    reader.readAsDataURL(file);
}

// 3. YAZIYOR... KONTROLÜ
function sendTypingEvent() {
    if (presenceChannel) {
        presenceChannel.trigger('client-typing', { user: loggedInUser, target: activeChat });
    }
}

// 4. PUSHER & ETKİLEŞİM
function initPusher() {
    if (!loggedInUser) return;
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu', 
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}` 
    });
    
    presenceChannel = pusher.subscribe('presence-chat');
    
    // Yeni Mesaj Geldiğinde
    presenceChannel.bind('new-message', d => {
        const isGeneral = d.target === 'general';
        const isDirect = (d.user === activeChat && d.target === loggedInUser) || (d.user === loggedInUser && d.target === activeChat);
        
        if ((isGeneral && activeChat === 'general') || isDirect) {
            renderMessage(d);
            document.getElementById('typing-indicator').innerText = ''; // Mesaj gelince yazıyı sil
        }
        showNotification(d);
    });

    // "Yazıyor..." Bilgisi Geldiğinde
    presenceChannel.bind('client-typing', d => {
        if (d.user !== loggedInUser && d.target === activeChat) {
            const indicator = document.getElementById('typing-indicator');
            indicator.innerText = `${d.user} yazıyor...`;
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => { indicator.innerText = ''; }, 3000);
        }
    });

    // Kullanıcı Listesi Güncelleme (Senin orijinal kodun)
    const updateUI = () => {
        const list = document.getElementById('user-list');
        if (!list) return;
        list.innerHTML = `<div class="user-item" onclick="switchChat('general')"><span class="online-dot"></span> 🌍 Genel Mevzu</div>`;
        presenceChannel.members.each(m => {
            if (m.id && m.id !== loggedInUser) {
                list.insertAdjacentHTML('beforeend', `<div class="user-item" onclick="switchChat('${m.id}')"><span class="online-dot"></span> ${m.id}</div>`);
            }
        });
    };
    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
}

// 5. MESAJI EKRANA BASMA (Resim Destekli)
function renderMessage(data) {
    if (!data.id || document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let content = data.text || data.content || "";
    if (data.image) {
        content = `<img src="${data.image}" onclick="window.open(this.src)" />`;
    }

    const html = `
        <div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">
            ${!isOwn ? `<small style="font-size:10px; color:#a1a1aa; font-weight:bold; display:block;">${data.user}</small>` : ''}
            <span>${content}</span>
            <div class="msg-info">
                <span class="msg-time">${time}</span>
                ${isOwn ? `<span class="tick"> ✓✓</span>` : ''}
            </div>
        </div>`;
    const c = document.getElementById('chat');
    if (c) { c.insertAdjacentHTML('beforeend', html); c.scrollTop = c.scrollHeight; }
}

// Sayfa Başlatma
document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser && loggedInUser !== "undefined") {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        initPusher(); 
        switchChat('general');
    }
    
    // Input Dinleyicileri
    const input = document.getElementById('msgInput');
    input?.addEventListener('keypress', e => { 
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
    const messageId = "msg-" + Date.now();
    renderMessage({ user: loggedInUser, text: val, id: messageId });
    input.value = '';
    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'new', user: loggedInUser, text: val, target: activeChat, id: messageId })
    });
}
