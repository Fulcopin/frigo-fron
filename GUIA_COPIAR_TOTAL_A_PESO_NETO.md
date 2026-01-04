# 🎯 GUÍA: Copiar TOTAL → PESO NETO LBS.

## ✅ Caso de Uso: 
Copiar todos los valores de la columna **"TOTAL"** del formulario "Registro 15 Tinas" a la columna **"PESO NETO LBS."** del formulario "Control de Fileteo".

---

## 📋 PASO A PASO

### 1️⃣ Abrir el Formulario Destino
1. Ve a **http://localhost:5173/**
2. Clic en **"Llenar Formulario"** o **"Editar Formulario Lleno"**
3. Busca y abre el formulario **"Control de Fileteo"** (o créalo nuevo)

### 2️⃣ Localizar la Columna Destino
En el formulario "Control de Fileteo" verás una tabla como esta:

```
┌──────┬────────┬──────────────┬───────────────┬─────────────┬─────────────────┐
│ HORA │ TINA * │ CÓDIGOS MAT. │ ESPECIE/PRES. │ PESO BRUTO  │ PESO NETO LBS.  │ ← Esta columna!
│      │        │   PRIMA      │               │             │      📥         │ ← Botón aquí
├──────┼────────┼──────────────┼───────────────┼─────────────┼─────────────────┤
│      │        │              │               │             │                 │
│      │        │              │               │             │                 │
│      │        │              │               │             │                 │
└──────┴────────┴──────────────┴───────────────┴─────────────┴─────────────────┘
```

### 3️⃣ Hacer Clic en el Botón 📥
- En el **encabezado** de la columna **"PESO NETO LBS."** verás un botón verde **📥**
- Haz clic en ese botón

### 4️⃣ Seleccionar el Formulario Origen
Se abrirá un modal mostrando todos los formularios guardados:

```
╔═══════════════════════════════════════════════════════════════╗
║  📥 Importar Columna Automáticamente                          ║
║  Copiar toda la columna desde otro formulario → "PESO NETO LBS." ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ① Selecciona el formulario con los datos a importar:        ║
║                                                               ║
║  ┌───────────────────────┐  ┌───────────────────────┐       ║
║  │ 📄 Registro 15 Tinas  │  │ 📄 Control de Fileteo │       ║
║  │ 🔢 ID: 38             │  │ 🔢 ID: 37             │       ║
║  │ 📅 2/1/2026, 6:19 a.m.│  │ 📅 2/1/2026, 6:15 a.m.│       ║
║  │ 📊 18 filas disponibles│  │ 📊 10 filas disponibles│      ║
║  └───────────────────────┘  └───────────────────────┘       ║
║                                                               ║
║  ← Haz clic en "Registro 15 Tinas"                           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

**Haz clic en la tarjeta "Registro 15 Tinas"**

### 5️⃣ Seleccionar la Columna Origen
Ahora verás el paso 2 del modal con todas las columnas disponibles:

```
╔═══════════════════════════════════════════════════════════════╗
║  ② Selecciona la columna a importar desde "Registro 15 Tinas" ║
║                                                               ║
║  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        ║
║  │   HORA   │ │   TINA   │ │  PESO5   │ │  TOTAL   │ ← Esta!║
║  │ 1 valores│ │ 1 valores│ │ 1 valores│ │ 1 valores│        ║
║  │  Ej: T1  │ │  Ej: 5   │ │ Ej: 3.99 │ │ Ej: 17.99│        ║
║  └──────────┘ └──────────┘ └──────────┘ └──────────┘        ║
║                                                               ║
║  ← Haz clic en "TOTAL"                                        ║
║                                                               ║
║  📊 Vista previa de datos:                                    ║
║  ┌────┬──────┬──────┬────────┬────────┬────────┬────────┐   ║
║  │ #  │ HORA │ TINA │ PESO1  │ PESO2  │ PESO3  │ TOTAL  │   ║
║  ├────┼──────┼──────┼────────┼────────┼────────┼────────┤   ║
║  │ 1  │ T1   │ 5    │ 3.00   │ 4.00   │ 3.99   │ 17.99  │   ║
║  │ 2  │ T2   │ 6    │ 2.50   │ 3.50   │ 4.00   │ 15.50  │   ║
║  │ 3  │ T3   │ 7    │ 3.20   │ 3.80   │ 4.20   │ 16.80  │   ║
║  │... │ ...  │ ...  │ ...    │ ...    │ ...    │ ...    │   ║
║  └────┴──────┴──────┴────────┴────────┴────────┴────────┘   ║
╚═══════════════════════════════════════════════════════════════╝
```

**Haz clic en el botón "TOTAL"**

### 6️⃣ ¡Listo! Valores Copiados
Se cerrará el modal automáticamente y verás un mensaje:

```
✅ ¡Columna importada!

📤 Origen: TOTAL (18 valores)
📥 Destino: PESO NETO LBS.
📊 10 valores copiados

⚠️ Se omitieron 8 filas extras
```

**Resultado**: Los primeros 10 valores de TOTAL se copiaron a PESO NETO LBS.:

```
┌──────┬────────┬──────────────┬───────────────┬─────────────┬─────────────────┐
│ HORA │ TINA * │ CÓDIGOS MAT. │ ESPECIE/PRES. │ PESO BRUTO  │ PESO NETO LBS.  │
├──────┼────────┼──────────────┼───────────────┼─────────────┼─────────────────┤
│      │        │              │               │             │ 17.99 ✅        │
│      │        │              │               │             │ 15.50 ✅        │
│      │        │              │               │             │ 16.80 ✅        │
│      │        │              │               │             │ 14.20 ✅        │
│      │        │              │               │             │ 18.50 ✅        │
│      │        │              │               │             │ 13.90 ✅        │
│      │        │              │               │             │ 17.20 ✅        │
│      │        │              │               │             │ 16.00 ✅        │
│      │        │              │               │             │ 15.30 ✅        │
│      │        │              │               │             │ 14.80 ✅        │
└──────┴────────┴──────────────┴───────────────┴─────────────┴─────────────────┘
```

### 7️⃣ Guardar el Formulario
- Llena los demás campos si es necesario
- Clic en **"💾 Guardar Formulario"**
- Los valores copiados se guardarán permanentemente

---

## 🔧 Solución de Problemas

### ❌ "No se encontraron datos en la columna"
**Causa**: La columna origen está vacía o no tiene valores
**Solución**: Verifica que el formulario origen tenga datos en la columna TOTAL

### ❌ No aparecen los nombres de los formularios
**Causa**: El backend está tardando en cargar los detalles
**Solución**: Espera unos segundos o recarga la página (Ctrl+R)

### ❌ "Se omitieron X filas extras"
**Causa**: El formulario origen tiene más filas que el destino
**Solución**: Normal. Solo se copian las filas que caben en el destino (10 en este caso)

### ❌ Los valores no se ven después de copiar
**Causa**: Puede ser un problema de renderizado
**Solución**: 
1. Abre la consola del navegador (F12)
2. Busca el log: "✅ X valores copiados"
3. Si aparece, los valores SÍ se copiaron
4. Scroll hacia abajo y arriba para forzar el re-renderizado
5. O recarga la página y edita el formulario para ver los valores guardados

---

## 📹 Resumen Visual Ultra-Rápido

```
1. Abrir formulario "Control de Fileteo"
              ↓
2. Buscar columna "PESO NETO LBS."
              ↓
3. Clic en botón 📥 (en el header de la columna)
              ↓
4. Clic en tarjeta "Registro 15 Tinas"
              ↓
5. Clic en botón "TOTAL"
              ↓
6. ✅ ¡LISTO! Valores copiados automáticamente
              ↓
7. Guardar formulario
```

---

## 💡 Consejos

✅ **Puedes usar esto para cualquier columna**: No solo TOTAL → PESO NETO LBS, sino cualquier columna a cualquier columna

✅ **Funciona entre diferentes formularios**: Puedes copiar de "Registro 15 Tinas" a "Control de Fileteo", o entre cualquier par de formularios

✅ **Los datos se mapean por posición**: Fila 1 → Fila 1, Fila 2 → Fila 2, etc.

✅ **No sobrescribe otros datos**: Solo actualiza la columna seleccionada, el resto de las columnas no se tocan

---

## 🎯 Casos de Uso Adicionales

1. **HORA → HORA**: Copiar las horas de un formulario a otro
2. **TINA → TINA**: Copiar números de tina
3. **Cualquier columna numérica**: Pesos, temperaturas, conteos, etc.
4. **Datos de referencia**: Códigos, especies, presentaciones

---

¡Ahora pruébalo! 🚀
