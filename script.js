let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// Sayfa ilk açıldığında oturum kontrolü
if (loggedInUser) {
    showChat();
}

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
                localStorage.setItem('barzoUser', data.user.username);
                loggedInUser = data.user.username;
                location.reload(); // Temiz bir başlangıç için sayfayı yenile
            } else {
                alert("Kayıt başarılı, şimdi giriş yap!");
            }
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert("Bağlantı hatası!");
    }
}

function showChat() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    initPusher();
    switchChat('general');
}

function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu',
        authEndpoint: '/api/pusher-auth',
        auth: { params: { username: loggedInUser } }
    });

    presenceChannel = pusher.subscribe('presence-chat');

    // Online Listesi Güncelleme
    const updateUI = () => {
        const listDiv = document.getElementById('user-list');
        listDiv.innerHTML = `<div class="user-item ${activeChat === 'general' ? 'active' : ''}" onclick="switchChat('general')">🌍 Genel Mevzu</div>`;
        
        presenceChannel.members.each(member => {
            if (member.id !== loggedInUser) {
                listDiv.insertAdjacentHTML('beforeend', `
                    <div class="user-item ${activeChat === member.id ? 'active' : ''}" onclick="switchChat('${member.id}')">
                        <span class="status-dot online"></span> ${member.id}
                    </div>`);
            }
        });
    };

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);

    presenceChannel.bind('new-message', data => {
        if (data.target === activeChat || (data.target === loggedInUser && data.user === activeChat)) {
            renderMessage(data);
        }
    });
}

// Mesaj gönderme fonksiyonu (SendMessage)
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if(!text) return;
    
    const payload = { action: 'new', user: loggedInUser, text: text, target: activeChat };
    input.value = '';

    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
}

function renderMessage(data) {
    const isOwn = data.user === loggedInUser;
    const html = `<div class="msg ${isOwn ? 'own' : 'other'}">
        <small>${data.user}</small>
        <p>${data.text}</p>
    </div>`;
    document.getElementById('chat').insertAdjacentHTML('beforeend', html);
    document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
}