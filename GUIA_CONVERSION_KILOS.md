# 🔄 Guía de Conversión: Libras → Kilogramos para Inforbusiness

## 📋 Contexto del Problema

**Situación Actual:**
- ✅ El sistema interno carga datos en **Libras (lb)**
- ❌ El sistema externo **"Inforbusiness"** usa **Kilogramos (kg)**
- ⚠️ Se necesita conversión automática para integración

**Factor de Conversión:**
```
1 Libra (lb) = 0.453592 Kilogramos (kg)
1 Kilogramo (kg) = 2.20462 Libras (lb)
```

---

## ✅ Solución Implementada

Ya creamos un sistema completo de conversión en:

### Archivos Creados:
1. **`src/utils/unitConversion.js`** - 12 funciones de conversión
2. **`src/components/WeightInput.jsx`** - Componente con conversión visual
3. **`src/components/WeightInput.css`** - Estilos

### Funciones Disponibles:

```javascript
// 1. Conversión básica
poundsToKilograms(100)  // → 45.36 kg
kilogramsToPounds(50)   // → 110.23 lb

// 2. Para Inforbusiness (ESPECÍFICO)
toInforbusinessFormat(100)    // → 45.36 kg (para exportar)
fromInforbusinessFormat(50)   // → 110.23 lb (para importar)

// 3. Display dual
showBothUnits(100, 'lb', 'kg')  // → "100.00 lb ≈ 45.36 kg"

// 4. Validación
validateWeight(value, min, max)  // → {isValid: true/false, error: null/string}
```

---

## 🚀 Paso 1: Agregar Input con Conversión en Formularios

### Opción A: Input Simple (Recomendado)

**Archivo:** `src/pages/FillForm.jsx` o donde necesites peso

```jsx
import WeightInput from '../components/WeightInput';
import { toInforbusinessFormat } from '../utils/unitConversion';

function FillForm() {
  const [formData, setFormData] = useState({
    producto: '',
    peso: 0,  // En libras
    // ... otros campos
  });

  const handleWeightChange = (value) => {
    setFormData(prev => ({
      ...prev,
      peso: value  // Guardado en libras
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Al guardar, convertir para Inforbusiness
    const dataParaGuardar = {
      ...formData,
      pesoLb: formData.peso,           // Original en lb
      pesoKg: toInforbusinessFormat(formData.peso)  // Convertido a kg
    };

    // Guardar en tu API
    const response = await fetch('http://localhost:5074/api/FilledForms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataParaGuardar)
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... otros campos ... */}
      
      <WeightInput
        value={formData.peso}
        unit="lb"
        label="Peso del Producto"
        onChange={handleWeightChange}
        showConversion={true}  // Muestra "≈ 45.36 kg" automáticamente
        required={true}
        min={0}
        max={10000}
        decimals={2}
      />
      
      {/* El usuario verá:
          Peso del Producto *
          ┌─────────────────┐
          │ 100.00      lb  │ ≈ 45.36 kg
          └─────────────────┘
          100.00 lb ≈ 45.36 kg
      */}
      
      <button type="submit">Guardar</button>
    </form>
  );
}
```

### Opción B: Con Toggle de Unidades

```jsx
import WeightInput, { UnitToggle, ConversionInfo } from '../components/WeightInput';

function FillForm() {
  const [displayUnit, setDisplayUnit] = useState('lb'); // 'lb' o 'kg'
  const [peso, setPeso] = useState(0);

  return (
    <form>
      {/* Banner informativo */}
      <ConversionInfo />
      
      {/* Toggle para cambiar entre lb y kg */}
      <UnitToggle 
        currentUnit={displayUnit}
        onToggle={setDisplayUnit}
      />
      
      {/* Input que respeta la unidad seleccionada */}
      <WeightInput
        value={peso}
        unit={displayUnit}
        label="Peso"
        onChange={setPeso}
        showConversion={true}
      />
    </form>
  );
}
```

---

## 📤 Paso 2: Exportar a Inforbusiness

### Ejemplo: Botón de Exportación

```jsx
import { toInforbusinessFormat } from '../utils/unitConversion';

function ViewForms() {
  const [forms, setForms] = useState([]);

  const exportToInforbusiness = async (form) => {
    // Convertir todos los pesos a kilogramos
    const dataParaInforbusiness = {
      id: form.formID,
      producto: form.producto,
      peso: toInforbusinessFormat(form.peso),  // lb → kg
      unidad: 'kg',
      fecha: form.createdAt,
      // ... otros campos
    };

    try {
      // Enviar a API de Inforbusiness
      const response = await fetch('https://inforbusiness.api/registros', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_TOKEN_HERE'
        },
        body: JSON.stringify(dataParaInforbusiness)
      });

      if (response.ok) {
        alert('✅ Datos exportados a Inforbusiness correctamente');
      } else {
        alert('❌ Error al exportar');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error de conexión con Inforbusiness');
    }
  };

  return (
    <div>
      <h2>Formularios Llenados</h2>
      
      {forms.map(form => (
        <div key={form.formID} className="form-card">
          <h3>{form.producto}</h3>
          <p>Peso: {form.peso} lb</p>
          
          <button onClick={() => exportToInforbusiness(form)}>
            📤 Exportar a Inforbusiness
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Exportación Masiva

```jsx
import { toInforbusinessFormat } from '../utils/unitConversion';

const exportAllToInforbusiness = async (forms) => {
  const convertedData = forms.map(form => ({
    ...form,
    peso: toInforbusinessFormat(form.peso),  // Convertir cada peso
    unidad: 'kg'
  }));

  const response = await fetch('https://inforbusiness.api/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ registros: convertedData })
  });

  return response.json();
};
```

---

## 📥 Paso 3: Importar desde Inforbusiness

### Ejemplo: Importar datos en kg y convertir a lb

```jsx
import { fromInforbusinessFormat } from '../utils/unitConversion';

const importFromInforbusiness = async (recordId) => {
  try {
    // Obtener datos de Inforbusiness
    const response = await fetch(`https://inforbusiness.api/registros/${recordId}`);
    const data = await response.json();

    // Convertir kg → lb para sistema interno
    const dataParaSistemaInterno = {
      producto: data.producto,
      peso: fromInforbusinessFormat(data.peso),  // kg → lb
      unidad: 'lb',
      fecha: data.fecha,
      // ... otros campos
    };

    // Guardar en sistema interno
    await fetch('http://localhost:5074/api/FilledForms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataParaSistemaInterno)
    });

    alert('✅ Datos importados y convertidos correctamente');
  } catch (error) {
    console.error('Error al importar:', error);
    alert('❌ Error al importar desde Inforbusiness');
  }
};
```

---

## 🗄️ Paso 4: Actualizar Modelo de Base de Datos

### Agregar campos de peso en ambas unidades

**Archivo:** `Models/FilledForm.cs`

```csharp
public class FilledForm
{
    // ... campos existentes ...
    
    // Peso en libras (unidad del sistema)
    public decimal? PesoLb { get; set; }
    
    // Peso en kilogramos (para Inforbusiness)
    public decimal? PesoKg { get; set; }
    
    [MaxLength(10)]
    public string? UnidadPeso { get; set; } = "lb";
    
    // Propiedad calculada (opcional)
    [NotMapped]
    public decimal PesoKgCalculado => PesoLb.HasValue 
        ? PesoLb.Value * 0.453592m 
        : 0;
}
```

### Migración

```bash
# PowerShell
cd FormBuilder.API
dotnet ef migrations add AddPesoFields
dotnet ef database update
```

---

## 📊 Paso 5: Mostrar Conversión en Tablas

### Ejemplo: Tabla con ambas unidades

```jsx
import { WeightComparisonTable } from '../components/WeightInput';

function ReportView({ forms }) {
  const weights = forms.map(form => ({
    description: form.producto,
    value: form.peso,
    unit: 'lb'
  }));

  return (
    <div>
      <h2>Reporte de Pesos</h2>
      <WeightComparisonTable weights={weights} />
      {/* 
        Muestra tabla:
        ┌──────────────┬──────────┬─────────┐
        │ Descripción  │ Libras   │ Kilos   │
        ├──────────────┼──────────┼─────────┤
        │ Producto A   │ 100.00lb │  45.36kg│
        │ Producto B   │ 250.00lb │ 113.40kg│
        └──────────────┴──────────┴─────────┘
      */}
    </div>
  );
}
```

---

## 🔧 Paso 6: Crear Servicio de Integración

### Archivo: `src/services/inforbusinessService.js`

```javascript
import { toInforbusinessFormat, fromInforbusinessFormat } from '../utils/unitConversion';

const INFORBUSINESS_API = 'https://inforbusiness.api';
const API_TOKEN = process.env.REACT_APP_INFORBUSINESS_TOKEN;

export const InforbusinessService = {
  /**
   * Exportar un formulario a Inforbusiness
   */
  async exportForm(form) {
    const payload = {
      id: form.formID,
      producto: form.producto,
      peso: toInforbusinessFormat(form.peso),  // lb → kg
      unidad: 'kg',
      fecha: new Date(form.createdAt).toISOString(),
      lotes: form.batches?.split(' ') || [],
      // ... otros campos según API de Inforbusiness
    };

    const response = await fetch(`${INFORBUSINESS_API}/registros`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${await response.text()}`);
    }

    return response.json();
  },

  /**
   * Importar un registro de Inforbusiness
   */
  async importRecord(recordId) {
    const response = await fetch(`${INFORBUSINESS_API}/registros/${recordId}`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    // Convertir kg → lb
    return {
      producto: data.producto,
      peso: fromInforbusinessFormat(data.peso),  // kg → lb
      unidad: 'lb',
      fecha: data.fecha,
      lotes: data.lotes?.join(' ') || '',
    };
  },

  /**
   * Sincronizar formularios con Inforbusiness
   */
  async syncAll(forms) {
    const results = {
      success: [],
      errors: []
    };

    for (const form of forms) {
      try {
        await this.exportForm(form);
        results.success.push(form.formID);
      } catch (error) {
        results.errors.push({
          formID: form.formID,
          error: error.message
        });
      }
    }

    return results;
  }
};
```

### Uso del Servicio:

```jsx
import { InforbusinessService } from '../services/inforbusinessService';

function FormActions({ form }) {
  const handleExport = async () => {
    try {
      const result = await InforbusinessService.exportForm(form);
      alert(`✅ Exportado con ID: ${result.id}`);
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  return (
    <button onClick={handleExport}>
      📤 Exportar a Inforbusiness
    </button>
  );
}
```

---

## 🧪 Paso 7: Testing de Conversión

### Test Manual

```javascript
import { 
  poundsToKilograms, 
  toInforbusinessFormat,
  fromInforbusinessFormat 
} from '../utils/unitConversion';

// Test 1: Conversión básica
console.log('Test 1:', poundsToKilograms(100));  // Esperado: 45.36

// Test 2: Exportar a Inforbusiness
const pesoEnLibras = 250;
const pesoParaInforbusiness = toInforbusinessFormat(pesoEnLibras);
console.log('Test 2:', pesoParaInforbusiness);  // Esperado: 113.40

// Test 3: Importar de Inforbusiness
const pesoDesdeInforbusiness = 50; // kg
const pesoEnSistema = fromInforbusinessFormat(pesoDesdeInforbusiness);
console.log('Test 3:', pesoEnSistema);  // Esperado: 110.23

// Test 4: Round trip (ida y vuelta)
const original = 100;
const convertido = toInforbusinessFormat(original);
const devuelta = fromInforbusinessFormat(convertido);
console.log('Test 4:', Math.abs(original - devuelta) < 0.01);  // Esperado: true
```

### Test Automatizado

```javascript
describe('Unit Conversion Tests', () => {
  test('Convertir 100 lb a kg', () => {
    expect(poundsToKilograms(100)).toBeCloseTo(45.36, 2);
  });

  test('Convertir 50 kg a lb', () => {
    expect(kilogramsToPounds(50)).toBeCloseTo(110.23, 2);
  });

  test('Round trip conversion', () => {
    const original = 100;
    const kg = toInforbusinessFormat(original);
    const backToLb = fromInforbusinessFormat(kg);
    expect(backToLb).toBeCloseTo(original, 2);
  });
});
```

---

## 📋 Checklist de Implementación

- [ ] **Componente WeightInput agregado** a formularios
- [ ] **Conversión automática visible** (badge "≈ XX kg")
- [ ] **Función de exportación** a Inforbusiness implementada
- [ ] **Función de importación** desde Inforbusiness implementada
- [ ] **Base de datos actualizada** con campos PesoLb y PesoKg
- [ ] **Servicio de integración** creado (inforbusinessService.js)
- [ ] **Testing de conversiones** realizado
- [ ] **Validación de precisión** (2 decimales)
- [ ] **Manejo de errores** en exportación/importación
- [ ] **Documentación de API** de Inforbusiness obtenida
- [ ] **Token de autenticación** configurado
- [ ] **Sincronización masiva** probada
- [ ] **Log de conversiones** implementado
- [ ] **Usuario capacitado** sobre nueva funcionalidad

---

## 🎯 Resumen Rápido

### Para Agregar Input con Conversión:
```jsx
import WeightInput from '../components/WeightInput';

<WeightInput
  value={peso}
  unit="lb"
  onChange={setPeso}
  showConversion={true}  // ← Muestra conversión automática
/>
```

### Para Exportar a Inforbusiness:
```javascript
import { toInforbusinessFormat } from '../utils/unitConversion';

const pesoEnKg = toInforbusinessFormat(form.peso);  // lb → kg
```

### Para Importar de Inforbusiness:
```javascript
import { fromInforbusinessFormat } from '../utils/unitConversion';

const pesoEnLb = fromInforbusinessFormat(data.peso);  // kg → lb
```

---

## 📞 Soporte

Si necesitas ayuda adicional:
1. Ver `GUIA_USO_COMPONENTES.md` - Ejemplos completos
2. Ver `src/utils/unitConversion.js` - Todas las funciones disponibles
3. Ver `src/components/WeightInput.jsx` - Componente completo

**¡Todo listo para integrar con Inforbusiness! 🎉**
