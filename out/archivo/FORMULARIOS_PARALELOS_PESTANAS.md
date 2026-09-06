# 🚀 Sistema de Formularios Paralelos con Pestañas

## ✨ Nueva Funcionalidad Implementada

Ahora puedes **abrir y llenar múltiples formularios al mismo tiempo** usando un sistema de pestañas (tabs) para trabajar en paralelo y agilizar el proceso.

---

## 🎯 Características

### ✅ Ventajas Principales:
1. **Múltiples formularios abiertos simultáneamente**
   - Abre 2, 3, 5 o más formularios al mismo tiempo
   - Cada uno es independiente

2. **Cambio rápido entre formularios**
   - Haz clic en una pestaña para cambiar de formulario
   - Los datos de cada formulario se guardan automáticamente al cambiar

3. **Indicadores visuales**
   - 🟡 Punto amarillo parpadeante = Cambios sin guardar
   - ✅ Sin punto = Formulario guardado
   - 📋 Icono + nombre del formulario en cada pestaña

4. **Gestión inteligente**
   - Cierra pestañas con el botón ✕
   - Confirmación si hay cambios sin guardar
   - Contador de formularios abiertos

---

## 📖 Cómo Usar

### 1️⃣ Abrir Primera Pestaña
1. Selecciona una plantilla (como siempre)
2. Selecciona lotes o continúa manualmente
3. El formulario se abre normalmente

### 2️⃣ Abrir Segunda Pestaña (Formulario Paralelo)
**Opción A: Desde selección de plantilla**
- Haz clic de nuevo en "Seleccionar otra plantilla" (en cualquier momento)
- Se te preguntará:
  ```
  📋 Ya tienes 1 formulario(s) abierto(s).
  
  ¿Quieres abrir "NOMBRE_PLANTILLA" en una NUEVA PESTAÑA?
  
  ✅ Aceptar = Nueva pestaña (trabajar en paralelo)
  ❌ Cancelar = Reemplazar pestaña actual
  ```
- Haz clic en **Aceptar** para abrir en nueva pestaña

**Opción B: Desde botón "➕ Nueva Pestaña"**
- Haz clic en el botón morado "➕ Nueva Pestaña" arriba a la izquierda
- Te regresa a selección de plantillas
- Selecciona otra plantilla (o la misma si quieres)
- Se abre en una nueva pestaña

### 3️⃣ Trabajar en Paralelo
- **Cambiar entre formularios**: Haz clic en las pestañas
- **Llenar datos**: Escribe en un formulario, cambia a otro, vuelve al primero
- **Guardar**: Cada formulario se guarda independientemente

### 4️⃣ Cerrar Pestañas
- Haz clic en el botón **✕** de cada pestaña
- Si hay cambios sin guardar, se te preguntará antes de cerrar

---

## 🎨 Interfaz Visual

### Barra de Pestañas
```
┌──────────────────────────────────────────────────────────────────┐
│ ➕ Nueva Pestaña  │ 📋 Formulario 1 🟡 ✕  │ 📋 Formulario 2 ✕ │  📊 2 formularios abiertos │
└──────────────────────────────────────────────────────────────────┘
```

- **Morado degradado**: Barra de pestañas elegante
- **Pestaña activa**: Fondo blanco, texto morado
- **Pestaña inactiva**: Fondo transparente, texto blanco
- **Indicador amarillo (🟡)**: Cambios sin guardar

---

## 💡 Casos de Uso

### Ejemplo 1: Múltiples Tinas al Mismo Tiempo
```
Pestaña 1: Formulario "15 TINAS" - Fecha 03/01/2026
Pestaña 2: Formulario "15 TINAS" - Fecha 04/01/2026
Pestaña 3: Formulario "15 TINAS" - Fecha 05/01/2026
```
**Ventaja**: Llenas 3 días seguidos sin perder contexto

### Ejemplo 2: Diferentes Formularios
```
Pestaña 1: "CONTROL DE TEMPERATURAS"
Pestaña 2: "RECEPCIÓN DE PRODUCTO"
Pestaña 3: "LIMPIEZA DE ÁREAS"
```
**Ventaja**: Completas varios procesos en paralelo

### Ejemplo 3: Comparar Datos
```
Pestaña 1: Formulario del lote 12345
Pestaña 2: Formulario del lote 12346
```
**Ventaja**: Puedes copiar datos de un lote a otro

---

## 🔧 Detalles Técnicos

### Estados Nuevos
```javascript
const [openTabs, setOpenTabs] = useState([]);
const [activeTabIndex, setActiveTabIndex] = useState(0);
const [nextTabId, setNextTabId] = useState(1);
```

### Estructura de una Pestaña
```javascript
{
  id: 1,                    // ID único
  templateId: 9,            // ID de la plantilla
  templateName: "15 TINAS", // Nombre visible
  template: {...},          // Objeto plantilla completo
  headerData: {...},        // Datos del header
  bodyData: [...],          // Datos del body (tablas)
  firmasData: {...},        // Datos de firmas
  hasUnsavedChanges: false, // Estado de guardado
  createdAt: "2026-01-03"   // Fecha de creación
}
```

### Funciones Principales
```javascript
createNewTab(template)     // Crea nueva pestaña
switchToTab(index)         // Cambia a pestaña específica
saveCurrentTabData()       // Guarda datos antes de cambiar
loadTabData(tab)           // Carga datos de pestaña
closeTab(index)            // Cierra pestaña con confirmación
saveActiveTab()            // Guarda formulario activo
```

---

## ⚠️ Limitaciones y Consideraciones

### ❌ Limitaciones Actuales:
1. **Auto-guardado independiente**: Cada pestaña se guarda por separado
2. **Navegación**: Al recargar la página, las pestañas se pierden (próxima mejora)
3. **Memoria**: Muchas pestañas (>10) pueden ralentizar el navegador

### ✅ Buenas Prácticas:
1. **Cierra pestañas no usadas**: Mantén solo las que necesitas activamente
2. **Guarda frecuentemente**: Usa Ctrl+S o el botón "Guardar" regularmente
3. **Nombres claros**: Usa fechas o identificadores en los formularios para diferenciarlos

---

## 🎯 Flujo de Trabajo Recomendado

### Para Llenado Rápido Diario:
```
1. Abre pestaña: "15 TINAS - Lunes"
2. Abre pestaña: "15 TINAS - Martes"
3. Abre pestaña: "15 TINAS - Miércoles"
4. Llena las 3 simultáneamente:
   - Revisa la tabla del lunes
   - Cambias a martes y copias datos similares
   - Cambias a miércoles
5. Guardas cada uno por separado
```

### Para Diferentes Procesos:
```
1. Abre pestaña: "RECEPCIÓN"
2. Completa hasta donde puedas
3. Mientras esperas datos, abre pestaña: "LIMPIEZA"
4. Llenas limpieza
5. Vuelves a recepción cuando tengas los datos
6. Guardas ambos
```

---

## 🚀 Próximas Mejoras Planeadas

### Fase 2:
- [ ] **Persistencia en localStorage**: Las pestañas se mantienen al recargar
- [ ] **Duplicar pestaña**: Copia una pestaña completa con sus datos
- [ ] **Arrastrar y soltar**: Reordena las pestañas
- [ ] **Búsqueda en pestañas**: Encuentra una pestaña por nombre
- [ ] **Vista compacta**: Modo miniatura para ver todas las pestañas a la vez

### Fase 3:
- [ ] **Comparación lado a lado**: Ver 2 formularios al mismo tiempo
- [ ] **Copiar entre pestañas**: Copiar campos de un formulario a otro
- [ ] **Plantillas favoritas**: Acceso rápido a plantillas más usadas
- [ ] **Atajos de teclado**: 
  - `Ctrl + T` = Nueva pestaña
  - `Ctrl + W` = Cerrar pestaña
  - `Ctrl + Tab` = Siguiente pestaña

---

## 📊 Estadísticas de Uso

El sistema rastrea automáticamente:
- ✅ Número de pestañas abiertas
- ✅ Estado de guardado de cada una
- ✅ Tiempo de última modificación

Puedes ver el contador en la esquina superior derecha:
```
📊 3 formularios abiertos
```

---

## ❓ Preguntas Frecuentes

### **P: ¿Se pierden los datos al cambiar de pestaña?**
**R**: ❌ NO. Los datos se guardan automáticamente antes de cambiar.

### **P: ¿Puedo abrir el mismo formulario dos veces?**
**R**: ✅ SÍ. Puedes abrir la misma plantilla múltiples veces (ej: para diferentes fechas).

### **P: ¿Cuántas pestañas puedo abrir?**
**R**: Técnicamente ilimitadas, pero recomendamos máximo 5-7 para mejor rendimiento.

### **P: ¿Qué pasa si cierro el navegador con pestañas abiertas?**
**R**: Actualmente se pierden. Guarda antes de cerrar. (Mejora próxima: auto-guardado).

### **P: ¿Puedo guardar todas las pestañas a la vez?**
**R**: Próximamente. Por ahora, guarda cada una individualmente.

---

## 🎉 ¡Listo para Usar!

Recarga la página y empieza a trabajar en paralelo. 🚀

**Tip Pro**: Abre 3 formularios al iniciar tu jornada y trabaja en ellos según necesites. ¡Es como tener 3 escritorios al mismo tiempo!
