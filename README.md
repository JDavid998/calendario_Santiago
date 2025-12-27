# Calendario de Contenido Interactivo

Un calendario web profesional, interactivo y moderno diseñado para gestionar contenido personal y empresarial, con sistema de autenticación, roles de usuario y soporte para múltiples notas.

## 🌟 Características Principales

*   🔐 **Autenticación Robusta**: Sistema de login seguro con roles.
*   👥 **Roles y Permisos**:
    *   **Admin**: Control total, gestión de usuarios, creación/edición de guiones.
    *   **Cliente**: Acceso de lectura a guiones, gestión completa de sus propias notas.
*   📝 **Notas Múltiples**: Agrega múltiples ideas/notas por día en el calendario.
*   🎬 **Gestión de Guiones**: Base de datos de guiones con estados, filtrado mensual y **selección múltiple de plataformas**.
*   👁️ **Vista Detallada**: Modal de visualización para ver el contenido completo de los guiones de forma cómoda.
*   🔄 **Workspaces**: Áreas de trabajo separadas (Personal y MAAC Line).
*   📱 **Responsive**: Diseño adaptativo y tema oscuro moderno (Dark Mode).
*   💾 **Auto-guardado**: Todos los datos se persisten localmente en el navegador.


## 🚀 Guía Rápida de Uso

### 1. Acceso Inicial
*   **URL**: [Tu URL de Vercel/Localhost]
*   **Admin por defecto**:
    *   Usuario: `asgrmillo@gmail.com`
    *   Contraseña: `Santi15*`

### 2. Gestión de Contenido
*   **Crear Nota**: Haz clic en cualquier día del calendario -> Escribe tu idea -> Enter o clic en "Agregar".
*   **Crear Guión** (Solo Admin): Pestaña "Guiones" -> "Nuevo Guión".
*   **Ver Detalles**: Los títulos de los guiones aparecen en el calendario. Haz clic en el día para ver notas y detalles.

### 3. Gestión de Usuarios (Solo Admin)
*   Haz clic en el icono de usuario en la esquina superior derecha ("Gestionar Usuarios").
*   Puedes crear nuevos usuarios con rol de `Cliente` o `Admin` y asignarles acceso a calendarios específicos.
*   **Rol Cliente**: Puede ver guiones pero MODIFICARLOS NO. Puede gestionar sus propias notas libremente.

---

## 🛠️ Deployment (Puesta en Marcha)

Sigue estos pasos para subir tu calendario a internet GRATIS usando Vercel.

### Requisitos Previos
*   Una cuenta en [GitHub](https://github.com/)
*   Una cuenta en [Vercel](https://vercel.com/)
*   Git instalado en tu computadora (opcional, pero recomendado)

### Paso 1: Subir código a GitHub

1.  Crea un **nuevo repositorio** en GitHub (puedes llamarlo `calendario-interactivo`).
2.  Si tienes GitHub Desktop o usas la terminal:
    ```bash
    git init
    git add .
    git commit -m "Primer deploy calendario interactivo"
    git branch -M main
    git remote add origin https://github.com/TU_USUARIO/calendario-interactivo.git
    git push -u origin main
    ```
    *(Si no usas git, puedes subir los archivos manualmente en la web de GitHub usando "Upload files").*

### Paso 2: Conectar con Vercel

1.  Ve a tu Dashboard en **Vercel**.
2.  Haz clic en **"Add New..."** -> **"Project"**.
3.  Selecciona tu repositorio de GitHub (`calendario-interactivo`).
4.  Haz clic en **"Import"**.
5.  En la configuración, deja todo por defecto.
6.  Haz clic en **"Deploy"**.

¡Listo! En unos segundos tendrás una URL (ej: `calendario-interactivo.vercel.app`) para compartir.

---

## 🔧 Personalización Avanzada

### Usuarios por Código (Hardcoded)
Aunque hay un gestor de usuarios visual, puedes definir usuarios base en `script.js` si lo necesitas para resetear todo:

```javascript
// script.js
const USERS = {
    'tu@email.com': {
        password: 'password123',
        role: 'admin',
        name: 'Tu Nombre',
        canAccess: ['personal', 'maacline']
    }
};
```

### Colores y Tema
El tema visual se controla desde `styles.css` usando variables CSS:

```css
:root {
    --primary-color: #bb86fc; /* Color principal */
    --bg-primary: #7A5688;    /* Fondo principal */
    /* ... */
}
```

---


## ☁️ Sincronización en la Nube (Neon DB)

Para que el contenido sea visible en cualquier dispositivo, hemos integrado **Neon DB**.

### 1. Configurar la Base de Datos
- Entra a tu panel de **Neon DB**.
- Ve al **SQL Editor**.
- Copia y pega el contenido del archivo `neon_setup.sql` que está en el proyecto y ejecútalo. Esto creará las tablas.

### 2. Configurar Vercel
- Ve a tu proyecto en **Vercel** > **Settings** > **Environment Variables**.
- Agrega una nueva variable:
    - **Key**: `DATABASE_URL`
    - **Value**: Tu connection string de Neon (la que empieza con `postgresql://...`).
- **Importante**: Haz un **Redeploy** para que los cambios surtan efecto.

---

**Desarrollado para productividad y gestión de contenido.**
