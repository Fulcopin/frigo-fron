# 📋 Guía: Cargar Datos desde Formularios Guardados

## 🎯 ¿Qué es esta funcionalidad?

Permite **importar datos de formularios previamente guardados** a un nuevo formulario. Por ejemplo:
- Cargar datos del formulario "15 Tinas" al formulario "Control de Fileteo"
- Reutilizar información sin re-ingresarla manualmente
- Mantener trazabilidad entre procesos

---

## 🚀 Cómo Usar

### 1️⃣ Crear un Nuevo Formulario

1. Ve a **"Llenar Formulario"**
2. Selecciona el template destino (ej: "Control de Fileteo")
3. Elige lotes o continúa manualmente

### 2️⃣ Abrir el Panel de Carga de Datos

En la parte superior del formulario, verás un panel morado:

```
📋 Cargar Datos desde Formulario Guardado
Importa datos de formularios previamente guardados (ej: "15 Tinas")
                                          [📂 Abrir Selector]
```

Haz clic en **"📂 Abrir Selector"**

### 3️⃣ Seleccionar el Tipo de Formulario Origen

En el dropdown **"1️⃣ Selecciona el tipo de formulario origen"**:
- Elige el template del que quieres obtener datos
- Ejemplo: `F-PCC-PRD-36 - Registro de Producción de Fileteo (15 Tinas)`

El sistema cargará todos los formularios guardados de ese tipo.

### 4️⃣ Seleccionar el Formulario Específico

En el dropdown **"2️⃣ Selecciona el formulario específico"**:
- Verás la lista de formularios guardados ordenados por fecha (más recientes primero)
- Ejemplo: `ID 35 - 2/1/2026 14:30:00 - Código: F-PCC-PRD-36`

Selecciona el formulario que contiene los datos que necesitas.

### 5️⃣ Vista Previa y Confirmación

Verás una vista previa de los datos:

```
3️⃣ Vista previa del formulario seleccionado:

📅 Fecha: 2/1/2026 14:30:00
📋 Datos del header:
{
  "Código": "F-PCC-PRD-36",
  "Versión": "1",
  "Lote de Proceso": "L-001"
}
```

### 6️⃣ Cargar los Datos

Haz clic en **"✨ Cargar Datos al Formulario Actual"**

Los datos se transferirán automáticamente:
- ✅ Campos del header mapeados
- ✅ Filas de tablas copiadas
- ✅ Valores preservados

---

## ⚙️ Configuración de Mapeo

### Mapeo Automático Predeterminado

Por defecto, el sistema mapea:

**Header:**
```javascript
'Código' → 'Código'
'Versión' → 'Versión'
'Lote de Proceso' → 'Lote de Proceso'
```

**Tablas:**
```javascript
// Copia completa de la tabla 0 (primera tabla)
sourceTableIndex: 0 → targetTableIndex: 0
copyAllRows: true  // Todas las filas con todos sus campos
```

### Personalizar el Mapeo

Para personalizar el mapeo, edita la configuración en `FillForm.jsx` (línea ~2040):

```javascript
const mappingConfig = {
  // === MAPEO DE HEADER ===
  headerMapping: {
    // 'CampoDestino': 'CampoOrigen'
    'Código de Fileteo': 'Código de Producción',
    'Lote Destino': 'Lote de Proceso',
    'Fecha Proceso': 'Fecha'
  },
  
  // === MAPEO DE TABLAS ===
  bodyMapping: [
    {
      sourceTableIndex: 0,  // Primera tabla del origen
      targetTableIndex: 0,  // Primera tabla del destino
      copyAllRows: true     // Copiar todas las filas completas
    },
    
    // O mapeo selectivo de campos específicos:
    {
      sourceTableIndex: 0,
      targetTableIndex: 1,
      fieldMapping: {
        // 'CampoDestino': 'CampoOrigen'
        'HORA_T1': 'HORA_T1',
        'TINA_T1': 'TINA_T1',
        'PESO_BRUTO_T1': 'PESO1_T1',
        'PESO_NETO_T1': 'PESO2_T1'
      }
    }
  ]
};
```

---

## 🔧 Casos de Uso Comunes

### Caso 1: De "15 Tinas" a "Control de Fileteo"

**Objetivo:** Cargar los datos de peso y hora de las tinas al proceso de fileteo.

**Configuración:**
```javascript
{
  headerMapping: {
    'Lote de Proceso': 'Lote de Proceso',
    'Código': 'Código'
  },
  bodyMapping: [{
    sourceTableIndex: 0,
    targetTableIndex: 0,
    copyAllRows: true  // Copiar todas las 15 tinas
  }]
}
```

### Caso 2: Mapeo Selectivo de Campos

**Objetivo:** Solo copiar HORA y TINA, pero no los PESOS.

**Configuración:**
```javascript
{
  bodyMapping: [{
    sourceTableIndex: 0,
    targetTableIndex: 0,
    fieldMapping: {
      // Solo mapear estos campos específicos
      'HORA_T1': 'HORA_T1',
      'HORA_T2': 'HORA_T2',
      // ... hasta T15
      'TINA_T1': 'TINA_T1',
      'TINA_T2': 'TINA_T2'
      // ... hasta T15
    }
  }]
}
```

### Caso 3: Múltiples Tablas

**Objetivo:** Copiar datos de dos tablas diferentes.

**Configuración:**
```javascript
{
  bodyMapping: [
    {
      sourceTableIndex: 0,  // Tabla de Producción
      targetTableIndex: 0,  // Tabla de Datos Generales
      copyAllRows: true
    },
    {
      sourceTableIndex: 1,  // Tabla de Calidad
      targetTableIndex: 2,  // Tabla de Control de Calidad
      copyAllRows: true
    }
  ]
}
```

---

## 📊 Logs de Consola

El sistema genera logs detallados en la consola:

```
📋 Cargando formularios guardados del template 36...
✅ 5 formularios encontrados para template 36

📥 Cargando datos del formulario 35...
✅ Datos del formulario cargados

🔄 Iniciando transferencia de datos...
   Datos origen: {...}
   Configuración de mapeo: {...}
   
   ✓ Header: Código → Código = "F-PCC-PRD-36"
   ✓ Header: Versión → Versión = "1"
   
   📋 Copiando 15 filas completas...
   ✓ Fila 0: HORA_T1 → HORA_T1 = "08:30"
   ✓ Fila 0: TINA_T1 → TINA_T1 = "T1"
   ✓ Fila 0: PESO1_T1 → PESO1_T1 = "45.5"
   ...

✅ Transferencia de datos completada
```

---

## 🎨 Interfaz Visual

### Panel Cerrado
```
┌────────────────────────────────────────────────┐
│ 📋 Cargar Datos desde Formulario Guardado     │
│ Importa datos de formularios previamente...   │
│                            [📂 Abrir Selector] │
└────────────────────────────────────────────────┘
```

### Panel Abierto
```
┌────────────────────────────────────────────────┐
│ 📋 Cargar Datos desde Formulario Guardado     │
│ Importa datos de formularios previamente...   │
│                              [❌ Cerrar]       │
├────────────────────────────────────────────────┤
│                                                │
│ 1️⃣ Selecciona el tipo de formulario origen:   │
│ ┌──────────────────────────────────────────┐  │
│ │ F-PCC-PRD-36 - Registro de Producción ▼ │  │
│ └──────────────────────────────────────────┘  │
│                                                │
│ 2️⃣ Selecciona el formulario específico:       │
│ ┌──────────────────────────────────────────┐  │
│ │ ID 35 - 2/1/2026 14:30:00 - Código... ▼ │  │
│ └──────────────────────────────────────────┘  │
│                                                │
│ 3️⃣ Vista previa:                               │
│ ┌──────────────────────────────────────────┐  │
│ │ 📅 Fecha: 2/1/2026 14:30:00             │  │
│ │ 📋 Datos del header: {...}              │  │
│ └──────────────────────────────────────────┘  │
│                                                │
│ ┌──────────────────────────────────────────┐  │
│ │   ✨ Cargar Datos al Formulario Actual   │  │
│ └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

---

## ⚠️ Consideraciones Importantes

### ✅ Lo que SÍ hace:
- ✅ Copia datos de formularios guardados
- ✅ Mapea campos automáticamente según configuración
- ✅ Preserva integridad de sufijos (_T1, _T2, etc.)
- ✅ Funciona con múltiples tablas
- ✅ Logs detallados para debugging

### ❌ Lo que NO hace:
- ❌ No modifica el formulario origen
- ❌ No guarda automáticamente (debes hacer clic en "Guardar Formulario")
- ❌ No valida compatibilidad entre templates (debes configurar el mapeo correctamente)

### 💡 Mejores Prácticas:
1. **Probar primero con un formulario de prueba** antes de cargar datos reales
2. **Verificar la vista previa** antes de cargar
3. **Revisar los logs de consola** si algo no funciona
4. **Guardar el formulario** después de cargar datos
5. **Personalizar el mapeo** según tus necesidades específicas

---

## 🔍 Troubleshooting

### Problema: "No hay formularios guardados para este template"
**Solución:** Asegúrate de que existen formularios guardados del template seleccionado.

### Problema: Los campos se cargan vacíos
**Solución:** Revisa el `mappingConfig`. Los nombres de campo deben coincidir exactamente (sensible a mayúsculas).

### Problema: Se copian campos no deseados
**Solución:** Usa `fieldMapping` en lugar de `copyAllRows: true` para control preciso.

### Problema: Los sufijos no coinciden (_T1 vs _T16)
**Solución:** El sistema automáticamente ajusta sufijos. Verifica los logs de consola.

---

## 📚 Referencia de API

### Funciones Disponibles

#### `loadSourceFormsFromTemplate(templateId)`
Carga todos los formularios guardados de un template específico.

**Parámetros:**
- `templateId` (number): ID del template origen

**Retorna:**
- Array de formularios ordenados por fecha

**Ejemplo:**
```javascript
await loadSourceFormsFromTemplate(36);
// Retorna: [{formID: 35, createdAt: "2026-01-02", ...}, ...]
```

#### `loadDataFromSourceForm(formId)`
Carga los datos completos de un formulario específico.

**Parámetros:**
- `formId` (number): ID del formulario

**Retorna:**
- Objeto con headerData y bodyData

**Ejemplo:**
```javascript
const data = await loadDataFromSourceForm(35);
// Retorna: {formID: 35, headerData: {...}, bodyData: [...]}
```

#### `mapAndTransferFormData(sourceFormData, mappingConfig)`
Transfiere datos mapeados al formulario actual.

**Parámetros:**
- `sourceFormData` (object): Datos del formulario origen
- `mappingConfig` (object): Configuración de mapeo

**Ejemplo:**
```javascript
mapAndTransferFormData(sourceData, {
  headerMapping: { 'Código': 'Código' },
  bodyMapping: [{ sourceTableIndex: 0, targetTableIndex: 0, copyAllRows: true }]
});
```

---

## 🎓 Conclusión

Esta funcionalidad permite crear **flujos de trabajo inteligentes** donde los datos fluyen automáticamente entre formularios relacionados, reduciendo:
- ⏱️ Tiempo de ingreso de datos
- ❌ Errores de transcripción
- 📝 Duplicación de trabajo

¡Aprovecha esta funcionalidad para mejorar la eficiencia de tus procesos! 🚀
