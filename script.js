let userName = localStorage.getItem('chatUser') || prompt("İsim gir:") || "Barzo_" + Math.floor(Math.random()*1000);
localStorage.setItem('chatUser', userName);

const pusher = new Pusher('7c829d72a0184ee33bb3', { 
    cluster: 'eu', authEndpoint: '/api/pusher-auth', auth: { params: { username: userName } }
});
const channel = pusher.subscribe('presence-chat');

function initNotifications() {
    Notification.requestPermission();
    document.getElementById('notifSound').play().then(() => {
        document.getElementById('notifSound').pause();
        const btn = document.getElementById('notify-btn');
        btn.innerHTML = "✅ Aktif";
        setTimeout(() => btn.classList.add('hidden-btn'), 1000);
    });
}

async function sendMessage() {
    const input = document.getElementById('msgInput');
    if(!input.value.trim()) return;
    const data = { action: 'new', user: userName, text: input.value, id: Date.now().toString() };
    input.value = '';
    await fetch('/api/send-message', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
}

channel.bind('new-message', function(data) {
    const isOwn = data.user === userName;
    const msgHtml = `
        <div class="msg ${isOwn ? 'own' : 'other'}" id="msg-${data.id}">
            ${!isOwn ? `<span class="user-tag" style="color:${stringToColor(data.user)}">${data.user}</span>` : ''}
            <div class="msg-text">${data.text}</div>
            <div class="msg-footer">
                <span class="time">${new Date().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</span>
                ${isOwn ? `<div class="actions"><span onclick="editMsg('${data.id}')">✏️</span><span onclick="deleteMsg('${data.id}')">🗑️</span></div>` : ''}
            </div>
        </div>`;
    document.getElementById('chat').insertAdjacentHTML('beforeend', msgHtml);
    document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
    if(!isOwn) document.getElementById('notifSound').play().catch(()=>{});
});

channel.bind('delete-message', d => document.getElementById(`msg-${d.id}`)?.remove());
channel.bind('edit-message', d => {
    const el = document.querySelector(`#msg-${d.id} .msg-text`);
    if(el) el.innerText = d.text + " (düzenlendi)";
});

channel.bind('pusher:subscription_succeeded', m => document.getElementById('online-counter').innerText = "Online: " + m.count);
channel.bind('pusher:member_added', () => document.getElementById('online-counter').innerText = "Online: " + channel.members.count);
channel.bind('pusher:member_removed', () => document.getElementById('online-counter').innerText = "Online: " + channel.members.count);

function deleteMsg(id) { if(confirm("Silinsin mi?")) fetch('/api/send-message', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action:'delete', id})}); }
function editMsg(id) { 
    const txt = prompt("Yeni mesaj:"); 
    if(txt) fetch('/api/send-message', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action:'edit', id, text: txt})}); 
}
function addEmoji(e) { document.getElementById('msgInput').value += e; }
function stringToColor(s) {
    let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return `hsl(${Math.abs(h) % 360}, 70%, 75%)`;
}