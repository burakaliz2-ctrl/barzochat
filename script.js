let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let pressTimer;

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser && loggedInUser !== "undefined") showChat();
    else document.getElementById('auth-screen').style.display = 'flex';
});

// MENÜ AÇMA (3 ÇİZGİ)
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

// EMOJİ BUTONU (KLAVYEYİ AÇAR)
function openSystemEmojis() {
    const input = document.getElementById('msgInput');
    if (input) {
        input.focus();
        input.click(); // Bazı mobillerde klavyeyi zorlar
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
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}`
    });

    presenceChannel = pusher.subscribe('presence-chat');

    presenceChannel.bind('new-message', data => {
        const canRender = (data.target === 'general' && activeChat === 'general') || 
                          (data.user === activeChat && data.target === loggedInUser) || 
                          (data.user === loggedInUser && data.target === activeChat);
        if (canRender) {
            renderMessage(data);
            if (data.user === loggedInUser) {
                const tick = document.querySelector(`#${data.id} .tick`);
                if (tick) { tick.innerText = ' ✓✓'; tick.style.color = '#4fc3f7'; }
            }
        }
    });

    presenceChannel.bind('delete-message', data => {
        const el = document.getElementById(data.id);
        if (el) el.remove();
    });

    const updateUI = () => {
        const list = document.getElementById('user-list');
        list.innerHTML = `<div class="user-item ${activeChat==='general'?'active':''}" onclick="switchChat('general')">🌍 Genel Mevzu</div>`;
        presenceChannel.members.each(m => {
            if (m.id && m.id !== "undefined" && m.id !== loggedInUser) {
                list.insertAdjacentHTML('beforeend', `
                    <div class="user-item ${activeChat===m.id?'active':''}" onclick="switchChat('${m.id}')">
                        <span style="color:#22c55e;">●</span> ${m.id}
                    </div>`);
            }
        });
        const counter = document.getElementById('online-counter');
        if(counter) counter.innerText = presenceChannel.members.count;
    };

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
}

// MESAJ SİLME (BASILI TUTMA)
function startPress(id) { pressTimer = setTimeout(() => { if (confirm("Mesajı silmek istiyor musun?")) deleteMessage(id); }, 800); }
function endPress() { clearTimeout(pressTimer); }
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
    const msgId = data.id.startsWith('msg-') ? data.id : 'msg-' + data.id;

    const html = `
        <div id="${msgId}" class="msg ${isOwn ? 'own' : 'other'}" 
             onmousedown="startPress('${msgId}')" onmouseup="endPress()"
             ontouchstart="startPress('${msgId}')" ontouchend="endPress()">
            ${!isOwn ? `<small style="font-size:10px; display:block; opacity:0.7; font-weight:bold;">${data.user}</small>` : ''}
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
    renderMessage({ user: loggedInUser, text: val, target: activeChat, id: messageId });
    input.value = '';
    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'new', user: loggedInUser, text: val, target: activeChat, id: messageId })
    });
}

async function switchChat(t) {
    activeChat = t;
    const title = document.getElementById('active-chat-title');
    if(title) title.innerText = t === 'general' ? 'Genel Mevzu' : `👤 ${t}`;
    document.getElementById('chat').innerHTML = '';
    if(window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    const res = await fetch(`/api/get-messages?dm=${t}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: "msg-"+m.id, isHistory: true }));
}

function logout() { localStorage.removeItem('barzoUser'); location.reload(); }
