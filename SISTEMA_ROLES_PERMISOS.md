# Sistema de Roles y Permisos - Frigolab Docs

## 📋 Descripción General

El sistema de Frigolab Docs implementa un control de acceso basado en roles (RBAC - Role-Based Access Control) con tres niveles de permisos.

## 👥 Roles Disponibles

### 1. 👑 **Admin** (Administrador)
- **Acceso:** Total a todas las funcionalidades del sistema
- **Credenciales de prueba:**
  - Usuario: `admin`
  - Contraseña: `fishcort2025`

**Permisos:**
- ✅ Ver inicio
- ✅ Crear plantillas
- ✅ Editar plantillas
- ✅ Administrar plantillas
- ✅ Llenar formularios
- ✅ Ver formularios
- ✅ Editar formularios llenos
- ✅ Ver formularios por fecha
- ✅ Exportar datos

---

### 2. 👔 **Supervisor**
- **Acceso:** Total (igual que Admin)
- **Credenciales de prueba:**
  - Usuario: `supervisor`
  - Contraseña: `fishcort2025`

**Permisos:**
- ✅ Ver inicio
- ✅ Crear plantillas
- ✅ Editar plantillas
- ✅ Administrar plantillas
- ✅ Llenar formularios
- ✅ Ver formularios
- ✅ Editar formularios llenos
- ✅ Ver formularios por fecha
- ✅ Exportar datos

---

### 3. 👷 **Trabajador**
- **Acceso:** Solo visualización y llenado de formularios
- **Credenciales de prueba:**
  - Usuario: `trabajador`
  - Contraseña: `fishcort2025`

**Permisos:**
- ✅ Ver inicio
- ✅ Llenar formularios
- ✅ Ver formularios
- ✅ Editar formularios llenos (solo los propios)
- ❌ Crear plantillas
- ❌ Editar plantillas
- ❌ Administrar plantillas
- ❌ Ver formularios por fecha
- ❌ Exportar datos

---

## 🔒 Implementación Técnica

### Archivos Modificados

1. **`src/services/authService.js`**
   - Agregado el rol "supervisor"
   - Agregado el rol "trabajador"
   - Métodos nuevos:
     - `hasRole(rol)` - Verifica si el usuario tiene un rol específico
     - `isAdminOrSupervisor()` - Verifica si el usuario es admin o supervisor
     - `isTrabajador()` - Verifica si el usuario es trabajador

2. **`src/components/RoleBasedRoute.jsx`** (Nuevo)
   - Componente para proteger rutas según roles
   - Muestra mensaje de "Acceso Denegado" si el usuario no tiene permisos

3. **`src/App.jsx`**
   - Navegación dinámica según el rol del usuario
   - Rutas protegidas con `RoleBasedRoute`
   - Los trabajadores no ven links a funcionalidades prohibidas

4. **`src/pages/Login.jsx`**
   - Actualizado para mostrar las 3 credenciales de prueba

---

## 🛡️ Protección de Rutas

### Rutas Públicas
- `/login` - Página de inicio de sesión

### Rutas para Todos los Roles Autenticados
- `/` - Inicio
- `/fill-form` - Llenar formulario
- `/view-forms` - Ver formularios
- `/edit-filled-form/:id` - Editar formulario lleno

### Rutas Solo para Admin y Supervisor
- `/create-template` - Crear plantilla
- `/edit-template/:id` - Editar plantilla
- `/manage-templates` - Administrar plantillas
- `/daily-forms` - Formularios por fecha

---

## 🧪 Cómo Probar el Sistema de Roles

### Probar como Admin:
1. Inicia sesión con `admin / fishcort2025`
2. Verifica que puedes ver todos los links del menú
3. Accede a "Administrar Plantillas" y "Formularios por Fecha"
4. Intenta crear y editar plantillas

### Probar como Supervisor:
1. Inicia sesión con `supervisor / fishcort2025`
2. Verifica que tienes el mismo acceso que Admin
3. Todas las funcionalidades deben estar disponibles

### Probar como Trabajador:
1. Inicia sesión con `trabajador / fishcort2025`
2. Verifica que solo ves:
   - 🏠 Inicio
   - 📝 Llenar Formulario
   - 👁️ Ver Formularios
3. Intenta acceder manualmente a `/create-template`
4. Deberías ver la página "Acceso Denegado"

---

## 🔧 Personalización

### Agregar un Nuevo Rol

1. **Actualizar `authService.js`:**
```javascript
else if (username === 'nuevo_rol' && password === 'password') {
  const userData = {
    id: 5,
    username: username,
    nombre: 'Nuevo Rol',
    rol: 'nuevo_rol',
    email: 'nuevo@fishcort.com',
    permisos: ['fill-form', 'view-forms', 'custom-permission']
  };
  // ... resto del código
}
```

2. **Actualizar rutas en `App.jsx`:**
```jsx
<Route path="/ruta-especial" element={
  <RoleBasedRoute allowedRoles={['admin', 'supervisor', 'nuevo_rol']}>
    <ComponenteEspecial />
  </RoleBasedRoute>
} />
```

3. **Actualizar navegación en `App.jsx`:**
```jsx
{(userRole === 'admin' || userRole === 'nuevo_rol') && (
  <Link to="/ruta-especial">
    ⭐ Función Especial
  </Link>
)}
```

---

## 📝 Notas Importantes

1. **Seguridad en Producción:**
   - Las credenciales actuales son solo para DEMO
   - En producción, conectar con backend real
   - Implementar JWT o sesiones seguras
   - Usar HTTPS siempre

2. **Expiración de Sesión:**
   - Las sesiones duran 8 horas por defecto
   - Se puede renovar con `authService.renewSession()`

3. **Compatibilidad:**
   - El usuario "operador" se mantiene por compatibilidad
   - Se trata como un "trabajador"

---

## 🚀 Próximos Pasos

- [ ] Conectar con API backend real
- [ ] Implementar permisos granulares (CRUD específicos)
- [ ] Agregar auditoría de acciones por usuario
- [ ] Implementar "Olvidé mi contraseña"
- [ ] Agregar 2FA (autenticación de dos factores)

---

**Desarrollado para Frigolab "San Mateo" - 2026**
