const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "2093942",
  key: "7c829d72a0184ee33bb3",
  secret: "56cb48f3ce69e64e61da",
  cluster: "eu",
  useTLS: true
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { user, text } = req.body;
    
    // Pusher kanalına mesajı tetikle
    await pusher.trigger("chat-channel", "new-message", {
      user: user,
      text: text
    });

    return res.status(200).json({ success: true });
  } else {
    return res.status(405).json({ message: "Sadece POST istekleri kabul edilir." });
  }
}