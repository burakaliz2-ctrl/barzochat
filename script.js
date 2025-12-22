// 1. OTURUM VE DEĞİŞKEN BAŞLATMA
let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// Sayfa yüklendiğinde kontrol et
document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        showChat();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('chat-screen').style.display = 'none';
    }
});

// 2. ÜYELİK İŞLEMLERİ (Giriş & Kayıt)
async function auth(action) {
    const username = document.getElementById('auth-user').value.trim();
    const password = document.getElementById('auth-pass').value.trim();
    
    if(!username || !password) return alert("Alanları doldur!");

    try {
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
                location.reload(); // Sayfayı yenileyerek temiz kurulum yap
            } else {
                alert("Racon kesildi! Kayıt başarılı, şimdi giriş yap.");
            }
        } else {
            alert(data.error || "İşlem başarısız");
        }
    } catch (err) {
        alert("Sunucuya bağlanılamadı!");
    }
}

// 3. CHAT EKRANINI GÖSTER VE VERİLERİ YÜKLE
async function showChat() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    
    initPusher();
    switchChat('general'); // İlk açılışta genel odayı yükle
}

// 4. PUSHER BAĞLANTISI VE DİNLEYİCİLER
function initPusher() {
    // Kütüphane kontrolü
    if (typeof Pusher === 'undefined') return console.error("Pusher yüklenemedi!");

    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu',
        authEndpoint: '/api/pusher-auth',
        auth: {
            params: { username: loggedInUser }, // Body için
            headers: { 'x-user-id': loggedInUser } // Header için (Ekstra güvenlik)
        }
    });

    presenceChannel = pusher.subscribe('presence-chat');

    // Yeni mesaj geldiğinde
    presenceChannel.bind('new-message', data => {
        const isGeneral = data.target === 'general' && activeChat === 'general';
        const isDM = (data.user === activeChat && data.target === loggedInUser) || 
                     (data.user === loggedInUser && data.target === activeChat);

        if (isGeneral || isDM) {
            renderMessage(data);
        }
    });

    // Online Listesi ve Sayaç Güncelleme
// script.js içindeki initPusher fonksiyonunun içindeki updateUI kısmını bununla değiştir:
	const updateUI = () => {
    const listDiv = document.getElementById('user-list');
    if (!listDiv) return;

    // Genel odayı her zaman en başa ekle
    listDiv.innerHTML = `
        <div class="user-item ${activeChat === 'general' ? 'active' : ''}" onclick="switchChat('general')">
            <span class="status-dot online"></span> 🌍 Genel Mevzu
        </div>`;
    
    // Online kişileri dön
    presenceChannel.members.each(member => {
        // Eğer member.id undefined ise listeye ekleme
        if (member.id && member.id !== "undefined" && member.id !== loggedInUser) {
            const isSelected = activeChat === member.id ? 'active' : '';
            listDiv.insertAdjacentHTML('beforeend', `
                <div class="user-item ${isSelected}" onclick="switchChat('${member.id}')">
                    <span class="status-dot online"></span> ${member.id}
                </div>`);
        }
    });
};

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
}

// 5. SOHBET DEĞİŞTİRME (GENEL VEYA DM)
async function switchChat(target) {
    activeChat = target;
    document.getElementById('chat').innerHTML = '<div style="padding:20px; color:#aaa;">Yükleniyor...</div>';
    
    // Sidebar'daki aktiflik görselini güncelle
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    
    try {
        const res = await fetch(`/api/get-messages?dm=${target}&user=${loggedInUser}`);
        const oldMsgs = await res.json();
        
        const chatDiv = document.getElementById('chat');
        chatDiv.innerHTML = ''; 
        
        oldMsgs.forEach(m => {
            renderMessage({ 
                user: m.username, 
                text: m.content, 
                time: m.created_at,
                id: m.id
            });
        });
    } catch (err) {
        console.error("Mesajlar yüklenemedi:", err);
    }
}

// 6. MESAJ GÖNDERME
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if(!text) return;

    input.value = ''; // Inputu hemen temizle

    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
            action: 'new', 
            user: loggedInUser, 
            text: text, 
            target: activeChat,
            id: Date.now().toString() 
        })
    });
}

// 7. EKRANA BASMA (RENDER)
function renderMessage(data) {
    const isOwn = data.user === loggedInUser;
    const chatDiv = document.getElementById('chat');
    if(!chatDiv) return;

    const html = `
        <div class="msg ${isOwn ? 'own' : 'other'}" id="msg-${data.id}">
            ${!isOwn ? `<span class="user-tag">${data.user}</span>` : ''}
            <div class="msg-text">${data.text}</div>
            <div class="msg-footer">
                <span class="time">${new Date(data.time || Date.now()).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</span>
            </div>
        </div>`;

    chatDiv.insertAdjacentHTML('beforeend', html);
    chatDiv.scrollTop = chatDiv.scrollHeight;
}

// 8. ÇIKIŞ YAPMA
function logout() {
    if(confirm("Mevzudan ayrılıyorsun, emin misin?")) {
        localStorage.removeItem('barzoUser');
        location.reload();
    }
}

// Emoji ekleme
function addEmoji(e) { 
    const input = document.getElementById('msgInput');
    input.value += e; 
    input.focus();
}