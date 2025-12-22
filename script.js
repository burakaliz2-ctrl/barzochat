// 1. KULLANICI ADI VE OTURUM YÖNETİMİ
let userName = localStorage.getItem('chatUser');
if (!userName) {
    userName = prompt("Racon için bir isim gir:") || "Barzo_" + Math.floor(Math.random() * 1000);
    localStorage.setItem('chatUser', userName);
}

// 2. PUSHER YAPILANDIRMASI
const pusher = new Pusher('7c829d72a0184ee33bb3', { 
    cluster: 'eu',
    authEndpoint: '/api/pusher-auth',
    auth: { params: { username: userName } }
});

const channel = pusher.subscribe('presence-chat');

// 3. ONLINE SAYACI DÜZELTMESİ
function updateMemberCount() {
    const counterEl = document.getElementById('online-counter');
    if (counterEl && channel.members) {
        counterEl.innerText = channel.members.count;
    }
}

channel.bind('pusher:subscription_succeeded', () => {
    updateMemberCount();
});

channel.bind('pusher:member_added', () => {
    updateMemberCount();
});

channel.bind('pusher:member_removed', () => {
    updateMemberCount();
});

// 4. MESAJ GÖNDERME VE ALMA
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if(!text) return;

    const msgId = Date.now().toString();
    input.value = '';

    await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'new', user: userName, text: text, id: msgId })
    });
}

channel.bind('new-message', function(data) {
    const chatDiv = document.getElementById('chat');
    const isOwn = data.user === userName;
    let content = data.text;

    // Dosya/Resim kontrolü
    if (data.file) {
        content = data.isImage 
            ? `<img src="${data.file}" style="max-width:100%; border-radius:10px; margin-top:5px; cursor:pointer;" onclick="window.open(this.src)">`
            : `<a href="${data.file}" download="${data.text}" style="color:#7226fa; font-weight:bold; display:block; margin-top:5px;">📁 ${data.text} (İndir)</a>`;
    }

    const msgHtml = `
        <div class="msg ${isOwn ? 'own' : 'other'}" id="msg-${data.id}">
            ${!isOwn ? `<span class="user-tag" style="color:${stringToColor(data.user)}">${data.user}</span>` : ''}
            <div class="msg-text">${content}</div>
            <div class="msg-footer">
                <span class="time">${new Date().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</span>
                ${isOwn ? `<div class="actions"><span onclick="deleteMsg('${data.id}')" style="cursor:pointer; margin-left:8px;">🗑️</span></div>` : ''}
            </div>
        </div>`;

    chatDiv.insertAdjacentHTML('beforeend', msgHtml);
    chatDiv.scrollTo({ top: chatDiv.scrollHeight, behavior: 'smooth' });

    if (!isOwn) {
        const audio = document.getElementById('notifSound');
        if(audio) audio.play().catch(() => {});
    }
});

// 5. SİLME VE DÜZENLEME OLAYLARI
channel.bind('delete-message', (data) => {
    document.getElementById(`msg-${data.id}`)?.remove();
});

function deleteMsg(id) {
    if(confirm("Bu mesajı herkesten silmek istediğine emin misin?")) {
        fetch('/api/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id: id })
        });
    }
}

// 6. DOSYA GÖNDERME SİSTEMİ
async function sendFile(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) return alert("Dosya çok büyük! (Max 1MB)");

    const reader = new FileReader();
    reader.onload = async (e) => {
        const fileData = e.target.result;
        await fetch('/api/send-message', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                action: 'new', 
                user: userName, 
                text: file.name, 
                file: fileData, 
                isImage: file.type.startsWith('image/'),
                id: Date.now().toString() 
            })
        });
    };
    reader.readAsDataURL(file);
}

// 7. YARDIMCI FONKSİYONLAR (Çıkış, Emoji, Renk, Bildirim)
function logout() {
    if(confirm("Çıkış yapılıyor?")) {
        localStorage.removeItem('chatUser');
        location.reload();
    }
}

function addEmoji(e) { 
    const input = document.getElementById('msgInput');
    input.value += e; 
    input.focus();
}

function stringToColor(s) {
    let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return `hsl(${Math.abs(h) % 360}, 70%, 75%)`;
}

function initNotifications() {
    Notification.requestPermission();
    const audio = document.getElementById('notifSound');
    audio.play().then(() => {
        audio.pause();
        const btn = document.getElementById('notify-btn');
        btn.innerHTML = "✅ Aktif";
        setTimeout(() => btn.style.display = 'none', 1500);
    }).catch(() => {});
}

// 8. MOBİL KLAVYE FIX
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        document.body.style.height = window.visualViewport.height + 'px';
        window.scrollTo(0, 0);
        const chatDiv = document.getElementById('chat');
        chatDiv.scrollTop = chatDiv.scrollHeight;
    });
}