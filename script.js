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
let editingGuionId = null;
let workspaces = []; // Lista de calendarios disponibles

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    initializeModals(); // Inicializar eventos una sola vez
    checkAuthentication();
});

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
        errorMsg.textContent = 'Error: ' + e.message + '. (Si estás en local, usa el link de Vercel)';
        errorMsg.style.display = 'block';
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
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentWorkspace');
        currentUser = null;
        currentWorkspace = null;
        calendarNotes = {};
        guiones = [];

        // Ocultar contenedor principal
        document.getElementById('mainContainer').style.display = 'none';

        // Mostrar login
        showLoginScreen();
    }
}

// Cargar workspaces desde la base de datos
async function loadWorkspaces() {
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
            // Fallback a workspaces por defecto
            workspaces = [
                { name: 'personal', display_name: 'Personal' },
                { name: 'maacline', display_name: 'MAAC Line' }
            ];
        }
    } catch (e) {
        console.error('Error al cargar workspaces:', e);
        // Fallback a workspaces por defecto
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
        const icon = ws.name === 'personal'
            ? `<svg class="workspace-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
               </svg>`
            : `<svg class="workspace-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
               </svg>`;

        button.innerHTML = `
            ${icon}
            <div class="workspace-name">${ws.display_name}</div>
            <div class="workspace-desc">Calendario ${ws.display_name.toLowerCase()}</div>
        `;

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
    initializeApp();
}

// Cambiar workspace
function changeWorkspace() {
    if (confirm('¿Estás seguro de que quieres cambiar de calendario? Los datos actuales se guardarán automáticamente.')) {
        currentWorkspace = null;
        sessionStorage.removeItem('currentWorkspace');

        // Limpiar estado actual
        calendarNotes = {};
        guiones = [];

        showWorkspaceSelector();
    }
}

// Inicializar la aplicación
async function initializeApp() {
    await loadData();
    initializeControls();
    initializeTabs();
    // initializeModals(); // ELIMINADO: Ya se inicializa al cargar la página
    renderCalendar();
    renderGuiones();
    setCurrentMonthYear();
    updateWorkspaceTitle();
    updateUserInfo();

    // Mostrar el contenedor principal
    document.getElementById('mainContainer').style.display = 'block';
}

// Cargar datos del servidor
async function loadData() {
    try {
        // Cargar Notas
        const notesRes = await fetch(`/api/data?action=getNotes&workspace=${currentWorkspace}`);
        calendarNotes = await notesRes.json();

        // Cargar Guiones
        const guionesRes = await fetch(`/api/data?action=getGuiones&workspace=${currentWorkspace}`);
        guiones = await guionesRes.json();

    } catch (e) {
        console.error("Error al cargar datos de Neon DB:", e);
        calendarNotes = {};
        guiones = [];
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
        if (btnWorkspaces) btnWorkspaces.style.display = 'flex';
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
        });
    });
}

// Inicializar modales
function initializeModals() {
    // Modal de día
    const dayModal = document.getElementById('dayModal');
    const closeBtns = dayModal.querySelectorAll('.modal-close');
    const saveDayBtn = document.getElementById('saveDayBtn');
    const deleteDayBtn = document.getElementById('deleteDayBtn');

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            dayModal.classList.remove('active');
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
            guionModal.classList.remove('active');
            resetGuionForm();
        });
    });

    addGuionBtn.addEventListener('click', () => {
        editingGuionId = null;
        resetGuionForm();
        document.getElementById('guionModalTitle').textContent = 'Nuevo Guión';
        guionModal.classList.add('active');
    });

    saveGuionBtn.addEventListener('click', saveGuion);

    // Filtro de mes en guiones
    const filterMonth = document.getElementById('filterMonth');
    filterMonth.addEventListener('change', renderGuiones);

    // Cerrar modal al hacer clic fuera
    dayModal.addEventListener('click', (e) => {
        if (e.target === dayModal) {
            dayModal.classList.remove('active');
        }
    });

    guionModal.addEventListener('click', (e) => {
        if (e.target === guionModal) {
            guionModal.classList.remove('active');
            resetGuionForm();
        }
    });

    // Modal de vista de guión
    const viewGuionModal = document.getElementById('viewGuionModal');
    const closeViewBtns = viewGuionModal.querySelectorAll('.modal-close-view-guion');

    closeViewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            viewGuionModal.classList.remove('active');
        });
    });

    viewGuionModal.addEventListener('click', (e) => {
        if (e.target === viewGuionModal) {
            viewGuionModal.classList.remove('active');
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

        if (dayGuiones.length > 0) {
            dayCell.classList.add('has-guion');
            const guionesTitles = dayGuiones.map(g => `
                <div class="guion-item">
                    <span class="guion-bullet">•</span> ${g.titulo}
                </div>
            `).join('');
            contentHTML = `<div class="day-guiones">${guionesTitles}</div>`;
        }

        // Mostrar notas (si hay)
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

        if (!contentHTML) {
            contentHTML = '<div class="day-note" style="color: var(--text-tertiary); font-style: italic;">Clic para agregar</div>';
        }

        dayCell.innerHTML = `
            <div class="day-number">${day}</div>
            ${contentHTML}
        `;

        dayCell.addEventListener('click', () => openDayModal(day));

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

    // Controlar visibilidad del botón de agregar guión
    const addGuionBtn = document.getElementById('addGuionBtn');
    if (addGuionBtn) {
        addGuionBtn.style.display = currentUser.role === 'client' ? 'none' : 'flex';
    }

    grid.innerHTML = '';

    // Filtrar guiones
    let filteredGuiones = guiones;
    if (filterMonth !== 'all') {
        filteredGuiones = guiones.filter(guion => {
            const [year, month, day] = guion.fecha.split('-');
            const guionMonth = parseInt(month) - 1;
            return guionMonth === parseInt(filterMonth);
        });
    }

    // Ordenar por fecha
    filteredGuiones.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    if (filteredGuiones.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">
                No hay guiones para mostrar. ${currentUser.role !== 'client' ? '¡Haz clic en "Nuevo Guión" para empezar!' : ''}
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

    const checkboxes = document.querySelectorAll('input[name="plataforma"]:checked');
    const plataformas = Array.from(checkboxes).map(cb => cb.value);

    const estado = document.getElementById('guionEstado').value;
    const notas = document.getElementById('guionNotas').value.trim();

    if (!fecha || !titulo) {
        alert('Por favor completa al menos la fecha y el título');
        return;
    }

    const guion = {
        id: editingGuionId,
        fecha,
        titulo,
        contenido,
        formato,
        plataformas,
        estado,
        notas
    };

    try {
        const response = await fetch(`/api/data?action=saveGuion&workspace=${currentWorkspace}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(guion)
        });

        if (response.ok) {
            await loadData();
            renderCalendar();
            renderGuiones();
            document.getElementById('guionModal').classList.remove('active');
            resetGuionForm();
        }
    } catch (e) {
        console.error("Error al guardar guión:", e);
    }
}

// Ver guión (solo lectura)
function viewGuion(id) {
    const guion = guiones.find(g => g.id === id);
    if (!guion) return;

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

    // Mostrar notas
    document.getElementById('viewGuionNotas').textContent = guion.notas || 'Sin notas';

    // Abrir modal
    document.getElementById('viewGuionModal').classList.add('active');
}

// Editar guión
function editGuion(id) {
    if (currentUser.role === 'client') return;

    const guion = guiones.find(g => g.id === id);
    if (!guion) return;

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
    document.getElementById('guionNotas').value = guion.notas;

    document.getElementById('guionModalTitle').textContent = 'Editar Guión';
    document.getElementById('guionModal').classList.add('active');
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
                        <th style="width: 15%;">Plano</th>
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
            <td><input type="text" placeholder="1" value="${data?.slide || ''}" /></td>
            <td><textarea placeholder="Descripción de imagen..." rows="2">${data?.imagen || ''}</textarea></td>
            <td><textarea placeholder="Descripción detallada..." rows="2">${data?.descripcion || ''}</textarea></td>
            <td><textarea placeholder="Texto overlay..." rows="2">${data?.texto || ''}</textarea></td>
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
            <td><input type="text" placeholder="1" value="${data?.escena || ''}" /></td>
            <td><input type="text" placeholder="Plano general..." value="${data?.plano || ''}" /></td>
            <td><textarea placeholder="Descripción del video..." rows="2">${data?.descripcion || ''}</textarea></td>
            <td><textarea placeholder="Diálogo o voz en off..." rows="2">${data?.dialogo || ''}</textarea></td>
            <td><textarea placeholder="Música, efectos..." rows="2">${data?.audio || ''}</textarea></td>
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
// Mostrar modal de gestión de usuarios
// Mostrar modal de gestión de usuarios
function showUserManagement() {
    if (currentUser.role !== 'admin') {
        alert('No tienes permisos para gestionar usuarios');
        return;
    }

    renderUsersList();
    document.getElementById('userManagementModal').classList.add('active');

    // Inicializar eventos de modales si no se han inicializado
    initializeUserModals();
}

// Inicializar modales de usuarios
function initializeUserModals() {
    const userMgmtModal = document.getElementById('userManagementModal');
    const addUserModal = document.getElementById('addUserModal');

    // Cerrar modal de gestión
    const closeMgmtBtns = userMgmtModal.querySelectorAll('.modal-close-users');
    closeMgmtBtns.forEach(btn => {
        btn.onclick = () => {
            userMgmtModal.classList.remove('active');
        };
    });

    // Cerrar modal de agregar usuario
    const closeUserBtns = addUserModal.querySelectorAll('.modal-close-user');
    closeUserBtns.forEach(btn => {
        btn.onclick = () => {
            addUserModal.classList.remove('active');
        };
    });

    // Botón agregar usuario
    document.getElementById('addUserBtn').onclick = () => {
        document.getElementById('userModalTitle').textContent = 'Nuevo Usuario';
        document.getElementById('newUserEmail').value = '';
        document.getElementById('newUserPassword').value = '';
        document.getElementById('newUserName').value = '';
        document.getElementById('newUserRole').value = 'client';
        renderUserCalendarsCheckboxes();
        addUserModal.classList.add('active');
    };

    // Guardar usuario
    document.getElementById('saveUserBtn').onclick = saveNewUser;
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
                    <button onclick="deleteUser('${email}')" class="btn-icon btn-delete" style="flex-shrink: 0;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    html += '</div>';
    usersList.innerHTML = html;
}

// Guardar nuevo usuario
async function saveNewUser() {
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const name = document.getElementById('newUserName').value.trim();
    const role = document.getElementById('newUserRole').value;
    const accessPersonal = document.getElementById('accessPersonal').checked;
    const accessMaacline = document.getElementById('accessMaacline').checked;

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

    document.getElementById('addUserModal').classList.remove('active');
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
// Mostrar modal de gestión de calendarios
// Mostrar modal de gestión de calendarios
function showWorkspaceManagement() {
    if (currentUser.role !== 'admin') {
        alert('No tienes permisos para gestionar calendarios');
        return;
    }

    renderWorkspacesList();
    document.getElementById('workspaceManagementModal').classList.add('active');
    initializeWorkspaceModals();
}

// Inicializar modales de calendarios
function initializeWorkspaceModals() {
    const workspaceMgmtModal = document.getElementById('workspaceManagementModal');
    const addWorkspaceModal = document.getElementById('addWorkspaceModal');

    // Cerrar modal de gestión
    const closeMgmtBtns = workspaceMgmtModal.querySelectorAll('.modal-close-workspaces');
    closeMgmtBtns.forEach(btn => {
        btn.onclick = () => {
            workspaceMgmtModal.classList.remove('active');
        };
    });

    // Cerrar modal de agregar calendario
    const closeWorkspaceBtns = addWorkspaceModal.querySelectorAll('.modal-close-workspace');
    closeWorkspaceBtns.forEach(btn => {
        btn.onclick = () => {
            addWorkspaceModal.classList.remove('active');
        };
    });

    // Botón agregar calendario
    document.getElementById('addWorkspaceBtn').onclick = () => {
        document.getElementById('newWorkspaceName').value = '';
        document.getElementById('newWorkspaceDisplayName').value = '';
        addWorkspaceModal.classList.add('active');
    };

    // Guardar calendario
    document.getElementById('saveWorkspaceBtn').onclick = createNewWorkspace;
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
        const isDefault = ws.name === 'personal' || ws.name === 'maacline';
        const deleteBtn = isDefault
            ? ''
            : `<button onclick="deleteWorkspace(${ws.id})" class="btn-icon btn-delete" style="flex-shrink: 0;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>`;

        html += `
            <div style="background: var(--bg-tertiary); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${ws.display_name}</div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 4px;">ID: ${ws.name}</div>
                        ${isDefault ? '<div style="font-size: 0.85rem; color: var(--primary-light);">Calendario predeterminado</div>' : ''}
                    </div>
                    ${deleteBtn}
                </div>
            </div>
        `;
    });

    html += '</div>';
    workspacesList.innerHTML = html;
}

// Crear nuevo calendario
async function createNewWorkspace() {
    const name = document.getElementById('newWorkspaceName').value.trim();
    const displayName = document.getElementById('newWorkspaceDisplayName').value.trim();

    if (!name || !displayName) {
        alert('Por favor completa todos los campos');
        return;
    }

    // Validar formato del nombre
    if (!/^[a-z0-9_]+$/.test(name)) {
        alert('El nombre interno solo puede contener letras minúsculas, números y guiones bajos');
        return;
    }

    try {
        const response = await fetch('/api/data?action=createWorkspace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, display_name: displayName })
        });

        if (response.ok) {
            await loadWorkspaces(); // Recargar lista
            renderWorkspacesList();
            document.getElementById('addWorkspaceModal').classList.remove('active');
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
        const response = await fetch(`/api/data?action=deleteWorkspace&workspaceId=${id}`, {
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
        checkbox.id = `access_${ws.name}`;

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
