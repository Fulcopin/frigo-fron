# 📚 Sistema de Historial de Versiones - Guía Visual Rápida

## 🎯 Acceso Rápido

### **Ubicación del Botón:**
```
Administrar Plantillas
│
├── Plantilla 1: FOR-CPCLT - Control de Calidad
│   └── [📚 Historial] [✏️ Editar] [🗑️ Eliminar]
│
├── Plantilla 2: FOR-PROD - Producción
│   └── [📚 Historial] [✏️ Editar] [🗑️ Eliminar]
```

---

## 🖼️ Vista 1: Timeline de Versiones

```
╔════════════════════════════════════════════════════════════╗
║  📚 Historial de Versiones                         [✖️]    ║
║  FOR-CPCLT - Control de Calidad de Productos              ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  [🔍 Comparar Versiones]                                  ║
║                                                            ║
║  ┌──────────────────────────────────────────────────┐     ║
║  │ ✅  Versión 03-01              [ACTUAL]          │     ║
║  │     📊 5 formularios                             │     ║
║  │     Primer uso: 15 de diciembre de 2025         │     ║
║  │     [👁️ Ver Detalles]                           │     ║
║  └──────────────────────────────────────────────────┘     ║
║           │                                               ║
║           ↓                                               ║
║  ┌──────────────────────────────────────────────────┐     ║
║  │ 📜  Versión 02-01                                │     ║
║  │     📊 12 formularios                            │     ║
║  │     Primer uso: 1 de noviembre de 2025          │     ║
║  │     Último uso: 14 de diciembre de 2025         │     ║
║  │     [👁️ Ver Detalles]                           │     ║
║  └──────────────────────────────────────────────────┘     ║
║           │                                               ║
║           ↓                                               ║
║  ┌──────────────────────────────────────────────────┐     ║
║  │ 📜  Versión 01-01                                │     ║
║  │     📊 8 formularios                             │     ║
║  │     Primer uso: 1 de octubre de 2025            │     ║
║  │     Último uso: 31 de octubre de 2025           │     ║
║  │     [👁️ Ver Detalles]                           │     ║
║  └──────────────────────────────────────────────────┘     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

### **Leyenda:**
- ✅ **Verde** = Versión ACTUAL (la que se usa ahora)
- 📜 **Amarillo** = Versión HISTÓRICA (obsoleta)
- 📊 = Cantidad de formularios creados con esa versión

---

## 🖼️ Vista 2: Detalles de Versión

```
╔════════════════════════════════════════════════════════════╗
║  [← Volver]  📄 Detalles de Versión 02-01        [✖️]    ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  ┌── Información General ─────────────────────────┐       ║
║  │ Código:    FOR-CPCLT                           │       ║
║  │ Nombre:    Control de Calidad de Productos     │       ║
║  │ Versión:   [02-01]                             │       ║
║  └────────────────────────────────────────────────┘       ║
║                                                            ║
║  ┌── Descripción del Formulario ───────────────────┐      ║
║  │ Objetivo: Control de calidad en producción     │       ║
║  │ Proceso:  Producción y empaque                 │       ║
║  └────────────────────────────────────────────────┘       ║
║                                                            ║
║  ┌── Estructura Técnica ───────────────────────────┐      ║
║  │ Header Fields:   ✅ Disponible                 │       ║
║  │ Body Elements:   ✅ Disponible                 │       ║
║  │ Firmas:          ✅ Disponible                 │       ║
║  └────────────────────────────────────────────────┘       ║
║                                                            ║
║  ┌── Formularios Asociados [12] ──────────────────┐       ║
║  │                                                 │       ║
║  │ ┌─ #45 ─────────────────────────────────────┐  │       ║
║  │ │ 15 de noviembre de 2025, 10:30           │  │       ║
║  │ │ "Lote: ABC123, Producto: Queso..."       │  │       ║
║  │ └──────────────────────────────────────────┘  │       ║
║  │                                                 │       ║
║  │ ┌─ #48 ─────────────────────────────────────┐  │       ║
║  │ │ 18 de noviembre de 2025, 14:15           │  │       ║
║  │ │ "Lote: DEF456, Producto: Yogurt..."      │  │       ║
║  │ └──────────────────────────────────────────┘  │       ║
║  │                                                 │       ║
║  │ ... (10 más)                                   │       ║
║  └────────────────────────────────────────────────┘       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

---

## 🖼️ Vista 3: Modo Comparación

### **Paso 1: Activar Modo Comparación**

```
╔════════════════════════════════════════════════════════════╗
║  📚 Historial de Versiones                         [✖️]    ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  [❌ Cancelar Comparación]                                ║
║                                                            ║
║  ┌────────────────────────────────────────────────┐       ║
║  │ ⚠️ Modo Comparación: Selecciona dos versiones │       ║
║  │                                                 │       ║
║  │ Versión Antigua: 02-01                         │       ║
║  │ Versión Nueva:   03-01                         │       ║
║  │                                                 │       ║
║  │ [▶️ Comparar Ahora]                            │       ║
║  └────────────────────────────────────────────────┘       ║
║                                                            ║
║  ┌──────────────────────────────────────────────────┐     ║
║  │ ✅  Versión 03-01              [ACTUAL]          │     ║
║  │     [✓ Seleccionada (Nueva)]                    │     ║
║  └──────────────────────────────────────────────────┘     ║
║                                                            ║
║  ┌──────────────────────────────────────────────────┐     ║
║  │ 📜  Versión 02-01                                │     ║
║  │     [✓ Seleccionada (Antigua)]                  │     ║
║  └──────────────────────────────────────────────────┘     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

### **Paso 2: Resultado de Comparación**

```
╔════════════════════════════════════════════════════════════╗
║  [← Volver]  🔍 Comparación de Versiones           [✖️]    ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║        ┌────────────┐            ┌────────────┐           ║
║        │  02-01     │     →      │  03-01     │           ║
║        │ (Antigua)  │            │  (Nueva)   │           ║
║        └────────────┘            └────────────┘           ║
║                                                            ║
║  Comparación realizada: 15 de diciembre de 2025, 16:30   ║
║                                                            ║
║  ┌── Cambios Detectados [4] ──────────────────────┐       ║
║  │                                                 │       ║
║  │ 🔸 Nombre:                                      │       ║
║  │    'Control de Calidad v2'                     │       ║
║  │    → 'Control de Calidad Mejorado'             │       ║
║  │                                                 │       ║
║  │ 🔸 Objetivo:                                    │       ║
║  │    'Controlar calidad básica'                  │       ║
║  │    → 'Control exhaustivo de calidad'           │       ║
║  │                                                 │       ║
║  │ 🔸 BodyElements:                                │       ║
║  │    Estructura de tabla modificada              │       ║
║  │                                                 │       ║
║  │ 🔸 HeaderFields:                                │       ║
║  │    Estructura modificada                       │       ║
║  │                                                 │       ║
║  └────────────────────────────────────────────────┘       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

---

## 💡 Casos de Uso Prácticos

### **Caso 1: "¿Cuántos formularios se crearon con la versión antigua?"**

**Pasos:**
1. Click en **📚 Historial** en la plantilla
2. Ver el timeline
3. Leer el número junto a 📊

**Resultado:**
```
📜 Versión 02-01
   📊 12 formularios  ← AQUÍ está la respuesta
```

---

### **Caso 2: "¿Qué cambió entre noviembre y diciembre?"**

**Pasos:**
1. Click en **📚 Historial**
2. Click en **🔍 Comparar Versiones**
3. Seleccionar versión de noviembre como "Antigua"
4. Seleccionar versión de diciembre como "Nueva"
5. Click en **▶️ Comparar Ahora**

**Resultado:**
```
Cambios Detectados (X):
🔸 Nombre: 'Versión Nov' → 'Versión Dec'
🔸 Objetivo: ...
🔸 BodyElements: Estructura de tabla modificada
```

---

### **Caso 3: "¿Cuáles formularios usaron la versión 02-01?"**

**Pasos:**
1. Click en **📚 Historial**
2. Buscar versión **02-01** en el timeline
3. Click en **👁️ Ver Detalles**
4. Scroll hasta "Formularios Asociados"

**Resultado:**
```
Formularios Asociados [12]
┌─ #45 ─────────────────────┐
│ 15 de noviembre, 10:30   │
└──────────────────────────┘
┌─ #48 ─────────────────────┐
│ 18 de noviembre, 14:15   │
└──────────────────────────┘
... (10 más)
```

---

### **Caso 4: "¿Cómo era la plantilla en octubre?"**

**Pasos:**
1. Click en **📚 Historial**
2. Buscar la versión que estaba activa en octubre
3. Click en **👁️ Ver Detalles**
4. Revisar sección "Estructura Técnica"

**Resultado:**
```
Estructura Técnica
Header Fields:   ✅ Disponible
Body Elements:   ✅ Disponible
Firmas:          ✅ Disponible

(Puedes ver el snapshot completo de cómo era)
```

---

## 🎨 Código de Colores

### **Badges de Versión:**

| Badge | Significado | Color | Cuándo aparece |
|-------|-------------|-------|----------------|
| ✅ **ACTUAL** | Versión actual | Verde #10b981 | Solo en la versión que coincide con Template.Version |
| 📜 (sin tag) | Versión histórica | Amarillo #f59e0b | Todas las versiones antiguas |

### **Estados de Selección (Modo Comparación):**

| Estado | Color de fondo | Color de borde |
|--------|----------------|----------------|
| Seleccionada (Antigua) | Amarillo claro #fef3c7 | Naranja #f59e0b |
| Seleccionada (Nueva) | Verde claro #d1fae5 | Verde #10b981 |
| No seleccionada | Blanco | Gris #e5e7eb |

---

## ⚡ Atajos de Teclado

| Tecla | Acción |
|-------|--------|
| **ESC** | Cerrar modal |
| **Tab** | Navegar entre botones |
| **Enter** | Activar botón enfocado |

---

## 📱 Responsive Behavior

### **Desktop (>1024px):**
```
┌──────────────────────────────────────┐
│  [📚 Historial] [✏️ Editar] [🗑️ Eliminar] │
└──────────────────────────────────────┘
```

### **Tablet (768-1024px):**
```
┌──────────────────────────────────────┐
│  [📚 Historial]  [✏️ Editar]         │
│  [🗑️ Eliminar]                        │
└──────────────────────────────────────┘
```

### **Mobile (<768px):**
```
┌──────────────────┐
│  [📚 Historial]  │
│  [✏️ Editar]     │
│  [🗑️ Eliminar]   │
└──────────────────┘
```

---

## 🔔 Mensajes del Sistema

### **Éxito:**
```
✅ Información de versión cargada correctamente
```

### **Advertencia:**
```
⚠️ Snapshot no disponible - versión histórica
(Este formulario es muy antiguo y no tiene snapshot guardado)
```

### **Error:**
```
❌ Error al cargar el historial de versiones
(Verifica que el backend esté corriendo)
```

### **Información:**
```
📭 No hay versiones registradas para esta plantilla
(Crea formularios para empezar a registrar versiones)
```

---

## 🎯 Métricas Visuales

### **Contadores con Badge:**

```
Formularios Asociados [12]
                       ↑
                Badge morado con fondo
```

```
Cambios Detectados [4]
                    ↑
                Badge morado con fondo
```

---

## 🚀 Inicio Rápido - 3 Pasos

### **1. Abrir Historial**
```
Administrar Plantillas → [📚 Historial]
```

### **2. Explorar Versiones**
```
Timeline → [👁️ Ver Detalles]
```

### **3. Comparar (Opcional)**
```
[🔍 Comparar Versiones] → Seleccionar 2 → [▶️ Comparar]
```

---

## 📊 Dashboard Visual (Ejemplo)

```
╔══════════════════════════════════════════════════╗
║  Plantilla: FOR-CPCLT                            ║
╠══════════════════════════════════════════════════╣
║  Total Versiones:     3                          ║
║  Versión Actual:      03-01                      ║
║  Total Formularios:   25                         ║
║                                                  ║
║  Distribución:                                   ║
║  ├─ v03-01: █████ (5 formularios) 20%          ║
║  ├─ v02-01: ████████████ (12 formularios) 48%  ║
║  └─ v01-01: ████████ (8 formularios) 32%       ║
╚══════════════════════════════════════════════════╝
```

---

## ✅ Checklist de Usuario

Después de usar el sistema, deberías poder responder:

- [ ] ¿Cuál es la versión actual de mi plantilla?
- [ ] ¿Cuántas versiones ha tenido mi plantilla?
- [ ] ¿Cuántos formularios se crearon con cada versión?
- [ ] ¿Qué cambió entre dos versiones específicas?
- [ ] ¿Qué formularios usaron una versión antigua?
- [ ] ¿Cuándo se usó por primera vez una versión?
- [ ] ¿Cuándo se usó por última vez una versión?

Si puedes responder todas, **¡estás usando el sistema correctamente!** ✅

---

**¡Guía Visual Completada! 🎉**

Para más detalles técnicos, consulta:
- `HISTORIAL_VERSIONES_GUIA.md` (guía completa)
- `IMPLEMENTACION_HISTORIAL_VERSIONES.md` (guía de implementación)
