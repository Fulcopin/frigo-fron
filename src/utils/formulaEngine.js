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
export const evaluarFormula = (formula, rowData, allRows = null, currentRowIndex = -1, format = true) => {
  if (!formula || typeof formula !== 'string' || !formula.trim()) return "";
  if (!rowData) return "";

  // 🔍 DEBUG GLASEO: Log temporal para diagnosticar
  if (formula.includes('GLASEO') && currentRowIndex === 0) {
    const pesoC = rowData['PESO lbs C/GLASEO'];
    const pesoS = rowData['PESO lbs S/GLASEO'];
    const keys = Object.keys(rowData).filter(k => k.includes('PESO') || k.includes('GLASEO'));
    console.log(`🔬 GLASEO DEBUG [row ${currentRowIndex}]:`, {
      formula,
      'PESO lbs C/GLASEO': pesoC,
      'PESO lbs S/GLASEO': pesoS,
      'keys con PESO/GLASEO': keys,
      'todas las keys': Object.keys(rowData).join(', ')
    });
  }

  // Porcentaje: porcentaje(expr) o percent(expr)
  const percentMatch = formula.trim().match(/^(?:porcentaje|percent|pct)\((.+)\)$/i);
  if (percentMatch) {
    const innerResult = evaluarFormula(percentMatch[1], rowData, allRows, currentRowIndex);
    if (innerResult === "" || innerResult === "ERR" || innerResult === "⚠️") return innerResult;
    const numVal = Number.parseFloat(innerResult);
    if (Number.isNaN(numVal)) return format ? "0.00" : "0";
    return format ? (numVal * 100).toFixed(2) : String(numVal * 100);
  }

  const normalizeKey = (s) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  let rowKeys = Object.keys(rowData).filter(k => k !== 'id' && k !== 'ID' && k !== 'undefined' && k !== '__crossTableSums__');
  if (rowData.__crossTableSums__) {
    const sumKeys = Object.keys(rowData.__crossTableSums__).filter(k => k !== 'id' && k !== 'ID' && k !== 'undefined');
    rowKeys = [...new Set([...rowKeys, ...sumKeys])];
  }
  const normalizedKeyMap = {};
  rowKeys.forEach(k => { normalizedKeyMap[normalizeKey(k)] = k; });

  const getVal = (name) => {
    if (rowData[name] !== undefined) {
      const v = Number.parseFloat(rowData[name]);
      return Number.isNaN(v) ? 0 : v;
    }
    const normName = normalizeKey(name);
    const matchedKey = normalizedKeyMap[normName];
    if (matchedKey !== undefined && rowData[matchedKey] !== undefined) {
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
      return format ? (total === 0 ? "0.00" : total.toFixed(2)) : String(total);
    }

    const allColNames = rowKeys.sort((a, b) => b.length - a.length);
    let expression = formula;

    // --- PROCESAR _ROW_ ---
    expression = expression.replace(/_ROW_/gi, String(currentRowIndex));

    if (allRows && allRows.length > 0) {
      allColNames.forEach(colName => {
        const escaped = colName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // --- PROCESAR [*] (SUMA) ---
        const regexStar = new RegExp(escaped + '\\s*\\[\\*?\\]', 'gi');
        expression = expression.replace(regexStar, () => {
          let suma = 0;
          const colExistsInOwnRows = allRows.some(r => r[colName] !== undefined && !r._deleted);
          if (colExistsInOwnRows) {
            allRows.forEach(r => { if (r._deleted || String(r['N°']).toUpperCase() === 'TOTAL' || String(r['#']).toUpperCase() === 'TOTAL') return; const v = Number.parseFloat(r[colName]); if (!Number.isNaN(v)) suma += v; });
          } else {
            const crossSums = rowData.__crossTableSums__;
            if (crossSums && crossSums[colName] !== undefined) {
              suma = crossSums[colName];
            } else {
              const cv = Number.parseFloat(rowData[colName]);
              if (!Number.isNaN(cv)) suma = cv;
            }
          }
          return String(suma);
        });

        // --- PROCESAR [max] (MÁXIMO) ---
        const regexMax = new RegExp(escaped + '\\s*\\[max\\]', 'gi');
        expression = expression.replace(regexMax, () => {
          const crossMax = rowData.__crossTableMax__;
          if (crossMax && crossMax[colName] !== undefined) {
            return String(crossMax[colName]);
          }
          // Fallback
          let m = -Infinity;
          const colExistsInOwnRows = allRows.some(r => r[colName] !== undefined && !r._deleted);
          if (colExistsInOwnRows) {
            allRows.forEach(r => { if (r._deleted || String(r['N°']).toUpperCase() === 'TOTAL' || String(r['#']).toUpperCase() === 'TOTAL' || r['Métrica'] !== undefined) return; const v = Number.parseFloat(r[colName]); if (!Number.isNaN(v)) m = Math.max(m, v); });
          }
          return m === -Infinity ? '0' : String(m);
        });

        // --- PROCESAR [min] (MÍNIMO) ---
        const regexMin = new RegExp(escaped + '\\s*\\[min\\]', 'gi');
        expression = expression.replace(regexMin, () => {
          const crossMin = rowData.__crossTableMin__;
          if (crossMin && crossMin[colName] !== undefined) {
            return String(crossMin[colName]);
          }
          // Fallback
          let m = Infinity;
          const colExistsInOwnRows = allRows.some(r => r[colName] !== undefined && !r._deleted);
          if (colExistsInOwnRows) {
            allRows.forEach(r => { if (r._deleted || String(r['N°']).toUpperCase() === 'TOTAL' || String(r['#']).toUpperCase() === 'TOTAL' || r['Métrica'] !== undefined) return; const v = Number.parseFloat(r[colName]); if (!Number.isNaN(v)) m = Math.min(m, v); });
          }
          return m === Infinity ? '0' : String(m);
        });

        const regexRow = new RegExp(escaped + '\\s*\\[(\\d+)\\]', 'gi');
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
        .replace(/\[/g, '(').replace(/\]/g, ')')
        .replace(/([0-9)])x([0-9(])/gi, '$1*$2') 
        .replace(/\+\+/g, '+').replace(/--/g, '+')
        .replace(/\+-/g, '-').replace(/-\+/g, '-')
        .replace(/\*\+/g, '*').replace(/\/\+/g, '/');

    const sanitized = sanitize(expression);
    if (!/^[0-9.+\-*/()?:<>=&|_!]+$/.test(sanitized)) {
      let expression2 = normalizeKey(formula);
      expression2 = expression2.replace(/_row_/gi, String(currentRowIndex));
      Object.keys(normalizedKeyMap).sort((a, b) => b.length - a.length).forEach(normKey => {
        const origKey = normalizedKeyMap[normKey];
        const escaped = normKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp(escaped + '\\s*\\[\\*?\\]', 'gi');
        expression2 = expression2.replace(rx, () => {
          const colExistsInOwnRows = allRows && allRows.some(r => r[origKey] !== undefined && !r._deleted);
          if (colExistsInOwnRows) {
            let s = 0;
            allRows.forEach(r => { if (r._deleted || String(r['N°']).toUpperCase() === 'TOTAL' || String(r['#']).toUpperCase() === 'TOTAL') return; const v = parseFloat(r[origKey]); if (!isNaN(v)) s += v; });
            return String(s);
          }
          const crossSums = rowData.__crossTableSums__;
          if (crossSums && crossSums[origKey] !== undefined) return String(crossSums[origKey]);
          const cv = parseFloat(rowData[origKey]);
          return String(isNaN(cv) ? 0 : cv);
        });
        const rxMax = new RegExp(escaped + '\\s*\\[max\\]', 'gi');
        expression2 = expression2.replace(rxMax, () => {
          const crossMax = rowData.__crossTableMax__;
          if (crossMax && crossMax[origKey] !== undefined) return String(crossMax[origKey]);
          const colExistsInOwnRows = allRows && allRows.some(r => r[origKey] !== undefined && !r._deleted);
          if (colExistsInOwnRows) {
            let m = -Infinity;
            allRows.forEach(r => { if (r._deleted || String(r['N°']).toUpperCase() === 'TOTAL' || String(r['#']).toUpperCase() === 'TOTAL' || r['Métrica'] !== undefined) return; const v = parseFloat(r[origKey]); if (!isNaN(v)) m = Math.max(m, v); });
            return m === -Infinity ? '0' : String(m);
          }
          const cv = parseFloat(rowData[origKey]);
          return String(isNaN(cv) ? 0 : cv);
        });
        const rxMin = new RegExp(escaped + '\\s*\\[min\\]', 'gi');
        expression2 = expression2.replace(rxMin, () => {
          const crossMin = rowData.__crossTableMin__;
          if (crossMin && crossMin[origKey] !== undefined) return String(crossMin[origKey]);
          const colExistsInOwnRows = allRows && allRows.some(r => r[origKey] !== undefined && !r._deleted);
          if (colExistsInOwnRows) {
            let m = Infinity;
            allRows.forEach(r => { if (r._deleted || String(r['N°']).toUpperCase() === 'TOTAL' || String(r['#']).toUpperCase() === 'TOTAL' || r['Métrica'] !== undefined) return; const v = parseFloat(r[origKey]); if (!isNaN(v)) m = Math.min(m, v); });
            return m === Infinity ? '0' : String(m);
          }
          const cv = parseFloat(rowData[origKey]);
          return String(isNaN(cv) ? 0 : cv);
        });
        const rxCount = new RegExp(escaped + '\\s*\\[count\\]', 'gi');
        expression2 = expression2.replace(rxCount, () => {
          const crossCounts = rowData.__crossTableCounts__;
          if (crossCounts && crossCounts[origKey] !== undefined) return String(crossCounts[origKey]);
          const colExistsInOwnRows = allRows && allRows.some(r => r[origKey] !== undefined && !r._deleted);
          if (colExistsInOwnRows) {
            let c = 0;
            allRows.forEach(r => { if (r._deleted || String(r['N°']).toUpperCase() === 'TOTAL' || String(r['#']).toUpperCase() === 'TOTAL' || r['Métrica'] !== undefined) return; const v = parseFloat(r[origKey]); if (!isNaN(v)) c++; });
            return String(c);
          }
          const cv = parseFloat(rowData[origKey]);
          return String(isNaN(cv) ? 0 : 1);
        });
        const rx2 = new RegExp(escaped + '\\s*\\[(\\d+)\\]', 'gi');
        expression2 = expression2.replace(rx2, (m, n) => { const idx = parseInt(n) - 1; if (allRows && idx >= 0 && idx < allRows.length) { const v = parseFloat(allRows[idx][origKey]); return isNaN(v) ? '0' : String(v); } return '0'; });
      });
      Object.keys(normalizedKeyMap).sort((a, b) => b.length - a.length).forEach(normKey => {
        const origKey = normalizedKeyMap[normKey];
        const escaped = normKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp(escaped, 'gi');
        expression2 = expression2.replace(rx, () => { const v = getVal(origKey); return v !== null ? String(v) : '0'; });
      });
      const sanitized2 = sanitize(expression2);
      if (!/^[0-9.+\-*/()?:<>=&|_!'" ]+$/.test(sanitized2)) {
        console.warn('⚠️ Fórmula sin coincidencia. Fórmula:', formula, '| Expresión normalizada:', expression2, '| Claves:', rowKeys, '| rowData:', JSON.stringify(rowData).slice(0, 500));
        return "⚠️";
      }
      const result2 = new Function(`"use strict"; return (${sanitized2})`)();
      if (result2 === "") return "";
      if (typeof result2 !== 'number' || !isFinite(result2)) return format ? "0.00" : "0";
      return format ? result2.toFixed(2) : String(result2);
    }

    const result = new Function(`"use strict"; return (${sanitized})`)();
    if (result === "") return "";
    if (typeof result !== 'number' || !isFinite(result)) {
      return format ? "0.00" : "0";
    }
    return format ? result.toFixed(2) : String(result);
  } catch (e) {
    console.warn('⚠️ Error evaluando fórmula:', formula, e.message, '| Expresión:', expression);
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
  const cols = Array.isArray(templateCols) ? templateCols : (typeof templateCols === 'string' ? (() => { try { return JSON.parse(templateCols) || []; } catch(e){ return []; } })() : []);
  if (!cols || !cols.length) return row || {};

  // Normaliza un nombre de grupo para comparación resistente a acentos/mayúsculas
  const normGroup = (g) =>
    (g || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .trim();

  // 1. Reconstruir columnNameMap igual que FillForm
  const seenLabels = new Map();
  cols.forEach((col, ci) => {
    const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
    if (!seenLabels.has(lbl)) seenLabels.set(lbl, []);
    seenLabels.get(lbl).push(ci);
  });
  const colNMap = new Map();
  cols.forEach((col, ci) => {
    const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
    colNMap.set(ci, seenLabels.get(lbl).length > 1 ? `${lbl}_col${ci}` : lbl);
  });

  // 2. Determinar el grupo de la columna de fórmula (normalizado)
  const formulaCol = cols[formulaColIndex];
  const colGroupNorm = formulaCol ? normGroup(formulaCol.group) : '';

  // 3. Para cada etiqueta duplicada, seleccionar la instancia más apropiada:
  //    - misma grupo (prioridad máxima) + más cercana por índice
  //    - distinto grupo: fallback con penalización por distancia
  const rowAlias = { ...row };

  seenLabels.forEach((indices, plainLabel) => {
    if (indices.length <= 1) return; // etiqueta única -> evaluarFormula la resuelve directo

    // Ordenar candidatos por prioridad: mismo grupo + cercanía al formulaColIndex
    const candidates = indices.map(ci => {
      const col = cols[ci];
      const ciGroupNorm = normGroup(col ? col.group : '');
      const sameGroup = colGroupNorm !== '' && ciGroupNorm === colGroupNorm;
      const distance = Math.abs(ci - formulaColIndex);
      const score = (sameGroup ? 0 : 1000) + distance;
      return { ci, score, storedKey: colNMap.get(ci) };
    }).sort((a, b) => a.score - b.score);

    // Buscar el mejor candidato que tenga un valor real en el row
    let resolved = false;
    for (const cand of candidates) {
      const { storedKey } = cand;
      if (storedKey && row[storedKey] !== undefined) {
        // Tiene la clave _colN → usar ese valor
        if (storedKey !== plainLabel) {
          rowAlias[plainLabel] = row[storedKey];
        }
        resolved = true;
        break;
      }
    }

    // Si ningún _colN existe en el row, el valor puede estar bajo la clave plana
    // (filas inicializadas con labels planos). El plainLabel ya está en rowAlias (del spread).
    // No necesitamos hacer nada extra — el valor plano se usará tal cual.
    if (!resolved && row[plainLabel] !== undefined) {
      // Ya está en rowAlias por el spread, pero aseguramos que esté
      rowAlias[plainLabel] = row[plainLabel];
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
  const bodyList = Array.isArray(allBodyData) ? allBodyData : (typeof allBodyData === 'string' ? (() => { try { return JSON.parse(allBodyData) || []; } catch(e){ return []; } })() : []);
  if (!Array.isArray(bodyList) || bodyList.length === 0) return rawRow || {};
  const merged = {};
  const crossTableSums = {};
  const crossTableMax = {};
  const crossTableMin = {};
  const crossTableCounts = {};
  
  bodyList.forEach(elData => {
    if (!elData) return;
    
    // 1. Manejar campos de Sección (Variables globales para toda la plantilla)
    if (elData.data && typeof elData.data === 'object' && !Array.isArray(elData.data)) {
      Object.keys(elData.data).forEach(k => {
        if (typeof k !== 'string' || k.startsWith('_')) return;
        
        // Agregar al merged para TODAS las filas
        if (rawRow && rawRow[k] === undefined) {
          merged[k] = elData.data[k];
        }

        const v = parseFloat(elData.data[k]);
        if (!isNaN(v)) {
          crossTableSums[k] = (crossTableSums[k] || 0) + v;
          crossTableMax[k] = crossTableMax[k] === undefined ? v : Math.max(crossTableMax[k], v);
          crossTableMin[k] = crossTableMin[k] === undefined ? v : Math.min(crossTableMin[k], v);
          crossTableCounts[k] = (crossTableCounts[k] || 0) + 1;
        }
      });
      return; // Continuar con el siguiente elemento
    }

    // 2. Manejar Tablas (Arrays de filas)
    const elRows = Array.isArray(elData.data) ? elData.data
      : Array.isArray(elData.rows) ? elData.rows
      : Array.isArray(elData) ? elData
      : (typeof elData.data === 'string' ? (() => { try { return JSON.parse(elData.data) || []; } catch(e){ return []; } })() : []);
      
    elRows.forEach(r => {
      if (!r || r._deleted) return;
      // IMPORTANTE: Ignorar la fila TOTAL para no alterar el MÁXIMO/MÍNIMO real
      if (String(r['N°'] || '').toUpperCase() === 'TOTAL' || String(r['#'] || '').toUpperCase() === 'TOTAL' || r['Métrica'] !== undefined) return;
      
      Object.keys(r).forEach(k => {
        if (typeof k !== 'string' || k.startsWith('_')) return;
        const v = parseFloat(r[k]);
        if (!isNaN(v)) {
          crossTableSums[k] = (crossTableSums[k] || 0) + v;
          crossTableMax[k] = crossTableMax[k] === undefined ? v : Math.max(crossTableMax[k], v);
          crossTableMin[k] = crossTableMin[k] === undefined ? v : Math.min(crossTableMin[k], v);
          crossTableCounts[k] = (crossTableCounts[k] || 0) + 1;
        }
      });
    });
    
    if (rowIndex < elRows.length && elRows[rowIndex] && typeof elRows[rowIndex] === 'object') {
      const otherRow = elRows[rowIndex];
      Object.keys(otherRow).forEach(k => {
        if ((!rawRow || rawRow[k] === undefined) && merged[k] === undefined) {
          merged[k] = otherRow[k];
        }
      });
    }
  });
  
  Object.assign(merged, rawRow || {});
  merged.__crossTableSums__ = crossTableSums;
  merged.__crossTableMax__ = crossTableMax;
  merged.__crossTableMin__ = crossTableMin;
  merged.__crossTableCounts__ = crossTableCounts;
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
  const cols = Array.isArray(templateCols) ? templateCols : (typeof templateCols === 'string' ? (() => { try { return JSON.parse(templateCols) || []; } catch(e){ return []; } })() : []);
  if (!cols || !cols.length) return row || {};

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
      let result = evaluarFormula(col.formula, rowAlias, allRows, rowIndex, false);

      if (colType === 'percentage' && result && result !== 'ERR' && result !== '⚠️') {
        const numVal = parseFloat(result);
        result = isNaN(numVal) ? '0' : String(numVal * 100);
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
