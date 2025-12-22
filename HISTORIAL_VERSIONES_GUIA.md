# 📚 Sistema de Historial de Versiones de Plantillas - Guía Completa

## 📋 Descripción General

El **Sistema de Historial de Versiones** permite visualizar, comparar y rastrear todas las versiones de una plantilla a través del tiempo, mostrando qué formularios se crearon con cada versión.

---

## 🎯 Características Principales

### ✅ **Vista de Historial Completo**
- Timeline visual de todas las versiones
- Indicador de versión actual vs. históricas
- Conteo de formularios por versión
- Fechas de primer y último uso

### 🔍 **Detalles de Versión**
- Información completa de cada versión
- Estructura técnica (HeaderFields, BodyElements, Firmas)
- Lista de formularios asociados
- Metadata de cada formulario

### ⚖️ **Comparación de Versiones**
- Comparar cualquier par de versiones
- Detección automática de cambios
- Vista lado a lado con diferencias resaltadas

---

## 🚀 Cómo Usar el Sistema

### **1. Acceder al Historial de Versiones**

1. Ve a **Administrar Plantillas**
2. Busca la plantilla que quieres revisar
3. Click en el botón **"📚 Historial"**
4. Se abrirá una ventana modal con el historial completo

---

### **2. Ver el Timeline de Versiones**

#### **Vista Principal:**
```
📚 Historial de Versiones
Plantilla: FOR-CPCLT - Control de Calidad

┌─────────────────────────────────────────┐
│ ✅ Versión 03-01  [ACTUAL]              │
│    📊 5 formularios                     │
│    Primer uso: 15 de diciembre, 2025   │
│    [👁️ Ver Detalles]                   │
└─────────────────────────────────────────┘
            │
            ↓
┌─────────────────────────────────────────┐
│ 📜 Versión 02-01                        │
│    📊 12 formularios                    │
│    Primer uso: 1 de noviembre, 2025    │
│    Último uso: 14 de diciembre, 2025   │
│    [👁️ Ver Detalles]                   │
└─────────────────────────────────────────┘
```

#### **Leyenda de Badges:**
- **✅ Verde** = Versión actual de la plantilla
- **📜 Amarillo** = Versión histórica (obsoleta)

---

### **3. Ver Detalles de una Versión Específica**

#### **Pasos:**
1. En el timeline, click en **"👁️ Ver Detalles"** de cualquier versión
2. Se mostrará una pantalla con:

#### **Información General:**
- Código de la plantilla
- Nombre completo
- Número de versión

#### **Descripción del Formulario:**
- Objetivo
- Proceso al que pertenece

#### **Estructura Técnica:**
- ✅ Header Fields: Disponible / ❌ No disponible
- ✅ Body Elements: Disponible / ❌ No disponible
- ✅ Firmas: Disponible / ❌ No disponible

#### **Formularios Asociados:**
Lista de todos los formularios creados con esta versión, mostrando:
- ID del formulario (#123)
- Fecha de creación
- Vista previa de datos

---

### **4. Comparar Dos Versiones**

#### **Modo Comparación - Pasos:**

1. **Activar Modo Comparación:**
   - En el timeline, click en **"🔍 Comparar Versiones"**
   - Aparecerá un banner amarillo de modo comparación

2. **Seleccionar Versiones:**
   - Click en **"Versión Antigua"** para la primera versión
   - Click en **"Versión Nueva"** para la segunda versión
   - Las versiones seleccionadas se resaltarán

3. **Ejecutar Comparación:**
   - Click en **"▶️ Comparar Ahora"**
   - Se mostrará una pantalla con las diferencias

#### **Resultado de Comparación:**

```
🔍 Comparación de Versiones

┌──────────────┐        ┌──────────────┐
│ VERSIÓN 02-01│   →    │ VERSIÓN 03-01│
│  (Antigua)   │        │   (Nueva)    │
└──────────────┘        └──────────────┘

Cambios Detectados (4):

🔸 Nombre: 'Control de Calidad v2' → 'Control de Calidad Mejorado'
🔸 Objetivo: 'Controlar calidad básica' → 'Control exhaustivo de calidad'
🔸 BodyElements: Estructura de tabla modificada
🔸 HeaderFields: Estructura modificada
```

#### **Tipos de Cambios Detectados:**
- Cambios en **Nombre** de la plantilla
- Cambios en **Objetivo**
- Cambios en **Proceso**
- Modificaciones en **HeaderFields**
- Modificaciones en **BodyElements**
- Modificaciones en **Firmas**

---

## 🎨 Interfaz Visual

### **Colores del Sistema:**

#### **Versión Actual:**
- 🎨 Fondo: Gradiente verde (#d1fae5 → #a7f3d0)
- 🔷 Borde: Verde brillante (#10b981)
- ✅ Icono: Check verde
- 🏷️ Tag: "ACTUAL" verde

#### **Versión Histórica:**
- 🎨 Fondo: Gradiente amarillo/ámbar (#fef3c7 → #fde68a)
- 🔷 Borde: Naranja (#f59e0b)
- 📜 Icono: Pergamino
- 🏷️ Sin tag especial

#### **Modo Comparación:**
- 🎨 Banner: Gradiente amarillo (#fef3c7 → #fde68a)
- 🔷 Borde: Naranja (#f59e0b)
- ⚠️ Mensaje: "Modo Comparación: Selecciona dos versiones"

---

## 📊 Endpoints del Backend

### **1. GET `/api/Templates/{id}/versions/history`**
Obtiene el historial completo de versiones de una plantilla.

**Respuesta:**
```json
[
  {
    "version": "03-01",
    "firstUsedDate": "2025-12-15T10:30:00Z",
    "lastUsedDate": "2025-12-15T15:45:00Z",
    "formCount": 5,
    "isCurrentVersion": true
  },
  {
    "version": "02-01",
    "firstUsedDate": "2025-11-01T08:00:00Z",
    "lastUsedDate": "2025-12-14T17:30:00Z",
    "formCount": 12,
    "isCurrentVersion": false
  }
]
```

---

### **2. GET `/api/Templates/{id}/versions/{version}`**
Obtiene los detalles completos de una versión específica.

**Ejemplo:** `GET /api/Templates/1/versions/02-01`

**Respuesta:**
```json
{
  "version": "02-01",
  "templateID": 1,
  "codigo": "FOR-CPCLT",
  "nombre": "Control de Calidad v2",
  "objetivo": "Controlar calidad básica",
  "proceso": "Producción",
  "headerFields": "{...JSON...}",
  "bodyElements": "{...JSON...}",
  "firmas": "{...JSON...}",
  "associatedForms": [
    {
      "formID": 45,
      "createdAt": "2025-11-15T10:00:00Z",
      "headerData": "{...}",
      "observaciones": "Todo correcto"
    }
  ]
}
```

---

### **3. GET `/api/Templates/{id}/versions/compare`**
Compara dos versiones de una plantilla.

**Parámetros de Query:**
- `oldVersion`: Versión antigua (ej: "02-01")
- `newVersion`: Versión nueva (ej: "03-01")

**Ejemplo:** 
```
GET /api/Templates/1/versions/compare?oldVersion=02-01&newVersion=03-01
```

**Respuesta:**
```json
{
  "oldVersion": "02-01",
  "newVersion": "03-01",
  "comparisonDate": "2025-12-15T16:00:00Z",
  "changes": [
    "Nombre: 'Control de Calidad v2' → 'Control de Calidad Mejorado'",
    "Objetivo: 'Controlar calidad básica' → 'Control exhaustivo de calidad'",
    "BodyElements: Estructura de tabla modificada"
  ]
}
```

---

### **4. GET `/api/Templates/{id}/versions/{version}/forms`**
Obtiene solo los formularios de una versión específica.

**Ejemplo:** `GET /api/Templates/1/versions/02-01/forms`

**Respuesta:**
```json
[
  {
    "formID": 45,
    "templateID": 1,
    "templateVersion": "02-01",
    "createdAt": "2025-11-15T10:00:00Z",
    "headerData": "{...}",
    "bodyData": "{...}",
    "firmasData": "{...}"
  }
]
```

---

## 🧪 Casos de Uso

### **Caso 1: Auditoría de Cambios**
**Escenario:** Un supervisor quiere saber qué cambió entre dos versiones de una plantilla.

**Solución:**
1. Abrir historial de versiones
2. Activar modo comparación
3. Seleccionar versión antigua y nueva
4. Ver lista de cambios detectados

---

### **Caso 2: Verificar Impacto de Cambios**
**Escenario:** Se actualiza una plantilla y se quiere saber cuántos formularios usaron la versión anterior.

**Solución:**
1. Abrir historial de versiones
2. Ver el conteo de formularios en cada versión
3. Click en "Ver Detalles" de la versión antigua
4. Revisar lista completa de formularios afectados

---

### **Caso 3: Restaurar Información**
**Escenario:** Se necesita saber exactamente cómo era una plantilla en noviembre.

**Solución:**
1. Abrir historial de versiones
2. Buscar la versión que estaba activa en noviembre
3. Click en "Ver Detalles"
4. Revisar estructura técnica completa (HeaderFields, BodyElements, Firmas)

---

### **Caso 4: Rastrear Evolución**
**Escenario:** Documentar cómo ha evolucionado una plantilla a lo largo del tiempo.

**Solución:**
1. Abrir historial de versiones
2. Revisar el timeline completo
3. Ver fechas de primer y último uso de cada versión
4. Comparar versiones consecutivas para ver progresión

---

## 📝 Notas Técnicas

### **¿Cómo se Detectan las Versiones?**

El sistema NO usa la tabla `TemplateHistory` (que aún no está implementada). En su lugar:

1. **Versión Actual:** Lee el campo `Version` de la tabla `Templates`
2. **Versiones Históricas:** Lee el campo `TemplateSnapshot` de cada `FilledForm`
3. **Agrupación:** Agrupa los formularios por su campo `TemplateVersion`

### **¿Qué pasa si no hay snapshot?**

- Si un `FilledForm` no tiene `TemplateSnapshot`, el sistema usa la plantilla actual como fallback
- Aparecerá el mensaje: "Snapshot no disponible - versión histórica"

### **Limitaciones Actuales:**

- ❌ No se registran cambios en la tabla `TemplateHistory` automáticamente
- ❌ No hay información de "quién" hizo el cambio
- ❌ No hay descripción manual de los cambios
- ✅ **Funciona** detectando versiones a través de los formularios guardados

---

## 🔮 Mejoras Futuras

### **Fase 2: Implementar TemplateHistory Completa**

**Tabla `TemplateHistory`:**
```sql
CREATE TABLE TemplateHistory (
    HistoryID INT PRIMARY KEY IDENTITY,
    TemplateID INT NOT NULL,
    TemplateSnapshot NVARCHAR(MAX) NOT NULL,
    Version NVARCHAR(20) NOT NULL,
    ChangeType NVARCHAR(50) NOT NULL, -- 'Creación', 'Actualización', 'Corrección'
    ChangeDescription NVARCHAR(500),   -- Descripción manual del cambio
    ChangedBy NVARCHAR(100),           -- Usuario que hizo el cambio
    ChangedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
)
```

**Características adicionales:**
- Auto-guardar snapshot al crear/actualizar template
- Registro de usuario que hizo el cambio
- Descripción manual opcional de los cambios
- Restauración de versiones antiguas
- Diff visual campo por campo

---

## 🎯 Resumen Ejecutivo

| Característica | Estado | Descripción |
|---------------|--------|-------------|
| **Timeline de Versiones** | ✅ Completo | Vista cronológica de todas las versiones |
| **Detalles de Versión** | ✅ Completo | Información completa de cada versión |
| **Comparación** | ✅ Completo | Comparar dos versiones y ver cambios |
| **Formularios Asociados** | ✅ Completo | Lista de formularios por versión |
| **Integración UI** | ✅ Completo | Botón "Historial" en Administrar Plantillas |
| **Endpoints Backend** | ✅ Completo | 4 endpoints REST funcionales |
| **Auto-registro de cambios** | ⏳ Pendiente | Requiere tabla TemplateHistory |
| **Restauración de versiones** | ⏳ Pendiente | Requiere implementación adicional |

---

## 📞 Soporte

### **Solución de Problemas:**

**Problema:** No aparecen versiones en el historial
- **Causa:** No hay formularios guardados con esa plantilla
- **Solución:** Al menos debe aparecer la versión actual con 0 formularios

**Problema:** Error al comparar versiones
- **Causa:** Versión antigua sin snapshot
- **Solución:** El sistema mostrará "Snapshot no disponible"

**Problema:** Modal no se cierra
- **Causa:** Click fuera del modal
- **Solución:** Click en el botón ✖️ en la esquina superior derecha

---

**¡Sistema de Historial de Versiones implementado y listo para usar! 🎉**

📚 **Próximos pasos:** Prueba el sistema creando formularios con diferentes versiones de una plantilla y luego explora el historial completo.
