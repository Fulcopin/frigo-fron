# 🎨 Mejoras en Crear Plantilla de Formulario

## 🎯 Nuevas Características Implementadas

### 1️⃣ Campo de Imagen (Solo para Secciones) 📷

**Característica:**
- Nuevo tipo de campo: **"📷 Imagen (Foto/Captura)"**
- **Solo disponible** en "Sección de Campos"
- **No disponible** en "Tabla de Datos" (las tablas no soportan imágenes)

**Uso:**
1. Crear una "Sección de Campos"
2. Agregar un nuevo campo
3. Seleccionar tipo: **"📷 Imagen (Foto/Captura)"**
4. Al llenar el formulario, el usuario podrá:
   - 📸 Capturar foto desde la cámara
   - 📁 Subir imagen desde archivos
   - 🖼️ Visualizar preview de la imagen

**Ejemplo de configuración:**
```javascript
{
  type: 'section',
  title: 'Documentación Fotográfica',
  fields: [
    {
      label: 'Foto del Producto',
      type: 'image',  // ✅ NUEVO
      required: true
    },
    {
      label: 'Foto del Empaque',
      type: 'image',  // ✅ NUEVO
      required: false
    }
  ]
}
```

**Restricciones:**
- ❌ No muestra opciones de API (no tiene sentido para imágenes)
- ❌ No disponible en tablas (solo secciones)
- ✅ Soporta validación requerido/opcional
- ✅ Al seleccionar tipo "imagen", muestra banner informativo azul

---

### 2️⃣ Guardar como Borrador 📝

**Característica:**
- Nuevo botón: **"📝 Guardar Borrador"**
- Permite guardar plantillas en progreso
- Marca la plantilla como `isDraft: true` en la base de datos

**Beneficios:**
```
✅ Guardar plantillas incompletas sin publicarlas
✅ Continuar editando después
✅ No aparece en formularios disponibles (hasta publicar)
✅ Diferencia visual entre borrador y plantilla final
```

**Flujo de trabajo:**

#### Borrador
```
1. Usuario está creando plantilla
2. No ha terminado todos los campos
3. Click en "📝 Guardar Borrador"
4. Plantilla guardada con isDraft: true
5. Mensaje: "✅ Plantilla guardada como borrador"
```

#### Publicar
```
1. Usuario termina la plantilla
2. Click en "💾 Guardar Plantilla"
3. Plantilla guardada con isDraft: false
4. Mensaje: "✅ Plantilla guardada exitosamente"
5. Ahora aparece en listado de formularios disponibles
```

**Código agregado:**
```javascript
// Estado
const [isDraft, setIsDraft] = useState(false);

// Función guardar borrador
const handleSaveAsDraft = () => {
  setIsDraft(true);
  setTimeout(() => handleSaveTemplate(), 100);
};

// Payload incluye isDraft
const payload = {
  ...template,
  isDraft: isDraft, // ✅ true o false
  // ... otros campos
};
```

---

## 📊 Comparación: Antes vs Ahora

### Tipos de Campo

| Ubicación | ANTES | AHORA |
|-----------|-------|-------|
| **Sección de Campos** | 8 tipos (sin imagen) | 9 tipos ✅ (con imagen) |
| **Tabla de Datos** | 8 tipos | 8 tipos (imagen excluida) |
| **Encabezado** | 8 tipos | 8 tipos (sin cambios) |

### Funcionalidad de Guardado

| Aspecto | ANTES | AHORA |
|---------|-------|-------|
| **Guardar** | Solo publicar | Publicar O Borrador ✅ |
| **Estado en DB** | Siempre activo | isDraft: true/false ✅ |
| **Mensaje éxito** | Genérico | Diferenciado ✅ |
| **Opciones** | 1 botón | 2 botones ✅ |

---

## 🎨 Interfaz de Usuario

### Botones en Header

**ANTES:**
```
[Cargar Plantilla Existente]  [💾 Guardar Plantilla]
```

**AHORA:**
```
[Cargar Plantilla Existente]  [📝 Guardar Borrador]  [💾 Guardar Plantilla]
```

### Selector de Tipo de Campo (Secciones)

**AHORA incluye:**
```
- Texto
- Número
- Fecha
- Hora
- Fecha y Hora
- Temperatura (°C)
- Selección
- Área de texto
- 📷 Imagen (Foto/Captura)  ← NUEVO
```

### Banner Informativo para Imagen

Cuando seleccionas tipo "Imagen", aparece:

```
┌────────────────────────────────────────────────┐
│ 📷 Campo de Imagen: El usuario podrá capturar │
│    o subir una foto en el formulario.         │
└────────────────────────────────────────────────┘
```

**Estilo:**
- Fondo: Azul claro (#e0f2fe)
- Borde: Azul (#0ea5e9)
- Icono: 📷
- Texto: Negrita para "Campo de Imagen:"

### Mensajes de Éxito

**Guardar como publicado:**
```
✅ Plantilla guardada exitosamente en la base de datos.
```

**Guardar como borrador:**
```
✅ Plantilla guardada como borrador en la base de datos.
```

---

## 🔧 Detalles Técnicos

### Cambios en el Código

#### 1. Tipos de Campo

```javascript
// ✅ ANTES: Un solo array para todo
const fieldTypes = [
  { value: "text", label: "Texto" },
  // ... 8 tipos
];

// ✅ AHORA: Tres arrays según contexto
const fieldTypes = [
  { value: "text", label: "Texto" },
  // ... 8 tipos
  { value: "image", label: "📷 Imagen (Foto/Captura)" }, // NUEVO
];

const sectionFieldTypes = fieldTypes; // Incluye imagen
const tableFieldTypes = fieldTypes.filter(t => t.value !== "image"); // Sin imagen
```

#### 2. Estado de Borrador

```javascript
// Estado
const [isDraft, setIsDraft] = useState(false);

// Función
const handleSaveAsDraft = () => {
  setIsDraft(true);
  setTimeout(() => handleSaveTemplate(), 100);
};

// Reset después de guardar
setIsDraft(false);
```

#### 3. Payload a la API

```javascript
const payload = {
  ...template,
  isDraft: isDraft, // ✅ NUEVO
  headerFields: JSON.stringify(template.headerFields),
  bodyElements: JSON.stringify(template.bodyElements),
  firmas: JSON.stringify(template.firmas),
};
```

#### 4. Lógica Condicional para Imagen

```javascript
// En campos de sección
{field.type !== "image" && (
  <>
    {/* Mostrar dropdowns de API */}
  </>
)}

{field.type === "image" && (
  <div>
    📷 Campo de Imagen: El usuario podrá capturar...
  </div>
)}
```

---

## 📝 Estructura JSON de Ejemplo

### Plantilla con Campo de Imagen

```json
{
  "codigo": "FOR-CA-2",
  "nombre": "Control de Calidad Visual",
  "version": "1",
  "isDraft": false,
  "bodyElements": [
    {
      "type": "section",
      "title": "Inspección Visual",
      "fields": [
        {
          "label": "Foto Frontal del Producto",
          "type": "image",
          "required": true
        },
        {
          "label": "Foto del Empaque",
          "type": "image",
          "required": false
        },
        {
          "label": "Observaciones",
          "type": "textarea",
          "required": false
        }
      ]
    }
  ]
}
```

### Plantilla Borrador

```json
{
  "codigo": "FOR-TEMP-1",
  "nombre": "Plantilla en Desarrollo",
  "version": "1",
  "isDraft": true,  // ← Marca como borrador
  "headerFields": [],
  "bodyElements": [],
  "firmas": []
}
```

---

## 🚀 Casos de Uso

### Caso 1: Control de Calidad Visual

**Escenario:** Inspector de calidad necesita fotografiar defectos

**Configuración:**
```javascript
{
  type: 'section',
  title: 'Evidencia Fotográfica',
  fields: [
    {
      label: 'Foto del Defecto Encontrado',
      type: 'image',
      required: true
    },
    {
      label: 'Descripción del Defecto',
      type: 'textarea',
      required: true
    },
    {
      label: 'Nivel de Gravedad',
      type: 'select',
      options: ['Leve', 'Moderado', 'Crítico'],
      required: true
    }
  ]
}
```

**Resultado al llenar:**
1. Usuario sube/captura foto del defecto
2. Describe el problema
3. Selecciona gravedad
4. Todo se guarda junto en el formulario

---

### Caso 2: Recepción de Material

**Escenario:** Recepcionista documenta estado de llegada

**Configuración:**
```javascript
{
  type: 'section',
  title: 'Estado del Material Recibido',
  fields: [
    {
      label: 'Foto del Material al Llegar',
      type: 'image',
      required: true
    },
    {
      label: 'Foto del Empaque Externo',
      type: 'image',
      required: false
    },
    {
      label: 'Temperatura de Llegada',
      type: 'temperature',
      required: true
    }
  ]
}
```

---

### Caso 3: Guardado Incremental

**Escenario:** Administrador crea plantilla compleja

**Flujo:**
```
1. Día 1: Crear código y nombre
   → Click "📝 Guardar Borrador"
   → isDraft: true

2. Día 2: Agregar campos de encabezado
   → Click "📝 Guardar Borrador"
   → isDraft: true (actualiza)

3. Día 3: Agregar secciones y tablas
   → Click "📝 Guardar Borrador"
   → isDraft: true (actualiza)

4. Día 4: Revisar y completar firmas
   → Click "💾 Guardar Plantilla"
   → isDraft: false (publica)
```

**Ventaja:** No perder progreso entre sesiones

---

## ⚠️ Restricciones y Validaciones

### Campo de Imagen

| Restricción | Razón |
|-------------|-------|
| ❌ No en tablas | Tablas son para datos tabulares repetitivos |
| ❌ No en encabezado | Encabezado es para metadatos simples |
| ✅ Solo en secciones | Secciones permiten campos diversos |
| ❌ Sin opciones de API | Las imágenes no vienen de APIs |
| ❌ Sin validación "options" | No aplica para imágenes |

### Borrador

| Validación | Comportamiento |
|------------|----------------|
| Código vacío | ❌ Alerta: "Completa código y nombre" |
| Nombre vacío | ❌ Alerta: "Completa código y nombre" |
| Sin campos | ✅ Permite (es borrador) |
| Sin firmas | ✅ Permite (es borrador) |
| Error de API | ❌ Muestra error, no guarda |

---

## 🔍 Verificación

### Test 1: Campo de Imagen en Sección

```bash
1. Crear nueva plantilla
2. Agregar "Sección de Campos"
3. Click "+ Agregar Campo"
4. En "Tipo" buscar "📷 Imagen (Foto/Captura)"
5. Seleccionarlo
6. Verificar que aparece banner azul informativo
7. Verificar que NO aparecen dropdowns de API
8. Guardar plantilla
```

**Resultado esperado:**
- ✅ Campo tipo "image" guardado en JSON
- ✅ No tiene apiMap ni apiEndpoint
- ✅ Banner informativo visible

---

### Test 2: Imagen NO en Tablas

```bash
1. Crear nueva plantilla
2. Agregar "Tabla de Datos"
3. Click "+ Agregar Columna"
4. Abrir dropdown "Tipo"
5. Buscar "📷 Imagen"
```

**Resultado esperado:**
- ❌ Opción "📷 Imagen" NO aparece en lista
- ✅ Solo aparecen 8 tipos (sin imagen)

---

### Test 3: Guardar como Borrador

```bash
1. Crear nueva plantilla
2. Llenar solo código y nombre
3. Click "📝 Guardar Borrador"
4. Verificar mensaje: "guardada como borrador"
5. Verificar en DB: isDraft = true
```

**Resultado esperado:**
- ✅ Plantilla guardada con isDraft: true
- ✅ Mensaje diferenciado
- ✅ No aparece en formularios disponibles

---

### Test 4: Publicar Plantilla

```bash
1. Crear plantilla completa
2. Click "💾 Guardar Plantilla"
3. Verificar mensaje: "guardada exitosamente"
4. Verificar en DB: isDraft = false o null
```

**Resultado esperado:**
- ✅ Plantilla guardada con isDraft: false
- ✅ Aparece en listado de formularios disponibles
- ✅ Usuarios pueden llenarla

---

## 📚 Próximos Pasos Sugeridos

### Backend (Pendiente)

1. **Migración de base de datos:**
   ```sql
   ALTER TABLE Templates
   ADD isDraft BIT DEFAULT 0;
   ```

2. **Filtrar borradores en API GET:**
   ```csharp
   // Solo devolver plantillas publicadas
   var templates = await _context.Templates
       .Where(t => t.IsDraft == false || t.IsDraft == null)
       .ToListAsync();
   
   // Endpoint separado para borradores
   [HttpGet("drafts")]
   public async Task<ActionResult<List<Template>>> GetDrafts()
   {
       return await _context.Templates
           .Where(t => t.IsDraft == true)
           .ToListAsync();
   }
   ```

3. **Validación al llenar formulario:**
   ```csharp
   // No permitir llenar borradores
   if (template.IsDraft == true)
   {
       return BadRequest("Esta plantilla es un borrador y no puede llenarse.");
   }
   ```

---

### Frontend (Futuras mejoras)

1. **Listar borradores:**
   ```jsx
   // Nueva página: /drafts
   const DraftTemplates = () => {
     const [drafts, setDrafts] = useState([]);
     
     useEffect(() => {
       fetch(`${API_BASE_URL}/Templates/drafts`)
         .then(res => res.json())
         .then(data => setDrafts(data));
     }, []);
     
     return (
       <div>
         <h1>📝 Plantillas Borrador</h1>
         {drafts.map(draft => (
           <div key={draft.templateID}>
             <h3>{draft.nombre}</h3>
             <button onClick={() => loadDraft(draft.templateID)}>
               ✏️ Continuar Editando
             </button>
           </div>
         ))}
       </div>
     );
   };
   ```

2. **Editar borradores:**
   ```jsx
   const loadDraft = async (id) => {
     const draft = await fetch(`${API_BASE_URL}/Templates/${id}`).then(r => r.json());
     setTemplate(draft);
     setIsDraft(true);
   };
   ```

3. **Convertir borrador a publicado:**
   ```jsx
   const publishDraft = async (id) => {
     await fetch(`${API_BASE_URL}/Templates/${id}`, {
       method: 'PATCH',
       body: JSON.stringify({ isDraft: false })
     });
     alert('✅ Borrador publicado');
   };
   ```

---

## 🎯 Resumen de Mejoras

### ✅ Implementado

| Característica | Estado | Ubicación |
|----------------|--------|-----------|
| Campo de Imagen | ✅ Completo | Solo secciones |
| Guardar Borrador | ✅ Completo | Botón nuevo |
| Filtrar APIs para imagen | ✅ Completo | Condicional |
| Banner informativo | ✅ Completo | Tipo imagen |
| Mensaje diferenciado | ✅ Completo | Éxito guardado |

### ⏳ Pendiente (Backend)

| Característica | Prioridad | Requisito |
|----------------|-----------|-----------|
| Columna `isDraft` en DB | 🔴 Alta | Migración SQL |
| Filtrar borradores en GET | 🔴 Alta | Lógica C# |
| Endpoint /drafts | 🟡 Media | API nueva |
| Validación al llenar | 🟡 Media | Regla negocio |

---

## 📖 Documentación Relacionada

- **FillForm.jsx**: Necesitará renderizar campos tipo "image"
- **EditFilledForm.jsx**: Necesitará editar campos tipo "image"
- **Backend Template Model**: Necesita propiedad `IsDraft`
- **Backend GET /Templates**: Filtrar `isDraft == false`

---

**Implementado:** 17/02/2026  
**Archivos modificados:** CreateTemplate.jsx  
**Estado:** ✅ Frontend completo, backend pendiente  
**Testing:** Listo para probar
