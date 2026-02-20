# 📋 Sistema de Gestión de Firmas - Guía Completa

## 🎯 Resumen del Sistema

El sistema tiene **DOS fuentes** para autocompletar puestos al crear templates:

### 1️⃣ **Catálogo de Firmas** (Gestión Manual)
- **Ruta**: `/catalogo-firmas`
- **Acceso**: Solo Admin y Supervisor
- **API**: `/api/CatalogoFirmas`
- **Base de datos**: Tabla `CatalogoFirmas`

### 2️⃣ **Puestos de Templates Existentes** (Automático)
- **API**: `/api/Signatures/puestos`
- **Fuente**: Extrae puestos de todos los templates ya creados
- **Ventaja**: Siempre actualizado con lo que ya existe

---

## 🚀 ¿Cómo Funciona?

### Flujo de Trabajo:

```
┌─────────────────────────────────────────────────────────────┐
│  1. AGREGAR NUEVOS PUESTOS (Catálogo de Firmas)            │
│     /catalogo-firmas                                        │
│     - Agregar "Supervisor de Calidad"                      │
│     - Agregar "Jefe de Turno"                              │
│     - Agregar "Gerente de Planta"                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. CREAR TEMPLATE (Usar puestos del catálogo)             │
│     /create-template                                        │
│     - Al agregar firma, seleccionar del catálogo           │
│     - O usar puestos de templates anteriores               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. API NO AFECTADA                                         │
│     - API Lotes: Sigue funcionando igual                   │
│     - API Catálogos: Sigue funcionando igual               │
│     - Solo es ayuda visual para llenar el campo "Puesto"   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📖 Guía de Uso

### **Paso 1: Agregar Nuevas Firmas al Catálogo**

1. Navega a **"📋 Catálogo Firmas"** (solo visible para admin/supervisor)
2. Completa el formulario:
   - **Puesto**: Ej: "Supervisor de Calidad" (requerido)
   - **Nombre Completo**: Ej: "Juan Pérez García" (opcional)
   - **Área**: Ej: "Producción" (opcional)
   - **Activo**: ✅ (checkbox)
3. Click en **"➕ Agregar"**

### **Paso 2: Crear Template con Firmas**

1. Navega a **"➕ Crear Plantilla"**
2. Llena la información general
3. En la sección **"Firmas"**, click en **"+ Agregar Firma"**
4. En el campo **"Puesto"**:
   - **Opción A**: Escribe manualmente
   - **Opción B**: Selecciona del dropdown "💡 O selecciona del catálogo..."
   - **Opción C**: Selecciona del dropdown "💡 O selecciona de puestos existentes..."

5. El selector se **auto-resetea** después de elegir
6. Las APIs de Lotes y Catálogos **NO se ven afectadas**

### **Paso 3: Gestionar el Catálogo**

En `/catalogo-firmas` puedes:
- ✏️ **Editar** una firma existente
- ✅/❌ **Activar/Desactivar** (click en el badge de estado)
- 🗑️ **Eliminar** (desactiva la firma)

---

## 🔧 Características Técnicas

### **Backend**

#### Tabla: `CatalogoFirmas`
```sql
CREATE TABLE [CatalogoFirmas] (
    [CatalogoFirmaID] int IDENTITY(1,1) PRIMARY KEY,
    [Puesto] nvarchar(100) NOT NULL,
    [NombreCompleto] nvarchar(200) NULL,
    [Area] nvarchar(100) NULL,
    [Activo] bit NOT NULL DEFAULT 1,
    [FechaCreacion] datetime2 NOT NULL
);
```

#### Endpoints

**GET /api/CatalogoFirmas?soloActivos={true/false}**
- Obtiene todas las firmas del catálogo
- `soloActivos=true`: Solo activas (default)
- `soloActivos=false`: Todas

**GET /api/CatalogoFirmas/{id}**
- Obtiene una firma por ID

**POST /api/CatalogoFirmas**
```json
{
  "puesto": "Supervisor de Calidad",
  "nombreCompleto": "Juan Pérez",
  "area": "Producción",
  "activo": true
}
```

**PUT /api/CatalogoFirmas/{id}**
- Actualiza una firma existente

**DELETE /api/CatalogoFirmas/{id}**
- Soft delete (marca como `Activo = false`)

---

**GET /api/Signatures/puestos?search={texto}**
- Extrae puestos únicos de templates existentes
- Soporta búsqueda por texto
- Retorna máximo 50 resultados

Respuesta:
```json
[
  {
    "puesto": "Supervisor de Calidad",
    "nombreCompleto": "Juan Pérez"
  },
  {
    "puesto": "Jefe de Turno",
    "nombreCompleto": null
  }
]
```

---

### **Frontend**

#### CreateTemplate.jsx - Integración

```jsx
// Estado
const [puestosDisponibles, setPuestosDisponibles] = useState([]);

// Carga automática
useEffect(() => {
  const fetchPuestos = async () => {
    const response = await fetch(`${API_BASE_URL}/Signatures/puestos`);
    if (response.ok) {
      const data = await response.json();
      setPuestosDisponibles(data);
    }
  };
  fetchPuestos();
}, []);

// Selector en campo Puesto
<div className="form-group">
  <label>Puesto *</label>
  <input 
    type="text" 
    value={firma.puesto} 
    onChange={(e) => updateFirma(index, "puesto", e.target.value)} 
    placeholder="Ej: Supervisor de Calidad"
  />
  
  {/* Selector del catálogo */}
  {puestosDisponibles.length > 0 && (
    <select onChange={(e) => {
      if (e.target.value) {
        const selected = puestosDisponibles.find(p => 
          p.puesto === e.target.value
        );
        if (selected) {
          updateFirma(index, "puesto", selected.puesto);
          if (selected.nombreCompleto) {
            updateFirma(index, "nombreCompleto", selected.nombreCompleto);
          }
        }
        e.target.value = ""; // Auto-reset
      }
    }}>
      <option value="">💡 O selecciona de puestos existentes...</option>
      {puestosDisponibles.map((p, i) => (
        <option key={i} value={p.puesto}>
          {p.puesto}{p.nombreCompleto ? ` - ${p.nombreCompleto}` : ''}
        </option>
      ))}
    </select>
  )}
</div>
```

#### CatalogoFirmas.jsx - Gestión

- **Formulario**: Agregar/Editar firmas
- **Tabla**: Listar todas las firmas
- **Acciones**: Editar, Activar/Desactivar, Eliminar
- **Validación**: Error handling para APIs

---

## 🔒 Independencia de APIs

### ✅ **NO Afecta:**

1. **API Lotes** (`🔄 API Lotes`)
   - Dropdown de campos de Movimientos
   - Sigue funcionando igual
   - No se modifica

2. **API Catálogos** (`📚 API Catálogos`)
   - Dropdown de opciones externas
   - Sigue funcionando igual
   - No se modifica

3. **Guardado de Templates**
   - El JSON de `Firmas` se guarda igual
   - No cambia estructura
   - Compatible con versiones anteriores

4. **Llenado de Formularios**
   - FilledForms no se ve afectado
   - Firmas funcionan igual
   - No requiere cambios

### ✅ **Solo Ayuda a:**

- Autocompletar el campo de texto "Puesto"
- Autocompletar el campo de texto "Nombre Completo"
- Evitar errores de tipeo
- Mantener consistencia en nombres

---

## 📊 Ejemplo Práctico

### Escenario: Agregar 5 firmantes comunes

#### 1. Ir a Catálogo de Firmas
```
/catalogo-firmas
```

#### 2. Agregar uno por uno:

| Puesto | Nombre Completo | Área |
|--------|----------------|------|
| Supervisor de Calidad | Juan Pérez | Calidad |
| Jefe de Turno | María García | Producción |
| Gerente de Planta | Carlos López | Administración |
| Asistente de Cámara | Ana Martínez | Cámaras |
| Operador de Línea | Luis Rodríguez | Producción |

#### 3. Crear Template
Al agregar firmas, ahora puedes seleccionar rápidamente:
- ✅ Supervisor de Calidad - Juan Pérez
- ✅ Jefe de Turno - María García
- etc.

#### 4. Resultado
- ⚡ Más rápido
- ✅ Sin errores de tipeo
- 📝 Consistente en todos los templates

---

## ⚠️ Notas Importantes

1. **Rol Requerido**: Solo Admin y Supervisor pueden gestionar el catálogo
2. **Soft Delete**: Al "eliminar" solo marca como inactivo
3. **Auto-Reset**: El selector se resetea automáticamente después de elegir
4. **Múltiples Fuentes**: Puedes usar catálogo O puestos de templates existentes
5. **API Independiente**: No interfiere con API Lotes ni API Catálogos

---

## 🐛 Solución de Problemas

### Problema: "firmas.map is not a function"
**Solución**: El backend no está corriendo o la tabla no existe.
```powershell
cd backend-frigo
dotnet ef database update
dotnet run
```

### Problema: No aparecen opciones en el selector
**Solución**: Verifica que el backend esté corriendo y la API responda:
```
http://localhost:7278/api/CatalogoFirmas
http://localhost:7278/api/Signatures/puestos
```

### Problema: Error 404 en /catalogo-firmas
**Solución**: Verifica que la ruta esté agregada en App.jsx

---

## 📝 Resumen

✅ **Sistema de 2 fuentes para puestos:**
1. Catálogo manual (gestión activa)
2. Templates existentes (automático)

✅ **Independiente de APIs:**
- No afecta API Lotes
- No afecta API Catálogos
- Solo ayuda visual

✅ **Acceso controlado:**
- Solo admin/supervisor pueden gestionar
- Todos pueden ver al crear templates

✅ **Funcionalidades:**
- Agregar, editar, activar/desactivar
- Autocompletar en CreateTemplate
- Consistencia en nombres
