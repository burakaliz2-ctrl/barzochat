import { createClient } from '@libsql/client';
const Pusher = require("pusher");

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const pusher = new Pusher({
  appId: "2093942", key: "7c829d72a0184ee33bb3", secret: "56cb48f3ce69e64e61da", cluster: "eu", useTLS: true
});

export default async function handler(req, res) {
    const { action, user, text, id, file, isImage, target } = req.body; // target eklendi

    if (action === 'new') {
        // 1. Turso'ya Kaydet (target sütunu ile birlikte)
        await db.execute({
            sql: "INSERT INTO messages (username, content, file_url, is_image, target) VALUES (?, ?, ?, ?, ?)",
            args: [user, text, file || null, isImage ? 1 : 0, target || 'general']
        });

        // 2. Pusher ile Dağıt (target bilgisini mutlaka ekle)
        await pusher.trigger("presence-chat", "new-message", { 
            user, 
            text, 
            id, 
            file, 
            isImage, 
            target: target || 'general' 
        });
    } else if (action === 'delete') {
        await db.execute({ sql: "DELETE FROM messages WHERE id = ?", args: [id] });
        await pusher.trigger("presence-chat", "delete-message", { id });
    }

    res.status(200).json({ ok: true });
}