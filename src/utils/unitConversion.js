/**
 * ===================================
 * SISTEMA DE CONVERSIÓN DE UNIDADES
 * Libras (lb) ↔ Kilogramos (kg)
 * ===================================
 */

// Factores de conversión
const CONVERSION_FACTORS = {
  LB_TO_KG: 0.453592,    // 1 libra = 0.453592 kg
  KG_TO_LB: 2.20462,     // 1 kg = 2.20462 libras
};

/**
 * Unidades soportadas
 */
export const UNITS = {
  LIBRAS: 'lb',
  KILOGRAMOS: 'kg',
  GRAMOS: 'g',
  ONZAS: 'oz',
};

/**
 * Convierte libras a kilogramos
 * @param {number} pounds - Cantidad en libras
 * @param {number} decimals - Número de decimales (default: 2)
 * @returns {number} Cantidad en kilogramos
 */
export function poundsToKilograms(pounds, decimals = 2) {
  if (pounds === null || pounds === undefined || isNaN(pounds)) {
    console.warn('⚠️ Valor inválido para conversión:', pounds);
    return 0;
  }
  
  const kg = parseFloat(pounds) * CONVERSION_FACTORS.LB_TO_KG;
  return Math.round(kg * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Convierte kilogramos a libras
 * @param {number} kilograms - Cantidad en kilogramos
 * @param {number} decimals - Número de decimales (default: 2)
 * @returns {number} Cantidad en libras
 */
export function kilogramsToPounds(kilograms, decimals = 2) {
  if (kilograms === null || kilograms === undefined || isNaN(kilograms)) {
    console.warn('⚠️ Valor inválido para conversión:', kilograms);
    return 0;
  }
  
  const lb = parseFloat(kilograms) * CONVERSION_FACTORS.KG_TO_LB;
  return Math.round(lb * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Convierte entre unidades (automático)
 * @param {number} value - Valor a convertir
 * @param {string} fromUnit - Unidad origen ('lb', 'kg')
 * @param {string} toUnit - Unidad destino ('lb', 'kg')
 * @param {number} decimals - Número de decimales
 * @returns {number} Valor convertido
 */
export function convertUnit(value, fromUnit, toUnit, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }

  // Si son la misma unidad, retornar el valor original
  if (fromUnit === toUnit) {
    return parseFloat(value);
  }

  // Normalizar unidades a minúsculas
  const from = fromUnit.toLowerCase();
  const to = toUnit.toLowerCase();

  // Conversiones
  if (from === 'lb' && to === 'kg') {
    return poundsToKilograms(value, decimals);
  } else if (from === 'kg' && to === 'lb') {
    return kilogramsToPounds(value, decimals);
  } else {
    console.warn(`⚠️ Conversión no soportada: ${from} → ${to}`);
    return parseFloat(value);
  }
}

/**
 * Formatea un valor con su unidad
 * @param {number} value - Valor numérico
 * @param {string} unit - Unidad ('lb', 'kg')
 * @param {number} decimals - Decimales a mostrar
 * @returns {string} Texto formateado (ej: "10.50 kg")
 */
export function formatWithUnit(value, unit, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) {
    return `0.00 ${unit}`;
  }

  const formattedValue = parseFloat(value).toFixed(decimals);
  return `${formattedValue} ${unit}`;
}

/**
 * Convierte y formatea automáticamente
 * @param {number} value - Valor a convertir
 * @param {string} fromUnit - Unidad origen
 * @param {string} toUnit - Unidad destino
 * @param {number} decimals - Decimales
 * @returns {string} Texto formateado con conversión
 */
export function convertAndFormat(value, fromUnit, toUnit, decimals = 2) {
  const converted = convertUnit(value, fromUnit, toUnit, decimals);
  return formatWithUnit(converted, toUnit, decimals);
}

/**
 * Muestra ambas unidades (original y convertida)
 * @param {number} value - Valor original
 * @param {string} originalUnit - Unidad original
 * @param {string} targetUnit - Unidad objetivo
 * @returns {string} Texto con ambas unidades
 */
export function showBothUnits(value, originalUnit, targetUnit) {
  if (value === null || value === undefined || isNaN(value)) {
    return `0.00 ${originalUnit} (0.00 ${targetUnit})`;
  }

  const converted = convertUnit(value, originalUnit, targetUnit, 2);
  const original = formatWithUnit(value, originalUnit, 2);
  const target = formatWithUnit(converted, targetUnit, 2);
  
  return `${original} ≈ ${target}`;
}

/**
 * Configuración por defecto del sistema
 */
export const UNIT_SETTINGS = {
  // Unidad que usa el sistema (carga en libras)
  SYSTEM_UNIT: 'lb',
  
  // Unidad que usa Inforbusiness
  INFORBUSINESS_UNIT: 'kg',
  
  // Unidad por defecto para mostrar al usuario
  DEFAULT_DISPLAY_UNIT: 'lb',
  
  // Decimales por defecto
  DEFAULT_DECIMALS: 2,
};

/**
 * Convierte datos del sistema a formato Inforbusiness
 * @param {number} poundsValue - Valor en libras (sistema)
 * @returns {number} Valor en kilogramos (Inforbusiness)
 */
export function toInforbusinessFormat(poundsValue) {
  return convertUnit(
    poundsValue,
    UNIT_SETTINGS.SYSTEM_UNIT,
    UNIT_SETTINGS.INFORBUSINESS_UNIT,
    UNIT_SETTINGS.DEFAULT_DECIMALS
  );
}

/**
 * Convierte datos de Inforbusiness a formato del sistema
 * @param {number} kgValue - Valor en kilogramos (Inforbusiness)
 * @returns {number} Valor en libras (sistema)
 */
export function fromInforbusinessFormat(kgValue) {
  return convertUnit(
    kgValue,
    UNIT_SETTINGS.INFORBUSINESS_UNIT,
    UNIT_SETTINGS.SYSTEM_UNIT,
    UNIT_SETTINGS.DEFAULT_DECIMALS
  );
}

/**
 * Hook para React: convierte automáticamente al cambiar input
 * @param {number} value - Valor a convertir
 * @param {string} fromUnit - Unidad origen
 * @returns {object} Objeto con valores en ambas unidades
 */
export function useUnitConverter(value, fromUnit = 'lb') {
  const toUnit = fromUnit === 'lb' ? 'kg' : 'lb';
  
  return {
    original: {
      value: parseFloat(value) || 0,
      unit: fromUnit,
      formatted: formatWithUnit(value, fromUnit),
    },
    converted: {
      value: convertUnit(value, fromUnit, toUnit),
      unit: toUnit,
      formatted: convertAndFormat(value, fromUnit, toUnit),
    },
    both: showBothUnits(value, fromUnit, toUnit),
  };
}

/**
 * Valida si un valor de peso es válido
 * @param {number} value - Valor a validar
 * @param {number} min - Valor mínimo permitido
 * @param {number} max - Valor máximo permitido
 * @returns {object} Resultado de validación
 */
export function validateWeight(value, min = 0, max = 999999) {
  const numValue = parseFloat(value);
  
  if (isNaN(numValue)) {
    return {
      isValid: false,
      error: 'El valor debe ser un número',
    };
  }
  
  if (numValue < min) {
    return {
      isValid: false,
      error: `El valor debe ser mayor o igual a ${min}`,
    };
  }
  
  if (numValue > max) {
    return {
      isValid: false,
      error: `El valor debe ser menor o igual a ${max}`,
    };
  }
  
  return {
    isValid: true,
    error: null,
  };
}

/**
 * Parsea un string con unidad (ej: "10.5 kg" → {value: 10.5, unit: 'kg'})
 * @param {string} input - String con valor y unidad
 * @returns {object} Objeto con value y unit
 */
export function parseWeightString(input) {
  if (!input || typeof input !== 'string') {
    return { value: 0, unit: 'lb' };
  }

  const match = input.match(/^([\d.]+)\s*(lb|kg|g|oz)?$/i);
  
  if (!match) {
    return { value: 0, unit: 'lb' };
  }

  return {
    value: parseFloat(match[1]),
    unit: match[2] ? match[2].toLowerCase() : 'lb',
  };
}

// Exportaciones por defecto
export default {
  poundsToKilograms,
  kilogramsToPounds,
  convertUnit,
  formatWithUnit,
  convertAndFormat,
  showBothUnits,
  toInforbusinessFormat,
  fromInforbusinessFormat,
  useUnitConverter,
  validateWeight,
  parseWeightString,
  UNITS,
  UNIT_SETTINGS,
};
