const Pusher = require("pusher");
const pusher = new Pusher({ appId: "2093942", key: "7c829d72a0184ee33bb3", secret: "56cb48f3ce69e64e61da", cluster: "eu", useTLS: true });

export default async function handler(req, res) {
  const { action, user, text, id, file, isImage } = req.body;
  if (action === 'new') {
    await pusher.trigger("presence-chat", "new-message", { user, text, id, file, isImage });
  } else if (action === 'delete') {
    await pusher.trigger("presence-chat", "delete-message", { id });
  }
  res.status(200).json({ ok: true });
}