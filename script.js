let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// 1. MESAJI YERELE KAYDET (Cihazlar arası bağımsız hafıza)
function saveToLocal(msgData) {
    let history = JSON.parse(localStorage.getItem('barzoMessages')) || [];
    if (!history.find(m => m.id === msgData.id)) {
        history.push(msgData);
        localStorage.setItem('barzoMessages', JSON.stringify(history));
    }
}

// 2. PUSHER BAĞLANTISI (Anlık mesaj trafiği)
function initPusher() {
    // API klasöründeki pusher-auth.js hala yetkilendirme için kullanılabilir 
    // veya basit bağlantı kurulabilir.
    const pusher = new Pusher('7c829d72a0184ee33bb3', { cluster: 'eu' });
    presenceChannel = pusher.subscribe('presence-chat');
    
    presenceChannel.bind('new-message', d => {
        saveToLocal(d); // Gelen her mesajı hafızaya at
        
        // Eğer mesaj geneldeyse veya bana özel gelmişse ekrana bas
        if (d.target === 'general' || d.target === loggedInUser || d.user === loggedInUser) {
            renderMessage(d);
        }
    });
}

// 3. MESAJ GÖNDERME (Veritabanı yerine direkt Pusher'a)
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;

    const msgData = { 
        id: "msg-" + Date.now(), 
        user: loggedInUser, 
        text: val, 
        target: activeChat 
    };

    // Mesajı direkt Pusher kanalına tetikle (Client-Event kullanarak)
    // Not: Pusher Client Event için kanal isminin 'private-' veya 'presence-' ile başlaması gerekir.
    if (presenceChannel) {
        presenceChannel.trigger('client-new-message', msgData);
        // Kendi ekranımıza bas ve kaydet
        renderMessage(msgData);
        saveToLocal(msgData);
    }
    
    input.value = '';
}

// Client event dinleyicisi (Pusher trigger için)
// presenceChannel tanımlandıktan sonra eklenir:
// presenceChannel.bind('client-new-message', d => { renderMessage(d); saveToLocal(d); });

function renderMessage(data) {
    if (document.getElementById(data.id)) return;
    const isOwn = data.user === loggedInUser;
    const html = `<div id="${data.id}" class="msg ${isOwn ? 'own' : 'other'}">
        <small style="display:block; font-size:10px; opacity:0.7;">${data.user}</small>
        <span>${data.text}</span>
    </div>`;
    const chat = document.getElementById('chat');
    chat.insertAdjacentHTML('beforeend', html);
    chat.scrollTop = chat.scrollHeight;
}

// 4. BAŞLATMA VE GEÇMİŞ YÜKLEME
document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        initPusher();
        
        // Eski mesajları yerel hafızadan çek (Veritabanı sorgusu yerine)
        const history = JSON.parse(localStorage.getItem('barzoMessages')) || [];
        history.forEach(m => renderMessage(m));
    }
});

function login() {
    const u = document.getElementById('username').value.trim();
    if(u) { localStorage.setItem('barzoUser', u); location.reload(); }
}
