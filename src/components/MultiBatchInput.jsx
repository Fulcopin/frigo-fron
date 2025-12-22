import { useState, useEffect, useRef } from 'react';
import './MultiBatchInput.css';

/**
 * Componente para entrada de múltiples lotes/batches
 * Permite ingresar varios números de lote separados por espacios
 * Muestra cada lote como un chip individual con validación
 */
function MultiBatchInput({
  value = '',
  onChange,
  label = 'Lotes / Batches',
  placeholder = 'Ej: LOT001 LOT002 LOT003',
  required = false,
  disabled = false,
  maxBatches = 10,
  validateBatch = null, // Función opcional para validar cada lote
  onValidate = null, // Callback con resultados de validación
  allowDuplicates = false,
  name = 'batches',
}) {
  const [inputText, setInputText] = useState('');
  const [batches, setBatches] = useState([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [validationResults, setValidationResults] = useState({});
  const inputRef = useRef(null);

  // Parsear valor inicial
  useEffect(() => {
    if (value && typeof value === 'string') {
      const parsed = value.trim().split(/\s+/).filter(b => b);
      setBatches(parsed);
    }
  }, [value]);

  // Validar lotes cuando cambien
  useEffect(() => {
    if (validateBatch && batches.length > 0) {
      const results = {};
      batches.forEach(batch => {
        results[batch] = validateBatch(batch);
      });
      setValidationResults(results);
      
      if (onValidate) {
        onValidate(results);
      }
    }
  }, [batches, validateBatch, onValidate]);

  const handleInputChange = (e) => {
    const text = e.target.value.toUpperCase();
    setInputText(text);
  };

  const handleInputKeyDown = (e) => {
    const text = inputText.trim();

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      
      if (text) {
        addBatch(text);
      }
    } else if (e.key === 'Backspace' && !inputText && batches.length > 0) {
      // Eliminar último lote si el input está vacío
      removeBatch(batches.length - 1);
    }
  };

  const handleInputBlur = () => {
    const text = inputText.trim();
    if (text) {
      addBatch(text);
    }
  };

  const addBatch = (batchText) => {
    // Separar por espacios en caso de que peguen múltiples
    const newBatches = batchText.split(/\s+/).filter(b => b);
    
    const toAdd = [];
    
    newBatches.forEach(batch => {
      const trimmed = batch.trim();
      
      // Validaciones básicas
      if (!trimmed) return;
      
      if (!allowDuplicates && batches.includes(trimmed)) {
        showError(`Lote duplicado: ${trimmed}`);
        return;
      }
      
      if (batches.length + toAdd.length >= maxBatches) {
        showError(`Máximo ${maxBatches} lotes permitidos`);
        return;
      }
      
      toAdd.push(trimmed);
    });

    if (toAdd.length > 0) {
      const updated = [...batches, ...toAdd];
      setBatches(updated);
      onChange && onChange(updated.join(' '), updated);
      setInputText('');
    }
  };

  const removeBatch = (index) => {
    const updated = batches.filter((_, i) => i !== index);
    setBatches(updated);
    onChange && onChange(updated.join(' '), updated);
  };

  const clearAll = () => {
    setBatches([]);
    setInputText('');
    onChange && onChange('', []);
    inputRef.current?.focus();
  };

  const showError = (message) => {
    // TODO: Implementar notificación toast
    console.warn(message);
  };

  const getBatchStatus = (batch) => {
    if (!validateBatch) return 'unknown';
    
    const result = validationResults[batch];
    if (!result) return 'validating';
    
    if (result.isValid === false) return 'invalid';
    if (result.exists === false) return 'notfound';
    return 'valid';
  };

  const getBatchStatusIcon = (batch) => {
    const status = getBatchStatus(batch);
    
    switch (status) {
      case 'valid': return '✓';
      case 'invalid': return '⚠️';
      case 'notfound': return '?';
      case 'validating': return '⏳';
      default: return '';
    }
  };

  const getBatchStatusClass = (batch) => {
    return `batch-status-${getBatchStatus(batch)}`;
  };

  return (
    <div className={`multi-batch-container ${disabled ? 'disabled' : ''}`}>
      <div className="multi-batch-header">
        <label className="multi-batch-label">
          {label}
          {required && <span className="required-mark">*</span>}
        </label>
        
        {batches.length > 0 && (
          <div className="batch-counter">
            {batches.length} / {maxBatches} lotes
          </div>
        )}
      </div>

      <div className="multi-batch-input-area">
        <div className="batch-chips-container">
          {batches.map((batch, index) => (
            <div
              key={`${batch}-${index}`}
              className={`batch-chip ${getBatchStatusClass(batch)} ${focusedIndex === index ? 'focused' : ''}`}
              onMouseEnter={() => setFocusedIndex(index)}
              onMouseLeave={() => setFocusedIndex(-1)}
            >
              <span className="batch-status-icon">
                {getBatchStatusIcon(batch)}
              </span>
              <span className="batch-text">{batch}</span>
              {!disabled && (
                <button
                  type="button"
                  className="batch-remove"
                  onClick={() => removeBatch(index)}
                  aria-label={`Eliminar ${batch}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {!disabled && batches.length < maxBatches && (
            <input
              ref={inputRef}
              type="text"
              name={name}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onBlur={handleInputBlur}
              placeholder={batches.length === 0 ? placeholder : ''}
              className="batch-input"
              disabled={disabled}
            />
          )}
        </div>

        {batches.length > 0 && !disabled && (
          <button
            type="button"
            className="clear-all-button"
            onClick={clearAll}
            title="Limpiar todos"
          >
            🗑️
          </button>
        )}
      </div>

      <div className="multi-batch-hints">
        <div className="hint-item">
          💡 Presiona <kbd>Espacio</kbd> o <kbd>Enter</kbd> para agregar un lote
        </div>
        {validateBatch && (
          <div className="hint-item">
            ✓ = Válido | ⚠️ = Error | ? = No encontrado | ⏳ = Validando
          </div>
        )}
      </div>

      {/* Hidden input para forms tradicionales */}
      <input
        type="hidden"
        name={`${name}_hidden`}
        value={batches.join(' ')}
      />
    </div>
  );
}

/**
 * Componente de Display de Lotes (solo lectura)
 */
export function BatchListDisplay({ batches, variant = 'chips' }) {
  if (!batches || batches.length === 0) {
    return <div className="batch-list-empty">Sin lotes registrados</div>;
  }

  const batchArray = Array.isArray(batches) ? batches : batches.split(/\s+/);

  if (variant === 'chips') {
    return (
      <div className="batch-list-chips">
        {batchArray.map((batch, index) => (
          <span key={index} className="batch-chip-display">
            {batch}
          </span>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <ul className="batch-list-ul">
        {batchArray.map((batch, index) => (
          <li key={index}>{batch}</li>
        ))}
      </ul>
    );
  }

  // variant === 'inline'
  return (
    <div className="batch-list-inline">
      {batchArray.join(', ')}
    </div>
  );
}

/**
 * Componente de Estadísticas de Lotes
 */
export function BatchStats({ forms }) {
  const allBatches = forms.flatMap(form => {
    const batches = form.batches || form.Batches || '';
    return batches.split(/\s+/).filter(b => b);
  });

  const uniqueBatches = [...new Set(allBatches)];
  const batchCounts = {};
  
  allBatches.forEach(batch => {
    batchCounts[batch] = (batchCounts[batch] || 0) + 1;
  });

  const topBatches = Object.entries(batchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="batch-stats">
      <h3>Estadísticas de Lotes</h3>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{uniqueBatches.length}</div>
          <div className="stat-label">Lotes únicos</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">{allBatches.length}</div>
          <div className="stat-label">Usos totales</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">
            {(allBatches.length / forms.length).toFixed(1)}
          </div>
          <div className="stat-label">Promedio por formulario</div>
        </div>
      </div>

      {topBatches.length > 0 && (
        <div className="top-batches">
          <h4>Lotes más usados</h4>
          {topBatches.map(([batch, count]) => (
            <div key={batch} className="batch-usage-item">
              <span className="batch-name">{batch}</span>
              <div className="usage-bar">
                <div 
                  className="usage-fill"
                  style={{ width: `${(count / forms.length) * 100}%` }}
                />
              </div>
              <span className="usage-count">{count} usos</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Validador de formato de lote por defecto
 */
export function defaultBatchValidator(batch) {
  // Formato: 3-20 caracteres alfanuméricos, guiones, guiones bajos
  const regex = /^[A-Z0-9_-]{3,20}$/;
  
  return {
    isValid: regex.test(batch),
    error: regex.test(batch) ? null : 'Formato inválido (3-20 caracteres, A-Z 0-9 _ -)',
  };
}

export default MultiBatchInput;
