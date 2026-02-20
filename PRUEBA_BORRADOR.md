# 🧪 Cómo Probar el Modo Borrador

## 📋 Pasos para Verificar

### 1️⃣ Iniciar los Servidores

```powershell
# Terminal 1 - Frontend
cd "C:\Users\fupifigu\Desktop\OPERATIVOS ESTUDIARF\sistemas_operativos\frigo\frigo-fron"
npm run dev

# Terminal 2 - Backend
cd "C:\Users\fupifigu\Desktop\OPERATIVOS ESTUDIARF\sistemas_operativos\frigo\frigo-fron\backend-frigo"
dotnet run
```

### 2️⃣ Abrir el Navegador

1. Ir a: `http://localhost:5173` (o el puerto que muestre Vite)
2. Navegar a "Crear Plantilla"
3. Abrir la consola del navegador (F12)

### 3️⃣ Llenar Datos Mínimos

```
Código: TEST-BORR-1
Nombre: Prueba de Borrador
```

### 4️⃣ Click en "📝 Guardar Borrador"

**Lo que DEBE pasar:**

✅ **INMEDIATAMENTE al hacer click:**
- En la consola debe aparecer:
  ```
  📝 Guardando como BORRADOR - ANTES: false
  📝 isDraft activado - DESPUÉS: true
  💾 Guardando plantilla. isDraft = true
  ```

✅ **Después de guardar (1-2 segundos):**
- Aparece el badge "📝 BORRADOR" al lado del título
- Aparece el banner amarillo con "Modo Borrador Activo"
- Mensaje de éxito: "✅ Plantilla guardada como borrador en la base de datos"

✅ **El indicador debe PERMANECER visible:**
- El badge "📝 BORRADOR" sigue en el título
- El banner amarillo sigue visible
- NO desaparece aunque se limpie el formulario

---

## 🐛 Si NO Funciona

### Problema 1: No aparece el badge/banner

**Causa:** El estado `isDraft` no se está actualizando

**Verificar en consola:**
```javascript
// Deberías ver esto en la consola:
📝 Guardando como BORRADOR - ANTES: false
📝 isDraft activado - DESPUÉS: true
💾 Guardando plantilla. isDraft = true
```

**Si no ves los logs:**
- El botón no está conectado correctamente
- Recargar la página (Ctrl+F5)

**Si ves los logs pero no aparece el badge:**
- React no está re-renderizando
- Verificar que `{isDraft && ...}` esté correcto

### Problema 2: Aparece y desaparece inmediatamente

**Causa:** `setIsDraft(false)` se está ejecutando

**Verificar:**
- Buscar en `CreateTemplate.jsx` la línea: `setIsDraft(false)`
- Debe estar comentada: `// setIsDraft(false);`

### Problema 3: No se guarda como borrador en BD

**Causa:** El backend no está recibiendo `isDraft: true`

**Verificar en consola Network (F12 → Network):**
1. Click "📝 Guardar Borrador"
2. Buscar la petición POST a `/api/Templates`
3. Ver el "Payload" debe tener: `"isDraft": true`

**Si dice `"isDraft": false`:**
- El estado no se actualizó a tiempo
- Aumentar el timeout de 50ms a 200ms en `handleSaveAsDraft`

---

## 🎯 Resultado Esperado Final

### Vista después de click "📝 Guardar Borrador":

```
┌─────────────────────────────────────────────────────────┐
│ Crear Plantilla de Formulario  📝 BORRADOR             │
│                                                         │
│ [Cargar] [📝 Guardar Borrador] [💾 Guardar Plantilla]  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 📝  Modo Borrador Activo                               │
│     Esta plantilla se guardará como borrador y no      │
│     estará disponible para llenar formularios hasta    │
│     que sea publicada.                                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ✅ Plantilla guardada como borrador en la BD            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Información General                                     │
│ Código: [                  ]                            │
│ Nombre: [                  ]                            │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘
```

**Puntos clave:**
- ✅ Badge "📝 BORRADOR" visible
- ✅ Banner amarillo visible
- ✅ Mensaje de éxito específico para borrador
- ✅ Formulario limpio (listo para nueva plantilla)
- ✅ Badge y banner PERMANECEN visibles

---

## 🔍 Debugging en Vivo

### En la consola del navegador:

```javascript
// Ver estado actual de isDraft
console.log("isDraft:", isDraft);

// Si no funciona, forzar manualmente para probar el UI
// (ejecutar en consola del navegador después de abrir CreateTemplate)
// NO HACER - solo para debug visual
```

### Verificar en Base de Datos:

```sql
SELECT TOP 5 
    Codigo, 
    Nombre, 
    IsDraft,
    CreatedAt
FROM Templates
ORDER BY CreatedAt DESC
```

**Esperado:**
```
Codigo          Nombre              IsDraft   CreatedAt
TEST-BORR-1     Prueba de Borrador  1         2026-02-17 ...
```

---

## ✅ Checklist Final

Después de hacer click en "📝 Guardar Borrador":

- [ ] Se ven los logs en consola
- [ ] `isDraft = true` en el último log
- [ ] Aparece badge "📝 BORRADOR" en título
- [ ] Aparece banner amarillo grande
- [ ] Mensaje dice "guardada como borrador"
- [ ] Badge permanece visible después de 5 segundos
- [ ] Banner permanece visible después de 5 segundos
- [ ] En BD: `IsDraft = 1` para el nuevo registro
- [ ] Plantilla NO aparece en "Seleccionar Plantilla" (filtrada)
- [ ] Plantilla SÍ aparece en GET `/api/Templates/drafts`

---

## 🔄 Flujo Completo

```mermaid
1. Usuario llena código y nombre
2. Click "📝 Guardar Borrador"
   ↓
3. handleSaveAsDraft() ejecuta
   ↓
4. setIsDraft(true)
   ↓
5. Wait 50ms
   ↓
6. handleSaveTemplate() ejecuta
   ↓
7. Payload incluye isDraft: true
   ↓
8. POST a /api/Templates
   ↓
9. Backend guarda con IsDraft = 1
   ↓
10. Success = true
   ↓
11. React re-renderiza
   ↓
12. Badge y banner aparecen
   ↓
13. Formulario se limpia
   ↓
14. Badge y banner PERMANECEN
```

---

**Fecha:** 17/02/2026  
**Archivo:** `CreateTemplate.jsx`  
**Estado:** Con logs de debug  
**Próximo paso:** Probar y verificar checklist
