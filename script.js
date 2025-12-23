let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let touchStartX = 0;
let typingTimeout = null;

// 1. SENİN SON HALİNDEKİ SERVICE WORKER KAYDI
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log("Service Worker aktif.");
    }).catch(err => console.error("SW Kayıt Hatası:", err));
}

// 2. SENİN SON HALİNDEKİ BİLDİRİM FONKSİYONU
function showNotification(data) {
    if (Notification.permission !== "granted") return;
    if (data.user === loggedInUser) return;
    navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(data.user || "Yeni Mesaj", {
            body: data.text || data.content || "Bir resim veya mesaj gönderdi",
            icon: '/icon.png',
            tag: 'chat-notification',
            renotify: true
        });
    });
}

// 3. YAZIYOR... EVENTİ (Yeni)
function sendTypingEvent() {
    if (presenceChannel) presenceChannel.trigger('client-typing', { user: loggedInUser, target: activeChat });
}

// 4. KAYDIRMA (Senin Son Halindeki Mantık)
document.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
document.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    const sidebar = document.getElementById('sidebar');
    if (diff > 80 && touchStartX < 70) sidebar?.classList.add('open');
    if (diff < -80 && sidebar?.classList.contains('open')) sidebar?.classList.remove('open');
}, {passive: true});

function toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('open'); }

// 5. PUSHER VE ETKİLEŞİMLER (Senin Son Halindeki Bind'lar)
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
        showNotification(d); // Bildirimi tetikle
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

// 6. MESAJ GÖNDERME VE RESİM İŞLEME
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

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const base64 = ev.target.result;
        const id = "msg-" + Date.now();
        renderMessage({ user: loggedInUser, image: base64, id: id });
        await fetch('/api/send-message', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'new', user: loggedInUser, image: base64, target: activeChat, id: id })
        });
    };
    reader.readAsDataURL(file);
}

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

async function switchChat(id) {
    activeChat = id;
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('active-chat-title').innerText = id === 'general' ? 'Genel Mevzu' : `👤 ${id}`;
    document.getElementById('chat').innerHTML = '';
    const res = await fetch(`/api/get-messages?dm=${id}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: "msg-"+m.id, image: m.image }));
}

function login() { const u = document.getElementById('username').value.trim(); if(u) { localStorage.setItem('barzoUser', u); location.reload(); } }

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
    document.querySelector('.logout-btn')?.addEventListener('click', () => { localStorage.removeItem('barzoUser'); location.reload(); });
});
// RESMİ SIKIŞTIRIP GÖNDEREN KESİN ÇÖZÜM
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Dosya boyutu çok büyükse kullanıcıyı uyar ama yine de sıkıştırmayı dene
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const img = new Image();
        img.src = ev.target.result;
        img.onload = async () => {
            const canvas = document.createElement('canvas');
            
            // Bilgisayarda düzgün görünmesi için 600px genişlik yeterlidir
            // Bu genişlik veri boyutunu %90 oranında azaltır
            const MAX_WIDTH = 600; 
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // 'image/jpeg' formatı Base64 boyutunu 'png'ye göre çok daha fazla küçültür
            // 0.5 kalitesi Pusher limitlerine girmek için idealdir
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
            
            console.log("Sıkıştırılmış Resim Boyutu:", Math.round(compressedBase64.length / 1024), "KB");

            const id = "msg-" + Date.now();
            
            // 1. Önce kendi ekranımızda göster
            renderMessage({ user: loggedInUser, image: compressedBase64, id: id });

            // 2. Sunucuya gönder
            try {
                const response = await fetch('/api/send-message', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        action: 'new', 
                        user: loggedInUser, 
                        image: compressedBase64, 
                        target: activeChat, 
                        id: id 
                    })
                });
                if (!response.ok) throw new Error("Gönderim başarısız");
            } catch (err) {
                alert("Resim çok büyük olduğu için bilgisayara iletilemedi. Lütfen daha küçük bir dosya seçin.");
            }
        };
    };
    reader.readAsDataURL(file);
};

// MESAJI EKRANA BASAN FONKSİYON (Resim Kontrollü)
function renderMessage(data) {
    if (!data.id || document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Eğer veri 'image' içeriyorsa img etiketi oluştur, yoksa normal metni al
    let content = "";
    if (data.image || (data.content && data.content.startsWith('data:image'))) {
        const imgSrc = data.image || data.content;
        content = `<img src="${imgSrc}" style="max-width:100%; border-radius:10px; cursor:pointer;" onclick="window.open(this.src)">`;
    } else {
        content = `<span>${data.text || data.content || ""}</span>`;
    }

    const html = `
        <div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">
            ${!isOwn ? `<small style="font-size:10px; color:#a1a1aa; font-weight:bold; display:block; margin-bottom:2px;">${data.user}</small>` : ''}
            ${content}
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
    reader.readAsDataURL(file);
};


