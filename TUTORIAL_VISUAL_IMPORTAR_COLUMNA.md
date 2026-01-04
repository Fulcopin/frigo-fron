# 🎬 Tutorial Visual: Copiar TOTAL → PESO NETO LBS.

## 🎯 Objetivo
Copiar automáticamente todos los valores de la columna **TOTAL** del formulario "Registro 15 Tinas" a la columna **PESO NETO LBS.** del formulario "Control de Fileteo".

---

## 📺 Video Tutorial (en texto)

### 🎬 FRAME 1: Pantalla inicial
```
┌─────────────────────────────────────────────────────────────────┐
│  🏠 FormBuilder - Sistema de Formularios Dinámicos             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [📝 Crear Formulario]  [📋 Ver Formularios]                    │
│  [✏️  Llenar Formulario]  [🔧 Editar Formulario Lleno]          │
│                                                                 │
│  ← Haz clic en "Llenar Formulario" o "Editar Formulario Lleno" │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 🎬 FRAME 2: Seleccionar Template
```
┌─────────────────────────────────────────────────────────────────┐
│  ✏️  Llenar Formulario                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Selecciona un template:                                        │
│                                                                 │
│  📋 Control de Fileteo Procesado  ← Selecciona este            │
│  📋 Registro 15 Tinas (Filas Verticales)                        │
│  📋 Otro Template...                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 🎬 FRAME 3: Formulario abierto con tabla
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Control de Fileteo Procesado                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Código: [_________]  Fecha: [2/1/2026]                                        │
│                                                                                 │
│  ╔═══════════════════════════════════════════════════════════════════════════╗ │
│  ║  TABLA: Datos de Procesamiento                                           ║ │
│  ╠═══════════════════════════════════════════════════════════════════════════╣ │
│  ║                                                                           ║ │
│  ║  ┌──────┬───────┬──────────┬───────────┬───────────┬──────────────────┐  ║ │
│  ║  │ HORA │ TINA *│ CÓDIGOS  │ ESPECIE / │ PESO BRUTO│ PESO NETO LBS. 📥│  ║ │
│  ║  │      │       │ MAT.PRIMA│PRESENTACIÓ│           │                  │  ║ │
│  ║  │      │       │          │N          │           │        ↑ HAZ CLIC│  ║ │
│  ║  ├──────┼───────┼──────────┼───────────┼───────────┼──────────────────┤  ║ │
│  ║  │      │       │          │           │           │                  │  ║ │
│  ║  │      │       │          │           │           │                  │  ║ │
│  ║  │      │       │          │           │           │                  │  ║ │
│  ║  │      │       │          │           │           │                  │  ║ │
│  ║  └──────┴───────┴──────────┴───────────┴───────────┴──────────────────┘  ║ │
│  ║                                                                           ║ │
│  ╚═══════════════════════════════════════════════════════════════════════════╝ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

👆 PASO CRÍTICO: Haz clic en el botón 📥 que está en el ENCABEZADO de la columna
                 "PESO NETO LBS." (arriba, no en las celdas)
```

### 🎬 FRAME 4: Modal - Paso 1 (Seleccionar formulario origen)
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ╔═══════════════════════════════════════════════════════════════════════════╗ │
│ ║  📥 Importar Columna Automáticamente                           [✖ Cerrar]║ │
│ ║  Copiar toda la columna desde otro formulario → "PESO NETO LBS."         ║ │
│ ╠═══════════════════════════════════════════════════════════════════════════╣ │
│ ║                                                                           ║ │
│ ║  ① Selecciona el formulario con los datos a importar:                    ║ │
│ ║                                                                           ║ │
│ ║  ┌────────────────────────────────┐  ┌────────────────────────────────┐  ║ │
│ ║  │ 📄 Registro 15 Tinas           │  │ 📄 Control de Fileteo          │  ║ │
│ ║  │ 🔢 ID: 38                      │  │ 🔢 ID: 37                      │  ║ │
│ ║  │ 📅 2/1/2026, 6:19:09 a. m.     │  │ 📅 2/1/2026, 6:15:10 a. m.     │  ║ │
│ ║  │ 📊 18 filas disponibles         │  │ 📊 10 filas disponibles         │  ║ │
│ ║  │                                │  │                                │  ║ │
│ ║  │        ← HAZ CLIC AQUÍ         │  │                                │  ║ │
│ ║  └────────────────────────────────┘  └────────────────────────────────┘  ║ │
│ ║                                                                           ║ │
│ ║  ┌────────────────────────────────┐  ┌────────────────────────────────┐  ║ │
│ ║  │ 📄 Otro Formulario             │  │ 📄 Otro Formulario             │  ║ │
│ ║  │ 🔢 ID: 36                      │  │ 🔢 ID: 35                      │  ║ │
│ ║  │ ...                            │  │ ...                            │  ║ │
│ ║  └────────────────────────────────┘  └────────────────────────────────┘  ║ │
│ ║                                                                           ║ │
│ ╚═══════════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────────┘

👆 Haz clic en la tarjeta "Registro 15 Tinas" (la que tiene 18 filas)
```

### 🎬 FRAME 5: Modal - Paso 2 (Seleccionar columna origen)
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ╔═══════════════════════════════════════════════════════════════════════════╗ │
│ ║  📥 Importar Columna Automáticamente                           [✖ Cerrar]║ │
│ ║  Copiar columna desde "Registro 15 Tinas" → "PESO NETO LBS."            ║ │
│ ╠═══════════════════════════════════════════════════════════════════════════╣ │
│ ║                                                                           ║ │
│ ║  [⬅ Volver a lista]                                                      ║ │
│ ║                                                                           ║ │
│ ║  ② Selecciona la columna a importar desde "Registro 15 Tinas":           ║ │
│ ║                                                                           ║ │
│ ║  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      ║ │
│ ║  │   HORA   │ │   TINA   │ │  PESO1   │ │  PESO2   │ │  PESO3   │      ║ │
│ ║  │          │ │          │ │          │ │          │ │          │      ║ │
│ ║  │ 1 valores│ │ 1 valores│ │ 1 valores│ │ 1 valores│ │ 1 valores│      ║ │
│ ║  │  Ej: T1  │ │  Ej: 5   │ │ Ej: 3.00 │ │ Ej: 4.00 │ │ Ej: 3.99 │      ║ │
│ ║  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      ║ │
│ ║                                                                           ║ │
│ ║  ┌──────────┐ ┌──────────┐                                               ║ │
│ ║  │  PESO7   │ │  TOTAL   │ ← HAZ CLIC EN ESTE!                          ║ │
│ ║  │          │ │          │                                               ║ │
│ ║  │ 1 valores│ │ 1 valores│                                               ║ │
│ ║  │  Ej: 4   │ │ Ej: 17.99│                                               ║ │
│ ║  └──────────┘ └──────────┘                                               ║ │
│ ║                                                                           ║ │
│ ║  📊 Vista previa de datos:                                               ║ │
│ ║  ┌───┬──────┬──────┬───────┬───────┬───────┬───────┬────────┐          ║ │
│ ║  │ # │ HORA │ TINA │ PESO1 │ PESO2 │ PESO3 │ PESO7 │ TOTAL  │          ║ │
│ ║  ├───┼──────┼──────┼───────┼───────┼───────┼───────┼────────┤          ║ │
│ ║  │ 1 │ T1   │ 5    │ 3.00  │ 4.00  │ 3.99  │ 4     │ 17.99  │          ║ │
│ ║  │ 2 │ T2   │ 6    │ 2.50  │ 3.50  │ 4.00  │5      │ 15.50  │          ║ │
│ ║  │ 3 │ T3   │ 7    │ 3.20  │ 3.80  │ 4.20  │ 5     │ 16.80  │          ║ │
│ ║  │ 4 │ T4   │ 8    │ 2.80  │ 3.40  │ 4.00  │ 4     │ 14.20  │          ║ │
│ ║  │...│ ...  │ ...  │ ...   │ ...   │ ...   │ ...   │ ...    │          ║ │
│ ║  └───┴──────┴──────┴───────┴───────┴───────┴───────┴────────┘          ║ │
│ ║                                                                           ║ │
│ ╚═══════════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────────┘

👆 Haz clic en el botón "TOTAL" (arriba a la derecha)
```

### 🎬 FRAME 6: ¡Éxito! Valores copiados
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Control de Fileteo Procesado                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────────────────────────────────────────────┐                      │
│  │  ✅ ¡Columna importada!                              │                      │
│  │                                                      │                      │
│  │  📤 Origen: TOTAL (18 valores)                       │                      │
│  │  📥 Destino: PESO NETO LBS.                          │                      │
│  │  📊 10 valores copiados                              │                      │
│  │                                                      │                      │
│  │  ⚠️ Se omitieron 8 filas extras                      │                      │
│  │                                                      │                      │
│  │            [  OK  ]                                  │                      │
│  └──────────────────────────────────────────────────────┘                      │
│                                                                                 │
│  Código: [_________]  Fecha: [2/1/2026]                                        │
│                                                                                 │
│  ╔═══════════════════════════════════════════════════════════════════════════╗ │
│  ║  TABLA: Datos de Procesamiento                                           ║ │
│  ╠═══════════════════════════════════════════════════════════════════════════╣ │
│  ║  ┌──────┬───────┬──────────┬───────────┬───────────┬──────────────────┐  ║ │
│  ║  │ HORA │ TINA *│ CÓDIGOS  │ ESPECIE / │ PESO BRUTO│ PESO NETO LBS.   │  ║ │
│  ║  ├──────┼───────┼──────────┼───────────┼───────────┼──────────────────┤  ║ │
│  ║  │      │       │          │           │           │ 17.99 ✅         │  ║ │
│  ║  │      │       │          │           │           │ 15.50 ✅         │  ║ │
│  ║  │      │       │          │           │           │ 16.80 ✅         │  ║ │
│  ║  │      │       │          │           │           │ 14.20 ✅         │  ║ │
│  ║  │      │       │          │           │           │ 18.50 ✅         │  ║ │
│  ║  │      │       │          │           │           │ 13.90 ✅         │  ║ │
│  ║  │      │       │          │           │           │ 17.20 ✅         │  ║ │
│  ║  │      │       │          │           │           │ 16.00 ✅         │  ║ │
│  ║  │      │       │          │           │           │ 15.30 ✅         │  ║ │
│  ║  │      │       │          │           │           │ 14.80 ✅         │  ║ │
│  ║  └──────┴───────┴──────────┴───────────┴───────────┴──────────────────┘  ║ │
│  ║                                                                           ║ │
│  ╚═══════════════════════════════════════════════════════════════════════════╝ │
│                                                                                 │
│  [💾 Guardar Formulario]  [🗑️ Cancelar]                                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

✅ ¡PERFECTO! Los valores de TOTAL se copiaron a PESO NETO LBS.
👉 Ahora guarda el formulario para que los cambios sean permanentes
```

---

## 🎯 Resumen de Clics

```
Clic 1: Botón 📥 en el header de "PESO NETO LBS."
         ↓
Clic 2: Tarjeta "Registro 15 Tinas"
         ↓
Clic 3: Botón "TOTAL"
         ↓
Clic 4: "OK" en el mensaje de éxito
         ↓
Clic 5: "💾 Guardar Formulario"
         ↓
        ✅ ¡LISTO!
```

**Total: 5 clics para copiar toda una columna**

---

## 🔍 ¿Dónde está el botón 📥?

```
❌ NO está aquí (dentro de las celdas):
┌──────────────────┐
│ PESO NETO LBS.   │
├──────────────────┤
│ [___]            │ ← No
│ [___]            │ ← No
│ [___]            │ ← No
└──────────────────┘

✅ SÍ está aquí (en el encabezado):
┌──────────────────┐
│ PESO NETO LBS. 📥│ ← ¡AQUÍ! (botón verde con icono 📥)
├──────────────────┤
│ [___]            │
│ [___]            │
│ [___]            │
└──────────────────┘
```

---

## 💡 Tips Importantes

### ✅ CORRECTO:
- Haz clic en el **botón 📥** que está en el **encabezado** (header) de la columna
- El botón es **verde** y tiene el icono **📥**
- Aparece cuando pasas el mouse sobre el encabezado de la columna

### ❌ INCORRECTO:
- No hagas clic en las celdas vacías (inputs)
- No hagas clic en el nombre de la columna sin el botón
- No confundas con otros botones de la tabla

---

## 🎬 ¿Qué pasa si no funciona?

### Problema 1: "No veo el botón 📥"
**Solución**: 
- Asegúrate de estar en modo "Llenar Formulario" o "Editar Formulario"
- Pasa el mouse sobre el ENCABEZADO de la columna
- Si no aparece, recarga la página (Ctrl+R)

### Problema 2: "No aparecen los nombres de los formularios"
**Solución**: 
- Espera 2-3 segundos (está cargando los datos)
- Si después de 5 segundos sigue diciendo "Formulario", revisa que el backend esté corriendo

### Problema 3: "Dice '0 valores copiados'"
**Solución**: 
- Verifica que el formulario origen tenga datos en la columna TOTAL
- Abre la consola del navegador (F12) y busca logs de error
- Intenta con otra columna que sí tenga datos

---

¡Ahora ve a probarlo! 🚀

**URL**: http://localhost:5173/
