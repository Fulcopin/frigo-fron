# 🔧 Guía de Uso: Nuevos Componentes de Producción

## 📦 Componentes Creados

### 1️⃣ Sistema de Conversión de Unidades (Libras ↔ Kilogramos)

**Archivos:**
- `src/utils/unitConversion.js` - Utilidades de conversión
- `src/components/WeightInput.jsx` - Componente de input con conversión automática
- `src/components/WeightInput.css` - Estilos

**Funcionalidad:**
- Conversión automática entre libras (lb) y kilogramos (kg)
- Display dual de ambas unidades
- Integración con sistema Inforbusiness
- Validación de entrada
- Formato automático de números

### 2️⃣ Sistema Multi-Batch (Múltiples Lotes)

**Archivos:**
- `src/components/MultiBatchInput.jsx` - Componente de entrada múltiple
- `src/components/MultiBatchInput.css` - Estilos

**Funcionalidad:**
- Entrada de múltiples lotes separados por espacios
- Validación individual de cada lote
- Display como chips interactivos
- Prevención de duplicados
- Límite configurable de lotes

---

## 🚀 Guía de Implementación

### A) Integrar WeightInput en Formularios

#### Ejemplo 1: Input simple con conversión

```jsx
import WeightInput from '../components/WeightInput';

function ProductionForm() {
  const [weight, setWeight] = useState(0);
  const [unit, setUnit] = useState('lb');

  const handleWeightChange = (value, selectedUnit) => {
    setWeight(value);
    setUnit(selectedUnit);
  };

  return (
    <div>
      <WeightInput
        value={weight}
        unit="lb"
        label="Peso del Producto"
        onChange={handleWeightChange}
        showConversion={true}
        required={true}
        min={0}
        max={1000}
        decimals={2}
      />
    </div>
  );
}
```

**Output:** 
```
Peso del Producto *
┌─────────────────────┐
│ 100.00         lb   │  ≈ 45.36 kg
└─────────────────────┘
100.00 lb ≈ 45.36 kg
```

#### Ejemplo 2: Toggle de unidades

```jsx
import WeightInput, { UnitToggle } from '../components/WeightInput';

function ProductionForm() {
  const [weight, setWeight] = useState(0);
  const [displayUnit, setDisplayUnit] = useState('lb');

  return (
    <div>
      <UnitToggle 
        currentUnit={displayUnit} 
        onToggle={setDisplayUnit} 
      />
      
      <WeightInput
        value={weight}
        unit={displayUnit}
        label="Peso Total"
        onChange={(val) => setWeight(val)}
        showConversion={true}
      />
    </div>
  );
}
```

#### Ejemplo 3: Display de solo lectura

```jsx
import { WeightDisplay } from '../components/WeightInput';

function FormSummary({ formData }) {
  return (
    <div>
      <h3>Resumen</h3>
      <WeightDisplay 
        value={formData.weight} 
        unit="lb" 
        showBoth={true} 
        decimals={2}
      />
    </div>
  );
}
```

**Output:**
```
10.50 lb
≈ 4.76 kg
```

#### Ejemplo 4: Tabla comparativa

```jsx
import { WeightComparisonTable } from '../components/WeightInput';

function ReportView() {
  const weights = [
    { description: 'Materia Prima', value: 500, unit: 'lb' },
    { description: 'Producto Final', value: 450, unit: 'lb' },
    { description: 'Desperdicio', value: 50, unit: 'lb' },
  ];

  return (
    <WeightComparisonTable weights={weights} />
  );
}
```

**Output:**
```
┌────────────────┬──────────┬─────────┐
│ Descripción    │ Libras   │ Kilos   │
├────────────────┼──────────┼─────────┤
│ Materia Prima  │ 500.00lb │ 226.80kg│
│ Producto Final │ 450.00lb │ 204.12kg│
│ Desperdicio    │  50.00lb │  22.68kg│
└────────────────┴──────────┴─────────┘
```

---

### B) Integrar MultiBatchInput en Formularios

#### Ejemplo 1: Input básico

```jsx
import MultiBatchInput from '../components/MultiBatchInput';

function ProductionForm() {
  const [batches, setBatches] = useState('');

  const handleBatchChange = (batchString, batchArray) => {
    setBatches(batchString);
    console.log('Lotes:', batchArray);
  };

  return (
    <MultiBatchInput
      value={batches}
      label="Lotes de Materia Prima"
      onChange={handleBatchChange}
      placeholder="Ej: LOT001 LOT002 LOT003"
      required={true}
      maxBatches={10}
    />
  );
}
```

**Output:**
```
Lotes de Materia Prima *          3 / 10 lotes
┌────────────────────────────────────────────────┐
│ [✓ LOT001] [✓ LOT002] [✓ LOT003] [cursor]     │
└────────────────────────────────────────────────┘
💡 Presiona Espacio o Enter para agregar un lote
```

#### Ejemplo 2: Con validación personalizada

```jsx
import MultiBatchInput from '../components/MultiBatchInput';

function ProductionForm() {
  const [batches, setBatches] = useState('');

  // Validador personalizado
  const validateBatch = (batch) => {
    // Verificar formato: LOT + 3 dígitos
    const regex = /^LOT\d{3}$/;
    
    if (!regex.test(batch)) {
      return {
        isValid: false,
        error: 'Formato debe ser LOT###'
      };
    }

    // Aquí podrías hacer una llamada API para verificar existencia
    // Por ahora, simulamos
    const exists = batch !== 'LOT999'; // LOT999 no existe
    
    return {
      isValid: true,
      exists: exists,
      error: exists ? null : 'Lote no encontrado en sistema'
    };
  };

  const handleValidation = (results) => {
    console.log('Resultados validación:', results);
    // results = { LOT001: {isValid: true, exists: true}, ... }
  };

  return (
    <MultiBatchInput
      value={batches}
      label="Lotes de Materia Prima"
      onChange={setBatches}
      validateBatch={validateBatch}
      onValidate={handleValidation}
      allowDuplicates={false}
      maxBatches={5}
    />
  );
}
```

#### Ejemplo 3: Display de solo lectura

```jsx
import { BatchListDisplay } from '../components/MultiBatchInput';

function FormSummary({ formData }) {
  return (
    <div>
      <h3>Lotes Utilizados</h3>
      
      {/* Variante chips (default) */}
      <BatchListDisplay 
        batches={formData.batches} 
        variant="chips" 
      />

      {/* Variante lista */}
      <BatchListDisplay 
        batches="LOT001 LOT002 LOT003" 
        variant="list" 
      />

      {/* Variante inline */}
      <BatchListDisplay 
        batches={['LOT001', 'LOT002']} 
        variant="inline" 
      />
    </div>
  );
}
```

#### Ejemplo 4: Estadísticas de lotes

```jsx
import { BatchStats } from '../components/MultiBatchInput';

function DashboardView() {
  const forms = [
    { batches: 'LOT001 LOT002' },
    { batches: 'LOT001 LOT003' },
    { batches: 'LOT002 LOT004' },
    { batches: 'LOT001 LOT005' },
  ];

  return (
    <BatchStats forms={forms} />
  );
}
```

**Output:**
```
┌─────────────────────────────────────┐
│  Estadísticas de Lotes              │
├─────────────────────────────────────┤
│  5        │  8        │  2.0         │
│  Lotes    │  Usos     │  Promedio    │
│  únicos   │  totales  │  por form    │
├─────────────────────────────────────┤
│  LOTES MÁS USADOS                   │
│  LOT001  ████████████ 75%  3 usos   │
│  LOT002  ████████     50%  2 usos   │
│  LOT003  ████         25%  1 uso    │
└─────────────────────────────────────┘
```

---

## 🔄 Integración con Backend

### 1. Actualizar Modelo FilledForm

```csharp
// Models/FilledForm.cs
public class FilledForm
{
    // ... campos existentes ...
    
    public string? Batches { get; set; } // Espacio-separado: "LOT001 LOT002 LOT003"
    
    // Propiedad calculada para array
    [NotMapped]
    public string[] BatchArray => 
        string.IsNullOrWhiteSpace(Batches) 
            ? Array.Empty<string>() 
            : Batches.Split(' ', StringSplitOptions.RemoveEmptyEntries);
}
```

### 2. Migración de Base de Datos

```bash
# PowerShell
dotnet ef migrations add AddBatchesField
dotnet ef database update
```

### 3. Endpoint de Validación de Lotes

```csharp
// Controllers/BatchesController.cs
[ApiController]
[Route("api/[controller]")]
public class BatchesController : ControllerBase
{
    [HttpPost("validate")]
    public async Task<ActionResult<List<BatchValidationResult>>> ValidateBatches(
        [FromBody] List<string> batches)
    {
        var results = new List<BatchValidationResult>();
        
        foreach (var batch in batches)
        {
            var exists = await _context.Batches
                .AnyAsync(b => b.BatchNumber == batch);
            
            results.Add(new BatchValidationResult
            {
                Batch = batch,
                IsValid = Regex.IsMatch(batch, @"^[A-Z0-9_-]{3,20}$"),
                Exists = exists
            });
        }
        
        return Ok(results);
    }
}

public class BatchValidationResult
{
    public string Batch { get; set; }
    public bool IsValid { get; set; }
    public bool Exists { get; set; }
    public string? Error { get; set; }
}
```

### 4. Integración con Inforbusiness (Export)

```jsx
import { toInforbusinessFormat } from '../utils/unitConversion';

async function exportToInforbusiness(formData) {
  // Convertir pesos a kilogramos
  const exportData = {
    ...formData,
    weight: toInforbusinessFormat(formData.weight), // lb → kg
    unit: 'kg',
    batches: formData.batches.split(' '), // Array de lotes
  };

  const response = await fetch('https://inforbusiness.api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(exportData),
  });

  return response.json();
}
```

### 5. Integración con Inforbusiness (Import)

```jsx
import { fromInforbusinessFormat } from '../utils/unitConversion';

async function importFromInforbusiness(recordId) {
  const response = await fetch(`https://inforbusiness.api/records/${recordId}`);
  const data = await response.json();

  // Convertir kg → lb para sistema interno
  return {
    ...data,
    weight: fromInforbusinessFormat(data.weight), // kg → lb
    unit: 'lb',
    batches: data.batches.join(' '), // Array → string espaciado
  };
}
```

---

## 📋 Ejemplo Completo: Formulario de Producción

```jsx
import React, { useState } from 'react';
import WeightInput, { UnitToggle, ConversionInfo } from '../components/WeightInput';
import MultiBatchInput, { defaultBatchValidator } from '../components/MultiBatchInput';
import { toInforbusinessFormat } from '../utils/unitConversion';

function ProductionFormComplete() {
  const [formData, setFormData] = useState({
    productName: '',
    weight: 0,
    unit: 'lb',
    batches: '',
  });

  const handleWeightChange = (value, unit) => {
    setFormData(prev => ({ ...prev, weight: value, unit }));
  };

  const handleBatchChange = (batchString, batchArray) => {
    setFormData(prev => ({ ...prev, batches: batchString }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Preparar datos para backend
    const submitData = {
      ...formData,
      weightInKg: toInforbusinessFormat(formData.weight),
      batchArray: formData.batches.split(' ').filter(b => b),
    };

    const response = await fetch('http://localhost:5074/api/FilledForms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitData),
    });

    if (response.ok) {
      alert('Formulario guardado exitosamente');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Registro de Producción</h2>
      
      <ConversionInfo />

      <div>
        <label>Nombre del Producto</label>
        <input
          type="text"
          value={formData.productName}
          onChange={e => setFormData(prev => ({ 
            ...prev, 
            productName: e.target.value 
          }))}
          required
        />
      </div>

      <UnitToggle 
        currentUnit={formData.unit}
        onToggle={unit => setFormData(prev => ({ ...prev, unit }))}
      />

      <WeightInput
        value={formData.weight}
        unit={formData.unit}
        label="Peso Total del Producto"
        onChange={handleWeightChange}
        showConversion={true}
        required={true}
        min={0}
        max={10000}
        decimals={2}
      />

      <MultiBatchInput
        value={formData.batches}
        label="Lotes de Materia Prima"
        onChange={handleBatchChange}
        placeholder="Ej: LOT001 LOT002 LOT003"
        required={true}
        maxBatches={10}
        validateBatch={defaultBatchValidator}
        allowDuplicates={false}
      />

      <button type="submit">
        Guardar Registro
      </button>

      <div className="preview">
        <h3>Preview de Datos</h3>
        <pre>{JSON.stringify(formData, null, 2)}</pre>
      </div>
    </form>
  );
}

export default ProductionFormComplete;
```

---

## 🧪 Testing

### Test de Conversión de Unidades

```jsx
import { 
  poundsToKilograms, 
  kilogramsToPounds,
  showBothUnits 
} from '../utils/unitConversion';

// Test 1: Conversión lb → kg
console.assert(poundsToKilograms(10) === 4.54, 'Test 1 falló');

// Test 2: Conversión kg → lb
console.assert(kilogramsToPounds(5).toFixed(2) === '11.02', 'Test 2 falló');

// Test 3: Display dual
const display = showBothUnits(100, 'lb', 'kg');
console.log(display); // "100.00 lb ≈ 45.36 kg"
```

### Test de Multi-Batch

```jsx
import { defaultBatchValidator } from '../components/MultiBatchInput';

// Test validación
const test1 = defaultBatchValidator('LOT001');
console.assert(test1.isValid === true, 'LOT001 debe ser válido');

const test2 = defaultBatchValidator('AB');
console.assert(test2.isValid === false, 'AB es muy corto');

const test3 = defaultBatchValidator('LOT-001_V2');
console.assert(test3.isValid === true, 'Formato válido con guiones');
```

---

## 📚 Documentación Adicional

- **unitConversion.js**: 12 funciones de conversión y validación
- **WeightInput.jsx**: 4 componentes exportados
- **MultiBatchInput.jsx**: 3 componentes exportados + validador

## ✅ Checklist de Implementación

- [ ] Instalar dependencias si es necesario
- [ ] Agregar `WeightInput` a formularios de producción
- [ ] Agregar `MultiBatchInput` a formularios
- [ ] Actualizar modelo `FilledForm` con campo `Batches`
- [ ] Crear migración de base de datos
- [ ] Implementar endpoint de validación de lotes
- [ ] Configurar integración con Inforbusiness
- [ ] Actualizar documentación de usuario
- [ ] Realizar testing de componentes
- [ ] Capacitar usuarios sobre nuevas funcionalidades

---

**¡Todo listo para usar! 🎉**
