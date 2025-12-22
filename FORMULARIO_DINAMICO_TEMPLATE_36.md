# 🎯 Formulario Dinámico desde Base de Datos - Template 36

## 🌐 Acceso

**URL:** http://localhost:5173/fill-form

Esta página carga **TODOS** los templates disponibles desde la base de datos y te permite llenarlos dinámicamente.

---

## 📋 Cómo Encontrar Tu Formulario de 15 Tinas

### Paso 1: Abrir la Página
Ya está abierta en VS Code: http://localhost:5173/fill-form

### Paso 2: Buscar el Template

En la parte superior verás una **lista de templates disponibles**. Busca:

```
📋 FRM-TINAS-15-VERTICAL
   Registro 15 Tinas (Filas Verticales)
   Versión: 10-00
   [Seleccionar]
```

### Paso 3: Opciones de Búsqueda

La página tiene filtros para encontrar templates:

#### 🔍 Barra de Búsqueda
Escribe: `"15 tinas"` o `"FRM-TINAS-15"` o `"vertical"`

#### 🏭 Filtro por Proceso
Selecciona: `"Producción"`

---

## 📊 Estructura del Template 36

Una vez seleccionado, verás el formulario renderizado dinámicamente con:

### 📋 Encabezado (Header)
- **Fecha** (date, required)
- **Turno** (select: Mañana, Tarde, Noche)
- **Responsable** (text, required)
- **Lote** (text, required)

### 📊 Cuerpo (Body) - Tabla Dinámica

El template contiene una **tabla con 15 filas** (JSON almacenado en `bodyElements`):

```json
{
  "type": "table",
  "id": "tabla-tinas-vertical",
  "title": "📋 Registro de 15 Tinas (Filas Verticales)",
  "columns": [
    { "id": "col-hora", "header": "⏰ HORA", "type": "time" },
    { "id": "col-tina", "header": "🔵 TINA", "type": "text" },
    { "id": "col-peso1", "header": "⚖️ PESO 1", "type": "number" },
    { "id": "col-peso2", "header": "⚖️ PESO 2", "type": "number" },
    { "id": "col-peso3", "header": "⚖️ PESO 3", "type": "number" },
    { "id": "col-peso4", "header": "⚖️ PESO 4", "type": "number" },
    { "id": "col-peso5", "header": "⚖️ PESO 5", "type": "number" },
    { "id": "col-total", "header": "📊 TOTAL", "type": "calculated" }
  ],
  "rows": [
    { "id": "row-t1", "cells": [...] },
    { "id": "row-t2", "cells": [...] },
    ...
    { "id": "row-t15", "cells": [...] }
  ]
}
```

### 🏆 Total General

```json
{
  "type": "summary-section",
  "id": "total-general",
  "title": "🏆 TOTAL GENERAL",
  "calculation": {
    "type": "sum",
    "sources": ["TOTAL_T1", "TOTAL_T2", ..., "TOTAL_T15"]
  }
}
```

### ✍️ Firmas
- ASISTENTE
- SUPERVISOR
- JEFE CALIDAD

---

## 🔍 Verificar que el Template Existe

Desde PowerShell, verifica que el template 36 está en la base de datos:

```powershell
# Ver el template 36
$template = Invoke-RestMethod -Uri "http://127.0.0.1:5074/api/Templates/36" -Method GET
Write-Host "ID: $($template.templateID)" -ForegroundColor Green
Write-Host "Código: $($template.codigo)" -ForegroundColor Green
Write-Host "Nombre: $($template.nombre)" -ForegroundColor Green
Write-Host "Proceso: $($template.proceso)" -ForegroundColor Green
```

**Resultado esperado:**
```
ID: 36
Código: FRM-TINAS-15-VERTICAL
Nombre: Registro 15 Tinas (Filas Verticales)
Proceso: Producción
```

---

## 📊 Ver Todos los Templates Disponibles

```powershell
# Ver TODOS los templates
$templates = Invoke-RestMethod -Uri "http://127.0.0.1:5074/api/Templates" -Method GET
$templates | ForEach-Object {
    Write-Host "[$($_.templateID)] $($_.codigo) - $($_.nombre)" -ForegroundColor Cyan
}
```

---

## 🎨 Cómo se Renderiza Dinámicamente

El componente `FillForm.jsx` hace lo siguiente:

### 1. Carga los Templates
```javascript
useEffect(() => {
  fetch(`${API_BASE_URL}/Templates`)
    .then(res => res.json())
    .then(data => setTemplates(data));
}, []);
```

### 2. Usuario Selecciona un Template
```javascript
const handleTemplateSelect = (template) => {
  setSelectedTemplate(template);
  // Parsea el JSON de bodyElements
  const bodyElements = JSON.parse(template.bodyElements);
  // Renderiza dinámicamente
};
```

### 3. Renderiza los Elementos

Para **tablas**:
```jsx
{element.type === 'table' && (
  <table>
    <thead>
      <tr>
        {element.columns.map(col => (
          <th key={col.id}>{col.header}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {element.rows.map(row => (
        <tr key={row.id}>
          {row.cells.map(cell => (
            <td key={cell.columnId}>
              <input 
                type={getInputType(cell)}
                value={bodyData[cell.name] || ''}
                onChange={e => handleBodyChange(cell.name, e.target.value)}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
)}
```

Para **summary-section**:
```jsx
{element.type === 'summary-section' && (
  <div className="summary-section">
    <h3>{element.title}</h3>
    <div className="total-value">
      {calculateTotal(element.calculation.sources)}
    </div>
  </div>
)}
```

---

## 💾 Guardar el Formulario Llenado

Una vez llenes el formulario:

1. Click en **💾 Guardar**
2. Los datos se envían a: `POST /api/FilledForms`

**Estructura de datos guardados:**
```json
{
  "filledFormID": 123,
  "templateID": 36,
  "headerData": {
    "FECHA": "2025-12-22",
    "TURNO": "Mañana",
    "RESPONSABLE": "Juan Pérez",
    "LOTE": "LOTE-001"
  },
  "bodyData": {
    "HORA_T1": "08:00",
    "TINA_T1": "T1",
    "PESO1_T1": 25.5,
    "PESO2_T1": 30.2,
    ...
    "TOTAL_T1": 131.0,
    ...
  },
  "firmasData": [...],
  "createdAt": "2025-12-22T19:30:00Z"
}
```

---

## 🔄 Ventajas del Renderizado Dinámico

### ✅ Ventajas
- ✅ **Un solo componente** para todos los formularios
- ✅ **Actualización centralizada**: Cambios en el template se reflejan automáticamente
- ✅ **No necesitas código nuevo**: Solo creas el template en la BD
- ✅ **Consistencia**: Todos los formularios tienen el mismo comportamiento
- ✅ **Historial**: Puedes versionar templates sin cambiar código

### 🆚 vs Componentes Estáticos

| Característica | Dinámico (FillForm) | Estático (Registro15Tinas.jsx) |
|----------------|---------------------|--------------------------------|
| **Código** | 1 componente genérico | 1 componente por formulario |
| **Flexibilidad** | Alta (cambia en BD) | Baja (cambia código) |
| **Performance** | Parsea JSON | Compilado |
| **Mantenimiento** | Centralizado | Distribuido |
| **Personalización** | Limitada al JSON | Total (código custom) |

---

## 🚀 Próximos Pasos

### Opción 1: Usar el Dinámico (Recomendado)
1. ✅ Abre http://localhost:5173/fill-form
2. ✅ Busca "Registro 15 Tinas"
3. ✅ Selecciónalo
4. ✅ Llena el formulario
5. ✅ Guarda

### Opción 2: Usar el Estático (Más Personalizado)
1. Abre http://localhost:5173/registro-15-tinas
2. Llena el formulario estático
3. Guarda (usa el mismo backend)

### Opción 3: Crear Nueva Ruta Directa al Template 36

Si quieres una ruta directa al template 36 dinámico:

```jsx
// En App.jsx, agrega:
<Route 
  path="/fill-form/36" 
  element={<FillForm preselectedTemplateId={36} />} 
/>
```

---

## 🔍 Debugging

### Ver el JSON del Template

```powershell
# Ver el bodyElements completo
$template = Invoke-RestMethod -Uri "http://127.0.0.1:5074/api/Templates/36" -Method GET
$template.bodyElements | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### Verificar que se Renderiza Correctamente

Abre la consola del navegador (F12) y busca:
```javascript
// Logs del componente FillForm
console.log("Selected template:", selectedTemplate);
console.log("Body elements:", bodyElements);
console.log("Body data state:", bodyData);
```

---

## 📱 Comparación Visual

### Formulario Estático (Registro15Tinas.jsx)
```
Código React → Compilado → Renderizado
└─ Rápido, pero requiere cambios de código
```

### Formulario Dinámico (FillForm.jsx)
```
Base de Datos → JSON → Parser → Renderizado
└─ Flexible, pero requiere parseo en runtime
```

---

## ✅ Checklist

- [x] Template 36 creado en base de datos
- [x] Página FillForm abierta
- [ ] **Buscar "Registro 15 Tinas" en la lista** ← HAZLO AHORA
- [ ] **Seleccionar el template**
- [ ] **Llenar el formulario**
- [ ] **Guardar y verificar**

---

## 💡 Tip Final

Si no ves el Template 36 en la lista:

1. **Refresca la página** (F5)
2. **Verifica la consola** (F12) para ver errores
3. **Verifica que el backend responde**:
   ```powershell
   Invoke-RestMethod -Uri "http://127.0.0.1:5074/api/Templates" -Method GET | ConvertTo-Json -Depth 2
   ```

---

**Página Abierta:** http://localhost:5173/fill-form  
**Template ID:** 36  
**Código:** FRM-TINAS-15-VERTICAL  
**Estado:** ✅ Listo para usar
