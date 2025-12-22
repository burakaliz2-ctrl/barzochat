import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
    try {
        const result = await db.execute("SELECT * FROM messages ORDER BY id ASC LIMIT 50");
        res.status(200).json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}