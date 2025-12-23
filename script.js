let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;
let typingTimeout = null;

// GİRİŞ & ÇIKIŞ
function login() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    if (u && p) {
        localStorage.setItem('barzoUser', u);
        location.reload();
    }
}

function logout() {
    localStorage.removeItem('barzoUser');
    location.reload();
}

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
            let width = img.width;
            let height = img.height;
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
            
            const id = "msg-" + Date.now();
            renderMessage({ user: loggedInUser, image: compressedBase64, id: id });
            await fetch('/api/send-message', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ user: loggedInUser, image: compressedBase64, target: activeChat, id: id })
            });
        };
    };
    reader.readAsDataURL(file);
}

// PUSHER VE MESAJLAR
function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu', authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}` 
    });
    presenceChannel = pusher.subscribe('presence-chat');
    
    presenceChannel.bind('new-message', d => {
        if (d.target === 'general' || d.target === loggedInUser || d.user === loggedInUser) {
            renderMessage(d);
            if (d.user !== loggedInUser) showNotification(d);
        }
    });

    presenceChannel.bind('client-typing', d => {
        if (d.user !== loggedInUser && d.target === activeChat) {
            const ind = document.getElementById('typing-indicator');
            ind.innerText = `${d.user} yazıyor...`;
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => ind.innerText = '', 3000);
        }
    });
}

function renderMessage(data) {
    if (data.id && document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    let content = data.text || data.content || "";
    if (data.image) content = `<img src="${data.image}" onclick="window.open(this.src)">`;

    const html = `<div class="${data.id ? '' : ''} msg ${isOwn ? 'own' : 'other'}" id="${data.id || ''}">
        ${!isOwn ? `<small style="display:block; font-size:10px; opacity:0.7; margin-bottom:3px;">${data.user}</small>` : ''}
        ${content}
    </div>`;
    const chat = document.getElementById('chat');
    chat.insertAdjacentHTML('beforeend', html);
    chat.scrollTop = chat.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;
    renderMessage({ user: loggedInUser, text: val });
    input.value = '';
    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user: loggedInUser, text: val, target: activeChat })
    });
}

// BAŞLATMA
document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        initPusher();
    }
    document.getElementById('fileInput')?.addEventListener('change', handleFileUpload);
    document.getElementById('msgInput')?.addEventListener('input', () => {
        if (presenceChannel) presenceChannel.trigger('client-typing', { user: loggedInUser, target: activeChat });
    });
});
