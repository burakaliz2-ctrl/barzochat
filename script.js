let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// Başlangıç Kontrolü
if (loggedInUser) {
    setTimeout(showChat, 100); // DOM'un hazır olması için kısa bir delay
}

async function auth(action) {
    const user = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    if(!user || !pass) return alert("Alanları doldur!");

    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action, username: user, password: pass })
    });
    
    if (res.ok) {
        if(action === 'login') {
            localStorage.setItem('barzoUser', user);
            loggedInUser = user;
            location.reload(); 
        } else {
            alert("Kayıt tamam, şimdi giriş yap!");
        }
    } else {
        const data = await res.json();
        alert(data.error);
    }
}

function showChat() {
    document.getElementById('auth-screen').style.display = 'none';
    const chatScreen = document.getElementById('chat-screen');
    chatScreen.style.display = 'flex';
    
    initPusher();
    switchChat('general');
}

function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu',
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}`
    });

    presenceChannel = pusher.subscribe('presence-chat');

    presenceChannel.bind('new-message', data => {
        // ANLIK MESAJ KONTROLÜ
        const isGeneral = data.target === 'general' && activeChat === 'general';
        const isDM = (data.user === activeChat && data.target === loggedInUser) || 
                     (data.user === loggedInUser && data.target === activeChat);

        if (isGeneral || isDM) {
            renderMessage(data);
        }
    });

    const updateUI = () => {
        const listDiv = document.getElementById('user-list');
        listDiv.innerHTML = `<div class="user-item ${activeChat === 'general' ? 'active' : ''}" onclick="switchChat('general')">🌍 Genel Mevzu</div>`;
        
        presenceChannel.members.each(m => {
            if (m.id !== loggedInUser && m.id !== "undefined") {
                listDiv.insertAdjacentHTML('beforeend', `<div class="user-item ${activeChat === m.id ? 'active' : ''}" onclick="switchChat('${m.id}')">🟢 ${m.id}</div>`);
            }
        });
    };

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
}

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if(!text) return;

    const payload = { 
        action: 'new', 
        user: loggedInUser, 
        text: text, 
        target: activeChat, // Kiminle konuşuyorsak oraya gider
        id: Date.now().toString() 
    };
    
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
        <small style="display:block; font-size:10px; opacity:0.6;">${data.user}</small>
        ${data.text}
    </div>`;
    const chat = document.getElementById('chat');
    chat.insertAdjacentHTML('beforeend', html);
    chat.scrollTop = chat.scrollHeight;
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function logout() { localStorage.removeItem('barzoUser'); location.reload(); }