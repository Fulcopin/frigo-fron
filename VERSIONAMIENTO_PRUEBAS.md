# 🧪 Pruebas del Sistema de Versionamiento - Guía Práctica

## 🎯 Objetivo
Validar que los formularios se guardan con snapshot de plantilla y se visualizan correctamente con su versión histórica.

---

## 📝 Prueba Completa Paso a Paso

### **PASO 1: Estado Inicial - Verificar Plantilla Actual**

#### Acción:
1. Abrir navegador en: `http://localhost:5173/gestionar`
2. Buscar plantilla "FOR-CPCLT" (o cualquier otra)
3. Ver versión actual (ejemplo: "02-01")

#### Lo que deberías ver:
```
Plantilla: Control de Productos Congelados (Liberación de Túneles)
Código: FOR-CPCLT
Versión: 02-01
```

#### SQL para verificar:
```sql
SELECT TemplateID, Codigo, Nombre, Version, UpdatedAt
FROM Templates
WHERE Codigo = 'FOR-CPCLT';
```

**Resultado esperado:**
| TemplateID | Codigo | Nombre | Version | UpdatedAt |
|------------|--------|--------|---------|-----------|
| 9 | FOR-CPCLT | Control de Productos... | 02-01 | 2025-11-01... |

---

### **PASO 2: Crear Formulario con Versión Actual**

#### Acción:
1. Ir a: `http://localhost:5173/crear`
2. Seleccionar plantilla "FOR-CPCLT"
3. Llenar datos de ejemplo:
   - Fecha: 2025-12-15
   - Lote: PRUEBA-001
   - Otros campos según la plantilla
4. Click en "Guardar Formulario"

#### Lo que deberías ver en Console (F12):
```javascript
✅ Formulario guardado con snapshot de plantilla
📦 Versión guardada: 02-01
🏷️ Template ID: 9
📋 FormID guardado: 123
```

#### SQL para verificar el guardado:
```sql
SELECT TOP 1
    FormID,
    TemplateID,
    TemplateVersion,
    LEN(TemplateSnapshot) as SnapshotLength,
    CreatedAt
FROM FilledForms
ORDER BY FormID DESC;
```

**Resultado esperado:**
| FormID | TemplateID | TemplateVersion | SnapshotLength | CreatedAt |
|--------|------------|-----------------|----------------|-----------|
| 123 | 9 | 02-01 | 2847 | 2025-12-15 10:30:00 |

> ✅ **SnapshotLength** debe ser >1000 (indica que se guardó el JSON completo)

---

### **PASO 3: Ver Formulario Guardado (Sin cambios en plantilla)**

#### Acción:
1. Ir a: `http://localhost:5173/historial`
2. Buscar el formulario recién creado
3. Click en "👁️ Ver"

#### Lo que deberías ver:

**Badge de versión (verde):**
```
✅ Versión Actual
v02-01

Este formulario usa la versión actual de la plantilla.
```

#### Console del navegador:
```javascript
📋 Datos del formulario: {formID: 123, templateID: 9, ...}
🏷️ Versión de plantilla: 02-01
📜 Es versión histórica: false  ← IMPORTANTE: false porque aún no cambió la plantilla
✅ Información de versión cargada: {templateVersion: "02-01", isHistorical: false}
```

---

### **PASO 4: Actualizar la Plantilla (Cambio de Versión)**

#### Acción:
1. Ir a: `http://localhost:5173/gestionar`
2. Editar plantilla "FOR-CPCLT"
3. Hacer cambios:
   - **Versión:** cambiar de "02-01" a **"03-01"**
   - **Nombre:** agregar " [ACTUALIZADO]" al final
   - **Objetivo:** cambiar el texto
   - **BodyElements:** agregar una columna nueva o modificar una existente
4. Click en "Actualizar Plantilla"

#### Lo que deberías modificar:
```javascript
// ANTES
{
  "codigo": "FOR-CPCLT",
  "nombre": "Control de Productos Congelados (Liberación de Túneles)",
  "version": "02-01",
  "objetivo": "Asegurar que los productos congelados...",
  // ...
}

// DESPUÉS
{
  "codigo": "FOR-CPCLT",
  "nombre": "Control de Productos Congelados (Liberación de Túneles) [ACTUALIZADO]",
  "version": "03-01",  ← CAMBIO IMPORTANTE
  "objetivo": "Garantizar la calidad y trazabilidad de productos...",  ← NUEVO TEXTO
  // ...
}
```

#### SQL para verificar actualización:
```sql
SELECT TemplateID, Codigo, Nombre, Version, UpdatedAt
FROM Templates
WHERE Codigo = 'FOR-CPCLT';
```

**Resultado esperado:**
| TemplateID | Codigo | Nombre | Version | UpdatedAt |
|------------|--------|--------|---------|-----------|
| 9 | FOR-CPCLT | Control... [ACTUALIZADO] | **03-01** | **2025-12-15 11:00:00** ← Nueva fecha |

---

### **PASO 5: Ver Formulario Antiguo (Versión Histórica)**

#### Acción:
1. Ir a: `http://localhost:5173/historial`
2. Buscar el formulario creado en PASO 2 (FormID 123)
3. Click en "👁️ Ver"

#### Lo que deberías ver:

**Badge de versión (AMARILLO - Cambio importante):**
```
📜 Versión Histórica
v02-01

Este formulario fue creado con la versión 02-01 de la plantilla 
(15 de diciembre de 2025, 10:30). Se muestra con el formato 
original aunque la plantilla haya sido actualizada.

Creado: 15 de diciembre de 2025, 10:30
```

#### Header del formulario:
```
Control de Productos Congelados (Liberación de Túneles)  ← SIN "[ACTUALIZADO]"
Código: FOR-CPCLT
Versión: 02-01  ← Versión ANTIGUA
```

#### Console del navegador:
```javascript
📋 Datos del formulario: {formID: 123, ...}
🏷️ Versión de plantilla: 02-01
📜 Es versión histórica: true  ← CAMBIÓ A TRUE! 🎉
✅ Información de versión cargada: {
  templateVersion: "02-01",
  isHistorical: true,
  createdAt: "2025-12-15T10:30:00"
}
```

---

### **PASO 6: Crear Nuevo Formulario con Plantilla Actualizada**

#### Acción:
1. Ir a: `http://localhost:5173/crear`
2. Seleccionar la MISMA plantilla "FOR-CPCLT"
3. Llenar datos de ejemplo:
   - Fecha: 2025-12-15
   - Lote: PRUEBA-002
4. Guardar

#### Lo que deberías ver en Console:
```javascript
✅ Formulario guardado con snapshot de plantilla
📦 Versión guardada: 03-01  ← NUEVA VERSIÓN
🏷️ Template ID: 9
📋 FormID guardado: 124
```

#### SQL para comparar ambos formularios:
```sql
SELECT 
    FormID,
    TemplateID,
    TemplateVersion,
    CreatedAt,
    CASE 
        WHEN TemplateVersion = '02-01' THEN 'Versión Antigua'
        WHEN TemplateVersion = '03-01' THEN 'Versión Nueva'
    END as Estado
FROM FilledForms
WHERE TemplateID = 9
ORDER BY FormID DESC;
```

**Resultado esperado:**
| FormID | TemplateID | TemplateVersion | CreatedAt | Estado |
|--------|------------|-----------------|-----------|--------|
| 124 | 9 | **03-01** | 2025-12-15 11:15:00 | Versión Nueva |
| 123 | 9 | **02-01** | 2025-12-15 10:30:00 | Versión Antigua |

---

### **PASO 7: Comparación Lado a Lado**

#### Acción:
1. Abrir formulario antiguo (FormID 123) en una ventana
2. Abrir formulario nuevo (FormID 124) en otra ventana

#### Comparación visual:

**Formulario 123 (Versión Antigua):**
```
┌─────────────────────────────────────────────────┐
│ 📜 Versión Histórica: 02-01                     │
│ Este formulario usa el formato original...      │
│ Creado: 15 de diciembre de 2025, 10:30         │
└─────────────────────────────────────────────────┘

Control de Productos Congelados (Liberación de Túneles)
Código: FOR-CPCLT | Versión: 02-01

Objetivo: Asegurar que los productos congelados...  ← TEXTO ANTIGUO
```

**Formulario 124 (Versión Nueva):**
```
┌─────────────────────────────────────────────────┐
│ ✅ Versión Actual: 03-01                        │
│ Este formulario usa la versión actual...       │
└─────────────────────────────────────────────────┘

Control de Productos Congelados... [ACTUALIZADO]  ← NOMBRE ACTUALIZADO
Código: FOR-CPCLT | Versión: 03-01

Objetivo: Garantizar la calidad y trazabilidad...  ← TEXTO NUEVO
```

---

## 🎯 Validaciones Finales

### ✅ Checklist de Pruebas Exitosas:

- [ ] **Guardado con snapshot:**
  - [ ] Console muestra "✅ Formulario guardado con snapshot"
  - [ ] BD tiene `TemplateSnapshot` con JSON (>1000 chars)
  - [ ] `TemplateVersion` guardado correctamente

- [ ] **Badge de versión actual (verde):**
  - [ ] Aparece cuando formulario y plantilla tienen misma versión
  - [ ] Muestra mensaje "Versión Actual"
  - [ ] `isHistorical` = false en console

- [ ] **Badge de versión histórica (amarillo):**
  - [ ] Aparece cuando plantilla fue actualizada
  - [ ] Muestra mensaje explicativo completo
  - [ ] `isHistorical` = true en console
  - [ ] Fecha de creación formateada correctamente

- [ ] **Inmutabilidad:**
  - [ ] Formulario antiguo NO cambia cuando se actualiza plantilla
  - [ ] Estructura/campos se mantienen según versión original
  - [ ] Nombre/objetivo muestran texto antiguo

- [ ] **Nuevos formularios:**
  - [ ] Usan versión actualizada de plantilla
  - [ ] Snapshot guarda cambios nuevos
  - [ ] Badge muestra versión correcta

---

## 🐛 Troubleshooting

### **Problema: No aparece el badge de versión**

**Diagnóstico:**
```sql
SELECT FormID, TemplateVersion, TemplateSnapshot
FROM FilledForms
WHERE FormID = 123;
```

**Soluciones:**
- Si `TemplateVersion` es NULL → El formulario es antiguo, fue creado antes de la migración
- Si `TemplateSnapshot` es NULL → Mismo caso, usar template actual como fallback
- Revisar console del navegador para errores de parseo

---

### **Problema: Badge siempre dice "Versión Actual"**

**Diagnóstico:**
```sql
-- Verificar que la plantilla realmente cambió de versión
SELECT Version, UpdatedAt
FROM Templates
WHERE TemplateID = 9;
```

**Soluciones:**
- Asegúrate de haber cambiado el campo `Version` de la plantilla
- Verifica que `UpdatedAt` tenga timestamp reciente
- Limpiar caché del navegador (Ctrl+F5)

---

### **Problema: Error al parsear JSON**

**Console muestra:**
```
⚠️ Error parseando JSON: Unexpected token...
```

**Solución:**
```sql
-- Ver el JSON guardado
SELECT 
    FormID,
    LEFT(TemplateSnapshot, 100) as SnapshotPreview,
    LEN(TemplateSnapshot) as Length
FROM FilledForms
WHERE FormID = 123;
```

- Verificar que el JSON es válido
- Revisar que no haya caracteres especiales mal escapados
- Re-guardar el formulario si es necesario

---

## 📊 Queries SQL de Monitoreo

### Ver distribución de versiones:
```sql
SELECT 
    TemplateVersion,
    COUNT(*) as CantidadFormularios,
    MIN(CreatedAt) as PrimerFormulario,
    MAX(CreatedAt) as UltimoFormulario
FROM FilledForms
WHERE TemplateVersion IS NOT NULL
GROUP BY TemplateVersion
ORDER BY TemplateVersion DESC;
```

### Formularios con versiones obsoletas:
```sql
SELECT 
    f.FormID,
    t.Codigo,
    f.TemplateVersion as VersionFormulario,
    t.Version as VersionActualPlantilla,
    f.CreatedAt,
    DATEDIFF(day, f.CreatedAt, GETDATE()) as DiasDesdeCreacion
FROM FilledForms f
INNER JOIN Templates t ON f.TemplateID = t.TemplateID
WHERE f.TemplateVersion != t.Version
ORDER BY f.CreatedAt DESC;
```

### Tamaño de snapshots:
```sql
SELECT 
    FormID,
    TemplateVersion,
    LEN(TemplateSnapshot) as SnapshotBytes,
    LEN(TemplateSnapshot) / 1024.0 as SnapshotKB,
    CreatedAt
FROM FilledForms
WHERE TemplateSnapshot IS NOT NULL
ORDER BY LEN(TemplateSnapshot) DESC;
```

---

## ✅ Resultados Esperados

Al finalizar todas las pruebas:

1. ✅ Formularios se guardan con snapshot completo de plantilla
2. ✅ Badge verde aparece para versiones actuales
3. ✅ Badge amarillo aparece para versiones históricas
4. ✅ Formularios antiguos mantienen su formato original
5. ✅ Nuevos formularios usan plantilla actualizada
6. ✅ Sistema funciona sin errores en console
7. ✅ Responsive funciona en tablet/móvil

---

**¡Sistema de versionamiento validado! 🎉**

Fecha de prueba: __________
Realizado por: __________
Estado: ☐ Exitoso  ☐ Con observaciones  ☐ Requiere ajustes
