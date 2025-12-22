import { useState, useEffect } from 'react';
import { 
  convertUnit, 
  formatWithUnit, 
  showBothUnits, 
  validateWeight,
  UNIT_SETTINGS 
} from '../utils/unitConversion';
import './WeightInput.css';

/**
 * Componente de Input con Conversión Automática de Unidades
 * Muestra libras y kilogramos simultáneamente
 */
function WeightInput({ 
  value, 
  onChange, 
  unit = 'lb',
  label = 'Peso',
  showConversion = true,
  required = false,
  min = 0,
  max = 999999,
  decimals = 2,
  disabled = false,
  placeholder = '0.00',
  name = 'weight',
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [error, setError] = useState(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const targetUnit = unit === 'lb' ? 'kg' : 'lb';
  const convertedValue = convertUnit(inputValue, unit, targetUnit, decimals);

  const handleChange = (e) => {
    const newValue = e.target.value;
    
    // Permitir solo números y punto decimal
    if (newValue && !/^\d*\.?\d*$/.test(newValue)) {
      return;
    }

    setInputValue(newValue);

    // Validar
    if (newValue) {
      const validation = validateWeight(parseFloat(newValue), min, max);
      setError(validation.error);
      
      if (validation.isValid) {
        onChange && onChange(parseFloat(newValue), unit);
      }
    } else {
      setError(null);
      onChange && onChange(0, unit);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    
    // Formatear al perder foco
    if (inputValue) {
      const formatted = parseFloat(inputValue).toFixed(decimals);
      setInputValue(formatted);
    }
  };

  return (
    <div className={`weight-input-container ${error ? 'has-error' : ''} ${disabled ? 'disabled' : ''}`}>
      <label className="weight-label">
        {label}
        {required && <span className="required-mark">*</span>}
      </label>

      <div className={`weight-input-group ${isFocused ? 'focused' : ''}`}>
        <input
          type="text"
          name={name}
          value={inputValue}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className="weight-input"
          aria-label={label}
        />
        <span className="weight-unit">{unit}</span>
        
        {showConversion && inputValue && (
          <div className="conversion-badge">
            ≈ {formatWithUnit(convertedValue, targetUnit, decimals)}
          </div>
        )}
      </div>

      {error && (
        <div className="weight-error">
          ⚠️ {error}
        </div>
      )}

      {showConversion && inputValue && !error && (
        <div className="weight-hint">
          {showBothUnits(inputValue, unit, targetUnit)}
        </div>
      )}
    </div>
  );
}

/**
 * Componente de Toggle para cambiar unidad de visualización
 */
export function UnitToggle({ currentUnit, onToggle }) {
  return (
    <div className="unit-toggle">
      <button
        className={`unit-option ${currentUnit === 'lb' ? 'active' : ''}`}
        onClick={() => onToggle('lb')}
      >
        Libras (lb)
      </button>
      <button
        className={`unit-option ${currentUnit === 'kg' ? 'active' : ''}`}
        onClick={() => onToggle('kg')}
      >
        Kilogramos (kg)
      </button>
    </div>
  );
}

/**
 * Componente de Display de Peso (solo lectura)
 */
export function WeightDisplay({ value, unit = 'lb', showBoth = true, decimals = 2 }) {
  const targetUnit = unit === 'lb' ? 'kg' : 'lb';
  const convertedValue = convertUnit(value, unit, targetUnit, decimals);

  return (
    <div className="weight-display">
      <div className="weight-main">
        {formatWithUnit(value, unit, decimals)}
      </div>
      {showBoth && (
        <div className="weight-secondary">
          ≈ {formatWithUnit(convertedValue, targetUnit, decimals)}
        </div>
      )}
    </div>
  );
}

/**
 * Tabla comparativa de pesos
 */
export function WeightComparisonTable({ weights }) {
  return (
    <div className="weight-comparison-table">
      <table>
        <thead>
          <tr>
            <th>Descripción</th>
            <th>Libras (lb)</th>
            <th>Kilogramos (kg)</th>
          </tr>
        </thead>
        <tbody>
          {weights.map((item, index) => {
            const kgValue = convertUnit(item.value, item.unit || 'lb', 'kg', 2);
            const lbValue = item.unit === 'kg' 
              ? convertUnit(item.value, 'kg', 'lb', 2) 
              : item.value;

            return (
              <tr key={index}>
                <td>{item.description}</td>
                <td>{formatWithUnit(lbValue, 'lb', 2)}</td>
                <td>{formatWithUnit(kgValue, 'kg', 2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Badge informativo sobre la conversión
 */
export function ConversionInfo() {
  return (
    <div className="conversion-info">
      <div className="info-header">
        <span className="info-icon">ℹ️</span>
        <strong>Conversión de Unidades</strong>
      </div>
      <div className="info-content">
        <p><strong>Sistema:</strong> Carga datos en Libras (lb)</p>
        <p><strong>Inforbusiness:</strong> Usa Kilogramos (kg)</p>
        <p><strong>Conversión automática:</strong> 1 lb = 0.453592 kg</p>
      </div>
    </div>
  );
}

export default WeightInput;
