# API de Búsqueda de Puestos - Firmas

## 📋 Resumen

Se agregó un **nuevo endpoint en la API de Signatures** para obtener los puestos únicos de las firmas existentes en todos los templates. Esto permite **autocompletar puestos** al crear nuevas plantillas, basándose en los puestos que ya se han usado anteriormente.

---

## 🚀 Cambios Realizados

### 1. Backend - SignaturesController.cs

#### Nuevo Endpoint: `GET /api/Signatures/puestos`

**Ubicación:** `backend-frigo/Controllers/SignaturesController.cs`

**Características:**
- Extrae todos los puestos únicos de las firmas en los templates
- Soporta búsqueda opcional con parámetro `?search=texto`
- Retorna máximo 50 resultados
- Elimina duplicados (case-insensitive)

**Ejemplo de Uso:**

```http
# Obtener todos los puestos
GET /api/Signatures/puestos

# Buscar puestos que contengan "supervisor"
GET /api/Signatures/puestos?search=supervisor
```

**Respuesta:**

```json
[
  {
    "puesto": "Supervisor de Calidad",
    "nombreCompleto": "Juan Pérez"
  },
  {
    "puesto": "Jefe de Turno",
    "nombreCompleto": "María García"
  },
  {
    "puesto": "Gerente de Planta",
    "nombreCompleto": null
  }
]
```

#### Clases Auxiliares Agregadas:

```csharp
public class FirmaTemplate
{
    public string Puesto { get; set; } = string.Empty;
    public string? NombreCompleto { get; set; }
}

public class PuestoInfo
{
    public string Puesto { get; set; } = string.Empty;
    public string? NombreCompleto { get; set; }
}

public class PuestoInfoComparer : IEqualityComparer<PuestoInfo>
{
    // Compara puestos por nombre (case-insensitive)
}
```

---

### 2. Frontend - CreateTemplate.jsx

#### Estado Agregado:

```jsx
const [puestosDisponibles, setPuestosDisponibles] = useState([]);
const [loadingPuestos, setLoadingPuestos] = useState(false);
```

#### useEffect para Cargar Puestos:

```jsx
useEffect(() => {
  const fetchPuestos = async () => {
    setLoadingPuestos(true);
    try {
      const response = await fetch(`${API_BASE_URL}/Signatures/puestos`);
      if (response.ok) {
        const data = await response.json();
        setPuestosDisponibles(data);
        console.log("✅ Puestos cargados desde API:", data);
      }
    } catch (error) {
      console.error("Error al cargar puestos:", error);
    } finally {
      setLoadingPuestos(false);
    }
  };
  fetchPuestos();
}, []);
```

#### Selector de Puestos Actualizado:

```jsx
<div className="form-group">
  <label>Puesto *</label>
  <input 
    type="text" 
    value={firma.puesto} 
    onChange={(e) => updateFirma(index, "puesto", e.target.value)} 
    placeholder="Ej: Supervisor de Calidad"
  />
  
  {/* ✅ Selector desde API de Signatures */}
  {puestosDisponibles.length > 0 && (
    <div style={{ marginTop: '8px' }}>
      <select 
        onChange={(e) => {
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
            e.target.value = ""; // Resetear
          }
        }}
        style={{
          width: '100%',
          padding: '8px',
          border: '1px solid #3b82f6',
          borderRadius: '4px',
          fontSize: '13px',
          background: '#eff6ff',
          color: '#1e40af'
        }}
      >
        <option value="">💡 O selecciona de puestos existentes...</option>
        {puestosDisponibles.map((p, i) => (
          <option key={i} value={p.puesto}>
            {p.puesto}{p.nombreCompleto ? ` - ${p.nombreCompleto}` : ''}
          </option>
        ))}
      </select>
    </div>
  )}
</div>
```

---

## 🎯 Funcionalidad

### ¿Cómo Funciona?

1. **Al cargar CreateTemplate.jsx**: Se hace una petición a `/api/Signatures/puestos`
2. **El endpoint**: 
   - Lee todos los templates de la BD
   - Parsea el JSON de `Firmas` de cada template
   - Extrae puestos únicos
   - Los ordena alfabéticamente
3. **En el selector**:
   - El usuario puede escribir manualmente el puesto
   - O seleccionar de la lista de puestos existentes
   - Al seleccionar, se auto-rellena el campo "Puesto" (y "Nombre Completo" si existe)
   - El selector se resetea automáticamente

### ¿Qué NO Afecta?

- ✅ **API Lotes**: Sigue funcionando igual
- ✅ **API Catálogos**: Sigue funcionando igual
- ✅ **Guardado de templates**: No se modifica
- ✅ **Llenado de formularios**: No se modifica

---

## 🔧 Independencia de la API

### Antes (Sistema de Catálogo):
- Tabla separada `CatalogoFirmas`
- Gestión manual de puestos
- Interfaz de administración

### Ahora (API de Búsqueda):
- Lee directamente de templates existentes
- No requiere gestión manual
- Auto-actualiza al crear nuevos templates
- **Más simple y automático**

---

## ✅ Beneficios

1. **Consistencia**: Los puestos se reutilizan de templates anteriores
2. **Autocompletado**: No hay que escribir el puesto completo cada vez
3. **Sin Duplicados**: El sistema elimina puestos duplicados automáticamente
4. **Búsqueda**: Se puede filtrar por texto (ej: "supervisor")
5. **Independiente**: No afecta la funcionalidad de las APIs existentes
6. **Sin BD Extra**: No requiere tabla separada, usa los templates existentes

---

## 🧪 Pruebas Recomendadas

1. **Crear un template con firmas nuevas**
   - Verificar que los puestos se guardan correctamente
   
2. **Crear otro template**
   - Verificar que aparecen los puestos del template anterior en el selector
   
3. **Probar búsqueda**
   - `GET /api/Signatures/puestos?search=super`
   - Debe retornar solo puestos que contengan "super"

4. **Verificar API Lotes y API Catálogos**
   - Confirmar que siguen funcionando normalmente
   - No deben verse afectados por el nuevo selector

---

## 📝 Notas Técnicas

- **Performance**: Máximo 50 resultados por consulta
- **Cache**: Se carga una vez al montar el componente
- **Comparación**: Case-insensitive (SUPERVISOR = supervisor)
- **Formato JSON**: Compatible con estructura actual de Firmas
- **Error Handling**: Si falla la carga, el input manual sigue disponible

---

## 🔄 Próximos Pasos

1. ✅ Backend implementado
2. ✅ Frontend integrado
3. ⏳ Probar en desarrollo
4. ⏳ Verificar que no afecta APIs existentes
5. ⏳ Desplegar a producción
