-- SQL para Neon DB: Copia y pega esto en la pestaña "SQL Editor" de tu panel de Neon

-- 1. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    can_access TEXT[] -- Permisos: ['personal', 'maacline']
);

-- Insertar el admin por defecto
INSERT INTO users (email, password, role, name, can_access)
VALUES ('asgrmillo@gmail.com', 'Santi15*', 'admin', 'Administrador', ARRAY['personal', 'maacline'])
ON CONFLICT (email) DO NOTHING;

-- 2. Tabla de Notas del Calendario
CREATE TABLE IF NOT EXISTS calendar_notes (
    id SERIAL PRIMARY KEY,
    workspace TEXT NOT NULL,
    date_key TEXT NOT NULL, -- Formato: YYYY-MM-DD
    content TEXT NOT NULL,
    author TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Guiones
CREATE TABLE IF NOT EXISTS guiones (
    id SERIAL PRIMARY KEY,
    workspace TEXT NOT NULL,
    fecha DATE NOT NULL,
    titulo TEXT NOT NULL,
    contenido TEXT,
    plataformas TEXT[],
    estado TEXT,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
