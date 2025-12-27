// ============================================
// AUTENTICACIÓN OPCIONAL
// ============================================
// Si quieres proteger tu calendario con contraseña,
// copia este código al INICIO de script.js (antes de todo)
// ============================================

const AUTH_CONFIG = {
    enabled: true, // Cambia a true para activar autenticación
    password: 'MiCalendario2024!', // ⚠️ CAMBIA ESTA CONTRASEÑA
    sessionKey: 'calendario_auth'
};

function checkAuthentication() {
    if (!AUTH_CONFIG.enabled) return;

    const isAuthenticated = sessionStorage.getItem(AUTH_CONFIG.sessionKey);

    if (isAuthenticated !== 'true') {
        const password = prompt('🔒 Ingresa la contraseña para acceder al calendario:');

        if (password === AUTH_CONFIG.password) {
            sessionStorage.setItem(AUTH_CONFIG.sessionKey, 'true');
        } else {
            alert('❌ Contraseña incorrecta. Acceso denegado.');
            document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:Inter,sans-serif;"><h1>🔒 Acceso Denegado</h1></div>';
            throw new Error('Authentication failed');
        }
    }
}

// Agregar botón de cerrar sesión
function addLogoutButton() {
    if (!AUTH_CONFIG.enabled) return;

    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = '🔓 Cerrar Sesión';
    logoutBtn.className = 'btn-logout';
    logoutBtn.onclick = () => {
        if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
            sessionStorage.removeItem(AUTH_CONFIG.sessionKey);
            location.reload();
        }
    };

    // Agregar estilos
    const style = document.createElement('style');
    style.textContent = `
        .btn-logout {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 24px;
            background: #E74C3C;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);
            transition: all 0.3s ease;
            z-index: 1000;
        }
        .btn-logout:hover {
            background: #C0392B;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(231, 76, 60, 0.4);
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(logoutBtn);
}

// ============================================
// INSTRUCCIONES DE USO:
// ============================================
// 1. Copia TODO este archivo
// 2. Pégalo al INICIO de script.js (línea 1)
// 3. Cambia AUTH_CONFIG.password por tu contraseña
// 4. Cambia AUTH_CONFIG.enabled a true
// 5. Guarda y prueba
//
// NOTA: Esta es una protección básica. La contraseña
// es visible en el código fuente. Para seguridad real,
// usa Vercel Password Protection (plan Pro).
// ============================================
