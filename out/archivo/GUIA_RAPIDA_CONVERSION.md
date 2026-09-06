# 🚀 Guía Rápida: Implementar Conversión de Kilogramos

## ✅ Ya Está Todo Listo

He creado un sistema **COMPLETO y SIMPLIFICADO** sin necesidad de Inforbusiness.

---

## 📦 Archivos Creados

### 1. **Backend (Base de Datos)**
- ✅ `Models/FilledForm.cs` - Actualizado con campos `PesoLb` y `PesoKg`
- ✅ `Migrations/AddUnitConversionFields.sql` - Script SQL para migración
- ✅ `Controllers/TemplatesController.cs` - 4 endpoints de versiones

### 2. **Frontend (React)**
- ✅ `src/utils/unitConversion.js` - 12 funciones de conversión
- ✅ `src/services/formService.js` - Servicio simplificado (sin Inforbusiness)
- ✅ `src/components/WeightInput.jsx` - Input con conversión automática
- ✅ `src/components/MultiBatchInput.jsx` - Input de múltiples lotes
- ✅ `src/components/SimpleProductionForm.jsx` - Formulario completo listo para usar

### 3. **Configuración**
- ✅ `.env.example` - Variables de entorno (sin token Inforbusiness)

---

## 🎯 Paso 1: Ejecutar Migración de Base de Datos

### Opción A: SQL Server Management Studio
```sql
1. Abrir SQL Server Management Studio
2. Conectar a tu base de datos
3. Abrir el archivo: Migrations/AddUnitConversionFields.sql
4. Ejecutar (F5)
```

### Opción B: Línea de comandos
```bash
# PowerShell
sqlcmd -S localhost -d FormBuilderDB -i "Migrations\AddUnitConversionFields.sql"
```

**Resultado esperado:**
```
✅ Columna PesoLb agregada
✅ Columna PesoKg agregada
✅ Columna UnidadPeso agregada
✅ Columna Batches agregada
✅ Columna Producto agregada
✅ Funciones de conversión creadas
🎉 ¡Migración completada!
```

---

## 🎯 Paso 2: Configurar Variables de Entorno

```bash
# 1. Copiar archivo de ejemplo
cp .env.example .env

# 2. El archivo .env ya está configurado correctamente
# No necesitas cambiar nada si tu API está en localhost:5074
```

Contenido de `.env`:
```bash
REACT_APP_API_URL=http://localhost:5074/api
REACT_APP_DEFAULT_UNIT=lb
REACT_APP_SHOW_CONVERSION=true
REACT_APP_WEIGHT_DECIMALS=2
```

---

## 🎯 Paso 3: Usar el Componente Listo

### Opción 1: Reemplazar tu formulario existente

En tu `src/App.jsx` o router:

```jsx
import SimpleProductionForm from './components/SimpleProductionForm';

// En tus rutas
<Route path="/fill-form" element={<SimpleProductionForm />} />
```

### Opción 2: Integrar solo el WeightInput en tu formulario actual

En tu `src/pages/FillForm.jsx`:

```jsx
// 1. Importar componentes
import WeightInput from '../components/WeightInput';
import MultiBatchInput from '../components/MultiBatchInput';
import FormService from '../services/formService';

// 2. Agregar estados
const [peso, setPeso] = useState(0);
const [batches, setBatches] = useState('');

// 3. Usar en el JSX
<WeightInput
  value={peso}
  unit="lb"
  label="Peso del Producto"
  onChange={setPeso}
  showConversion={true}  // ← Muestra conversión a kg automáticamente
  required={true}
  min={0}
  max={100000}
/>

<MultiBatchInput
  value={batches}
  label="Lotes de Materia Prima"
  onChange={setBatches}
  placeholder="Ej: LOT001 LOT002 LOT003"
  maxBatches={10}
/>

// 4. Al guardar
const handleSubmit = async (e) => {
  e.preventDefault();
  
  const result = await FormService.saveForm({
    producto: nombreProducto,
    peso: peso,  // En libras
    batches: batches,
    // ... otros campos
  });
  
  if (result.success) {
    alert('✅ Guardado con conversión automática a kg');
  }
};
```

---

## 🎯 Paso 4: Verificar que Funciona

### Prueba Visual

1. **Abrir el formulario** (http://localhost:5173/fill-form)

2. **Ingresar peso:** `100`

3. **Ver conversión automática:**
   ```
   Peso del Producto (Libras) *
   ┌─────────────────────────┐
   │ 100.00           lb     │  ≈ 45.36 kg
   └─────────────────────────┘
   100.00 lb ≈ 45.36 kg
   ```

4. **Guardar formulario**

5. **Verificar en base de datos:**
   ```sql
   SELECT 
       FormID,
       Producto,
       PesoLb,      -- Debe ser 100.00
       PesoKg,      -- Debe ser 45.36
       UnidadPeso,  -- Debe ser 'lb'
       Batches
   FROM FilledForms
   ORDER BY FormID DESC
   ```

---

## 📊 Cómo Ver los Datos Convertidos

### En tu componente ViewForms.jsx:

```jsx
import FormService from '../services/formService';

function ViewForms() {
  const [forms, setForms] = useState([]);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    const result = await FormService.getForms();
    if (result.success) {
      setForms(result.data);
    }
  };

  return (
    <div>
      <h2>Formularios Llenados</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Producto</th>
            <th>Peso (lb)</th>
            <th>Peso (kg)</th>
            <th>Lotes</th>
          </tr>
        </thead>
        <tbody>
          {forms.map(form => (
            <tr key={form.formID}>
              <td>{form.formID}</td>
              <td>{form.producto}</td>
              <td>{form.pesoLb?.toFixed(2)} lb</td>
              <td>{form.pesoKg?.toFixed(2)} kg</td>
              <td>{form.batches}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 📤 Exportar a Inforbusiness (Cuando lo Necesites)

Cuando en el futuro necesites exportar a Inforbusiness:

```jsx
import FormService from '../services/formService';

// Botón de exportación
const handleExport = () => {
  const result = FormService.exportToInforbusinessFormat(forms);
  
  // Esto descarga un archivo JSON con los datos en kilogramos
  alert(`✅ Archivo descargado con ${result.count} registros`);
};

<button onClick={handleExport}>
  📥 Descargar para Inforbusiness (JSON)
</button>
```

El archivo descargado tendrá este formato:
```json
[
  {
    "id": 1,
    "producto": "Harina de Trigo",
    "peso_kg": 45.36,
    "unidad": "kg",
    "lotes": ["LOT001", "LOT002"],
    "fecha": "2025-12-16T10:30:00Z"
  }
]
```

---

## 🧪 Testing Rápido

### Test en Consola del Navegador (F12):

```javascript
// 1. Importar función
import { poundsToKilograms } from './utils/unitConversion';

// 2. Probar conversión
console.log(poundsToKilograms(100));  // Debe mostrar: 45.36
console.log(poundsToKilograms(250));  // Debe mostrar: 113.40
console.log(poundsToKilograms(500));  // Debe mostrar: 226.80

// 3. Probar servicio
import FormService from './services/formService';

FormService.convertWeight(100, 'lb', 'kg', 2);  // Debe retornar: 45.36
FormService.convertWeight(50, 'kg', 'lb', 2);   // Debe retornar: 110.23
```

---

## ✅ Checklist de Verificación

Marca cada item después de completarlo:

- [ ] **SQL Migration ejecutado** - Ver mensaje "✅ Migración completada"
- [ ] **Columnas verificadas en BD** - PesoLb, PesoKg existen en FilledForms
- [ ] **Archivo .env copiado** - De .env.example a .env
- [ ] **Componente importado** - SimpleProductionForm o WeightInput
- [ ] **Formulario abre** - Sin errores en consola
- [ ] **Input muestra conversión** - Badge "≈ XX kg" visible
- [ ] **Datos se guardan** - Verificar en tabla FilledForms
- [ ] **Ambas unidades guardadas** - PesoLb y PesoKg tienen valores
- [ ] **Lotes funcionan** - Batches se guardan correctamente
- [ ] **Exportación probada** - Archivo JSON se descarga

---

## 🚨 Solución de Problemas

### Error: "PesoLb no existe en la tabla"
```bash
✅ Solución: Ejecutar Migrations/AddUnitConversionFields.sql
```

### Error: "Cannot read property 'convertWeight'"
```bash
✅ Solución: Verificar import de FormService
import FormService from '../services/formService';
```

### No se muestra la conversión
```bash
✅ Solución: Verificar prop showConversion={true} en WeightInput
```

### Datos no se guardan
```bash
✅ Solución: Verificar que el backend esté corriendo (dotnet run)
```

---

## 📞 Ayuda Adicional

Si tienes problemas:

1. **Ver consola del navegador** (F12 → Console)
2. **Ver consola del backend** (terminal donde corre dotnet run)
3. **Verificar BD** con las queries de verificación del script SQL

---

## 🎉 ¡Listo!

Ahora tu sistema:
- ✅ Guarda pesos en **Libras** (unidad interna)
- ✅ Convierte automáticamente a **Kilogramos**
- ✅ Muestra **ambas unidades** al usuario
- ✅ Está listo para **exportar a Inforbusiness** cuando lo necesites
- ✅ Soporta **múltiples lotes** por formulario

**No necesitas token de Inforbusiness** - la conversión se hace localmente.

Cuando en el futuro necesites integrar con Inforbusiness, solo:
1. Obtener token de API
2. Actualizar `inforbusinessService.js` con la URL real
3. Usar `InforbusinessService.exportForm()` en lugar de descargar JSON
