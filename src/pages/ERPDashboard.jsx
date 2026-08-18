import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../apiConfig';
import * as XLSX from 'xlsx';
import { ordenarFormularios, etiquetaFormulario } from '../utils/ordenFormularios';
import authService from '../services/authService';
import './ERPDashboard.css';

const PAGE_SIZE = 50; // Filas por página para no colapsar el DOM

// ─── ¿Es la tabla de registros del formulario? ──────────────────────────────
// Las tablas "principales" generan una fila por registro en el reporte; el
// resto (listas de personal, materiales, etc.) se aplanan al encabezado.
const KEYWORDS_TABLA_PRINCIPAL = ['HORA', 'TINA', 'PESO', 'LOTE', 'FECHA Y HORA', 'TEMPERATURA', 'LIBRAS'];

const esTablaPrincipal = (rowsData) => {
    if (!rowsData || rowsData.length === 0) return false;
    const sampleKeys = [
        ...Object.keys(rowsData[0]),
        ...(rowsData[0].cells?.map(c => c.name || c.columnId) ?? [])
    ].join(' ').toUpperCase();
    return KEYWORDS_TABLA_PRINCIPAL.some(k => sampleKeys.includes(k));
};

// Pasa una fila cruda ({ cells: [...] } o plana) a un objeto { clave: valor }
const aplanarFila = (row, ri = 0) => row.cells
    ? row.cells.reduce((a, c) => ({ ...a, [c.name || c.columnId || `c${ri}`]: c.value }), {})
    : row;

// ─── Números: parseo tolerante (rechaza horas, códigos y textos) ────────────
const parseNum = (v) => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    let s = String(v).trim();
    if (!s) return null;
    if (/[a-zA-Z:/%]/.test(s)) return null;          // 16:00, EM-PLT-014, 12%
    s = s.replace(/\s/g, '');
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s))      // 1.234,56 → 1234.56
        s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
};

const fmtNum = (n) =>
    Number.isInteger(n) ? n.toLocaleString('es-EC')
                        : n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Configuración del resumen, guardada POR FORMULARIO ─────────────────────
// Cada plantilla necesita su propio armado: en un PD-04 interesan las libras y
// el personal, en un control de termómetros interesan otras columnas. Sin esto
// hay que volver a marcar todo cada vez que se cambia de formulario.
const CONFIG_KEY = 'erp-resumen-config-v1';

const claveConfig = (templateId) => String(templateId || '__TODOS__');

const leerConfigs = () => {
    try {
        return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') || {};
    } catch {
        return {};   // guardado corrupto: se empieza de cero, no se rompe la pantalla
    }
};

const escribirConfigs = (configs) => {
    try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(configs));
        return true;
    } catch {
        return false;   // sin espacio o modo privado
    }
};

// El servidor es la fuente de verdad: la configuración se arma una vez y la usa
// toda la planta desde cualquier computadora. El localStorage queda solo como
// respaldo para cuando el backend no responde.
const parseJson = (txt, fallback) => {
    try { return JSON.parse(txt); } catch { return fallback; }
};

const configDesdeServidor = (c) => c && {
    visibleCols:          parseJson(c.columnasVisibles, []),
    opPorCol:             parseJson(c.operaciones, {}),
    unaLineaPorForm:      c.unaLineaPorForm,
    ocultarVacias:        c.ocultarVacias,
    compactarFilas:       c.compactarFilas,
    omitirTotalesDelForm: c.omitirTotalesDelForm,
    subtotalPorForm:      c.subtotalPorForm,
    modoResumen:          c.modoResumen,
    agruparPor:           c.agruparPor ?? '',
    actualizadoPor:       c.actualizadoPor,
    updatedAt:            c.updatedAt,
    delServidor:          true,
};

// ─── Acumulador de totales ─────────────────────────────────────────────────
// Lo usan tanto el modo resumen (un acumulador por grupo) como la barra de
// filas seleccionadas, para que los dos totalicen con el mismo criterio.
const nuevoGrupo = (label, cols) => ({
    label,
    count: 0,
    formularios: new Set(),
    vistos: new Set(),   // claves col|formulario ya contadas (datos del encabezado)
    sums: Object.fromEntries(cols.map(c => [c, { sum: 0, n: 0, min: null, max: null }]))
});

const acumularFila = (g, r, cols) => {
    g.count++;
    g.formularios.add(r.__formId);

    cols.forEach(c => {
        const n = parseNum(r[c]);
        if (n === null) return;

        // Los valores del encabezado se repiten en cada fila del mismo
        // formulario: si se sumaran fila a fila, un dato único quedaría
        // multiplicado por la cantidad de filas.
        if (r.__ctxKeys?.has(c)) {
            const clave = `${c}|${r.__formId}`;
            if (g.vistos.has(clave)) return;
            g.vistos.add(clave);
        }

        const acc = g.sums[c];
        acc.sum += n;
        acc.n++;
        acc.min = acc.min === null ? n : Math.min(acc.min, n);
        acc.max = acc.max === null ? n : Math.max(acc.max, n);
    });
};

const ERPDashboard = () => {
    const [rawForms, setRawForms]     = useState([]);
    const [templates, setTemplates]   = useState([]);
    const [loading, setLoading]       = useState(false);
    const [progreso, setProgreso]     = useState(null); // { traidos, total } mientras carga por tandas
    const [error, setError]           = useState('');
    const [page, setPage]             = useState(1);

    // Columnas visibles (se arman dinámicamente al cargar datos)
    const [visibleCols, setVisibleCols] = useState(null); // null = todas
    const [showColPanel, setShowColPanel] = useState(false);
    const [showCroquis, setShowCroquis]   = useState(false);   // dibujo del formulario

    const [colSearch, setColSearch]     = useState('');   // buscador dentro del panel
    const [modoSeleccion, setModoSeleccion] = useState(false); // checks en la cabecera

    // Une las tablas de un mismo formulario en una sola fila (por posición) y
    // descarta las filas que quedan sin ningún dato. Sin esto el Excel sale con
    // las filas dispersas: una trae solo las horas, la siguiente solo las libras.
    const [compactarFilas, setCompactarFilas] = useState(true);

    // Deja fuera del reporte las columnas que no tienen ni un dato, para que
    // el Excel salga corrido y sin huecos en el medio.
    const [ocultarVacias, setOcultarVacias] = useState(true);

    // Corta con un subtotal cada vez que cambia de formulario y cierra con el
    // total general al final.
    const [subtotalPorForm, setSubtotalPorForm] = useState(true);

    // Descarta las líneas de TOTAL que trae el propio formulario. Si se dejan,
    // el subtotal por formulario cuenta dos veces las mismas libras.
    // Arranca apagado: es una deducción, conviene mirarla antes de confiar.
    const [omitirTotalesDelForm, setOmitirTotalesDelForm] = useState(false);

    // Junta las filas marcadas en UNA sola línea. Las no marcadas siguen
    // saliendo una por una, sin huecos entre medio.
    const [fusionarMarcadas, setFusionarMarcadas] = useState(false);

    // Colapsa CADA formulario en una sola línea con sus totales ya calculados:
    // el resumen lineal, una fila por documento y sin huecos.
    const [unaLineaPorForm, setUnaLineaPorForm] = useState(false);

    // Configuración guardada de ESTE formulario (viene del servidor).
    // Se declara acá arriba porque el efecto que restaura las columnas la usa
    // como dependencia y se evalúa durante el render.
    const [configForm, setConfigForm] = useState({ estado: 'cargando', data: null });
    const [configGuardadaAviso, setConfigGuardadaAviso] = useState('');

    // Modo resumen (tabla dinámica): en vez de fila por fila, muestra totales
    const [modoResumen, setModoResumen] = useState(false);
    const [agruparPor, setAgruparPor]   = useState('');   // '' = un solo total general

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
    // Cada registro viaja con su encabezado, cuerpo y firmas completos, así que
    // un rango de meses en un solo pedido son muchos megas y el servidor se
    // ahoga. Se pide de a tandas y se van juntando: el peso de cada respuesta
    // queda acotado y se puede mostrar el avance.
    const TANDA = 200;
    const MAX_REGISTROS = 5000;   // freno para no colgar el navegador

    const fetchERPData = useCallback(async () => {
        setLoading(true);
        setError('');
        setPage(1);
        setProgreso(null);

        const base = `?inicio=${filters.inicio}&fin=${filters.fin}${
            filters.templateId ? `&templateId=${filters.templateId}` : ''
        }${filters.lote ? `&lote=${encodeURIComponent(filters.lote)}` : ''}`;

        try {
            const acumulado = [];
            let pagina = 1;
            let total = null;

            for (;;) {
                const url = `${API_BASE_URL}/FilledForms/erp-report${base}&pagina=${pagina}&tamano=${TANDA}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`Error API ${res.status}`);
                const data = await res.json();

                const tanda = data.datos?.$values ?? data.datos ?? data.$values ?? data;
                if (!Array.isArray(tanda)) throw new Error('Respuesta inesperada del servidor');

                acumulado.push(...tanda);
                total = data.total ?? acumulado.length;
                setProgreso({ traidos: acumulado.length, total });

                if (!data.hayMas || tanda.length === 0) break;

                if (acumulado.length >= MAX_REGISTROS) {
                    setError(`Se cargaron los primeros ${acumulado.length} registros de ${total}. Acortá el rango de fechas o filtrá por formulario para ver el resto.`);
                    break;
                }
                pagina++;
            }

            setRawForms(acumulado);
        } catch (err) {
            setError(err.message);
            setRawForms([]);
        } finally {
            setLoading(false);
            setProgreso(null);
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
    const { rows, columns, formLabels, origenCols } = useMemo(() => {
        const processed  = [];
        const allColKeys = new Set(['N° REGISTRO', 'CODIGO', 'FECHA', 'PLANTILLA', 'OBSERVACIONES']);

        // De dónde salió cada columna. Con 40 columnas en una lista plana no hay
        // forma de saber cuál es el lote del encabezado, cuál el peso de una
        // tabla y cuál la firma: agrupadas por origen se eligen de a bloques.
        const origen = new Map([
            ['N° REGISTRO', 'sistema'], ['CODIGO', 'sistema'],
            ['FECHA', 'sistema'], ['PLANTILLA', 'sistema'], ['OBSERVACIONES', 'sistema'],
        ]);
        const marcarOrigen = (ck, tipo) => { if (!origen.has(ck)) origen.set(ck, tipo); };
        // formId → contexto del formulario (referencia viva: se completa durante
        // el procesado). Sirve para poder agrupar por documento individual: en un
        // mismo día se llenan varios formularios y hay que poder separarlos.
        const ctxPorForm = new Map();

        rawForms.forEach((form, formIdx) => {
            // Contexto base del formulario (siempre presente).
            // N° REGISTRO y CODIGO son la identidad del documento: sin ellos, en
            // el resumen de una línea por formulario no hay forma de saber a qué
            // registro corresponde cada renglón (dos del mismo día y la misma
            // plantilla se ven idénticos).
            const ctx = {
                'N° REGISTRO': form.formID ?? form.id ?? '',
                CODIGO:        form.formCode || form.codigo || form.templateCodigo || '',
                FECHA:         new Date(form.createdAt).toLocaleDateString('es-EC'),
                PLANTILLA:     form.templateName || 'Desconocido',
                OBSERVACIONES: form.observaciones || '-'
            };

            // ── Agrega un campo al contexto y al set de columnas ──────────────
            const addCtx = (key, value, prefix = '', tipo = 'seccion') => {
                if (isIgnored(key)) return;               // clave interna → skip
                const ck = cleanKey(key, prefix);
                if (!ck) return;
                // Saltar valores vacíos, nulos o que sean el propio ID del formulario
                if (value === null || value === undefined || value === '') return;
                const str = String(value).trim();
                if (str === String(form.formID).trim()) return;
                ctx[ck] = typeof value === 'object' ? JSON.stringify(value) : value;
                allColKeys.add(ck);
                marcarOrigen(ck, tipo);
            };

            // ── 1. HEADER DATA ────────────────────────────────────────────────
            const hdrRaw = safeParse(form.headerData);
            if (hdrRaw) {
                const hdr = Array.isArray(hdrRaw) ? hdrRaw[0] ?? {} : hdrRaw;
                if (typeof hdr === 'object') {
                    // Los campos del título del formulario: fecha, lote, especie…
                    Object.entries(hdr).forEach(([k, v]) => addCtx(k, v, '', 'encabezado'));
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
                        marcarOrigen(key, 'firma');
                    }
                };
                if (Array.isArray(firRaw)) {
                    firRaw.forEach(f => processFirma(f?.puesto ?? f?.puesto, f));
                } else if (typeof firRaw === 'object') {
                    Object.entries(firRaw).forEach(([k, v]) => processFirma(k, v));
                }
            }

            // ── 3. BODY DATA ──────────────────────────────────────────────────
            // Identidad del formulario + marca de qué claves vienen del
            // encabezado: esos valores se repiten en TODAS las filas del mismo
            // formulario, así que al totalizar solo pueden contarse una vez.
            const formId = String(form.formID ?? form.id ?? `s/n-${formIdx}`);
            ctxPorForm.set(formId, ctx);
            const marcarCtx = (fila, clavesDelCuerpo = null) => {
                const ctxKeys = new Set(Object.keys(ctx));
                if (clavesDelCuerpo) clavesDelCuerpo.forEach(k => ctxKeys.delete(k));
                return { ...fila, __formId: formId, __ctxKeys: ctxKeys };
            };

            const bodyRaw = safeParse(form.bodyData);
            if (!bodyRaw) {
                // Sin body → guardar solo el contexto
                processed.push(marcarCtx({ ...ctx }));
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
                if (rowsData.length > 0 && !esTablaPrincipal(rowsData)) {
                    // Tabla auxiliar: aplanar TODAS sus filas al contexto
                    rowsData.forEach((row, ri) => {
                        const flat = aplanarFila(row, ri);
                        const pref = rowsData.length > 1
                            ? `${title}_F${ri + 1}`   // diferenciar fila si hay múltiples
                            : title;
                        Object.entries(flat).forEach(([k, v]) => addCtx(k, v, pref));
                    });
                }
            });

            // ── PASADA B: Tablas principales → filas de registros ─────────────
            const tablasPrincipales = normalized
                .map(({ rowsData }) => rowsData.filter(r => !r._deleted))
                .filter(rowsData => esTablaPrincipal(rowsData));

            const hasDynamic = tablasPrincipales.length > 0;

            // Vuelca una fila cruda sobre el objeto del reporte.
            // Devuelve true si aportó algo REAL. Los renglones en blanco de la
            // plantilla no vienen del todo vacíos: las columnas con fórmula
            // (% RENDIMIENTO, TOTAL...) traen un 0. Si el 0 contara como dato,
            // esos renglones se colaban igual al Excel.
            const volcarFila = (row, rd, clavesDelCuerpo) => {
                let aporto = false;
                let numeros = 0;   // valores numéricos distintos de 0
                let textos  = 0;   // producto, lote, horas… lo que identifica la fila
                Object.entries(aplanarFila(row)).forEach(([k, v]) => {
                    if (isIgnored(k)) return;
                    if (v === '' || v === null || v === undefined) return;
                    if (String(v).trim() === String(form.formID).trim()) return;
                    const ck = cleanKey(k);
                    if (!ck) return;
                    rd[ck] = typeof v === 'object' ? JSON.stringify(v) : v;
                    clavesDelCuerpo.add(ck);   // dato propio de la fila, no del encabezado
                    allColKeys.add(ck);
                    marcarOrigen(ck, 'tabla');

                    const n = parseNum(v);
                    if (n === 0) return;       // el 0 solo no hace fila
                    aporto = true;
                    if (n === null) textos++; else numeros++;
                });
                return { aporto, numeros, textos };
            };

            if (compactarFilas && hasDynamic) {
                // Un formulario puede traer VARIAS tablas principales (por ejemplo una
                // con horarios y personal y otra con las libras). Emitiéndolas por
                // separado el Excel salía con las filas dispersas: cada fila traía
                // llenas solo las columnas de SU tabla y vacías las de la otra.
                // Acá se unen por posición: la fila N de cada tabla forma UNA sola
                // fila del reporte, que es como se llenan en planta.
                const maxFilas = Math.max(...tablasPrincipales.map(t => t.length));

                for (let i = 0; i < maxFilas; i++) {
                    const rd = { ...ctx };   // hereda header + firmas + secciones
                    const clavesDelCuerpo = new Set();
                    let hasData = false, numeros = 0, textos = 0;

                    tablasPrincipales.forEach(tabla => {
                        const row = tabla[i];
                        if (!row) return;
                        const res = volcarFila(row, rd, clavesDelCuerpo);
                        if (res.aporto) hasData = true;
                        numeros += res.numeros;
                        textos  += res.textos;
                    });

                    // Fila sin ningún dato propio: no aporta nada al Excel, solo ruido.
                    if (!hasData) continue;

                    // Línea de TOTAL del propio formulario: trae números pero
                    // ningún dato que la identifique (sin producto, sin lote, sin
                    // hora). Si se deja, el subtotal cuenta dos veces lo mismo.
                    if (omitirTotalesDelForm && numeros > 0 && textos === 0) continue;

                    processed.push(marcarCtx(rd, clavesDelCuerpo));
                }
            } else {
                tablasPrincipales.forEach(rowsData => {
                    rowsData.forEach(row => {
                        const rd = { ...ctx };
                        const clavesDelCuerpo = new Set();
                        const { aporto: hasData } = volcarFila(row, rd, clavesDelCuerpo);

                        // Guardar la fila aunque todos sus campos estén vacíos
                        // (igual tiene FECHA, PLANTILLA del contexto)
                        if (hasData || Object.keys(rd).length > 3) {
                            processed.push(marcarCtx(rd, clavesDelCuerpo));
                        }
                    });
                });
            }

            // Sin tabla dinámica → el formulario es una sola fila
            if (!hasDynamic) processed.push(marcarCtx({ ...ctx }));
        });

        // ── Ordenar columnas ─────────────────────────────────────────────────
        // Se respeta el ORDEN DEL FORMULARIO (allColKeys se llenó en ese orden:
        // encabezado, firmas, secciones y por último las columnas de las tablas).
        // Ordenar A-Z partía columnas que se leen juntas: HORA INICIO y HORA FIN
        // quedaban separadas por LIBRAS, y así se lee mucho peor en el Excel.
        const SYS = ['N° REGISTRO', 'CODIGO', 'FECHA', 'PLANTILLA', 'OBSERVACIONES'];
        const sorted = Array.from(allColKeys).sort((a, b) => {
            const ai = SYS.indexOf(a), bi = SYS.indexOf(b);
            if (ai !== -1 && bi !== -1) return ai - bi;
            if (ai !== -1) return -1;
            if (bi !== -1) return 1;
            return 0;   // estable: mantiene el orden de aparición en el formulario
        });

        // ── Etiqueta legible de cada formulario individual ───────────────────
        // "2026-07-10 · Lote 260710 · CONTROL DE PRODUCCIÓN · #482"
        const etiquetas = new Map();
        ctxPorForm.forEach((ctx, id) => {
            const claveLote = Object.keys(ctx)
                .find(k => /LOTE/.test(k) && !/PADRE|HIJO/.test(k) && String(ctx[k] ?? '').trim());
            const partes = [
                ctx.FECHA,
                claveLote ? `Lote ${ctx[claveLote]}` : null,
                ctx.PLANTILLA,
                `#${id}`,
            ].filter(Boolean);
            etiquetas.set(id, partes.join(' · '));
        });

        return { rows: processed, columns: sorted, formLabels: etiquetas, origenCols: origen };
    }, [rawForms, compactarFilas, omitirTotalesDelForm]);

    // Al llegar datos nuevos: si este formulario tiene una configuración
    // guardada, se respetan las columnas que eligió el usuario; si no, todas.
    useEffect(() => {
        if (columns.length === 0) return;
        if (configForm.estado !== 'lista') return;   // esperar la respuesta del servidor

        const guardada = configForm.data;
        if (guardada?.visibleCols?.length) {
            // Cargar todas las columnas guardadas (incluyendo las que actualmente
            // no tienen datos en el rango — el usuario las eligió explícitamente).
            setVisibleCols(new Set(guardada.visibleCols.length ? guardada.visibleCols : columns));
        } else {
            setVisibleCols(new Set(columns));
        }
    }, [columns, configForm]);

    // ─── Columnas actualmente visibles ──────────────────────────────────────
    // activeCols  = las marcadas → son las que se exportan al Excel
    // colsMostradas = lo que se dibuja en pantalla; en modo selección se
    //                 muestran TODAS (las desmarcadas en gris) para poder
    //                 volver a marcarlas desde la misma cabecera
    const marcadasCols = useMemo(() => {
        // Columnas con datos reales que están marcadas
        const fromData = columns.filter(c => !visibleCols || visibleCols.has(c));
        // Columnas elegidas explícitamente en el croquis que aún no tienen datos
        // en el rango actual (p.ej. columnas de totales o de otro período).
        if (!visibleCols) return fromData;
        const dataSet = new Set(columns);
        const extras = Array.from(visibleCols).filter(c => !dataSet.has(c));
        return extras.length > 0 ? [...fromData, ...extras] : fromData;
    }, [columns, visibleCols]);

    // ─── Columnas numéricas (candidatas a sumarse) ──────────────────────────
    // El N° de registro es un identificador: sumarlo no significa nada.
    const NO_SUMABLES = new Set(['N° REGISTRO', 'CODIGO', 'FECHA', 'PLANTILLA', 'OBSERVACIONES']);

    const numericCols = useMemo(() => {
        return columns.filter(col => {
            if (NO_SUMABLES.has(col)) return false;
            let num = 0, tot = 0;
            for (const r of rows) {
                const v = r[col];
                if (v === undefined || v === null || v === '') continue;
                tot++;
                if (parseNum(v) !== null) num++;
            }
            return tot > 0 && num / tot >= 0.6;   // mayoría de valores numéricos
        });
    }, [rows, columns]);

    // ─── Cómo se calcula cada columna en el resumen ─────────────────────────
    // Sumar todo lo numérico no sirve: el LOTE es un identificador (sumar
    // 260710 + 260713 no significa nada) y un porcentaje o una temperatura se
    // promedian, no se acumulan. Cada columna trae una operación por defecto y
    // se puede cambiar a mano desde el panel "⚙️ Cómo se calcula".
    const OPERACIONES = [
        { value: 'suma',      label: 'Sumar',    signo: 'Σ'  },
        { value: 'promedio',  label: 'Promedio', signo: 'x̄'  },
        { value: 'max',       label: 'Máximo',   signo: '↑'  },
        { value: 'min',       label: 'Mínimo',   signo: '↓'  },
        { value: 'conteo',    label: 'Contar',   signo: '#'  },
        // "Listar" es lo contrario de totalizar: en vez de un número, la celda
        // trae los valores de todas las filas. Sirve cuando el dato se pierde
        // al resumir (los productos de un formulario quedaban en "Varios").
        { value: 'lista',     label: 'Listar filas', signo: '≣' },
        { value: 'no',        label: 'No incluir', signo: '' },
    ];

    // Operaciones que puede tener una columna de TEXTO: no se suman, pero sí se
    // pueden listar en vez de resumirse a "Varios".
    // Para quitarla del reporte está el check: acá solo se elige qué muestra.
    const OPERACIONES_TEXTO = [
        { value: 'valor',  label: 'Valor (o "Varios")', signo: '' },
        { value: 'lista',  label: 'Listar filas',       signo: '≣' },
    ];

    // Une los valores de las filas en una sola celda. Se cortan los muy largos:
    // un formulario con 44 registros haría una celda ilegible.
    const MAX_EN_LISTA = 20;
    const listarValores = (valores) => {
        const arr = [...valores];
        if (arr.length <= MAX_EN_LISTA) return arr.join(' / ');
        return `${arr.slice(0, MAX_EN_LISTA).join(' / ')} … (+${arr.length - MAX_EN_LISTA})`;
    };
    const signoDe = (op) => OPERACIONES.find(o => o.value === op)?.signo || 'Σ';

    // Columnas fijas del resumen. No se suman (son conteos), pero antes tampoco
    // se podían sacar: iban siempre y no figuraban en "⚙️ Cómo se calcula".
    const COL_FIJAS = [
        { key: '__FORMULARIOS__', label: 'FORMULARIOS', ayuda: 'Cuántos formularios distintos entran en el grupo' },
        { key: '__REGISTROS__',   label: 'REGISTROS',   ayuda: 'Cuántas filas entran en el grupo' },
    ];

    // Identificadores: se numeran, no se miden. Nunca se suman.
    const ES_IDENTIFICADOR = /(^|\s|-)(LOTE|LOTES|CODIGO|C[OÓ]DIGO|N[°º]|NUMERO|N[UÚ]MERO|ORDEN|GU[IÍ]A|FACTURA|RUC|CEDULA|C[EÉ]DULA|SERIE|PLACA|REGISTRO|FOLIO|TURNO|A[NÑ]O|MES|DIA|D[IÍ]A|HORA|SEMANA)(\s|$|-)/;
    // Magnitudes que se promedian: acumularlas da un número sin sentido.
    const ES_PROMEDIABLE = /(%|PORCENTAJE|RENDIMIENTO|TEMPERATURA|TEMP|CONCENTRACION|CONCENTRACI[OÓ]N|PH|HUMEDAD|PROMEDIO|TALLA|CALIBRE)/;
    // Datos del encabezado que son "cuántos hay", no algo que se acumule fila a fila.
    const ES_CONTEO_FIJO = /(PERSONAL|FILETEADOR|OPERARIO|TRABAJADOR|EMPLEADO|PERSONAS)/;

    const operacionSugerida = useCallback((col) => {
        const c = String(col).toUpperCase();
        if (ES_IDENTIFICADOR.test(c)) return 'no';
        if (ES_PROMEDIABLE.test(c))   return 'promedio';
        if (ES_CONTEO_FIJO.test(c))   return 'max';   // el máximo del día, no la suma
        return 'suma';
    }, []);

    // Operación elegida por columna (arranca con la sugerida)
    const [opPorCol, setOpPorCol] = useState({});
    const [showOpPanel, setShowOpPanel] = useState(false);

    useEffect(() => {
        if (numericCols.length === 0) return;
        setOpPorCol(prev => {
            const next = { ...prev };
            let cambio = false;
            numericCols.forEach(c => {
                if (next[c] === undefined) { next[c] = operacionSugerida(c); cambio = true; }
            });
            return cambio ? next : prev;
        });
    }, [numericCols, operacionSugerida]);

    const opDe = useCallback(
        (col) => opPorCol[col] ?? operacionSugerida(col),
        [opPorCol, operacionSugerida]
    );

    // FORMULARIOS y REGISTROS son conteos: lo único que se elige es si salen o no.
    const fijaIncluida = useCallback(
        (key) => (opPorCol[key] ?? 'conteo') !== 'no',
        [opPorCol]
    );
    const colsFijasVisibles = COL_FIJAS.filter(f => fijaIncluida(f.key));

    // Columnas por las que tiene sentido agrupar (texto/categoría)
    const groupableCols = useMemo(
        () => columns.filter(c => !numericCols.includes(c)),
        [columns, numericCols]
    );

    // Agrupación especial: un renglón por formulario guardado. En un mismo día
    // se llenan varios formularios y agrupando por fecha se mezclarían todos.
    const CLAVE_FORM = '__FORMULARIO__';

    // Si la columna de agrupación deja de existir, volver a Total general
    useEffect(() => {
        if (agruparPor && agruparPor !== CLAVE_FORM && !groupableCols.includes(agruparPor)) {
            setAgruparPor('');
        }
    }, [groupableCols, agruparPor]);

    // ─── Resumen / tabla dinámica ───────────────────────────────────────────
    const { resumenRows, sumCols } = useMemo(() => {
        // Las puestas en "Listar filas" no se totalizan: su celda trae los
        // valores de las filas, no un número.
        const cols = numericCols.filter(c =>
            (!visibleCols || visibleCols.has(c)) && opDe(c) !== 'no' && opDe(c) !== 'lista'
        );
        const porFormulario = agruparPor === CLAVE_FORM;
        const grpCol = !porFormulario && agruparPor && columns.includes(agruparPor)
            ? agruparPor : null;

        const map = new Map();

        rows.forEach(r => {
            let key;
            if (porFormulario)   key = String(r.__formId);
            else if (grpCol)     key = String(r[grpCol] ?? '(sin dato)');
            else                 key = 'TOTAL GENERAL';

            if (!map.has(key)) {
                map.set(key, nuevoGrupo(porFormulario ? (formLabels.get(key) || `#${key}`) : key, cols));
            }
            acumularFila(map.get(key), r, cols);
        });

        const out = Array.from(map.values())
            .sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }));

        // Fila de total general al final cuando hay agrupación
        if ((grpCol || porFormulario) && out.length > 1) {
            const tot = nuevoGrupo('▓ TOTAL GENERAL', cols);
            out.forEach(g => {
                tot.count += g.count;
                g.formularios.forEach(f => tot.formularios.add(f));
                cols.forEach(c => {
                    const a = tot.sums[c], b = g.sums[c];
                    a.sum += b.sum;
                    a.n   += b.n;
                    if (b.min !== null) a.min = a.min === null ? b.min : Math.min(a.min, b.min);
                    if (b.max !== null) a.max = a.max === null ? b.max : Math.max(a.max, b.max);
                });
            });
            tot.esTotal = true;
            out.push(tot);
        }

        return { resumenRows: out, sumCols: cols };
    }, [rows, columns, numericCols, visibleCols, agruparPor, opDe, formLabels]);

    // Título de la primera columna del resumen
    const etiquetaGrupo = agruparPor === CLAVE_FORM
        ? 'FORMULARIO'
        : (agruparPor || 'RESUMEN');

    // Valor final de una celda del resumen según la operación de esa columna
    const valorResumen = useCallback((grupo, col) => {
        const a = grupo.sums[col];
        if (!a || a.n === 0) return null;
        switch (opDe(col)) {
            case 'promedio': return a.sum / a.n;
            case 'max':      return a.max;
            case 'min':      return a.min;
            case 'conteo':   return a.n;
            default:         return a.sum;
        }
    }, [opDe]);

    // ─── Selección de filas ─────────────────────────────────────────────────
    // Se guardan los índices dentro de `rows`, así la selección sobrevive al
    // cambio de página. Si los datos cambian, la selección deja de tener sentido.
    const [filasSel, setFilasSel] = useState(() => new Set());

    useEffect(() => { setFilasSel(new Set()); }, [rows]);

    // Con menos de dos filas marcadas no hay nada que unir
    useEffect(() => {
        if (filasSel.size < 2) setFusionarMarcadas(false);
    }, [filasSel]);

    // Una línea por formulario reemplaza a las filas sueltas: la selección
    // manual deja de tener sentido mientras esté activo.
    useEffect(() => {
        if (unaLineaPorForm) { setFilasSel(new Set()); setFusionarMarcadas(false); }
    }, [unaLineaPorForm]);

    const toggleFila = (idx) => {
        setFilasSel(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx); else next.add(idx);
            return next;
        });
    };

    const seleccionarTodas = () => setFilasSel(new Set(rows.map((_, i) => i)));
    const limpiarSeleccion = () => setFilasSel(new Set());

    const filasSeleccionadas = useMemo(
        () => Array.from(filasSel).sort((a, b) => a - b).map(i => rows[i]).filter(Boolean),
        [filasSel, rows]
    );

    // Totales de lo seleccionado, con el mismo criterio que el modo resumen:
    // los datos del encabezado se cuentan UNA vez por formulario, no una por fila.
    const totalSeleccion = useMemo(() => {
        const g = nuevoGrupo('SELECCIÓN', sumCols);
        filasSeleccionadas.forEach(r => acumularFila(g, r, sumCols));
        return g;
    }, [filasSeleccionadas, sumCols]);

    // ─── Fusión: varias filas se juntan en UNA línea ────────────────────────
    // Las numéricas se agregan según ⚙️ Cómo se calcula (la que suma suma, la
    // que promedia promedia). Las de texto conservan el valor si todas dicen lo
    // mismo, y si no ponen "Varios" —igual que lo que escriben a mano en el
    // formulario cuando junta varios lotes.
    //
    // Se usa para dos cosas: unir las filas que marcó el usuario, y armar la
    // línea única de cada formulario en el modo "una línea por formulario".
    const fusionarFilas = useCallback((filas) => {
        if (!filas || filas.length === 0) return null;

        const acc = nuevoGrupo('', sumCols);
        filas.forEach(r => acumularFila(acc, r, sumCols));

        // Si todas son del mismo formulario la línea sigue perteneciendo a ese
        // formulario. Si son de varios, queda suelta (sin subtotal propio).
        const forms = new Set(filas.map(r => String(r.__formId)));

        const fila = {
            __formId:  forms.size === 1 ? [...forms][0] : '__FUSION__',
            __ctxKeys: new Set(),      // ya vienen agregados: no hay que deduplicar
            __fusion:  filas.length,
        };

        columns.forEach(col => {
            if (sumCols.includes(col)) {
                const v = valorResumen(acc, col);
                if (v !== null) fila[col] = Number.isInteger(v) ? v : Number(v.toFixed(2));
                return;
            }

            const distintos = new Set(
                filas
                    .map(r => (r[col] === undefined || r[col] === null ? '' : String(r[col]).trim()))
                    .filter(s => s !== '')
            );
            if (distintos.size === 0) return;

            // "Listar filas": en vez de resumir, la celda trae los valores.
            if (opDe(col) === 'lista') {
                fila[col] = listarValores(distintos);
                return;
            }

            fila[col] = distintos.size === 1 ? [...distintos][0] : 'Varios';
        });

        return fila;
    }, [columns, sumCols, valorResumen, opDe]);

    const filaFusionada = useMemo(
        () => fusionarFilas(filasSeleccionadas),
        [fusionarFilas, filasSeleccionadas]
    );

    // Filas que finalmente se dibujan.
    const filasBase = useMemo(() => {
        // Modo "una línea por formulario": cada documento se colapsa en un solo
        // renglón con sus totales ya calculados. Es el resumen lineal, sin los
        // huecos que dejan las filas de detalle.
        if (unaLineaPorForm) {
            const porForm = new Map();
            rows.forEach(r => {
                const k = String(r.__formId);
                if (!porForm.has(k)) porForm.set(k, []);
                porForm.get(k).push(r);
            });
            return Array.from(porForm.values())
                .map(filas => ({ r: fusionarFilas(filas), idx: null }))
                .filter(e => e.r);
        }

        const normales = rows.map((r, i) => ({ r, idx: i }));
        if (!fusionarMarcadas || filasSel.size < 2 || !filaFusionada) return normales;

        const out = [];
        let yaPuesta = false;
        normales.forEach(({ r, idx }) => {
            if (!filasSel.has(idx)) { out.push({ r, idx }); return; }
            if (yaPuesta) return;                        // el resto se absorbe
            out.push({ r: filaFusionada, idx: null });
            yaPuesta = true;
        });
        return out;
    }, [rows, filasSel, fusionarMarcadas, filaFusionada, unaLineaPorForm, fusionarFilas]);

    // ─── Filas + subtotal por formulario + total general ────────────────────
    // Las filas ya vienen agrupadas por formulario (se generan documento por
    // documento), así que alcanza con cortar cada vez que cambia __formId.
    // Devuelve una lista mezclada de { tipo: 'fila' | 'subtotal' | 'total' }.
    const construirItems = useCallback((entradas) => {
        const filas  = entradas.map(e => e.r);
        const planas = entradas.map(e => ({ tipo: 'fila', r: e.r, idx: e.idx }));
        if (!subtotalPorForm || filas.length === 0) return planas;

        const out = [];
        let formActual = null;
        let acc = null;
        let filasDelGrupo = 0;

        const cerrarGrupo = () => {
            if (!acc) return;
            // La línea fusionada de varios formularios no lleva subtotal propio:
            // sería el subtotal de una sola fila que ya es un total.
            if (formActual === '__FUSION__') return;
            // Un subtotal de una sola fila es la misma fila repetida: solo ruido.
            if (filasDelGrupo < 2) return;
            out.push({
                tipo: 'subtotal',
                g: acc,
                label: formLabels.get(String(formActual)) || `Formulario #${formActual}`,
                filas: filasDelGrupo,
            });
        };

        filas.forEach((r, i) => {
            if (String(r.__formId) !== String(formActual)) {
                cerrarGrupo();
                formActual = r.__formId;
                acc = nuevoGrupo('', sumCols);
                filasDelGrupo = 0;
            }
            acumularFila(acc, r, sumCols);
            filasDelGrupo++;
            out.push(planas[i]);
        });
        cerrarGrupo();

        // Total general al final. Se recalcula sobre TODAS las filas (no se
        // suman los subtotales) para que los datos del encabezado que se
        // repiten entre formularios se cuenten como corresponde.
        const tot = nuevoGrupo('', sumCols);
        filas.forEach(r => acumularFila(tot, r, sumCols));
        out.push({ tipo: 'total', g: tot, filas: filas.length });

        return out;
    }, [subtotalPorForm, sumCols, formLabels]);

    const items = useMemo(() => construirItems(filasBase), [filasBase, construirItems]);

    // ─── Paginación ─────────────────────────────────────────────────────────
    const totalPages  = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const pagedItems  = useMemo(
        () => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [items, page]
    );

    // Al apagar los subtotales la lista se acorta: si quedabas en la última
    // página podías caer en una página que ya no existe.
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    // Índices globales de las filas que se están viendo en esta página
    // (las de subtotal no cuentan: no son datos que se puedan marcar)
    const idxDePagina = useMemo(
        () => pagedItems.filter(it => it.tipo === 'fila').map(it => it.idx),
        [pagedItems]
    );
    const paginaCompleta = idxDePagina.length > 0 && idxDePagina.every(i => filasSel.has(i));

    const togglePagina = () => {
        setFilasSel(prev => {
            const next = new Set(prev);
            if (paginaCompleta) idxDePagina.forEach(i => next.delete(i));
            else                idxDePagina.forEach(i => next.add(i));
            return next;
        });
    };

    // ─── Columnas sin ningún dato ───────────────────────────────────────────
    // Un formulario puede tener campos que en la práctica nunca se llenan
    // (TALLA, OBSV, PESO NETO SUBPRODUCTO...). Salían igual al Excel como
    // columnas en blanco, dejando huecos en el medio del reporte.
    // Se miden sobre lo que se va a exportar: si hay filas marcadas, una
    // columna que solo tiene datos en filas NO marcadas también sobra.
    // Con la fusión activa la vista ya trae todo (la línea fusionada + las
    // sueltas), así que se mide sobre eso. Si solo hay marcadas sin fusionar,
    // se exporta la selección y se mide sobre ella.
    const filasEnPantalla = (filasSeleccionadas.length > 0 && !fusionarMarcadas)
        ? filasSeleccionadas
        : filasBase.map(e => e.r);

    const colsConDatos = useMemo(() => {
        const conDatos = new Set();
        for (const r of filasEnPantalla) {
            for (const c of marcadasCols) {
                if (conDatos.has(c)) continue;
                const v = r[c];
                if (v !== undefined && v !== null && String(v).trim() !== '') conDatos.add(c);
            }
            if (conDatos.size === marcadasCols.length) break;   // ya están todas
        }
        return conDatos;
    }, [filasEnPantalla, marcadasCols]);

    // Columnas que finalmente se ven y se exportan
    const activeCols = useMemo(() => {
        if (!ocultarVacias) return marcadasCols;
        const dataSet = new Set(columns);
        // Las columnas sin datos reales pero elegidas explícitamente por el usuario
        // no se ocultan aunque ocultarVacias esté activo: el usuario las eligió a propósito.
        return marcadasCols.filter(c => colsConDatos.has(c) || !dataSet.has(c));
    }, [marcadasCols, colsConDatos, ocultarVacias, columns]);

    const colsVacias = marcadasCols.length - colsConDatos.size;

    // colsMostradas = lo que se dibuja; en modo selección de columnas se
    // muestran TODAS (las desmarcadas en gris) para poder volver a marcarlas.
    const colsMostradas = modoSeleccion ? columns : activeCols;

    // ─── Nombre base del archivo ────────────────────────────────────────────
    const nombreArchivo = () => (filters.templateId
        ? (templates.find(t => String(t.templateID) === String(filters.templateId))?.nombre || 'Reporte')
              .replace(/[\\/:*?"<>|]/g, '_').substring(0, 40)
        : 'Reporte_General');

    // ─── Descarga Excel de la VISTA ACTUAL ──────────────────────────────────
    // Exporta exactamente lo que se ve: columnas seleccionadas y, si está
    // activo el modo resumen, solo los totales.
    const downloadExcelVista = () => {
        const wb = XLSX.utils.book_new();
        let sheet, data;

        if (modoResumen) {
            const etiqueta = etiquetaGrupo;
            data = resumenRows.map(g => {
                const o = { [etiqueta]: g.label };
                // FORMULARIOS y REGISTROS salen solo si están incluidos en ⚙️
                colsFijasVisibles.forEach(f => {
                    o[f.label] = f.key === '__FORMULARIOS__' ? g.formularios.size : g.count;
                });
                sumCols.forEach(c => {
                    const v = valorResumen(g, c);
                    // El encabezado dice qué operación es, para que no se lea
                    // como una suma lo que en realidad es un promedio o un máximo.
                    o[`${c} (${OPERACIONES.find(op => op.value === opDe(c))?.label})`] =
                        v === null ? '' : Number(v.toFixed(2));
                });
                return o;
            });
            sheet = 'Totales';
        } else {
            // El Excel replica lo que se ve. Con la fusión activa la vista ya
            // trae la línea fusionada + las sueltas, así que se baja completa.
            // Si solo hay marcadas (sin fusionar), se bajan SOLO esas.
            const origen = (filasSeleccionadas.length > 0 && !fusionarMarcadas)
                ? filasSeleccionadas.map(r => ({ r, idx: null }))
                : filasBase;

            // Las columnas numéricas se exportan como número real para que
            // Excel pueda sumarlas en una tabla dinámica
            const esNum = new Set(numericCols);
            const celdasDe = (r) => Object.fromEntries(activeCols.map(c => {
                const v = r[c];
                if (v === undefined || v === null || v === '') return [c, ''];
                if (esNum.has(c)) {
                    const n = parseNum(v);
                    if (n !== null) return [c, n];
                }
                return [c, v];
            }));

            // Fila de subtotal/total: el rótulo va en la primera columna y los
            // números debajo de su propia columna, para que quede alineado.
            const filaDeTotal = (g, rotulo) => {
                const fila = {};
                activeCols.forEach((c, i) => {
                    if (i === 0) { fila[c] = rotulo; return; }
                    const v = sumCols.includes(c) ? valorResumen(g, c) : null;
                    fila[c] = v === null ? '' : Number(v.toFixed(2));
                });
                return fila;
            };

            // Mismos cortes que en pantalla: subtotal por formulario y total general
            data = construirItems(origen).map(it => {
                if (it.tipo === 'fila')  return celdasDe(it.r);
                if (it.tipo === 'total') return filaDeTotal(it.g, `TOTAL GENERAL (${it.filas} filas)`);
                return filaDeTotal(it.g, `Subtotal · ${it.label}`);
            });

            // Si no hay cortes por formulario pero sí filas marcadas, igual se
            // cierra con el total de la selección.
            if (!subtotalPorForm && filasSeleccionadas.length > 0 && data.length > 0) {
                data.push(filaDeTotal(totalSeleccion, `TOTAL (${filasSeleccionadas.length} filas)`));
            }

            sheet = filasSeleccionadas.length > 0 ? 'Selección' : 'Datos';
        }

        if (data.length === 0 || Object.keys(data[0]).length === 0) {
            alert('Selecciona al menos una columna en 🗂️ Columnas antes de exportar.');
            return;
        }

        const conSubtotales = !modoResumen && subtotalPorForm;
        const hayFilaTotal  = !modoResumen && (subtotalPorForm || filasSeleccionadas.length > 0);

        const ws = XLSX.utils.json_to_sheet(data);
        const rango = XLSX.utils.decode_range(ws['!ref']);
        styleSheet(ws, rango);

        // Con subtotales intercalados el autofiltro engaña (al filtrar deja
        // subtotales que ya no corresponden a lo que se ve), así que no se pone.
        if (!conSubtotales) {
            // La fila de TOTAL queda fuera del filtro: si entrara, al filtrar
            // se movería o se escondería.
            const rangoFiltro = { ...rango, e: { ...rango.e, r: rango.e.r - (hayFilaTotal ? 1 : 0) } };
            ws['!autofilter'] = { ref: XLSX.utils.encode_range(rangoFiltro) };
        }
        XLSX.utils.book_append_sheet(wb, ws, sheet);

        let sufijo = '';
        if (modoResumen) sufijo = '_TOTALES';
        else if (filasSeleccionadas.length > 0) sufijo = '_SELECCION';
        XLSX.writeFile(wb, `${nombreArchivo()}${sufijo}_${filters.inicio}_${filters.fin}.xlsx`);
    };

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
    // Deja marcadas solo las numéricas + las de identidad (fecha/plantilla)
    const toggleSoloNumericas = () => {
        setVisibleCols(new Set(['FECHA', 'PLANTILLA', ...numericCols]
            .filter(c => columns.includes(c))));
    };

    // ─── Columnas agrupadas por origen ──────────────────────────────────────
    // En una lista plana de 40 columnas no se sabe cuál es el lote del
    // encabezado, cuál el peso de una tabla y cuál la firma. Agrupadas se
    // eligen de a bloques: "todos los campos del título", "todas las firmas".
    const GRUPOS_COL = [
        { tipo: 'encabezado', titulo: '📋 Campos del encabezado', ayuda: 'Lo que va arriba del formulario: fecha, lote, especie…' },
        { tipo: 'tabla',      titulo: '📊 Columnas de las tablas', ayuda: 'Los datos que se cargan fila a fila. En "una línea por formulario" salen totalizadas.' },
        { tipo: 'firma',      titulo: '✍️ Firmas',                ayuda: 'Quién firmó cada puesto' },
        { tipo: 'seccion',    titulo: '🗃️ Secciones y otros',      ayuda: 'Campos de secciones sueltas del formulario' },
        { tipo: 'sistema',    titulo: '⚙️ Del sistema',            ayuda: 'Fecha de guardado, plantilla y observaciones' },
    ];

    const columnasPorGrupo = useMemo(() => {
        const q = colSearch.trim().toUpperCase();
        return GRUPOS_COL
            .map(g => ({
                ...g,
                cols: columns.filter(c =>
                    (origenCols.get(c) || 'seccion') === g.tipo &&
                    (!q || c.includes(q))
                ),
            }))
            .filter(g => g.cols.length > 0);
    }, [columns, origenCols, colSearch]);

    // ─── Guardar / restaurar la configuración de este formulario ────────────
    // Vive en el servidor (tabla ConfiguracionesReporte): se arma una vez y la
    // usa toda la planta. Si el backend no responde se cae al respaldo local.
    const hayConfigGuardada = !!configForm.data;
    const tplIdConfig = Number(filters.templateId) || 0;

    const aplicarInterruptores = useCallback((c) => {
        if (c.opPorCol)                          setOpPorCol(c.opPorCol);
        if (c.unaLineaPorForm !== undefined)     setUnaLineaPorForm(c.unaLineaPorForm);
        if (c.ocultarVacias !== undefined)       setOcultarVacias(c.ocultarVacias);
        if (c.compactarFilas !== undefined)      setCompactarFilas(c.compactarFilas);
        if (c.omitirTotalesDelForm !== undefined) setOmitirTotalesDelForm(c.omitirTotalesDelForm);
        if (c.subtotalPorForm !== undefined)     setSubtotalPorForm(c.subtotalPorForm);
        if (c.modoResumen !== undefined)         setModoResumen(c.modoResumen);
        if (c.agruparPor !== undefined)          setAgruparPor(c.agruparPor);
    }, []);

    // Al cambiar de formulario se trae SU configuración
    useEffect(() => {
        let cancelado = false;
        setConfigForm({ estado: 'cargando', data: null });

        (async () => {
            let data = null;
            try {
                const res = await fetch(`${API_BASE_URL}/ConfiguracionReportes/template/${tplIdConfig}`);
                // 204 = no hay configuración guardada, que es un caso normal
                if (res.ok && res.status !== 204) data = configDesdeServidor(await res.json());
            } catch {
                // Servidor caído: se usa lo último que quedó en este navegador
                data = leerConfigs()[claveConfig(filters.templateId)] || null;
            }
            if (cancelado) return;
            setConfigForm({ estado: 'lista', data });
            if (data) aplicarInterruptores(data);
        })();

        return () => { cancelado = true; };
    }, [tplIdConfig, filters.templateId, aplicarInterruptores]);

    const guardarConfigActual = async () => {
        const actual = {
            visibleCols: Array.from(visibleCols ?? columns),
            opPorCol,
            unaLineaPorForm,
            ocultarVacias,
            compactarFilas,
            omitirTotalesDelForm,
            subtotalPorForm,
            modoResumen,
            agruparPor,
        };

        // Respaldo local siempre, por si después no hay red
        const configs = leerConfigs();
        configs[claveConfig(filters.templateId)] = actual;
        escribirConfigs(configs);

        try {
            const res = await fetch(`${API_BASE_URL}/ConfiguracionReportes`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateID:           tplIdConfig,
                    nombre:               selectedTplName || 'Todos los formularios',
                    columnasVisibles:     JSON.stringify(actual.visibleCols),
                    operaciones:          JSON.stringify(actual.opPorCol),
                    unaLineaPorForm:      actual.unaLineaPorForm,
                    ocultarVacias:        actual.ocultarVacias,
                    compactarFilas:       actual.compactarFilas,
                    omitirTotalesDelForm: actual.omitirTotalesDelForm,
                    subtotalPorForm:      actual.subtotalPorForm,
                    modoResumen:          actual.modoResumen,
                    agruparPor:           actual.agruparPor,
                    actualizadoPor:       authService.getCurrentUser()?.nombre
                                          || authService.getCurrentUser()?.username || '',
                }),
            });
            if (!res.ok) throw new Error(`Error ${res.status}`);
            setConfigForm({ estado: 'lista', data: { ...actual, delServidor: true } });
            setConfigGuardadaAviso(`✅ Guardada en el servidor para ${selectedTplName || 'todos los formularios'}`);
        } catch (e) {
            console.error('No se pudo guardar en el servidor:', e);
            setConfigForm({ estado: 'lista', data: actual });
            setConfigGuardadaAviso('⚠️ Guardada solo en esta computadora: el servidor no respondió');
        }
        setTimeout(() => setConfigGuardadaAviso(''), 5000);
    };

    const olvidarConfigActual = async () => {
        const configs = leerConfigs();
        delete configs[claveConfig(filters.templateId)];
        escribirConfigs(configs);

        try {
            await fetch(`${API_BASE_URL}/ConfiguracionReportes/template/${tplIdConfig}`, { method: 'DELETE' });
        } catch (e) {
            console.error('No se pudo borrar en el servidor:', e);
        }

        setConfigForm({ estado: 'lista', data: null });
        setVisibleCols(new Set(columns));
        setConfigGuardadaAviso('🗑 Configuración borrada. Vuelve a mostrarse todo.');
        setTimeout(() => setConfigGuardadaAviso(''), 4000);
    };

    // ─── Vista previa: las primeras líneas tal como van a salir ─────────────
    // Se muestra en los dos paneles de armado. Con "una línea por formulario"
    // cada renglón es un documento entero ya resumido, que es el objetivo.
    const FILAS_PREVIA = 5;

    const renderVistaPrevia = () => {
        if (filasBase.length === 0 || activeCols.length === 0) return null;
        const muestra = filasBase.slice(0, FILAS_PREVIA);

        return (
            <div className="col-preview">
                <div className="col-preview-head">
                    🔎 Así va a salir el Excel
                    <span>
                        {' · '}
                        {unaLineaPorForm
                            ? `una línea por formulario (${filasBase.length} en total)`
                            : `fila por fila (${filasBase.length} filas)`}
                        {' · '}{activeCols.length} columnas
                        {filasBase.length > muestra.length && ` · se muestran las primeras ${muestra.length}`}
                    </span>
                </div>
                <div className="col-preview-scroll">
                    <table className="col-preview-tabla">
                        <thead>
                            <tr>
                                <th>#</th>
                                {activeCols.map(c => <th key={c}>{c}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {muestra.map((entrada, i) => (
                                <tr key={entrada.idx ?? `f-${i}`}>
                                    <td className="col-preview-num">
                                        {entrada.r.__fusion ? `×${entrada.r.__fusion}` : i + 1}
                                    </td>
                                    {activeCols.map(c => {
                                        const v = entrada.r[c];
                                        return (
                                            <td key={c}>
                                                {v === undefined || v === null || v === ''
                                                    ? <span className="td-empty">—</span>
                                                    : String(v)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // ─── Dibujo del formulario para elegir los campos ───────────────────────
    // Una lista de 40 nombres sueltos no dice nada. Acá se arma un croquis del
    // formulario tal como está diseñado —encabezado, cada tabla con sus
    // columnas, las firmas— y se marca sobre él lo que va al Excel.
    const estructuraPlantilla = useMemo(() => {
        const tpl = templates.find(t => String(t.templateID) === String(filters.templateId));
        if (!tpl) return null;

        const jsonDe = (v, fallback) => {
            if (!v) return fallback;
            if (typeof v !== 'string') return v;
            try { return JSON.parse(v); } catch { return fallback; }
        };

        // El nombre de la columna en el reporte sale del dato guardado, y el del
        // croquis sale del diseño de la plantilla. Casi siempre son el mismo
        // texto pero escrito distinto: con tilde o sin tilde, con paréntesis, con
        // doble espacio. Comparando en crudo no coincidía casi ninguno de los
        // campos de tabla y salían todos apagados. Se compara normalizado.
        const norm = (s) => String(s ?? '')
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .replace(/[^A-Za-z0-9]+/g, ' ')
            .trim().toUpperCase();

        const porNombre = new Map();
        columns.forEach(c => { if (!porNombre.has(norm(c))) porNombre.set(norm(c), c); });

        const usadas = new Set();

        // Un campo del croquis: su etiqueta y a qué columna del reporte apunta.
        // Si no hay columna, el formulario tiene el campo pero nunca se llenó en
        // el rango elegido: se muestra apagado en vez de esconderlo.
        const campo = (etiqueta, clave) => {
            const limpia = cleanKey(clave || etiqueta);
            const col = columns.includes(limpia) ? limpia : porNombre.get(norm(clave || etiqueta));
            if (col) usadas.add(col);
            return {
                etiqueta: etiqueta || clave || '(sin nombre)',
                col: col || limpia,
                existe: !!col,
            };
        };

        const bloques = [];

        const header = jsonDe(tpl.headerFields, []);
        if (Array.isArray(header) && header.length > 0) {
            bloques.push({
                titulo: '📋 Encabezado',
                tipo: 'encabezado',
                campos: header.map(f => campo(f.label || f.name || f.id)),
            });
        }

        const body = jsonDe(tpl.bodyElements, []);
        if (Array.isArray(body)) {
            body.forEach((el, i) => {
                const cols = Array.isArray(el?.columns) ? el.columns : jsonDe(el?.columns, []);
                if (!Array.isArray(cols) || cols.length === 0) return;
                bloques.push({
                    titulo: el.title || el.name || el.label || `Tabla ${i + 1}`,
                    tipo: 'tabla',
                    campos: cols.map(c => campo(c.label || c.header || c.name || c.id)),
                });
            });
        }

        const firmas = jsonDe(tpl.firmas, []);
        if (Array.isArray(firmas) && firmas.length > 0) {
            bloques.push({
                titulo: '✍️ Firmas',
                tipo: 'firma',
                campos: firmas.map(f => {
                    const puesto = String(f.puesto || f.nombreCompleto || '').toUpperCase().replace(/_/g, ' ');
                    const col = `FIRMA ${puesto}`;
                    return { etiqueta: f.puesto || puesto, col, existe: columns.includes(col) };
                }),
            });
        }

        // Columnas que hay en los datos pero que el croquis no logró ubicar en
        // ningún campo del diseño (secciones sueltas, campos renombrados,
        // columnas que agrega el sistema). Van al final para que nada quede
        // fuera de alcance por un problema de nombres.
        const sueltas = columns.filter(c => !usadas.has(c));
        if (sueltas.length > 0) {
            bloques.push({
                titulo: '🗃️ Otras columnas de los datos',
                tipo: 'sueltas',
                campos: sueltas.map(c => ({ etiqueta: c, col: c, existe: true })),
            });
        }

        return { codigo: tpl.codigo, nombre: tpl.nombre, bloques };
    }, [templates, filters.templateId, columns, cleanKey]);

    // Deja todo listo para el Excel de una línea por formulario: los campos del
    // encabezado (fecha, lote, especie), las firmas, y de las tablas solo las
    // numéricas —que son las que salen totalizadas—. El resto se descarta
    // porque en una línea única solo aportaría "Varios".
    const armarResumenUnaLinea = () => {
        const delTipo = (tipo) => columns.filter(c => (origenCols.get(c) || 'seccion') === tipo);
        setVisibleCols(new Set([
            // La identidad del registro va siempre: si no, no se sabe a qué
            // documento corresponde cada línea del resumen.
            'N° REGISTRO', 'CODIGO', 'FECHA', 'PLANTILLA',
            ...delTipo('encabezado'),
            ...delTipo('firma'),
            ...delTipo('tabla').filter(c => numericCols.includes(c)),
        ].filter(c => columns.includes(c))));
        setUnaLineaPorForm(true);
        setOcultarVacias(true);
        setModoResumen(false);
    };

    // Marca o desmarca todo un bloque de una
    const toggleGrupo = (colsDelGrupo, marcar) => {
        setVisibleCols(prev => {
            const next = new Set(prev ?? columns);
            colsDelGrupo.forEach(c => { if (marcar) next.add(c); else next.delete(c); });
            return next;
        });
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
                            {/* Ordenados por número de formulario: PD-04 antes que PD-14 */}
                            {ordenarFormularios(templates).map(t => (
                                <option key={t.templateID} value={t.templateID}>
                                    {etiquetaFormulario(t)}
                                </option>
                            ))}
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
                        <>
                            <button
                                className={`btn-check-cols${modoSeleccion ? ' on' : ''}`}
                                onClick={() => setModoSeleccion(p => !p)}
                                title="Muestra un check en cada encabezado para elegir qué columnas van al Excel"
                            >
                                {modoSeleccion ? '✔️ Listo' : '☑️ Elegir columnas'}
                            </button>
                            <button
                                className="btn-croquis"
                                onClick={() => setShowCroquis(v => !v)}
                                title="Ver el formulario dibujado y elegir los campos haciendo clic sobre él"
                            >
                                🖼️ Ver formulario
                            </button>
                            <button
                                className="btn-cols"
                                onClick={() => setShowColPanel(p => !p)}
                                title="Seleccionar columnas visibles desde una lista"
                            >
                                🗂️ Columnas {visibleCols ? `(${visibleCols.size}/${columns.length})` : ''}
                            </button>
                        </>
                    )}

                    <button
                        onClick={downloadExcelVista}
                        className="btn-excel-erp"
                        disabled={rows.length === 0}
                        title="Exporta lo que ves: solo las columnas seleccionadas (y los totales si el modo resumen está activo)"
                    >
                        📥 {modoResumen ? 'Excel totales' : 'Excel vista'}
                    </button>

                    <button
                        onClick={downloadExcel}
                        className="btn-excel-det"
                        disabled={rows.length === 0}
                        title="Exporta el detalle completo, una pestaña por sección del formulario"
                    >
                        📚 Detallado
                    </button>
                </div>
            </div>

            {/* ── BARRA MODO RESUMEN / TABLA DINÁMICA ── */}
            {rows.length > 0 && (
                <div className="erp-resumen-bar">
                    <label
                        className="erp-switch"
                        title="Une las tablas de un mismo formulario en una sola fila y quita las filas vacías. Apagalo si necesitás ver cada tabla por separado."
                    >
                        <input
                            type="checkbox"
                            checked={compactarFilas}
                            onChange={e => setCompactarFilas(e.target.checked)}
                        />
                        <span>🧩 Unir filas del mismo formulario</span>
                    </label>

                    <label
                        className="erp-switch"
                        title="Deja fuera las columnas que no tienen ni un dato, para que el Excel salga corrido y sin huecos."
                    >
                        <input
                            type="checkbox"
                            checked={ocultarVacias}
                            onChange={e => setOcultarVacias(e.target.checked)}
                        />
                        <span>
                            🚫 Sin columnas vacías
                            {colsVacias > 0 && <em className="erp-switch-nota"> ({colsVacias} fuera)</em>}
                        </span>
                    </label>

                    <label
                        className="erp-switch"
                        title="Cada formulario se colapsa en UNA línea: las columnas de texto muestran su valor (o 'Varios') y las numéricas ya vienen totalizadas. Es el resumen lineal, sin filas de detalle ni huecos."
                    >
                        <input
                            type="checkbox"
                            checked={unaLineaPorForm}
                            onChange={e => setUnaLineaPorForm(e.target.checked)}
                        />
                        <span>📄 Una línea por formulario</span>
                    </label>

                    {/* Atajo: deja la configuración lista sin tener que abrir el
                        panel de columnas ni tocar los switches uno por uno. */}
                    <button
                        className="btn-armar-resumen"
                        onClick={armarResumenUnaLinea}
                        title="Marca los campos del encabezado, las firmas y los totales de las tablas, y activa una línea por formulario. Después solo queda descargar."
                    >
                        ✨ Armar resumen de una línea
                    </button>

                    {/* Guardar el armado de ESTE formulario para no repetirlo */}
                    <button
                        className="btn-guardar-config"
                        onClick={guardarConfigActual}
                        title={`Guarda en el servidor las columnas, los totales y los interruptores de ${selectedTplName || 'esta vista'}. Queda para todos los usuarios y desde cualquier computadora.`}
                    >
                        💾 Guardar para {selectedTplName ? 'este formulario' : 'esta vista'}
                    </button>

                    {hayConfigGuardada && (
                        <button
                            className="btn-olvidar-config"
                            onClick={olvidarConfigActual}
                            title="Borra la configuración guardada y vuelve a mostrar todas las columnas"
                        >
                            🗑 Olvidar
                        </button>
                    )}

                    {configGuardadaAviso && (
                        <span className="erp-config-aviso">{configGuardadaAviso}</span>
                    )}

                    <label
                        className="erp-switch"
                        title="Descarta las líneas de TOTAL que ya trae el formulario (las que tienen números pero ni producto ni lote ni hora). Si se dejan, el subtotal cuenta dos veces las mismas libras."
                    >
                        <input
                            type="checkbox"
                            checked={omitirTotalesDelForm}
                            onChange={e => setOmitirTotalesDelForm(e.target.checked)}
                        />
                        <span>➖ Sin los totales del formulario</span>
                    </label>

                    <label
                        className="erp-switch"
                        title="Corta con un subtotal cada vez que cambia de formulario y cierra con el total general al final."
                    >
                        <input
                            type="checkbox"
                            checked={subtotalPorForm}
                            onChange={e => setSubtotalPorForm(e.target.checked)}
                        />
                        <span>Σ Subtotal por formulario</span>
                    </label>

                    <label className="erp-switch" title="Muestra solo los totales en vez de fila por fila">
                        <input
                            type="checkbox"
                            checked={modoResumen}
                            onChange={e => setModoResumen(e.target.checked)}
                        />
                        <span>Σ Ver solo totales</span>
                    </label>

                    {modoResumen && (
                        <>
                            <div className="control-group">
                                <label>Agrupar por</label>
                                <select value={agruparPor} onChange={e => setAgruparPor(e.target.value)}>
                                    <option value="">— Total general (una sola fila) —</option>
                                    <option value={CLAVE_FORM}>
                                        📄 Cada formulario por separado
                                    </option>
                                    <optgroup label="Por columna">
                                        {groupableCols.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>
                            <button
                                className="btn-ops"
                                onClick={() => setShowOpPanel(p => !p)}
                                title="Elegir si cada columna se suma, se promedia o no se incluye"
                            >
                                ⚙️ Cómo se calcula ({sumCols.length})
                            </button>

                            <span className="erp-resumen-hint">
                                {sumCols.length > 0
                                    ? `${sumCols.length} de ${numericCols.length} columnas numéricas incluidas. Los lotes y códigos quedan fuera por ser identificadores.`
                                    : '⚠️ Ninguna columna numérica incluida. Revisa ⚙️ Cómo se calcula.'}
                            </span>
                        </>
                    )}
                </div>
            )}

            {/* ── PANEL: OPERACIÓN POR COLUMNA ── */}
            {modoResumen && showOpPanel && rows.length > 0 && (
                <div className="op-panel">
                    <div className="op-panel-header">
                        <div className="col-panel-title">
                            <strong>⚙️ Cómo se calcula cada columna</strong>
                            <span className="col-panel-sub">
                                Un lote o un código no se suman: son identificadores. Un porcentaje
                                o una temperatura se promedian. Los datos del encabezado se cuentan
                                una sola vez por formulario, no una por fila.
                            </span>
                        </div>
                        <div className="col-panel-actions">
                            {/* "Sumar todas" toca solo las numéricas: si alguien sacó
                                REGISTROS o FORMULARIOS, no se los vuelve a meter. */}
                            <button onClick={() => setOpPorCol(prev => ({
                                ...prev,
                                ...Object.fromEntries(numericCols.map(c => [c, 'suma']))
                            }))}>
                                Σ Sumar todas
                            </button>
                            <button onClick={() => setOpPorCol(Object.fromEntries(numericCols.map(c => [c, operacionSugerida(c)])))}>
                                ♻️ Volver a lo sugerido
                            </button>
                            <button onClick={() => setShowOpPanel(false)}>✕ Cerrar</button>
                        </div>
                    </div>
                    <div className="op-panel-list">
                        {/* Columnas de conteo: solo se elige si salen o no */}
                        {COL_FIJAS.map(f => (
                            <div key={f.key} className={`op-item${!fijaIncluida(f.key) ? ' op-item-off' : ''}`}>
                                <span className="op-item-name" title={f.ayuda}>{f.label}</span>
                                <select
                                    value={opPorCol[f.key] ?? 'conteo'}
                                    onChange={e => setOpPorCol(prev => ({ ...prev, [f.key]: e.target.value }))}
                                >
                                    <option value="conteo"># Contar</option>
                                    <option value="no">No incluir</option>
                                </select>
                            </div>
                        ))}

                        {numericCols.map(col => (
                            <div key={col} className={`op-item${opDe(col) === 'no' ? ' op-item-off' : ''}`}>
                                <span className="op-item-name" title={col}>{col}</span>
                                <select
                                    value={opDe(col)}
                                    onChange={e => setOpPorCol(prev => ({ ...prev, [col]: e.target.value }))}
                                >
                                    {OPERACIONES.map(o => (
                                        <option key={o.value} value={o.value}>
                                            {o.signo ? `${o.signo} ${o.label}` : o.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                        <span className="stat-val">{modoResumen ? resumenRows.length : totalPages}</span>
                        <span className="stat-lbl">{modoResumen ? 'Filas resumen' : 'Páginas'}</span>
                    </div>
                </div>
            )}

            {/* ── PANEL COLUMNAS ── */}
            {showColPanel && (
                <div className="col-panel">
                    <div className="col-panel-header">
                        <div className="col-panel-title">
                            <strong>🗂️ Columnas para la tabla y el Excel</strong>
                            <span className="col-panel-sub">
                                Marca las que quieres exportar · {visibleCols ? visibleCols.size : columns.length} de {columns.length} seleccionadas
                            </span>
                        </div>
                        <div className="col-panel-actions">
                            <input
                                type="text"
                                className="col-search"
                                placeholder="🔎 Buscar columna…"
                                value={colSearch}
                                onChange={e => setColSearch(e.target.value)}
                            />
                            <button onClick={() => toggleAll(true)}>✅ Todas</button>
                            <button onClick={() => toggleAll(false)}>❌ Ninguna</button>
                            <button onClick={() => toggleSoloNumericas()}>🔢 Solo numéricas</button>
                            <button
                                onClick={armarResumenUnaLinea}
                                title="Deja marcados los campos del encabezado, las firmas y los totales de las tablas, y activa una línea por formulario."
                            >
                                📄 Armar resumen de una línea
                            </button>
                            <button
                                onClick={guardarConfigActual}
                                title="Guarda este armado en el servidor para este formulario"
                            >
                                💾 Guardar armado
                            </button>
                            <button
                                className="col-panel-export"
                                onClick={downloadExcelVista}
                                disabled={rows.length === 0 || (visibleCols && visibleCols.size === 0)}
                            >
                                📥 Exportar selección
                            </button>
                            <button onClick={() => setShowColPanel(false)}>✕ Cerrar</button>
                        </div>
                    </div>
                    {columnasPorGrupo.length === 0 && (
                        <span className="col-panel-empty">Ninguna columna coincide con “{colSearch}”.</span>
                    )}

                    {/* Un bloque por origen, con su propio "todas / ninguna":
                        así se elige "todos los campos del título" o "todas las
                        firmas" de un clic, en vez de ir columna por columna. */}
                    {columnasPorGrupo.map(g => {
                        const marcadasDelGrupo = g.cols.filter(c => !visibleCols || visibleCols.has(c)).length;
                        return (
                            <div key={g.tipo} className="col-grupo">
                                <div className="col-grupo-head">
                                    <strong title={g.ayuda}>{g.titulo}</strong>
                                    <span className="col-grupo-count">
                                        {marcadasDelGrupo} de {g.cols.length}
                                    </span>
                                    <button onClick={() => toggleGrupo(g.cols, true)}>✅ Todas</button>
                                    <button onClick={() => toggleGrupo(g.cols, false)}>❌ Ninguna</button>
                                </div>
                                <div className="col-panel-list">
                                    {g.cols.map(col => {
                                        const marcada = !visibleCols || visibleCols.has(col);
                                        const esNumerica = numericCols.includes(col);
                                        return (
                                            <div key={col} className={`col-item${marcada ? ' col-item-on' : ''}`}>
                                                <label className="col-item-check">
                                                    <input
                                                        type="checkbox"
                                                        checked={marcada}
                                                        onChange={() => toggleCol(col)}
                                                    />
                                                    <span>{col}</span>
                                                </label>

                                                {/* Qué hace la columna al resumir. Antes esto vivía en
                                                    otro panel aparte y había que ir y venir. */}
                                                {/* Total o filas: las numéricas pueden sumarse,
                                                    promediarse… o listar los valores de sus filas.
                                                    Las de texto eligen entre el valor y la lista. */}
                                                <select
                                                    className="col-item-op"
                                                    value={esNumerica ? opDe(col) : (opPorCol[col] ?? 'valor')}
                                                    onChange={e => setOpPorCol(prev => ({ ...prev, [col]: e.target.value }))}
                                                    title="Qué trae esta columna al juntar las filas de un formulario en una sola línea"
                                                >
                                                    {(esNumerica ? OPERACIONES : OPERACIONES_TEXTO).map(o => (
                                                        <option key={o.value} value={o.value}>
                                                            {o.signo ? `${o.signo} ${o.label}` : o.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* Cómo va a salir la primera línea del Excel con lo que
                        está marcado ahora. Sin esto hay que descargar el archivo
                        para descubrir si el armado quedó bien. */}
                    {renderVistaPrevia()}
                </div>
            )}

            {/* ── CROQUIS DEL FORMULARIO: se elige haciendo clic sobre el campo ── */}
            {showCroquis && (
                <div className="croquis-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCroquis(false); }}>
                <div className="croquis-panel">
                    <div className="col-panel-header">
                        <div className="col-panel-title">
                            <strong>
                                🖼️ {estructuraPlantilla
                                    ? `${estructuraPlantilla.codigo} — ${estructuraPlantilla.nombre}`
                                    : 'Formulario'}
                            </strong>
                            <span className="col-panel-sub">
                                Hacé clic en un campo para que entre o salga del Excel ·
                                {' '}<strong>{activeCols.length}</strong> columnas van a salir
                            </span>
                        </div>
                        <div className="col-panel-actions">
                            {/* El interruptor clave para este panel: es lo que
                                convierte el detalle en una línea por documento. */}
                            <label className="croquis-switch" title="Cada formulario se resume en un solo renglón con sus totales">
                                <input
                                    type="checkbox"
                                    checked={unaLineaPorForm}
                                    onChange={e => setUnaLineaPorForm(e.target.checked)}
                                />
                                <span>📄 Una línea por formulario</span>
                            </label>
                            <button onClick={armarResumenUnaLinea}>✨ Armar automático</button>
                            <button onClick={guardarConfigActual}>💾 Guardar armado</button>
                            <button
                                className="col-panel-export"
                                onClick={downloadExcelVista}
                                disabled={rows.length === 0}
                            >
                                📥 Descargar
                            </button>
                            <button onClick={() => setShowCroquis(false)}>✕ Cerrar</button>
                        </div>
                    </div>

                    {!estructuraPlantilla ? (
                        <p className="col-panel-empty">
                            Elegí un formulario en el filtro de arriba para ver su diseño.
                        </p>
                    ) : (
                        <div className="croquis-hoja">
                            {estructuraPlantilla.bloques.map((b, bi) => (
                                <div key={`${b.titulo}-${bi}`} className={`croquis-bloque croquis-${b.tipo}`}>
                                    <div className="croquis-bloque-titulo">{b.titulo}</div>
                                    <div className="croquis-campos">
                                        {b.campos.map((c, ci) => {
                                            const marcado = !visibleCols || visibleCols.has(c.col);
                                            const esNumerica = numericCols.includes(c.col);
                                            let clase = 'croquis-campo';
                                            if (!c.existe && marcado) clase += ' croquis-campo-on croquis-campo-sin-datos';
                                            else if (!c.existe) clase += ' croquis-campo-vacio';
                                            else if (marcado) clase += ' croquis-campo-on';
                                            return (
                                                <span key={`${c.col}-${ci}`} className="croquis-campo-caja">
                                                    <button
                                                        className={clase}
                                                        onClick={() => toggleCol(c.col)}
                                                        title={c.existe
                                                            ? `${c.col} — clic para ${marcado ? 'sacarla del' : 'incluirla en el'} Excel`
                                                            : `${c.col} — sin datos en el rango elegido (saldrá vacío) · clic para ${marcado ? 'sacarla del' : 'incluirla en el'} Excel`}
                                                    >
                                                        <span className="croquis-tick">
                                                            {marcado ? '☑' : (c.existe ? '☐' : '·')}
                                                        </span>
                                                        {c.etiqueta}
                                                        {!c.existe && <span style={{fontSize:'10px',opacity:0.7,marginLeft:'2px'}}>(sin datos)</span>}
                                                    </button>

                                                    {/* Qué trae la columna al resumir el formulario en una
                                                        línea: el total, el promedio, el máximo, o las filas
                                                        listadas. Solo tiene sentido en lo que va a salir. */}
                                                    {marcado && (
                                                        <select
                                                            className="croquis-op"
                                                            value={esNumerica ? opDe(c.col) : (opPorCol[c.col] ?? 'valor')}
                                                            onChange={e => setOpPorCol(prev => ({ ...prev, [c.col]: e.target.value }))}
                                                            title={`Qué trae ${c.col} al juntar las filas del formulario en una línea`}
                                                        >
                                                            {(esNumerica ? OPERACIONES : OPERACIONES_TEXTO).map(o => (
                                                                <option key={o.value} value={o.value}>
                                                                    {o.signo ? `${o.signo} ${o.label}` : o.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Lo que va a salir, con lo marcado hasta ahora */}
                    {renderVistaPrevia()}
                </div>
                </div>
            )}

            {/* ── AVISO MODO SELECCIÓN ── */}
            {modoSeleccion && rows.length > 0 && (
                <div className="erp-select-banner">
                    <span>
                        ☑️ Marca o desmarca el check de cada encabezado. Las columnas en gris
                        <strong> no saldrán en el Excel</strong>. Seleccionadas: <strong>{marcadasCols.length}</strong> de {columns.length}
                        {ocultarVacias && colsVacias > 0 && `, y ${colsVacias} más quedan fuera por estar vacías`}.
                    </span>
                    <div className="erp-select-banner-actions">
                        <button onClick={() => toggleAll(true)}>✅ Todas</button>
                        <button onClick={() => toggleAll(false)}>❌ Ninguna</button>
                        <button onClick={toggleSoloNumericas}>🔢 Solo numéricas</button>
                        <button className="banner-export" onClick={downloadExcelVista}>📥 Exportar selección</button>
                        <button onClick={() => setModoSeleccion(false)}>✔️ Listo</button>
                    </div>
                </div>
            )}

            {/* ── BARRA DE FILAS SELECCIONADAS ── */}
            {!modoResumen && filasSeleccionadas.length > 0 && (
                <div className="erp-sel-bar">
                    <span className="erp-sel-count">
                        ☑️ <strong>{filasSeleccionadas.length}</strong> de {rows.length} filas ·
                        {' '}{totalSeleccion.formularios.size} formulario(s)
                    </span>

                    <div className="erp-sel-totales">
                        {sumCols.length === 0 ? (
                            <span className="erp-sel-vacio">
                                No hay columnas numéricas para totalizar.
                            </span>
                        ) : sumCols.map(col => {
                            const v = valorResumen(totalSeleccion, col);
                            if (v === null) return null;
                            return (
                                <span
                                    key={col}
                                    className="erp-sel-total"
                                    title={`${OPERACIONES.find(o => o.value === opDe(col))?.label} de ${col}`}
                                >
                                    <em>{signoDe(opDe(col))} {col}</em>
                                    <strong>{fmtNum(v)}</strong>
                                </span>
                            );
                        })}
                    </div>

                    <div className="erp-sel-acciones">
                        <button
                            className={fusionarMarcadas ? 'banner-on' : ''}
                            onClick={() => setFusionarMarcadas(v => !v)}
                            disabled={filasSeleccionadas.length < 2}
                            title="Junta las marcadas en una sola línea. Las que no marcaste siguen saliendo normales, una por una."
                        >
                            🧬 {fusionarMarcadas ? 'Separar de nuevo' : 'Unir en una línea'}
                        </button>
                        <button onClick={seleccionarTodas}>✅ Todas ({rows.length})</button>
                        <button onClick={limpiarSeleccion}>❌ Limpiar</button>
                        <button className="banner-export" onClick={downloadExcelVista}>
                            📥 {fusionarMarcadas
                                ? 'Excel del resumen'
                                : `Excel de las ${filasSeleccionadas.length} filas`}
                        </button>
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
                        <p>
                            {progreso
                                ? `Cargando… ${progreso.traidos.toLocaleString('es-EC')} de ${progreso.total.toLocaleString('es-EC')} registros`
                                : 'Cargando datos…'}
                        </p>
                        {progreso?.total > 0 && (
                            <div className="erp-progreso">
                                <div
                                    className="erp-progreso-barra"
                                    style={{ width: `${Math.min(100, Math.round(progreso.traidos / progreso.total * 100))}%` }}
                                />
                            </div>
                        )}
                    </div>
                ) : rows.length === 0 ? (
                    <p className="erp-empty">
                        {filters.templateId
                            ? `📭 No hay datos para "${selectedTplName}" en el rango seleccionado.`
                            : '📭 Selecciona un formulario y rango de fechas, luego presiona Cargar.'}
                    </p>
                ) : modoResumen ? (
                    /* ── VISTA RESUMEN / TABLA DINÁMICA ── */
                    <table className="erp-table erp-table-resumen">
                        <thead>
                            <tr>
                                <th className="th-fixed th-num">#</th>
                                <th>{etiquetaGrupo}</th>
                                {colsFijasVisibles.map(f => (
                                    <th key={f.key} title={f.ayuda}>{f.label}</th>
                                ))}
                                {sumCols.map(col => (
                                    <th
                                        key={col}
                                        title={`${OPERACIONES.find(o => o.value === opDe(col))?.label} de ${col}`}
                                    >
                                        {signoDe(opDe(col))} {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {resumenRows.map((g, i) => (
                                <tr key={g.label} className={g.esTotal ? 'erp-row-total' : (i % 2 === 0 ? '' : 'erp-row-alt')}>
                                    <td className="td-fixed td-num">{g.esTotal ? 'Σ' : i + 1}</td>
                                    <td title={g.label}>{g.label}</td>
                                    {colsFijasVisibles.map(f => (
                                        <td key={f.key}>
                                            {(f.key === '__FORMULARIOS__' ? g.formularios.size : g.count)
                                                .toLocaleString('es-EC')}
                                        </td>
                                    ))}
                                    {sumCols.map(col => {
                                        const v = valorResumen(g, col);
                                        return (
                                            <td key={col} className="td-num-val">
                                                {v === null ? <span className="td-empty">—</span> : fmtNum(v)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <>
                        <table className={`erp-table${modoSeleccion ? ' erp-table-select' : ''}`}>
                            <thead>
                                <tr>
                                    <th className="th-fixed th-check-row">
                                        <input
                                            type="checkbox"
                                            checked={paginaCompleta}
                                            onChange={togglePagina}
                                            disabled={unaLineaPorForm}
                                            title={unaLineaPorForm
                                                ? 'Con una línea por formulario no hay filas sueltas que marcar'
                                                : (paginaCompleta
                                                    ? 'Desmarcar las filas de esta página'
                                                    : 'Marcar todas las filas de esta página')}
                                        />
                                    </th>
                                    <th className="th-fixed th-num">#</th>
                                    {colsMostradas.map(col => {
                                        const marcada = !visibleCols || visibleCols.has(col);
                                        return (
                                            <th
                                                key={col}
                                                title={modoSeleccion
                                                    ? `${col} — clic para ${marcada ? 'quitarla del' : 'incluirla en el'} Excel`
                                                    : col}
                                                className={modoSeleccion && !marcada ? 'th-off' : ''}
                                            >
                                                {modoSeleccion ? (
                                                    <label className="th-check">
                                                        <input
                                                            type="checkbox"
                                                            checked={marcada}
                                                            onChange={() => toggleCol(col)}
                                                        />
                                                        <span>{col}</span>
                                                    </label>
                                                ) : col}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {pagedItems.map((it, i) => {
                                    // Subtotal de formulario / total general
                                    if (it.tipo !== 'fila') {
                                        const esTotal = it.tipo === 'total';
                                        return (
                                            <tr
                                                key={`${page}-${i}`}
                                                className={esTotal ? 'erp-row-total-gral' : 'erp-row-subtotal'}
                                            >
                                                <td className="td-fixed td-check-row">Σ</td>
                                                <td className="td-fixed td-num">{it.filas}</td>
                                                {colsMostradas.map((col, ci) => {
                                                    if (ci === 0) {
                                                        return (
                                                            <td key={col} className="td-subtotal-label" title={it.label}>
                                                                {esTotal
                                                                    ? `TOTAL GENERAL · ${it.filas} filas`
                                                                    : `Subtotal · ${it.label}`}
                                                            </td>
                                                        );
                                                    }
                                                    const v = sumCols.includes(col) ? valorResumen(it.g, col) : null;
                                                    return (
                                                        <td key={col} className="td-num-val">
                                                            {v === null ? '' : fmtNum(v)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    }

                                    const { r: row, idx } = it;
                                    const esFusion = idx === null;
                                    const marcada = !esFusion && filasSel.has(idx);
                                    return (
                                        <tr
                                            key={`${page}-${i}`}
                                            className={`${i % 2 === 0 ? '' : 'erp-row-alt'}${marcada ? ' erp-row-sel' : ''}${esFusion ? ' erp-row-fusion' : ''}`}
                                        >
                                            <td className="td-fixed td-check-row">
                                                {esFusion ? (unaLineaPorForm ? '📄' : '🧬') : (
                                                    <input
                                                        type="checkbox"
                                                        checked={marcada}
                                                        onChange={() => toggleFila(idx)}
                                                    />
                                                )}
                                            </td>
                                            <td
                                                className="td-fixed td-num"
                                                title={esFusion ? `${row.__fusion} registros resumidos en esta línea` : ''}
                                            >
                                                {esFusion ? `×${row.__fusion}` : idx + 1}
                                            </td>
                                            {colsMostradas.map(col => (
                                                <td
                                                    key={col}
                                                    title={String(row[col] ?? '')}
                                                    className={modoSeleccion && !(!visibleCols || visibleCols.has(col)) ? 'td-off' : ''}
                                                >
                                                    {row[col] ?? <span className="td-empty">—</span>}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>

                            {/* ── PIE CON LOS TOTALES DE LO MARCADO ──
                                Con la fusión activa no va: la línea fusionada YA es
                                ese total y se vería dos veces. */}
                            {filasSeleccionadas.length > 0 && !fusionarMarcadas && (
                                <tfoot>
                                    <tr className="erp-row-total-sel">
                                        <td className="td-fixed td-check-row">Σ</td>
                                        <td className="td-fixed td-num">{filasSeleccionadas.length}</td>
                                        {colsMostradas.map(col => {
                                            const v = sumCols.includes(col)
                                                ? valorResumen(totalSeleccion, col)
                                                : null;
                                            return (
                                                <td key={col} className="td-num-val">
                                                    {v === null ? '' : fmtNum(v)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </tfoot>
                            )}
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