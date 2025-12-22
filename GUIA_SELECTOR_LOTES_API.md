# 🎯 Selector de Múltiples Lotes desde API

## 📅 Fecha: 16 de diciembre de 2025

## ✅ Componentes Creados

### 1. **LoteSelectorAPI.jsx** - Componente Principal
Selector interactivo para buscar y seleccionar múltiples lotes desde una API.

**Ubicación**: `src/components/LoteSelectorAPI.jsx`

**Características**:
- ✅ Búsqueda de movimientos por fecha desde API
- ✅ Selección múltiple de lotes con checkboxes
- ✅ Vista de chips para lotes seleccionados
- ✅ Eliminación individual o total de lotes
- ✅ Modal interactivo con diseño profesional
- ✅ Manejo de errores y estados de carga
- ✅ Mensaje de ayuda si no hay movimientos

### 2. **LoteSelectorAPI.css** - Estilos del Componente
Diseño moderno y profesional con animaciones y efectos visuales.

**Características de diseño**:
- 🎨 Gradientes en botones
- ✨ Animaciones suaves (slideIn, fadeIn)
- 📱 Diseño responsive
- 🟢 Chips verdes para lotes seleccionados
- 🔵 Modal centrado con overlay oscuro

### 3. **TestLoteSelector.jsx** - Página de Ejemplo
Página de demostración con formulario completo.

**Ubicación**: `src/pages/TestLoteSelector.jsx`

---

## 📖 Guía de Uso

### 🔧 Paso 1: Importar el Componente

```jsx
import LoteSelectorAPI from '../components/LoteSelectorAPI';
```

### 📝 Paso 2: Agregar al Formulario

```jsx
function MiFormulario() {
  const [lotesSeleccionados, setLotesSeleccionados] = useState([]);

  const handleLotesSelected = (lotes) => {
    console.log('Lotes seleccionados:', lotes);
    setLotesSeleccionados(lotes);
  };

  return (
    <form>
      {/* Otros campos... */}
      
      <LoteSelectorAPI
        label="Lotes de Proceso"
        onLotesSelected={handleLotesSelected}
        selectedLotes={lotesSeleccionados}
        apiEndpoint="/api/movimientos"
      />
      
      {/* Más campos... */}
    </form>
  );
}
```

### ⚙️ Paso 3: Configurar la API

Tu API debe responder con el siguiente formato:

**Endpoint**: `GET /api/movimientos?fecha=YYYY-MM-DD`

**Respuesta esperada**:
```json
[
  {
    "lote": "10722",
    "proveedor": "ALVIA VALENCIA ANGELA VICTORIA"
  },
  {
    "lote": "10723",
    "proveedor": "MENDOZA ZAMBRANO JAIME CALIXTO"
  },
  {
    "lote": "10724",
    "proveedor": "LOPEZ PICO JACINTO POLIVIO"
  }
]
```

**Respuesta vacía** (no hay movimientos):
```json
[]
```

---

## 🎯 Props del Componente

| Prop | Tipo | Requerido | Default | Descripción |
|------|------|-----------|---------|-------------|
| `onLotesSelected` | Function | ✅ Sí | - | Callback que recibe array de lotes seleccionados |
| `selectedLotes` | Array | ❌ No | `[]` | Array inicial de lotes seleccionados |
| `apiEndpoint` | String | ❌ No | `/api/movimientos` | Endpoint de la API |
| `label` | String | ❌ No | `'Seleccionar Lotes'` | Etiqueta del campo |

---

## 📊 Estructura de Datos

### Objeto de Lote
```javascript
{
  numero: "10722",      // Número del lote
  proveedor: "ALVIA..." // Nombre del proveedor (opcional)
}
```

### Callback onLotesSelected
```javascript
const handleLotesSelected = (lotes) => {
  // lotes = [
  //   { numero: "10722", proveedor: "ALVIA..." },
  //   { numero: "10723", proveedor: "MENDOZA..." }
  // ]
  
  // Puedes:
  // 1. Guardar en estado
  setLotesSeleccionados(lotes);
  
  // 2. Enviar a backend
  await saveLotes(lotes);
  
  // 3. Validar
  if (lotes.length === 0) {
    alert('Selecciona al menos un lote');
  }
};
```

---

## 🎨 Flujo de Usuario

```
1. Usuario hace clic en "🔍 Buscar Lotes desde API"
   ↓
2. Se abre modal con selector de fecha
   ↓
3. Usuario selecciona fecha y hace clic en "Buscar Movimientos"
   ↓
4. Sistema llama a API con la fecha seleccionada
   ↓
   ┌─────────────────┬──────────────────┐
   │ CASO 1:         │ CASO 2:          │
   │ Hay movimientos │ No hay movimientos│
   └─────────────────┴──────────────────┘
   ↓                   ↓
5a. Se muestran       5b. Mensaje de advertencia
    los lotes             + Sugerencia de continuar
    disponibles           manualmente
   ↓
6. Usuario selecciona lotes (checkbox o botón "Elegir Lote")
   ↓
7. Los lotes aparecen en resumen
   ↓
8. Usuario hace clic en "✓ Confirmar Selección"
   ↓
9. Modal se cierra
   ↓
10. Lotes aparecen como chips verdes en el formulario
    [Lote: 10722 × ALVIA...] [Lote: 10723 × MENDOZA...]
```

---

## 🎭 Casos de Uso

### ✅ Caso 1: Selección Normal
```
Usuario → Busca 03/12/2025 → Encuentra 3 lotes → Selecciona 2 → Confirma
Resultado: 2 lotes seleccionados mostrados como chips
```

### ⚠️ Caso 2: Sin Movimientos
```
Usuario → Busca 16/12/2025 → No hay movimientos → Alerta amarilla
Mensaje: "No se encontraron movimientos para la fecha 2025-12-16"
💡 Puede continuar llenando manualmente
```

### 🗑️ Caso 3: Eliminar Lote
```
Usuario → Hace clic en "×" en chip → Lote eliminado
O
Usuario → Hace clic en "🗑️ Limpiar todos" → Todos eliminados
```

### ✏️ Caso 4: Modificar Selección
```
Usuario → Reabre modal → Deselecciona lotes → Selecciona otros → Confirma
Resultado: Lista actualizada
```

---

## 🔌 Integración con Backend

### Ejemplo con Axios
```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

// En el componente LoteSelectorAPI, línea 28-48
const buscarMovimientos = async () => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/movimientos`,
      {
        params: { fecha }
      }
    );
    
    setMovimientos(response.data);
  } catch (err) {
    console.error('Error:', err);
    setError('Error al conectar con la API');
  }
};
```

### Ejemplo con Fetch (actual)
```javascript
const response = await fetch(`${apiEndpoint}?fecha=${fecha}`);
const data = await response.json();
```

---

## 🎯 Personalización

### Cambiar Colores
Editar `LoteSelectorAPI.css`:

```css
/* Chips de lotes - Cambiar a azul */
.lote-chip {
  background: linear-gradient(135deg, #3498db, #2980b9);
}

/* Botón buscar - Cambiar a naranja */
.btn-buscar {
  background: linear-gradient(135deg, #e67e22, #d35400);
}
```

### Agregar Más Campos al Lote
Modificar estructura en `LoteSelectorAPI.jsx`:

```javascript
toggleLote({
  numero: mov.lote,
  proveedor: mov.proveedor,
  fecha: mov.fecha,        // ← Nuevo
  cantidad: mov.cantidad   // ← Nuevo
});
```

Y mostrar en el chip:
```jsx
<div className="lote-chip">
  <span className="lote-numero">{lote.numero}</span>
  <span className="lote-cantidad">{lote.cantidad} kg</span>
  <button onClick={() => eliminarLote(lote.numero)}>×</button>
</div>
```

---

## 🐛 Troubleshooting

### ❌ Problema: "No se conecta a la API"
**Solución**: Verificar que el endpoint sea correcto y que el servidor esté corriendo.

```javascript
// Verificar en consola
console.log('Endpoint:', `${apiEndpoint}?fecha=${fecha}`);
```

### ❌ Problema: "Error CORS"
**Solución**: Configurar CORS en el backend.

**Backend C#**:
```csharp
builder.Services.AddCors(options => {
    options.AddPolicy("AllowAll", builder => {
        builder.AllowAnyOrigin()
               .AllowAnyMethod()
               .AllowAnyHeader();
    });
});

app.UseCors("AllowAll");
```

### ❌ Problema: "Los lotes no aparecen"
**Solución**: Verificar formato de respuesta de API.

```javascript
// Agregar debug
console.log('Datos recibidos:', data);
console.log('Tipo:', typeof data);
console.log('Es array?:', Array.isArray(data));
```

---

## 📝 To-Do / Mejoras Futuras

- [ ] Agregar paginación para listas largas de movimientos
- [ ] Implementar búsqueda/filtro en la lista de lotes
- [ ] Agregar validación de lotes duplicados
- [ ] Guardar última búsqueda en localStorage
- [ ] Exportar lotes seleccionados a Excel
- [ ] Agregar tooltips con información detallada
- [ ] Modo oscuro

---

## ✅ Testing

### Test Manual
1. ✅ Abrir modal
2. ✅ Buscar fecha con movimientos
3. ✅ Buscar fecha sin movimientos
4. ✅ Seleccionar múltiples lotes
5. ✅ Deseleccionar lotes
6. ✅ Confirmar selección
7. ✅ Eliminar lote individual
8. ✅ Limpiar todos los lotes
9. ✅ Cerrar modal sin confirmar
10. ✅ Responsive en móvil

---

## 📚 Recursos

- **Componente**: `src/components/LoteSelectorAPI.jsx`
- **Estilos**: `src/components/LoteSelectorAPI.css`
- **Ejemplo**: `src/pages/TestLoteSelector.jsx`
- **Estilos ejemplo**: `src/pages/TestLoteSelector.css`

---

## 🎉 ¡Listo para Usar!

El componente está completamente funcional y listo para integrarse en cualquier formulario.

**Próximo paso**: Agregar la ruta en `App.jsx` para acceder a la página de prueba.
