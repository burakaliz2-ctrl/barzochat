// 1. OTURUM VE DEĞİŞKEN BAŞLATMA
let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general'; // Mevcut sohbet edilen kişi veya 'general'
let channel = null;

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        showChat();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('chat-screen').style.display = 'none';
    }
});

// 2. ÜYELİK İŞLEMLERİ
async function auth(action) {
    const username = document.getElementById('auth-user').value.trim();
    const password = document.getElementById('auth-pass').value.trim();
    if(!username || !password) return alert("Alanları doldur!");

    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action, username, password })
    });
    const data = await res.json();
    if (res.ok) {
        if(action === 'login') {
            localStorage.setItem('barzoUser', username);
            loggedInUser = username;
            showChat();
        } else {
            alert("Raconun kesildi (Kayıt başarılı), şimdi giriş yap!");
        }
    } else {
        alert(data.error || "İşlem başarısız");
    }
}

// 3. CHAT EKRANINI GÖSTER VE SOHBETİ BAŞLAT
async function showChat() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    initPusher();
    switchChat('general'); // Başlangıçta genel odayı yükle
}

// 4. KİŞİ LİSTESİNİ GÜNCELLEME (Online Durumu Dahil)
function updateUserList() {
    const listDiv = document.getElementById('user-list');
    listDiv.innerHTML = `
        <div class="user-item ${activeChat === 'general' ? 'active' : ''}" onclick="switchChat('general')">
            <div class="status-dot online"></div>
            <span class="user-name">🌍 Genel Mevzu</span>
        </div>
    `;

    channel.members.each(member => {
        // info nesnesi yoksa id'yi kullan, o da yoksa 'Gizli Üye' yaz
        const name = (member.info && member.info.username) ? member.info.username : member.id;
        
        if (name !== loggedInUser) {
            const html = `
                <div class="user-item ${activeChat === name ? 'active' : ''}" onclick="switchChat('${name}')">
                    <div class="status-dot online"></div>
                    <span class="user-name">${name}</span>
                </div>`;
            listDiv.insertAdjacentHTML('beforeend', html);
        }
    });
}

// 5. SOHBET DEĞİŞTİRME (GENEL VEYA DM)
async function switchChat(target) {
    activeChat = target;
    document.getElementById('active-chat-title').innerText = target === 'general' ? 'Genel Mevzu' : `👤 ${target}`;
    document.getElementById('chat').innerHTML = '<div class="loading">Yükleniyor...</div>';
    
    // UI Aktiflik Durumu
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));

    try {
        // API'den mesajları çek (DM filtresi ile)
        const url = target === 'general' ? '/api/get-messages' : `/api/get-messages?dm=${target}&user=${loggedInUser}`;
        const res = await fetch(url);
        const oldMsgs = await res.json();
        
        const chatDiv = document.getElementById('chat');
        chatDiv.innerHTML = ''; 
        
        oldMsgs.forEach(m => {
            renderMessage({ 
                user: m.username, 
                text: m.content, 
                id: m.id, 
                file: m.file_url, 
                isImage: m.is_image,
                time: m.created_at,
                target: m.target
            });
        });
    } catch (err) {
        console.error("Mesajlar yüklenemedi:", err);
    }
}

// 6. PUSHER BAĞLANTISI
function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu', 
        authEndpoint: '/api/pusher-auth', 
        auth: { params: { username: loggedInUser } } 
    });

    channel = pusher.subscribe('presence-chat');

    channel.bind('new-message', data => {
        // Mesaj genel ise veya mevcut açık olan DM penceresine aitse render et
        const isDMBetweenUs = (data.user === activeChat && data.target === loggedInUser) || 
                             (data.user === loggedInUser && data.target === activeChat);
        
        if ((data.target === 'general' && activeChat === 'general') || isDMBetweenUs) {
            renderMessage(data);
        } else {
            // Başka birinden DM geldiyse bildirim verebilirsin
            console.log("Yeni bildirim: ", data.user);
        }
    });

    channel.bind('delete-message', data => {
        document.getElementById(`msg-${data.id}`)?.remove();
    });

    // Online Takibi Olayları
    channel.bind('pusher:subscription_succeeded', updateUserList);
    channel.bind('pusher:member_added', updateUserList);
    channel.bind('pusher:member_removed', updateUserList);
}

// 7. MESAJ GÖNDERME
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if(!text) return;

    input.value = '';

    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
            action: 'new', 
            user: loggedInUser, 
            text: text, 
            target: activeChat, // Mesajın nereye gittiğini belirtiyoruz
            id: Date.now().toString() 
        })
    });
}

// 8. EKRANA BASMA (RENDER)
function renderMessage(data) {
    const isOwn = data.user === loggedInUser;
    const chatDiv = document.getElementById('chat');
    
    let contentHtml = data.text;
    if (data.file) {
        contentHtml = data.isImage 
            ? `<img src="${data.file}" style="max-width:100%; border-radius:10px; margin-top:5px;">` 
            : `<a href="${data.file}" target="_blank" style="color:#7226fa;">📁 Dosya İndir</a>`;
    }

    const html = `
        <div class="msg ${isOwn ? 'own' : 'other'}" id="msg-${data.id}">
            ${!isOwn ? `<span class="user-tag" style="color:${stringToColor(data.user)}">${data.user}</span>` : ''}
            <div class="msg-text">${contentHtml}</div>
            <div class="msg-footer">
                <span class="time">${new Date(data.time || Date.now()).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</span>
                ${isOwn ? `<span onclick="deleteMsg('${data.id}')" style="cursor:pointer; margin-left:8px;">🗑️</span>` : ''}
            </div>
        </div>`;

    chatDiv.insertAdjacentHTML('beforeend', html);
    chatDiv.scrollTop = chatDiv.scrollHeight;
}

// YARDIMCI FONKSİYONLAR
function logout() {
    if(confirm("Mevzudan ayrılıyorsun, emin misin?")) {
        localStorage.removeItem('barzoUser');
        location.reload();
    }
}

async function deleteMsg(id) {
    if(confirm("Bu mesajı kökten silelim mi?")) {
        await fetch('/api/send-message', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'delete', id: id })
        });
    }
}

function addEmoji(e) { 
    const input = document.getElementById('msgInput');
    input.value += e; input.focus();
}

function stringToColor(s) {
    let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return `hsl(${Math.abs(h) % 360}, 70%, 75%)`;
}

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        document.body.style.height = window.visualViewport.height + 'px';
        window.scrollTo(0, 0);
        document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
    });
}