const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "2093942",
  key: "7c829d72a0184ee33bb3",
  secret: "56cb48f3ce69e64e61da",
  cluster: "eu",
  useTLS: true
});

export default async function handler(req, res) {
  const { socket_id, channel_name, username } = req.body;

  // Kullanıcı bilgilerini Pusher'a bildiriyoruz
const presenceData = {
    user_id: username, // benzersiz id
    user_info: { username: username } // script.js'in okuduğu yer
};
const authResponse = pusher.authorizeChannel(socketId, channel, presenceData);
  res.send(auth);
}