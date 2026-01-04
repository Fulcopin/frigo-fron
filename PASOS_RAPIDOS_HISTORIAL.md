# 🚀 PASOS RÁPIDOS PARA ACTIVAR HISTORIAL DE VERSIONES

## ⚡ Resumen
He creado un sistema completo de historial de versiones que guarda un snapshot cada vez que cambias la versión de una plantilla.

## 📋 PASOS A SEGUIR (en orden):

### 1️⃣ Ejecutar Migración SQL (REQUERIDO)
**Opción A - Con Azure Data Studio o SSMS**:
1. Abre Azure Data Studio o SQL Server Management Studio
2. Conecta a: `fdjfdfd-ff.database.windows.net`
3. Database: `FormBuilder`
4. Abre el archivo: `backend-frigo\Migrations\CreateTemplateVersionsTable.sql`
5. Presiona **F5** o click en "▶️ Run"
6. Deberías ver: "Tabla TemplateVersions creada exitosamente"

**Opción B - Con sqlcmd** (si lo tienes instalado):
```powershell
sqlcmd -S fdjfdfd-ff.database.windows.net -d FormBuilder -U Frigolab -P "Frigo2024!" -i ".\backend-frigo\Migrations\CreateTemplateVersionsTable.sql"
```

### 2️⃣ Reiniciar el Backend
```powershell
cd backend-frigo
dotnet run
```

### 3️⃣ Probar el Sistema
1. Ve a **"Formularios Maestros"** (Administrar Plantillas)
2. Click en el ícono **📚** (Historial) de cualquier plantilla
3. Deberías ver TODAS las versiones, no solo las que tienen formularios

## 🎯 Cómo Usar el Nuevo Sistema

### Para que se guarde un snapshot:
1. Edita una plantilla (click en ✏️ Editar)
2. **Cambia el número de versión** (ej: "02-08" → "02-09")
3. Guarda los cambios
4. ✅ Se guardará automáticamente un snapshot en `TemplateVersions`

### Para ver el historial:
1. Click en **📚 Historial** en la lista de plantillas
2. Verás todas las versiones con:
   - Número de versión
   - Fecha de creación
   - Cuántos formularios usan esa versión
   - Si es la versión actual

## 🔍 Verificar que Funcionó

### Desde SQL:
```sql
-- Ver cuántas versiones se guardaron
SELECT COUNT(*) as TotalVersiones FROM TemplateVersions;

-- Ver versiones de una plantilla específica
SELECT Version, CreatedAt, ChangeDescription 
FROM TemplateVersions 
WHERE TemplateID = 38 
ORDER BY CreatedAt DESC;
```

### Desde la API:
1. Abre el navegador
2. Ve a: `http://localhost:5194/api/Templates/38/versions/history`
3. Deberías ver un JSON con todas las versiones

## 📁 Archivos Creados/Modificados

✅ **Nuevos**:
- `backend-frigo/Models/TemplateVersion.cs` - Modelo de datos
- `backend-frigo/Migrations/CreateTemplateVersionsTable.sql` - Script SQL
- `SISTEMA_HISTORIAL_VERSIONES.md` - Documentación completa

✅ **Modificados**:
- `backend-frigo/Data/ApplicationDbContext.cs` - Agregado DbSet
- `backend-frigo/Controllers/TemplatesController.cs` - Lógica de snapshots
- `backend-frigo/Models/TemplateHistoryDtos.cs` - Nuevos campos en DTO

## ⚠️ IMPORTANTE

- ❗ **DEBES ejecutar el script SQL** para crear la tabla `TemplateVersions`
- ❗ Sin la tabla, el backend dará errores al arrancar
- ❗ El snapshot solo se guarda cuando **cambias la versión** de la plantilla

## 🐛 Problemas Comunes

### "TemplateVersions no existe"
➡️ No ejecutaste el script SQL. Ve al paso 1️⃣

### "No veo versiones en el historial"
➡️ Es normal si aún no has editado las plantillas después de instalar el sistema.
➡️ Edita una plantilla, cambia su versión, guarda → aparecerá en el historial

### "Error de compilación en el backend"
➡️ Limpia y reconstruye:
```powershell
cd backend-frigo
dotnet clean
dotnet build
dotnet run
```

## 📞 Ayuda

Si algo no funciona:
1. Lee `SISTEMA_HISTORIAL_VERSIONES.md` (documentación completa)
2. Revisa que ejecutaste el script SQL correctamente
3. Verifica que el backend arrancó sin errores

## ✅ ¿Cómo Saber que Está Funcionando?

1. Backend arranca sin errores ✅
2. En SQL existe la tabla `TemplateVersions` con registros ✅
3. Al hacer clic en 📚 ves múltiples versiones ✅
4. Al editar y cambiar versión, aparece nueva entrada en historial ✅
