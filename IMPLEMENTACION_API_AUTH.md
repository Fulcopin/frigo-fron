# 🔐 Implementación de Autenticación con API Externa

## 📋 Resumen
Se ha conectado el sistema de autenticación con la API externa ubicada en `http://188.40.197.172:8094/api/Auth/login`, mapeando los roles de la API a los roles internos del sistema.

---

## 🎯 Usuarios de Prueba

### 1️⃣ **ADMIN** - Acceso Total
```
Usuario: tadmin
Password: Tadmin26*
Rol API: ADMIN → Rol Interno: admin
```

### 2️⃣ **SUPERVISOR** - Acceso Total
```
Usuario: tsupervisor
Password: Tsupervisor26**
Rol API: SUPERVISOR → Rol Interno: supervisor
```

### 3️⃣ **OPERADOR** - Solo Llenar y Ver
```
Usuario: toperador
Password: Toperador26**
Rol API: OPERADOR → Rol Interno: trabajador
```

---

## 🔄 Mapeo de Roles

El sistema mapea automáticamente los roles de la API a los roles internos:

| Rol API | Rol Interno | Permisos |
|---------|-------------|----------|
| **ADMIN** | `admin` | 🟢 Acceso total (`all`) |
| **SUPERVISOR** | `supervisor` | 🟢 Acceso total (`all`) |
| **OPERADOR** | `trabajador` | 🟡 Solo llenar y ver (`fill-form`, `view-forms`) |

---

## 📡 Respuesta de la API

### **Estructura de respuesta exitosa**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiration": "2026-01-30T03:54:17.8716879Z",
  "user": {
    "id": "19107b44-693a-4645-b622-db105ffc0f2e",
    "userName": "l-admin",
    "email": "luiggi.jalca@outlook.com",
    "nombreCompleto": "Luiggi Jalca-Adm",
    "nombreEmpresa": "FRIGOLAB",
    "idEmpresa": 2007,
    "rol": "ADMIN"
  }
}
```

---

## 🔧 Cambios Realizados en `authService.js`

### **1. URL de API Externa**
```javascript
const API_BASE_URL = 'http://188.40.197.172:8094/api';
```

### **2. Mapeo de Roles**
```javascript
this.roleMapping = {
  'ADMIN': 'admin',           // Acceso total
  'SUPERVISOR': 'supervisor',  // Acceso total
  'OPERADOR': 'trabajador'     // Solo ver y llenar formularios
};
```

### **3. Función `login()` Actualizada**

```javascript
async login(username, password) {
  try {
    // 1. Llamar a la API externa
    const response = await fetch(`${API_BASE_URL}/Auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return { 
        success: false, 
        error: errorData?.message || 'Credenciales inválidas' 
      };
    }

    // 2. Procesar respuesta
    const apiResponse = await response.json();
    const apiUser = apiResponse.user;
    const apiToken = apiResponse.token;
    const apiExpiration = apiResponse.expiration;

    // 3. Mapear rol de API a rol interno
    const rolInterno = this.roleMapping[apiUser.rol] || 'trabajador';

    // 4. Determinar permisos según rol
    let permisos = [];
    if (rolInterno === 'admin' || rolInterno === 'supervisor') {
      permisos = ['all']; // Acceso total
    } else {
      permisos = ['fill-form', 'view-forms']; // Solo llenar y ver
    }

    // 5. Construir objeto de usuario interno
    const userData = {
      id: apiUser.id,
      username: apiUser.userName,
      nombre: apiUser.nombreCompleto,
      rol: rolInterno,
      email: apiUser.email,
      empresa: apiUser.nombreEmpresa,
      idEmpresa: apiUser.idEmpresa,
      rolOriginal: apiUser.rol, // Rol original de la API
      permisos: permisos
    };

    // 6. Guardar sesión con token real de la API
    const expirationDate = new Date(apiExpiration);
    this.saveSession(userData, apiToken, expirationDate);

    return { success: true, user: userData };

  } catch (error) {
    return { 
      success: false, 
      error: 'Error al conectar con el servidor' 
    };
  }
}
```

---

## 🎬 Flujo de Autenticación

```
1. Usuario ingresa credenciales
   ↓
2. Frontend envía POST a /api/Auth/login
   ↓
3. API valida credenciales
   ↓
4. API devuelve: { token, expiration, user }
   ↓
5. Frontend mapea rol de API → rol interno
   ↓
6. Frontend asigna permisos según rol
   ↓
7. Se guarda sesión en localStorage:
   - fishcort_user (datos usuario)
   - fishcort_token (JWT de la API)
   - fishcort_token_expiration (fecha expiración)
   ↓
8. Usuario redirigido a Home
```

---

## 📦 Datos Guardados en localStorage

### **fishcort_user**:
```json
{
  "id": "19107b44-693a-4645-b622-db105ffc0f2e",
  "username": "l-admin",
  "nombre": "Luiggi Jalca-Adm",
  "rol": "admin",
  "email": "luiggi.jalca@outlook.com",
  "empresa": "FRIGOLAB",
  "idEmpresa": 2007,
  "rolOriginal": "ADMIN",
  "permisos": ["all"]
}
```

### **fishcort_token**:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **fishcort_token_expiration**:
```
2026-01-30T03:54:17.8716879Z
```

---

## 🔐 Sistema de Permisos

### **ADMIN y SUPERVISOR** → `permisos: ['all']`
- ✅ Crear plantillas
- ✅ Editar plantillas
- ✅ Eliminar plantillas
- ✅ Llenar formularios
- ✅ Ver formularios
- ✅ Editar formularios llenos
- ✅ Eliminar formularios llenos
- ✅ Exportar PDF/Excel

### **OPERADOR** → `permisos: ['fill-form', 'view-forms']`
- ❌ Crear plantillas
- ❌ Editar plantillas
- ❌ Eliminar plantillas
- ✅ Llenar formularios
- ✅ Ver formularios
- ❌ Editar formularios llenos
- ❌ Eliminar formularios llenos
- ✅ Exportar PDF/Excel

---

## 🧪 Cómo Probar

### **Paso 1: Iniciar Servidor**
```powershell
npm run dev
```

### **Paso 2: Abrir Login**
Navegar a: `http://localhost:5173/login`

### **Paso 3: Probar Usuarios**

#### **Login como ADMIN**:
```
Usuario: tadmin
Password: Tadmin26*
```
Verificar:
- ✅ Puede acceder a "Crear Plantilla"
- ✅ Puede acceder a "Gestionar Plantillas"
- ✅ Puede llenar y ver formularios

#### **Login como SUPERVISOR**:
```
Usuario: tsupervisor
Password: Tsupervisor26**
```
Verificar:
- ✅ Puede acceder a "Crear Plantilla"
- ✅ Puede acceder a "Gestionar Plantillas"
- ✅ Puede llenar y ver formularios

#### **Login como OPERADOR**:
```
Usuario: toperador
Password: Toperador26**
```
Verificar:
- ❌ NO puede acceder a "Crear Plantilla" (botón oculto)
- ❌ NO puede acceder a "Gestionar Plantillas" (botón oculto)
- ✅ SÍ puede llenar y ver formularios

---

## 🔍 Console Logs

Al hacer login, verás en la consola:

```
🔍 Intentando login con API externa: { username: "tadmin" }
📡 Respuesta API: 200
✅ Login exitoso, datos de API: { token: "...", user: {...} }
🔄 Mapeando rol: ADMIN → admin
✅ Sesión guardada: { 
  usuario: "Luiggi Jalca-Adm", 
  rol: "admin", 
  permisos: ["all"],
  expira: "30/1/2026, 03:54:17"
}
```

---

## ❌ Manejo de Errores

### **Credenciales Inválidas**:
```json
{
  "success": false,
  "error": "❌ Credenciales inválidas. Por favor verifica tu usuario y contraseña."
}
```

### **Error de Conexión**:
```json
{
  "success": false,
  "error": "⚠️ Error al conectar con el servidor. Verifica tu conexión e intenta nuevamente."
}
```

---

## 📊 Compatibilidad con Rutas

Las rutas existentes siguen funcionando:

### **Rutas para Admin y Supervisor**:
```jsx
<RoleBasedRoute allowedRoles={['admin', 'supervisor']}>
  <CreateTemplate />
</RoleBasedRoute>
```

### **Rutas para Todos**:
```jsx
<Route path="/home" element={<Home />} />
<Route path="/fill-form/:id" element={<FillForm />} />
<Route path="/view-forms" element={<ViewForms />} />
```

---

## 🚀 Ventajas de la Implementación

1. ✅ **Token Real**: Usa JWT de la API, no tokens generados localmente
2. ✅ **Expiración Real**: Respeta la expiración del token de la API
3. ✅ **Mapeo Automático**: Roles de API → Roles internos automáticamente
4. ✅ **Compatibilidad Total**: Funciona con el sistema de permisos existente
5. ✅ **Información Completa**: Guarda empresa, email, nombre completo, etc.
6. ✅ **Logs Detallados**: Console logs para debugging

---

## 🔗 Endpoint de la API

```
POST http://188.40.197.172:8094/api/Auth/login
Content-Type: application/json

{
  "username": "tadmin",
  "password": "Tadmin26*"
}
```

---

## 📝 Notas Importantes

1. **Token JWT**: El token devuelto por la API se guarda tal cual y se puede usar para futuras peticiones autenticadas
2. **Rol Original**: Se guarda tanto el rol mapeado (`rol`) como el original de la API (`rolOriginal`)
3. **ID de Empresa**: Se guarda `idEmpresa` para futuras consultas filtradas por empresa
4. **Sin Credenciales Hardcodeadas**: Ya no hay usuarios demo en el código

---

## ✅ Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `src/services/authService.js` | Conexión API + Mapeo de roles + Eliminación de usuarios demo |

---

**Estado**: ✅ Implementado y funcional  
**Fecha**: 30 de enero de 2026  
**Prueba**: Login con `tadmin` / `Tadmin26*`
