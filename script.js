let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// EMOJI EKLEME (Kesinlikle Kapatmaz)
function addEmoji(emoji, event) { 
    if(event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const input = document.getElementById('msgInput'); 
    if(input) { 
        input.value += emoji; 
        input.focus(); 
    }
    return false; // Tarayıcı olayını tamamen durdurur
}

// PANEL AÇ/KAPAT
function toggleEmojiPicker(e) { 
    if(e) e.stopPropagation(); 
    const picker = document.getElementById('custom-emoji-picker');
    picker.classList.toggle('show');
}

function hideEmojiPicker() { 
    const picker = document.getElementById('custom-emoji-picker');
    if(picker) picker.classList.remove('show'); 
}

// DIŞARI TIKLAYINCA KAPATMA (Emoji paneli hariç tutuldu)
document.addEventListener('click', (e) => {
    const picker = document.getElementById('custom-emoji-picker');
    const emojiBtn = document.querySelector('.emoji-btn');
    
    if (picker && picker.classList.contains('show')) {
        // Eğer tıklanan yer picker'ın içindeyse HİÇBİR ŞEY YAPMA
        if (picker.contains(e.target) || e.target === emojiBtn) {
            return;
        }
        hideEmojiPicker();
    }
});

// MESAJ GÖNDERME (Sadece burada kapatır)
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input ? input.value.trim() : "";
    if (!val) return;
    
    hideEmojiPicker(); // Mesaj gidince temizlik
    
    const messageId = "msg-" + Date.now();
    renderMessage({ user: loggedInUser, text: val, id: messageId });
    input.value = '';
    
    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'new', user: loggedInUser, text: val, target: activeChat, id: messageId })
    });
}

// SIDEBAR KAYDIRMA
let touchStartX = 0;
document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
document.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    const sidebar = document.getElementById('sidebar');
    if (diff > 70 && touchStartX < 80) sidebar?.classList.add('open');
    if (diff < -70) sidebar?.classList.remove('open');
}, {passive: true});

// DİĞER FONKSİYONLAR (Aynı kalsın)
function toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('open'); }
function closeSidebar() { document.getElementById('sidebar')?.classList.remove('open'); }
async function switchChat(t) {
    activeChat = t; closeSidebar();
    document.getElementById('active-chat-title').innerText = t === 'general' ? 'Genel Mevzu' : `👤 ${t}`;
    document.getElementById('chat').innerHTML = '';
    const res = await fetch(`/api/get-messages?dm=${t}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: "msg-"+m.id }));
}
function renderMessage(data) {
    if (!data.id || document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const html = `<div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">${!isOwn ? `<small style="font-size:10px; color:#a1a1aa; font-weight:bold; display:block;">${data.user}</small>` : ''}<span>${data.text}</span><div class="msg-info"><span class="msg-time">${time}</span>${isOwn ? `<span class="tick">✓✓</span>` : ''}</div></div>`;
    const c = document.getElementById('chat');
    c.insertAdjacentHTML('beforeend', html); c.scrollTop = c.scrollHeight;
}
function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { cluster: 'eu', authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}` });
    presenceChannel = pusher.subscribe('presence-chat');
    presenceChannel.bind('new-message', d => {
        if ((d.target === 'general' && activeChat === 'general') || (d.user === activeChat && d.target === loggedInUser) || (d.user === loggedInUser && d.target === activeChat)) renderMessage(d);
    });
}
function login() { const u = document.getElementById('username').value.trim(); if(u) { localStorage.setItem('barzoUser', u); location.reload(); } }
function showChat() { document.getElementById('auth-screen').style.display='none'; document.getElementById('chat-screen').style.display='flex'; initPusher(); switchChat('general'); }
document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser && loggedInUser !== "undefined") showChat();
    else document.getElementById('auth-screen').style.display = 'flex';
});
