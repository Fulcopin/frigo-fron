# 🧪 Guía de Prueba - Sistema de Catálogo de Firmas

## ✅ Checklist de Verificación

### 1. **Verificar Backend Corriendo**
```
✅ Backend en puerto 5074: http://localhost:5074
✅ Frontend en puerto 5174: http://localhost:5174
```

### 2. **Probar Catálogo de Firmas**

#### Paso 1: Acceder al catálogo
1. Iniciar sesión como `admin`
2. Ir a: `/catalogo-firmas`
3. Debería ver la página "📋 Catálogo de Firmas"

#### Paso 2: Crear firmas de prueba
Crear las siguientes entradas:

**Firma 1:**
- Puesto: `Supervisor general Producción`
- Nombre: `JOSE MONTESDEOCA`
- Área: `FRIGOLAB`
- Correo: `jmontesdeoca@frigolab.com.ec`
- ✅ Activo

**Firma 2:**
- Puesto: `Gerente Producción`
- Nombre: `Carlos López`
- Área: `Administración`
- Correo: `carlos.lopez@empresa.com`
- ✅ Activo

**Firma 3:**
- Puesto: `Obrero Producción`
- Nombre: `Luis Hernández`
- Área: `Producción`
- Correo: `luis.hernandez@empresa.com`
- ✅ Activo

#### Paso 3: Verificar en la tabla
Después de crear, la tabla debe mostrar:

```
┌───────────────────────────────┬─────────────────────┬───────────────┬─────────────────────────────┬──────────┐
│ Puesto                        │ Nombre              │ Área          │ Correo                      │ Estado   │
├───────────────────────────────┼─────────────────────┼───────────────┼─────────────────────────────┼──────────┤
│ Supervisor general Producción │ JOSE MONTESDEOCA    │ FRIGOLAB      │ jmontesdeoca@frigolab.com.ec│ ✅ Activo│
│ Gerente Producción            │ Carlos López        │ Administración│ carlos.lopez@empresa.com    │ ✅ Activo│
│ Obrero Producción             │ Luis Hernández      │ Producción    │ luis.hernandez@empresa.com  │ ✅ Activo│
└───────────────────────────────┴─────────────────────┴───────────────┴─────────────────────────────┴──────────┘
```

### 3. **Verificar en Consola del Navegador**

Abrir DevTools (F12) y verificar logs:

```javascript
🔍 Cargando firmas desde: http://localhost:5074/api/CatalogoFirmas?soloActivos=false
✅ Firmas recibidas RAW: [{...}, {...}, {...}]
✅ Tipo de dato: object
✅ Es array?: true
✅ Total de firmas: 3
```

Si ves `Total de firmas: 0`, revisar el log `✅ Firmas recibidas RAW:` y expandir el objeto.

---

### 4. **Probar en Formularios**

#### Paso 1: Ir a llenar un formulario
1. Navegar a `/fill-form`
2. Seleccionar un template que tenga firmas de producción
3. Ir a la sección "Firmas y Aprobaciones"

#### Paso 2: Verificar autocomplete
En el campo "Nombre" de una firma, escribir:
- `"jose"` → Debe aparecer "JOSE MONTESDEOCA" con email
- `"supervisor"` → Debe aparecer sugerencia con el puesto
- `"carlos"` → Debe aparecer "Carlos López"

#### Paso 3: Verificar logs en consola
```javascript
👥 Cargando usuarios de la API...
✅ 36 usuarios cargados exitosamente
📋 Cargando catálogo de firmas...
✅ 3 firmas del catálogo cargadas

📋 Usuarios para Supervisor general Producción:
  - api: 12
  - catalogo: 1    ← ⭐ DEBE MOSTRAR AL MENOS 1
  - total: 13
```

---

### 5. **Verificar Estructura de Datos**

#### En el selector de usuarios, expandir un usuario del catálogo:
```javascript
{
  id: "catalogo-1",
  nombreCompleto: "JOSE MONTESDEOCA",
  email: "jmontesdeoca@frigolab.com.ec",
  rol: "Supervisor general Producción",
  nombreEmpresa: "FRIGOLAB",
  puesto: "Supervisor general Producción",
  area: "FRIGOLAB",
  source: "catalogo"
}
```

#### Campos requeridos:
- ✅ `id`: Único
- ✅ `nombreCompleto`: Nombre de la persona
- ✅ `email`: Correo electrónico
- ✅ `rol`: Para mostrar en UI
- ✅ `nombreEmpresa`: Para mostrar en UI

---

### 6. **Probar Guardado y Email**

#### Paso 1: Seleccionar firma del catálogo
1. En un formulario, seleccionar "JOSE MONTESDEOCA" de la lista
2. Verificar que el campo "Nombre" se llene con "JOSE MONTESDEOCA"
3. Verificar en DevTools que el email se guardó

#### Paso 2: Guardar formulario
1. Completar el formulario
2. Guardar
3. Revisar logs del backend:

```
✅ Formulario 123 creado por Usuario (email@empresa.com)
```

#### Paso 3: Verificar en base de datos
Conectar a SQL Server y ejecutar:

```sql
-- Ver firmas del catálogo
SELECT * FROM CatalogoFirmas ORDER BY FechaCreacion DESC;

-- Ver formularios con firmas
SELECT FormID, TemplateID, FirmasData 
FROM FilledForms 
ORDER BY CreatedAt DESC;

-- Ver el JSON de FirmasData expandido
SELECT 
    FormID,
    JSON_QUERY(FirmasData, '$."Supervisor general Producción"') AS FirmaSupervisor
FROM FilledForms 
WHERE FirmasData LIKE '%Supervisor general Producción%';
```

Debe mostrar:
```json
{
  "nombre": "JOSE MONTESDEOCA",
  "email": "jmontesdeoca@frigolab.com.ec",
  "fecha": "2026-02-18",
  "firma": {
    "url": "https://...",
    "timestamp": "..."
  }
}
```

---

### 7. **Verificar Envío de Emails**

#### Logs del backend cuando se envía email:
```
🔍 Puesto Supervisor general Producción: Usuario asignado = JOSE MONTESDEOCA (jmontesdeoca@frigolab.com.ec)
📧 Enviando email a jmontesdeoca@frigolab.com.ec
✅ Email sent successfully to jmontesdeoca@frigolab.com.ec
```

---

## 🐛 Problemas Comunes y Soluciones

### Problema 1: "Total de firmas: 0"
**Síntoma:** El catálogo muestra "No hay firmas registradas"

**Verificar:**
1. Backend corriendo en puerto 5074
2. Base de datos tiene registros: `SELECT * FROM CatalogoFirmas`
3. Logs en consola muestran: `✅ Firmas recibidas RAW: {...}`

**Solución:**
- Si el objeto tiene `$values`, el código ya lo maneja automáticamente
- Si sigue sin funcionar, revisar que el backend responda correctamente:
  ```
  http://localhost:5074/api/CatalogoFirmas?soloActivos=false
  ```

### Problema 2: No aparecen firmas del catálogo en el selector
**Síntoma:** Solo se ven usuarios de la API, no del catálogo

**Verificar en consola:**
```javascript
📋 Usuarios para [Puesto]:
  - api: 12
  - catalogo: 0    ← ⚠️ PROBLEMA: Debe ser > 0
  - total: 12
```

**Solución:**
1. Verificar que el puesto en el template coincida parcialmente con el del catálogo
2. Ejemplo: Si el template dice "Supervisor Producción" y el catálogo tiene "Supervisor general Producción", debe coincidir
3. El código hace matching flexible con `.includes()`

### Problema 3: Email no se guarda
**Síntoma:** Al seleccionar usuario del catálogo, no se guarda el email

**Verificar:**
1. En DevTools > Network > guardar formulario > ver Request Payload
2. Buscar `FirmasData` y verificar:
   ```json
   {
     "Supervisor general Producción": {
       "nombre": "JOSE MONTESDEOCA",
       "email": "jmontesdeoca@frigolab.com.ec"  ← ⭐ DEBE EXISTIR
     }
   }
   ```

**Solución:**
- Si no aparece `email`, verificar que el `UserSelector` esté pasando el email en `onChange`
- El código ya está corregido para pasar `(nombreCompleto, email)` al onChange

### Problema 4: Email no se envía
**Síntoma:** No llegan notificaciones por email

**Verificar logs del backend:**
```
⚠️ Puesto [Puesto]: No se encontró email asignado, saltando
```

**Solución:**
1. Verificar que el campo `email` se guardó en `FirmasData`
2. Verificar configuración de Gmail en `appsettings.json`:
   ```json
   {
     "GmailSettings": {
       "SenderEmail": "tu-email@gmail.com",
       "SenderPassword": "tu-app-password",
       "SenderName": "Sistema FRIGOLAB"
     }
   }
   ```

---

## 📊 Estado Esperado del Sistema

### Base de Datos
```sql
-- Tabla CatalogoFirmas
CatalogoFirmaID | Puesto                          | NombreCompleto    | Area          | Correo                       | Activo | FechaCreacion
1              | Supervisor general Producción   | JOSE MONTESDEOCA  | FRIGOLAB      | jmontesdeoca@frigolab.com.ec| 1      | 2026-02-18...
2              | Gerente Producción              | Carlos López      | Administración| carlos.lopez@empresa.com    | 1      | 2026-02-18...
3              | Obrero Producción               | Luis Hernández    | Producción    | luis.hernandez@empresa.com  | 1      | 2026-02-18...
```

### Frontend State
```javascript
// Estado en FillForm.jsx
allUsers: [...36 usuarios de API...]
catalogoFirmas: [
  {
    catalogoFirmaID: 1,
    puesto: "Supervisor general Producción",
    nombreCompleto: "JOSE MONTESDEOCA",
    area: "FRIGOLAB",
    correo: "jmontesdeoca@frigolab.com.ec",
    activo: true
  },
  ...
]

// Combined users para una firma
uniqueUsers: [
  ...usuarios de API filtrados por puesto...,
  {
    id: "catalogo-1",
    nombreCompleto: "JOSE MONTESDEOCA",
    email: "jmontesdeoca@frigolab.com.ec",
    rol: "Supervisor general Producción",
    nombreEmpresa: "FRIGOLAB"
  }
]
```

---

## ✅ Checklist Final

- [ ] Backend corriendo en 5074
- [ ] Frontend corriendo en 5174
- [ ] Tabla `CatalogoFirmas` creada y con datos
- [ ] Página `/catalogo-firmas` accesible
- [ ] Crear 3 firmas de prueba
- [ ] Firmas aparecen en la tabla
- [ ] Abrir formulario con firmas
- [ ] Ver logs: "✅ X firmas del catálogo cargadas"
- [ ] Autocomplete muestra usuarios del catálogo
- [ ] Seleccionar usuario del catálogo
- [ ] Email se guarda en `firmasData`
- [ ] Guardar formulario exitoso
- [ ] Email se envía correctamente

---

## 🎯 Comandos Útiles

### Ver logs del backend
```powershell
# En la terminal donde corre dotnet run
# Buscar líneas con 📋 📧 ✅ ⚠️
```

### Ver estado de la base de datos
```sql
-- Cantidad de firmas activas
SELECT COUNT(*) FROM CatalogoFirmas WHERE Activo = 1;

-- Últimas firmas creadas
SELECT TOP 5 * FROM CatalogoFirmas ORDER BY FechaCreacion DESC;

-- Ver emails en firmas guardadas
SELECT 
    FormID,
    JSON_VALUE(FirmasData, '$."Supervisor general Producción".email') AS EmailSupervisor
FROM FilledForms 
WHERE FirmasData IS NOT NULL
ORDER BY CreatedAt DESC;
```

### Limpiar datos de prueba
```sql
-- CUIDADO: Esto borra todo el catálogo
DELETE FROM CatalogoFirmas;
DBCC CHECKIDENT ('CatalogoFirmas', RESEED, 0);
```

---

**¡Sistema listo para pruebas!** 🚀
