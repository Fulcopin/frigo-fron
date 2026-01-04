# 📚 Guía: Cómo Usar APIs de Catálogos en Plantillas

## 🎯 Resumen

Ahora puedes configurar campos `<select>` (combos/dropdowns) en tus plantillas que se auto-llenan con datos de:

1. **APIs de Lotes** (datos de movimientos seleccionados)
2. **APIs de Catálogos Externos** (Balanzas, Choferes, Especies, etc.)

---

## 📍 Dónde Configurar las APIs

### **Ubicación en la Interfaz:**

1. Ve a **"Administrar Plantillas"**
2. Haz clic en **"Crear Plantilla"** o **"Editar"** una existente
3. Al agregar un campo (Header o Columna de Tabla), verás **2 nuevos selectores**:

---

## 🔄 **Opción 1: API Lotes (Autocompletar desde Movimientos)**

### **¿Qué hace?**
Llena el campo con datos del **lote seleccionado** al llenar el formulario.

### **Ejemplos de uso:**
- **Proveedor**: Auto-llena el proveedor del lote
- **Embarcación (Pesquero)**: Auto-llena el nombre del barco
- **Placa**: Auto-llena la placa del vehículo
- **Chofer**: Auto-llena el chofer del lote

### **Opciones disponibles:**

| Opción | Descripción | Campo API |
|--------|-------------|-----------|
| `ID Lote Principal (cabId)` | Número del lote | `cabId` |
| `Proveedor` | Nombre del proveedor | `cabProveedor` |
| `Embarcación (Pesquero)` | Nombre del barco | `cabPesquero` |
| `Placa` | Placa del vehículo | `cabPlaca` |
| `Chofer` | Nombre del chofer | `cabChofer` |
| `Calificador` | Nombre del calificador | `cabCalificador` |
| `Supervisor` | Nombre del supervisor | `cabSupervisor` |
| `Guía de Remisión` | Número de guía | `cabGuiaRemision` |
| `Lugar de Desembarque` | Lugar de descarga | `cabLugarDesembarque` |

### **Para tablas (detalles):**

| Opción | Descripción | Campo API |
|--------|-------------|-----------|
| `Lote de Proceso (detCodigo)` | Código del lote procesado | `detCodigo` |
| `Especie` | Nombre de la especie | `detEspecie` |
| `Producto` | Nombre del producto | `detProducto` |
| `Tipo de Tina` | Tipo de contenedor | `detTipoTina` |
| `Número Pieza/Tina` | Número de tina/pieza | `detNumeroPiezaTina` |
| `Código ERP Producto` | Código interno | `detCodigoErpProducto` |

---

## 📚 **Opción 2: API Catálogos (Opciones desde API Externa)**

### **¿Qué hace?**
Llena el `<select>` con una **lista de opciones** desde la API externa (siempre disponibles).

### **Ejemplos de uso:**
- **Balanza**: Seleccionar de una lista de balanzas registradas
- **Chofer**: Elegir de todos los choferes del sistema
- **Especie**: Seleccionar especie de un catálogo maestro
- **Proveedor**: Elegir de todos los proveedores

### **Opciones disponibles:**

| Opción | Descripción | Campo que muestra |
|--------|-------------|-------------------|
| 🔧 **Balanzas** | Lista de balanzas disponibles | `nombre` |
| 👤 **Choferes** | Lista de choferes registrados | `nombreCompleto` |
| 🐟 **Especies** | Lista de especies disponibles | `nombre` |
| 🚢 **Pesqueros** | Lista de embarcaciones | `nombre` |
| 📦 **Productos** | Lista de productos | `descripcion` |
| 🏢 **Proveedores** | Lista de proveedores | `razonSocial` |
| ⚙️ **Configuraciones** | Parámetros de configuración | `descripcion` |
| ❄️ **Configuraciones FRIGO** | Configs específicas FRIGO | `descripcion` |

---

## 🛠️ **Cómo Configurar un Campo con API**

### **Ejemplo 1: Campo "Proveedor" con API de Catálogos**

1. **Crear campo en el encabezado:**
   - Etiqueta: `Proveedor`
   - Tipo: `select`
   - **API Lotes**: `No aplica` *(dejar vacío)*
   - **API Catálogos**: Seleccionar `🏢 Proveedores (Catálogo)`

2. **Resultado al llenar formulario:**
   - El campo mostrará un combo con **todos los proveedores** de la base de datos
   - El usuario puede elegir de la lista completa

---

### **Ejemplo 2: Campo "Especie" con API de Lotes**

1. **Crear columna en tabla:**
   - Etiqueta: `Especie`
   - Tipo: `select`
   - **API Lotes**: Seleccionar `Especie`
   - **API Catálogos**: `No aplica` *(dejar vacío)*

2. **Resultado al llenar formulario:**
   - La tabla se auto-llenará con las **especies del lote seleccionado**
   - Cada fila mostrará la especie correspondiente de los detalles del lote

---

### **Ejemplo 3: Campo "Balanza" con API de Catálogos**

1. **Crear campo en encabezado:**
   - Etiqueta: `Balanza Utilizada`
   - Tipo: `select`
   - **API Lotes**: `No aplica`
   - **API Catálogos**: Seleccionar `🔧 Balanzas (Catálogo)`

2. **Resultado al llenar formulario:**
   - Combo con lista de todas las balanzas disponibles
   - Usuario selecciona la balanza usada en ese proceso

---

## ⚠️ **Reglas Importantes**

### **🔴 NO puedes usar ambas APIs al mismo tiempo**

Si seleccionas una **API de Lotes**, automáticamente se limpia **API de Catálogos** (y viceversa).

**Correcto:**
```
✅ API Lotes: Proveedor
✅ API Catálogos: No aplica
```

**Incorrecto:**
```
❌ API Lotes: Proveedor
❌ API Catálogos: Proveedores (Catálogo)
```

---

## 🎯 **Cuándo Usar Cada Opción**

### **Usa API de Lotes cuando:**
- ✅ Quieres **auto-llenar** el campo con datos del lote seleccionado
- ✅ El valor viene **directamente** del movimiento (proveedor, embarcación, chofer, etc.)
- ✅ Es información del **header** del movimiento o **detalles** del lote

### **Usa API de Catálogos cuando:**
- ✅ Quieres que el usuario **elija** de una lista maestra
- ✅ El campo **no depende** del lote seleccionado
- ✅ Necesitas opciones **siempre disponibles** (balanzas, configuraciones, etc.)
- ✅ Es un campo que se llena **manualmente** pero con opciones predefinidas

---

## 📋 **Flujo Completo de Ejemplo**

### **Escenario: Crear formulario de Pesaje**

**Campos del Encabezado:**

| Campo | Tipo | API Lotes | API Catálogos |
|-------|------|-----------|---------------|
| Fecha | date | - | - |
| Proveedor | select | `Proveedor` | No aplica |
| Embarcación | select | `Embarcación (Pesquero)` | No aplica |
| Balanza | select | No aplica | `🔧 Balanzas (Catálogo)` |
| Supervisor | select | No aplica | `👤 Choferes (Catálogo)` *(reutilizar catálogo)* |

**Columnas de Tabla "Detalle de Pesaje":**

| Columna | Tipo | API Lotes | API Catálogos |
|---------|------|-----------|---------------|
| Lote | text | `Lote de Proceso (detCodigo)` | No aplica |
| Especie | select | `Especie` | No aplica |
| Producto | select | `Producto` | No aplica |
| Peso | number | - | - |
| Tina | text | `Número Pieza/Tina` | No aplica |

**Resultado al llenar formulario:**
1. Usuario selecciona lote → **Proveedor y Embarcación se auto-llenan**
2. Usuario elige **Balanza** de la lista maestra
3. Usuario elige **Supervisor** de la lista de choferes
4. **Tabla se auto-llena** con especies, productos, lotes y tinas del movimiento seleccionado
5. Usuario solo completa **Peso** manualmente

---

## 🔍 **Verificación en Consola**

Al llenar un formulario, abre la **Consola del Navegador** (F12) y verás:

```
🔄 Cargando catálogos de la API externa...
📡 Cargando Balanzas...
✅ 5 Balanzas cargados
📡 Cargando Choferes...
✅ 12 Choferes cargados
📡 Cargando Especies...
✅ 8 Especies cargados
...
✅ Catálogos cargados completamente
```

---

## 🚀 **Próximos Pasos**

1. **Edita una plantilla existente** y prueba agregando campos con API de Catálogos
2. **Crea un formulario nuevo** y verifica que los combos se llenen correctamente
3. **Revisa la consola** para confirmar que las APIs se cargan sin errores

---

## ❓ **Preguntas Frecuentes**

### **P: ¿Por qué mi campo no muestra opciones?**
**R:** Verifica que:
- El tipo de campo sea `select`
- Hayas seleccionado una API (Lotes o Catálogos)
- La API esté respondiendo correctamente (revisa la consola)

### **P: ¿Puedo agregar más APIs?**
**R:** Sí, edita el archivo `src/api/apiMappings.js` y agrega nuevas opciones en `MAPPABLE_API_FIELDS.catalogs`.

### **P: ¿Las APIs se cargan cada vez que lleno un formulario?**
**R:** Sí, los catálogos externos se cargan automáticamente al:
- Confirmar lotes
- Entrar en modo manual
- Editar un formulario existente

---

## 📞 **Soporte**

Si tienes problemas:
1. Revisa la **consola del navegador** (F12) para errores
2. Verifica que el backend esté corriendo en ambos puertos (5173 y 5174)
3. Confirma que la API externa esté disponible: `http://188.40.197.172:8094/api`

---

**✅ Implementación completada**
**📅 Fecha: Enero 2026**
**🔧 Versión: 2.0**
