import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    if (!process.env.DATABASE_URL) {
        return res.status(500).json({ error: 'Falta la variable DATABASE_URL en Vercel. Configúrala en Settings > Environment Variables.' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action, workspace, email } = req.query;

    try {
        // --- USUARIOS ---
        if (action === 'getUsers') {
            const users = await sql`SELECT * FROM users`;
            return res.status(200).json(users);
        }

        if (action === 'saveUser' && req.method === 'POST') {
            const { email, password, role, name, can_access } = req.body;
            await sql`
                INSERT INTO users (email, password, role, name, can_access)
                VALUES (${email}, ${password}, ${role}, ${name}, ${can_access})
                ON CONFLICT (email) DO UPDATE 
                SET password = EXCLUDED.password, role = EXCLUDED.role, name = EXCLUDED.name, can_access = EXCLUDED.can_access
            `;
            return res.status(200).json({ success: true });
        }

        if (action === 'deleteUser' && req.method === 'DELETE') {
            const { targetEmail } = req.query;
            await sql`DELETE FROM users WHERE email = ${targetEmail}`;
            return res.status(200).json({ success: true });
        }

        // --- NOTAS ---
        if (action === 'getNotes') {
            const notes = await sql`SELECT * FROM calendar_notes WHERE workspace = ${workspace}`;
            // Convertir a formato objeto { dateKey: [notes] }
            const formatted = {};
            notes.forEach(n => {
                if (!formatted[n.date_key]) formatted[n.date_key] = [];
                formatted[n.date_key].push({
                    id: n.id,
                    text: n.content,
                    author: n.author
                });
            });
            return res.status(200).json(formatted);
        }

        if (action === 'saveNote' && req.method === 'POST') {
            const { dateKey, text, author } = req.body;
            await sql`
                INSERT INTO calendar_notes (workspace, date_key, content, author)
                VALUES (${workspace}, ${dateKey}, ${text}, ${author})
            `;
            return res.status(200).json({ success: true });
        }

        if (action === 'deleteNote' && req.method === 'DELETE') {
            const { noteId } = req.query;
            await sql`DELETE FROM calendar_notes WHERE id = ${noteId}`;
            return res.status(200).json({ success: true });
        }

        // --- GUIONES ---
        if (action === 'getGuiones') {
            const guiones = await sql`SELECT * FROM guiones WHERE workspace = ${workspace}`;
            return res.status(200).json(guiones.map(g => ({
                ...g,
                fecha: new Date(g.fecha).toISOString().split('T')[0] // Formato YYYY-MM-DD
            })));
        }

        if (action === 'saveGuion' && req.method === 'POST') {
            const g = req.body;
            if (g.id && g.id > 1700000000000) { // Si es un ID temporal de JS, insertar nuevo
                await sql`
                    INSERT INTO guiones (workspace, fecha, titulo, contenido, plataformas, estado, notas)
                    VALUES (${workspace}, ${g.fecha}, ${g.titulo}, ${g.contenido}, ${g.plataformas}, ${g.estado}, ${g.notas})
                `;
            } else if (g.id) { // Update
                await sql`
                    UPDATE guiones 
                    SET fecha = ${g.fecha}, titulo = ${g.titulo}, contenido = ${g.contenido}, 
                        plataformas = ${g.plataformas}, estado = ${g.estado}, notas = ${g.notas}
                    WHERE id = ${g.id} AND workspace = ${workspace}
                `;
            } else { // New
                await sql`
                    INSERT INTO guiones (workspace, fecha, titulo, contenido, plataformas, estado, notas)
                    VALUES (${workspace}, ${g.fecha}, ${g.titulo}, ${g.contenido}, ${g.plataformas}, ${g.estado}, ${g.notas})
                `;
            }
            return res.status(200).json({ success: true });
        }

        if (action === 'deleteGuion' && req.method === 'DELETE') {
            const { guionId } = req.query;
            await sql`DELETE FROM guiones WHERE id = ${guionId} AND workspace = ${workspace}`;
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Acción no válida' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
