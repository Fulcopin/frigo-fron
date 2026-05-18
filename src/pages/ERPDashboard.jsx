import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../apiConfig';
import * as XLSX from 'xlsx';
import './ERPDashboard.css';

const PAGE_SIZE = 50; // Filas por página para no colapsar el DOM

const ERPDashboard = () => {
    const [rawForms, setRawForms]     = useState([]);
    const [templates, setTemplates]   = useState([]);
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState('');
    const [page, setPage]             = useState(1);

    // Columnas visibles (se arman dinámicamente al cargar datos)
    const [visibleCols, setVisibleCols] = useState(null); // null = todas
    const [showColPanel, setShowColPanel] = useState(false);

    const [filters, setFilters] = useState({
        inicio: new Date(new Date().setDate(new Date().getDate() - 30))
            .toISOString().split('T')[0],
        fin: new Date().toISOString().split('T')[0],
        templateId: '',
        lote: ''
    });

    // ─── Cargar templates ───────────────────────────────────────────────────
    useEffect(() => { loadTemplates(); }, []);

    const loadTemplates = async () => {
        try {
            const res  = await fetch(`${API_BASE_URL}/Templates`);
            const data = await res.json();
            setTemplates(data.$values || data);
        } catch (e) { console.error('Error cargando templates', e); }
    };

    // ─── Fetch ERP ──────────────────────────────────────────────────────────
    const fetchERPData = useCallback(async () => {
        setLoading(true);
        setError('');
        setPage(1);
        try {
            const q = `?inicio=${filters.inicio}&fin=${filters.fin}${
                filters.templateId ? `&templateId=${filters.templateId}` : ''
            }${filters.lote ? `&lote=${encodeURIComponent(filters.lote)}` : ''}`;
            const res = await fetch(`${API_BASE_URL}/FilledForms/erp-report${q}`);
            if (!res.ok) throw new Error(`Error API ${res.status}`);
            const data = await res.json();
            setRawForms(data.$values ?? data);
        } catch (err) {
            setError(err.message);
            setRawForms([]);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    // ─── Parseo seguro ──────────────────────────────────────────────────────
    // BUG FIX: devuelve el tipo correcto (array o objeto) sin colapsar a {}
    const safeParse = (d) => {
        if (d === null || d === undefined) return null;
        if (typeof d === 'object') return d;        // ya parseado
        if (typeof d !== 'string') return null;
        try {
            let p = JSON.parse(d);
            // doble-encoded: string dentro de string
            if (typeof p === 'string') p = JSON.parse(p);
            return p;                               // puede ser [] u {}
        } catch { return null; }
    };

    // Claves internas que NUNCA exportamos
    const IGNORED = new Set([
        'ID','TEMPLATEID','FORMID','CREATEDAT','UPDATEDAT','ISACTIVE',
        'DATA','TYPE','COMPLETED','VERSION','TEMPLATESNAPSHOT',
        'TEMPLATEVERSION','FECHAVERSION','HEADERDATA','BODYDATA','FIRMASDATA',
        'ID_SISTEMA','$ID','$VALUES','_DELETED'
    ]);

    // Limpia y normaliza un nombre de clave para mostrarlo como columna
    const cleanKey = (key, prefix = '') => {
        if (!key) return '';
        let c = String(key)
            .replace(/_T\d+$/i, '').replace(/_col\d+$/i, '')
            .replace(/\./g, '').replace(/_/g, ' ')
            .toUpperCase().trim();
        if (!c) return '';
        if (prefix) {
            let p = String(prefix).toUpperCase()
                .replace(/REGISTRO DE|GENERACI[OÓ]N DE|MATERIAL DE|UTILIZADO EN PROCESO/g, '')
                .replace(/_/g, ' ').trim();
            if (p.includes('PERSONAL')) p = '';
            if (p && !c.includes(p)) return `${p} - ${c}`;
        }
        return c;
    };

    // Verifica si una clave (ya limpia) debe ignorarse
    const isIgnored = (rawKey) => {
        if (!rawKey) return true;
        const upper = String(rawKey).toUpperCase().trim();
        return IGNORED.has(upper) || upper === '' || upper === 'ID';
    };

    // ─── Procesar datos → filas + columnas ──────────────────────────────────
    const { rows, columns } = useMemo(() => {
        const processed  = [];
        const allColKeys = new Set(['FECHA', 'PLANTILLA', 'OBSERVACIONES']);

        rawForms.forEach(form => {
            // Contexto base del formulario (siempre presente)
            const ctx = {
                FECHA:         new Date(form.createdAt).toLocaleDateString('es-EC'),
                PLANTILLA:     form.templateName || 'Desconocido',
                OBSERVACIONES: form.observaciones || '-'
            };

            // ── Agrega un campo al contexto y al set de columnas ──────────────
            const addCtx = (key, value, prefix = '') => {
                if (isIgnored(key)) return;               // clave interna → skip
                const ck = cleanKey(key, prefix);
                if (!ck) return;
                // Saltar valores vacíos, nulos o que sean el propio ID del formulario
                if (value === null || value === undefined || value === '') return;
                const str = String(value).trim();
                if (str === String(form.formID).trim()) return;
                ctx[ck] = typeof value === 'object' ? JSON.stringify(value) : value;
                allColKeys.add(ck);
            };

            // ── 1. HEADER DATA ────────────────────────────────────────────────
            const hdrRaw = safeParse(form.headerData);
            if (hdrRaw) {
                const hdr = Array.isArray(hdrRaw) ? hdrRaw[0] ?? {} : hdrRaw;
                if (typeof hdr === 'object') {
                    Object.entries(hdr).forEach(([k, v]) => addCtx(k, v));
                }
            }

            // ── 2. FIRMAS DATA ────────────────────────────────────────────────
            const firRaw = safeParse(form.firmasData);
            if (firRaw) {
                const processFirma = (puesto, val) => {
                    if (!puesto) return;
                    const nombre = typeof val === 'object'
                        ? (val.nombre || val.name || '')
                        : String(val);
                    if (nombre) {
                        const key = `FIRMA ${String(puesto).toUpperCase().replace(/_/g, ' ')}`;
                        ctx[key] = nombre;
                        allColKeys.add(key);
                    }
                };
                if (Array.isArray(firRaw)) {
                    firRaw.forEach(f => processFirma(f?.puesto ?? f?.puesto, f));
                } else if (typeof firRaw === 'object') {
                    Object.entries(firRaw).forEach(([k, v]) => processFirma(k, v));
                }
            }

            // ── 3. BODY DATA ──────────────────────────────────────────────────
            const bodyRaw = safeParse(form.bodyData);
            if (!bodyRaw) {
                // Sin body → guardar solo el contexto
                processed.push({ ...ctx });
                return;
            }

            // Normalizar a array de elementos
            const bodyEls = Array.isArray(bodyRaw)
                ? bodyRaw
                : Object.values(bodyRaw).filter(v => v && typeof v === 'object');

            // Normaliza cada elemento del body a { rowsData, sectionData, title }
            const normalized = bodyEls.map((el, idx) => {
                if (!el || typeof el !== 'object') return { rowsData: [], sectionData: null, title: `EL_${idx}` };

                let rowsData   = [];
                let sectionData = null;

                // Formato A: { rows: [...] }
                if (Array.isArray(el.rows)) {
                    // Sub-caso: rows contiene un elemento tipo sección
                    if (el.rows.length > 0 && el.rows[0]?.type === 'section' && el.rows[0]?.data) {
                        sectionData = el.rows[0].data;
                    } else {
                        rowsData = el.rows.filter(r => r && typeof r === 'object' && !r._deleted);
                    }
                }
                // Formato B: { data: [...] }
                else if (Array.isArray(el.data)) {
                    rowsData = el.data.filter(r => r && typeof r === 'object' && !r._deleted);
                }
                // Formato C: sección simple { type:'section', data:{...} }
                else if (el.type === 'section' && el.data && typeof el.data === 'object') {
                    sectionData = el.data;
                }
                // Formato D: el.data es objeto plano (no array) → sección
                else if (el.data && typeof el.data === 'object' && !Array.isArray(el.data)) {
                    sectionData = el.data;
                }

                return {
                    rowsData,
                    sectionData,
                    title: el.title || el.name || el.label || `SECCIÓN_${idx}`
                };
            });

            // ── PASADA A: Secciones y campos planos → van al contexto ─────────
            normalized.forEach(({ rowsData, sectionData, title }) => {
                // A1. Sección tipo objeto plano
                if (sectionData && typeof sectionData === 'object') {
                    Object.entries(sectionData).forEach(([k, v]) =>
                        addCtx(k, v, title || 'SECCIÓN')
                    );
                    return;
                }

                // A2. Tabla con filas → aplanar TODAS las filas a contexto
                //     SOLO si se considera tabla auxiliar (sin keywords de tabla principal)
                if (rowsData.length > 0) {
                    // Detectar si es tabla principal (genera fila por fila en pasada B)
                    const sampleKeys = [
                        ...Object.keys(rowsData[0]),
                        ...(rowsData[0].cells?.map(c => c.name || c.columnId) ?? [])
                    ].join(' ').toUpperCase();

                    const isMainTable =
                        sampleKeys.includes('HORA')  ||
                        sampleKeys.includes('TINA')  ||
                        sampleKeys.includes('PESO')  ||
                        sampleKeys.includes('LOTE')  ||
                        sampleKeys.includes('FECHA Y HORA') ||
                        sampleKeys.includes('TEMPERATURA');

                    if (!isMainTable) {
                        // Tabla auxiliar: aplanar TODAS sus filas al contexto
                        rowsData.forEach((row, ri) => {
                            const flat = row.cells
                                ? row.cells.reduce((a, c) =>
                                    ({ ...a, [c.name || c.columnId || `c${ri}`]: c.value }), {})
                                : row;
                            const pref = rowsData.length > 1
                                ? `${title}_F${ri + 1}`   // diferenciar fila si hay múltiples
                                : title;
                            Object.entries(flat).forEach(([k, v]) => addCtx(k, v, pref));
                        });
                    }
                }
            });

            // ── PASADA B: Tabla principal → una fila por registro ─────────────
            let hasDynamic = false;

            normalized.forEach(({ rowsData }) => {
                if (rowsData.length === 0) return;

                const sampleKeys = [
                    ...Object.keys(rowsData[0]),
                    ...(rowsData[0].cells?.map(c => c.name || c.columnId) ?? [])
                ].join(' ').toUpperCase();

                const isMainTable =
                    sampleKeys.includes('HORA')  ||
                    sampleKeys.includes('TINA')  ||
                    sampleKeys.includes('PESO')  ||
                    sampleKeys.includes('LOTE')  ||
                    sampleKeys.includes('FECHA Y HORA') ||
                    sampleKeys.includes('TEMPERATURA');

                if (!isMainTable) return;

                hasDynamic = true;

                rowsData.forEach(row => {
                    if (row._deleted) return;
                    const rd  = { ...ctx };   // hereda header + firmas + secciones
                    let hasData = false;

                    const flat = row.cells
                        ? row.cells.reduce((a, c) =>
                            ({ ...a, [c.name || c.columnId]: c.value }), {})
                        : row;

                    Object.entries(flat).forEach(([k, v]) => {
                        if (isIgnored(k)) return;
                        if (v === '' || v === null || v === undefined) return;
                        if (String(v).trim() === String(form.formID).trim()) return;
                        const ck = cleanKey(k);
                        if (!ck) return;
                        rd[ck] = typeof v === 'object' ? JSON.stringify(v) : v;
                        allColKeys.add(ck);
                        hasData = true;
                    });

                    // Guardar la fila aunque todos sus campos estén vacíos
                    // (igual tiene FECHA, PLANTILLA del contexto)
                    if (hasData || Object.keys(rd).length > 3) {
                        processed.push(rd);
                    }
                });
            });

            // Sin tabla dinámica → el formulario es una sola fila
            if (!hasDynamic) processed.push({ ...ctx });
        });

        // ── Ordenar columnas: sistema primero, luego A-Z ─────────────────────
        const SYS = ['FECHA', 'PLANTILLA', 'OBSERVACIONES'];
        const sorted = Array.from(allColKeys).sort((a, b) => {
            const ai = SYS.indexOf(a), bi = SYS.indexOf(b);
            if (ai !== -1 && bi !== -1) return ai - bi;
            if (ai !== -1) return -1;
            if (bi !== -1) return 1;
            return a.localeCompare(b, 'es');
        });

        return { rows: processed, columns: sorted };
    }, [rawForms]);

    // Cuando cambian las columnas disponibles, inicializar visibleCols con TODAS
    useEffect(() => {
        if (columns.length > 0) setVisibleCols(new Set(columns));
    }, [columns]);

    // ─── Columnas actualmente visibles ──────────────────────────────────────
    const activeCols = useMemo(
        () => columns.filter(c => !visibleCols || visibleCols.has(c)),
        [columns, visibleCols]
    );

    // ─── Paginación ─────────────────────────────────────────────────────────
    const totalPages  = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const pagedRows   = useMemo(
        () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [rows, page]
    );

    // ─── Descarga Excel multi-pestaña (una pestaña por sección) ─────────────
    const downloadExcel = () => {
        const wb = XLSX.utils.book_new();

        // Nombre del archivo
        const fileLabel = filters.templateId
            ? (templates.find(t => String(t.templateID) === String(filters.templateId))?.nombre || 'Reporte')
                  .replace(/[\\/:*?"<>|]/g, '_').substring(0, 40)
            : 'Reporte_General';

        // Función para limpiar el nombre de una pestaña (máx 31 chars, sin chars inválidos)
        const sheetName = (raw, idx) => {
            const clean = String(raw || `Sección ${idx + 1}`)
                .replace(/[\\/:*?"<>\[\]]/g, '')
                .trim()
                .substring(0, 28);
            return clean || `Sec_${idx + 1}`;
        };

        // Columnas de identidad que van en TODAS las pestañas
        const ID_COLS = ['ID_FORMULARIO', 'FECHA', 'PLANTILLA'];

        // ── Mapa: sectionKey → [ { ...campos } ] ──────────────────────────
        // Recorremos rawForms de cero para separar secciones sin mezclarlas
        const sectionMap = new Map();   // key: title de sección → rows[]
        const infoRows   = [];          // pestaña "Info General" (header + firmas)

        rawForms.forEach(form => {
            const base = {
                ID_FORMULARIO: form.formID ?? form.id ?? '',
                FECHA:         new Date(form.createdAt).toLocaleDateString('es-EC'),
                PLANTILLA:     form.templateName || 'Desconocido',
            };

            // ── Header → pestaña Info General ────────────────────────────
            const infoRow = { ...base };
            const hdrRaw = safeParse(form.headerData);
            if (hdrRaw) {
                const hdr = Array.isArray(hdrRaw) ? hdrRaw[0] ?? {} : hdrRaw;
                if (typeof hdr === 'object') {
                    Object.entries(hdr).forEach(([k, v]) => {
                        if (isIgnored(k)) return;
                        const ck = cleanKey(k);
                        if (ck && v !== null && v !== undefined && v !== '') {
                            infoRow[ck] = typeof v === 'object' ? JSON.stringify(v) : v;
                        }
                    });
                }
            }

            // Firmas → también en Info General
            const firRaw = safeParse(form.firmasData);
            if (firRaw) {
                const addFirma = (puesto, val) => {
                    if (!puesto) return;
                    const nombre = typeof val === 'object' ? (val.nombre || val.name || '') : String(val);
                    if (nombre) {
                        infoRow[`FIRMA ${String(puesto).toUpperCase().replace(/_/g, ' ')}`] = nombre;
                    }
                };
                if (Array.isArray(firRaw)) firRaw.forEach(f => addFirma(f?.puesto, f));
                else if (typeof firRaw === 'object') Object.entries(firRaw).forEach(([k, v]) => addFirma(k, v));
            }
            infoRows.push(infoRow);

            // ── Body → una pestaña por elemento (sección/tabla) ──────────
            const bodyRaw = safeParse(form.bodyData);
            if (!bodyRaw) return;

            const bodyEls = Array.isArray(bodyRaw)
                ? bodyRaw
                : Object.values(bodyRaw).filter(v => v && typeof v === 'object');

            bodyEls.forEach((el, idx) => {
                if (!el || typeof el !== 'object') return;

                const title = el.title || el.name || el.label || `Sección ${idx + 1}`;
                const key   = `${idx}__${title}`;   // índice + título para evitar colisiones

                if (!sectionMap.has(key)) sectionMap.set(key, { title, rows: [] });
                const sec = sectionMap.get(key);

                // Detectar filas de datos
                let rowsData = [];
                let sectionData = null;

                if (Array.isArray(el.rows)) {
                    if (el.rows[0]?.type === 'section' && el.rows[0]?.data)
                        sectionData = el.rows[0].data;
                    else rowsData = el.rows.filter(r => r && !r._deleted);
                } else if (Array.isArray(el.data)) {
                    rowsData = el.data.filter(r => r && !r._deleted);
                } else if (el.data && typeof el.data === 'object') {
                    sectionData = el.data;
                } else if (el.type === 'section' && el.data) {
                    sectionData = el.data;
                }

                if (sectionData) {
                    // Sección tipo objeto plano → una fila
                    const rowOut = { ...base };
                    Object.entries(sectionData).forEach(([k, v]) => {
                        if (isIgnored(k)) return;
                        const ck = cleanKey(k);
                        if (ck && v !== null && v !== undefined && v !== '')
                            rowOut[ck] = typeof v === 'object' ? JSON.stringify(v) : v;
                    });
                    sec.rows.push(rowOut);
                } else {
                    // Tabla → una fila por registro
                    rowsData.forEach(row => {
                        const rowOut = { ...base };
                        const flat = row.cells
                            ? row.cells.reduce((a, c) => ({ ...a, [c.name || c.columnId]: c.value }), {})
                            : row;
                        Object.entries(flat).forEach(([k, v]) => {
                            if (isIgnored(k)) return;
                            if (v === '' || v === null || v === undefined) return;
                            if (String(v).trim() === String(form.formID ?? '').trim()) return;
                            const ck = cleanKey(k);
                            if (ck) rowOut[ck] = typeof v === 'object' ? JSON.stringify(v) : v;
                        });
                        sec.rows.push(rowOut);
                    });
                }
            });
        });

        // ── Pestaña 1: Info General (header + firmas) ─────────────────────
        if (infoRows.length > 0) {
            const ws = XLSX.utils.json_to_sheet(infoRows);
            styleSheet(ws, XLSX.utils.decode_range(ws['!ref']));
            XLSX.utils.book_append_sheet(wb, ws, 'Info General');
        }

        // ── Pestañas por sección ───────────────────────────────────────────
        const usedNames = new Set(['Info General']);
        let secIdx = 0;

        sectionMap.forEach(({ title, rows: secRows }, _key) => {
            if (secRows.length === 0) return;

            // Nombre único de pestaña
            let name = sheetName(title, secIdx);
            let attempt = name;
            let n = 2;
            while (usedNames.has(attempt)) attempt = `${name.substring(0, 26)}_${n++}`;
            usedNames.add(attempt);

            const ws = XLSX.utils.json_to_sheet(secRows);
            styleSheet(ws, XLSX.utils.decode_range(ws['!ref']));
            XLSX.utils.book_append_sheet(wb, ws, attempt);
            secIdx++;
        });

        // Fallback: si no hay secciones, exportar la vista plana actual
        if (secIdx === 0 && infoRows.length === 0) {
            const exportRows = rows.map(r =>
                Object.fromEntries(activeCols.map(c => [c, r[c] ?? '-']))
            );
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportRows), 'Datos');
        }

        XLSX.writeFile(wb, `${fileLabel}_${filters.inicio}_${filters.fin}.xlsx`);
    };

    // Aplica ancho automático de columnas y congela la primera fila
    const styleSheet = (ws, range) => {
        if (!range) return;
        // Auto-width por columna
        const cols = [];
        for (let C = range.s.c; C <= range.e.c; C++) {
            let maxLen = 10;
            for (let R = range.s.r; R <= range.e.r; R++) {
                const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
                if (cell && cell.v) maxLen = Math.max(maxLen, String(cell.v).length);
            }
            cols.push({ wch: Math.min(maxLen + 2, 50) });
        }
        ws['!cols'] = cols;
        ws['!freeze'] = { xSplit: 0, ySplit: 1 };   // congela primera fila (encabezado)
    };

    // ─── Nombre del formulario seleccionado ─────────────────────────────────
    const selectedTplName = useMemo(() => {
        if (!filters.templateId) return '';
        return templates.find(t => String(t.templateID) === String(filters.templateId))?.nombre || '';
    }, [filters.templateId, templates]);

    // ─── Toggle columna visible ──────────────────────────────────────────────
    const toggleCol = (col) => {
        setVisibleCols(prev => {
            const next = new Set(prev);
            next.has(col) ? next.delete(col) : next.add(col);
            return next;
        });
    };
    const toggleAll = (val) => {
        setVisibleCols(val ? new Set(columns) : new Set());
    };

    // ─── UI ─────────────────────────────────────────────────────────────────
    return (
        <div className="erp-dashboard">

            {/* ── CABECERA ── */}
            <div className="erp-header">
                <div className="erp-title">
                    <h1>📊 Descargar Datos (ERP)</h1>
                    {selectedTplName && (
                        <p className="erp-tpl-badge">📄 {selectedTplName}</p>
                    )}
                </div>

                <div className="erp-controls">
                    {/* Fechas */}
                    <div className="control-group">
                        <label>Desde</label>
                        <input type="date" value={filters.inicio}
                            onChange={e => setFilters({ ...filters, inicio: e.target.value })} />
                    </div>
                    <div className="control-group">
                        <label>Hasta</label>
                        <input type="date" value={filters.fin}
                            onChange={e => setFilters({ ...filters, fin: e.target.value })} />
                    </div>

                    {/* Filtro por formulario */}
                    <div className="control-group">
                        <label>Formulario</label>
                        <select
                            value={filters.templateId}
                            onChange={e => setFilters({ ...filters, templateId: e.target.value })}
                            className="erp-select-template"
                        >
                            <option value="">— Todos los formularios —</option>
                            {[...templates]
                                .sort((a, b) =>
                                    (a.codigo || '').localeCompare(b.codigo || '', 'es', { numeric: true, sensitivity: 'base' })
                                )
                                .map(t => (
                                    <option key={t.templateID} value={t.templateID}>
                                        {t.codigo ? `[${t.codigo}] ` : ''}{t.nombre}
                                    </option>
                                ))
                            }
                        </select>
                    </div>

                    {/* Filtro por Lote */}
                    <div className="control-group">
                        <label>Lote / Texto</label>
                        <input 
                            type="text" 
                            placeholder="Ej. 260511" 
                            value={filters.lote}
                            onChange={e => setFilters({ ...filters, lote: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && fetchERPData()}
                            title="Busca coincidencias exactas en el formulario"
                        />
                    </div>

                    <button onClick={fetchERPData} className="btn-refresh" disabled={loading}>
                        {loading ? '⏳' : '🔄'} Cargar
                    </button>

                    {/* Selector de columnas */}
                    {columns.length > 0 && (
                        <button
                            className="btn-cols"
                            onClick={() => setShowColPanel(p => !p)}
                            title="Seleccionar columnas visibles"
                        >
                            🗂️ Columnas {visibleCols ? `(${visibleCols.size}/${columns.length})` : ''}
                        </button>
                    )}

                    <button
                        onClick={downloadExcel}
                        className="btn-excel-erp"
                        disabled={rows.length === 0}
                    >
                        📥 Excel
                    </button>
                </div>
            </div>

            {/* ── STATS ── */}
            {rows.length > 0 && (
                <div className="erp-stats">
                    <div className="stat-box">
                        <span className="stat-val">{rows.length}</span>
                        <span className="stat-lbl">Registros</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-val">{activeCols.length}</span>
                        <span className="stat-lbl">Columnas visibles</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-val">{rawForms.length}</span>
                        <span className="stat-lbl">Formularios</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-val">{totalPages}</span>
                        <span className="stat-lbl">Páginas</span>
                    </div>
                </div>
            )}

            {/* ── PANEL COLUMNAS ── */}
            {showColPanel && (
                <div className="col-panel">
                    <div className="col-panel-header">
                        <strong>🗂️ Columnas visibles</strong>
                        <div className="col-panel-actions">
                            <button onClick={() => toggleAll(true)}>✅ Todas</button>
                            <button onClick={() => toggleAll(false)}>❌ Ninguna</button>
                            <button onClick={() => setShowColPanel(false)}>✕ Cerrar</button>
                        </div>
                    </div>
                    <div className="col-panel-list">
                        {columns.map(col => (
                            <label key={col} className="col-item">
                                <input
                                    type="checkbox"
                                    checked={!visibleCols || visibleCols.has(col)}
                                    onChange={() => toggleCol(col)}
                                />
                                <span>{col}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* ── ERROR ── */}
            {error && (
                <div className="erp-error">
                    ⚠️ {error}
                </div>
            )}

            {/* ── TABLA ── */}
            <div className="erp-grid-wrapper">
                {loading ? (
                    <div className="erp-loading">
                        <div className="erp-spinner" />
                        <p>Cargando datos…</p>
                    </div>
                ) : rows.length === 0 ? (
                    <p className="erp-empty">
                        {filters.templateId
                            ? `📭 No hay datos para "${selectedTplName}" en el rango seleccionado.`
                            : '📭 Selecciona un formulario y rango de fechas, luego presiona Cargar.'}
                    </p>
                ) : (
                    <>
                        <table className="erp-table">
                            <thead>
                                <tr>
                                    <th className="th-fixed th-num">#</th>
                                    {activeCols.map(col => (
                                        <th key={col} title={col}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {pagedRows.map((row, i) => (
                                    <tr key={`${page}-${i}`} className={i % 2 === 0 ? '' : 'erp-row-alt'}>
                                        <td className="td-fixed td-num">
                                            {(page - 1) * PAGE_SIZE + i + 1}
                                        </td>
                                        {activeCols.map(col => (
                                            <td key={col} title={String(row[col] ?? '')}>
                                                {row[col] ?? <span className="td-empty">—</span>}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* ── PAGINACIÓN ── */}
                        {totalPages > 1 && (
                            <div className="erp-pagination">
                                <button onClick={() => setPage(1)} disabled={page === 1}>«</button>
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
                                <span>Página <strong>{page}</strong> de <strong>{totalPages}</strong></span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
                                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
                                <span className="pag-info">{rows.length} registros · {PAGE_SIZE}/página</span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ERPDashboard;