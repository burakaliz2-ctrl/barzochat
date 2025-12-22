const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "2093942", key: "7c829d72a0184ee33bb3", secret: "56cb48f3ce69e64e61da", cluster: "eu", useTLS: true
});

export default function handler(req, res) {
    const { socket_id, channel_name, username } = req.body;
    
    // Burası çok önemli: user_id olarak senin veritabanındaki ismini gönderiyoruz
    const presenceData = {
        user_id: username, 
        user_info: { name: username }
    };

    try {
        const auth = pusher.authenticate(socket_id, channel_name, presenceData);
        res.send(auth);
    } catch (error) {
        res.status(403).send("Pusher Auth Hatası");
    }
}