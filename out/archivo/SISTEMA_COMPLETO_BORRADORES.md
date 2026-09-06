# 📝 Sistema Completo de Borradores - Implementado

## ✅ Funcionalidades Implementadas

### 1️⃣ En "Crear Plantilla" (CreateTemplate.jsx)

#### A) Botón de Prueba (Temporal)
```jsx
🧪 PRUEBA: Activar/Desactivar Borrador
```
- **Color:** Gris (inactivo) / Verde (activo)
- **Función:** Activa/desactiva el modo borrador SIN guardar
- **Uso:** Para testing visual del UI

#### B) Badge en el Título
```
Crear Plantilla de Formulario  📝 BORRADOR
```
- **Aparece cuando:** `isDraft = true`
- **Estilo:** Fondo amarillo (#fbbf24), texto marrón oscuro
- **Ubicación:** Al lado derecho del título principal

#### C) Banner Informativo Grande
```
┌──────────────────────────────────────────┐
│ 📝  Modo Borrador Activo                │
│     Esta plantilla se guardará como      │
│     borrador y no estará disponible...   │
└──────────────────────────────────────────┘
```
- **Aparece cuando:** `isDraft = true`
- **Estilo:** Gradiente amarillo, borde naranja
- **Ubicación:** Debajo del header, antes del formulario

#### D) Botón "📝 Guardar Borrador"
- **Función:** Activa `isDraft = true` y guarda
- **Logs en consola:**
  ```
  📝 Guardando como BORRADOR - ANTES: false
  📝 isDraft activado - DESPUÉS: true
  💾 Guardando plantilla. isDraft = true
  ```

#### E) Mensaje de Éxito Diferenciado
```
✅ Plantilla guardada como borrador en la base de datos.
```
vs
```
✅ Plantilla guardada exitosamente en la base de datos.
```

---

### 2️⃣ En "Llenar Formulario" (FillForm.jsx)

#### A) Carga de Borradores
```javascript
// Cargar plantillas públicas Y borradores
const [publicResponse, draftsResponse] = await Promise.all([
  fetch('/api/Templates'),          // Públicas
  fetch('/api/Templates/drafts')    // Borradores
]);
```

#### B) Tarjetas con Indicadores Visuales

**Plantilla Normal:**
```
┌──────────────────────────┐
│ FOR-PD-1                 │
│ Control de Temperatura   │
│ Proceso: Producción      │
└──────────────────────────┘
```

**Plantilla Borrador:**
```
┌──────────────────────────┐ 📝 BORRADOR
│ FOR-PD-2                 │ (badge esquina)
│ Nueva Plantilla 📝       │
│ Proceso: Producción      │
│ ⚠️ Plantilla en Borrador │ (mensaje amarillo)
└──────────────────────────┘
```

**Características visuales:**
- **Borde:** Naranja grueso (3px) si es borrador
- **Fondo:** Gradiente amarillo claro
- **Badge:** Esquina superior derecha con "📝 BORRADOR"
- **Icono:** 📝 al lado del nombre
- **Mensaje:** Banner amarillo interno "⚠️ Plantilla en Borrador"

---

## 🎨 Estilos Implementados

### Badge en Título (CreateTemplate)
```jsx
{
  marginLeft: '15px',
  padding: '6px 12px',
  background: '#fbbf24',        // Amarillo
  color: '#78350f',             // Marrón oscuro
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 'bold',
  border: '2px solid #f59e0b',  // Naranja
}
```

### Banner Grande (CreateTemplate)
```jsx
{
  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
  border: '2px solid #f59e0b',
  borderRadius: '8px',
  padding: '15px 20px',
  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)'
}
```

### Tarjeta de Borrador (FillForm)
```jsx
{
  border: '3px solid #f59e0b',                              // Borde naranja
  background: 'linear-gradient(135deg, #fef3c7 0%, #ffffff 100%)'  // Gradiente
}
```

### Badge Flotante (FillForm)
```jsx
{
  position: 'absolute',
  top: '-10px',
  right: '-10px',
  background: '#f59e0b',
  color: 'white',
  padding: '4px 12px',
  borderRadius: '12px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
}
```

---

## 🔄 Flujo Completo

### Escenario 1: Crear Borrador

```
1. Usuario va a "Crear Plantilla"
2. Llena código y nombre
3. Click "📝 Guardar Borrador"
   ↓
4. Console logs:
   - 📝 Guardando como BORRADOR - ANTES: false
   - 📝 isDraft activado - DESPUÉS: true
   - 💾 Guardando plantilla. isDraft = true
   ↓
5. Aparece inmediatamente:
   - Badge "📝 BORRADOR" en título
   - Banner amarillo informativo
   ↓
6. Se guarda con isDraft = true en BD
   ↓
7. Mensaje: "✅ Plantilla guardada como borrador"
   ↓
8. Badge y banner PERMANECEN visibles
```

### Escenario 2: Ver Borradores en Lista

```
1. Usuario va a "Llenar Formulario"
2. Sistema carga:
   - GET /api/Templates        → Públicas
   - GET /api/Templates/drafts → Borradores
   ↓
3. Se muestran todas las plantillas
4. Las que tienen isDraft = true se ven con:
   - Borde naranja grueso
   - Fondo amarillo
   - Badge "📝 BORRADOR" en esquina
   - Icono 📝 en el nombre
   - Mensaje "⚠️ Plantilla en Borrador"
   ↓
5. Usuario puede identificar visualmente
```

### Escenario 3: Publicar Borrador

```
1. Usuario edita borrador (futura funcionalidad)
2. Click "💾 Guardar Plantilla" (NO borrador)
3. isDraft cambia de true → false
   ↓
4. Badge y banner desaparecen
5. Se guarda con isDraft = false
   ↓
6. En lista de plantillas:
   - Borde normal
   - Sin badge
   - Sin mensaje de advertencia
```

---

## 🧪 Testing

### Test 1: Botón de Prueba (CreateTemplate)
```
✅ Pasos:
1. Ir a "Crear Plantilla"
2. Buscar botón "🧪 PRUEBA: Activar Borrador"
3. Click en el botón

✅ Resultado esperado:
- Botón cambia de gris a verde
- Aparece badge "📝 BORRADOR" en título
- Aparece banner amarillo grande
- Click otra vez → desaparecen
```

### Test 2: Guardar como Borrador (CreateTemplate)
```
✅ Pasos:
1. Llenar código: "TEST-BORR"
2. Llenar nombre: "Prueba"
3. Abrir consola (F12)
4. Click "📝 Guardar Borrador"

✅ Resultado esperado:
- En consola: logs de borrador
- Badge aparece en título
- Banner aparece debajo
- Mensaje: "guardada como borrador"
- Badge PERMANECE después de 5 segundos
```

### Test 3: Ver Borrador en Lista (FillForm)
```
✅ Pasos:
1. Guardar plantilla como borrador (Test 2)
2. Ir a "Llenar Formulario"
3. Buscar la plantilla "TEST-BORR"

✅ Resultado esperado:
- Tarjeta tiene borde naranja
- Fondo amarillo claro
- Badge "📝 BORRADOR" en esquina
- Mensaje "⚠️ Plantilla en Borrador"
```

### Test 4: Base de Datos
```sql
SELECT TOP 5 
    Codigo, 
    Nombre, 
    IsDraft,
    CreatedAt
FROM Templates
WHERE Codigo = 'TEST-BORR'
ORDER BY CreatedAt DESC
```

✅ Resultado esperado:
```
Codigo      Nombre   IsDraft   CreatedAt
TEST-BORR   Prueba   1         2026-02-17 ...
```

---

## 📊 Comparación Visual

### CreateTemplate - ANTES vs AHORA

**ANTES:**
```
Crear Plantilla de Formulario
[Cargar] [📝 Guardar Borrador] [💾 Guardar]
```

**AHORA (después de guardar borrador):**
```
Crear Plantilla de Formulario  📝 BORRADOR
[Cargar] [🧪 PRUEBA] [📝 Guardar Borrador] [💾 Guardar]

┌──────────────────────────────────────────┐
│ 📝  Modo Borrador Activo                │
│     Esta plantilla se guardará como...   │
└──────────────────────────────────────────┘
```

### FillForm - Tarjetas ANTES vs AHORA

**ANTES (todas iguales):**
```
┌──────────────┐  ┌──────────────┐
│ FOR-PD-1     │  │ FOR-PD-2     │
│ Plantilla 1  │  │ Plantilla 2  │
└──────────────┘  └──────────────┘
```

**AHORA (borrador destacado):**
```
┌──────────────┐  ┌──────────────┐ 📝
│ FOR-PD-1     │  ║ FOR-PD-2     ║
│ Plantilla 1  │  ║ Plantilla 2📝║
└──────────────┘  ║ ⚠️ BORRADOR  ║
                  └──────────────┘
                  (Borde naranja, fondo amarillo)
```

---

## 🔧 Archivos Modificados

### 1. CreateTemplate.jsx
**Líneas modificadas:** ~130-200

**Cambios:**
- ✅ Agregado `isDraft` state
- ✅ Función `handleSaveAsDraft()`
- ✅ Logs de debug en consola
- ✅ Badge condicional en h1
- ✅ Banner informativo condicional
- ✅ Botón de prueba temporal
- ✅ Payload incluye `isDraft: isDraft`
- ✅ NO resetea isDraft después de guardar

**Código clave:**
```jsx
const [isDraft, setIsDraft] = useState(false);

const handleSaveAsDraft = async () => {
  console.log("📝 Guardando como BORRADOR - ANTES:", isDraft);
  setIsDraft(true);
  console.log("📝 isDraft activado - DESPUÉS:", true);
  await new Promise(resolve => setTimeout(resolve, 50));
  handleSaveTemplate();
};
```

---

### 2. FillForm.jsx
**Líneas modificadas:** ~396-425, ~3470-3520

**Cambios:**
- ✅ Fetch de borradores con `Promise.all()`
- ✅ Combina públicas + borradores en una lista
- ✅ Tarjetas con estilos condicionales
- ✅ Badge flotante en esquina
- ✅ Mensaje de advertencia interno
- ✅ Icono 📝 en nombre
- ✅ Borde y fondo diferenciados

**Código clave:**
```jsx
const [publicResponse, draftsResponse] = await Promise.all([
  fetch(API_URL_TEMPLATES),
  fetch(`${API_URL_TEMPLATES}/drafts`)
]);

// ...

{template.isDraft && (
  <div style={{...}}>📝 BORRADOR</div>
)}
```

---

## 🚀 Próximos Pasos Sugeridos

### 1. Página de Gestión de Borradores
```jsx
// ManageDrafts.jsx
- Listar solo borradores
- Botón "Publicar" por cada uno
- Botón "Eliminar borrador"
- Botón "Editar"
```

### 2. Edición de Borradores
```jsx
// EditDraft.jsx
- Cargar datos del borrador
- Permitir edición
- Guardar cambios (sigue siendo borrador)
- Opción "Publicar Ahora"
```

### 3. Filtro en FillForm
```jsx
// Toggle para ocultar/mostrar borradores
<button onClick={() => setShowDrafts(!showDrafts)}>
  {showDrafts ? '👁️ Ocultar' : '👁️‍🗨️ Mostrar'} Borradores
</button>
```

### 4. Estadísticas
```jsx
// En Dashboard
- Cantidad de borradores
- Borradores más antiguos
- Alertas de borradores sin publicar >30 días
```

---

## ⚠️ Notas Importantes

### Backend
- ✅ Columna `IsDraft` existe (BIT NOT NULL DEFAULT 0)
- ✅ Endpoint `/api/Templates` filtra borradores
- ✅ Endpoint `/api/Templates/drafts` devuelve solo borradores
- ✅ POST acepta `isDraft` en payload

### Frontend
- ✅ Estado `isDraft` persiste después de guardar
- ✅ Logs de debug activos (remover en producción)
- ✅ Botón de prueba temporal (remover en producción)
- ✅ Borradores se cargan en FillForm (para testing)

### Producción
Antes de publicar a producción:
1. **Remover botón de prueba** en CreateTemplate.jsx
2. **Remover console.logs** de debug
3. **Decidir si mostrar borradores** en FillForm (actualmente SÍ)
4. **Agregar filtro** para ocultar/mostrar borradores

---

## 📝 Checklist Final

### CreateTemplate.jsx
- [x] Estado isDraft implementado
- [x] Botón "Guardar Borrador"
- [x] Badge en título
- [x] Banner informativo
- [x] Logs de debug
- [x] Botón de prueba temporal
- [x] Payload incluye isDraft
- [x] isDraft persiste después de guardar

### FillForm.jsx
- [x] Fetch de borradores
- [x] Combinar públicas + borradores
- [x] Tarjetas con borde especial
- [x] Badge flotante
- [x] Mensaje de advertencia
- [x] Icono en nombre
- [x] Fondo diferenciado

### Backend
- [x] Columna IsDraft en BD
- [x] Endpoint /api/Templates (filtrado)
- [x] Endpoint /api/Templates/drafts
- [x] Acepta isDraft en POST

### Testing
- [ ] Probar botón de prueba
- [ ] Guardar como borrador
- [ ] Ver borrador en lista
- [ ] Verificar en BD
- [ ] Publicar borrador

---

**Fecha:** 17/02/2026  
**Estado:** ✅ Implementación completa  
**Listo para:** Testing  
**Próximo paso:** Probar flujo completo
