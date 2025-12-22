const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "2093942", key: "7c829d72a0184ee33bb3", secret: "56cb48f3ce69e64e61da", cluster: "eu", useTLS: true
});

export default function handler(req, res) {
  // username bazen body'den bazen query'den gelebilir, ikisini de kontrol edelim
  const { socket_id, channel_name } = req.body;
  const username = req.body.username || req.query.username;

  if (!username) {
    return res.status(400).send("Username eksik!");
  }

  const presenceData = {
    user_id: username, // Sayıların yerine ismin gelmesini sağlayan satır
    user_info: { username: username }
  };

  try {
    const auth = pusher.authenticate(socket_id, channel_name, presenceData);
    res.send(auth);
  } catch (error) {
    res.status(403).send("Auth hatası");
  }
}