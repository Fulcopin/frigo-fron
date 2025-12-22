# 📋 FORMULARIO 15 TINAS - GUÍA DE USO

## ✅ INSTALACIÓN COMPLETADA

Se han creado los siguientes archivos:

1. ✅ **`src/pages/Registro15Tinas.jsx`** - Componente principal
2. ✅ **`src/pages/Registro15Tinas.css`** - Estilos completos
3. ✅ **`src/App.jsx`** - Rutas agregadas

---

## 🚀 CÓMO ACCEDER AL FORMULARIO

### **Opción 1: Desde el Menú de Navegación**
1. Inicia tu aplicación: `npm run dev`
2. En el menú lateral, haz click en **"⚖️ Registro 15 Tinas"**
3. Se abrirá el formulario completo

### **Opción 2: URL Directa**
```
http://localhost:5173/registro-15-tinas
```

---

## 📝 CÓMO LLENAR EL FORMULARIO

### **PASO 1: Información General (Header)**

Completa los 4 campos obligatorios:

- **Fecha** 📅 - Fecha del registro (por defecto: hoy)
- **Turno** 🕐 - Selecciona: Mañana / Tarde / Noche
- **Responsable** 👤 - Nombre completo del responsable
- **Lote** 🏷️ - Número de lote de producción

---

### **PASO 2: Registro de Pesadas**

La tabla tiene **15 filas** (una por cada tina T1-T15) y **8 columnas**:

#### **Por cada TINA debes llenar:**

1. **⏰ HORA** - Hora del registro (formato 24h: 08:00, 09:30, etc.)
2. **🔵 TINA** - Campo automático (T1, T2, ..., T15) - No editable
3. **⚖️ PESO 1** - Primera pesada en kilogramos (ej: 25.5)
4. **⚖️ PESO 2** - Segunda pesada en kilogramos
5. **⚖️ PESO 3** - Tercera pesada en kilogramos
6. **⚖️ PESO 4** - Cuarta pesada en kilogramos
7. **⚖️ PESO 5** - Quinta pesada en kilogramos
8. **📊 TOTAL** - Se calcula automáticamente (suma de PESO 1-5)

#### **Ejemplo de llenado para T1:**

```
HORA: 08:00
TINA: T1 (automático)
PESO 1: 25.5
PESO 2: 30.2
PESO 3: 22.8
PESO 4: 28.0
PESO 5: 24.5
TOTAL: 131.0 kg (automático)
```

#### **Navegación rápida:**
- Usa **TAB** para moverte entre campos
- Usa **Shift + TAB** para retroceder
- Los totales se calculan automáticamente al escribir

---

### **PASO 3: Firmas**

Completa la información de las 3 firmas requeridas:

1. **ASISTENTE**
   - Nombre
   - Fecha de firma

2. **SUPERVISOR**
   - Nombre
   - Fecha de firma

3. **JEFE CALIDAD**
   - Nombre
   - Fecha de firma

---

### **PASO 4: Guardar el Formulario**

1. Revisa que todos los datos sean correctos
2. Observa el **🏆 TOTAL GENERAL** al final de la tabla
3. Haz click en **"💾 Guardar Formulario"**
4. El sistema validará:
   - ✅ Que Responsable y Lote estén completos
   - ✅ Que al menos una tina tenga datos
   - ✅ Que si una tina tiene hora, tenga al menos un peso
   - ✅ Que si una tina tiene pesos, tenga hora
5. Si todo está correcto, se guardará y verás un mensaje de éxito
6. Serás redirigido a "Ver Formularios"

---

## 🎯 CARACTERÍSTICAS ESPECIALES

### **Cálculos Automáticos:**
- ✅ El **TOTAL de cada tina** se calcula automáticamente al escribir los pesos
- ✅ El **TOTAL GENERAL** (suma de las 15 tinas) se actualiza en tiempo real
- ✅ Formato de 2 decimales (25.5 se muestra como 25.50)

### **Validaciones:**
- ✅ No permite guardar sin Responsable y Lote
- ✅ Verifica que al menos una tina tenga datos
- ✅ Si ingresas hora en una tina, debes ingresar al menos un peso
- ✅ Si ingresas pesos en una tina, debes ingresar la hora
- ✅ Los pesos no pueden ser negativos (min: 0)

### **Interfaz Intuitiva:**
- ✅ Encabezado sticky (se mantiene visible al hacer scroll)
- ✅ Filas alternadas (blanco/gris) para mejor lectura
- ✅ Hover effect en las filas
- ✅ Campos de TINA bloqueados (solo lectura)
- ✅ Totales destacados con gradiente azul-morado

---

## 📱 RESPONSIVIDAD

El formulario se adapta a diferentes tamaños de pantalla:

### **Desktop (1920px):**
- Tabla completa visible
- Todas las columnas horizontales
- Scroll vertical para las 15 filas

### **Tablet (768px):**
- Scroll horizontal para ver todas las columnas
- Prioridad visual: HORA | TINA | TOTAL
- PESO 1-5 con scroll lateral

### **Mobile (375px):**
- Fuentes más pequeñas
- Inputs compactos
- Botones apilados verticalmente
- Tabla con scroll horizontal

---

## 🔑 ESTRUCTURA DE DATOS GUARDADOS

Cuando guardas el formulario, se envía al backend con esta estructura:

```json
{
  "templateID": 1,
  "headerData": {
    "FECHA": "2025-12-22",
    "TURNO": "Mañana",
    "RESPONSABLE": "Juan Pérez",
    "LOTE": "L-12345"
  },
  "bodyData": {
    "HORA_T1": "08:00",
    "TINA_T1": "T1",
    "PESO1_T1": 25.5,
    "PESO2_T1": 30.2,
    "PESO3_T1": 22.8,
    "PESO4_T1": 28.0,
    "PESO5_T1": 24.5,
    "TOTAL_T1": 131.0,
    "HORA_T2": "08:15",
    "TINA_T2": "T2",
    "PESO1_T2": 27.3,
    "PESO2_T2": 29.1,
    "PESO3_T2": 26.4,
    "PESO4_T2": 25.7,
    "PESO5_T2": 31.2,
    "TOTAL_T2": 139.7,
    // ... T3 a T15
  },
  "firmasData": [
    {
      "puesto": "ASISTENTE",
      "nombre": "María García",
      "firma": "",
      "fecha": "2025-12-22"
    },
    {
      "puesto": "SUPERVISOR",
      "nombre": "Carlos López",
      "firma": "",
      "fecha": "2025-12-22"
    },
    {
      "puesto": "JEFE CALIDAD",
      "nombre": "Ana Martínez",
      "firma": "",
      "fecha": "2025-12-22"
    }
  ]
}
```

---

## ⚙️ CONFIGURACIÓN DEL BACKEND

### **Endpoint para guardar:**
```
POST http://localhost:5074/api/FilledForms
```

### **Si el backend está en otro puerto:**

Edita la línea 146 de `Registro15Tinas.jsx`:

```javascript
// Cambiar esto:
const response = await fetch('http://localhost:5074/api/FilledForms', {

// Por esto (con tu puerto):
const response = await fetch('http://localhost:TU_PUERTO/api/FilledForms', {
```

---

## 🎨 PERSONALIZACIÓN

### **Cambiar colores del gradiente:**

Edita `Registro15Tinas.css`:

```css
/* Línea 6 - Fondo general */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Línea 140 - Header de tabla */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Línea 251 - Fondo de totales */
background: linear-gradient(135deg, #e6f0ff 0%, #f0e6ff 100%);
```

### **Cambiar número de decimales:**

Edita `Registro15Tinas.jsx` línea 337 y 275:

```javascript
// De 2 decimales:
{tina.total.toFixed(2)}

// A 1 decimal:
{tina.total.toFixed(1)}
```

---

## 🧪 PRUEBA EL FORMULARIO

### **Datos de Ejemplo para Probar:**

```
HEADER:
- Fecha: 2025-12-22
- Turno: Mañana
- Responsable: Juan Pérez
- Lote: L-12345

TINAS (Ejemplo con 3 tinas):
T1:
  Hora: 08:00
  Peso 1: 25.5
  Peso 2: 30.2
  Peso 3: 22.8
  Peso 4: 28.0
  Peso 5: 24.5
  Total: 131.0 kg (automático)

T2:
  Hora: 08:15
  Peso 1: 27.3
  Peso 2: 29.1
  Peso 3: 26.4
  Peso 4: 25.7
  Peso 5: 31.2
  Total: 139.7 kg (automático)

T3:
  Hora: 08:30
  Peso 1: 23.8
  Peso 2: 28.5
  Peso 3: 30.1
  Peso 4: 27.6
  Peso 5: 29.3
  Total: 139.3 kg (automático)

TOTAL GENERAL: 410.0 kg
```

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### **Problema: No aparece el formulario**
✅ **Solución:** 
- Verifica que el servidor esté corriendo: `npm run dev`
- Verifica que la URL sea correcta: `http://localhost:5173/registro-15-tinas`
- Revisa la consola del navegador (F12) por errores

### **Problema: No se guardan los datos**
✅ **Solución:**
- Verifica que el backend esté corriendo en el puerto 5074
- Revisa la consola del navegador (F12) para ver el error exacto
- Verifica que la URL del backend sea correcta en `Registro15Tinas.jsx`

### **Problema: Los totales no se calculan**
✅ **Solución:**
- Asegúrate de escribir números válidos (usa . para decimales, no ,)
- Verifica que los campos no estén vacíos (usa 0 si no hay peso)

### **Problema: Error al guardar**
✅ **Solución:**
- Completa los campos obligatorios (Responsable y Lote)
- Llena al menos una tina con hora y pesos
- Si una tina tiene hora, debe tener al menos un peso

---

## 📊 FLUJO COMPLETO

```
1. Usuario accede a /registro-15-tinas
   ↓
2. Formulario carga con valores por defecto:
   - Fecha: Hoy
   - 15 tinas vacías
   - 3 firmas vacías
   ↓
3. Usuario llena:
   - Header (Fecha, Turno, Responsable, Lote)
   - Tabla de tinas (Hora + 5 Pesos por tina)
   - Firmas (Nombre + Fecha)
   ↓
4. Sistema calcula automáticamente:
   - Total por cada tina
   - Total general
   ↓
5. Usuario click en "Guardar"
   ↓
6. Sistema valida datos
   ↓
7. Si todo OK:
   - POST a /api/FilledForms
   - Mensaje de éxito
   - Redirección a /view-forms
   ↓
8. Si error:
   - Muestra alerta con errores
   - Usuario corrige y reintenta
```

---

## 📞 AYUDA ADICIONAL

Si tienes problemas o preguntas:

1. **Revisa la consola del navegador** (F12 → Pestaña Console)
2. **Revisa la consola del terminal** donde corre el frontend
3. **Verifica que el backend esté corriendo** en el puerto 5074
4. **Verifica las rutas** en `App.jsx`

---

## 🎯 PRÓXIMOS PASOS

Una vez que el formulario funcione correctamente, puedes:

1. ✅ **Agregar autoguardado** cada 30 segundos
2. ✅ **Implementar exportación a PDF**
3. ✅ **Agregar gráficos** de producción por tina
4. ✅ **Comparación histórica** (hoy vs ayer)
5. ✅ **Alertas** si una tina está muy por debajo/arriba del promedio

---

**Fecha de creación:** 22/12/2025  
**Versión:** 1.0  
**Estado:** ✅ Listo para usar

---

¡Formulario creado exitosamente! 🚀
