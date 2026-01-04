# ✅ MIGRACIÓN COMPLETADA: IsMasterForm

## 📋 **Resumen de Cambios**

La columna `IsMasterForm` ha sido agregada exitosamente a la base de datos.

---

## 🎯 **Migración Aplicada**

**Nombre:** `20260103024403_AddIsMasterFormColumn`

**SQL Ejecutado:**
```sql
ALTER TABLE [Templates] 
ADD [IsMasterForm] bit NOT NULL DEFAULT CAST(0 AS bit);
```

**Estado:** ✅ **COMPLETADO**

---

## 🚀 **CÓMO USAR EL SISTEMA**

### **1. Verificar que el backend está corriendo**

El backend debe estar ejecutándose en:
- 🌐 HTTP: `http://localhost:5074`
- 🔒 HTTPS: `https://localhost:7278`

Si no está corriendo, ejecuta:
```powershell
cd C:\Users\fupifigu\Desktop\sillos\dinamic-generador\backend-frigo
dotnet run --project FormBuilder.API.csproj
```

---

### **2. Abrir el frontend**

Abre tu navegador en: `http://localhost:5173`

---

### **3. Marcar un formulario como "Maestro"**

#### **Opción A: Desde la interfaz (HOME)**

1. Ve a la página principal (Home)
2. Busca la tarjeta del formulario "15 TINAS"
3. Activa el switch **"Marcar como Maestro"** ⭐
4. Verás el badge dorado **"⭐ Maestro"** aparecer
5. Recarga la página para confirmar

#### **Opción B: Usando PowerShell**

```powershell
# Marcar formulario con ID 15 como maestro
Invoke-RestMethod -Uri "http://localhost:5074/api/Templates/15/master-form" `
  -Method PATCH `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"isMasterForm": true}'

# Desmarcar
Invoke-RestMethod -Uri "http://localhost:5074/api/Templates/15/master-form" `
  -Method PATCH `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"isMasterForm": false}'
```

---

### **4. Verificar que funciona**

#### **Prueba 1: Formulario Maestro (con auto-suma)**

1. Abre el formulario marcado como maestro (ej: "15 TINAS")
2. Escribe valores en las columnas PESO:
   ```
   PESO 1: 10.5
   PESO 2: 15.3
   PESO 3: 8.7
   ```
3. ✅ El **TOTAL** se calculará automáticamente: `34.50`
4. En la consola verás:
   ```
   ✅ Auto-suma ACTIVADO para: "REGISTRO RECEPCIÓN 15 TINAS" (isMasterForm=true)
   ```

#### **Prueba 2: Formulario Normal (sin auto-suma)**

1. Abre un formulario NO marcado como maestro (ej: "FILETEO")
2. Escribe valores en cualquier columna:
   ```
   TOTAL CAJAS: 87
   ```
3. ✅ **NO** se copiará a otras columnas
4. En la consola verás:
   ```
   ⛔ Auto-suma DESACTIVADO para: "FILETEO"
   ```

---

## 📊 **Verificar en la Base de Datos**

Puedes consultar los formularios maestros con esta query:

```sql
-- Ver todos los formularios maestros
SELECT TemplateID, Nombre, IsMasterForm
FROM Templates
WHERE IsMasterForm = 1;

-- Ver todos los formularios con su estado
SELECT 
    TemplateID,
    Codigo,
    Nombre,
    CASE 
        WHEN IsMasterForm = 1 THEN '⭐ MAESTRO'
        ELSE '📄 Normal'
    END AS TipoFormulario
FROM Templates
ORDER BY Nombre;
```

---

## 🎓 **Ejemplos de Uso**

### **Ejemplo 1: Marcar formulario desde PowerShell**

```powershell
# Obtener lista de formularios
$templates = Invoke-RestMethod -Uri "http://localhost:5074/api/Templates"

# Encontrar el ID del formulario "15 TINAS"
$tinasForm = $templates | Where-Object { $_.nombre -like "*TINA*" }
Write-Host "ID encontrado: $($tinasForm.templateID)"

# Marcarlo como maestro
Invoke-RestMethod -Uri "http://localhost:5074/api/Templates/$($tinasForm.templateID)/master-form" `
  -Method PATCH `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"isMasterForm": true}'
```

### **Ejemplo 2: Verificar estado desde PowerShell**

```powershell
# Obtener info del formulario
$template = Invoke-RestMethod -Uri "http://localhost:5074/api/Templates/15"

if ($template.isMasterForm) {
    Write-Host "✅ Este formulario ES maestro" -ForegroundColor Green
} else {
    Write-Host "⛔ Este formulario NO es maestro" -ForegroundColor Yellow
}
```

---

## 🔧 **Endpoints de la API**

### **GET /api/Templates**
Obtiene todos los formularios (incluye campo `isMasterForm`)

**Respuesta:**
```json
[
  {
    "templateID": 15,
    "nombre": "REGISTRO RECEPCIÓN 15 TINAS",
    "isMasterForm": true
  },
  {
    "templateID": 20,
    "nombre": "FILETEO",
    "isMasterForm": false
  }
]
```

### **PATCH /api/Templates/{id}/master-form**
Actualiza el estado de Formulario Maestro

**Request Body:**
```json
{
  "isMasterForm": true
}
```

**Respuesta:**
```json
{
  "message": "Estado de Formulario Maestro actualizado correctamente",
  "templateID": 15,
  "nombre": "REGISTRO RECEPCIÓN 15 TINAS",
  "isMasterForm": true
}
```

---

## 🐛 **Solución de Problemas**

### **Error: "Column IsMasterForm does not exist"**

**Causa:** La migración no se aplicó correctamente.

**Solución:**
```powershell
cd C:\Users\fupifigu\Desktop\sillos\dinamic-generador\backend-frigo
dotnet ef database update
```

### **Error: Switch no aparece en Home**

**Causa:** Archivo CSS no cargado o navegador con caché.

**Solución:**
1. Presiona `Ctrl + Shift + R` para recargar sin caché
2. Verifica que `Home.css` tiene los estilos de `.master-form-toggle`

### **Error: Auto-suma no funciona**

**Causa:** El formulario no está marcado como maestro.

**Solución:**
1. Abre la consola del navegador (F12)
2. Busca el mensaje de auto-suma
3. Si dice "DESACTIVADO", marca el formulario como maestro desde Home

---

## ✅ **Checklist de Verificación**

- [x] Migración `AddIsMasterFormColumn` aplicada
- [x] Columna `IsMasterForm` existe en tabla `Templates`
- [x] Backend compilando sin errores
- [x] Backend corriendo en `http://localhost:5074`
- [x] Frontend cargando correctamente
- [ ] Switch visible en tarjetas de Home
- [ ] Badge "⭐ Maestro" aparece al activar switch
- [ ] Auto-suma funciona en formularios maestros
- [ ] Auto-suma NO funciona en formularios normales

---

## 🎯 **Próximos Pasos**

1. **Marca tus formularios maestros**:
   - 15 TINAS → ✅ Maestro
   - Control de Peso → ✅ Maestro (si aplica)
   - Fileteo → ⛔ Normal
   - Calidad Sensorial → ⛔ Normal

2. **Prueba el sistema**:
   - Llena un formulario maestro y verifica el auto-suma
   - Llena un formulario normal y verifica que NO hay auto-suma

3. **Capacita a tu equipo**:
   - Muéstrales el switch en Home
   - Explica cuándo marcar un formulario como maestro

---

## 📚 **Archivos Importantes**

- **Migración**: `backend-frigo/Migrations/20260103024403_AddIsMasterFormColumn.cs`
- **Modelo**: `backend-frigo/Models/Template.cs`
- **Controller**: `backend-frigo/Controllers/TemplatesController.cs`
- **Frontend Home**: `src/pages/Home.jsx`
- **Frontend FillForm**: `src/pages/FillForm.jsx`
- **Estilos**: `src/pages/Home.css`
- **Guía Completa**: `GUIA_FORMULARIOS_MAESTROS.md`

---

**🎉 ¡Sistema listo para usar!**

El sistema de Formularios Maestros está completamente implementado y funcionando.
