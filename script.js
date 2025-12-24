let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let touchStartX = 0;

// 1. MOBİL SWIPE
document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
document.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    const sidebar = document.getElementById('sidebar');
    if (diff > 80 && touchStartX < 60) sidebar.classList.add('open');
    if (diff < -80 && sidebar.classList.contains('open')) sidebar.classList.remove('open');
}, {passive: true});

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// 2. GİRİŞ & ÇIKIŞ
async function handleLogin() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'login', username: u, password: p })
    });
    const data = await res.json();
    if (data.user) {
        localStorage.setItem('barzoUser', data.user.username);
        location.reload();
    } else alert(data.error);
}
function logout() { localStorage.removeItem('barzoUser'); location.reload(); }

// 3. ÖZEL MESAJLAŞMA VE GENEL MESAJ GÖNDERME
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;

    // Mesaj verisini hazırla
    const msgData = { 
        action: 'new', 
        user: loggedInUser, 
        text: val, 
        target: activeChat, // 'general' veya seçilen 'username'
        id: "msg-" + Date.now() 
    };

    input.value = '';

    // API'ye gönder (send-message.js'deki Turso kaydı için)
    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(msgData)
    });
}

// 4. KİŞİ SEÇME VE ESKİ MESAJLARI YÜKLEME
async function switchChat(chatId) {
    activeChat = chatId; // Global değişkeni güncelle
    
    // UI Güncelleme
    document.getElementById('chat').innerHTML = '';
    document.getElementById('active-chat-title').innerText = chatId === 'general' ? 'Genel Mevzu' : `@${chatId}`;
    
    // Sidebar'daki aktif sınıfını güncelle
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    // (UpdateUI içindeki mantık bunu zaten yapacak ama anlık tepki için burada da kalsın)

    // Mesajları Turso'dan çek (get-messages.js)
    const res = await fetch(`/api/get-messages?dm=${chatId}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: m.id, target: m.target }));
    
    if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');
}

// 5. BİLDİRİM VE PUSHER
function showNotification(data) {
    // Sadece başka birinden gelen ve o an açık olmayan sohbetler için bildirim
    if (data.user === loggedInUser) return;
    
    if (Notification.permission === "granted") {
        new Notification(`Barzo Chat: ${data.user}`, {
            body: data.text || data.content,
            icon: '/favicon.ico'
        });
    }
}

function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu',
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}`
    });

    presenceChannel = pusher.subscribe('presence-chat');

    const updateUI = () => {
        const userList = document.getElementById('user-list');
        const counter = document.getElementById('online-counter');
        let html = `<div class="user-item ${activeChat==='general'?'active':''}" onclick="switchChat('general')">🌍 Genel Sohbet</div>`;
        
        presenceChannel.members.each(member => {
            if (member.id !== loggedInUser) {
                html += `<div class="user-item ${activeChat===member.id?'active':''}" onclick="switchChat('${member.id}')">
                    <span class="online-dot"></span> ${member.id}
                </div>`;
            }
        });
        userList.innerHTML = html;
        counter.innerText = presenceChannel.members.count;
    };

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
    
    presenceChannel.bind('new-message', d => {
        // EKRANA BASMA MANTIĞI:
        // 1. Hedef Genel ise ve biz Genel'deysek
        // 2. Mesaj direkt bize gelmişse ve biz o kişiyle konuşuyorsak
        // 3. Mesajı biz göndermişsek (Kendi ekranımızda anlık görmek için)
        const isForMe = (d.target === loggedInUser && activeChat === d.user);
        const isFromMe = (d.user === loggedInUser);
        const isGeneral = (d.target === 'general' && activeChat === 'general');

        if (isGeneral || isForMe || isFromMe) {
            renderMessage(d);
        } else {
            // Eğer farklı bir sohbetten mesaj gelmişse bildirim göster
            showNotification(d);
        }
    });
}

function renderMessage(data) {
    if (document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const html = `<div class="msg ${isOwn ? 'own' : 'other'}" id="${data.id}">
        <small style="display:block; font-size:10px; opacity:0.7;">${data.user}</small>
        ${data.text || data.content}
    </div>`;
    const chatArea = document.getElementById('chat');
    chatArea.insertAdjacentHTML('beforeend', html);
    chatArea.scrollTop = chatArea.scrollHeight;
}

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        
        const msgInput = document.getElementById('msgInput');
        msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

        if ("Notification" in window) Notification.requestPermission();

        initPusher();
        switchChat('general');
    }
});
