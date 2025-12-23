let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let pressTimer;

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser && loggedInUser !== "undefined") showChat();
    else document.getElementById('auth-screen').style.display = 'flex';
});

// Emoji Butonuna Basınca Klavyeyi Aç
function openSystemEmojis() {
    const input = document.getElementById('msgInput');
    input.focus(); // Klavyeyi tetikler, kullanıcı klavyeden emoji seçer
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
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}`
    });

    presenceChannel = pusher.subscribe('presence-chat');

    presenceChannel.bind('new-message', data => {
        if ((data.target === 'general' && activeChat === 'general') || 
            (data.user === activeChat && data.target === loggedInUser) || 
            (data.user === loggedInUser && data.target === activeChat)) {
            renderMessage(data);
            if (data.user === loggedInUser) {
                const tick = document.querySelector(`#${data.id} .tick`);
                if (tick) { tick.innerText = ' ✓✓'; tick.style.color = '#4fc3f7'; }
            }
        }
    });

    // Mesaj silme olayını dinle
    presenceChannel.bind('delete-message', data => {
        const el = document.getElementById(data.id);
        if (el) el.remove();
    });

    const updateUI = () => {
        const list = document.getElementById('user-list');
        list.innerHTML = `<div class="user-item ${activeChat==='general'?'active':''}" onclick="switchChat('general')">🌍 Genel Mevzu</div>`;
        presenceChannel.members.each(m => {
            if (m.id && m.id !== "undefined" && m.id !== loggedInUser) {
                list.insertAdjacentHTML('beforeend', `<div class="user-item ${activeChat===m.id?'active':''}" onclick="switchChat('${m.id}')">🟢 ${m.id}</div>`);
            }
        });
        document.getElementById('online-counter').innerText = presenceChannel.members.count;
    };

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
}

// MESAJ SİLME (Basılı Tutma Mantığı)
function startPress(id) {
    pressTimer = window.setTimeout(() => {
        if (confirm("Bu mesajı silmek istiyor musun?")) {
            deleteMessage(id);
        }
    }, 800); // 800ms basılı tutunca tetiklenir
}

function endPress() {
    clearTimeout(pressTimer);
}

async function deleteMessage(id) {
    const cleanId = id.replace('msg-', '');
    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'delete', id: cleanId })
    });
}

function renderMessage(data) {
    if (!data.id || !data.text || document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    
    // Mesaj ID'sini 'msg-' formatında ayarla
    const msgId = data.id.startsWith('msg-') ? data.id : 'msg-' + data.id;

    const html = `
        <div id="${msgId}" class="msg ${isOwn ? 'own' : 'other'}" 
             onmousedown="startPress('${msgId}')" onmouseup="endPress()"
             ontouchstart="startPress('${msgId}')" ontouchend="endPress()">
            ${!isOwn ? `<small style="font-size:10px; display:block; opacity:0.7;">${data.user}</small>` : ''}
            <div style="display:flex; align-items:flex-end; gap:5px;">
                <span>${data.text}</span>
                ${isOwn ? `<span class="tick" style="font-size:9px; opacity:0.6;">${data.isHistory ? ' ✓✓' : ' ✓'}</span>` : ''}
            </div>
        </div>`;

    const c = document.getElementById('chat');
    c.insertAdjacentHTML('beforeend', html);
    c.scrollTop = c.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;
    
    const messageId = "msg-" + Date.now();
    const messageData = { action: 'new', user: loggedInUser, text: val, target: activeChat, id: messageId };

    renderMessage(messageData);
    input.value = '';
    input.focus();

    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(messageData)
    });
}

async function switchChat(t) {
    activeChat = t;
    document.getElementById('active-chat-title').innerText = t === 'general' ? 'Genel Mevzu' : `👤 ${t}`;
    document.getElementById('chat').innerHTML = '';
    const res = await fetch(`/api/get-messages?dm=${t}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: "msg-"+m.id, isHistory: true }));
}

function logout() { localStorage.removeItem('barzoUser'); location.reload(); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
