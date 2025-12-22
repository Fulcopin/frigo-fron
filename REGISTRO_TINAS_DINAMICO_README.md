# 🔄 REGISTRO DE TINAS DINÁMICO - GUÍA DE USO

## 📋 ¿Qué es el Registro Dinámico?

El **Registro de Tinas Dinámico** es una versión mejorada del formulario de 15 tinas que te permite:

- ✅ **Agregar más tinas** (no estás limitado a 15)
- ✅ **Eliminar tinas** que no necesites
- ✅ **Agregar más columnas de peso** (hasta 10 columnas)
- ✅ **Eliminar columnas de peso** que no uses
- ✅ **Cálculos automáticos** en tiempo real
- ✅ **Interfaz moderna y responsive**

---

## 🚀 ¿CÓMO ACCEDER?

### Opción 1: Desde el menú de navegación
1. Abre la aplicación
2. En el menú lateral, busca: **🔄 Registro Tinas (Dinámico)**
3. Haz clic en el enlace

### Opción 2: URL directa
```
http://localhost:5173/registro-15-tinas-dinamico
```

---

## 🎯 CARACTERÍSTICAS PRINCIPALES

### 1️⃣ **AGREGAR TINAS (FILAS)** ➕

**¿Cómo?**
- Haz clic en el botón **"➕ Agregar Tina"** en la sección "Tinas (Filas)"
- Se agregará una nueva fila al final de la tabla con el siguiente número (T16, T17, etc.)

**Límites:**
- ✅ No hay límite máximo (puedes agregar cuantas necesites)
- ⚠️ Debe haber al menos 1 tina (no se puede eliminar la última)

---

### 2️⃣ **ELIMINAR TINAS (FILAS)** ❌

**¿Cómo?**
- Haz clic en el botón **❌** en la primera columna de cada fila
- Aparecerá una confirmación antes de eliminar
- La tina se eliminará si confirmas

**Límites:**
- ⚠️ No puedes eliminar la última tina (debe haber al menos 1)
- ✅ Se recalcula el total general automáticamente

---

### 3️⃣ **AGREGAR COLUMNAS DE PESO** ➕

**¿Cómo?**
- Haz clic en el botón **"➕ Agregar Columna"** en la sección "Columnas de Peso"
- Se agregará una nueva columna de peso al final (PESO 6, PESO 7, etc.)

**Límites:**
- ✅ Máximo: 10 columnas de peso
- ⚠️ Debe haber al menos 1 columna

**Ejemplo:**
```
Antes (5 pesos):
PESO 1 | PESO 2 | PESO 3 | PESO 4 | PESO 5

Después (6 pesos):
PESO 1 | PESO 2 | PESO 3 | PESO 4 | PESO 5 | PESO 6
```

---

### 4️⃣ **ELIMINAR COLUMNAS DE PESO** ➖

**¿Cómo?**
- Haz clic en el botón **"➖ Eliminar Columna"** en la sección "Columnas de Peso"
- Aparecerá una confirmación antes de eliminar
- Se eliminará la última columna de peso

**Límites:**
- ⚠️ No puedes eliminar la última columna (debe haber al menos 1)
- ✅ Los totales se recalculan automáticamente

---

## 📊 ESTRUCTURA DE LA TABLA

### Columnas:
1. **🗑️ ACCIONES** - Botón para eliminar la fila
2. **⏰ HORA** - Input de tipo time (08:00, 08:15, etc.)
3. **🔵 TINA** - Texto fijo (T1, T2, T3, etc.) - NO editable
4. **⚖️ PESO 1-N** - Inputs numéricos (kg) - Dinámicos
5. **📊 TOTAL** - Calculado automáticamente (suma de todos los pesos)

### Ejemplo Visual:
```
┌────┬──────┬──────┬────────┬────────┬────────┬────────┐
│ 🗑️ │ HORA │ TINA │ PESO 1 │ PESO 2 │ PESO 3 │ TOTAL  │
├────┼──────┼──────┼────────┼────────┼────────┼────────┤
│ ❌ │08:00 │  T1  │  25.5  │  30.2  │  22.8  │  78.5  │
│ ❌ │08:15 │  T2  │  27.3  │  29.1  │  26.4  │  82.8  │
│ ❌ │08:30 │  T3  │  23.8  │  28.5  │  30.1  │  82.4  │
└────┴──────┴──────┴────────┴────────┴────────┴────────┘
                                    TOTAL GENERAL: 243.7 kg
```

---

## 🎨 INTERFAZ

### Secciones:

1. **📄 Información General**
   - Fecha (obligatorio)
   - Turno (Mañana/Tarde/Noche)
   - Responsable (obligatorio)
   - Lote (obligatorio)

2. **🔄 Controles Dinámicos**
   - Panel "Tinas (Filas)" con botón agregar
   - Panel "Columnas de Peso" con botones agregar/eliminar

3. **⚖️ Tabla de Registro**
   - Tabla dinámica con scroll horizontal
   - Headers fijos (sticky)
   - Total general en el footer

4. **✍️ Firmas y Autorizaciones**
   - 3 firmas: ASISTENTE, SUPERVISOR, JEFE CALIDAD
   - Campos: Nombre y Fecha

5. **💾 Botones de Acción**
   - ❌ Cancelar (vuelve atrás)
   - 💾 Guardar (guarda el formulario)

---

## 📝 FLUJO DE USO TÍPICO

### Caso 1: **Registro estándar (15 tinas, 5 pesos)**
1. Abre el formulario (ya viene con 15 tinas y 5 pesos)
2. Llena el header (Fecha, Turno, Responsable, Lote)
3. Llena cada fila:
   - Hora de pesada
   - Los 5 pesos
   - El total se calcula automáticamente
4. Llena las firmas
5. Haz clic en "💾 Guardar"

### Caso 2: **Necesitas solo 10 tinas**
1. Abre el formulario
2. Elimina las tinas T11-T15 haciendo clic en ❌
3. Llena las 10 tinas restantes
4. Guarda

### Caso 3: **Necesitas 20 tinas**
1. Abre el formulario
2. Haz clic 5 veces en "➕ Agregar Tina"
3. Ahora tienes T1-T20
4. Llena todas las tinas
5. Guarda

### Caso 4: **Necesitas 8 columnas de peso**
1. Abre el formulario
2. Haz clic 3 veces en "➕ Agregar Columna"
3. Ahora tienes PESO 1-8
4. Llena todos los pesos
5. Guarda

### Caso 5: **Necesitas solo 3 columnas de peso**
1. Abre el formulario
2. Haz clic 2 veces en "➖ Eliminar Columna"
3. Ahora tienes PESO 1-3
4. Llena todos los pesos
5. Guarda

---

## ⚙️ VALIDACIONES

El formulario valida automáticamente:

✅ **Campos obligatorios del header:**
- Fecha
- Responsable
- Lote

✅ **Al menos una tina con datos:**
- No puedes guardar si todas las tinas tienen peso 0

✅ **Todas las tinas deben tener hora:**
- Si una tina tiene pesos, debe tener hora

⚠️ **Mensaje de error si:**
- Faltan campos obligatorios
- No hay datos en ninguna tina
- Alguna tina tiene pesos pero no hora

---

## 🎯 CÁLCULOS AUTOMÁTICOS

### 1. **Total por fila (TOTAL):**
```javascript
TOTAL_Ti = PESO1_Ti + PESO2_Ti + PESO3_Ti + ... + PESO_N_Ti
```

**Ejemplo:**
```
PESO 1: 25.5 kg
PESO 2: 30.2 kg
PESO 3: 22.8 kg
TOTAL: 78.5 kg ✅ (se calcula automáticamente)
```

### 2. **Total general:**
```javascript
TOTAL_GENERAL = sum(TOTAL_T1, TOTAL_T2, ..., TOTAL_TN)
```

**Ejemplo:**
```
T1 TOTAL: 78.5 kg
T2 TOTAL: 82.8 kg
T3 TOTAL: 82.4 kg
TOTAL GENERAL: 243.7 kg 🏆
```

---

## 📱 RESPONSIVE

El formulario se adapta a diferentes tamaños de pantalla:

### Desktop (> 1200px):
- Tabla completa visible
- Todos los controles en línea
- 4 columnas en el header

### Tablet (768px - 1200px):
- Scroll horizontal en la tabla
- 2 columnas en el header
- Botones apilados

### Mobile (< 768px):
- Tabla con scroll horizontal
- 1 columna en el header
- Botones en vertical
- Fuente más pequeña

---

## 💾 DATOS GUARDADOS

Cuando haces clic en "💾 Guardar", se envía:

```json
{
  "templateID": 1,
  "headerData": {
    "fecha": "2025-12-22",
    "turno": "Mañana",
    "responsable": "Juan Pérez",
    "lote": "L-12345"
  },
  "bodyData": {
    "HORA_T1": "08:00",
    "TINA_T1": "T1",
    "PESO1_T1": 25.5,
    "PESO2_T1": 30.2,
    "PESO3_T1": 22.8,
    "TOTAL_T1": 78.5,
    "HORA_T2": "08:15",
    "TINA_T2": "T2",
    // ... más tinas
  },
  "firmasData": [
    {
      "puesto": "ASISTENTE",
      "nombre": "María García",
      "fecha": "2025-12-22T12:00:00"
    }
  ],
  "totalGeneral": 243.7
}
```

---

## 🆚 DIFERENCIAS CON EL REGISTRO NORMAL

| Característica | Registro Normal | Registro Dinámico |
|----------------|-----------------|-------------------|
| **Número de tinas** | Fijo (15) | Variable (1-∞) |
| **Columnas de peso** | Fijo (5) | Variable (1-10) |
| **Agregar tinas** | ❌ No | ✅ Sí |
| **Eliminar tinas** | ❌ No | ✅ Sí |
| **Agregar columnas** | ❌ No | ✅ Sí |
| **Eliminar columnas** | ❌ No | ✅ Sí |
| **Flexibilidad** | Baja | Alta |
| **Uso recomendado** | Siempre 15 tinas | Variable |

---

## 🔧 ATAJOS DE TECLADO

- **Tab** → Navega al siguiente campo
- **Shift + Tab** → Navega al campo anterior
- **Enter** (en inputs numéricos) → Navega al siguiente campo

---

## 💡 TIPS Y MEJORES PRÁCTICAS

### ✅ **DO (Hacer):**
- Llena primero el header antes de la tabla
- Usa el teclado (Tab) para navegar rápido
- Agrega todas las tinas necesarias antes de llenar
- Verifica el total general antes de guardar
- Llena las firmas al final

### ❌ **DON'T (No hacer):**
- No elimines tinas ya llenadas sin guardar (perderás los datos)
- No elimines columnas de peso con datos (se perderán)
- No cierres la página sin guardar
- No uses comas (,) en los decimales, usa puntos (.)

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### **Problema: No puedo eliminar una tina**
**Solución:** Debe haber al menos 1 tina. Si solo tienes 1, no podrás eliminarla.

### **Problema: No puedo agregar más columnas**
**Solución:** El máximo es 10 columnas de peso. Si tienes 10, no podrás agregar más.

### **Problema: El total no se actualiza**
**Solución:** Asegúrate de ingresar números válidos (sin letras ni símbolos). El total se recalcula automáticamente al cambiar cualquier peso.

### **Problema: No puedo guardar**
**Solución:** Revisa que hayas llenado:
- Fecha
- Responsable
- Lote
- Al menos una tina con hora y pesos

### **Problema: La tabla es muy ancha**
**Solución:** Usa el scroll horizontal. En móvil, gira el dispositivo a horizontal para mejor visualización.

---

## 📊 CASOS DE USO REALES

### **Caso 1: Producción baja (10 tinas)**
```
Situación: Solo se reciben 10 tinas en el turno

Solución:
1. Abre el formulario
2. Elimina T11-T15
3. Llena T1-T10
4. Guarda
```

### **Caso 2: Producción alta (25 tinas)**
```
Situación: Se reciben 25 tinas en el turno

Solución:
1. Abre el formulario
2. Agrega 10 tinas más (T16-T25)
3. Llena T1-T25
4. Guarda
```

### **Caso 3: Pesadas múltiples (8 pesos por tina)**
```
Situación: Cada tina tiene 8 contenedores diferentes

Solución:
1. Abre el formulario
2. Agrega 3 columnas más (total 8 pesos)
3. Llena todos los pesos
4. Guarda
```

### **Caso 4: Pesadas simples (2 pesos por tina)**
```
Situación: Solo se pesan 2 contenedores por tina

Solución:
1. Abre el formulario
2. Elimina 3 columnas (quedan 2 pesos)
3. Llena los 2 pesos
4. Guarda
```

---

## 🎓 TUTORIAL PASO A PASO (PRIMERA VEZ)

### **Paso 1: Configura las tinas**
```
¿Cuántas tinas vas a registrar hoy?
- 10 tinas → Elimina 5 tinas
- 15 tinas → No hagas nada (por defecto)
- 20 tinas → Agrega 5 tinas
```

### **Paso 2: Configura las columnas de peso**
```
¿Cuántos pesos registras por tina?
- 3 pesos → Elimina 2 columnas
- 5 pesos → No hagas nada (por defecto)
- 7 pesos → Agrega 2 columnas
```

### **Paso 3: Llena el header**
```
1. Fecha: Selecciona la fecha actual
2. Turno: Elige Mañana/Tarde/Noche
3. Responsable: Escribe tu nombre
4. Lote: Escribe el número de lote
```

### **Paso 4: Llena la tabla**
```
Para cada tina:
1. Hora: Hora de la pesada (ej: 08:00)
2. PESO 1-N: Ingresa cada peso en kg (ej: 25.5)
3. El TOTAL se calcula solo
```

### **Paso 5: Firmas**
```
1. Llena el nombre del ASISTENTE
2. Llena la fecha/hora
3. Repite para SUPERVISOR y JEFE CALIDAD
```

### **Paso 6: Guarda**
```
1. Revisa el TOTAL GENERAL
2. Haz clic en "💾 Guardar"
3. ¡Listo! ✅
```

---

## 🔐 SEGURIDAD Y VALIDACIÓN

### **Validaciones automáticas:**
- ✅ Formato de fecha válido
- ✅ Hora en formato 24h (00:00-23:59)
- ✅ Pesos numéricos (no negativos)
- ✅ Campos requeridos no vacíos

### **Prevención de errores:**
- ⚠️ Confirmación antes de eliminar tinas
- ⚠️ Confirmación antes de eliminar columnas
- ⚠️ Bloqueo de botones cuando se alcanza el límite

---

## 📈 VENTAJAS DEL SISTEMA DINÁMICO

1. **Flexibilidad total:** Adapta el formulario a tus necesidades
2. **Ahorro de tiempo:** No llenes filas/columnas innecesarias
3. **Menos errores:** Solo ves lo que necesitas
4. **Escalable:** Crece con tu producción
5. **Intuitivo:** Botones claros y confirmaciones

---

## 🎉 ¡LISTO PARA USAR!

El formulario dinámico está completamente funcional y listo para:
- ✅ Registrar producción variable
- ✅ Adaptarse a diferentes escenarios
- ✅ Crecer con tu negocio
- ✅ Reducir tiempo de llenado
- ✅ Evitar errores de registro

---

**Fecha de Creación:** 22/12/2025  
**Versión:** 1.0  
**Estado:** ✅ Listo para producción  
**Ruta:** `/registro-15-tinas-dinamico`

---

¿Tienes dudas? Revisa este documento o contacta al equipo de desarrollo. 🚀
