const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "2093942", key: "7c829d72a0184ee33bb3", secret: "56cb48f3ce69e64e61da", cluster: "eu", useTLS: true
});

export default function handler(req, res) {
    const { socket_id, channel_name } = req.body;
    
    // Kullanıcı adını her yerden ara: Body, Query veya Header
    const username = req.body.username || req.query.username || req.headers['x-user-id'];

    if (!username || username === "null" || username === "undefined") {
        // Eğer hala bulunamadıysa rastgele sayı yerine hata ver ki sorunu anlayalım
        return res.status(403).send("Kullanıcı kimliği doğrulanamadı (Username yok)");
    }

    const presenceData = {
        user_id: username, 
        user_info: { username: username }
    };

    try {
        const auth = pusher.authenticate(socket_id, channel_name, presenceData);
        res.send(auth);
    } catch (error) {
        res.status(403).send("Auth hatası");
    }
}