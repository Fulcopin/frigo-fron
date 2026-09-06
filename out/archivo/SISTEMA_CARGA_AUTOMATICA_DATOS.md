# 🤖 Sistema de Carga Automática de Datos entre Formularios

## ✨ Actualización: Mapeo Automático Inteligente

Se ha mejorado el sistema de carga de datos para que sea **completamente automático** y mapee columnas por nombre.

---

## 🎯 ¿Qué hace?

El sistema ahora **detecta automáticamente** las columnas compatibles entre dos formularios comparando sus nombres, incluso si tienen sufijos diferentes (_T1, _T2, etc.).

### Ejemplo Práctico:

**Formulario Origen** ("15 Tinas" guardado):
- TINA_T1, TINA_T2, ..., TINA_T15
- HORA_T1, HORA_T2, ..., HORA_T15
- PESO1_T1, PESO1_T2, ..., PESO1_T15

**Formulario Destino** ("Control de Fileteo"):
- TINA_T1, TINA_T2, ..., TINA_T10
- HORA_T1, HORA_T2, ..., HORA_T10
- PESO1_T1, PESO1_T2, ..., PESO1_T10

**El sistema automáticamente:**
1. ✅ Detecta que ambos tienen columnas TINA, HORA, PESO1
2. ✅ Mapea TINA_T1 → TINA_T1, TINA_T2 → TINA_T2, etc.
3. ✅ Copia todas las 15 filas del origen con sus sufijos correctos
4. ✅ Preserva los valores exactos en cada celda

---

## 🚀 Cómo Usar

### Opción 1: Carga Automática Total (Recomendado)

1. **Abre el panel de carga** (botón morado "📂 Cargar Datos desde Formularios Llenos")

2. **Selecciona el tipo de formulario origen**
   - Ejemplo: "15 Tinas"
   - Verás cuántos formularios guardados hay disponibles

3. **Selecciona un formulario específico**
   - Verás la fecha, código y número de filas
   - Vista previa de los datos

4. **Haz clic en "⚡ Cargar TODO Automáticamente"**
   - El sistema detectará automáticamente las columnas compatibles
   - Mapeará por nombre (TINA → TINA, HORA → HORA, etc.)
   - Copiará todas las filas con los sufijos correctos
   - Te mostrará un resumen de lo que se copió

5. **¡Listo!** Los datos están cargados, ahora solo guarda el formulario

### Opción 2: Selección Manual de Campos

Si quieres más control, usa el botón **"🎯 Seleccionar Campos Específicos"** para elegir manualmente qué columnas copiar.

---

## 🔧 Funciones Técnicas Agregadas

### 1. `createAutoMapping(sourceFormData)`
**Ubicación:** Línea ~688
**Función:** Crea mapeo automático comparando nombres de columnas

```javascript
// Detecta columnas automáticamente
const autoMapping = createAutoMapping(fullFormData);

// Resultado:
{
  headerMapping: { 'Código': 'Código', 'FECHA': 'FECHA' },
  bodyMapping: [{
    sourceTableIndex: 0,
    targetTableIndex: 0,
    copyAllRows: true,
    fieldMapping: {
      'TINA_T1': 'TINA',
      'TINA_T2': 'TINA',
      'HORA_T1': 'HORA',
      'PESO1_T1': 'PESO1',
      // ... etc
    }
  }]
}
```

**Características:**
- ✅ Ignora sufijos (_T1, _T2) al comparar nombres
- ✅ Solo mapea columnas que existen en ambos formularios
- ✅ Mapea campos de header con mismo nombre
- ✅ Log detallado en consola de cada campo mapeado

### 2. Mejora en `mapAndTransferFormData()`
**Ubicación:** Línea ~780
**Función:** Ahora soporta mapeo con sufijos automáticos

**Lógica mejorada:**
```javascript
// Antes: copiaba tal cual (sufijos incorrectos)
newRow = { ...sourceRow };

// Ahora: mapea con sufijos correctos
newRow = {};
const rowSuffix = `_T${rowIndex + 1}`; // _T1, _T2, _T3...

Object.entries(fieldMapping).forEach(([sourceField, targetBase]) => {
  // HORA_T1 del origen → HORA + _T1 = HORA_T1 en destino
  const targetField = targetBase + rowSuffix;
  newRow[targetField] = sourceRow[sourceField];
});
```

**Resultado:**
- ✅ Cada fila mantiene su número correcto (fila 1 → _T1, fila 2 → _T2)
- ✅ Los valores se copian a las columnas correctas
- ✅ No hay conflictos de nombres

### 3. Botón Mejorado
**Ubicación:** Línea ~2596
**Función:** Usa mapeo automático y muestra resumen

**Características:**
- ✅ Detecta automáticamente columnas compatibles
- ✅ Valida que hay campos para mapear
- ✅ Muestra alerta si no hay compatibilidad
- ✅ Muestra resumen: "📝 Header: 2 campos, 📊 Tabla: 8 columnas, 📦 15 filas copiadas"

---

## 📊 Ejemplo de Logs en Consola

Al hacer clic en "⚡ Cargar TODO Automáticamente", verás:

```
🤖 Creando mapeo automático inteligente...
   📝 Header auto-mapeado: Código
   📝 Header auto-mapeado: FECHA
   📊 Columnas origen detectadas: [TINA_T1, TINA_T2, ..., HORA_T1, PESO1_T1, ...]
   🎯 Nombres base origen: [TINA, HORA, PESO1, PESO2, PESO3, ...]
   🎯 Nombres base destino: [TINA, HORA, PESO1, PESO2, PESO3, ...]
   ✅ Columna auto-mapeada: TINA_T1 → TINA
   ✅ Columna auto-mapeada: TINA_T2 → TINA
   ✅ Columna auto-mapeada: HORA_T1 → HORA
   ... (continúa para cada columna)
   📦 Total campos mapeados: 45
✅ Mapeo automático creado

═══════════════════════════════════════════════════
🔄 INICIANDO TRANSFERENCIA DE DATOS DESDE FORMULARIO LLENO
═══════════════════════════════════════════════════
📥 Formulario origen (lleno):
   - FormID: 38
   - Total de filas: 15

📊 === MAPEANDO DATOS DE TABLAS (BODY) ===
🗂️ Mapeo de tabla 1:
   📋 Modo: COPIAR TODAS LAS FILAS (15 filas)
   🎯 Usando mapeo de campos con sufijos automáticos
      ✅ TINA_T1 → TINA_T1 = "T1"
      ✅ HORA_T1 → HORA_T1 = "08:00"
      ✅ PESO1_T1 → PESO1_T1 = "25.5"
   📝 Fila 1 mapeada con 8 campos
   ✅ Total de filas mapeadas: 15

✅ TRANSFERENCIA DE DATOS COMPLETADA EXITOSAMENTE
📊 Resumen:
   - Campos de header actualizados: 3
   - Filas en tabla destino: 15
   - Estado: Listo para guardar
```

---

## ⚠️ Notas Importantes

1. **Nombres de Columnas Deben Coincidir:**
   - El sistema compara nombres base (sin sufijos)
   - Si una columna se llama "TINA" en origen y "TINAA" en destino, NO se mapearán

2. **Solo Copia Columnas Existentes:**
   - Si el origen tiene 20 columnas pero el destino solo 10, solo se copian las 10 compatibles

3. **Preserva Datos Exactos:**
   - Los valores se copian tal cual: "T1" → "T1", "08:00" → "08:00"
   - No hay conversiones ni transformaciones

4. **Requiere Guardar:**
   - Los datos se cargan en memoria, pero debes hacer clic en "💾 Guardar" para persistirlos

---

## 🎉 Beneficios

✅ **Cero configuración:** No necesitas mapear manualmente
✅ **Inteligente:** Detecta columnas automáticamente
✅ **Rápido:** Carga masiva de datos en segundos
✅ **Seguro:** Valida compatibilidad antes de copiar
✅ **Transparente:** Logs detallados de todo el proceso
✅ **Flexible:** Opción manual si necesitas más control

---

## 📝 Archivos Modificados

- **FillForm.jsx** (líneas 688-775, 780-870, 2596-2635)
  - Nueva función `createAutoMapping()`
  - Mejorada función `mapAndTransferFormData()`
  - Botón de carga automática actualizado

---

## 🐛 Troubleshooting

**Problema:** "No se encontraron campos compatibles"
- **Solución:** Verifica que las columnas tengan nombres iguales (TINA, HORA, etc.)
- **Tip:** Revisa los logs en consola para ver qué nombres detectó

**Problema:** "Los datos no se ven después de cargar"
- **Solución:** Los datos se cargan en las filas de la tabla
- **Tip:** Desplázate hacia abajo para ver la tabla completa

**Problema:** "Se copiaron menos filas de las esperadas"
- **Solución:** El destino podría tener menos filas disponibles
- **Tip:** Usa "Agregar Fila" para crear más filas antes de cargar

---

Creado: 2 de enero de 2026
