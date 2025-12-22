import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
    const { dm, user } = req.query; // Script'ten gelen parametreler

    try {
        let result;
        if (dm && dm !== 'general') {
            // Özel Mesaj Sorgusu: Ben ona atmışım veya o bana atmış
            result = await db.execute({
                sql: "SELECT * FROM messages WHERE (username = ? AND target = ?) OR (username = ? AND target = ?) ORDER BY id ASC",
                args: [user, dm, dm, user]
            });
        } else {
            // Genel Sohbet Sorgusu
            result = await db.execute("SELECT * FROM messages WHERE target = 'general' ORDER BY id ASC");
        }
        res.status(200).json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}