let loggedInUser = localStorage.getItem('barzoUser');
let messages = JSON.parse(localStorage.getItem('barzoMessages')) || [];
let users = JSON.parse(localStorage.getItem('barzoUsers')) || [];

// KAYIT OL
function register() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    if (!u || !p) return alert("Bilgileri doldur!");
    
    if (users.find(user => user.username === u)) return alert("Bu kullanıcı zaten var!");
    
    users.push({ username: u, password: p });
    localStorage.setItem('barzoUsers', JSON.stringify(users));
    alert("Kayıt başarılı! Giriş yapabilirsiniz.");
}

// GİRİŞ YAP
function login() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    
    const user = users.find(user => user.username === u && user.password === p);
    
    if (user) {
        localStorage.setItem('barzoUser', u);
        location.reload();
    } else {
        alert("Hatalı kullanıcı adı veya şifre!");
    }
}

function logout() {
    localStorage.removeItem('barzoUser');
    location.reload();
}

// MESAJ GÖNDER VE YERELE KAYDET
function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;

    const newMsg = { user: loggedInUser, text: val, id: Date.now() };
    messages.push(newMsg);
    localStorage.setItem('barzoMessages', JSON.stringify(messages));
    
    renderMessage(newMsg);
    input.value = '';
}

function renderMessage(data) {
    const isOwn = data.user === loggedInUser;
    const html = `<div class="msg ${isOwn ? 'own' : 'other'}">
        <small style="display:block; font-size:10px; opacity:0.7;">${data.user}</small>
        ${data.text}
    </div>`;
    const chat = document.getElementById('chat');
    chat.insertAdjacentHTML('beforeend', html);
    chat.scrollTop = chat.scrollHeight;
}

// BAŞLATMA
document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        // Eski mesajları yükle
        messages.forEach(m => renderMessage(m));
    }
});
