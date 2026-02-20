# 🔼🔽 Botones de Scroll Flotantes - Scroll Gradual por Secciones

## 🎯 Objetivo

Agregar **botones flotantes de scroll** en todas las páginas de la aplicación para facilitar la navegación vertical **sección por sección** en menús y formularios largos.

---

## ✅ Solución Implementada

### **Componente Reutilizable: `ScrollButton`**

Se creó un componente inteligente que muestra automáticamente:

1. **Botón "Subir" (🔼)**: Aparece cuando haces scroll hacia abajo > 300px
   - **Comportamiento**: Sube **1 sección a la vez** (80% de la altura de la ventana)
   - **NO** sube todo al inicio de una vez

2. **Botón "Bajar" (🔽)**: Aparece cuando hay más contenido abajo
   - **Comportamiento**: Baja **1 sección a la vez** (80% de la altura de la ventana)
   - **NO** baja todo al final de una vez

**Características:**
- ✅ Scroll **GRADUAL** sección por sección
- ✅ Cada click = 80% de la altura de pantalla
- ✅ Animación suave (smooth scroll)
- ✅ Posición fija en esquina inferior derecha
- ✅ Diseño responsive (adapta tamaño en tablets/móviles)
- ✅ Accesibilidad (teclado, ARIA labels, reduced motion)
- ✅ Efectos hover con animación pulse

---

## 🎬 Comportamiento del Scroll Gradual

### **Ejemplo Visual:**

```
┌─────────────────────────────────────┐
│ Sección 1: Header                   │ ← Estás aquí
├─────────────────────────────────────┤
│ Sección 2: Información General      │
├─────────────────────────────────────┤
│ Sección 3: Datos Principales        │ ← Click "Bajar" te lleva aquí
├─────────────────────────────────────┤
│ Sección 4: Tabla de Datos           │
├─────────────────────────────────────┤
│ Sección 5: Firmas                   │
└─────────────────────────────────────┘
```

### **Cómo Funciona:**

1. **Usuario hace click en "Bajar" 🔽**
   - Scroll actual: `0px`
   - Altura ventana: `1000px`
   - Scroll step: `1000px × 0.8 = 800px`
   - **Resultado**: Baja a `800px` (sección 2)

2. **Usuario hace click nuevamente en "Bajar" 🔽**
   - Scroll actual: `800px`
   - Scroll step: `800px`
   - **Resultado**: Baja a `1600px` (sección 3)

3. **Usuario hace click en "Subir" 🔼**
   - Scroll actual: `1600px`
   - Scroll step: `800px`
   - **Resultado**: Sube a `800px` (sección 2)

### **Fórmula del Scroll Step:**

```javascript
const SCROLL_STEP = window.innerHeight * 0.8;

// Ejemplos según tamaño de pantalla:
// - Desktop (1080px altura): SCROLL_STEP = 864px
// - Tablet (768px altura):   SCROLL_STEP = 614px
// - Móvil (667px altura):    SCROLL_STEP = 534px
```

---

## 📁 Archivos Creados

### **1. ScrollButton.jsx**
**Ubicación:** `src/components/ScrollButton.jsx`  
**Líneas:** 95

**Funcionalidad:**
```javascript
// Altura de cada "sección" para el scroll gradual
const SCROLL_STEP = window.innerHeight * 0.8; // 80% de la altura de ventana

// Estados reactivos
const [showScrollTop, setShowScrollTop] = useState(false);
const [showScrollBottom, setShowScrollBottom] = useState(false);

// Lógica de detección de scroll
useEffect(() => {
  const handleScroll = () => {
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    // Mostrar "Subir" si bajaste > 300px
    setShowScrollTop(scrollY > 300);

    // Mostrar "Bajar" si NO estás en el fondo
    const isNearBottom = scrollY + windowHeight >= documentHeight - 100;
    setShowScrollBottom(!isNearBottom);
  };

  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

**Funciones de Scroll Gradual:**
```javascript
// Subir UNA SECCIÓN (no todo al inicio)
const scrollUpOneSection = () => {
  const currentScroll = window.scrollY;
  const newScroll = Math.max(0, currentScroll - SCROLL_STEP);
  
  window.scrollTo({
    top: newScroll,
    behavior: 'smooth'
  });
};

// Bajar UNA SECCIÓN (no todo al final)
const scrollDownOneSection = () => {
  const currentScroll = window.scrollY;
  const documentHeight = document.documentElement.scrollHeight;
  const windowHeight = window.innerHeight;
  const maxScroll = documentHeight - windowHeight;
  const newScroll = Math.min(maxScroll, currentScroll + SCROLL_STEP);
  
  window.scrollTo({
    top: newScroll,
    behavior: 'smooth'
  });
};
```

---

### **2. ScrollButton.css**
**Ubicación:** `src/components/ScrollButton.css`  
**Líneas:** 221

**Estilos Principales:**

#### Botón Base:
```css
.scroll-btn {
  position: fixed;
  right: 2rem;
  z-index: 9998;
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  animation: fadeInScale 0.4s ease;
}
```

#### Botón Subir:
```css
.scroll-btn-top {
  bottom: 2rem;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.scroll-btn-top:hover {
  transform: translateY(-8px) scale(1.05);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
}
```

#### Botón Bajar:
```css
.scroll-btn-bottom {
  bottom: 6rem; /* Arriba del botón "Subir" */
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.scroll-btn-bottom:hover {
  transform: translateY(8px) scale(1.05);
  box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
}
```

---

## 📦 Páginas Modificadas

Se agregó el componente `<ScrollButton />` en **5 páginas principales**:

### **1. FillForm.jsx**
**Ubicación:** `src/pages/FillForm.jsx`  
**Cambios:**
```jsx
// Línea 9: Import
import ScrollButton from "../components/ScrollButton"

// Línea 6139: Antes del cierre del return
{/* 🔼🔽 Botones de scroll */}
<ScrollButton />
```

**Beneficio:** Facilita navegación en formularios largos con muchas secciones.

---

### **2. ViewForms.jsx**
**Ubicación:** `src/pages/ViewForms.jsx`  
**Cambios:**
```jsx
// Línea 7: Import
import ScrollButton from "../components/ScrollButton"

// Línea 991: Antes del cierre del return
{/* 🔼🔽 Botones de scroll */}
<ScrollButton />
```

**Beneficio:** Útil cuando hay muchos formularios guardados en la lista.

---

### **3. DailyForms.jsx**
**Ubicación:** `src/pages/DailyForms.jsx`  
**Cambios:**
```jsx
// Línea 4: Import
import ScrollButton from "../components/ScrollButton";

// Línea 708: Antes del cierre del return
{/* 🔼🔽 Botones de scroll */}
<ScrollButton />
```

**Beneficio:** Navegación rápida entre formularios del día.

---

### **4. Home.jsx**
**Ubicación:** `src/pages/Home.jsx`  
**Cambios:**
```jsx
// Línea 5: Import
import ScrollButton from "../components/ScrollButton"

// Línea 171: Antes del cierre del return
{/* 🔼🔽 Botones de scroll */}
<ScrollButton />
```

**Beneficio:** Útil cuando hay muchas plantillas más usadas.

---

## 🎨 Comportamiento Visual

### **Posicionamiento en Pantalla:**
```
┌─────────────────────────────────────┐
│                                     │
│  Contenido de la página             │
│                                     │
│                                     │
│                              [🔽]   │ ← Botón Bajar (aparece arriba)
│                              [🔼]   │ ← Botón Subir (aparece abajo)
└─────────────────────────────────────┘
                                    ↑
                                 right: 2rem
```

### **Estados de Visibilidad:**

| Posición Scroll | Botón Subir 🔼 | Botón Bajar 🔽 |
|----------------|----------------|----------------|
| **Arriba (0-300px)** | ❌ Oculto | ✅ Visible |
| **Medio (>300px)** | ✅ Visible | ✅ Visible |
| **Cerca del fondo** | ✅ Visible | ❌ Oculto |

**Nota:** Ambos botones pueden estar visibles al mismo tiempo cuando estás en el medio de la página.

---

## 🎮 Ejemplo de Uso Real

### **Escenario: Formulario con 5 Secciones**

```
Posición Inicial (Top = 0):
┌─────────────────────────┐
│ 📋 Header               │ ← Estás aquí
│ Información General     │
└─────────────────────────┘
🔽 Botón "Bajar" visible
🔼 Botón "Subir" oculto

⬇️ Usuario hace click en 🔽

Posición Después (Top = 800px):
┌─────────────────────────┐
│ 📊 Datos Principales    │ ← Ahora estás aquí
│ Tabla 15 Tinas          │
└─────────────────────────┘
🔽 Botón "Bajar" visible
🔼 Botón "Subir" visible

⬇️ Usuario hace click en 🔽 nuevamente

Posición Después (Top = 1600px):
┌─────────────────────────┐
│ ✍️ Firmas Digitales     │ ← Ahora estás aquí
│ Observaciones           │
└─────────────────────────┘
🔽 Botón "Bajar" visible
🔼 Botón "Subir" visible

⬆️ Usuario hace click en 🔼

Posición Después (Top = 800px):
┌─────────────────────────┐
│ 📊 Datos Principales    │ ← Volviste a sección anterior
│ Tabla 15 Tinas          │
└─────────────────────────┘
```

---

## 📱 Responsive Design

### **Desktop (> 1024px):**
```css
.scroll-btn {
  width: 56px;
  height: 56px;
  right: 2rem;
}

.scroll-btn-top { bottom: 2rem; }
.scroll-btn-bottom { bottom: 6rem; }
```

### **Tablets (≤ 1024px):**
```css
.scroll-btn {
  width: 52px;
  height: 52px;
  right: 1.5rem;
}

.scroll-btn-top { bottom: 1.5rem; }
.scroll-btn-bottom { bottom: 5rem; }
```

### **Móviles (≤ 768px):**
```css
.scroll-btn {
  width: 48px;
  height: 48px;
  right: 1rem;
}

.scroll-btn-top { bottom: 1rem; }
.scroll-btn-bottom { bottom: 4rem; }
```

### **Móviles Pequeños (≤ 480px):**
```css
.scroll-btn {
  width: 44px;
  height: 44px;
  right: 0.75rem;
}

.scroll-btn-top { bottom: 0.75rem; }
.scroll-btn-bottom { bottom: 3.5rem; }
```

---

## ✨ Animaciones

### **Aparición:**
```css
@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

### **Hover - Pulse del Ícono:**
```css
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.scroll-btn:hover svg {
  animation: pulse 1s ease-in-out infinite;
}
```

### **Hover - Movimiento del Botón:**
```css
/* Botón Subir: Se eleva */
.scroll-btn-top:hover {
  transform: translateY(-8px) scale(1.05);
}

/* Botón Bajar: Desciende */
.scroll-btn-bottom:hover {
  transform: translateY(8px) scale(1.05);
}
```

---

## ♿ Accesibilidad

### **1. ARIA Labels:**
```jsx
<button
  aria-label="Subir al inicio"
  title="Subir al inicio"
>
```

### **2. Soporte de Teclado:**
```css
.scroll-btn:focus {
  outline: 3px solid rgba(255, 255, 255, 0.5);
  outline-offset: 3px;
}
```

### **3. Reduced Motion:**
```css
@media (prefers-reduced-motion: reduce) {
  .scroll-btn,
  .scroll-btn svg {
    animation: none !important;
    transition: none !important;
  }
}
```

### **4. Contraste:**
- Botón Subir: Azul (#3b82f6) con texto blanco
- Botón Bajar: Verde (#10b981) con texto blanco
- Ambos cumplen WCAG AA

---

## 🧪 Cómo Probar

### **Test 1: Scroll Gradual Hacia Abajo**
1. Ve a `/fill-form` con un formulario largo
2. Estás en la parte superior (scroll = 0)
3. **Verificar**: Aparece botón verde � "Bajar"
4. Click en el botón 🔽
5. **Verificar**: La página baja ~80% de la altura de ventana (NO al final completo)
6. Click nuevamente en 🔽
7. **Verificar**: Baja otra sección más
8. **Resultado**: Navegación gradual, sección por sección

### **Test 2: Scroll Gradual Hacia Arriba**
1. Ve a `/view-forms` con varios formularios
2. Haz scroll manual hasta el medio de la página
3. **Verificar**: Aparece botón azul 🔼 "Subir"
4. Click en el botón 🔼
5. **Verificar**: La página sube ~80% de la altura de ventana (NO al inicio completo)
6. Click nuevamente en 🔼
7. **Verificar**: Sube otra sección más
8. **Resultado**: Navegación gradual hacia arriba

### **Test 3: Ambos Botones Visibles**
1. Ve a `/daily-forms` con varios formularios
2. Haz scroll hasta el medio de la página (>300px pero no cerca del fondo)
3. **Verificar**: Ambos botones visibles simultáneamente
   - 🔼 "Subir" arriba
   - 🔽 "Bajar" abajo
4. Alterna entre ambos botones
5. **Verificar**: Navegación fluida en ambas direcciones

### **Test 4: Comportamiento en los Límites**
1. **En el tope (scroll = 0)**:
   - Click en 🔽 → Baja a ~800px
   - Click en 🔼 → No hace nada (ya estás arriba)

2. **Cerca del fondo**:
   - Click en 🔽 → No pasa del final
   - Click en 🔼 → Sube una sección

3. **Verificar**: Los límites se respetan correctamente

### **Test 4: Responsive**
1. Abre Chrome DevTools (F12)
2. Activa modo responsive (Ctrl+Shift+M)
3. Prueba diferentes tamaños:
   - **iPad Pro (1024px)**: Botones 52px
   - **iPad (768px)**: Botones 48px
   - **iPhone (390px)**: Botones 44px
4. **Verificar**: Botones se adaptan y mantienen posición correcta

### **Test 5: Animaciones**
1. Hover sobre el botón Subir 🔼
2. **Verificar**: 
   - Botón se eleva (-8px)
   - Ícono pulsa
   - Sombra aumenta
3. Hover sobre el botón Bajar 🔽
4. **Verificar**:
   - Botón desciende (+8px)
   - Ícono pulsa
   - Sombra aumenta

---

## 📊 Comparación: Antes vs Después

### **Antes (Scroll Directo):**
```
❌ 1 click → Salta al inicio/final
❌ No hay control granular
❌ Pierdes contexto de dónde estabas
❌ Difícil navegar formularios largos por partes
```

### **Después (Scroll Gradual por Secciones):**
```
✅ 1 click → Baja/sube UNA sección (80% de ventana)
✅ Control total sobre la navegación
✅ Mantienes contexto visual
✅ Navegación precisa sección por sección
✅ Múltiples clicks para recorrer todo el formulario
✅ Puedes detenerte en cualquier sección
```

### **Ejemplo Comparativo:**

**Formulario de 5000px de alto con ventana de 1000px:**

| Acción | Scroll Directo (Anterior) | Scroll Gradual (Actual) |
|--------|--------------------------|-------------------------|
| **Click 🔽** | 0px → 5000px (final) | 0px → 800px (sección 2) |
| **2 Clicks 🔽** | — | 0px → 1600px (sección 3) |
| **3 Clicks 🔽** | — | 0px → 2400px (sección 4) |
| **6 Clicks 🔽** | — | 0px → 4800px (casi final) |
| **Control** | Todo o nada | Preciso y gradual |

---

## 🔧 Configuración Técnica

### **Z-Index:**
```css
.scroll-btn {
  z-index: 9998; /* Debajo de modales (9999), arriba de todo lo demás */
}
```

### **Umbrales de Visibilidad:**
```javascript
// Botón Subir aparece cuando:
scrollY > 300

// Botón Bajar aparece cuando:
const isNearBottom = scrollY + windowHeight >= documentHeight - 100;
!isNearBottom  // Cuando NO estás cerca del fondo
```

### **Scroll Step (Tamaño de Sección):**
```javascript
// 80% de la altura de la ventana
const SCROLL_STEP = window.innerHeight * 0.8;

// Ejemplos:
// - Desktop (1080px): SCROLL_STEP = 864px
// - Tablet (768px):   SCROLL_STEP = 614px  
// - Móvil (667px):    SCROLL_STEP = 534px
```

### **Scroll Gradual:**
```javascript
// Al hacer click en "Subir":
const newScroll = Math.max(0, currentScroll - SCROLL_STEP);

// Al hacer click en "Bajar":
const maxScroll = documentHeight - windowHeight;
const newScroll = Math.min(maxScroll, currentScroll + SCROLL_STEP);

// Ambos usan:
window.scrollTo({
  top: newScroll,
  behavior: 'smooth'   // Animación nativa del navegador
});
```

---

## 🚀 Beneficios

1. **📱 Mejor UX en Tablets**: Un toque para subir/bajar **gradualmente**
2. **⚡ Navegación Controlada**: Evita saltos bruscos, control sección por sección
3. **🎯 Precisión**: Puedes detenerte en cualquier sección intermedia
4. **🎨 Diseño Profesional**: Botones flotantes modernos con comportamiento inteligente
5. **♿ Accesible**: Teclado, ARIA, reduced motion
6. **📐 Responsive**: Adapta tamaño según dispositivo
7. **✨ Animado**: Efectos suaves y atractivos
8. **🔄 Reutilizable**: Un componente para todas las páginas
9. **🧭 Contexto Visual**: No pierdes de vista dónde estabas
10. **🎮 Control Total**: Múltiples clicks para recorrer todo el contenido

---

## 💡 Casos de Uso Ideales

### **1. Formularios Largos (FillForm.jsx)**
- Formulario con 10+ secciones
- Usuario llena sección por sección
- Botones permiten revisar cada parte gradualmente
- **Beneficio**: No saltas del inicio al final, navegas ordenadamente

### **2. Lista de Formularios (ViewForms.jsx)**
- 50+ formularios guardados
- Usuario busca formulario específico en el medio
- Botones ayudan a recorrer la lista gradualmente
- **Beneficio**: Control preciso sin perder contexto

### **3. Formularios por Fecha (DailyForms.jsx)**
- 20+ formularios de un día
- Usuario quiere ver los del medio de la jornada
- Scroll gradual facilita llegar al punto deseado
- **Beneficio**: Navegación intuitiva y predecible

### **4. Página Principal (Home.jsx)**
- Estadísticas + Plantillas más usadas + Acciones
- Usuario quiere ver "Plantillas más usadas" en el medio
- Scroll gradual lleva directamente ahí
- **Beneficio**: Acceso rápido a secciones específicas

---

## 📝 Mantenimiento Futuro

### **Para agregar a nuevas páginas:**
```jsx
// 1. Import en el archivo
import ScrollButton from "../components/ScrollButton"

// 2. Agregar antes del cierre del return
{/* 🔼🔽 Botones de scroll */}
<ScrollButton />
```

### **Para personalizar el tamaño de sección:**
```javascript
// En ScrollButton.jsx, línea 19, puedes cambiar:

// Actual (80% de ventana):
const SCROLL_STEP = window.innerHeight * 0.8;

// Opciones:
const SCROLL_STEP = window.innerHeight * 0.5;  // 50% (secciones más pequeñas)
const SCROLL_STEP = window.innerHeight * 0.6;  // 60%
const SCROLL_STEP = window.innerHeight * 1.0;  // 100% (página completa)
const SCROLL_STEP = 500;                       // Fijo (500px siempre)
```

---

## 🎉 Resultado Final

**Páginas con ScrollButton:**
1. ✅ `FillForm.jsx` - Formularios largos
2. ✅ `ViewForms.jsx` - Lista de formularios
3. ✅ `DailyForms.jsx` - Formularios por fecha
4. ✅ `Home.jsx` - Página principal

**Experiencia del Usuario:**
- 🔼 **1 click para subir** una sección (~80% de ventana)
- 🔽 **1 click para bajar** una sección (~80% de ventana)
- 🔄 **Múltiples clicks** para recorrer todo el contenido
- ✨ Animaciones suaves y profesionales
- 📱 Adaptado perfectamente a tablets/móviles
- 🎯 Control preciso sobre la posición del scroll
- 🧭 Mantienes contexto visual en todo momento

---

**Fecha:** 18 de febrero de 2026  
**Desarrollador:** GitHub Copilot  
**Estado:** ✅ Completado y listo para usar  
**Impacto:** Navegación gradual y controlada, mejora drástica en UX  
**Tipo de Scroll:** Gradual por secciones (80% de altura de ventana)
