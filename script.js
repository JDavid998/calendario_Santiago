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

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();
});

// Verificar autenticación
function checkAuthentication() {
    const savedUser = sessionStorage.getItem('currentUser');

    if (savedUser) {
        currentUser = JSON.parse(savedUser);
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
        checkWorkspace();
    } catch (e) {
        console.error("Error en login:", e);
        errorMsg.textContent = 'Error al conectar con el servidor';
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

// Verificar si hay un workspace seleccionado
function checkWorkspace() {
    const savedWorkspace = sessionStorage.getItem('currentWorkspace');

    if (savedWorkspace && currentUser.canAccess.includes(savedWorkspace)) {
        currentWorkspace = savedWorkspace;
        initializeApp();
    } else {
        showWorkspaceSelector();
    }
}

// Mostrar selector de workspace
function showWorkspaceSelector() {
    const selector = document.getElementById('workspaceSelector');
    const buttons = selector.querySelectorAll('.workspace-btn');

    // Mostrar solo los workspaces que el usuario puede acceder
    buttons.forEach(btn => {
        const workspace = btn.dataset.workspace;
        if (currentUser.canAccess.includes(workspace)) {
            btn.style.display = 'flex';
        } else {
            btn.style.display = 'none';
        }
    });

    selector.classList.add('active');
}

// Seleccionar workspace
function selectWorkspace(workspace) {
    if (!currentUser.canAccess.includes(workspace)) {
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
    initializeModals();
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

    // Mostrar botón de gestión de usuarios solo para admin
    if (currentUser.role === 'admin') {
        document.getElementById('btnUserManagement').style.display = 'flex';
    }
}

// Actualizar título del workspace
function updateWorkspaceTitle() {
    const workspaceNames = {
        'personal': 'Personal',
        'maacline': 'MAAC Line'
    };

    const workspaceName = workspaceNames[currentWorkspace] || currentWorkspace;
    document.getElementById('workspaceName').textContent = workspaceName;
}

// Cargar datos del localStorage
function loadData() {
    try {
        const savedNotes = localStorage.getItem(`calendarNotes_${currentWorkspace}`);
        const savedGuiones = localStorage.getItem(`guiones_${currentWorkspace}`);

        calendarNotes = savedNotes ? JSON.parse(savedNotes) : {};
        guiones = savedGuiones ? JSON.parse(savedGuiones) : [];

        // Asegurar que guiones sea un array
        if (!Array.isArray(guiones)) guiones = [];
        // Asegurar que calendarNotes sea un objeto
        if (typeof calendarNotes !== 'object' || Array.isArray(calendarNotes)) calendarNotes = {};

    } catch (e) {
        console.error("Error al cargar datos:", e);
        calendarNotes = {};
        guiones = [];
    }
}

// Guardar datos en localStorage
function saveData() {
    localStorage.setItem(`calendarNotes_${currentWorkspace}`, JSON.stringify(calendarNotes));
    localStorage.setItem(`guiones_${currentWorkspace}`, JSON.stringify(guiones));
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
            saveData();
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
    const tbody = document.getElementById('guionesTableBody');
    const filterMonth = document.getElementById('filterMonth').value;

    // Controlar visibilidad del botón de agregar guión
    const addGuionBtn = document.getElementById('addGuionBtn');
    if (addGuionBtn) {
        addGuionBtn.style.display = currentUser.role === 'client' ? 'none' : 'flex';
    }

    tbody.innerHTML = '';

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
        tbody.innerHTML = `
            <tr>
            <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-light);">
                No hay guiones para mostrar. ${currentUser.role !== 'client' ? '¡Haz clic en "Nuevo Guión" para empezar!' : ''}
            </td>
            </tr>
            `;
        return;
    }

    filteredGuiones.forEach((guion, index) => {
        const row = document.createElement('tr');
        const formattedDate = formatDate(guion.fecha);
        const statusClass = getStatusClass(guion.estado);

        const platText = Array.isArray(guion.plataformas) ? guion.plataformas.join(', ') : (guion.plataforma || '');

        let actions = `
            <div class="action-buttons">
                <button class="btn-icon" onclick="viewGuion(${guion.id})" title="Ver detalles">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>`;

        if (currentUser.role !== 'client') {
            actions += `
                <button class="btn-icon" onclick="editGuion(${guion.id})" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteGuion(${guion.id})" title="Eliminar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
            `;
        }

        actions += `</div>`;

        row.innerHTML = `
            <td>${formattedDate}</td>
            <td><strong>${guion.titulo}</strong></td>
            <td style="max-width: 300px; white-space: pre-wrap;">${guion.contenido}</td>
            <td>${platText}</td>
            <td><span class="status-badge ${statusClass}">${guion.estado}</span></td>
            <td>${guion.notas}</td>
            <td>${actions}</td>
        `;

        tbody.appendChild(row);
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
    const contenido = document.getElementById('guionContenido').value.trim();

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

// Ver guión (Detalles)
function viewGuion(id) {
    const guion = guiones.find(g => g.id === id);
    if (!guion) return;

    document.getElementById('viewGuionTitle').textContent = guion.titulo;
    document.getElementById('viewGuionFecha').textContent = formatDate(guion.fecha);

    const platText = Array.isArray(guion.plataformas) ? guion.plataformas.join(', ') : (guion.plataforma || 'No especificada');
    document.getElementById('viewGuionPlataformas').textContent = platText;

    document.getElementById('viewGuionEstado').innerHTML = `<span class="status-badge ${getStatusClass(guion.estado)}">${guion.estado}</span>`;
    document.getElementById('viewGuionContenido').textContent = guion.contenido || 'Sin contenido';
    document.getElementById('viewGuionNotas').textContent = guion.notas || 'Sin notas adicionales';

    document.getElementById('viewGuionModal').classList.add('active');
}

// Editar guión
function editGuion(id) {
    if (currentUser.role === 'client') return;

    const guion = guiones.find(g => g.id === id);
    if (!guion) return;

    editingGuionId = id;

    document.getElementById('guionFecha').value = guion.fecha;
    document.getElementById('guionTitulo').value = guion.titulo;
    document.getElementById('guionContenido').value = guion.contenido;

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

    // Limpiar checkboxes
    const checkboxes = document.querySelectorAll('input[name="plataforma"]');
    checkboxes.forEach(cb => cb.checked = false);

    document.getElementById('guionEstado').value = 'Idea';
    document.getElementById('guionNotas').value = '';
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
        document.getElementById('accessPersonal').checked = false;
        document.getElementById('accessMaacline').checked = true;
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

    const canAccess = [];
    if (accessPersonal) canAccess.push('personal');
    if (accessMaacline) canAccess.push('maacline');

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


