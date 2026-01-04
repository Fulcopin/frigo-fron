# 📅 Funcionalidad: Formularios por Fecha

## 🎯 Descripción General

Nueva sección para **filtrar, visualizar y exportar formularios por fecha**. Permite gestionar eficientemente los formularios completados en un día específico con capacidades avanzadas de exportación y vista detallada.

---

## ✨ Características Principales

### 🔍 1. Filtrado Avanzado
- **Por Fecha**: Selector de fecha para filtrar formularios de un día específico
- **Por Plantilla**: Filtro adicional para ver solo formularios de una plantilla específica
- **Actualización en Tiempo Real**: Los resultados se actualizan automáticamente al cambiar filtros

### 📊 2. Exportación a Excel
- **Exportación Completa**: Genera un archivo Excel con todos los formularios del día
- **Múltiples Hojas**: 
  - Hoja "Resumen": Listado general con ID, plantilla, fechas
  - Hojas individuales: Una por cada formulario (hasta 10) con datos detallados
- **Formato Automático**: Organiza header, body y datos de tabla automáticamente
- **Nombre Descriptivo**: Archivo nombrado como `Formularios_YYYY-MM-DD.xlsx`

### 👁️ 3. Vista Detallada
- **Modal de Detalles**: Visualización completa de cada formulario
- **Datos Estructurados**:
  - Información general (ID, plantilla, versión, fecha)
  - Encabezado (headerData)
  - Datos del formulario (bodyData con filas de tabla)
- **Navegación**: Click en cualquier tarjeta para ver detalles

### 📋 4. Copiar al Portapapeles
- **Botón de Copia**: Cada campo tiene un botón 📋 para copiar su valor
- **Feedback Visual**: Confirmación visual cuando se copia exitosamente
- **Funciona en Todo**: Headers, body, tablas, metadatos

### ✏️ 5. Edición Rápida
- **Acceso Directo**: Botón "Editar" en cada tarjeta
- **Desde Modal**: También se puede editar desde la vista detallada
- **Navegación Fluida**: Redirige a `/edit-filled-form/:id`

---

## 🗂️ Estructura de Archivos

```
src/
├── pages/
│   └── DailyForms.jsx          # Componente principal (688 líneas)
├── styles/
│   └── DailyForms.css          # Estilos específicos (715 líneas)
└── App.jsx                     # Ruta agregada
```

---

## 🛠️ Tecnologías Utilizadas

- **React 18**: Hooks (useState, useEffect)
- **React Router**: Navegación entre páginas
- **SheetJS (xlsx)**: Exportación a Excel
- **Fetch API**: Consumo de endpoints backend
- **CSS3**: Diseño responsive con gradientes Frigolab

---

## 🎨 Diseño Visual

### Paleta de Colores (Frigolab)
- **Verde Principal**: `#10b981`, `#059669`
- **Amarillo Acento**: `#fbbf24`, `#f59e0b`
- **Fondos**: `#f0fdf4`, `#dcfce7`
- **Superficie**: Blanco con sombras sutiles

### Componentes de UI
- **Tarjetas de Formulario**: Grid responsive con hover effects
- **Modal**: Overlay con animaciones de entrada
- **Botones**: Gradientes con efectos de elevación
- **Filtros**: Inputs estilizados con focus states

---

## 📡 Endpoints Utilizados

### 1. Obtener Todos los Formularios
```javascript
GET /api/FilledForms
```
**Respuesta**: Array de formularios con metadatos básicos

### 2. Obtener Detalles de Formulario
```javascript
GET /api/FilledForms/{id}/simple
```
**Respuesta**: 
```json
{
  "formID": 123,
  "templateID": 36,
  "templateName": "Registro 15 Tinas",
  "templateVersion": "1",
  "headerData": {...},
  "bodyData": [...],
  "createdAt": "2026-01-03T10:30:00",
  "updatedAt": "2026-01-03T11:00:00"
}
```

---

## 🔄 Flujo de Usuario

### Caso de Uso 1: Exportar Formularios del Día
1. Usuario selecciona fecha actual (por defecto)
2. Sistema muestra formularios filtrados
3. Usuario hace click en "📊 Exportar a Excel"
4. Sistema genera archivo Excel con múltiples hojas
5. Descarga automática: `Formularios_2026-01-03.xlsx`

### Caso de Uso 2: Revisar Detalles de un Formulario
1. Usuario selecciona fecha
2. Sistema muestra tarjetas de formularios
3. Usuario hace click en "👁️ Ver Detalles"
4. Se abre modal con información completa
5. Usuario puede copiar cualquier valor con 📋
6. Opción de editar desde el modal

### Caso de Uso 3: Filtrar por Plantilla Específica
1. Usuario selecciona fecha
2. Sistema carga todas las plantillas usadas ese día
3. Usuario selecciona plantilla del dropdown
4. Vista se actualiza mostrando solo esa plantilla
5. Exportación incluye solo formularios filtrados

---

## 📊 Estructura de Datos Excel

### Hoja "Resumen"
| # | ID | Plantilla | Fecha Creación | Última Actualización |
|---|----|-----------|-----------------|--------------------|
| 1 | 456 | Registro 15 Tinas | 03/01/2026 10:30:00 | 03/01/2026 11:00:00 |
| 2 | 457 | Producción Diaria | 03/01/2026 14:15:00 | - |

### Hojas Individuales (Form_456, Form_457, etc.)
| Campo | Valor |
|-------|-------|
| Lote | L-2026-001 |
| Turno | Mañana |
| --- TABLA --- | |
| Fila 1 - Tina | 1 |
| Fila 1 - Peso | 2500 |
| Fila 2 - Tina | 2 |
| Fila 2 - Peso | 2300 |

---

## 🎯 Estados del Componente

```javascript
const [selectedDate, setSelectedDate] = useState(hoy);
const [allForms, setAllForms] = useState([]);
const [filteredForms, setFilteredForms] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const [templates, setTemplates] = useState([]);
const [selectedTemplate, setSelectedTemplate] = useState("all");
const [selectedForm, setSelectedForm] = useState(null);
const [showDetails, setShowDetails] = useState(false);
const [detailedData, setDetailedData] = useState(null);
```

---

## 🔧 Funciones Principales

### `loadAllForms()`
Carga todos los formularios desde el backend y extrae plantillas únicas.

### `filterFormsByDate()`
Filtra formularios por fecha y plantilla seleccionadas. Se ejecuta automáticamente con `useEffect`.

### `exportToExcel()`
Genera archivo Excel con:
- Hoja resumen de todos los formularios
- Hojas individuales con detalles (máximo 10)
- Formato automático de headers y tablas

### `viewFormDetails(form)`
Abre modal con detalles completos del formulario. Carga datos desde endpoint `/simple`.

### `copyToClipboard(text)`
Copia texto al portapapeles con feedback visual temporal.

### `renderFormData(data, prefix)`
Renderiza recursivamente datos del formulario:
- Arrays: Muestra como tabla con filas numeradas
- Objetos: Grid de campos clave-valor
- Primitivos: Texto simple

---

## 📱 Responsive Design

### Desktop (> 768px)
- Grid de 3 columnas para tarjetas
- Filtros en línea horizontal
- Modal ancho máximo 900px

### Tablet (< 768px)
- Grid de 2 columnas
- Filtros apilados verticalmente
- Modal con márgenes reducidos

### Mobile (< 480px)
- Grid de 1 columna
- Botones full-width
- Modal ocupa 95% del viewport

---

## ⚡ Performance

### Optimizaciones
- **Lazy Loading**: Modal solo carga detalles al abrirse
- **Filtrado Local**: Evita llamadas al servidor en cada cambio de filtro
- **Límite de Hojas**: Exportación limitada a 10 formularios detallados para no sobrecargar Excel
- **useEffect Condicional**: Solo filtra cuando cambian las dependencias relevantes

### Carga Inicial
1. Fetch único a `/FilledForms` (todos los formularios)
2. Procesamiento local de filtros
3. Extracción de plantillas únicas sin duplicados

---

## 🚀 Acceso a la Funcionalidad

### Navbar Principal
```jsx
<Link to="/daily-forms">
  📅 Formularios por Fecha
</Link>
```

### Home (Dashboard)
Tarjeta clickeable en la sección de estadísticas:
```jsx
<div className="stat-card stat-card-highlight stat-card-clickable" 
     onClick={() => navigate('/daily-forms')}>
  <div className="stat-icon">📅</div>
  <div className="stat-content">
    <h3>Por Fecha</h3>
    <p>Filtrar y exportar formularios</p>
  </div>
</div>
```

---

## 🐛 Manejo de Errores

### Errores de Red
```javascript
if (!response.ok) throw new Error('Error al cargar formularios');
```
Muestra mensaje en pantalla con fondo rojo.

### Errores de Exportación
```javascript
catch (err) {
  alert('Error al exportar a Excel: ' + err.message);
}
```
Alerta al usuario si falla la generación del Excel.

### Formularios Sin Datos
```javascript
if (filteredForms.length === 0) {
  // Muestra empty state con mensaje amigable
}
```

---

## 🎨 Animaciones CSS

### Entrada de Modal
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(50px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

### Hover en Tarjetas
```css
.form-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(16, 185, 129, 0.2);
  border-color: #10b981;
}
```

### Spinner de Carga
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## 📋 Checklist de Funcionalidades

- [x] Filtro por fecha
- [x] Filtro por plantilla
- [x] Exportación a Excel (resumen + detalles)
- [x] Vista detallada en modal
- [x] Copiar al portapapeles
- [x] Edición desde tarjeta
- [x] Edición desde modal
- [x] Estados vacíos y de carga
- [x] Manejo de errores
- [x] Diseño responsive
- [x] Animaciones fluidas
- [x] Integración con navbar
- [x] Acceso desde Home

---

## 🔮 Mejoras Futuras Sugeridas

1. **Rango de Fechas**: Permitir seleccionar desde-hasta
2. **Gráficas**: Estadísticas visuales de formularios por día/semana
3. **Exportar PDF**: Además de Excel, generar PDFs individuales
4. **Búsqueda**: Campo de texto para buscar por contenido
5. **Ordenamiento**: Ordenar por fecha, plantilla, ID
6. **Paginación**: Para días con muchos formularios
7. **Comparación**: Seleccionar múltiples formularios para comparar
8. **Comentarios**: Agregar notas a formularios específicos
9. **Notificaciones**: Alertas cuando se completan X formularios al día
10. **Dashboard**: Gráfica de tendencias de uso diario/semanal

---

## 📝 Notas de Desarrollo

### Estructura de Datos del Backend
Los formularios deben tener al menos:
```json
{
  "formID": number,
  "FormID": number,  // Alternativa
  "templateID": number,
  "TemplateID": number,  // Alternativa
  "templateName": string,
  "createdAt": ISO Date String,
  "CreatedAt": ISO Date String,  // Alternativa
  "updatedAt": ISO Date String (opcional)
}
```

### Formato de Fecha
```javascript
// Input: YYYY-MM-DD
// Display: dd/mm/yyyy hh:mm:ss (locale es-ES)
new Date(form.createdAt).toLocaleString('es-ES')
```

### Navegación
```javascript
// Desde cualquier lugar:
navigate('/daily-forms')

// Con parámetros (futuro):
navigate('/daily-forms', { state: { date: '2026-01-03' } })
```

---

## 🎓 Ejemplo de Uso Completo

```javascript
// 1. Usuario abre página
// URL: /daily-forms

// 2. Sistema carga formularios
useEffect(() => loadAllForms(), [])

// 3. Usuario selecciona fecha
setSelectedDate('2026-01-03')

// 4. Sistema filtra automáticamente
useEffect(() => filterFormsByDate(), [selectedDate, allForms])

// 5. Usuario exporta
exportToExcel() // Descarga: Formularios_2026-01-03.xlsx

// 6. Usuario ve detalles
viewFormDetails(form) // Abre modal

// 7. Usuario copia valor
copyToClipboard('L-2026-001') // Feedback visual

// 8. Usuario edita
editForm(456) // Navega a /edit-filled-form/456
```

---

## 🔗 Links Relacionados

- **Componente**: `src/pages/DailyForms.jsx`
- **Estilos**: `src/styles/DailyForms.css`
- **Rutas**: `src/App.jsx` (líneas 14, 70, 103, 166)
- **Home**: `src/pages/Home.jsx` (línea 87-95)
- **API**: `/api/FilledForms` y `/api/FilledForms/{id}/simple`

---

## ✅ Testing Manual

### Caso 1: Sin Formularios
1. Seleccionar fecha sin formularios
2. ✓ Debe mostrar empty state

### Caso 2: Con Formularios
1. Seleccionar fecha con formularios
2. ✓ Debe mostrar tarjetas
3. ✓ Contador debe ser correcto

### Caso 3: Exportación
1. Click en "Exportar a Excel"
2. ✓ Debe descargar archivo
3. ✓ Archivo debe tener hojas correctas

### Caso 4: Modal
1. Click en "Ver Detalles"
2. ✓ Modal debe abrir
3. ✓ Datos deben ser correctos
4. ✓ Botones de copia deben funcionar

### Caso 5: Filtros
1. Cambiar fecha
2. ✓ Resultados deben actualizarse
3. Cambiar plantilla
4. ✓ Solo debe mostrar esa plantilla

---

## 🎉 Conclusión

Esta funcionalidad proporciona una **herramienta completa** para la gestión diaria de formularios con:
- ✅ Interfaz intuitiva
- ✅ Exportación profesional
- ✅ Visualización detallada
- ✅ Experiencia de usuario fluida
- ✅ Diseño consistente con Frigolab Docs

**Fecha de Implementación**: 3 de Enero, 2026  
**Versión**: 1.0.0  
**Estado**: ✅ Completado y Funcional
