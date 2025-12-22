import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
    const { action, username, password } = req.body;

    try {
        if (action === 'register') {
            await db.execute({
                sql: "INSERT INTO users (username, password) VALUES (?, ?)",
                args: [username, password]
            });
            return res.status(200).json({ success: true });
        } else if (action === 'login') {
            const result = await db.execute({
                sql: "SELECT * FROM users WHERE username = ? AND password = ?",
                args: [username, password]
            });
            if (result.rows.length > 0) return res.status(200).json({ user: result.rows[0] });
            else return res.status(401).json({ error: "Hatalı kullanıcı veya şifre" });
        }
    } catch (e) {
        return res.status(500).json({ error: "İşlem başarısız: " + e.message });
    }
}