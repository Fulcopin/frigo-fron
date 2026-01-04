# 🔍 Guía: Búsqueda de Lotes Mejorada por Rango de Fechas

## 📋 ¿Qué se mejoró?

La búsqueda de lotes ahora permite buscar **múltiples días a la vez**, ideal para registros que usan varios lotes de diferentes fechas.

## ✨ Nuevas Características

### 1. 📅 Búsqueda por Rango de Fechas

**Antes:**
- Solo podías buscar lotes de **UN día específico**
- Tenías que buscar día por día si necesitabas lotes de varios días

**Ahora:**
- Puedes buscar lotes de **múltiples días** en una sola búsqueda
- Selecciona una **fecha inicio** y una **fecha fin**
- El sistema buscará todos los movimientos entre esas fechas

### 2. ⚡ Atajos Rápidos de Fechas

Para facilitar la búsqueda, se agregaron botones de atajos rápidos:

- **📍 Hoy**: Busca solo los movimientos del día actual
- **📆 Esta semana**: Busca desde el domingo hasta hoy
- **🗓️ Últimos 7 días**: Busca los últimos 7 días
- **📊 Últimos 30 días**: Busca el último mes

Simplemente haz clic en uno de estos botones y las fechas se configuran automáticamente.

### 3. 📦 Información Mejorada de Lotes

Cada lote ahora muestra:
- **📦 Número de Lote**: Con formato destacado
- **📅 Fecha del Movimiento**: Para identificar rápidamente de qué día es
- **🏭 Proveedor**: Información del proveedor asociado

Esto te ayuda a identificar rápidamente qué lotes son de qué día cuando buscas varios días.

### 4. ✅ Selección Múltiple de Lotes

- **Checkboxes visibles** para cada lote
- **Contador en tiempo real** de cuántos lotes has seleccionado
- **Click en cualquier parte** del lote para seleccionar/deseleccionar

## 🎯 Cómo Usar la Nueva Búsqueda

### Paso 1: Abrir el Selector de Lotes
1. En el formulario que estés llenando, busca el campo de **Lotes**
2. Haz clic en el botón **"🔍 Buscar Lotes desde API"**

### Paso 2: Elegir el Rango de Fechas

**Opción A - Usar Atajos Rápidos (Recomendado):**
```
1. Haz clic en uno de los atajos:
   - "Hoy" si solo necesitas lotes de hoy
   - "Esta semana" para toda la semana
   - "Últimos 7 días" para la última semana
   - "Últimos 30 días" para el último mes
```

**Opción B - Elegir Fechas Manualmente:**
```
1. Selecciona la fecha "Desde:" (fecha inicio)
2. Selecciona la fecha "Hasta:" (fecha fin)
```

### Paso 3: Buscar Movimientos
```
Haz clic en el botón "🔍 Buscar Movimientos"
```

El sistema buscará todos los movimientos entre las fechas seleccionadas.

### Paso 4: Seleccionar Lotes

Una vez que aparezcan los resultados:

1. **Ver la información de cada lote:**
   - Número de lote
   - Fecha del movimiento
   - Proveedor

2. **Seleccionar los lotes que necesites:**
   - Haz clic en el **checkbox ☑️** del lote
   - O haz clic en cualquier parte del lote
   - O usa el botón **"Elegir Lote"**

3. **Selecciona múltiples lotes:**
   - Puedes seleccionar **tantos lotes como necesites**
   - El contador te muestra cuántos has seleccionado
   - Los lotes seleccionados se marcan con un fondo verde

### Paso 5: Confirmar Selección
```
Haz clic en "✓ Confirmar Selección"
```

Los lotes seleccionados aparecerán en el formulario como chips (etiquetas verdes).

## 💡 Casos de Uso

### Caso 1: Producto con Lotes de Varios Días

**Situación:**
Estás registrando productos congelados que provienen de 3 lotes diferentes:
- Lote A del 15 de enero
- Lote B del 18 de enero  
- Lote C del 20 de enero

**Solución:**
1. Abre el selector de lotes
2. Selecciona:
   - Fecha Desde: **15 de enero**
   - Fecha Hasta: **20 de enero**
3. Busca y selecciona los 3 lotes
4. Confirma

### Caso 2: Revisar Movimientos de la Semana

**Situación:**
Necesitas ver todos los lotes que entraron esta semana.

**Solución:**
1. Abre el selector de lotes
2. Haz clic en el atajo **"📆 Esta semana"**
3. Busca
4. Selecciona los lotes que necesites

### Caso 3: Buscar Lote Específico de Hace Varios Días

**Situación:**
Sabes que el lote que buscas llegó hace aproximadamente 2 semanas.

**Solución:**
1. Abre el selector de lotes
2. Haz clic en el atajo **"🗓️ Últimos 7 días"** o **"📊 Últimos 30 días"**
3. Busca
4. Encuentra visualmente el lote por su fecha y número
5. Selecciona

## 🔧 Para el Backend

Si eres el desarrollador del backend, la API ahora recibe estos parámetros:

### Antes:
```
GET /api/movimientos?fecha=2026-01-15
```

### Ahora:
```
GET /api/movimientos?fechaInicio=2026-01-15&fechaFin=2026-01-20
```

### Respuesta esperada:
```json
[
  {
    "cabId": "LOTE123",
    "cabProveedor": "PROVEEDOR ABC",
    "cabFecha": "2026-01-15T00:00:00",
    ...
  },
  {
    "cabId": "LOTE456",
    "cabProveedor": "PROVEEDOR XYZ",
    "cabFecha": "2026-01-18T00:00:00",
    ...
  }
]
```

**Notas importantes:**
- El campo `cabFecha` o `fecha` se usa para mostrar la fecha en la UI
- Si no está presente, simplemente no se mostrará la fecha
- La API debe retornar TODOS los movimientos entre `fechaInicio` y `fechaFin` (inclusive)

## ✅ Validaciones

El sistema incluye las siguientes validaciones:

1. **Fechas requeridas**: Debes seleccionar ambas fechas (inicio y fin)
2. **Rango válido**: La fecha inicio no puede ser mayor que la fecha fin
3. **Autenticación**: Se valida el token antes de cada búsqueda
4. **Sin resultados**: Se muestra un mensaje claro si no hay movimientos

## 📝 Ejemplo Completo

```
1. Usuario abre formulario "CONTROL DE PRODUCTOS CONGELADOS"
2. En el campo "Lotes", hace clic en "🔍 Buscar Lotes desde API"
3. Hace clic en el atajo "🗓️ Últimos 7 días"
4. Hace clic en "🔍 Buscar Movimientos"
5. El sistema muestra 15 lotes de la última semana
6. Usuario selecciona 3 lotes específicos:
   - LOTE-A del 28/12/2025
   - LOTE-B del 30/12/2025
   - LOTE-C del 02/01/2026
7. Hace clic en "✓ Confirmar Selección"
8. Los 3 lotes aparecen en el formulario
9. Usuario continúa llenando el formulario
```

## 🎨 Interfaz Visual

- **Fondo amarillo claro** para la sección de atajos rápidos
- **Badges verdes** para lotes seleccionados
- **Contador grande** mostrando cantidad seleccionada
- **Fecha con fondo verde** para fácil identificación
- **Flecha →** separando fechas de inicio y fin

## 🚀 Ventajas

✅ **Ahorra tiempo**: No necesitas buscar día por día
✅ **Más flexible**: Busca rangos personalizados
✅ **Fácil de usar**: Atajos rápidos para casos comunes
✅ **Mejor información**: Ves la fecha de cada lote
✅ **Selección múltiple**: Elige todos los lotes que necesites

## 📞 ¿Problemas?

Si encuentras algún problema:
1. Verifica que el backend soporte los nuevos parámetros `fechaInicio` y `fechaFin`
2. Revisa la consola del navegador (F12) para ver mensajes de error
3. Confirma que la autenticación esté funcionando

---

**Última actualización**: 3 de enero de 2026
**Versión**: 2.0 - Búsqueda por rango de fechas
