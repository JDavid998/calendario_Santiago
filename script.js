// ============================================
// CONFIGURACIÓN CENTRAL
// ============================================
const IS_LOCAL_MODE = false;

// ============================================
// SISTEMA DE AUTENTICACIÓN Y ROLES
// ============================================

// Configuración de usuarios
const USERS = {
    'asgrmillo@gmail.com': {
        password: 'Santi15*',
        role: 'admin',
        name: 'Administrador',
        canAccess: ['personal', 'maacline']
    }
};

// Estado de la aplicación
let currentUser = null;
let currentWorkspace = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDay = null;
let calendarNotes = {};
let guiones = [];
let statistics = [];
let globalBusinessStats = {}; // Totales mensuales por workspace
let editingGuionId = null;
let workspaces = []; // Lista de calendarios disponibles

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 [SCRIPT] script.js cargado correctamente');
    console.log('📄 [SCRIPT] Verificando funciones globales...');
    console.log('  - viewGuion:', typeof viewGuion);
    console.log('  - editGuion:', typeof editGuion);
    console.log('  - deleteGuion:', typeof deleteGuion);
    console.log('  - showUserManagement:', typeof showUserManagement);
    console.log('  - showWorkspaceManagement:', typeof showWorkspaceManagement);
    console.log('  - showWorkspaceManagement:', typeof showWorkspaceManagement);

    // Inyectar estilos correctivos y responsivos
    injectCustomStyles();

    checkAuthentication();
});

function injectCustomStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* --- CALENDAR WRAPPING FIX (Desktop & Mobile) --- */
        /* Forzar que el grid respete el ancho disponible y no se expanda por contenido */
        .calendar-grid {
            grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
        }

        /* Hacer que el contenido de texto baje de línea en lugar de ensanchar la celda */
        .day-guion, .day-note {
            white-space: normal !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important; 
            overflow: hidden; /* Seguridad extra */
            max-width: 100%;
        }

        /* --- MOBILE OPTIMIZATION (< 768px) --- */
        @media (max-width: 768px) {
            /* 1. Calendario transformado a lista vertical para legibilidad */
            .calendar-grid {
                display: flex !important;
                flex-direction: column !important;
                gap: 10px;
            }

            /* Ocultar cabeceras de días (Lun, Mar...) ya que ahora es secuencial */
            .day-header {
                display: none !important; 
            }

            .day-cell {
                min-height: auto !important; /* Altura flexible según contenido */
                height: auto !important;
                padding: 15px !important;
            }

            .day-number {
                position: relative !important;
                margin-bottom: 10px;
                font-weight: bold;
                top: auto;
                right: auto;
            }

            /* 2. Gráficas en 1 sola columna */
            #statsChartsGrid, .stats-charts-grid {
                grid-template-columns: 1fr !important;
            }

            /* 3. Ajuste de Tabs para que no se rompan */
            .tabs {
                flex-wrap: wrap;
                gap: 5px;
            }
            .tab-btn {
                flex: 1 1 100px;
                padding: 8px 12px;
                font-size: 0.9rem;
            }

            /* 4. Modales full width */
            .modal-content {
                width: 95% !important;
                margin: 10px auto !important;
                max-height: 90vh;
            }

            /* 5. Ajustes generales de padding */
            .container {
                padding: 10px !important;
            }
            .header-content {
                flex-direction: column;
                align-items: flex-start;
                gap: 15px;
            }
            .header-right {
                width: 100%;
                justify-content: space-between;
                flex-wrap: wrap;
            }
            
            /* Ajuste del selector de workspace más compacto en móvil */
            .workspace-selector-content {
                padding: 20px !important;
                width: 90% !important;
                max-width: 350px !important;
            }
            .workspace-selector h1 {
                font-size: 1.5rem !important;
                margin-bottom: 10px !important;
            }
            .workspace-subtitle {
                font-size: 0.9rem !important;
                margin-bottom: 20px !important;
            }
            .workspace-buttons {
                grid-template-columns: 1fr !important;
                gap: 15px !important;
            }
            .workspace-btn {
                padding: 15px !important;
                flex-direction: row !important; /* Icono al lado del texto en vez de arriba para ahorrar espacio vertical */
                align-items: center !important;
                text-align: left !important;
                gap: 15px !important;
            }
            .workspace-btn img, .workspace-btn svg.workspace-icon {
                width: 40px !important;
                height: 40px !important;
                margin-bottom: 0 !important; /* Quitar margen inferior porque ahora está al lado */
            }
            .workspace-name {
                font-size: 1.1rem !important;
            }
            .workspace-desc {
                font-size: 0.8rem !important;
            }
            
            /* Ajuste de filtros */
            .guiones-controls {
                flex-direction: column;
                align-items: stretch;
            }
            .filter-select, #addGuionBtn {
                width: 100%;
            }
        }
    `;
    document.head.appendChild(style);
}

// Verificar autenticación
async function checkAuthentication() {
    const savedUser = sessionStorage.getItem('currentUser');

    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        await loadWorkspaces(); // Cargar calendarios disponibles
        checkWorkspace();
    } else {
        showLoginScreen();
    }
}

// Mostrar pantalla de login
function showLoginScreen() {
    document.getElementById('loginScreen').classList.add('active');
}

// Procesar login
async function processLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginError');

    if (!username || !password) {
        errorMsg.textContent = 'Por favor completa todos los campos';
        errorMsg.style.display = 'block';
        return;
    }

    try {
        const response = await fetch('/api/data?action=getUsers');

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Error del servidor');
        }

        const usersList = await response.json();

        // Convertir array de DB a objeto para compatibilidad
        const users = {};
        usersList.forEach(u => {
            users[u.email] = {
                password: u.password,
                role: u.role,
                name: u.name,
                canAccess: u.can_access || []
            };
        });

        const user = users[username];

        if (!user || user.password !== password) {
            errorMsg.textContent = 'Usuario o contraseña incorrectos';
            errorMsg.style.display = 'block';
            return;
        }

        // Login exitoso
        currentUser = user;
        currentUser.email = username; // Guardar email para referencia
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));

        document.getElementById('loginScreen').classList.remove('active');
        await loadWorkspaces(); // Cargar calendarios disponibles
        checkWorkspace();
    } catch (e) {
        console.error("Error en login:", e);

        // Mostrar mensaje de error general
        errorMsg.style.display = 'block';
        errorMsg.innerHTML = `Error: ${e.message}<br><small>(Si estás en local, usa el botón de abajo)</small>`;

        // Botón explícito para activar modo local
        // Mostramos el botón siempre que falle para facilitar pruebas
        const btnLocal = document.createElement('button');
        btnLocal.type = 'button'; // Evitar submit
        btnLocal.className = 'btn-secondary';
        btnLocal.style.marginTop = '15px';
        btnLocal.style.width = '100%';
        btnLocal.style.background = '#f59e0b';
        btnLocal.style.color = '#fff';
        btnLocal.style.border = 'none';
        btnLocal.style.fontWeight = 'bold';
        btnLocal.innerHTML = '🛠️ ACTIVAR MODO LOCAL';

        btnLocal.onclick = async (evt) => {
            evt.preventDefault();
            if (!confirm('¿Activar modo local? Tus datos se guardarán solo en este navegador (temporalmente).')) return;

            IS_LOCAL_MODE = true;
            sessionStorage.setItem('IS_LOCAL_MODE', 'true');

            // Usuario Mock
            currentUser = {
                email: 'admin@local.com',
                name: 'Admin Local',
                role: 'admin',
                canAccess: ['personal', 'maacline']
            };
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));

            document.getElementById('loginScreen').classList.remove('active');
            await loadWorkspaces();
            checkWorkspace();
        };

        // Evitar duplicar botones si el usuario hace click varias veces
        const existingBtn = errorMsg.querySelector('button');
        if (existingBtn) existingBtn.remove();

        errorMsg.appendChild(btnLocal);
    }
}

// Obtener usuarios del servidor
async function getUsersFromStorage() {
    try {
        const response = await fetch('/api/data?action=getUsers');
        const usersList = await response.json();
        const users = {};
        usersList.forEach(u => {
            users[u.email] = {
                password: u.password,
                role: u.role,
                name: u.name,
                canAccess: u.can_access || []
            };
        });
        return users;
    } catch (e) {
        console.error("Error al cargar usuarios:", e);
        return USERS;
    }
}

// Guardar usuario en el servidor
async function saveUsersToStorage(users, newUser = null) {
    if (!newUser) return; // En este nuevo sistema guardamos de a uno

    try {
        await fetch('/api/data?action=saveUser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: newUser.email,
                password: newUser.password,
                role: newUser.role,
                name: newUser.name,
                can_access: newUser.canAccess
            })
        });
    } catch (e) {
        console.error("Error al guardar usuario:", e);
    }
}

// Probar conexión a la DB
async function testConnection() {
    const errorMsg = document.getElementById('loginError');
    errorMsg.style.display = 'block';
    errorMsg.textContent = 'Probando conexión...';
    errorMsg.style.color = 'var(--primary-light)';

    try {
        const response = await fetch('/api/data?action=ping');

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Error del servidor');
        }

        const data = await response.json();

        if (data.success) {
            errorMsg.textContent = '✅ ' + data.message;
            errorMsg.style.color = '#4ade80';
        }
    } catch (e) {
        errorMsg.textContent = '❌ ' + e.message;
        errorMsg.style.color = '#ff4444';
    }
}

// Cerrar sesión
function logout() {
    currentUser = null;
    currentWorkspace = null;
    calendarNotes = {};
    guiones = [];
    statistics = [];
    globalBusinessStats = {}; // Reset global stats

    document.getElementById('mainContainer').style.display = 'none'; // Changed from 'app' to 'mainContainer' to match existing code
    document.getElementById('loginScreen').classList.add('active');
    // Assuming there's a loginForm element, otherwise this line might cause an error
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.reset();
    }
    sessionStorage.removeItem('currentUser'); // Added back sessionStorage cleanup
    sessionStorage.removeItem('currentWorkspace'); // Added back sessionStorage cleanup
}

// Cargar workspaces desde la base de datos
async function loadWorkspaces() {
    if (IS_LOCAL_MODE) {
        const saved = localStorage.getItem('local_workspaces');
        workspaces = saved ? JSON.parse(saved) : [
            { name: 'personal', display_name: 'Personal' },
            { name: 'maacline', display_name: 'MAAC Line' }
        ];
        return;
    }

    try {
        // Inicializar workspaces si no existen
        await fetch('/api/data?action=initWorkspaces', {
            method: 'POST'
        });

        // Cargar lista de workspaces
        const response = await fetch('/api/data?action=getWorkspaces');
        if (response.ok) {
            workspaces = await response.json();
        } else {
            console.error('Error al cargar workspaces');
            workspaces = [
                { name: 'personal', display_name: 'Personal' },
                { name: 'maacline', display_name: 'MAAC Line' }
            ];
        }
    } catch (e) {
        console.error('Error al cargar workspaces:', e);
        workspaces = [
            { name: 'personal', display_name: 'Personal' },
            { name: 'maacline', display_name: 'MAAC Line' }
        ];
    }
}

// Verificar si hay un workspace seleccionado
function checkWorkspace() {
    const savedWorkspace = sessionStorage.getItem('currentWorkspace');

    // Admin tiene acceso siempre, o verificar permisos del usuario
    if (savedWorkspace && (currentUser.role === 'admin' || currentUser.canAccess.includes(savedWorkspace))) {
        currentWorkspace = savedWorkspace;
        initializeApp();
    } else {
        showWorkspaceSelector();
    }
}

// Mostrar selector de workspace
function showWorkspaceSelector() {
    const selector = document.getElementById('workspaceSelector');
    const buttonsContainer = selector.querySelector('.workspace-buttons');

    // Limpiar botones existentes
    buttonsContainer.innerHTML = '';

    // Filtrar workspaces a los que el usuario tiene acceso
    // Si es admin, mostrar todos. Si es cliente, filtrar por permisos.
    const accessibleWorkspaces = currentUser.role === 'admin'
        ? workspaces
        : workspaces.filter(ws => currentUser.canAccess.includes(ws.name));

    // Crear botones dinámicamente
    accessibleWorkspaces.forEach(ws => {
        const button = document.createElement('button');
        button.className = `workspace-btn ${ws.name}`;
        button.dataset.workspace = ws.name;
        button.onclick = () => selectWorkspace(ws.name);

        // Icono (usar diferentes iconos según el workspace)
        let icon;
        if (ws.logo) {
            icon = `<img src="${ws.logo}" alt="${ws.display_name}" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; margin-bottom: 15px;">`;
        } else {
            icon = ws.name === 'personal'
                ? `<svg class="workspace-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
               </svg>`
                : `<svg class="workspace-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
               </svg>`;
        }

        button.innerHTML = `
            ${icon}
            <div class="workspace-name">${ws.display_name}</div>
            <div class="workspace-desc">Calendario ${ws.display_name.toLowerCase()}</div>
        `;
        button.style.position = 'relative'; // Ensure positioning context

        buttonsContainer.appendChild(button);
    });

    selector.classList.add('active');
}

// Seleccionar workspace
function selectWorkspace(workspace) {
    if (currentUser.role !== 'admin' && !currentUser.canAccess.includes(workspace)) {
        alert('No tienes acceso a este calendario');
        return;
    }

    currentWorkspace = workspace;
    sessionStorage.setItem('currentWorkspace', workspace);
    document.getElementById('workspaceSelector').classList.remove('active');
    // Refrescar la página para asegurar estado limpio
    location.reload();
}

// Cambiar workspace
function changeWorkspace() {
    if (confirm('¿Estás seguro de que quieres cambiar de calendario? Los datos actuales se guardarán automáticamente.')) {
        currentWorkspace = null;
        sessionStorage.removeItem('currentWorkspace');

        // Limpiar estado actual
        // Limpiar estado actual
        calendarNotes = {};
        guiones = [];
        statistics = [];
        globalBusinessStats = {};

        // Refrescar página para volver al selector limpio
        location.reload();
    }
}

// Inicializar la aplicación
async function initializeApp() {
    console.log('🚀 [INIT] Iniciando aplicación...');
    await loadData();
    initializeControls();
    initializeTabs();
    initializeModals();
    renderCalendar();
    renderGuiones();
    setCurrentMonthYear();
    updateWorkspaceTitle();
    updateUserInfo();

    // Mostrar el contenedor principal
    document.getElementById('mainContainer').style.display = 'block';
    console.log('✅ [INIT] Aplicación inicializada correctamente');
}

// Cargar datos del servidor
async function loadData() {
    if (IS_LOCAL_MODE) {
        calendarNotes = JSON.parse(localStorage.getItem(`local_notes_${currentWorkspace}`) || '{}');
        guiones = JSON.parse(localStorage.getItem(`local_guiones_${currentWorkspace}`) || '[]');
        statistics = JSON.parse(localStorage.getItem(`local_stats_${currentWorkspace}`) || '[]');
        globalBusinessStats = JSON.parse(localStorage.getItem(`local_globalStats_${currentWorkspace}`) || '{}');
        return;
    }

    try {
        // Cargar Notas
        const notesRes = await fetch(`/api/data?action=getNotes&workspace=${currentWorkspace}`);
        calendarNotes = await notesRes.json();

        // Cargar Guiones
        const guionesRes = await fetch(`/api/data?action=getGuiones&workspace=${currentWorkspace}`);
        if (guionesRes.ok) {
            guiones = await guionesRes.json();
        } else {
            guiones = [];
        }

        // Cargar Estadísticas
        const statsRes = await fetch(`/api/data?action=getStatistics&workspace=${currentWorkspace}`);
        if (statsRes.ok) {
            statistics = await statsRes.json();
        } else {
            statistics = [];
        }

        // Cargar Global Business Stats
        const globalStatsRes = await fetch(`/api/data?action=getGlobalStats&workspace=${currentWorkspace}`);
        if (globalStatsRes.ok) {
            globalBusinessStats = await globalStatsRes.json();
        } else {
            globalBusinessStats = {};
        }

    } catch (e) {
        console.error('Error loading data:', e);
        if (IS_LOCAL_MODE) return;
        alert('Error cargando datos del servidor');
        // Fallback a local si falla server
        calendarNotes = JSON.parse(localStorage.getItem(`local_notes_${currentWorkspace}`) || '{}');
        guiones = JSON.parse(localStorage.getItem(`local_guiones_${currentWorkspace}`) || '[]');
        statistics = JSON.parse(localStorage.getItem(`local_stats_${currentWorkspace}`) || '[]');
        globalBusinessStats = JSON.parse(localStorage.getItem(`local_globalStats_${currentWorkspace}`) || '{}');
    }
}

// Actualizar información del usuario
function updateUserInfo() {
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role === 'admin' ? 'Administrador' : 'Cliente';

    // Mostrar botones de gestión solo para admin
    if (currentUser.role === 'admin') {
        document.getElementById('btnUserManagement').style.display = 'flex';
        const btnWorkspaces = document.getElementById('btnWorkspaceManagement');
        if (btnWorkspaces) {
            btnWorkspaces.style.display = 'flex';

            // NUCLEAR: Agregar event listener directo
            btnWorkspaces.onclick = function () {
                console.log('🚀 Botón Gestionar Calendarios clickeado');
                try {
                    renderWorkspacesList();
                    openModal('workspaceManagementModal');
                    if (!window.workspaceModalsInitialized) {
                        initializeWorkspaceModals();
                        window.workspaceModalsInitialized = true;
                    }
                    console.log('✅ Modal abierto exitosamente');
                } catch (e) {
                    console.error('❌ Error al abrir modal:', e);
                    alert('Error al abrir el modal: ' + e.message);
                }
            };
        }
    }
}

// Actualizar título del workspace
function updateWorkspaceTitle() {
    let workspaceName = currentWorkspace;

    // Buscar nombre para mostrar en la lista de workspaces
    if (window.workspaces) {
        const ws = window.workspaces.find(w => w.name === currentWorkspace);
        if (ws) workspaceName = ws.display_name;
    } else {
        // Fallback para nombres conocidos si workspaces no ha cargado
        const workspaceNames = {
            'personal': 'Personal',
            'maacline': 'MAAC Line'
        };
        workspaceName = workspaceNames[currentWorkspace] || currentWorkspace;
    }

    document.getElementById('workspaceName').textContent = workspaceName;
}



// Establecer mes y año actual en los controles
function setCurrentMonthYear() {
    document.getElementById('monthSelect').value = currentMonth;
    document.getElementById('yearSelect').value = currentYear;
}

// Inicializar controles del calendario
function initializeControls() {
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');
    const todayBtn = document.getElementById('todayBtn');

    monthSelect.addEventListener('change', (e) => {
        currentMonth = parseInt(e.target.value);
        renderCalendar();
    });

    yearSelect.addEventListener('change', (e) => {
        currentYear = parseInt(e.target.value);
        renderCalendar();
    });

    todayBtn.addEventListener('click', () => {
        const today = new Date();
        currentMonth = today.getMonth();
        currentYear = today.getFullYear();
        setCurrentMonthYear();
        renderCalendar();
    });
}

// Inicializar sistema de tabs
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            // Remover active de todos
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Agregar active al seleccionado
            btn.classList.add('active');
            document.getElementById(targetTab).classList.add('active');

            // Si se abre la pestaña de guiones, sincronizar el filtro con el mes actual
            if (targetTab === 'guiones') {
                document.getElementById('filterMonth').value = currentMonth;
                renderGuiones();
            }
            // Si se abre la pestaña de estadísticas, renderizar
            if (targetTab === 'estadisticas') {
                document.getElementById('statsFilterMonth').value = currentMonth;
                renderStatisticsUI();
            }
        });
    });
}

// Inicializar modales
function initializeModals() {
    console.log('🔧 [MODALS] Inicializando modales...');
    // Modal de día
    const dayModal = document.getElementById('dayModal');
    const closeBtns = dayModal.querySelectorAll('.modal-close');
    const saveDayBtn = document.getElementById('saveDayBtn');
    const deleteDayBtn = document.getElementById('deleteDayBtn');

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal('dayModal');
        });
    });

    // closeBtns.forEach(btn => { ... }) ya inicializado en initializeModals


    // Modal de guión
    const guionModal = document.getElementById('guionModal');
    const closeGuionBtns = guionModal.querySelectorAll('.modal-close-guion');
    const addGuionBtn = document.getElementById('addGuionBtn');
    const saveGuionBtn = document.getElementById('saveGuionBtn');

    closeGuionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal('guionModal');
            resetGuionForm();
        });
    });

    addGuionBtn.addEventListener('click', () => {
        editingGuionId = null;
        resetGuionForm();
        document.getElementById('guionModalTitle').textContent = 'Nuevo Guión';
        openModal('guionModal');
    });

    saveGuionBtn.addEventListener('click', saveGuion);

    // Filtros de guiones
    const filterMonth = document.getElementById('filterMonth');
    const filterYear = document.getElementById('filterYear');
    const filterPlatform = document.getElementById('filterPlatform');

    if (filterMonth) filterMonth.addEventListener('change', renderGuiones);
    if (filterYear) filterYear.addEventListener('change', renderGuiones);
    if (filterPlatform) filterPlatform.addEventListener('change', renderGuiones);

    // Cerrar modal al hacer clic fuera
    dayModal.addEventListener('click', (e) => {
        if (e.target === dayModal) {
            closeModal('dayModal');
        }
    });

    guionModal.addEventListener('click', (e) => {
        if (e.target === guionModal) {
            closeModal('guionModal');
            resetGuionForm();
        }
    });

    // Modal de vista de guión
    const viewGuionModal = document.getElementById('viewGuionModal');
    const closeViewBtns = viewGuionModal.querySelectorAll('.modal-close-view-guion');

    closeViewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal('viewGuionModal');
        });
    });

    viewGuionModal.addEventListener('click', (e) => {
        if (e.target === viewGuionModal) {
            closeModal('viewGuionModal');
        }
    });

    // Eventos del editor de script
    const formatoSelect = document.getElementById('guionFormato');
    if (formatoSelect) {
        formatoSelect.addEventListener('change', (e) => {
            const formato = e.target.value;
            initScriptEditor(formato);
        });
    }

    // Evento: Añadir fila
    const addRowBtn = document.getElementById('addRowBtn');
    if (addRowBtn) {
        addRowBtn.addEventListener('click', () => {
            const formato = document.getElementById('guionFormato').value;
            addScriptRow(formato);
        });
    }

    // Modal de Estadísticas - Inicialización
    const statsModal = document.getElementById('statsModal');
    if (statsModal) {
        const closeStatsBtns = statsModal.querySelectorAll('.modal-close-stats');
        const saveStatsBtn = document.getElementById('saveStatsBtn');

        closeStatsBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                closeModal('statsModal');
            });
        });

        statsModal.addEventListener('click', (e) => {
            if (e.target === statsModal) {
                closeModal('statsModal');
            }
        });

        if (saveStatsBtn) saveStatsBtn.addEventListener('click', saveStatistics);

        // Filtro de estadísticas
        const statsFilter = document.getElementById('statsFilterMonth');
        if (statsFilter) statsFilter.addEventListener('change', renderStatisticsUI);
    }
}


// ============================================
// GESTIÓN CENTRALIZADA DE MODALES
// ============================================



// ============================================
// GESTIÓN CENTRALIZADA DE MODALES (NUCLEAR OPTION)
// ============================================

function openModal(modalId) {
    console.log(`☢️ [MODAL NUCLEAR] Intentando abrir modal: ${modalId}`);

    // 1. OBTENER EL MODAL
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error(`❌ [MODAL] No se encontró el modal: ${modalId}`);
        return;
    }

    // 2. CERRAR TODOS LOS OTROS MODALES
    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(m => {
        if (m.id !== modalId) {
            m.classList.remove('active');
            m.style.display = 'none';
        }
    });

    // 3. MOVER EL MODAL AL BODY (Para evitar problemas de stacking context)
    document.body.appendChild(modal);

    // 4. FORZAR ESTILOS INLINE AGRESIVOS (NUCLEAR)
    // Reseteamos cualquier estilo previo que pueda estar causando problemas
    modal.style.cssText = `
        display: flex !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background-color: rgba(0, 0, 0, 0.7) !important;
        z-index: 2147483647 !important; /* Max Z-Index seguro */
        justify-content: center !important;
        align-items: flex-start !important;
        padding-top: 50px !important;
        opacity: 1 !important;
        visibility: visible !important;
    `;

    // 5. AGREGAR CLASE ACTIVE (Por si acaso se usa para selectores internos)
    modal.classList.add('active');

    console.log(`✅ [MODAL NUCLEAR] Modal ${modalId} movido al body y forzado visible con estilos inline.`);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        // Limpiamos el cssText agresivo para que no interfiera si se vuelve a abrir (aunque se reescribirá)
        // Pero mantenemos display none
        modal.style.display = 'none';
    }
}


// Renderizar calendario
function renderCalendar() {
    const calendarGrid = document.querySelector('.calendar-grid');

    // Limpiar días anteriores (mantener headers)
    const dayCells = calendarGrid.querySelectorAll('.day-cell');
    dayCells.forEach(cell => cell.remove());

    // Obtener información del mes
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;

    // Agregar celdas vacías antes del primer día
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-cell empty';
        calendarGrid.appendChild(emptyCell);
    }

    // Agregar días del mes
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        const dayOfWeek = (firstDay + day - 1) % 7;
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isToday = isCurrentMonth && day === today.getDate();

        dayCell.className = 'day-cell';
        if (isWeekend) dayCell.classList.add('weekend');
        if (isToday) dayCell.classList.add('today');

        const dateKey = `${currentYear}-${currentMonth}-${day}`;
        let notes = calendarNotes[dateKey];

        // MIGRACIÓN Y PROTECCIÓN
        if (typeof notes === 'string') {
            notes = [{ id: Date.now(), text: notes, author: 'Sistema' }];
            calendarNotes[dateKey] = notes;
        } else if (!Array.isArray(notes)) {
            notes = [];
        }

        // Buscar guiones para este día
        const dayGuiones = guiones.filter(guion => {
            if (!guion.fecha || typeof guion.fecha !== 'string') return false;

            try {
                // Parsear la fecha correctamente (formato YYYY-MM-DD)
                const parts = guion.fecha.split('-');
                if (parts.length !== 3) return false;

                const [year, month, dayNum] = parts.map(Number);
                return dayNum === day &&
                    (month - 1) === currentMonth &&
                    year === currentYear;
            } catch (e) {
                console.warn('Error parsing guion date:', guion);
                return false;
            }
        });

        // Determinar qué mostrar
        let contentHTML = '';

        // Renderizar Guiones con colores por tipo
        if (dayGuiones.length > 0) {
            dayCell.classList.add('has-guion');

            // Definir colores por tipo de guion
            const colorMap = {
                'Reel': '#e1306c',           // Rosa/Magenta de Instagram
                'Carrusel': '#f59e0b',       // Naranja
                'Historia': '#8b5cf6',       // Morado/Violeta
                'Guion': '#14b8a6'          // Teal (por si hay tipo genérico)
            };

            dayGuiones.forEach(g => {
                const iconColor = colorMap[g.formato] || '#14b8a6'; // Default teal
                const iconClass = g.formato === 'Reel' ? '🎬' :
                    g.formato === 'Carrusel' ? '📸' :
                        g.formato === 'Historia' ? '📖' : '📝';

                contentHTML += `<div class="day-guion" style="color: ${iconColor};">${iconClass} ${g.titulo}</div>`;
            });
        }

        // Renderizar Notas
        if (notes.length > 0) {
            dayCell.classList.add('has-note');

            // Si hay guiones, separar con línea
            if (contentHTML) {
                contentHTML += `<div style="border-top: 1px solid var(--border-color); margin: 4px 0;"></div>`;
            }

            // Mostrar hasta 3 notas truncadas
            const notesHTML = notes.slice(0, 3).map(n =>
                `<div class="day-note">• ${n.text}</div>`
            ).join('');

            contentHTML += notesHTML;

            if (notes.length > 3) {
                contentHTML += `<div class="more-notes">+${notes.length - 3} más</div>`;
            }
        }

        // Crear estructura del día con botón de agregar en hover
        dayCell.innerHTML = `
            <div class="day-number">${day}</div>
            ${contentHTML ? `<div class="day-content">${contentHTML}</div>` : ''}
            <button class="add-note-btn" title="Agregar nota">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            </button>
        `;

        // Agregar evento al botón de agregar
        const addBtn = dayCell.querySelector('.add-note-btn');
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar que se abra el modal del día
            openDayModal(day);
        });

        // Evento para abrir modal al hacer clic en el día (pero no en el botón)
        dayCell.addEventListener('click', (e) => {
            if (!e.target.closest('.add-note-btn')) {
                openDayModal(day);
            }
        });

        calendarGrid.appendChild(dayCell);
    }
}

// Abrir modal de día
function openDayModal(day) {
    selectedDay = day;
    const dateKey = `${currentYear}-${currentMonth}-${day}`;
    let notes = calendarNotes[dateKey];

    // MIGRACIÓN Y PROTECCIÓN
    if (typeof notes === 'string') {
        notes = [{ id: Date.now(), text: notes, author: 'Sistema' }];
        calendarNotes[dateKey] = notes;
    } else if (!Array.isArray(notes)) {
        notes = [];
    }

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    document.getElementById('modalTitle').textContent = `${day} de ${monthNames[currentMonth]} ${currentYear}`;

    // Renderizar lista de notas
    renderModalNotes(notes);

    // Configurar evento de agregar nota
    const addBtn = document.getElementById('addNoteBtn');
    // Eliminar listeners anteriores para evitar duplicados
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn);

    newAddBtn.addEventListener('click', () => {
        addNewNoteToDay(dateKey);
    });

    // Permitir Enter en el input
    const input = document.getElementById('newNoteInput');
    input.value = '';
    input.onkeypress = (e) => {
        if (e.key === 'Enter') addNewNoteToDay(dateKey);
    };

    document.getElementById('dayModal').classList.add('active');
}

// Renderizar notas en el modal
function renderModalNotes(notes) {
    const container = document.getElementById('dayNotesList');
    container.innerHTML = '';

    if (notes.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No hay notas para este día</p>';
        return;
    }

    notes.forEach(note => {
        const noteEl = document.createElement('div');
        noteEl.className = 'note-item';
        noteEl.innerHTML = `
            <div class="note-text">${note.text}</div>
            <button class="delete-note-btn" onclick="deleteSingleNote(${note.id})">&times;</button>
        `;
        container.appendChild(noteEl);
    });
}

// Agregar nueva nota
async function addNewNoteToDay(dateKey) {
    const input = document.getElementById('newNoteInput');
    const text = input.value.trim();

    if (!text) return;

    if (IS_LOCAL_MODE) {
        if (!calendarNotes[dateKey]) calendarNotes[dateKey] = [];
        calendarNotes[dateKey].push({
            id: Date.now(),
            text: text,
            author: currentUser.name
        });

        let allNotes = JSON.parse(localStorage.getItem(`local_notes_${currentWorkspace}`) || '{}');
        allNotes[dateKey] = calendarNotes[dateKey];
        localStorage.setItem(`local_notes_${currentWorkspace}`, JSON.stringify(allNotes));

        // Simular retardo de red
        await new Promise(r => setTimeout(r, 200));

        await loadData();
        renderCalendar();
        renderModalNotes(calendarNotes[dateKey] || []);
        input.value = '';
        return;
    }

    try {
        const response = await fetch(`/api/data?action=saveNote&workspace=${currentWorkspace}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dateKey: dateKey,
                text: text,
                author: currentUser.name
            })
        });

        if (response.ok) {
            await loadData();
            renderCalendar();
            renderModalNotes(calendarNotes[dateKey] || []);
            input.value = '';
        }
    } catch (e) {
        console.error("Error al guardar nota:", e);
        alert("Error al guardar nota en el servidor");
    }
}

// Eliminar nota individual
async function deleteSingleNote(noteId) {
    const dateKey = `${currentYear}-${currentMonth}-${selectedDay}`;

    if (!confirm('¿Estás seguro de eliminar esta nota?')) return;

    try {
        const response = await fetch(`/api/data?action=deleteNote&noteId=${noteId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadData();
            renderCalendar();
            renderModalNotes(calendarNotes[dateKey] || []);
        }
    } catch (e) {
        console.error("Error al eliminar nota:", e);
    }
}

// Renderizar tabla de guiones
function renderGuiones() {
    const grid = document.getElementById('guionesGrid');
    const filterMonth = document.getElementById('filterMonth').value;
    const filterYear = document.getElementById('filterYear').value;
    const filterPlatform = document.getElementById('filterPlatform').value;

    // Controlar visibilidad del botón de agregar guión
    const addGuionBtn = document.getElementById('addGuionBtn');
    if (addGuionBtn) {
        addGuionBtn.style.display = currentUser.role === 'client' ? 'none' : 'flex';
    }

    grid.innerHTML = '';

    // Filtrar guiones
    let filteredGuiones = guiones.filter(guion => {
        let matchesMonth = true;
        let matchesYear = true;
        let matchesPlatform = true;

        const [year, month, day] = guion.fecha.split('-');

        // Filtro Mes
        if (filterMonth !== 'all') {
            const guionMonth = parseInt(month) - 1;
            if (guionMonth !== parseInt(filterMonth)) matchesMonth = false;
        }

        // Filtro Año
        if (filterYear !== 'all') {
            if (year !== filterYear) matchesYear = false;
        }

        // Filtro Plataforma
        if (filterPlatform !== 'all') {
            // guion.plataformas es array, guion.plataforma es string legacy
            const gPlatforms = Array.isArray(guion.plataformas) ? guion.plataformas : (guion.plataforma ? [guion.plataforma] : []);
            if (!gPlatforms.includes(filterPlatform)) matchesPlatform = false;
        }

        return matchesMonth && matchesYear && matchesPlatform;
    });

    // Ordenar por fecha
    filteredGuiones.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    if (filteredGuiones.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">
                No hay guiones para mostrar con los filtros seleccionados. ${currentUser.role !== 'client' ? '¡Haz clic en "Nuevo Guión" para empezar!' : ''}
            </div>
            `;
        return;
    }

    filteredGuiones.forEach((guion) => {
        const card = document.createElement('div');
        card.className = 'guion-card';

        const formattedDate = formatDate(guion.fecha);
        const statusClass = getStatusClass(guion.estado);
        const formato = guion.formato || 'Carrusel';
        const formatoClass = formato === 'Reel' ? 'reel' : 'carrusel'; // Para header color

        const platText = Array.isArray(guion.plataformas) ? guion.plataformas.slice(0, 3).join(', ') + (guion.plataformas.length > 3 ? '...' : '') : (guion.plataforma || '');

        let actions = `
            <div class="action-buttons">
                <button class="btn-icon" onclick="viewGuion(${guion.id})" title="Ver detalles">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>`;

        if (currentUser.role !== 'client') {
            actions += `
                <button class="btn-icon" onclick="editGuion(${guion.id})" title="Editar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteGuion(${guion.id})" title="Eliminar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
            `;
        }
        actions += `</div>`;

        // Renderizar Card
        card.innerHTML = `
            <div class="guion-card-header ${formatoClass}">
                <span class="badge-${formatoClass}" style="background:white; border:none;">${formato}</span>
                <span class="status-badge ${statusClass}" style="transform: scale(0.9); margin:0;">${guion.estado}</span>
            </div>
            <div class="guion-card-body">
                <div class="guion-card-date">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    ${formattedDate}
                </div>
                <h3 class="guion-card-title">${guion.titulo}</h3>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px;">
                     <strong>Plataformas:</strong> ${platText}
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${guion.notas || ''}
                </div>
            </div>
            <div class="guion-card-footer">
                ${actions}
            </div>
        `;

        grid.appendChild(card);
    });
}

// Formatear fecha
function formatDate(dateString) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

// Obtener clase de estado
function getStatusClass(estado) {
    const statusMap = {
        'Idea': 'status-idea',
        'En proceso': 'status-proceso',
        'Listo': 'status-listo',
        'Programado': 'status-programado',
        'Publicado': 'status-publicado'
    };
    return statusMap[estado] || 'status-idea';
}

// Guardar guión
async function saveGuion() {
    if (currentUser.role === 'client') return;

    const fecha = document.getElementById('guionFecha').value;
    const titulo = document.getElementById('guionTitulo').value.trim();
    const formato = document.getElementById('guionFormato').value;

    // Serializar datos del script editor
    const contenido = serializeScriptData(formato);

    console.log('💾 [SAVE] Guardando guión...');
    console.log('  - Formato seleccionado:', formato);
    console.log('  - Contenido serializado length:', contenido.length);

    const checkboxes = document.querySelectorAll('input[name="plataforma"]:checked');
    const plataformas = Array.from(checkboxes).map(cb => cb.value);

    const estado = document.getElementById('guionEstado').value;
    const notas = document.getElementById('guionNotas').value.trim();

    if (!fecha || !titulo) {
        alert('Por favor completa al menos la fecha y el título');
        return;
    }

    const guion = {
        id: editingGuionId || Date.now(), // Generar ID si es nuevo (para local)
        fecha,
        titulo,
        contenido,
        formato,
        plataformas,
        estado,
        notas
    };

    if (IS_LOCAL_MODE) {
        let allGuiones = JSON.parse(localStorage.getItem(`local_guiones_${currentWorkspace}`) || '[]');

        if (editingGuionId) {
            const index = allGuiones.findIndex(g => g.id === editingGuionId);
            if (index !== -1) allGuiones[index] = guion;
        } else {
            allGuiones.push(guion);
        }

        localStorage.setItem(`local_guiones_${currentWorkspace}`, JSON.stringify(allGuiones));

        console.log('✅ [SAVE] Guión guardado LOCALMENTE');
        await loadData();
        renderCalendar();
        renderGuiones();
        closeModal('guionModal');
        resetGuionForm();
        return;
    }

    // Para backend real, el ID lo maneja la BD si es nuevo
    const guionPayload = {
        ...guion,
        id: editingGuionId
    };

    try {
        const response = await fetch(`/api/data?action=saveGuion&workspace=${currentWorkspace}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(guionPayload)
        });

        if (response.ok) {
            console.log('✅ [SAVE] Guión guardado exitosamente');
            await loadData();
            renderCalendar();
            renderGuiones();
            closeModal('guionModal');
            resetGuionForm();
        }
    } catch (e) {
        console.error("Error al guardar guión:", e);
    }
}

// Ver guión (solo lectura)
function viewGuion(id) {
    console.log('👁️ [VIEW] Abriendo vista de guión, ID:', id);
    const guion = guiones.find(g => g.id === id);
    if (!guion) {
        console.error('❌ [VIEW] Guión no encontrado, ID:', id);
        return;
    }

    // Llenar el modal de vista
    document.getElementById('viewGuionTitle').textContent = guion.titulo;
    document.getElementById('viewGuionFecha').textContent = formatDate(guion.fecha);

    // Mostrar formato
    const formatoClass = guion.formato === 'Reel' ? 'badge-reel' : 'badge-carrusel';
    document.getElementById('viewGuionFormato').innerHTML = `<span class="${formatoClass}">${guion.formato || 'Carrusel'}</span>`;

    // Mostrar plataformas
    const platText = Array.isArray(guion.plataformas)
        ? guion.plataformas.join(', ')
        : (guion.plataforma || 'No especificado');
    document.getElementById('viewGuionPlataformas').textContent = platText;

    // Mostrar estado con badge
    const statusClass = getStatusClass(guion.estado);
    document.getElementById('viewGuionEstado').innerHTML = `<span class="status-badge ${statusClass}">${guion.estado}</span>`;

    // Mostrar contenido completo en formato tabla
    const contenidoDiv = document.getElementById('viewGuionContenido');
    if (guion.contenido) {
        try {
            const data = JSON.parse(guion.contenido);
            const formato = guion.formato || 'Carrusel';

            let tableHTML = '<table class="script-editor-table" style="margin-top: 12px;"><thead><tr>';

            if (formato === 'Carrusel') {
                tableHTML += '<th>Slide</th><th>Imagen</th><th>Descripción</th><th>Texto</th>';
            } else {
                tableHTML += '<th>Escena</th><th>Plano</th><th>Descripción</th><th>Diálogo</th><th>Audio</th>';
            }

            tableHTML += '</tr></thead><tbody>';

            data.forEach(row => {
                tableHTML += '<tr>';
                if (formato === 'Carrusel') {
                    tableHTML += `<td>${row.slide || ''}</td>`;
                    tableHTML += `<td>${row.imagen || ''}</td>`;
                    tableHTML += `<td>${row.descripcion || ''}</td>`;
                    tableHTML += `<td>${row.texto || ''}</td>`;
                } else {
                    tableHTML += `<td>${row.escena || ''}</td>`;
                    tableHTML += `<td>${row.plano || ''}</td>`;
                    tableHTML += `<td>${row.descripcion || ''}</td>`;
                    tableHTML += `<td>${row.dialogo || ''}</td>`;
                    tableHTML += `<td>${row.audio || ''}</td>`;
                }
                tableHTML += '</tr>';
            });

            tableHTML += '</tbody></table>';
            contenidoDiv.innerHTML = tableHTML;
        } catch (e) {
            console.error('Error al parsear contenido:', e);
            contenidoDiv.textContent = guion.contenido || 'Sin contenido';
        }
    } else {
        contenidoDiv.textContent = 'Sin contenido';
    }


    // Mostrar notas y b-roll
    document.getElementById('viewGuionNotas').innerHTML = `
        <div><strong>Notas:</strong> ${guion.notas || 'Sin notas'}</div>
        <div style="margin-top:8px;"><strong>B-roll:</strong> <pre style="font-family:inherit; white-space: pre-wrap; margin:0;">${guion.b_roll || 'Sin B-roll'}</pre></div>
    `;

    // Abrir modal con función centralizada
    openModal('viewGuionModal');
}

// Editar guión
function editGuion(id) {
    console.log('✏️ [EDIT] Abriendo editor de guión, ID:', id);
    if (currentUser.role === 'client') {
        console.warn('⚠️ [EDIT] Usuario cliente no puede editar');
        return;
    }

    const guion = guiones.find(g => g.id === id);
    if (!guion) {
        console.error('❌ [EDIT] Guión no encontrado, ID:', id);
        return;
    }

    editingGuionId = id;

    document.getElementById('guionFecha').value = guion.fecha;
    const formato = guion.formato || 'Carrusel';
    document.getElementById('guionFormato').value = formato;
    document.getElementById('guionTitulo').value = guion.titulo;

    // Inicializar el editor con el formato correcto
    initScriptEditor(formato);

    // Deserializar y cargar los datos del script
    if (guion.contenido) {
        deserializeScriptData(formato, guion.contenido);
    }

    // Marcar checkboxes
    const plataformas = guion.plataformas || (guion.plataforma ? [guion.plataforma] : []);
    const checkboxes = document.querySelectorAll('input[name="plataforma"]');
    checkboxes.forEach(cb => {
        cb.checked = plataformas.includes(cb.value);
    });

    document.getElementById('guionEstado').value = guion.estado;
    document.getElementById('guionNotas').value = guion.notas || '';
    document.getElementById('guionBroll').value = guion.b_roll || '';

    document.getElementById('guionModalTitle').textContent = 'Editar Guión';

    // Abrir modal con función centralizada
    openModal('guionModal');
}

// Eliminar guión
async function deleteGuion(id) {
    if (currentUser.role === 'client') return;

    if (!confirm('¿Estás seguro de que quieres eliminar este guión?')) {
        return;
    }

    try {
        const response = await fetch(`/api/data?action=deleteGuion&workspace=${currentWorkspace}&guionId=${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadData();
            renderCalendar();
            renderGuiones();
        }
    } catch (e) {
        console.error("Error al eliminar guión:", e);
    }
}

// Resetear formulario de guión
function resetGuionForm() {
    editingGuionId = null;
    document.getElementById('guionFecha').value = '';
    document.getElementById('guionTitulo').value = '';
    document.getElementById('guionContenido').value = '';
    document.getElementById('guionFormato').value = 'Carrusel';

    // Limpiar checkboxes
    const checkboxes = document.querySelectorAll('input[name="plataforma"]');
    checkboxes.forEach(cb => cb.checked = false);

    document.getElementById('guionEstado').value = 'Idea';
    document.getElementById('guionNotas').value = '';
    document.getElementById('guionBroll').value = '';

    // Inicializar editor de script
    initScriptEditor('Carrusel');
}

// ============================================
// DYNAMIC SCRIPT EDITOR
// ============================================

// Inicializar el editor de script
function initScriptEditor(formato) {
    const container = document.getElementById('scriptEditorContainer');

    if (formato === 'Carrusel') {
        container.innerHTML = `
            <table class="script-editor-table">
                <thead>
                    <tr>
                        <th style="width: 10%;">Slide</th>
                        <th style="width: 25%;">Imagen</th>
                        <th style="width: 35%;">Descripción de la imagen</th>
                        <th style="width: 25%;">Texto sobre la imagen</th>
                        <th style="width: 5%;"></th>
                    </tr>
                </thead>
                <tbody id="scriptTableBody">
                    <!-- Las filas se agregarán dinámicamente -->
                </tbody>
            </table>
        `;
    } else if (formato === 'Reel') {
        container.innerHTML = `
            <table class="script-editor-table">
                <thead>
                    <tr>
                        <th style="width: 10%;">N° Escena</th>
                        <th style="width: 15%;">Plano / Movimiento de cámara</th>
                        <th style="width: 30%;">Descripción del video</th>
                        <th style="width: 25%;">Diálogo</th>
                        <th style="width: 15%;">Descripción del audio</th>
                        <th style="width: 5%;"></th>
                    </tr>
                </thead>
                <tbody id="scriptTableBody">
                    <!-- Las filas se agregarán dinámicamente -->
                </tbody>
            </table>
        `;
    }

    // Agregar primera fila por defecto
    addScriptRow(formato);
}

// Agregar una fila al script
function addScriptRow(formato, data = null) {
    const tbody = document.getElementById('scriptTableBody');
    const row = document.createElement('tr');

    if (formato === 'Carrusel') {
        row.innerHTML = `
            <td><input type="text" value="${data?.slide || ''}" /></td>
            <td><textarea rows="2">${data?.imagen || ''}</textarea></td>
            <td><textarea rows="2">${data?.descripcion || ''}</textarea></td>
            <td><textarea rows="2">${data?.texto || ''}</textarea></td>
            <td>
                <button type="button" class="btn-delete-row" onclick="deleteScriptRow(this)" title="Eliminar fila">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </td>
        `;
    } else if (formato === 'Reel') {
        row.innerHTML = `
            <td><input type="text" value="${data?.escena || ''}" /></td>
            <td><textarea rows="2">${data?.plano || ''}</textarea></td>
            <td><textarea rows="2">${data?.descripcion || ''}</textarea></td>
            <td><textarea rows="2">${data?.dialogo || ''}</textarea></td>
            <td><textarea rows="2">${data?.audio || ''}</textarea></td>
            <td>
                <button type="button" class="btn-delete-row" onclick="deleteScriptRow(this)" title="Eliminar fila">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </td>
        `;
    }

    tbody.appendChild(row);
}

// Eliminar una fila del script
function deleteScriptRow(button) {
    const row = button.closest('tr');
    const tbody = row.parentElement;

    // No permitir eliminar si es la última fila
    if (tbody.children.length <= 1) {
        alert('Debe haber al menos una fila en el guión');
        return;
    }

    row.remove();
}

// Serializar datos del script a JSON
function serializeScriptData(formato) {
    const tbody = document.getElementById('scriptTableBody');
    const rows = tbody.querySelectorAll('tr');
    const data = [];

    rows.forEach(row => {
        const inputs = row.querySelectorAll('input, textarea');

        if (formato === 'Carrusel') {
            data.push({
                slide: inputs[0].value,
                imagen: inputs[1].value,
                descripcion: inputs[2].value,
                texto: inputs[3].value
            });
        } else if (formato === 'Reel') {
            data.push({
                escena: inputs[0].value,
                plano: inputs[1].value,
                descripcion: inputs[2].value,
                dialogo: inputs[3].value,
                audio: inputs[4].value
            });
        }
    });

    return JSON.stringify(data);
}

// Deserializar datos del script desde JSON
function deserializeScriptData(formato, jsonData) {
    try {
        const data = JSON.parse(jsonData);
        const tbody = document.getElementById('scriptTableBody');
        tbody.innerHTML = ''; // Limpiar filas existentes

        if (data && data.length > 0) {
            data.forEach(rowData => {
                addScriptRow(formato, rowData);
            });
        } else {
            // Si no hay datos, agregar una fila vacía
            addScriptRow(formato);
        }
    } catch (e) {
        console.error('Error al deserializar datos del script:', e);
        // En caso de error, agregar una fila vacía
        addScriptRow(formato);
    }
}

// Permitir login con Enter
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && document.getElementById('loginScreen').classList.contains('active')) {
        processLogin();
    }
});

// ============================================
// GESTIÓN DE USUARIOS (SOLO ADMIN)
// ============================================

// Mostrar modal de gestión de usuarios
function showUserManagement() {
    console.log('👥 [USER-MGMT] Función showUserManagement llamada');
    console.log('👥 [USER-MGMT] Usuario actual:', currentUser);

    if (currentUser.role !== 'admin') {
        console.warn('⚠️ [USER-MGMT] Usuario no es admin, rol:', currentUser.role);
        alert('No tienes permisos para gestionar usuarios');
        return;
    }

    console.log('👥 [USER-MGMT] Renderizando lista de usuarios...');
    renderUsersList();

    console.log('👥 [USER-MGMT] Abriendo modal...');

    // Abrir modal con función centralizada
    openModal('userManagementModal');

    // Inicializar modales solo la primera vez
    if (!window.userModalsInitialized) {
        console.log('🔧 [USER-MGMT] Inicializando modales de usuario por primera vez');
        initializeUserModals();
        window.userModalsInitialized = true;
        console.log('✅ [USER-MGMT] Modales inicializados');
    } else {
        console.log('✅ [USER-MGMT] Modales ya estaban inicializados');
    }
}

// Inicializar modales de usuarios
function initializeUserModals() {
    const userMgmtModal = document.getElementById('userManagementModal');
    const addUserModal = document.getElementById('addUserModal');

    // Cerrar modal de gestión
    const closeMgmtBtns = userMgmtModal.querySelectorAll('.modal-close-users');
    closeMgmtBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            userMgmtModal.classList.remove('active');
        });
    });

    userMgmtModal.addEventListener('click', (e) => {
        if (e.target === userMgmtModal) {
            closeModal('userManagementModal');
        }
    });

    // Cerrar modal de agregar usuario
    const closeUserBtns = addUserModal.querySelectorAll('.modal-close-user');
    closeUserBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal('addUserModal');
        });
    });

    addUserModal.addEventListener('click', (e) => {
        if (e.target === addUserModal) {
            closeModal('addUserModal');
        }
    });

    // Botón agregar usuario
    document.getElementById('addUserBtn').addEventListener('click', () => {
        document.getElementById('userModalTitle').textContent = 'Nuevo Usuario';
        const emailInput = document.getElementById('newUserEmail');
        emailInput.value = '';
        emailInput.disabled = false;

        document.getElementById('newUserPassword').value = '';
        document.getElementById('newUserName').value = '';
        document.getElementById('newUserRole').value = 'client';

        // Reset button state
        const saveBtn = document.getElementById('saveUserBtn');
        saveBtn.textContent = 'Guardar Usuario';

        // Restore original listener
        const newBtn = saveBtn.cloneNode(true);
        newBtn.removeAttribute('onclick');
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        newBtn.addEventListener('click', saveNewUser);

        renderUserCalendarsCheckboxes();
        openModal('addUserModal');
    });


}

// Renderizar lista de usuarios
async function renderUsersList() {
    const usersList = document.getElementById('usersList');
    const users = await getUsersFromStorage();

    if (!users || Object.keys(users).length === 0) {
        usersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No hay usuarios registrados</p>';
        return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';

    for (const [email, user] of Object.entries(users)) {
        const roleText = user.role === 'admin' ? 'Administrador' : 'Cliente';
        const accessText = user.canAccess.join(', ');

        html += `
            <div style="background: var(--bg-tertiary); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${user.name}</div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 4px;">${email}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">
                            <span style="color: var(--primary-light);">${roleText}</span> • 
                            Acceso: ${accessText}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="editUser('${email}')" class="btn-icon btn-edit" style="flex-shrink: 0;" title="Editar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button onclick="deleteUser('${email}')" class="btn-icon btn-delete" style="flex-shrink: 0;" title="Eliminar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    html += '</div>';
    usersList.innerHTML = html;
}

// Guardar nuevo usuario
window.saveNewUser = async function () {
    console.log('💾 [USER] Intentando guardar usuario...');
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const name = document.getElementById('newUserName').value.trim();
    const role = document.getElementById('newUserRole').value;


    if (!email || !password || !name) {
        alert('Por favor completa todos los campos obligatorios');
        return;
    }

    // Recoger calendarios seleccionados dinámicamente
    const canAccess = [];
    const checkboxes = document.querySelectorAll('#userCalendarsContainer input[type="checkbox"]:checked');
    checkboxes.forEach(cb => canAccess.push(cb.value));

    if (canAccess.length === 0) {
        alert('Debes seleccionar al menos un calendario');
        return;
    }

    const users = await getUsersFromStorage();

    if (users[email]) {
        alert('Ya existe un usuario con ese email');
        return;
    }

    const newUser = {
        email,
        password,
        role,
        name,
        canAccess
    };

    await saveUsersToStorage(users, newUser);

    closeModal('addUserModal');
    await renderUsersList();

    alert('Usuario creado exitosamente');
}

// Eliminar usuario
async function deleteUser(email) {
    if (email === 'asgrmillo@gmail.com') {
        alert('No puedes eliminar el usuario administrador principal');
        return;
    }

    if (!confirm(`¿Estás seguro de que quieres eliminar el usuario ${email}?`)) {
        return;
    }

    try {
        await fetch(`/api/data?action=deleteUser&targetEmail=${email}`, {
            method: 'DELETE'
        });
        await renderUsersList();
    } catch (e) {
        console.error("Error al eliminar usuario:", e);
    }
}


// ============================================
// GESTIÓN DE CALENDARIOS (SOLO ADMIN)
// ============================================

// Mostrar modal de gestión de calendarios
window.showWorkspaceManagement = function () {
    console.log('📅 [WORKSPACE-MGMT] Función showWorkspaceManagement llamada');
    console.log('📅 [WORKSPACE-MGMT] Usuario actual:', currentUser);

    if (currentUser.role !== 'admin') {
        console.warn('⚠️ [WORKSPACE-MGMT] Usuario no es admin, rol:', currentUser.role);
        alert('No tienes permisos para gestionar calendarios');
        return;
    }

    console.log('📅 [WORKSPACE-MGMT] Renderizando lista de calendarios...');
    renderWorkspacesList();

    console.log('📅 [WORKSPACE-MGMT] Abriendo modal...');

    // Abrir modal con función centralizada
    openModal('workspaceManagementModal');

    // Inicializar modales solo la primera vez
    if (!window.workspaceModalsInitialized) {
        console.log('🔧 [WORKSPACE-MGMT] Inicializando modales de workspace por primera vez');
        initializeWorkspaceModals();
        window.workspaceModalsInitialized = true;
        console.log('✅ [WORKSPACE-MGMT] Modales inicializados');
    } else {
        console.log('✅ [WORKSPACE-MGMT] Modales ya estaban inicializados');
    }
}

// Inicializar modales de calendarios
function initializeWorkspaceModals() {
    const workspaceMgmtModal = document.getElementById('workspaceManagementModal');
    const addWorkspaceModal = document.getElementById('addWorkspaceModal');

    // Cerrar modal de gestión
    const closeMgmtBtns = workspaceMgmtModal.querySelectorAll('.modal-close-workspaces');
    closeMgmtBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal('workspaceManagementModal');
        });
    });

    workspaceMgmtModal.addEventListener('click', (e) => {
        if (e.target === workspaceMgmtModal) {
            closeModal('workspaceManagementModal');
        }
    });

    // Cerrar modal de agregar calendario
    const closeWorkspaceBtns = addWorkspaceModal.querySelectorAll('.modal-close-workspace');
    closeWorkspaceBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal('addWorkspaceModal');
        });
    });

    addWorkspaceModal.addEventListener('click', (e) => {
        if (e.target === addWorkspaceModal) {
            closeModal('addWorkspaceModal');
        }
    });

    // Botón agregar calendario
    document.getElementById('addWorkspaceBtn').addEventListener('click', () => {
        document.getElementById('newWorkspaceName').value = '';
        document.getElementById('newWorkspaceDisplayName').value = '';
        openModal('addWorkspaceModal');
    });

    // Guardar calendario
    document.getElementById('saveWorkspaceBtn').addEventListener('click', createNewWorkspace);
}

// Renderizar lista de calendarios
function renderWorkspacesList() {
    const workspacesList = document.getElementById('workspacesList');

    if (workspaces.length === 0) {
        workspacesList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No hay calendarios registrados</p>';
        return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';

    workspaces.forEach(ws => {
        // No permitir borrar los default
        const isDefault = ws.name === 'personal' || ws.name === 'maacline';

        const deleteButton = isDefault ? '' : `
            <button onclick="deleteWorkspace('${ws.name}')" class="btn-icon btn-delete" title="Eliminar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        `;

        html += `
            <div class="workspace-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 8px;">
                <div>
                    <strong style="color: var(--text-primary);">${ws.display_name}</strong>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">ID: ${ws.name}</div>
                    ${isDefault ? '<div style="font-size: 0.85rem; color: var(--primary-light);">Calendario predeterminado</div>' : ''}
                </div>
                 <div style="display: flex; gap: 8px;">
                    <button onclick="editWorkspace('${ws.name}', '${ws.display_name}', '${ws.logo || ''}')" class="btn-icon btn-edit" title="Editar">
                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    ${deleteButton}
                </div>
            </div>
        `;
    });

    html += '</div>';
    workspacesList.innerHTML = html;
}

// Helper para leer archivo como Base64
const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

// Editar workspace
window.editWorkspace = function (name, displayName, currentLogo = '') {
    const modal = document.getElementById('addWorkspaceModal');
    document.getElementById('modalTitleWorkspace').textContent = 'Editar Calendario';

    document.getElementById('newWorkspaceName').value = name;
    document.getElementById('newWorkspaceName').disabled = true; // ID no editable
    document.getElementById('newWorkspaceDisplayName').value = displayName;
    // Clear file input
    document.getElementById('newWorkspaceLogo').value = '';

    // Cambiar comportamiento del botón guardar
    const saveBtn = document.getElementById('saveWorkspaceBtn');
    saveBtn.textContent = 'Actualizar';

    // Remover listeners anteriores para evitar duplicados (clonar nodo)
    const newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);

    newBtn.addEventListener('click', async () => {
        const newDisplayName = document.getElementById('newWorkspaceDisplayName').value.trim();
        const fileInput = document.getElementById('newWorkspaceLogo');
        let logoToSave = currentLogo; // Mantener anterior por defecto

        if (fileInput.files.length > 0) {
            try {
                logoToSave = await readFileAsBase64(fileInput.files[0]);
            } catch (e) {
                console.error('Error leyendo imagen', e);
                alert('Error al procesar la imagen');
                return;
            }
        }

        if (!newDisplayName) return alert('Nombre requerido');

        try {
            await fetch('/api/data?action=updateWorkspace', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, display_name: newDisplayName, logo: logoToSave })
            });

            // Recargar
            const response = await fetch('/api/data?action=getWorkspaces');
            if (response.ok) workspaces = await response.json();
            renderWorkspacesList();
            closeModal('addWorkspaceModal');

            // Restaurar estado del modal
            document.getElementById('modalTitleWorkspace').textContent = 'Nuevo Calendario';
            document.getElementById('newWorkspaceName').disabled = false;
            document.getElementById('newWorkspaceName').value = '';
            document.getElementById('newWorkspaceDisplayName').value = '';
            document.getElementById('newWorkspaceLogo').value = '';

            newBtn.textContent = 'Crear';
            newBtn.addEventListener('click', createNewWorkspace);

        } catch (e) {
            console.error(e);
            alert('Error al actualizar');
        }
    });

    openModal('addWorkspaceModal');
}

// Crear nuevo calendario
async function createNewWorkspace() {
    const name = document.getElementById('newWorkspaceName').value.trim();
    const displayName = document.getElementById('newWorkspaceDisplayName').value.trim();
    const fileInput = document.getElementById('newWorkspaceLogo');

    let logoBase64 = '';

    if (!name || !displayName) {
        alert('Por favor completa todos los campos');
        return;
    }

    // Validar formato del nombre
    if (!/^[a-z0-9_]+$/.test(name)) {
        alert('El nombre interno solo puede contener letras minúsculas, números y guiones bajos');
        return;
    }

    if (fileInput.files.length > 0) {
        try {
            logoBase64 = await readFileAsBase64(fileInput.files[0]);
        } catch (e) {
            console.error('Error leyendo imagen', e);
            alert('Error al procesar la imagen');
            return;
        }
    }

    try {
        const response = await fetch('/api/data?action=createWorkspace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, display_name: displayName, logo: logoBase64 })
        });

        if (response.ok) {
            await loadWorkspaces(); // Recargar lista
            renderWorkspacesList();
            closeModal('addWorkspaceModal');
            alert('Calendario creado exitosamente');
        } else {
            const error = await response.json();
            alert('Error: ' + (error.error || 'No se pudo crear el calendario'));
        }
    } catch (e) {
        console.error('Error al crear calendario:', e);
        alert('Error al crear calendario');
    }
}

// Eliminar calendario
async function deleteWorkspace(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este calendario? Todos los datos asociados se perderán.')) {
        return;
    }

    try {
        const response = await fetch(`/ api / data ? action = deleteWorkspace & workspaceId=${id} `, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadWorkspaces(); // Recargar lista
            renderWorkspacesList();
            alert('Calendario eliminado exitosamente');
        } else {
            const error = await response.json();
            alert('Error: ' + (error.error || 'No se pudo eliminar el calendario'));
        }
    } catch (e) {
        console.error('Error al eliminar calendario:', e);
        alert('Error al eliminar calendario');
    }
}

// Renderizar checkboxes de calendarios en formulario de usuario
function renderUserCalendarsCheckboxes() {
    const container = document.getElementById('userCalendarsContainer');
    container.innerHTML = '';

    workspaces.forEach(ws => {
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 8px;';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = ws.name;
        checkbox.id = `access_${ws.name} `;

        // Marcar MAAC Line por defecto
        if (ws.name === 'maacline') {
            checkbox.checked = true;
        }

        const span = document.createElement('span');
        span.textContent = ws.display_name;

        label.appendChild(checkbox);
        label.appendChild(span);
        container.appendChild(label);
    });
}


// ============================================
// FUNCIONES DE ESTADÍSTICAS
// ============================================

let chartInstances = {}; // Para guardar referencias a los gráficos y poder destruirlos/actualizarlos

// Variables globales para filtros de ESTADÍSTICAS
let currentStatsFilterMonth = 'all';
let currentStatsFilterYear = 'all';
let currentStatsFilterFormat = 'all';
let currentStatsFilterPlatform = 'all';

function renderStatisticsUI() {
    // Escuchar cambios en filtros
    const monthSelect = document.getElementById('statsFilterMonth');
    const yearSelect = document.getElementById('statsFilterYear');
    const formatSelect = document.getElementById('statsFilterFormat');
    const platformSelect = document.getElementById('statsFilterPlatform');

    // Clonar para limpiar listeners anteriores
    if (monthSelect) {
        const newMonthSelect = monthSelect.cloneNode(true);
        monthSelect.parentNode.replaceChild(newMonthSelect, monthSelect);
        newMonthSelect.value = currentStatsFilterMonth;
        newMonthSelect.addEventListener('change', (e) => { currentStatsFilterMonth = e.target.value; updateAll(); });
    }

    if (yearSelect) {
        const newYearSelect = yearSelect.cloneNode(true);
        yearSelect.parentNode.replaceChild(newYearSelect, yearSelect);
        newYearSelect.value = currentStatsFilterYear;
        newYearSelect.addEventListener('change', (e) => { currentStatsFilterYear = e.target.value; updateAll(); });
    }

    if (formatSelect) {
        const newFormatSelect = formatSelect.cloneNode(true);
        formatSelect.parentNode.replaceChild(newFormatSelect, formatSelect);
        newFormatSelect.value = currentStatsFilterFormat;
        newFormatSelect.addEventListener('change', (e) => { currentStatsFilterFormat = e.target.value; updateAll(); });
    }

    if (platformSelect) {
        const newPlatformSelect = platformSelect.cloneNode(true);
        platformSelect.parentNode.replaceChild(newPlatformSelect, platformSelect);
        newPlatformSelect.value = currentStatsFilterPlatform;
        newPlatformSelect.addEventListener('change', (e) => { currentStatsFilterPlatform = e.target.value; updateAll(); });
    }

    // Función auxiliar para actualizar todo
    const updateAll = () => {
        renderStatsEntryList();
        renderStatsCharts();
        renderStatsSummary();
    };

    // Injectar Botón de Metas Globales
    const filterContainer = document.querySelector('.stats-filters');
    if (filterContainer && !document.getElementById('btnGlobalStats')) {
        const btn = document.createElement('button');
        btn.id = 'btnGlobalStats';
        btn.className = 'btn-secondary';
        btn.style.marginLeft = 'auto'; // Push to right
        btn.innerHTML = '📊 Ingresar Totales Mes';
        btn.onclick = () => openGlobalStatsModal();
        filterContainer.appendChild(btn);
    }

    updateAll();
}

function openGlobalStatsModal() {
    openModal('globalStatsModal');

    // Obtener mes actual del input si ya tiene valor, o usar el filtro
    let initialMonthStr = document.getElementById('globalStatsMonth').value;

    if (!initialMonthStr) {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        initialMonthStr = `${year}-${month}`;
        document.getElementById('globalStatsMonth').value = initialMonthStr;
    }

    // Cargar datos al cambiar la fecha
    document.getElementById('globalStatsMonth').onchange = (e) => {
        loadGlobalStatsForForm(e.target.value);
    };

    // Cargar datos iniciales
    loadGlobalStatsForForm(initialMonthStr);
}

function loadGlobalStatsForForm(monthStr) {
    if (!monthStr) return;

    // Intentar encontrar con formato corregido (sin espacios) o fallback al antiguo (con espacios)
    let data = globalBusinessStats[monthStr];

    if (!data) {
        // Intentar buscar con formato antiguo por si acaso
        const [year, month] = monthStr.split('-');
        const oldKey = `${year} -${month} `; // Formato antiguo con espacios
        data = globalBusinessStats[oldKey];
    }

    data = data || {};

    // Populate Instagram
    document.getElementById('gs-ig-followers-organic').value = data.ig?.followersOrganic || 0;
    document.getElementById('gs-ig-followers-lost').value = data.ig?.followersLost || 0; // Nuevo
    document.getElementById('gs-ig-messages').value = data.ig?.messages || 0;
    document.getElementById('gs-ig-sales').value = data.ig?.sales || 0;

    // Populate TikTok
    document.getElementById('gs-tk-followers-organic').value = data.tk?.followersOrganic || 0;
    document.getElementById('gs-tk-followers-lost').value = data.tk?.followersLost || 0; // Nuevo
    document.getElementById('gs-tk-messages').value = data.tk?.messages || 0;
    document.getElementById('gs-tk-sales').value = data.tk?.sales || 0;

    // Populate Facebook
    document.getElementById('gs-fb-followers-organic').value = data.fb?.followersOrganic || 0;
    document.getElementById('gs-fb-followers-lost').value = data.fb?.followersLost || 0; // Nuevo
    document.getElementById('gs-fb-messages').value = data.fb?.messages || 0;
    document.getElementById('gs-fb-sales').value = data.fb?.sales || 0;
}

function saveGlobalStats() {
    const month = parseInt(document.getElementById('statsMonthSelect').value);
    const year = parseInt(document.getElementById('statsYearInput').value);
    const messages = parseInt(document.getElementById('statsMessages').value) || 0;
    const sales = parseInt(document.getElementById('statsSales').value) || 0;

    const monthStr = `${year} -${String(month).padStart(2, '0')} `;

    const data = {
        messages,
        sales,
        updatedAt: new Date().toISOString() // Guardar fecha exacta
    };

    globalBusinessStats[monthStr] = data;

    // Guardar con separación por workspace
    if (IS_LOCAL_MODE) {
        localStorage.setItem(`local_globalStats_${currentWorkspace} `, JSON.stringify(globalBusinessStats));
    } else {
        // Guardar en base de datos
        fetch('/api/data?action=saveGlobalStats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workspace: currentWorkspace,
                monthKey: monthStr,
                data: data
            })
        }).catch(err => {
            console.error('Error al guardar global stats:', err);
            alert('Error al guardar los totales. Intenta nuevamente.');
        });
    }

    closeModal('globalStatsModal');
    renderStatisticsUI();
    alert('Totales guardados correctamente');
}

function saveGlobalStats() {
    const monthStr = document.getElementById('globalStatsMonth').value;
    if (!monthStr) return alert('Selecciona un mes');

    // Calcular el último día del mes seleccionado
    const [year, month] = monthStr.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate(); // Día 0 del siguiente mes = último día del mes actual
    // FIX: Eliminar espacios extra en la fecha
    const savedDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // FIX: Eliminar espacios extra en la clave del mes si existían
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    const data = {
        savedDate: savedDate, // Último día del mes seleccionado
        ig: {
            followersOrganic: parseInt(document.getElementById('gs-ig-followers-organic').value) || 0,
            followersLost: parseInt(document.getElementById('gs-ig-followers-lost').value) || 0, // Nuevo
            messages: parseInt(document.getElementById('gs-ig-messages').value) || 0,
            sales: parseInt(document.getElementById('gs-ig-sales').value) || 0
        },
        tk: {
            followersOrganic: parseInt(document.getElementById('gs-tk-followers-organic').value) || 0,
            followersLost: parseInt(document.getElementById('gs-tk-followers-lost').value) || 0, // Nuevo
            messages: parseInt(document.getElementById('gs-tk-messages').value) || 0,
            sales: parseInt(document.getElementById('gs-tk-sales').value) || 0
        },
        fb: {
            followersOrganic: parseInt(document.getElementById('gs-fb-followers-organic').value) || 0,
            followersLost: parseInt(document.getElementById('gs-fb-followers-lost').value) || 0, // Nuevo
            messages: parseInt(document.getElementById('gs-fb-messages').value) || 0,
            sales: parseInt(document.getElementById('gs-fb-sales').value) || 0
        }
    };

    // Usar la clave corregida sin espacios
    globalBusinessStats[monthKey] = data;

    // Guardar con separación por workspace
    if (IS_LOCAL_MODE) {
        localStorage.setItem(`local_globalStats_${currentWorkspace}`, JSON.stringify(globalBusinessStats));
    } else {
        // Guardar en base de datos
        fetch('/api/data?action=saveGlobalStats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workspace: currentWorkspace,
                monthKey: monthKey,
                data: data
            })
        }).catch(err => {
            console.error('Error al guardar global stats:', err);
            alert('Error al guardar los totales. Intenta nuevamente.');
        });
    }

    closeModal('globalStatsModal');
    renderStatsSummary(); // Actualizar resumen
    renderStatsCharts(); // Actualizar gráficas incluyendo la de seguidores
    alert('Totales guardados correctamente');
}

function renderStatsEntryList() {
    const grid = document.getElementById('statsEntryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const filteredGuiones = guiones.filter(g => {
        // Solo publicados
        if (g.estado !== 'Publicado') return false;

        let gDate;
        try { gDate = new Date(g.fecha + 'T12:00:00'); } catch (e) { return false; }

        // Filtro Mes
        if (currentStatsFilterMonth !== 'all') {
            if (gDate.getMonth() !== parseInt(currentStatsFilterMonth)) return false;
        }

        // Filtro Año
        if (currentStatsFilterYear !== 'all') {
            if (gDate.getFullYear() !== parseInt(currentStatsFilterYear)) return false;
        }

        // Filtro Formato
        if (currentStatsFilterFormat !== 'all') {
            const formato = g.formato || 'Carrusel';
            if (formato !== currentStatsFilterFormat) return false;
        }

        // Filtro Plataforma
        if (currentStatsFilterPlatform !== 'all') {
            if (!g.plataformas.includes(currentStatsFilterPlatform)) return false;
        }

        return true;
    });

    // Ordenar por fecha cronológicamente
    filteredGuiones.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    if (filteredGuiones.length === 0) {
        grid.innerHTML = '<p class="no-data" style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No hay guiones publicados para mostrar con estos filtros.</p>';
        return;
    }

    filteredGuiones.forEach(g => {
        const card = document.createElement('div');
        card.className = 'guion-card';
        card.style.borderColor = 'var(--primary)'; // Validar visualmente que son interactivos
        card.style.cursor = 'default';

        // Ver si ya tiene stats
        const hasStats = statistics.some(s => s.guion_id === g.id);
        const statusBadge = hasStats
            ? '<span class="status-badge status-published" style="font-size: 0.7rem; padding: 2px 6px;">Con Datos</span>'
            : '<span class="status-badge status-idea" style="background: var(--bg-tertiary); color: var(--text-secondary); font-size: 0.7rem; padding: 2px 6px;">Sin Datos</span>';

        card.innerHTML = `
            <div class="guion-card-header">
                <span class="guion-date">${g.fecha}</span>
                ${statusBadge}
            </div>
            <h3 class="guion-title">${g.titulo}</h3>
            <div class="guion-meta">
                <span class="guion-format format-${(g.formato || 'Carrusel').toLowerCase()}">${g.formato || 'Carrusel'}</span>
                <div class="guion-platforms">
                    ${g.plataformas.map(p => `<span class="platform-tag">${p}</span>`).join('')}
                </div>
            </div>
            <button class="btn-secondary" style="width: 100%; margin-top: 10px;" onclick="openStatsModal(${g.id})">
                Ingresar/Editar Datos
            </button>
        `;
        grid.appendChild(card);
    });
}

// Nueva función para el resumen con filtros y SVG
function renderStatsSummary() {
    const summaryContainer = document.getElementById('statsSummary');
    if (!summaryContainer) return;
    summaryContainer.innerHTML = '';

    // Mejora de Layout: Centrado y con wrap para múltiples filas
    summaryContainer.style.display = 'flex';
    summaryContainer.style.flexWrap = 'wrap';
    summaryContainer.style.justifyContent = 'center';
    summaryContainer.style.gap = '20px';

    // FIX: Recargar datos globales frescos para asegurar que se muestren los cambios recientes
    if (IS_LOCAL_MODE) {
        const storedStats = localStorage.getItem(`local_globalStats_${currentWorkspace}`);
        if (storedStats) {
            globalBusinessStats = JSON.parse(storedStats);
        }
    }

    // 1. Obtener IDs de guiones válidos según filtros de fecha/formato/plataforma
    const validGuionIds = guiones.filter(g => {
        if (g.estado !== 'Publicado') return false;

        let gDate;
        try { gDate = new Date(g.fecha + 'T12:00:00'); } catch (e) { return false; }

        if (currentStatsFilterMonth !== 'all' && gDate.getMonth() !== parseInt(currentStatsFilterMonth)) return false;
        if (currentStatsFilterYear !== 'all' && gDate.getFullYear() !== parseInt(currentStatsFilterYear)) return false;
        if (currentStatsFilterFormat !== 'all' && (g.formato || 'Carrusel') !== currentStatsFilterFormat) return false;
        if (currentStatsFilterPlatform !== 'all' && !g.plataformas.includes(currentStatsFilterPlatform)) return false;

        return true;
    }).map(g => g.id);


    // 2. Filtrar estadisticas de esos guiones con validación estricta
    let filteredStats = statistics.filter(s => {
        // Debe estar en los guiones válidos
        if (!validGuionIds.includes(s.guion_id)) return false;

        // Debe tener datos significativos
        if (!hasSignificantData(s.metrics)) return false;

        // Si hay filtro de plataforma, debe coincidir EXACTAMENTE
        if (currentStatsFilterPlatform !== 'all' && s.platform !== currentStatsFilterPlatform) return false;

        return true;
    });

    // --- CALCULO METRICAS GLOBALES (MENSAJES / VENTAS / SEGUIDORES ORG / PERDIDOS) ---
    // Logica: Sumar mensajes/ventas de globalBusinessStats que coincidan con el filtro de fecha
    let totalMessages = 0;
    let totalSales = 0;
    let totalOrganic = 0;
    let totalLost = 0;

    Object.entries(globalBusinessStats).forEach(([monthStr, data]) => {
        // Soporte para claves antiguas con espacios
        const cleanMonthStr = monthStr.replace(/\s+/g, '');
        const [year, month] = cleanMonthStr.split('-').map(Number); // "2024-10" -> 2024, 10

        // Aplicar filtros de fecha a las metricas globales
        if (currentStatsFilterYear !== 'all' && year !== parseInt(currentStatsFilterYear)) return;
        // month está 1-based, getMonth() es 0-based
        if (currentStatsFilterMonth !== 'all' && (month - 1) !== parseInt(currentStatsFilterMonth)) return;

        // Sumar según plataforma
        if (currentStatsFilterPlatform === 'all') {
            totalMessages += (data.ig?.messages || 0) + (data.tk?.messages || 0) + (data.fb?.messages || 0);
            totalSales += (data.ig?.sales || 0) + (data.tk?.sales || 0) + (data.fb?.sales || 0);
            totalOrganic += (data.ig?.followersOrganic || 0) + (data.tk?.followersOrganic || 0) + (data.fb?.followersOrganic || 0);
            totalLost += (data.ig?.followersLost || 0) + (data.tk?.followersLost || 0) + (data.fb?.followersLost || 0);
        } else if (currentStatsFilterPlatform === 'Instagram') {
            totalMessages += (data.ig?.messages || 0);
            totalSales += (data.ig?.sales || 0);
            totalOrganic += (data.ig?.followersOrganic || 0);
            totalLost += (data.ig?.followersLost || 0);
        } else if (currentStatsFilterPlatform === 'TikTok') {
            totalMessages += (data.tk?.messages || 0);
            totalSales += (data.tk?.sales || 0);
            totalOrganic += (data.tk?.followersOrganic || 0);
            totalLost += (data.tk?.followersLost || 0);
        } else if (currentStatsFilterPlatform === 'Facebook') {
            totalMessages += (data.fb?.messages || 0);
            totalSales += (data.fb?.sales || 0);
            totalOrganic += (data.fb?.followersOrganic || 0);
            totalLost += (data.fb?.followersLost || 0);
        }
    });


    // Calcular Totales
    const totalViews = filteredStats.reduce((sum, s) => sum + (s.metrics.views || 0), 0);
    const totalLikes = filteredStats.reduce((sum, s) => sum + (s.metrics.likes || 0), 0);
    const totalComments = filteredStats.reduce((sum, s) => sum + (s.metrics.comments || 0), 0);
    const totalShares = filteredStats.reduce((sum, s) => sum + (s.metrics.shares || 0), 0);
    const totalSaves = filteredStats.reduce((sum, s) => sum + (s.metrics.saves || 0), 0);

    // Avg Engagement
    const avgEngagement = (filteredStats.reduce((sum, s) => sum + parseFloat(s.metrics.engagement_rate || 0), 0) / (filteredStats.length || 1)).toFixed(2);

    // Calcular Seguidores Actuales (acumulado hasta el rango filtrado)
    // Sumar todos los seguidores de reels + orgánicos - perdidos
    let currentFollowers = 0;

    // Sumar seguidores de reels publicados (filtrados por plataforma si aplica)
    guiones.filter(g => g.estado === 'Publicado' && g.formato === 'Reel').forEach(g => {
        // Aplicar filtros de fecha
        let gDate;
        try { gDate = new Date(g.fecha + 'T12:00:00'); } catch (e) { return; }

        if (currentStatsFilterMonth !== 'all' && gDate.getMonth() !== parseInt(currentStatsFilterMonth)) return;
        if (currentStatsFilterYear !== 'all' && gDate.getFullYear() !== parseInt(currentStatsFilterYear)) return;

        g.plataformas.forEach(platform => {
            // Aplicar filtro de plataforma
            if (currentStatsFilterPlatform !== 'all' && platform !== currentStatsFilterPlatform) return;

            const stat = statistics.find(s => s.guion_id === g.id && s.platform === platform);
            if (stat && stat.metrics.followers) {
                currentFollowers += stat.metrics.followers;
            }
        });
    });

    // Sumar seguidores orgánicos y restar perdidos (ya calculados arriba con filtros)
    currentFollowers += totalOrganic - totalLost;

    // Iconos SVG
    const iconViews = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const iconLikes = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
    const iconComments = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`;
    const iconShares = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`;
    const iconSaves = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
    const iconEng = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`;
    const iconMessages = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
    const iconSales = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`;
    const iconOrganic = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>`;
    const iconLost = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="18" y1="8" x2="23" y2="13"></line><line x1="23" y1="8" x2="18" y2="13"></line></svg>`;
    const iconCurrentFollowers = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;

    // Renderizar Cards (Incluyendo todos los metrics)
    // Orden ajustado para dejar Seguidores Org y Perdidos al final, facilitando que bajen a segunda fila si no hay espacio
    const metrics = [
        { label: 'Seguidores Actuales', value: currentFollowers.toLocaleString(), icon: iconCurrentFollowers, color: '#22c55e' },
        { label: 'Vistas Totales', value: totalViews.toLocaleString(), icon: iconViews, color: '#3b82f6' },
        { label: 'Likes Totales', value: totalLikes.toLocaleString(), icon: iconLikes, color: '#ec4899' },
        { label: 'Comentarios', value: totalComments.toLocaleString(), icon: iconComments, color: '#14b8a6' },
        { label: 'Compartidos', value: totalShares.toLocaleString(), icon: iconShares, color: '#f59e0b' },
        { label: 'Guardados', value: totalSaves.toLocaleString(), icon: iconSaves, color: '#8b5cf6' },
        { label: 'Engagement', value: avgEngagement + '%', icon: iconEng, color: '#f97316' },
        { label: 'Mensajes', value: totalMessages.toLocaleString(), icon: iconMessages, color: '#6366f1' },
        { label: 'Ventas Cerradas', value: totalSales.toLocaleString(), icon: iconSales, color: '#10b981' },
        { label: 'Seguidores Orgánicos', value: totalOrganic.toLocaleString(), icon: iconOrganic, color: '#0ea5e9' },
        { label: 'Seguidores Perdidos', value: totalLost.toLocaleString(), icon: iconLost, color: '#ef4444' }
    ];

    metrics.forEach(m => {
        const card = document.createElement('div');
        card.style.background = 'var(--bg-secondary)';
        card.style.padding = '12px';
        card.style.borderRadius = '10px';
        card.style.border = '1px solid var(--border-color)';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.gap = '10px';
        card.style.minWidth = '200px';
        card.style.flex = '1 1 200px'; // Permitir que crezcan y se encojan, base 200px
        card.style.maxWidth = '300px'; // Evitar que sean enormes en pantallas grandes

        card.innerHTML = `
            <div style="background: ${m.color}20; padding: 8px; border-radius: 8px; color: ${m.color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <div style="width: 20px; height: 20px;">${m.icon}</div>
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 2px;">${m.label}</div>
                <div style="font-size: 1.1rem; font-weight: bold; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.value}</div>
            </div>
        `;
        summaryContainer.appendChild(card);
    });
}

// Funciones globales para formateo de tiempo (HH:MM:SS)
function formatSecondsToHMS(seconds) {
    if (!seconds) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

function parseHMSToSeconds(hmsString) {
    if (!hmsString) return 0;
    const parts = hmsString.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
        return parts[0];
    }
    return 0;
}

function openStatsModal(guionId) {
    const guion = guiones.find(g => g.id === guionId);
    if (!guion) return;

    document.getElementById('statsModalTitle').textContent = `Estadísticas: ${guion.titulo} `;
    document.getElementById('saveStatsBtn').dataset.guionId = guionId;

    const container = document.getElementById('statsFormsContainer');
    container.innerHTML = '';

    const format = guion.formato || 'Carrusel';

    guion.plataformas.forEach(platform => {
        const stat = statistics.find(s => s.guion_id === guionId && s.platform === platform);
        const metrics = stat ? stat.metrics : {};

        const platformSection = document.createElement('div');
        platformSection.className = 'stats-platform-section';
        platformSection.style.marginBottom = '20px';
        platformSection.style.padding = '15px';
        platformSection.style.border = '1px solid var(--border-color)';
        platformSection.style.borderRadius = '8px';

        let fieldsHTML = '';

        // Helper para crear inputs (general)
        const createInput = (label, key, value) => `
            <div class="form-group">
                <label>${label}</label>
                <input type="number" class="stat-input" data-key="${key}" value="${value || 0}">
            </div>
        `;

        // Helper specific for Time (HMS)
        const createTimeInput = (label, key, value) => `
            <div class="form-group">
                <label>${label}</label>
                <input type="text" class="stat-input" data-key="${key}" value="${formatSecondsToHMS(value)}" placeholder="HH:MM:SS" style="font-family: monospace;">
            </div>
        `;

        // ... inside the loop ...

        // Lógica de campos según Formato (User Request)
        if (format === 'Historia') {
            // Historia: Visualizaciones, Reacciones, Mensajes Directos
            fieldsHTML = `
            <div class="form-row">
                ${createInput('Visualizaciones', 'views', metrics.views)}
                ${createInput('Reacciones (Likes)', 'likes', metrics.likes)}
            </div>
            <div class="form-row">
                ${createInput('Mensajes Directos', 'messages', metrics.messages)}
            </div>
        `;
        } else if (format === 'Carrusel') {
            // Carrusel: No tiempo promedio, no mensajes, no ventas
            fieldsHTML = `
            <div class="form-row">
                ${createInput('Seguidores Obtenidos', 'followers', metrics.followers)}
                ${createInput('Visualizaciones', 'views', metrics.views)}
            </div>
                <div class="form-row">
                    ${createInput('Likes', 'likes', metrics.likes)}
                    ${createInput('Comentarios', 'comments', metrics.comments)}
                </div>
                <div class="form-row">
                    ${createInput('Compartidos', 'shares', metrics.shares)}
                    ${createInput('Guardados', 'saves', metrics.saves)}
                </div>
        `;
        } else if (format === 'Reel') {
            fieldsHTML = `
            <div class="form-row">
                ${createInput('Seguidores Obtenidos', 'followers', metrics.followers)}
                ${createInput('Visualizaciones', 'views', metrics.views)}
            </div>
                <div class="form-row">
                    ${createInput('Likes', 'likes', metrics.likes)}
                    ${createInput('Comentarios', 'comments', metrics.comments)}
                </div>
                <div class="form-row">
                    ${createInput('Compartidos', 'shares', metrics.shares)}
                    ${createInput('Guardados', 'saves', metrics.saves)}
                </div>
                <div class="form-row">
                     ${createInput('Tiempo Total Video (seg)', 'total_duration', metrics.total_duration)}
                    ${createInput('Tiempo Promedio Visualización (seg)', 'avg_watch_time', metrics.avg_watch_time)}
                </div>
                <div class="form-row">
                    ${createTimeInput('Tiempo Total Reproducción (HH:MM:SS)', 'total_playback_time', metrics.total_playback_time)}
                </div>
        `;
        } else {
            // Fallback genérico
            fieldsHTML = `
            <div class="form-row">
                ${createInput('Vistas/Impresiones', 'views', metrics.views)}
                ${createInput('Interacciones', 'interactions', metrics.interactions || (metrics.likes || 0))}
            </div>
            `;
        }

        platformSection.innerHTML = `<h4 style="margin-bottom: 15px; color: var(--primary); text-transform: uppercase; font-size: 0.9rem;">${platform} <small style="color:var(--text-secondary); text-transform:none;">(${format})</small></h4> <div class="platform-inputs" data-platform="${platform}">${fieldsHTML}</div>`;
        container.appendChild(platformSection);
    });

    openModal('statsModal');
}

async function saveStatistics() {
    const btn = document.getElementById('saveStatsBtn');
    const guionId = parseInt(btn.dataset.guionId);
    const container = document.getElementById('statsFormsContainer');
    const sections = container.querySelectorAll('.platform-inputs');

    btn.textContent = 'Guardando...';
    btn.disabled = true;

    try {
        const newStats = [];
        for (const section of sections) {
            const platform = section.dataset.platform;
            const inputs = section.querySelectorAll('.stat-input');
            const metrics = {};
            inputs.forEach(input => {
                const key = input.dataset.key;
                if (key === 'total_playback_time') {
                    const val = input.value;
                    metrics[key] = val.includes(':') ? parseHMSToSeconds(val) : (parseFloat(val) || 0);
                } else {
                    metrics[key] = parseFloat(input.value) || 0;
                }
            });

            if (metrics.views > 0) {
                let interactions = (metrics.likes || 0) + (metrics.comments || 0) + (metrics.shares || 0) + (metrics.saves || 0);
                if (metrics.interactions) interactions = metrics.interactions;
                metrics.engagement_rate = ((interactions / metrics.views) * 100).toFixed(2);
            } else {
                metrics.engagement_rate = 0;
            }

            if (IS_LOCAL_MODE) {
                newStats.push({ guion_id: guionId, platform: platform, metrics: metrics });
            } else {
                await fetch(`/api/data?action=saveStatistic&workspace=${currentWorkspace}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ guionId: guionId, platform: platform, metrics: metrics })
                });
            }
        }

        if (IS_LOCAL_MODE) {
            statistics = statistics.filter(s => s.guion_id !== guionId);
            statistics = [...statistics, ...newStats];
            localStorage.setItem(`local_stats_${currentWorkspace}`, JSON.stringify(statistics));
            await new Promise(r => setTimeout(r, 200));
            renderStatisticsUI();
            closeModal('statsModal');
            alert('Estadísticas guardadas LOCALMENTE');
        } else {
            const statsRes = await fetch(`/api/data?action=getStatistics&workspace=${currentWorkspace}`);
            if (statsRes.ok) {
                statistics = await statsRes.json();
                renderStatisticsUI();
                closeModal('statsModal');
                alert('Estadísticas guardadas correctamente');
            }
        }
    } catch (e) {
        console.error(e);
        alert('Error al guardar estadísticas');
    } finally {
        btn.textContent = 'Guardar Estadísticas';
        btn.disabled = false;
    }
}

// Función para validar que las métricas tengan datos significativos
function hasSignificantData(metrics) {
    // Verificar que al menos tenga vistas > 0
    return (metrics.views || 0) > 0;
}

function renderStatsCharts() {
    const chartsGrid = document.getElementById('statsChartsGrid');
    if (!chartsGrid) return;
    chartsGrid.innerHTML = '';

    // FIX: Aplicar filtro de plataforma a las plataformas activas
    let activePlatforms;
    if (currentStatsFilterPlatform !== 'all') {
        // Si hay filtro de plataforma, solo mostrar esa plataforma
        activePlatforms = [currentStatsFilterPlatform];
    } else {
        // Mostrar todas las plataformas activas
        activePlatforms = [...new Set(statistics.map(s => s.platform))];
    }
    if (activePlatforms.length === 0) return;
    // Destruir charts previos
    Object.values(chartInstances).forEach(chart => chart.destroy());
    chartInstances = {};

    // Filtrar estadísticas globales una sola vez
    const filteredStats = statistics.filter(s => {
        const guion = guiones.find(g => g.id === s.guion_id);
        if (!guion || guion.estado !== 'Publicado') return false;

        let gDate;
        try { gDate = new Date(guion.fecha + 'T12:00:00'); } catch (e) { return false; }

        if (currentStatsFilterMonth !== 'all' && gDate.getMonth() !== parseInt(currentStatsFilterMonth)) return false;
        if (currentStatsFilterYear !== 'all' && gDate.getFullYear() !== parseInt(currentStatsFilterYear)) return false;
        if (currentStatsFilterFormat !== 'all' && (guion.formato || 'Carrusel') !== currentStatsFilterFormat) return false;
        if (currentStatsFilterPlatform !== 'all' && s.platform !== currentStatsFilterPlatform) return false;

        // Validar que tenga datos significativos
        if (!hasSignificantData(s.metrics)) return false;

        return true;
    });

    // 1. Gráfico Unificado: Vistas/Engagement (adapta según filtro)
    const unifiedCanvas = document.createElement('canvas');
    unifiedCanvas.id = 'chart-unified';

    const unifiedCard = document.createElement('div');
    unifiedCard.className = 'chart-card';
    unifiedCard.style.cssText = 'background: var(--bg-secondary); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color);';

    const unifiedContainer = document.createElement('div');
    unifiedContainer.style.position = 'relative';
    unifiedContainer.style.height = '300px';
    unifiedContainer.style.width = '100%';
    unifiedContainer.appendChild(unifiedCanvas);

    unifiedCard.appendChild(unifiedContainer);
    chartsGrid.appendChild(unifiedCard);

    const ctxUnified = unifiedCanvas.getContext('2d');

    // Determinar qué mostrar según el filtro de plataforma
    if (currentStatsFilterPlatform === 'all') {
        // Modo: Vistas por Plataforma + Engagement Promedio
        unifiedCard.insertBefore(
            Object.assign(document.createElement('h3'), {
                textContent: 'Vistas por Plataforma',
                style: 'margin-bottom: 15px;'
            }),
            unifiedContainer
        );

        // Determine active platforms based on filteredStats
        const allPlatforms = [...new Set(filteredStats.map(s => s.platform))];

        const viewsByPlatform = {};
        allPlatforms.forEach(p => {
            viewsByPlatform[p] = filteredStats
                .filter(s => s.platform === p)
                .reduce((sum, s) => sum + (s.metrics.views || 0), 0);
        });

        // Filtrar solo plataformas con vistas > 0
        const activePlatforms = allPlatforms.filter(p => viewsByPlatform[p] > 0);

        // Colores corporativos
        const platformColors = {
            'Instagram': '#e1306c',
            'TikTok': '#00f2ea',
            'Facebook': '#1877f2'
        };

        chartInstances['unified'] = new Chart(ctxUnified, {
            type: 'doughnut',
            data: {
                labels: activePlatforms,
                datasets: [{
                    data: activePlatforms.map(p => viewsByPlatform[p]),
                    backgroundColor: activePlatforms.map(p => platformColors[p] || '#14b8a6'),
                    borderColor: 'var(--bg-secondary)',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#94a3b8', font: { size: 12 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed.toLocaleString()} vistas (${percentage}%)`;
                            }
                        }
                    },
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold', size: 14 },
                        formatter: (value) => value.toLocaleString()
                    }
                }
            }
        });
    } else {
        // Modo: Vistas por Reel Individual (filtrado por plataforma)
        unifiedCard.insertBefore(
            Object.assign(document.createElement('h3'), {
                textContent: `Rendimiento de Reels - ${currentStatsFilterPlatform}`,
                style: 'margin-bottom: 15px;'
            }),
            unifiedContainer
        );

        // Obtener reels individuales de la plataforma seleccionada
        const reelStats = filteredStats.filter(s => s.platform === currentStatsFilterPlatform);

        const labels = [];
        const viewsData = [];
        const engagementData = [];

        reelStats.forEach(stat => {
            const guion = guiones.find(g => g.id === stat.guion_id);
            if (guion) {
                labels.push(guion.titulo.length > 20 ? guion.titulo.substring(0, 20) + '...' : guion.titulo);
                viewsData.push(stat.metrics.views || 0);
                engagementData.push(parseFloat(stat.metrics.engagement_rate) || 0);
            }
        });

        // Color corporativo de la plataforma seleccionada
        const platformColor = {
            'Instagram': '#e1306c',
            'TikTok': '#00f2ea',
            'Facebook': '#1877f2'
        }[currentStatsFilterPlatform] || '#14b8a6';

        chartInstances['unified'] = new Chart(ctxUnified, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Vistas',
                        data: viewsData,
                        backgroundColor: platformColor,
                        borderColor: platformColor,
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Engagement (%)',
                        data: engagementData,
                        backgroundColor: 'rgba(148, 163, 184, 0.7)',
                        borderColor: '#94a3b8',
                        borderWidth: 2,
                        yAxisID: 'y1',
                        type: 'line'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    y: {
                        type: 'linear',
                        position: 'left',
                        grid: { color: 'rgba(148, 163, 184, 0.1)' },
                        ticks: { color: '#94a3b8' },
                        title: {
                            display: true,
                            text: 'Vistas',
                            color: '#94a3b8'
                        }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        grid: { display: false },
                        ticks: {
                            color: '#94a3b8',
                            callback: function (value) {
                                return value + '%';
                            }
                        },
                        title: {
                            display: true,
                            text: 'Engagement %',
                            color: '#94a3b8'
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#94a3b8' }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.datasetIndex === 1) {
                                    label += context.parsed.y.toFixed(2) + '%';
                                } else {
                                    label += context.parsed.y.toLocaleString() + ' vistas';
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    // 3. Gráfico de Crecimiento de Seguidores por Mes (Line Chart)
    const followersCanvas = document.createElement('canvas');
    followersCanvas.id = 'chart-followers-growth';

    const followersCard = document.createElement('div');
    followersCard.className = 'chart-card';
    followersCard.style.cssText = 'background: var(--bg-secondary); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color);';
    followersCard.innerHTML = `<h3 style="margin-bottom: 15px;">Crecimiento Acumulativo de Seguidores</h3>`;

    const followersContainer = document.createElement('div');
    followersContainer.style.position = 'relative';
    followersContainer.style.height = '300px';
    followersContainer.style.width = '100%';
    followersContainer.appendChild(followersCanvas);

    followersCard.appendChild(followersContainer);
    chartsGrid.appendChild(followersCard);

    // Preparar datos mensuales
    const monthlyData = calculateMonthlyFollowers();

    // Construir datasets dinámicamente según filtro de plataforma
    const datasets = [];

    // Ahora agregamos todas las redes siempre, o filtramos según la plataforma seleccionada
    // PERO conservamos la lógica de colores y el cambio de TikTok a blanco

    if (currentStatsFilterPlatform === 'all' || currentStatsFilterPlatform === 'Instagram') {
        datasets.push({
            label: 'Instagram',
            data: monthlyData.instagram,
            borderColor: '#e1306c',
            backgroundColor: 'rgba(225, 48, 108, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
        });
    }

    if (currentStatsFilterPlatform === 'all' || currentStatsFilterPlatform === 'TikTok') {
        datasets.push({
            label: 'TikTok',
            data: monthlyData.tiktok,
            borderColor: '#ffffff', // COLOR CAMBIADO A BLANCO
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
        });
    }

    if (currentStatsFilterPlatform === 'all' || currentStatsFilterPlatform === 'Facebook') {
        datasets.push({
            label: 'Facebook',
            data: monthlyData.facebook,
            borderColor: '#1877f2',
            backgroundColor: 'rgba(24, 119, 242, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
        });
    }

    const ctxFollowers = followersCanvas.getContext('2d');
    chartInstances['followers-growth'] = new Chart(ctxFollowers, {
        type: 'line',
        data: {
            labels: monthlyData.labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#94a3b8', padding: 15, font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.dataset.label || '';
                            const currentValue = context.parsed.y || 0;
                            const dataIndex = context.dataIndex;
                            let dailyGain = currentValue;

                            if (dataIndex > 0) {
                                const previousValue = context.dataset.data[dataIndex - 1] || 0;
                                dailyGain = currentValue - previousValue;
                            }

                            return [
                                `${label}: `,
                                `  Ganaste hoy: +${dailyGain.toLocaleString()} `,
                                `  Total acumulado: ${currentValue.toLocaleString()} `
                            ];
                        },
                        footer: function (tooltipItems) {
                            return 'Incluye reels + orgánicos';
                        }
                    }
                }
            }
        }
    });

    // 4. Gráfico de Duración y Retención (Reels) - Primera Gráfica
    // Solo mostrar si hay datos de Reels con información de tiempo
    const reelRetentionStats = filteredStats.filter(s => {
        const guion = guiones.find(g => g.id === s.guion_id);
        return guion && guion.formato === 'Reel' && (s.metrics.total_duration > 0 || s.metrics.avg_watch_time > 0);
    });

    // Ordenar cronológicamente
    reelRetentionStats.sort((a, b) => {
        const gA = guiones.find(g => g.id === a.guion_id);
        const gB = guiones.find(g => g.id === b.guion_id);
        return new Date(gA.fecha) - new Date(gB.fecha);
    });

    if (reelRetentionStats.length > 0) {
        // PRIMERA GRÁFICA: Duración y Retención
        const durationCanvas = document.createElement('canvas');
        durationCanvas.id = 'chart-duration-retention';

        const durationCard = document.createElement('div');
        durationCard.className = 'chart-card';
        durationCard.style.cssText = 'background: var(--bg-secondary); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color);';
        durationCard.innerHTML = `<h3 style="margin-bottom: 15px;">Duración y Retención (Reels)</h3>`;

        const durationContainer = document.createElement('div');
        durationContainer.style.position = 'relative';
        durationContainer.style.height = '300px';
        durationContainer.style.width = '100%';
        durationContainer.appendChild(durationCanvas);

        durationCard.appendChild(durationContainer);
        chartsGrid.appendChild(durationCard);

        const labels = [];
        const durationData = [];
        const watchTimeData = [];

        reelRetentionStats.forEach(s => {
            const guion = guiones.find(g => g.id === s.guion_id);
            labels.push(guion.titulo.length > 15 ? guion.titulo.substring(0, 15) + '...' : guion.titulo);

            const total = parseFloat(s.metrics.total_duration || 0);
            const avg = parseFloat(s.metrics.avg_watch_time || 0);

            durationData.push(total);
            watchTimeData.push(avg);
        });

        const ctxDuration = durationCanvas.getContext('2d');
        chartInstances['duration-retention'] = new Chart(ctxDuration, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Duración Video',
                        data: durationData,
                        backgroundColor: 'rgba(59, 130, 246, 0.7)', // Blue
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.8
                    },
                    {
                        label: 'Tiempo Promedio Visto',
                        data: watchTimeData,
                        backgroundColor: 'rgba(16, 185, 129, 0.7)', // Green
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: {
                            color: '#94a3b8',
                            callback: function (value) {
                                return formatSecondsToHMS(value);
                            }
                        },
                        title: { display: true, text: 'Tiempo (HH:MM:SS)', color: '#94a3b8' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#94a3b8', font: { size: 12 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const seconds = context.parsed.y;
                                const label = context.dataset.label;
                                return `${label}: ${formatSecondsToHMS(seconds)}`;
                            }
                        }
                    }
                }
            }
        });
    }

    // 5. Gráfico de Tiempo Total de Reproducción (Reels) - Desglosado por Plataforma
    // Agrupar stats por guion para tener desglose
    const guionStatsMap = {};

    filteredStats.forEach(s => {
        const guion = guiones.find(g => g.id === s.guion_id);
        if (guion && guion.formato === 'Reel' && s.metrics.total_playback_time > 0) {
            if (!guionStatsMap[guion.id]) {
                guionStatsMap[guion.id] = {
                    title: guion.titulo,
                    fecha: guion.fecha,
                    Instagram: 0,
                    TikTok: 0,
                    Facebook: 0
                };
            }
            // Normalizar nombre de plataforma si es necesario
            const p = s.platform;
            if (guionStatsMap[guion.id].hasOwnProperty(p)) {
                guionStatsMap[guion.id][p] += parseFloat(s.metrics.total_playback_time || 0);
            }
        }
    });

    const sortedGuions = Object.values(guionStatsMap).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    if (sortedGuions.length > 0) {
        const playbackCanvas = document.createElement('canvas');
        playbackCanvas.id = 'chart-total-playback';

        const playbackCard = document.createElement('div');
        playbackCard.className = 'chart-card';
        playbackCard.style.cssText = 'background: var(--bg-secondary); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color);';
        playbackCard.innerHTML = `<h3 style="margin-bottom: 15px;">Tiempo Total de Reproducción (Reels)</h3>`;

        const playbackContainer = document.createElement('div');
        playbackContainer.style.position = 'relative';
        playbackContainer.style.height = '300px';
        playbackContainer.style.width = '100%';
        playbackContainer.appendChild(playbackCanvas);

        playbackCard.appendChild(playbackContainer);
        chartsGrid.appendChild(playbackCard);

        // Forzar grid de 2 columnas si hay suficientes gráficas. minmax(0, 1fr) evita desbordamiento.
        chartsGrid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';

        const playbackLabels = sortedGuions.map(g => g.title.length > 15 ? g.title.substring(0, 15) + '...' : g.title);
        const dataIG = sortedGuions.map(g => g.Instagram);
        const dataTK = sortedGuions.map(g => g.TikTok);
        const dataFB = sortedGuions.map(g => g.Facebook);

        const ctxPlayback = playbackCanvas.getContext('2d');
        chartInstances['total-playback'] = new Chart(ctxPlayback, {
            type: 'bar',
            data: {
                labels: playbackLabels,
                datasets: [
                    {
                        label: 'Instagram',
                        data: dataIG,
                        backgroundColor: '#e1306c',
                        stack: 'Stack 0',
                        borderRadius: 4
                    },
                    {
                        label: 'TikTok',
                        data: dataTK,
                        backgroundColor: '#000000', // O un color oscuro visible en tema oscuro -> #25F4EE (cyan) o #FE2C55 (red) de tiktok? User usa tema oscuro?
                        // TikTok branding: Black secondary, Cyan/Red accents. 
                        // Negro puro en tema oscuro no se ve. Usaré un gris muy oscuro o el Cyan de TikTok #00f2ea ?
                        // Mejor usar el standar: #69C9D0 (cyan-ish) para contraste o blanco/gris?
                        // El código anterior usaba negro? No, no había desglose.
                        // Usaré el color del texto secundario o un Teal.
                        // TikTok oficial: #000000 (black) y #FFFFFF (white).
                        backgroundColor: '#25F4EE', // Cyan TikTok
                        stack: 'Stack 0',
                        borderRadius: 4
                    },
                    {
                        label: 'Facebook',
                        data: dataFB,
                        backgroundColor: '#1877F2',
                        stack: 'Stack 0',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: {
                            color: '#94a3b8',
                            callback: function (value) {
                                return formatSecondsToHMS(value);
                            }
                        },
                        title: { display: true, text: 'Tiempo (HH:MM:SS)', color: '#94a3b8' }
                    },
                    x: {
                        stacked: true,
                        grid: { display: false },
                        ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#94a3b8' }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const seconds = context.parsed.y;
                                const label = context.dataset.label;
                                return `${label}: ${formatSecondsToHMS(seconds)}`;
                            },
                            footer: function (tooltipItems) {
                                const total = tooltipItems.reduce((a, e) => a + e.parsed.y, 0);
                                return 'Total: ' + formatSecondsToHMS(total);
                            }
                        }
                    }
                }
            }
        });
    }
}


// Función para calcular seguidores ACUMULATIVOS día a día (reels + orgánicos - perdidos)
function calculateMonthlyFollowers() {
    // 1. Recolectar todas las fechas de reels publicados y totales mensuales
    const allDatesSet = new Set();

    // De Reels
    guiones.filter(g => g.estado === 'Publicado' && g.formato === 'Reel').forEach(g => {
        try { allDatesSet.add(g.fecha); } catch (e) { }
    });

    // De Totales Mensuales (soporte para key antigua y nueva)
    Object.entries(globalBusinessStats).forEach(([monthStr, data]) => {
        if (data.savedDate) {
            // Limpiar espacios si vienen de formato antiguo
            const cleanDate = data.savedDate.replace(/\s+/g, '');
            allDatesSet.add(cleanDate);
        }
    });

    const sortedDates = Array.from(allDatesSet).sort();
    if (sortedDates.length === 0) return { labels: [], instagram: [], tiktok: [], facebook: [] };

    // 2. Definir Rango de Fechas para VISUALIZACIÓN
    // Pero primero necesitamos calcular el ACUMULADO HISTÓRICO hasta la fecha de inicio

    let startDateForView;
    const firstDateEver = new Date(sortedDates[0] + 'T12:00:00');

    if (currentStatsFilterMonth !== 'all') {
        const filterMonth = parseInt(currentStatsFilterMonth);
        const filterYear = currentStatsFilterYear !== 'all' ? parseInt(currentStatsFilterYear) : new Date().getFullYear();
        startDateForView = new Date(filterYear, filterMonth, 1);
    } else if (currentStatsFilterYear !== 'all') {
        startDateForView = new Date(parseInt(currentStatsFilterYear), 0, 1);
    } else {
        startDateForView = new Date(firstDateEver.getFullYear(), firstDateEver.getMonth(), 1);
    }

    // 3. Calcular Acumulado Inicial (Todo lo anterior a startDateForView)
    let igAccumulator = 0;
    let tkAccumulator = 0;
    let fbAccumulator = 0;

    // Recorrer TODAS las fechas cronológicamente para sumar el historial
    // Solo nos importa el valor final acumulado justo antes de startDateForView

    sortedDates.forEach(dateStr => {
        const currentDate = new Date(dateStr + 'T12:00:00');

        // Si la fecha es igual o posterior al inicio de la vista, no la procesamos aquí, 
        // se procesará en el loop de visualización. 
        // EXCEPCIÓN: Si no hay filtro, startDateForView es la primera fecha, asi que el acumulado inicial es 0.
        if (currentDate >= startDateForView) return;

        // Sumar Reels de este día pasado
        const guionesDay = guiones.filter(g => g.estado === 'Publicado' && g.formato === 'Reel' && g.fecha === dateStr);
        guionesDay.forEach(g => {
            g.plataformas.forEach(platform => {
                const stat = statistics.find(s => s.guion_id === g.id && s.platform === platform);
                if (stat && stat.metrics.followers) {
                    if (platform === 'Instagram') igAccumulator += stat.metrics.followers;
                    else if (platform === 'TikTok') tkAccumulator += stat.metrics.followers;
                    else if (platform === 'Facebook') fbAccumulator += stat.metrics.followers;
                }
            });
        });

        // Sumar Resultados Orgánicos (y restar perdidos) de este mes pasado
        Object.entries(globalBusinessStats).forEach(([mStr, data]) => {
            const cleanSavedDate = (data.savedDate || '').replace(/\s+/g, '');
            if (cleanSavedDate === dateStr) {
                igAccumulator += (data.ig?.followersOrganic || 0) - (data.ig?.followersLost || 0);
                tkAccumulator += (data.tk?.followersOrganic || 0) - (data.tk?.followersLost || 0);
                fbAccumulator += (data.fb?.followersOrganic || 0) - (data.fb?.followersLost || 0);
            }
        });
    });

    // 4. Filtrar fechas para Visualización
    const viewDates = sortedDates.filter(dateStr => {
        const date = new Date(dateStr + 'T12:00:00');
        return date >= startDateForView &&
            (currentStatsFilterYear === 'all' || date.getFullYear() === parseInt(currentStatsFilterYear)) &&
            (currentStatsFilterMonth === 'all' || date.getMonth() === parseInt(currentStatsFilterMonth));
    });

    // Asegurar que la fecha de inicio esté presente para graficar el punto de partida
    const startStr = startDateForView.toISOString().split('T')[0];
    if (!viewDates.includes(startStr) && viewDates.length > 0) {
        // Solo agregar si está dentro del rango lógico (esto es visualmente mejor)
        // O simplemente empezamos a graficar desde el primer dato DISPONIBLE en el rango.
        // Opción: Agregar el día 1 del mes con el valor acumulado.
        viewDates.unshift(startStr);
        viewDates.sort();
    } else if (viewDates.length === 0) {
        // Si no hay datos en el mes, mostramos al menos el día 1 con el acumulado
        viewDates.push(startStr);
    }

    const labels = [];
    const instagramData = [];
    const tiktokData = [];
    const facebookData = [];

    // 5. Procesar rango de visualización
    viewDates.forEach(dateStr => {
        // Formatear label
        const date = new Date(dateStr + 'T12:00:00');
        const day = date.getDate();
        const monthName = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][date.getMonth()];
        labels.push(`${day} ${monthName}`);

        let igChange = 0;
        let tkChange = 0;
        let fbChange = 0;

        // Sumar Reels de este día
        const guionesDay = guiones.filter(g => g.estado === 'Publicado' && g.formato === 'Reel' && g.fecha === dateStr);
        guionesDay.forEach(g => {
            g.plataformas.forEach(platform => {
                const stat = statistics.find(s => s.guion_id === g.id && s.platform === platform);
                if (stat && stat.metrics.followers) {
                    if (platform === 'Instagram') igChange += stat.metrics.followers;
                    else if (platform === 'TikTok') tkChange += stat.metrics.followers;
                    else if (platform === 'Facebook') fbChange += stat.metrics.followers;
                }
            });
        });

        // Sumar Resultados Orgánicos (y restar perdidos)
        Object.entries(globalBusinessStats).forEach(([mStr, data]) => {
            const cleanSavedDate = (data.savedDate || '').replace(/\s+/g, '');
            if (cleanSavedDate === dateStr) {
                igChange += (data.ig?.followersOrganic || 0) - (data.ig?.followersLost || 0);
                tkChange += (data.tk?.followersOrganic || 0) - (data.tk?.followersLost || 0);
                fbChange += (data.fb?.followersOrganic || 0) - (data.fb?.followersLost || 0);
            }
        });

        // Actualizar Acumuladores
        igAccumulator += igChange;
        tkAccumulator += tkChange;
        fbAccumulator += fbChange;

        // Guardar Puntos en la Gráfica
        instagramData.push(igAccumulator);
        tiktokData.push(tkAccumulator);
        facebookData.push(fbAccumulator);
    });

    return { labels, instagram: instagramData, tiktok: tiktokData, facebook: facebookData };
}

// Función para editar usuario (Cliente Logic)
window.editUser = async function (email) {
    const users = await getUsersFromStorage();
    const user = users[email];

    if (!user) return alert('Usuario no encontrado');

    const modal = document.getElementById('addUserModal');
    // Set text content properly
    const titleEl = document.getElementById('userModalTitle');
    if (titleEl) titleEl.textContent = 'Editar Usuario';

    document.getElementById('newUserEmail').value = email;
    document.getElementById('newUserEmail').disabled = true; // Email es ID
    document.getElementById('newUserName').value = user.name || '';
    document.getElementById('newUserPassword').value = ''; // No mostrar password
    document.getElementById('newUserPassword').placeholder = '(Dejar en blanco para no cambiar)';
    document.getElementById('newUserRole').value = user.role || 'client';

    // Checkboxes
    const container = document.getElementById('userCalendarsContainer');
    // Regenerar checkboxes para asegurar estado limpio
    container.innerHTML = '';
    // Usar la misma lógica de generación que en addUser
    workspaces.forEach(ws => {
        const div = document.createElement('div');
        div.style.marginBottom = '5px';
        const checked = user.canAccess && user.canAccess.includes(ws.name) ? 'checked' : '';
        div.innerHTML = `
            <input type="checkbox" id="access_${ws.name}" value="${ws.name}" ${checked}>
            <label for="access_${ws.name}">${ws.display_name}</label>
        `;
        container.appendChild(div);
    });

    const saveBtn = document.getElementById('saveUserBtn');
    saveBtn.textContent = 'Actualizar';

    // Swapping listener to updates
    const newBtn = saveBtn.cloneNode(true);
    newBtn.removeAttribute('onclick');
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);

    newBtn.addEventListener('click', async () => {
        const name = document.getElementById('newUserName').value.trim();
        const password = document.getElementById('newUserPassword').value;
        const role = document.getElementById('newUserRole').value;

        const canAccess = [];
        container.querySelectorAll('input:checked').forEach(cb => canAccess.push(cb.value));

        if (!name) return alert('Nombre requerido');
        if (canAccess.length === 0) return alert('Selecciona al menos un calendario');

        try {
            await fetch('/api/data?action=updateUser', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    name,
                    role,
                    canAccess,
                    password: password || undefined
                })
            });

            closeModal('addUserModal');
            await renderUsersList();
            alert('Usuario actualizado');

            // Restore modal state for next "New User"
            if (titleEl) titleEl.textContent = 'Nuevo Usuario';
            document.getElementById('newUserEmail').disabled = false;
            document.getElementById('newUserPassword').placeholder = '';
            newBtn.textContent = 'Guardar';
            newBtn.addEventListener('click', window.saveNewUser);

        } catch (e) {
            console.error(e);
            alert('Error al actualizar usuario');
        }
    });

    openModal('addUserModal');
}
