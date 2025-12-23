let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// SES BİLDİRİMİ
const notifySound = new Audio('https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3');

document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser && loggedInUser !== "undefined") showChat();
    else if (document.getElementById('auth-screen')) document.getElementById('auth-screen').style.display = 'flex';

    // BİLDİRİM İZNİ İSTE
    requestNotificationPermission();

    // ENTER TUŞU İLE GÖNDERME
    const msgInput = document.getElementById('msgInput');
    if (msgInput) {
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // SES KİLİDİNİ AÇMA
    const unlock = () => { 
        notifySound.play().then(() => { 
            notifySound.pause(); 
            notifySound.currentTime = 0; 
        }).catch(e => console.log("Ses hazır değil")); 
        document.removeEventListener('click', unlock);
        document.removeEventListener('touchstart', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
});

// BİLDİRİM İZNİ FONKSİYONU
function requestNotificationPermission() {
    if ("Notification" in window) {
        Notification.requestPermission();
    }
}

// ÜSTTEN BİLDİRİM GÖSTERME
function showTopNotification(data) {
    if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
        const options = {
            body: data.text,
            icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png', // Örnek ikon
            badge: 'https://cdn-icons-png.flaticon.com/512/733/733585.png'
        };
        const n = new Notification(data.user, options);
        n.onclick = () => { window.focus(); n.close(); };
    }
}

function toggleEmojiPicker(e) { e.stopPropagation(); document.getElementById('custom-emoji-picker').classList.toggle('show'); }
function hideEmojiPicker() { document.getElementById('custom-emoji-picker').classList.remove('show'); }
function addEmoji(emoji) { const input = document.getElementById('msgInput'); input.value += emoji; input.focus(); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

function renderMessage(data) {
    if (!data.id || document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const html = `
        <div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">
            ${!isOwn ? `<small style="font-size:10px; color:#a1a1aa; font-weight:bold; margin-bottom:2px;">${data.user}</small>` : ''}
            <span>${data.text}</span>
            <div class="msg-info">
                <span class="msg-time">${time}</span>
                ${isOwn ? `<span class="tick">✓✓</span>` : ''}
            </div>
        </div>`;
    
    const c = document.getElementById('chat');
    c.insertAdjacentHTML('beforeend', html);
    c.scrollTop = c.scrollHeight;
}

function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { 
        cluster: 'eu',
        authEndpoint: `/api/pusher-auth?username=${encodeURIComponent(loggedInUser)}`
    });
    presenceChannel = pusher.subscribe('presence-chat');

    presenceChannel.bind('new-message', data => {
        const isGeneral = data.target === 'general';
        const isDirect = (data.user === activeChat && data.target === loggedInUser) || 
                         (data.user === loggedInUser && data.target === activeChat);
        
        if ((isGeneral && activeChat === 'general') || isDirect) {
            renderMessage(data);
        }

        // BİLDİRİM VE SES (Mesaj başkasından geldiyse)
        if (data.user !== loggedInUser) {
            notifySound.currentTime = 0;
            notifySound.play().catch(() => {});
            showTopNotification(data); // Üstten bildirim göster
        }
    });

    const updateUI = () => {
        const list = document.getElementById('user-list');
        list.innerHTML = `
            <div class="user-item ${activeChat==='general'?'active':''}" onclick="switchChat('general')">
                <span class="online-dot"></span> 🌍 Genel Mevzu
            </div>`;
        
        presenceChannel.members.each(m => {
            if (m.id && m.id !== loggedInUser) {
                list.insertAdjacentHTML('beforeend', `
                    <div class="user-item ${activeChat===m.id?'active':''}" onclick="switchChat('${m.id}')">
                        <span class="online-dot"></span> ${m.id}
                    </div>`);
            }
        });
        document.getElementById('online-counter').innerText = presenceChannel.members.count;
    };

    presenceChannel.bind('pusher:subscription_succeeded', updateUI);
    presenceChannel.bind('pusher:member_added', updateUI);
    presenceChannel.bind('pusher:member_removed', updateUI);
}

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;
    
    hideEmojiPicker();
    const messageId = "msg-" + Date.now();
    renderMessage({ user: loggedInUser, text: val, id: messageId });
    input.value = '';
    
    await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'new', user: loggedInUser, text: val, target: activeChat, id: messageId })
    });
}

async function switchChat(t) {
    activeChat = t;
    document.getElementById('active-chat-title').innerText = t === 'general' ? 'Genel Mevzu' : `👤 ${t}`;
    document.getElementById('chat').innerHTML = '';
    if(window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    
    const res = await fetch(`/api/get-messages?dm=${t}&user=${loggedInUser}`);
    const msgs = await res.json();
    msgs.forEach(m => renderMessage({ user: m.username, text: m.content, id: "msg-"+m.id }));
}

function login() { 
    const u = document.getElementById('username').value.trim(); 
    if(u) { localStorage.setItem('barzoUser', u); location.reload(); } 
}

function logout() { localStorage.removeItem('barzoUser'); location.reload(); }

function showChat() { 
    document.getElementById('auth-screen').style.display='none'; 
    document.getElementById('chat-screen').style.display='flex'; 
    initPusher(); 
    switchChat('general'); 
}
