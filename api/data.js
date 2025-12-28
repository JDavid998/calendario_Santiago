import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!process.env.DATABASE_URL) {
        return res.status(500).json({ error: 'Configuración incompleta: Falta DATABASE_URL en Vercel.' });
    }

    // Limpieza agresiva: quitar comillas simples, dobles y espacios al inicio y final
    const connectionString = process.env.DATABASE_URL.replace(/^['"\s]+|['"\s]+$/g, '');

    let sql;
    try {
        sql = neon(connectionString);
    } catch (e) {
        return res.status(500).json({ error: 'Error al inicializar conexión: ' + e.message + ' | URL procesada: ' + connectionString });
    }

    const { action, workspace, email } = req.query;

    try {
        if (action === 'ping') {
            await sql`SELECT 1`;
            return res.status(200).json({ success: true, message: 'Conectado a Neon DB correctamente' });
        }
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
                    INSERT INTO guiones (workspace, fecha, titulo, formato, contenido, plataformas, estado, notas)
                    VALUES (${workspace}, ${g.fecha}, ${g.titulo}, ${g.formato}, ${g.contenido}, ${g.plataformas}, ${g.estado}, ${g.notas})
                `;
            } else if (g.id) { // Update
                await sql`
                    UPDATE guiones 
                    SET fecha = ${g.fecha}, titulo = ${g.titulo}, formato = ${g.formato}, contenido = ${g.contenido}, 
                        plataformas = ${g.plataformas}, estado = ${g.estado}, notas = ${g.notas}
                    WHERE id = ${g.id} AND workspace = ${workspace}
                `;
            } else { // New
                await sql`
                    INSERT INTO guiones (workspace, fecha, titulo, formato, contenido, plataformas, estado, notas)
                    VALUES (${workspace}, ${g.fecha}, ${g.titulo}, ${g.formato}, ${g.contenido}, ${g.plataformas}, ${g.estado}, ${g.notas})
                `;
            }
            return res.status(200).json({ success: true });
        }

        if (action === 'deleteGuion' && req.method === 'DELETE') {
            const { guionId } = req.query;
            await sql`DELETE FROM guiones WHERE id = ${guionId} AND workspace = ${workspace}`;
            return res.status(200).json({ success: true });
        }

        // --- ESTADÍSTICAS ---
        if (action === 'getStatistics') {
            const { month, year } = req.query;

            // Si se pasa mes/año, podríamos filtrar, pero por ahora traemos todo el workspace
            // y filtramos en frontend o hacemos un JOIN inteligente.
            // Para simplificar y dado el volumen bajo, traemos todo del workspace.

            const stats = await sql`SELECT * FROM statistics WHERE workspace = ${workspace}`;
            return res.status(200).json(stats);
        }

        if (action === 'saveStatistic' && req.method === 'POST') {
            const { guionId, platform, metrics } = req.body;

            await sql`
                INSERT INTO statistics (workspace, guion_id, platform, metrics)
                VALUES (${workspace}, ${guionId}, ${platform}, ${metrics})
                ON CONFLICT (workspace, guion_id, platform) 
                DO UPDATE SET metrics = ${metrics}
            `;
            return res.status(200).json({ success: true });
        }

        // --- WORKSPACES ---
        if (action === 'initWorkspaces' && req.method === 'POST') {
            // Crear tabla si no existe e insertar workspaces por defecto
            await sql`
                CREATE TABLE IF NOT EXISTS workspaces (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(50) UNIQUE NOT NULL,
                    display_name VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;

            await sql`
                INSERT INTO workspaces (name, display_name) 
                VALUES 
                    ('personal', 'Personal'),
                    ('maacline', 'MAAC Line')
                ON CONFLICT (name) DO NOTHING
            `;


            await sql`
                CREATE TABLE IF NOT EXISTS statistics (
                    id SERIAL PRIMARY KEY,
                    workspace VARCHAR(50) NOT NULL,
                    guion_id INTEGER REFERENCES guiones(id) ON DELETE CASCADE,
                    platform VARCHAR(50) NOT NULL,
                    metrics JSONB NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(workspace, guion_id, platform)
                )
            `;

            return res.status(200).json({ success: true, message: 'Workspaces y Tablas inicializados' });
        }

        if (action === 'getWorkspaces') {
            const workspaces = await sql`SELECT * FROM workspaces ORDER BY created_at ASC`;
            return res.status(200).json(workspaces);
        }

        if (action === 'createWorkspace' && req.method === 'POST') {
            const { name, display_name } = req.body;

            // Validar que el nombre no esté vacío y sea válido
            if (!name || !display_name) {
                return res.status(400).json({ error: 'Nombre y nombre de visualización son requeridos' });
            }

            // Convertir nombre a formato válido (lowercase, sin espacios)
            const normalizedName = name.toLowerCase().replace(/\s+/g, '_');

            await sql`
                INSERT INTO workspaces (name, display_name)
                VALUES (${normalizedName}, ${display_name})
            `;

            return res.status(200).json({ success: true, name: normalizedName });
        }

        if (action === 'deleteWorkspace' && req.method === 'DELETE') {
            const { workspaceId } = req.query;

            // Prevenir eliminación de workspaces predeterminados
            const workspace = await sql`SELECT name FROM workspaces WHERE id = ${workspaceId}`;
            if (workspace.length > 0 && (workspace[0].name === 'personal' || workspace[0].name === 'maacline')) {
                return res.status(400).json({ error: 'No se pueden eliminar los calendarios predeterminados' });
            }

            await sql`DELETE FROM workspaces WHERE id = ${workspaceId}`;
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Acción no válida' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
