let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// 1. CHAT'İ BAŞLAT
async function showChat() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    initPusher();
    switchChat('general'); 
}

// 2. PUSHER KURULUMU
function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu',
        authEndpoint: '/api/pusher-auth',
        auth: { params: { username: loggedInUser } }
    });

    presenceChannel = pusher.subscribe('presence-chat');

    // ANLIK MESAJ ALMA
    presenceChannel.bind('new-message', (data) => {
        const isGeneral = data.target === 'general' && activeChat === 'general';
        const isDM = (data.user === activeChat && data.target === loggedInUser) || 
                     (data.user === loggedInUser && data.target === activeChat);

        if (isGeneral || isDM) {
            renderMessage(data);
        }
    });

    // KİŞİ LİSTESİ GÜNCELLEME
    const updateList = () => {
        const listDiv = document.getElementById('user-list');
        listDiv.innerHTML = `<div class="user-item ${activeChat === 'general' ? 'active' : ''}" onclick="switchChat('general')">🌍 Genel Mevzu</div>`;
        
        presenceChannel.members.each(member => {
            const name = member.id; // user_id'den geliyor
            if (name !== loggedInUser) {
                const html = `<div class="user-item ${activeChat === name ? 'active' : ''}" onclick="switchChat('${name}')">🟢 ${name}</div>`;
                listDiv.insertAdjacentHTML('beforeend', html);
            }
        });
        document.getElementById('online-counter').innerText = presenceChannel.members.count;
    };

    presenceChannel.bind('pusher:subscription_succeeded', updateList);
    presenceChannel.bind('pusher:member_added', updateList);
    presenceChannel.bind('pusher:member_removed', updateList);
}

// 3. SOHBET DEĞİŞTİRME
async function switchChat(target) {
    activeChat = target;
    document.getElementById('chat').innerHTML = ''; // Temizle
    
    // Eski mesajları Turso'dan çek
    const url = target === 'general' ? '/api/get-messages' : `/api/get-messages?dm=${target}&user=${loggedInUser}`;
    const res = await fetch(url);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, time: m.created_at, target: m.target }));
}

// 4. MESAJ GÖNDERME
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
    const chatDiv = document.getElementById('chat');
    chatDiv.insertAdjacentHTML('beforeend', html);
    chatDiv.scrollTop = chatDiv.scrollHeight;
}