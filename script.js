let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// Sayfa ilk yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        showChat();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('chat-screen').style.display = 'none';
    }
});

function showChat() {
    // Giriş ekranını tamamen gizle ve yer kaplamasını engelle
    document.getElementById('auth-screen').style.display = 'none';
    
    // Chat ekranını flex olarak aç
    const chatScreen = document.getElementById('chat-screen');
    chatScreen.style.setProperty('display', 'flex', 'important');
    
    initPusher();
    switchChat('general');
}

async function auth(action) {
    const user = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    if(!user || !pass) return alert("Boş bırakma!");

    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action, username: user, password: pass })
    });
    
    if (res.ok) {
        if(action === 'login') {
            localStorage.setItem('barzoUser', user);
            location.reload(); // Temiz geçiş için en sağlıklısı
        } else {
            alert("Racon kesildi! Şimdi giriş yap.");
        }
    } else {
        const data = await res.json();
        alert(data.error);
    }
}

// initPusher, switchChat ve renderMessage fonksiyonların bir önceki 
// verdiğim halini (target destekli) kullanmaya devam et.
