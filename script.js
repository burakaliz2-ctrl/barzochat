let loggedInUser = localStorage.getItem('barzoUser');
let activeChat = 'general';
let presenceChannel = null;

// 1. MESAJLARI YERELE KAYDETME VE OKUMA
function getLocalMessages() {
    return JSON.parse(localStorage.getItem('barzoMessages')) || [];
}

function saveToLocal(msgData) {
    let msgs = getLocalMessages();
    // Eğer mesaj zaten yoksa ekle (ID kontrolü ile çiftleme engellenir)
    if (!msgs.find(m => m.id === msgData.id)) {
        msgs.push(msgData);
        localStorage.setItem('barzoMessages', JSON.stringify(msgs));
    }
}

// 2. PUSHER BAĞLANTISI (MESAJLARI ALMA)
function initPusher() {
    const pusher = new Pusher('7c829d72a0184ee33bb3', { cluster: 'eu' });
    presenceChannel = pusher.subscribe('presence-chat');
    
    presenceChannel.bind('new-message', d => {
        // Başka cihazdan (veya kendimizden) gelen mesajı yakala
        saveToLocal(d); // Hafızaya at
        
        // Eğer şu an o sohbetteysek ekrana bas
        if (d.target === activeChat || d.target === 'general') {
            renderMessage(d);
        }
    });
}

// 3. MESAJ GÖNDERME (SENİN API'NE GİDER)
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const val = input.value.trim();
    if (!val) return;

    const messageId = "msg-" + Date.now();
    const msgData = { 
        id: messageId, 
        user: loggedInUser, 
        text: val, 
        target: activeChat 
    };

    // Not: Kendi ekranımızda hemen göstermek yerine Pusher'dan gelmesini bekleyebiliriz 
    // ama hız için önce ekrana basıp sonra gönderiyoruz.
    renderMessage(msgData);
    saveToLocal(msgData);
    input.value = '';

    // SUNUCUYA (GET/SEND SCRIPTLERİNE) GÖNDER
    try {
        await fetch('/api/send-message', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(msgData)
        });
    } catch (err) {
        console.error("Mesaj sunucuya iletilemedi:", err);
    }
}

// 4. MESAJI EKRANA BASMA
function renderMessage(data) {
    // Eğer mesaj zaten ekrandaysa tekrar basma
    if (document.getElementById(data.id)) return;

    const isOwn = data.user === loggedInUser;
    const html = `
        <div class="msg ${isOwn ? 'own' : 'other'}" id="${data.id}">
            <small style="display:block; font-size:10px; opacity:0.6;">${data.user}</small>
            <span>${data.text || data.content}</span>
        </div>`;
    
    const chat = document.getElementById('chat');
    chat.insertAdjacentHTML('beforeend', html);
    chat.scrollTop = chat.scrollHeight;
}

// 5. SAYFA AÇILDIĞINDA GEÇMİŞİ YÜKLE
document.addEventListener('DOMContentLoaded', () => {
    if (loggedInUser) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        
        initPusher();
        
        // Cihazın hafızasındaki eski mesajları ekrana dök
        const history = getLocalMessages();
        history.forEach(m => renderMessage(m));
    }
});
