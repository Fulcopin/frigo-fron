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
 * Construye un rowAlias para fórmulas en tablas con encabezados agrupados.
 *
 * Cuando una tabla tiene columnas con etiquetas duplicadas (e.g., "Patrón" en cada grupo),
 * FillForm las guarda como "Patrón_col3", "Patrón_col9", etc.
 * Esta función crea un objeto donde las etiquetas PLANAS del mismo grupo apuntan a los
 * valores correctos del row, de modo que evaluarFormula pueda resolver la fórmula.
 *
 * @param {object} row          - Fila de datos (claves pueden ser "label_colN")
 * @param {Array}  templateCols - element.columns del template
 * @param {number} formulaColIndex - Índice de la columna de fórmula actual
 * @returns {object} rowAlias - row extendido con alias de etiquetas planas
 */
export const buildGroupedRowAlias = (row, templateCols, formulaColIndex) => {
  if (!templateCols || !templateCols.length) return row;

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

  // 2. Determinar el grupo de la columna de fórmula
  const formulaCol = templateCols[formulaColIndex];
  const colGroup = formulaCol ? (formulaCol.group || null) : null;

  // 3. Construir rowAlias: añadir alias de etiqueta plana para columnas del mismo grupo
  const rowAlias = { ...row };
  templateCols.forEach((col, ci) => {
    if (colGroup && col.group !== colGroup) return; // solo mismo grupo
    const storedKey = colNMap.get(ci) || col.label || col.name || '';
    const plainLabel = col.label || col.header || col.name || '';
    if (plainLabel && storedKey !== plainLabel && row[storedKey] !== undefined) {
      rowAlias[plainLabel] = row[storedKey];
    }
  });

  return rowAlias;
};
