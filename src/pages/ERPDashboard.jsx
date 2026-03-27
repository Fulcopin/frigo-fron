import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../apiConfig';
import * as XLSX from 'xlsx';
import './ERPDashboard.css';

const ERPDashboard = () => {
    const [rawForms, setRawForms] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    
    const [filters, setFilters] = useState({
        inicio: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        fin: new Date().toISOString().split('T')[0],
        templateId: ''
    });

    useEffect(() => {
        loadTemplates();
        fetchERPData();
    }, []);

    const loadTemplates = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/Templates`);
            const data = await res.json();
            setTemplates(data.$values || data);
        } catch (e) { console.error("Error cargando templates", e); }
    };

    const fetchERPData = async () => {
        setLoading(true);
        try {
            const query = `?inicio=${filters.inicio}&fin=${filters.fin}${filters.templateId ? `&templateId=${filters.templateId}` : ''}`;
            const res = await fetch(`${API_BASE_URL}/FilledForms/erp-report${query}`);
            
            if (!res.ok) throw new Error("Error en API");
            
            const data = await res.json();
            const forms = data.$values || data;
            
            console.log("📦 Formularios cargados:", forms.length);
            setRawForms(forms);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const safeParse = (data) => {
        if (!data) return {};
        if (typeof data === 'object') return data;
        try {
            const parsed = JSON.parse(data);
            if (typeof parsed === 'string') return safeParse(parsed);
            return parsed;
        } catch (e) { return {}; }
    };

    // 🧹 LIMPIEZA DE COLUMNAS
    const cleanKeyName = (key, prefix = '') => {
        if (!key) return '';
        let clean = key;
        
        // Limpiezas base
        clean = clean.replace(/_T\d+$/i, '').replace(/_t\d+$/i, ''); 
        clean = clean.replace(/_col\d+$/i, ''); 
        clean = clean.replace(/\./g, '').replace(/_/g, ' ').toUpperCase().trim();

        // GESTIÓN DE PREFIJOS
        if (prefix) {
            let cleanPrefix = prefix.toUpperCase()
                .replace(/REGISTRO DE/g, '')
                .replace(/GENERACIÓN DE/g, '')
                .replace(/MATERIAL DE/g, '') 
                .replace(/UTILIZADO EN PROCESO/g, '')
                .replace(/_/g, ' ')
                .trim();
            
            // Regla: Si es PERSONAL, quitamos el prefijo
            if (cleanPrefix.includes('PERSONAL')) cleanPrefix = '';

            if (cleanPrefix && !clean.includes(cleanPrefix)) {
                return `${cleanPrefix} - ${clean}`;
            }
        }
        return clean;
    };

    const IGNORED_FIELDS = [
        'ID', 'TEMPLATEID', 'FORMID', 'CREATEDAT', 'UPDATEDAT', 'ISACTIVE', 
        'DATA', 'TYPE', 'COMPLETED', 'VERSION', 'TEMPLATESNAPSHOT', 
        'TEMPLATEVERSION', 'FECHAVERSION', 'HEADERDATA', 'BODYDATA', 'FIRMASDATA',
        'ID_SISTEMA', '$ID', '$VALUES'
    ];

    const { rows, columns } = useMemo(() => {
        const processedRows = [];
        const allColumnKeys = new Set();
        
        const systemCols = ['FECHA', 'PLANTILLA', 'OBSERVACIONES'];
        systemCols.forEach(c => allColumnKeys.add(c));
        
        rawForms.forEach(form => {
            // Contexto Global
            const globalContext = {
                FECHA: new Date(form.createdAt).toLocaleDateString('es-EC'),
                PLANTILLA: form.templateName || 'Desconocido',
                OBSERVACIONES: form.observaciones || '-'
            };

            const addToContext = (key, value, prefix = '') => {
                const cleanKey = cleanKeyName(key, prefix);
                if (IGNORED_FIELDS.includes(cleanKeyName(key))) return; 
                if (value === null || value === "" || value === undefined) return;
                if (String(value).trim() === String(form.formID).trim()) return;

                globalContext[cleanKey] = typeof value === 'object' ? JSON.stringify(value) : value;
                allColumnKeys.add(cleanKey);
            };

            // 1. HEADER
            let headerData = safeParse(form.headerData);
            if (Array.isArray(headerData)) headerData = headerData[0] || {};
            Object.entries(headerData).forEach(([k, v]) => addToContext(k, v));

            // 2. FIRMAS
            const firmasData = safeParse(form.firmasData);
            if (firmasData) {
                const processFirma = (puesto, val) => {
                     if (!puesto) return;
                     const key = `FIRMA ${puesto.toUpperCase().replace(/_/g, " ")}`;
                     const nombre = typeof val === 'object' ? val.nombre : val;
                     if (nombre) addToContext(key, nombre);
                };
                if (Array.isArray(firmasData)) firmasData.forEach(f => processFirma(f.puesto, f));
                else Object.entries(firmasData).forEach(([k, v]) => processFirma(k, v));
            }

            // 3. RECUPERAR TÍTULOS (CRUCIAL)
            const titleMap = {};
            // Intentamos sacar la definición del template si viene en el objeto
            const templateDef = form.template || {}; 
            const rawBodyElements = templateDef.BodyElements || templateDef.bodyElements;
            
            if (rawBodyElements) {
                const elements = safeParse(rawBodyElements);
                if (Array.isArray(elements)) {
                    elements.forEach(el => {
                        if (el.id && (el.title || el.Title)) {
                            titleMap[String(el.id)] = el.title || el.Title;
                        }
                    });
                }
            }

            // 4. PROCESAR BODY DATA (Lógica corregida para tu JSON)
            const bodyRaw = safeParse(form.bodyData);
            let bodyElements = Array.isArray(bodyRaw) ? bodyRaw : Object.values(bodyRaw);
            
            const normalizedElements = bodyElements.map((element, index) => {
                let rowsData = [];
                let sectionData = null;

                // A. Detectar si viene envuelto en 'rows' (Formato Form 57)
                if (element.rows && Array.isArray(element.rows)) {
                    // CASO ESPECIAL: Sección anidada en rows (Tu caso de Personal)
                    if (element.rows.length > 0 && element.rows[0].type === 'section' && element.rows[0].data) {
                        sectionData = element.rows[0].data;
                    } else {
                        rowsData = element.rows;
                    }
                }
                // B. Detectar formato 'data' directo (Formato Form 56)
                else if (element.data && Array.isArray(element.data)) {
                    rowsData = element.data;
                }
                // C. Detectar Sección legacy
                else if (element.type === 'section' && element.data) {
                    sectionData = element.data;
                }

                // Obtener título real del mapa
                let realTitle = titleMap[String(element.id)] || element.title || '';
                
                // Si no hay título y NO es la tabla principal (tiene cantidades), inventamos uno para evitar colisión
                if (!realTitle && rowsData.length > 0) {
                     const keys = Object.keys(rowsData[0]).join('').toUpperCase();
                     if (!keys.includes('HORA') && !keys.includes('TINA') && !keys.includes('PESO')) {
                         realTitle = `TABLA ${index}`; // Fallback para que no se mezclen cantidades
                     }
                }

                return { rows: rowsData, sectionData, title: realTitle };
            });

            // 🔄 PASADA 1: COSECHA (Personal, Empaque, Subproductos)
            normalizedElements.forEach(({ rows, sectionData, title }) => {
                // A. SECCIONES (Personal)
                if (sectionData) {
                    Object.entries(sectionData).forEach(([k, v]) => addToContext(k, v, title || 'PERSONAL'));
                }
                
                // B. TABLAS AUXILIARES
                else if (rows.length > 0) {
                    const firstRow = rows[0];
                    const keys = Object.keys(firstRow);
                    const cellNames = firstRow.cells ? firstRow.cells.map(c => c.name || c.columnId) : [];
                    const allKeys = [...keys, ...cellNames].join(' ').toUpperCase();
                    
                    const isMainTable = allKeys.includes('HORA') || allKeys.includes('TINA') || allKeys.includes('PESO') || allKeys.includes('LOTE DE PROCESO');

                    // Si NO es la tabla principal de fileteo/túneles, es auxiliar (Empaque/Subproductos)
                    if (!isMainTable) {
                        const prefix = title ? title.toUpperCase() : `EXTRA ${Math.floor(Math.random()*100)}`;
                        
                        const flatRow = firstRow.cells ? 
                            firstRow.cells.reduce((acc, c) => ({...acc, [c.name||c.columnId]: c.value}), {}) : 
                            firstRow;

                        Object.entries(flatRow).forEach(([k, v]) => addToContext(k, v, prefix));
                    }
                }
            });

            // 🔄 PASADA 2: GENERACIÓN DE FILAS (Producción)
            let hasDynamicTables = false;
            
            normalizedElements.forEach(({ rows }) => {
                if (rows.length === 0) return;
                
                const firstRow = rows[0];
                const keys = Object.keys(firstRow);
                const cellNames = firstRow.cells ? firstRow.cells.map(c => c.name || c.columnId) : [];
                const allKeys = [...keys, ...cellNames].join(' ').toUpperCase();
                
                // Criterio ampliado para detectar tabla principal
                const isMainTable = allKeys.includes('HORA') || allKeys.includes('TINA') || allKeys.includes('PESO') || allKeys.includes('LOTE DE PROCESO');

                if (isMainTable) {
                    hasDynamicTables = true;
                    rows.forEach(row => {
                        const rowData = { ...globalContext };
                        let hasRowData = false;
                        
                        const flatRow = row.cells ? 
                            row.cells.reduce((acc, c) => ({...acc, [c.name||c.columnId]: c.value}), {}) : 
                            row;

                        Object.entries(flatRow).forEach(([k, v]) => {
                            const cleanKey = cleanKeyName(k);
                            if (!IGNORED_FIELDS.includes(cleanKey) && k !== 'id' && v !== "" && v != null) {
                                if (String(v).trim() !== String(form.formID).trim()) {
                                    rowData[cleanKey] = typeof v === 'object' ? JSON.stringify(v) : v;
                                    allColumnKeys.add(cleanKey);
                                    hasRowData = true;
                                }
                            }
                        });
                        if (hasRowData) processedRows.push(rowData);
                    });
                }
            });

            if (!hasDynamicTables) processedRows.push(globalContext);
        });

        // Ordenar columnas
        const sortedCols = Array.from(allColumnKeys).sort((a, b) => {
            if (systemCols.includes(a)) return -1;
            if (systemCols.includes(b)) return 1;
            return a.localeCompare(b);
        });
        
        return { rows: processedRows, columns: sortedCols };
    }, [rawForms]);

    const downloadExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Maestro");
        XLSX.writeFile(workbook, `Reporte_${filters.inicio}.xlsx`);
    };

    return (
        <div className="erp-dashboard">
            <div className="erp-header">
                <h1>📊 Reporte General (ERP)</h1>
                <div className="erp-controls">
                    <input type="date" value={filters.inicio} onChange={e => setFilters({...filters, inicio: e.target.value})} />
                    <input type="date" value={filters.fin} onChange={e => setFilters({...filters, fin: e.target.value})} />
                    <select value={filters.templateId} onChange={e => setFilters({...filters, templateId: e.target.value})}>
                        <option value="">-- Todas las plantillas --</option>
                        {[...templates]
                            .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', 'es', { numeric: true, sensitivity: 'base' }))
                            .map((t) => (
                                <option key={t.templateID} value={t.templateID}>
                                    {t.codigo ? `[${t.codigo}] ` : ''}{t.nombre}
                                </option>
                            ))
                        }
                    </select>
                    <button onClick={fetchERPData} className="btn-refresh">🔄 Cargar</button>
                    <button onClick={downloadExcel} className="btn-excel-erp" disabled={rows.length === 0}>📥 Excel</button>
                </div>
            </div>

            <div className="erp-grid-wrapper">
                {loading ? <p>Cargando datos...</p> : 
                rows.length === 0 ? <p className="erp-empty">No hay datos para mostrar</p> :
                <table className="erp-table">
                    <thead>
                        <tr>
                            {columns.map(col => <th key={col}>{col}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i}>
                                {columns.map(col => <td key={`${i}-${col}`}>{row[col] || '-'}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>}
            </div>
        </div>
    );
};

export default ERPDashboard;