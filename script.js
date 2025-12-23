let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser && loggedInUser !== "undefined") showChat();
    else document.getElementById('auth-screen').style.display = 'flex';
});

// GİRİŞ VE KAYIT FONKSİYONU
async function auth(action) {
    const u = document.getElementById('auth-user').value.trim();
    const p = document.getElementById('auth-pass').value.trim();
    if(!u || !p) return alert("Eksik bilgi!");

    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action, username: u, password: p })
    });
    
    if (res.ok) {
        if(action === 'login') {
            localStorage.setItem('barzoUser', u);
            location.reload();
        } else {
            alert("Racon kesildi! Şimdi giriş yap.");
        }
    } else {
        const data = await res.json();
        alert(data.error || "Hata oluştu.");
    }
};

function showChat() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    initPusher();
    switchChat('general');
};

function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu',
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}`
    });

    presenceChannel = pusher.subscribe('presence-chat');

    // YENİ MESAJ GELDİĞİNDE
    presenceChannel.bind('new-message', data => {
        const isGeneral = (data.target === 'general' && activeChat === 'general');
        const isDM = (data.user === activeChat && data.target === loggedInUser) || 
                     (data.user === loggedInUser && data.target === activeChat);

        if (isGeneral || isDM) {
            renderMessage(data);
            
            // Onay işareti güncelleme (Mavi Tık)
            if (data.user === loggedInUser) {
                const tick = document.querySelector(`#msg-${data.id} .tick`);
                if (tick) {
                    tick.innerText = ' ✓✓';
                    tick.style.color = '#4fc3f7';
                }
            }
        }
    });

    // ONLINE LİSTESİ VE SAYACI GÜNCELLEME
    const updateUI = () => {
        const list = document.getElementById('user-list');
        list.innerHTML = `<div class="user-item ${activeChat==='general'?'active':''}" onclick="switchChat('general')">🌍 Genel Mevzu</div>`;
        
        presenceChannel.members.each(m => {
            if (m.id && m.id !== "undefined" && m.id !== loggedInUser) {
                list.insertAdjacentHTML('beforeend', `
                    <div class="user-item ${activeChat===m.id?'active':''}" onclick="switchChat('${m.id}')">
                        <span style="color:#22c55e;">●</span> ${m.id}
                    </div>`);
            }
        });
        
        // Online Sayacı
        const counter = document.getElementById('online-counter');
        if (counter) counter.innerText = presenceChannel.members.count;
    };

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
};

// SOHBET DEĞİŞTİRME
async function switchChat(t) {
    activeChat = t;
    document.getElementById('active-chat-title').innerText = t === 'general' ? 'Genel Mevzu' : `👤 ${t}`;
    document.getElementById('chat').innerHTML = '<div style="color:gray; padding:10px; font-size:12px;">Yükleniyor...</div>';
    
    if(window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');

    const res = await fetch(`/api/get-messages?dm=${t}&user=${loggedInUser}`);
    const msgs = await res.json();
    document.getElementById('chat').innerHTML = '';
    msgs.forEach(m => renderMessage({ 
        user: m.username, 
        text: m.content, 
        id: m.id, 
        time: m.created_at, // Veritabanından gelen zaman
        isHistory: true 
    }));
};

// MESAJ GÖNDERME (İyimser Güncelleme & Anında Temizleme)
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;
    
    const messageId = "msg-" + Date.now();
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    const messageData = { 
        action: 'new', 
        user: loggedInUser, 
        text: val, 
        target: activeChat, 
        id: messageId,
        time: timeStr
    };

    // Ekrana bas ve kutuyu sil
    renderMessage(messageData);
    input.value = '';

    try {
        await fetch('/api/send-message', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(messageData)
        });
    } catch (error) {
        console.error("Hata:", error);
        const tick = document.querySelector(`#${messageId} .tick`);
        if (tick) tick.innerText = ' ⚠️';
    }
};

// MESAJI EKRANA BASMA
function renderMessage(data) {
    if (!data.id || !data.text) return;
    if (document.getElementById(data.id)) return;

    const isOwn = data.user === loggedInUser;
    let displayTime = data.time || "";

    const html = `
        <div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">
            ${!isOwn ? `<small style="font-size:10px; display:block; opacity:0.7; font-weight:bold;">${data.user}</small>` : ''}
            <div style="display: flex; align-items: flex-end; gap: 8px;">
                <span>${data.text}</span>
                <span style="font-size:9px; opacity:0.5; white-space: nowrap;">
                    ${displayTime} 
                    ${isOwn ? `<span class="tick" style="font-weight:bold;">${data.isHistory ? ' ✓✓' : ' ✓'}</span>` : ''}
                </span>
            </div>
        </div>`;

    const c = document.getElementById('chat');
    if (c) {
        c.insertAdjacentHTML('beforeend', html);
        c.scrollTop = c.scrollHeight;
    }
};

// EKSTRA ÖZELLİKLER (Emoji ve Sidebar)
function addEmoji(e) {
    const input = document.getElementById('msgInput');
    input.value += e;
    input.focus();
};

function logout() {
    localStorage.removeItem('barzoUser');
    location.reload();
};

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
};
