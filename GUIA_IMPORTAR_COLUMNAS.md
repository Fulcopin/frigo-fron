# 🚀 GUÍA PASO A PASO: Importar Columnas Automáticamente

## 📌 ¿Qué hace esta funcionalidad?

Permite copiar **TODA UNA COLUMNA** de un formulario guardado (como "15 Tinas") a una columna de un nuevo formulario (como "Control de Fileteo") con un solo clic.

---

## 🎯 CASO DE USO EJEMPLO

**Quieres:**
- Copiar la columna **TOTAL** del formulario "15 Tinas" (que ya guardaste)
- A la columna **PESO NETO LBS** de un nuevo formulario "Control de Fileteo"

---

## 📝 PASOS DETALLADOS

### PASO 1: Asegúrate de tener el backend y frontend corriendo

**Terminal 1 - Backend:**
```powershell
cd c:\Users\fupifigu\Desktop\sillos\dinamic-generador\backend-frigo
dotnet run
```

Deberías ver:
```
Now listening on: http://localhost:5074
```

**Terminal 2 - Frontend:**
```powershell
cd c:\Users\fupifigu\Desktop\sillos\dinamic-generador
npm run dev
```

Deberías ver:
```
Local: http://localhost:5173/
```

---

### PASO 2: Abre el navegador

1. Ve a: **http://localhost:5173/**
2. En el menú lateral, haz clic en **"📝 Llenar Formulario"**

---

### PASO 3: Selecciona el formulario destino

1. En el selector de formularios, busca **"Control de Fileteo"** (o el formulario donde quieres PEGAR datos)
2. Selecciónalo
3. Espera a que se cargue el formulario

---

### PASO 4: Busca la tabla con columnas

1. Desplázate hacia abajo hasta encontrar la **tabla principal** del formulario
2. Verás las cabeceras de columnas como:
   ```
   #  |  FECHA  |  PESO NETO LBS  📥  |  OBSERVACIONES  |  Acciones
   ```
3. **Observa el botón verde 📥** en cada cabecera de columna

---

### PASO 5: Haz clic en el botón 📥 de la columna destino

1. Localiza la columna donde quieres IMPORTAR datos (ej: **PESO NETO LBS**)
2. **Haz clic en el botón 📥** verde que aparece junto al nombre de la columna
3. Se abrirá un **modal grande** con el título:
   ```
   📥 Importar Columna Automáticamente
   Copiar toda la columna desde otro formulario → "PESO NETO LBS"
   ```

---

### PASO 6: Selecciona el formulario origen

En el modal verás una **lista de tarjetas** con todos los formularios guardados:

```
┌─────────────────────────────────────┐
│ 📄 Registro 15 Tinas (Filas...)    │
│ 🔢 ID: 17                           │
│ 📅 2025-12-22 20:25:49              │
│ 🔖 Código: [código si existe]      │
│ 📊 15 filas disponibles             │
└─────────────────────────────────────┘
```

1. **Busca el formulario "15 Tinas"** (o el formulario del cual quieres COPIAR datos)
2. **Haz clic en la tarjeta** del formulario
3. El modal cambiará y mostrará los datos del formulario seleccionado

---

### PASO 7: Selecciona la columna origen

Ahora verás:

**A) Información del formulario:**
```
📄 Formulario origen: Registro 15 Tinas (ID: 17)
🎯 Columna destino: PESO NETO LBS
```

**B) Botones de columnas disponibles:**
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│    HORA      │  │    TINA      │  │   PESO1      │
│  0 valores   │  │  15 valores  │  │  10 valores  │
│  Ej: -       │  │  Ej: T1      │  │  Ej: 44      │
└──────────────┘  └──────────────┘  └──────────────┘

┌──────────────┐  ┌──────────────┐  
│    TOTAL     │  │   PESO2      │  ...
│  15 valores  │  │  8 valores   │
│  Ej: 16086.99│  │  Ej: 444     │
└──────────────┘  └──────────────┘
```

**C) Vista previa de la tabla** (abajo)

---

### PASO 8: Importa los datos

1. **Localiza el botón de la columna TOTAL** (o la columna que contiene los datos que quieres copiar)
2. **Haz clic en el botón "TOTAL"**
3. Verás un mensaje de confirmación:
   ```
   ✅ ¡Columna importada!
   
   📤 Origen: TOTAL
   📥 Destino: PESO NETO LBS
   📊 15 valores copiados
   ```
4. El modal se cerrará automáticamente

---

### PASO 9: Verifica los datos importados

1. En la tabla del formulario, la columna **PESO NETO LBS** ahora tendrá los valores copiados:
   ```
   Fila 1: 16086.99
   Fila 2: [valor del TOTAL de la fila 2]
   Fila 3: [valor del TOTAL de la fila 3]
   ...
   ```

2. Los datos se copiaron **automáticamente** de todas las filas del formulario origen

---

### PASO 10: Guarda el formulario

1. Rellena los demás campos obligatorios (Fecha, etc.)
2. Haz clic en el botón **"💾 Guardar Formulario"**
3. ¡Listo! Tu formulario con los datos importados ha sido guardado

---

## 🎨 INTERFAZ DEL BOTÓN 📥

El botón 📥 aparece en **TODAS las cabeceras de columnas** de las tablas:

```
┌────────────────────────────────────────────────────┐
│  #  │  FECHA 📥  │  PESO NETO LBS 📥  │  Acciones │
├─────┼────────────┼────────────────────┼───────────┤
│  1  │            │                    │    ❌     │
│  2  │            │                    │    ❌     │
```

**Características del botón:**
- 🎨 Color verde degradado
- 📏 Tamaño pequeño y discreto
- 💡 Tooltip al pasar el mouse: "Importar datos para '[nombre columna]' desde otro formulario"

---

## 🔧 CASOS DE USO REALES

### Caso 1: Copiar TOTAL → PESO NETO LBS
```
Formulario origen: 15 Tinas
Columna origen: TOTAL (con valores como 16086.99, 8500.50, etc.)
↓
Formulario destino: Control de Fileteo
Columna destino: PESO NETO LBS
```

### Caso 2: Copiar FECHA → FECHA
```
Formulario origen: Registro de Producción
Columna origen: FECHA
↓
Formulario destino: Control de Calidad
Columna destino: FECHA
```

### Caso 3: Copiar LOTE → CÓDIGO LOTE
```
Formulario origen: Recepción Materia Prima
Columna origen: LOTE
↓
Formulario destino: Trazabilidad
Columna destino: CÓDIGO LOTE
```

---

## ⚠️ NOTAS IMPORTANTES

1. **El sistema es inteligente**: Busca coincidencias por nombre de columna (ignora mayúsculas/minúsculas y sufijos como _T1, _T2)

2. **Copia fila por fila**: Si el formulario origen tiene 15 filas, copiará los 15 valores a las primeras 15 filas del formulario destino

3. **Valores vacíos**: Si una celda está vacía en el origen, copiará un valor vacío

4. **Más filas en destino**: Si el destino tiene más filas que el origen, las filas adicionales quedarán vacías

5. **Menos filas en destino**: Si el destino tiene menos filas, solo copiará hasta donde alcance

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Error: "No se pudo encontrar el ID del formulario"
**Solución**: Verifica que el backend esté corriendo en localhost:5074

### Error: "No hay datos para importar"
**Solución**: Asegúrate de haber seleccionado un formulario y una columna

### El botón 📥 no aparece
**Solución**: 
1. Refresca la página (F5)
2. Verifica que estás en una tabla (no en campos de header)
3. Asegúrate de que el frontend esté actualizado

### Los valores no se copian correctamente
**Solución**: 
1. Verifica que los nombres de columna sean similares
2. Revisa la consola del navegador (F12) para ver logs detallados

---

## 📊 LOGS DE DEPURACIÓN

Abre la consola del navegador (F12 → Consola) para ver logs como:

```
📥 Abriendo importador de columnas...
   🎯 Columna destino: PESO NETO LBS
   📍 Elemento: 0 Columna: 2
📋 20 formularios disponibles para importar
📖 Cargando formulario para importar columnas...
   🔢 FormID detectado: 17
   📡 Endpoint: http://localhost:5074/api/FilledForms/17/simple
✅ Datos recibidos del endpoint /simple: {...}
🚀 IMPORTANDO COLUMNA AUTOMÁTICAMENTE...
   📤 Columna origen: TOTAL
   📥 Columna destino: PESO NETO LBS
📊 Encontrados 15 valores para importar
   ✅ Fila 1: "16086.99" → PESO_NETO_LBS_T1
   ✅ Fila 2: "8500.50" → PESO_NETO_LBS_T2
   ...
```

---

## 🎉 ¡LISTO!

Ahora puedes importar columnas completas entre formularios en segundos, ahorrando tiempo y evitando errores de digitación manual.

**¿Necesitas ayuda?** Revisa los logs de la consola o contacta al equipo de desarrollo.
