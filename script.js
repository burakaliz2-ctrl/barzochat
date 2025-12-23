let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let touchStartX = 0;

// MOBİL KAYDIRMA (SWIPE) [cite: 2025-12-23]
document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
document.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    const sidebar = document.getElementById('sidebar');
    if (diff > 80 && touchStartX < 70) sidebar?.classList.add('open');
    if (diff < -80 && sidebar?.classList.contains('open')) sidebar?.classList.remove('open');
}, {passive: true});

function toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('open'); }

// GİRİŞ VE KAYIT (LOCALSTORAGE)
function register() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    if (u && p) {
        let users = JSON.parse(localStorage.getItem('barzoUsers')) || [];
        if (users.find(x => x.u === u)) return alert("Bu kullanıcı var!");
        users.push({ u, p });
        localStorage.setItem('barzoUsers', JSON.stringify(users));
        alert("Kayıt başarılı!");
    }
}

function login() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    let users = JSON.parse(localStorage.getItem('barzoUsers')) || [];
    if (users.find(x => x.u === u && x.p === p)) {
        localStorage.setItem('barzoUser', u);
        location.reload();
    } else { alert("Hatalı giriş!"); }
}

function logout() { localStorage.removeItem('barzoUser'); location.reload(); }

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
            let width = img.width; let height = img.height;
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
            
            sendMessage(null, compressedBase64);
        };
    };
    reader.readAsDataURL(file);
}

// MESAJ GÖNDERME (HEM LOCAL HEM PUSHER)
async function sendMessage(text = null, image = null) {
    const input = document.getElementById('msgInput');
    const val = text || input.value.trim();
    if (!val && !image) return;

    const msgData = { user: loggedInUser, text: val, image: image, id: "msg-" + Date.now() };
    
    // 1. Ekrana Bas
    renderMessage(msgData);
    // 2. Hafızaya Kaydet
    let msgs = JSON.parse(localStorage.getItem('barzoMessages')) || [];
    msgs.push(msgData);
    localStorage.setItem('barzoMessages', JSON.stringify(msgs));
    
    if (input) input.value = '';

    // 3. Pusher'a Gönder (DİĞER CİHAZ İÇİN)
    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(msgData)
    });
}

function renderMessage(data) {
    if (document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    let content = data.text || "";
    if (data.image) content = `<img src="${data.image}" onclick="window.open(this.src)">`;

    const html = `<div class="msg ${isOwn ? 'own' : 'other'}" id="${data.id}">
        <small style="display:block; font-size:10px; opacity:0.7;">${data.user}</small>
        ${content}
    </div>`;
    const chat = document.getElementById('chat');
    chat.insertAdjacentHTML('beforeend', html);
    chat.scrollTop = chat.scrollHeight;
}

function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { cluster: 'eu' });
    const channel = pusher.subscribe('presence-chat');
    channel.bind('new-message', d => {
        if (d.user !== loggedInUser) {
            renderMessage(d);
            let msgs = JSON.parse(localStorage.getItem('barzoMessages')) || [];
            if(!msgs.find(x => x.id === d.id)) {
                msgs.push(d);
                localStorage.setItem('barzoMessages', JSON.stringify(msgs));
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        initPusher();
        const msgs = JSON.parse(localStorage.getItem('barzoMessages')) || [];
        msgs.forEach(m => renderMessage(m));
    }
    document.getElementById('fileInput')?.addEventListener('change', handleFileUpload);
});
