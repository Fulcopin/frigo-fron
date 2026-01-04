# 📋 GUÍA: Campo Fecha Editable - Dónde y Cómo Usarlo

## 🎯 Aclaración Importante

### ❌ LO QUE ESTÁS VIENDO (Crear Plantilla):
```
┌────────────────────────────────────────────────┐
│  📋 Información General del Formulario        │
│                                                │
│  Código del Formulario *                      │
│  ├─ ggygy                                     │
│                                                │
│  Nombre del Formulario *                      │
│  ├─ y7yyy                                     │
│                                                │
│  Versión                                      │
│  ├─ 1                                         │
│                                                │
│  Objetivo                                     │
│  ├─ ygyg                                      │
│                                                │
│  Proceso                                      │
│  ├─ ...                                       │
└────────────────────────────────────────────────┘

⚠️ ESTO ES CREAR PLANTILLA - No aparece fecha aquí
```

### ✅ LO QUE DEBES USAR (Llenar Formulario):
```
┌────────────────────────────────────────────────┐
│  📋 Información General                       │
│                                                │
│  Código *                                     │
│  ├─ [FRM-TINAS-15-VERTICAL    ]  (editable) │
│                                                │
│  Versión *                                    │
│  ├─ [10-00                     ]  (editable) │
│                                                │
│  Fecha *                                      │
│  ├─ [📅 26/12/2025             ]  (editable) │ ✅ AQUÍ ESTÁ
│                                                │
└────────────────────────────────────────────────┘

✅ ESTO ES LLENAR FORMULARIO - Aquí editas la fecha
```

---

## 🔄 Flujo Completo

### 1️⃣ CREAR PLANTILLA (Lo que hiciste)
```
Página: /crear-plantilla
Acción: Configurar estructura del formulario
Campos: Código, Nombre, Versión, Objetivo, Proceso...

❌ NO APARECE "Fecha" aquí (es normal)
```

### 2️⃣ CONFIGURAR CAMPOS EDITABLES (Ya lo hicimos con script)
```
Script: configurar-campos-editables.ps1
Resultado: Template 38 ahora tiene:
  - Campo "codigo" (editable)
  - Campo "version" (editable)
  - Campo "fecha" (editable) ✅
```

### 3️⃣ LLENAR FORMULARIO (Aquí verás la fecha)
```
Página: /llenar-formulario
Selecciona: "Registro 15 Tinas"
En "Información General" verás:
  ✅ Código (campo de texto)
  ✅ Versión (campo de texto)
  ✅ Fecha (selector de fecha 📅)
```

---

## 📍 Cómo Llegar a Llenar Formulario

### Opción 1: Desde el Menú
```
1. En el menú lateral, busca "Llenar Formulario" o "Fill Form"
2. Clic en ese menú
3. Selecciona "Registro 15 Tinas (Filas Verticales)"
4. Verás los 3 campos editables
```

### Opción 2: Desde URL Directa
```
1. Abre el navegador
2. Ve a: http://localhost:5173/llenar-formulario
3. Selecciona la plantilla
4. Edita los campos
```

---

## 🎨 Visualización Paso a Paso

### PASO 1: Pantalla de Selección
```
┌──────────────────────────────────────────┐
│  Llenar Formulario                      │
│                                          │
│  Selecciona una plantilla:              │
│                                          │
│  ☐ Inspección de Higiene                │
│  ☐ Control de Calidad                   │
│  ☑ Registro 15 Tinas (Filas Verticales) │ ← Selecciona este
│  ☐ Otro formulario...                   │
│                                          │
│  [Continuar →]                          │
└──────────────────────────────────────────┘
```

### PASO 2: Formulario con Campos Editables
```
┌────────────────────────────────────────────────────┐
│  🏢 Frigolab "San Mateo"                          │
│                                                    │
│  REGISTRO 15 TINAS (FILAS VERTICALES)             │
│                                                    │
│  ▼ 📋 Información General (3 campos)              │
│  ┌──────────────────────────────────────────────┐ │
│  │ Código *                                     │ │
│  │ [FRM-TINAS-15-VERTICAL    ]  ← EDITABLE     │ │
│  │                                              │ │
│  │ Versión *                                    │ │
│  │ [10-00                     ]  ← EDITABLE     │ │
│  │                                              │ │
│  │ Fecha *                                      │ │
│  │ [📅 26/12/2025             ]  ← EDITABLE ✅  │ │
│  │                                              │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ▼ 📊 Registro de Tinas                           │
│  ┌──────────────────────────────────────────────┐ │
│  │ Tabla con filas verticales...                │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  [💾 Guardar]  [📄 Exportar PDF]                 │
└────────────────────────────────────────────────────┘
```

### PASO 3: Editar la Fecha
```
Haces clic en el campo Fecha:

┌─────────────────────────────┐
│  Fecha *                    │
│  ┌───────────────────────┐  │
│  │ [📅]  26 / 12 / 2025  │  │ ← Selector de calendario
│  └───────────────────────┘  │
│                             │
│  Puedes escribir:           │
│  - 20/12/2025              │
│  - 15/12/2025              │
│  - Cualquier fecha         │
│                             │
│  O seleccionar del 📅       │
└─────────────────────────────┘
```

### PASO 4: Guardar y Exportar
```
1. Cambias fecha a: 20/12/2025
2. Llenas el resto del formulario
3. Clic en "💾 Guardar"
4. Clic en "📄 Exportar PDF"

Resultado en PDF:
╔════════════════════════════════════════╗
║ CÓDIGO:  FRM-TINAS-15-VERTICAL        ║
║ VERSIÓN: 10-00                        ║
║ FECHA:   20/12/2025  ✅ (tu fecha)    ║
╚════════════════════════════════════════╝
```

---

## 🧪 Prueba Rápida

### Test 1: Verificar que el campo existe
```bash
1. Abre: http://localhost:5173/llenar-formulario
2. Selecciona: "Registro 15 Tinas"
3. Busca sección: "📋 Información General"
4. Cuenta los campos:
   - ¿Hay 3 campos? ✅ Correcto
   - ¿Hay campo "Fecha"? ✅ Perfecto
   - ¿Es editable? ✅ Sí
```

### Test 2: Editar y verificar en PDF
```bash
1. Edita fecha a: 15/12/2025
2. Guarda formulario
3. Exporta a PDF
4. Abre el PDF
5. Verifica en el encabezado: "FECHA: 15/12/2025" ✅
```

---

## 🔍 Si NO Ves el Campo Fecha

### Diagnóstico 1: Verificar Template
```sql
-- Ejecuta en la base de datos
SELECT 
    TemplateID,
    Codigo,
    Nombre,
    Version,
    HeaderFields
FROM Templates
WHERE TemplateID = 38;

-- HeaderFields debe contener:
-- [{"name":"codigo",...},{"name":"version",...},{"name":"fecha",...}]
```

### Diagnóstico 2: Verificar Frontend
```javascript
// Abre Console del navegador (F12)
// Escribe:
console.log(selectedTemplate.headerFields);

// Debe mostrar array con 3 elementos:
// [
//   {name: "codigo", label: "Código", type: "text"},
//   {name: "version", label: "Versión", type: "text"},
//   {name: "fecha", label: "Fecha", type: "date"}  ← Este debe estar
// ]
```

### Diagnóstico 3: Cache del Navegador
```bash
1. Presiona Ctrl + Shift + R (hard refresh)
2. O borra cache:
   - Chrome: Ctrl + Shift + Delete
   - Selecciona "Cached images and files"
   - Clic "Clear data"
3. Recarga la página
```

---

## 💡 Recordatorios Clave

### ✅ Lo que SÍ hicimos:
1. ✅ Agregamos campo "fecha" a template 38
2. ✅ Configuramos tipo "date" (selector de calendario)
3. ✅ PDF usa fecha editada o fecha de creación
4. ✅ Excel usa fecha editada o fecha de creación

### ❌ Lo que NO necesitas hacer:
1. ❌ NO agregues campo "Fecha" al crear plantilla
2. ❌ NO edites HeaderFields manualmente
3. ❌ NO modifiques el código frontend (ya está listo)

### 🎯 Lo que DEBES hacer ahora:
1. 🔵 Ir a "Llenar Formulario"
2. 🔵 Seleccionar "Registro 15 Tinas"
3. 🔵 Editar el campo "Fecha"
4. 🔵 Guardar y exportar a PDF
5. 🔵 Verificar que PDF muestra tu fecha editada

---

## 📸 Referencia Visual

### Diferencia entre páginas:

| Aspecto | Crear Plantilla | Llenar Formulario |
|---------|----------------|-------------------|
| URL | `/crear-plantilla` | `/llenar-formulario` |
| Propósito | Configurar estructura | Ingresar datos |
| Campos | Código, Nombre, Objetivo... | Código, Versión, Fecha... |
| Campo "Fecha" | ❌ No aparece | ✅ Aparece aquí |
| Editable | Template settings | Datos del formulario |

---

**Próximo Paso**: Ve a "Llenar Formulario" y verás los 3 campos editables 😊

---

**Fecha**: 26/12/2025  
**Estado**: ✅ Configuración completada  
**Acción**: Ir a "Llenar Formulario" para ver los campos
