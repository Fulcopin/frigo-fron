# 📋 Selector Interactivo de Datos

## ✨ Nueva Funcionalidad: Copiar Datos de Formularios Guardados

Se ha agregado un **selector interactivo de datos** que permite copiar valores específicos de formularios guardados a campos individuales del formulario actual.

---

## 🎯 ¿Para qué sirve?

Imagina que estás llenando "Control de Fileteo" y necesitas:
- ✅ Copiar la **HORA** de la fila 3 del "15 Tinas"
- ✅ Copiar el **TOTAL** del formulario anterior
- ✅ Copiar cualquier **valor específico** sin cargar todo el formulario

**Antes:** Tenías que abrir el formulario guardado, copiar el valor, y pegarlo manualmente

**Ahora:** Haces clic en el botón 📋 junto al campo, seleccionas el formulario, y haces clic en el valor que quieres copiar

---

## 🚀 Cómo Usar

### Paso 1: Ubica el campo donde quieres pegar datos

Ejemplo: Estás en el campo "PESO NETO LBS" del formulario "Control de Fileteo"

### Paso 2: Haz clic en el botón 📋

Cada campo ahora tiene un botón **morado con el ícono 📋** a la derecha del input.

### Paso 3: Selecciona el formulario guardado

Se abrirá un modal mostrando todos los formularios guardados disponibles. Verás:
- 📄 **FormID** (número único)
- 📅 **Fecha** de guardado
- 🔖 **Código** (si aplica)
- 📊 **Cantidad de filas**

Haz clic en el formulario que contiene los datos que necesitas.

### Paso 4: Explora los datos

El modal mostrará dos secciones:

#### 📝 Información General (Header)
- Campos como: Código, Fecha, Lote de Proceso, etc.
- **Haz clic en cualquier valor** para copiarlo

#### 📊 Tabla de Datos
- Todas las filas y columnas del formulario
- **Haz clic en cualquier celda** para copiar su valor
- Ejemplo: Fila 3, columna HORA = "08:30" → click y se copia "08:30"

### Paso 5: Confirma la copia

Verás un mensaje de confirmación:
```
✅ Valor copiado: "08:30"
📝 Al campo: PESO NETO LBS
```

El valor se ha pegado automáticamente en el campo donde hiciste clic originalmente.

---

## 🎨 Características Visuales

### Botón 📋 (Selector de Datos)
- **Color:** Morado degradado
- **Ubicación:** A la derecha de cada campo input
- **Tooltip:** "Copiar dato de un formulario guardado"
- **Efecto hover:** Crece y cambia de sombra

### Modal de Selección
- **Tamaño:** Grande (hasta 1400px de ancho)
- **Scroll:** Si hay muchos datos, tiene scroll interno
- **Interactividad:** 
  - Cards de formularios con hover (se resaltan en azul)
  - Celdas de tabla con hover (fondo azul claro + negritas)
  - Botón "← Volver a lista" para cambiar de formulario

### Feedback Visual
- ✅ **Hover en cards:** Borde azul + sombra
- ✅ **Hover en celdas:** Fondo azul claro + texto en negritas
- ✅ **Cursor:** Cambia a "pointer" en elementos clickeables

---

## 💡 Casos de Uso Reales

### Caso 1: Copiar HORA de 15 Tinas a Fileteo

**Escenario:** Necesitas copiar la hora de la tina T3 al campo "HORA" de Fileteo

**Pasos:**
1. En "Control de Fileteo", ubica el campo "HORA"
2. Click en botón 📋
3. Selecciona el formulario "15 Tinas" guardado
4. Busca la fila 3 (T3) en la tabla
5. Click en la celda de la columna "HORA" → Valor copiado: "08:30"

### Caso 2: Copiar TOTAL al PESO NETO

**Escenario:** Quieres usar el TOTAL del "15 Tinas" como PESO NETO en "Fileteo"

**Pasos:**
1. En "Control de Fileteo", ubica el campo "PESO NETO LBS"
2. Click en botón 📋
3. Selecciona el formulario "15 Tinas" guardado
4. Busca la última fila donde está el TOTAL
5. Click en la celda del TOTAL → Valor copiado: "157.99"

### Caso 3: Copiar Código de un formulario anterior

**Escenario:** Quieres reutilizar el código de un formulario guardado

**Pasos:**
1. En el nuevo formulario, ubica el campo "Código"
2. Click en botón 📋
3. Selecciona cualquier formulario guardado
4. En la sección "📝 Información General", click en el valor de "Código"
5. Valor copiado: "FRM-15-TINAS-2026-001"

---

## 🔧 Funciones Técnicas Agregadas

### 1. `openDataPicker(callback, fieldLabel)`
**Ubicación:** Línea ~1082
**Función:** Abre el modal de selector de datos

```javascript
openDataPicker(
  (selectedValue) => handleHeaderChangeWithAutoSave(field.label, selectedValue),
  'Campo HORA'
);
```

**Parámetros:**
- `callback`: Función que recibe el valor seleccionado y lo aplica
- `fieldLabel`: Etiqueta del campo (para mostrar en el modal)

**Proceso:**
1. Carga lista de formularios disponibles (si no está cargada)
2. Guarda el callback en el estado
3. Abre el modal

### 2. `loadFormDataInPicker(formId)`
**Ubicación:** Línea ~1105
**Función:** Carga los datos completos de un formulario en el selector

```javascript
loadFormDataInPicker(38); // Carga FormID 38
```

**Proceso:**
1. Llama a `loadDataFromSourceForm(formId)`
2. Guarda los datos en `dataPickerForm`
3. Muestra la tabla interactiva

### 3. `copyValueFromPicker(value)`
**Ubicación:** Línea ~1118
**Función:** Copia el valor seleccionado al campo actual

```javascript
copyValueFromPicker("08:30"); // Copia "08:30" al campo
```

**Proceso:**
1. Ejecuta el callback guardado con el valor
2. Cierra el modal
3. Muestra mensaje de confirmación

### 4. Modificación en `renderField` - Botón 📋
**Ubicación:** Línea ~3100
**Función:** Agrega botón junto a cada campo

**HTML generado:**
```jsx
<div style={{ display: 'flex', gap: '0.5rem' }}>
  {renderField(...)}
  <button onClick={() => openDataPicker(...)}>📋</button>
</div>
```

---

## 📊 Estados Agregados

### Línea ~122-125
```javascript
const [showDataPicker, setShowDataPicker] = useState(false);
const [dataPickerForm, setDataPickerForm] = useState(null);
const [currentFieldForPicker, setCurrentFieldForPicker] = useState(null);
```

**Propósitos:**
- `showDataPicker`: Control de visibilidad del modal
- `dataPickerForm`: Datos del formulario seleccionado
- `currentFieldForPicker`: Info del campo actual (label + callback)

---

## 🎨 Interfaz del Modal

### Estructura del Modal (Línea ~3055-3353)

```
┌─────────────────────────────────────────────────┐
│ 📋 Selector de Datos - CAMPO ACTUAL      [✕]  │
│ Haz clic en cualquier celda para copiar su... │
├─────────────────────────────────────────────────┤
│                                                  │
│  Sin formulario seleccionado:                   │
│  ┌────────┐ ┌────────┐ ┌────────┐              │
│  │FormID38│ │FormID37│ │FormID36│              │
│  │📅 2/1  │ │📅 2/1  │ │📅 1/1  │              │
│  │📊15fila│ │📊15fila│ │📊12fila│              │
│  └────────┘ └────────┘ └────────┘              │
│                                                  │
│  Con formulario seleccionado:                   │
│  [← Volver a lista]                             │
│                                                  │
│  📝 Información General (Header)                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │Código   │ │Fecha    │ │Lote     │          │
│  │FRM-001  │ │2026-01-2│ │LP-2026  │          │
│  └─────────┘ └─────────┘ └─────────┘          │
│                                                  │
│  📊 Tabla de Datos                              │
│  ┌─┬──────┬──────┬───────┬───────┬──────┐     │
│  │#│HORA  │TINA  │PESO1  │PESO2  │TOTAL │     │
│  ├─┼──────┼──────┼───────┼───────┼──────┤     │
│  │1│08:00 │T1    │25.5   │12.3   │37.8  │     │
│  │2│08:30 │T2    │30.2   │15.1   │45.3  │     │
│  └─┴──────┴──────┴───────┴───────┴──────┘     │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## ⚡ Ventajas

✅ **Rápido:** 2 clicks para copiar cualquier dato
✅ **Visual:** Ves todos los datos antes de copiar
✅ **Preciso:** Copias exactamente el valor que necesitas
✅ **Flexible:** Funciona con cualquier campo (header o tabla)
✅ **Escalable:** Funciona con cualquier template de formulario
✅ **Intuitivo:** Interfaz clara con feedback visual

---

## 🆚 Comparación con Carga Masiva

| Característica | Carga Masiva | Selector Interactivo |
|----------------|--------------|---------------------|
| **Uso** | Copiar todo el formulario | Copiar valores específicos |
| **Velocidad** | Más rápido para copiar todo | Más rápido para copiar 1-2 valores |
| **Precisión** | Mapea automáticamente | Selección manual precisa |
| **Flexibilidad** | Solo columnas compatibles | Cualquier celda |
| **Ideal para** | Formularios completos | Valores individuales |

**Recomendación:** 
- Usa **Carga Masiva** (⚡) cuando necesites copiar 10+ campos
- Usa **Selector Interactivo** (📋) cuando necesites 1-5 valores específicos

---

## 🐛 Troubleshooting

**Problema:** "No hay formularios guardados disponibles"
- **Solución:** Primero guarda al menos un formulario del tipo que estás usando
- **Nota:** El selector solo muestra formularios del mismo template

**Problema:** "No puedo hacer clic en las celdas"
- **Solución:** Asegúrate de haber seleccionado un formulario primero
- **Tip:** Verás que las celdas cambian de color al pasar el mouse

**Problema:** "El valor se copió pero no veo cambios"
- **Solución:** El valor se guardó en el campo, pero puede no estar visible si el acordeón está colapsado
- **Tip:** Expande el acordeón para ver el campo actualizado

---

## 📝 Notas Adicionales

1. **Autoguardado:** Los valores copiados activan el autoguardado si está habilitado

2. **Validación:** Los valores copiados pasan por las mismas validaciones que si los escribieras manualmente

3. **Compatibilidad:** Funciona con todos los tipos de campo (text, number, date, etc.)

4. **Performance:** Solo carga los datos del formulario cuando lo seleccionas (lazy loading)

5. **Historial:** No se puede copiar de versiones anteriores, solo de formularios guardados

---

Creado: 2 de enero de 2026
Versión: 1.0
