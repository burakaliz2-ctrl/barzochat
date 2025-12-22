let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) showChat();
    else document.getElementById('auth-screen').style.display = 'flex';
});

async function auth(action) {
    const user = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    if(!user || !pass) return alert("Boş geçme!");

    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action, username: user, password: pass })
    });
    const data = await res.json();
    if (res.ok) {
        if(action === 'login') {
            localStorage.setItem('barzoUser', user);
            location.reload();
        } else alert("Racon kesildi, giriş yap!");
    } else alert(data.error);
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
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}`,
        auth: { params: { username: loggedInUser } }
    });

    presenceChannel = pusher.subscribe('presence-chat');

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);

    presenceChannel.bind('new-message', data => {
        const isGeneral = data.target === 'general' && activeChat === 'general';
        const isDM = (data.user === activeChat && data.target === loggedInUser) || 
                     (data.user === loggedInUser && data.target === activeChat);
        if (isGeneral || isDM) renderMessage(data);
    });
}

function updateUI() {
    const listDiv = document.getElementById('user-list');
    listDiv.innerHTML = `<div class="user-item ${activeChat === 'general' ? 'active' : ''}" onclick="switchChat('general')"><span class="status-dot"></span> 🌍 Genel Mevzu</div>`;
    
    presenceChannel.members.each(m => {
        if (m.id !== loggedInUser && m.id !== "undefined") {
            listDiv.insertAdjacentHTML('beforeend', `
                <div class="user-item ${activeChat === m.id ? 'active' : ''}" onclick="switchChat('${m.id}')">
                    <span class="status-dot"></span> ${m.id}
                </div>`);
        }
    });
    document.getElementById('online-counter').innerText = presenceChannel.members.count;
}

async function switchChat(target) {
    activeChat = target;
    document.getElementById('active-chat-title').innerText = target === 'general' ? 'Genel Mevzu' : `👤 ${target}`;
    document.getElementById('chat').innerHTML = '';
    
    // Mobilde menüyü kapat
    document.getElementById('sidebar').classList.remove('open');
    
    const res = await fetch(`/api/get-messages?dm=${target}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, time: m.created_at, id: m.id }));
    
    updateUI();
}

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if(!text) return;

    const payload = { action: 'new', user: loggedInUser, text, target: activeChat, id: Date.now().toString() };
    input.value = '';
    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
}

function renderMessage(data) {
    const isOwn = data.user === loggedInUser;
    const html = `
        <div class="msg ${isOwn ? 'own' : 'other'}">
            ${!isOwn ? `<span class="user-tag">${data.user}</span>` : ''}
            <div class="msg-text">${data.text}</div>
        </div>`;
    const chat = document.getElementById('chat');
    chat.insertAdjacentHTML('beforeend', html);
    chat.scrollTop = chat.scrollHeight;
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function logout() { localStorage.removeItem('barzoUser'); location.reload(); }
function addEmoji(e) { document.getElementById('msgInput').value += e; }