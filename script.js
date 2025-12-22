let userName = localStorage.getItem('chatUser');
if (!userName) {
    userName = prompt("İsim gir:") || "Barzo_" + Math.floor(Math.random()*1000);
    localStorage.setItem('chatUser', userName);
}

const pusher = new Pusher('7c829d72a0184ee33bb3', { 
    cluster: 'eu', authEndpoint: '/api/pusher-auth', auth: { params: { username: userName } }
});
const channel = pusher.subscribe('presence-chat');

// OTURUMU KAPAT
function logout() {
    if(confirm("Çıkış yapmak istediğine emin misin?")) {
        localStorage.removeItem('chatUser');
        location.reload(); // Sayfayı yenile ve tekrar isim sor
    }
}

// DOSYA GÖNDERME
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

// MESAJ ALMA (DOSYA DESTEĞİ EKLENDİ)
channel.bind('new-message', function(data) {
    const isOwn = data.user === userName;
    let content = data.text;

    if (data.file) {
        content = data.isImage 
            ? `<img src="${data.file}" style="max-width:100%; border-radius:10px; cursor:pointer;" onclick="window.open(this.src)">`
            : `<a href="${data.file}" download="${data.text}" style="color:#7226fa; font-weight:bold;">📁 ${data.text} (İndir)</a>`;
    }

    const msgHtml = `
        <div class="msg ${isOwn ? 'own' : 'other'}" id="msg-${data.id}">
            ${!isOwn ? `<span class="user-tag" style="color:${stringToColor(data.user)}">${data.user}</span>` : ''}
            <div class="msg-text">${content}</div>
            <div class="msg-footer">
                <span class="time">${new Date().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</span>
                ${isOwn ? `<div class="actions"><span onclick="deleteMsg('${data.id}')">🗑️</span></div>` : ''}
            </div>
        </div>`;
    document.getElementById('chat').insertAdjacentHTML('beforeend', msgHtml);
    document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
    if(!isOwn) document.getElementById('notifSound').play().catch(()=>{});
});

// ... (Kalan bind/online sayacı ve stringToColor fonksiyonları öncekiyle aynı) ...

async function sendMessage() {
    const input = document.getElementById('msgInput');
    if(!input.value.trim()) return;
    await fetch('/api/send-message', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ action: 'new', user: userName, text: input.value, id: Date.now().toString() })
    });
    input.value = '';
}

function initNotifications() {
    Notification.requestPermission();
    document.getElementById('notifSound').play().then(() => {
        document.getElementById('notify-btn').style.display = 'none';
    });
}

function addEmoji(e) { document.getElementById('msgInput').value += e; }
function stringToColor(s) {
    let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return `hsl(${Math.abs(h) % 360}, 70%, 75%)`;
}
function deleteMsg(id) { fetch('/api/send-message', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action:'delete', id})}); }