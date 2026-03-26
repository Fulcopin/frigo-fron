/**
 * 🧮 Motor de fórmulas compartido: FillForm · ViewForms · pdfExportService · excelExportService
 *
 * Soporta: +, -, *, /, (), nombres de columna, números
 *
 * REFERENCIAS DE CELDAS:
 *   "Columna"        → valor en la MISMA fila
 *   "Columna[N]"     → valor de fila N (1-based)
 *   "Columna[*]"     → SUMA de toda la columna
 *   sum(A, B, C)     → suma (compatibilidad legacy)
 */
export const evaluarFormula = (formula, rowData, allRows = null, currentRowIndex = -1) => {
  if (!formula || typeof formula !== 'string' || !formula.trim()) return "";
  if (!rowData) return "";

  // Porcentaje: porcentaje(expr) o percent(expr)
  const percentMatch = formula.trim().match(/^(?:porcentaje|percent|pct)\((.+)\)$/i);
  if (percentMatch) {
    const innerResult = evaluarFormula(percentMatch[1], rowData, allRows, currentRowIndex);
    if (innerResult === "" || innerResult === "ERR" || innerResult === "⚠️") return innerResult;
    const numVal = Number.parseFloat(innerResult);
    if (Number.isNaN(numVal)) return "0.00";
    return (numVal * 100).toFixed(2);
  }

  const normalizeKey = (s) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const rowKeys = Object.keys(rowData).filter(k => k !== 'id' && k !== 'ID' && k !== 'undefined');
  const normalizedKeyMap = {};
  rowKeys.forEach(k => { normalizedKeyMap[normalizeKey(k)] = k; });

  const getVal = (name) => {
    if (rowData[name] !== undefined) {
      const v = Number.parseFloat(rowData[name]);
      return Number.isNaN(v) ? 0 : v;
    }
    const normName = normalizeKey(name);
    const matchedKey = normalizedKeyMap[normName];
    if (matchedKey !== undefined) {
      const v = Number.parseFloat(rowData[matchedKey]);
      return Number.isNaN(v) ? 0 : v;
    }
    return null;
  };

  try {
    if (formula.trim().toLowerCase().startsWith('sum(')) {
      const variables = formula.replace(/sum\(/i, '').replace(')', '').split(',').map(v => v.trim());
      const total = variables.reduce((acc, n) => {
        const val = getVal(n);
        return acc + (val !== null ? val : 0);
      }, 0);
      return total === 0 ? "0.00" : total.toFixed(2);
    }

    const allColNames = rowKeys.sort((a, b) => b.length - a.length);
    let expression = formula;

    if (allRows && allRows.length > 0) {
      allColNames.forEach(colName => {
        const escaped = colName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexStar = new RegExp(escaped + '\\[\\*\\]', 'gi');
        expression = expression.replace(regexStar, () => {
          let suma = 0;
          allRows.forEach(r => { const v = Number.parseFloat(r[colName]); if (!Number.isNaN(v)) suma += v; });
          return String(suma);
        });
        const regexRow = new RegExp(escaped + '\\[(\\d+)\\]', 'gi');
        expression = expression.replace(regexRow, (match, rowNum) => {
          const idx = parseInt(rowNum) - 1;
          if (idx >= 0 && idx < allRows.length) {
            const v = Number.parseFloat(allRows[idx][colName]);
            return Number.isNaN(v) ? '0' : String(v);
          }
          return '0';
        });
      });
    }

    allColNames.forEach(colName => {
      const escaped = colName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      expression = expression.replace(regex, () => {
        const v = getVal(colName);
        return v !== null ? String(v) : '0';
      });
    });

    const sanitize = (expr) =>
      expr.replace(/\s/g, '')
        .replace(/\+\+/g, '+').replace(/--/g, '+')
        .replace(/\+-/g, '-').replace(/-\+/g, '-')
        .replace(/\*\+/g, '*').replace(/\/\+/g, '/');

    const sanitized = sanitize(expression);
    if (!/^[0-9.+\-*/()]+$/.test(sanitized)) {
      let expression2 = formula;
      if (allRows && allRows.length > 0) {
        Object.keys(normalizedKeyMap).sort((a, b) => b.length - a.length).forEach(normKey => {
          const origKey = normalizedKeyMap[normKey];
          const escaped = normKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const rx = new RegExp(escaped + '\\[\\*\\]', 'gi');
          expression2 = expression2.replace(rx, () => { let s = 0; allRows.forEach(r => { const v = parseFloat(r[origKey]); if (!isNaN(v)) s += v; }); return String(s); });
          const rx2 = new RegExp(escaped + '\\[(\\d+)\\]', 'gi');
          expression2 = expression2.replace(rx2, (m, n) => { const idx = parseInt(n) - 1; if (idx >= 0 && idx < allRows.length) { const v = parseFloat(allRows[idx][origKey]); return isNaN(v) ? '0' : String(v); } return '0'; });
        });
      }
      Object.keys(normalizedKeyMap).sort((a, b) => b.length - a.length).forEach(normKey => {
        const origKey = normalizedKeyMap[normKey];
        const escaped = normKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp(escaped, 'gi');
        expression2 = expression2.replace(rx, () => { const v = getVal(origKey); return v !== null ? String(v) : '0'; });
      });
      const sanitized2 = sanitize(expression2);
      if (!/^[0-9.+\-*/()]+$/.test(sanitized2)) {
        console.warn('⚠️ Fórmula sin coincidencia. Fórmula:', formula, '| Expresión:', expression2, '| Claves:', rowKeys);
        return "⚠️";
      }
      const result2 = new Function(`"use strict"; return (${sanitized2})`)();
      if (typeof result2 !== 'number' || !isFinite(result2)) return "0.00";
      return result2.toFixed(2);
    }

    const result = new Function(`"use strict"; return (${sanitized})`)();
    if (typeof result !== 'number' || !isFinite(result)) return "0.00";
    return result.toFixed(2);
  } catch (e) {
    console.warn('⚠️ Error evaluando fórmula:', formula, e.message);
    return "ERR";
  }
};

/**
 * Construye un rowAlias para fórmulas en tablas con columnas de etiqueta duplicada.
 *
 * FillForm guarda columnas duplicadas como "Patrón_col3", "Patrón_col7", etc.
 * Esta función expone las etiquetas planas ("Patrón") apuntando al valor correcto
 * dentro del mismo grupo que la columna de fórmula, de modo que evaluarFormula
 * resuelva correctamente "Patrón - Termómetro" en cualquier tabla.
 *
 * Funciona con:
 *  - Tablas con grupos (usa el mismo grupo como prioridad)
 *  - Tablas sin grupos (usa la columna más cercana por índice)
 *  - Tablas con etiquetas únicas (no necesita alias, pasa el row directo)
 */
export const buildGroupedRowAlias = (row, templateCols, formulaColIndex) => {
  if (!templateCols || !templateCols.length) return row;

  // Normaliza un nombre de grupo para comparación resistente a acentos/mayúsculas
  const normGroup = (g) =>
    (g || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .trim();

  // 1. Reconstruir columnNameMap igual que FillForm
  const seenLabels = new Map();
  templateCols.forEach((col, ci) => {
    const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
    if (!seenLabels.has(lbl)) seenLabels.set(lbl, []);
    seenLabels.get(lbl).push(ci);
  });
  const colNMap = new Map();
  templateCols.forEach((col, ci) => {
    const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
    colNMap.set(ci, seenLabels.get(lbl).length > 1 ? `${lbl}_col${ci}` : lbl);
  });

  // 2. Determinar el grupo de la columna de fórmula (normalizado)
  const formulaCol = templateCols[formulaColIndex];
  const colGroupNorm = formulaCol ? normGroup(formulaCol.group) : '';

  // 3. Para cada etiqueta duplicada, seleccionar la instancia más apropiada:
  //    - misma grupo (prioridad máxima) + más cercana por índice
  //    - distinto grupo: fallback con penalización por distancia
  const rowAlias = { ...row };

  seenLabels.forEach((indices, plainLabel) => {
    if (indices.length <= 1) return; // etiqueta única -> evaluarFormula la resuelve directo

    let bestIndex = -1;
    let bestScore = Infinity;

    indices.forEach(ci => {
      const col = templateCols[ci];
      const ciGroupNorm = normGroup(col ? col.group : '');
      const sameGroup = colGroupNorm !== '' && ciGroupNorm === colGroupNorm;
      const distance = Math.abs(ci - formulaColIndex);
      // Mismo grupo: score bajo (gana). Diferente grupo: penalización de 1000.
      const score = (sameGroup ? 0 : 1000) + distance;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = ci;
      }
    });

    if (bestIndex >= 0) {
      const storedKey = colNMap.get(bestIndex);
      if (storedKey && storedKey !== plainLabel && row[storedKey] !== undefined) {
        rowAlias[plainLabel] = row[storedKey];
      }
    }
  });

  return rowAlias;
};

/**
 * Fusiona los datos de la misma fila (rowIndex) desde TODAS las tablas de bodyData.
 * Permite que una fórmula en la Tabla B referencie columnas de la Tabla A.
 *
 * @param {Object} rawRow      - Fila actual de la tabla que contiene la fórmula
 * @param {number} rowIndex    - Índice de fila
 * @param {Array}  allBodyData - bodyData completo (array indexado por elementIndex)
 * @returns {Object} Fila enriquecida con valores de otras tablas
 */
export const mergeCrossTableRow = (rawRow, rowIndex, allBodyData) => {
  if (!Array.isArray(allBodyData) || allBodyData.length === 0) return rawRow;
  const merged = { ...rawRow };
  allBodyData.forEach(elData => {
    if (!elData) return;
    const elRows = Array.isArray(elData.data) ? elData.data
      : Array.isArray(elData.rows) ? elData.rows
      : Array.isArray(elData) ? elData
      : [];
    if (rowIndex < elRows.length && elRows[rowIndex] && typeof elRows[rowIndex] === 'object') {
      Object.assign(merged, elRows[rowIndex]);
    }
  });
  return merged;
};

/**
 * Pre-evalúa TODAS las columnas de fórmula de una fila en orden,
 * permitiendo que una fórmula use el resultado de otra fórmula anterior (encadenamiento).
 *
 * Uso en render: const displayRow = buildComputedRow(row, element.columns, allRows, rowIndex);
 * Luego pasa displayRow a evaluarFormula en vez de row.
 *
 * @param {Object} row          - Fila de datos (puede tener claves _colN)
 * @param {Array}  templateCols - Columnas de la plantilla
 * @param {Array}  allRows      - Todas las filas de la misma tabla (para [*] y [N])
 * @param {number} rowIndex     - Índice actual (para [N])
 * @returns {Object} Copia de row con los resultados de fórmulas calculados
 */
export const buildComputedRow = (row, templateCols, allRows = [], rowIndex = -1) => {
  if (!templateCols || !templateCols.length) return row;

  // Reconstruir colNMap igual que buildGroupedRowAlias
  const seenLabels = new Map();
  templateCols.forEach((col, ci) => {
    const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
    if (!seenLabels.has(lbl)) seenLabels.set(lbl, []);
    seenLabels.get(lbl).push(ci);
  });
  const colNMap = new Map();
  templateCols.forEach((col, ci) => {
    const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
    colNMap.set(ci, seenLabels.get(lbl).length > 1 ? `${lbl}_col${ci}` : lbl);
  });

  // Copia de trabajo: iremos escribiendo los resultados para que columnas posteriores los vean
  let computedRow = { ...row };

  // Evaluar columnas de fórmula EN ORDEN (el orden de columnas define la cadena de cálculo)
  templateCols.forEach((col, ci) => {
    const colType = (col.type || '').toLowerCase();
    if ((colType === 'formula' || colType === 'calculated' || colType === 'percentage') && col.formula) {
      const plainLabel = col.label || col.header || col.name || '';
      const storedKey = colNMap.get(ci) || plainLabel;

      // Resolver alias para grupos y etiquetas duplicadas, usando computedRow que ya tiene
      // los resultados de las fórmulas anteriores calculados
      const rowAlias = buildGroupedRowAlias(computedRow, templateCols, ci);
      let result = evaluarFormula(col.formula, rowAlias, allRows, rowIndex);

      if (colType === 'percentage' && result && result !== 'ERR' && result !== '⚠️') {
        const numVal = parseFloat(result);
        result = isNaN(numVal) ? '0.00' : (numVal * 100).toFixed(2);
      }

      if (result && result !== '⚠️' && result !== 'ERR') {
        // Guardar bajo la etiqueta plana (para que otras fórmulas la encuentren por nombre)
        if (plainLabel) computedRow[plainLabel] = result;
        // También bajo la clave _colN si es distinta (para compatibilidad con el row almacenado)
        if (storedKey && storedKey !== plainLabel) computedRow[storedKey] = result;
      }
    }
  });

  return computedRow;
};
