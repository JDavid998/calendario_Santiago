
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
function renderUsersList() {
    const usersList = document.getElementById('usersList');
    const users = getUsersFromStorage();

    if (Object.keys(users).length === 0) {
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
function saveNewUser() {
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

    const users = getUsersFromStorage();

    if (users[email]) {
        alert('Ya existe un usuario con ese email');
        return;
    }

    users[email] = {
        password,
        role,
        name,
        canAccess
    };

    saveUsersToStorage(users);

    document.getElementById('addUserModal').classList.remove('active');
    renderUsersList();

    alert('Usuario creado exitosamente');
}

// Eliminar usuario
function deleteUser(email) {
    if (email === 'asgrmillo@gmail.com') {
        alert('No puedes eliminar el usuario administrador principal');
        return;
    }

    if (!confirm(`¿Estás seguro de que quieres eliminar el usuario ${email}?`)) {
        return;
    }

    const users = getUsersFromStorage();
    delete users[email];
    saveUsersToStorage(users);

    renderUsersList();
}

// Obtener usuarios del localStorage
function getUsersFromStorage() {
    const stored = localStorage.getItem('appUsers');
    if (stored) {
        return JSON.parse(stored);
    }
    return USERS;
}

// Guardar usuarios en localStorage
function saveUsersToStorage(users) {
    localStorage.setItem('appUsers', JSON.stringify(users));
}
