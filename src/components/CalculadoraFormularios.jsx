/**
 * CalculadoraFormularios.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Calculadora de datos de formularios para el Comparativo Plan (y donde haga
 * falta llevar un total de los registros reales a una celda).
 *
 * Reemplaza al "Linker" anterior, que tenía dos limitaciones de fondo:
 *   · parseaba BodyData como objeto { tabla: [...] } cuando el formato real es
 *     un array de elementos [{ id, type, data: [...] }] — no encontraba nada;
 *   · solo sumaba UNA columna de UN formulario: sin filtros por producto o
 *     clasificación, sin rango de fechas y sin combinar valores.
 *
 * Modelo: una expresión formada por TÉRMINOS unidos por operadores.
 *
 *   TÉRMINO = de qué formularios (plantilla + rango de fechas)
 *           + de qué tabla y columna
 *           + qué filas cuentan (filtros "columna contiene texto")
 *           + cómo se agrega (suma / promedio / máx / mín / nº de filas)
 *
 *   EXPRESIÓN = término₁ (op término₂ (op término₃ …))   op ∈ { + − × ÷ }
 *               evaluada de izquierda a derecha
 *
 * Ejemplos que resuelve:
 *   "materia prima del PD-06 de esta semana − producción del PD-06"
 *   "personas del PD-04 + personas del PD-10, solo filas de Mahi"
 *   "horas trabajadas = Hora Final − Hora Inicial del encabezado" (⏱ duración)
 */

import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../apiConfig';
import { cargarFormularios, esBorrador } from '../services/formulariosService';
import { CAMPO_ACTIVIDAD, parseActividades, origenActividad,
  esTemplateCamaron, normActividad } from '../utils/actividadesProceso';
import { fechaDeBusqueda } from '../utils/fechaFormulario';

// ── helpers ──────────────────────────────────────────────────────────────────

const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().toLowerCase();

/** Número tolerante: "1.234,50", "1,234.50", "$ 55", vacío → 0. */
function aNumero(bruto) {
  if (typeof bruto === 'number') return Number.isFinite(bruto) ? bruto : 0;
  const txt = String(bruto ?? '').replace(/[^\d.,-]/g, '');
  if (!txt) return 0;
  const coma = txt.lastIndexOf(','), punto = txt.lastIndexOf('.');
  const limpio = coma > punto ? txt.replace(/\./g, '').replace(',', '.') : txt.replace(/,/g, '');
  const n = Number.parseFloat(limpio);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Hora → horas decimales: "07:30" → 7.5, "1:05 pm" → 13.083…,
 * "2026-08-23T07:30" → 7.5. null si el valor no trae una hora legible.
 */
export function aHoraDecimal(bruto) {
  const m = String(bruto ?? '').match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?/i);
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2]);
  const suf = (m[3] || '').toLowerCase();
  if (suf === 'p' && h < 12) h += 12;
  if (suf === 'a' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h + min / 60;
}

/** Desenvuelve el ReferenceHandler.Preserve de .NET ($values). */
export const lista = (x) => (Array.isArray(x) ? x : (x?.$values ?? []));

/** "Actividad de Proceso" guardada en el encabezado del formulario ('' si no tiene). */
export function actividadDe(form) {
  try {
    const hdr = typeof form.headerData === 'string'
      ? JSON.parse(form.headerData || '{}')
      : (form.headerData || {});
    return String(hdr?.[CAMPO_ACTIVIDAD] ?? '').trim();
  } catch { return ''; }
}

// ── Actividades que aporta la PLANTILLA ───────────────────────────────────────
// El encabezado del formulario trae UNA actividad, y solo si quien lo llenó la
// eligió en el combo. El campo «Proceso - Productivo» de la plantilla declara
// TODAS las actividades que ese registro cubre, de una vez y para siempre.
// El plan usa las dos fuentes: así una fila del plan encuentra sus formularios
// aunque nadie haya tocado el combo al llenarlos.

/** Índice templateID → actividades declaradas en «Proceso - Productivo». */
export function indiceActividadesPlantilla(plantillas) {
  const idx = new Map();
  for (const p of lista(plantillas)) {
    const id = String(p?.templateID ?? p?.TemplateID ?? p?.id ?? '');
    if (!id) continue;
    idx.set(id, {
      actividades: parseActividades(p?.supervisa ?? p?.Supervisa),
      // Se guarda la especie porque hay 9 actividades que existen en los dos
      // catálogos (Empaque, Descarga, Clasificacion…) y el nombre solo no
      // alcanza para saber a qué pestaña del plan pertenece el formulario.
      esCamaron: esTemplateCamaron(p),
    });
  }
  return idx;
}

/** Actividades declaradas por la plantilla de un formulario. */
export function actividadesDePlantilla(form, idx) {
  const id = String(form?.templateID ?? form?.TemplateID ?? '');
  return (id && idx?.get(id)?.actividades) || [];
}

/** ¿La plantilla del formulario es de camarón? (PD-20/PD-21 o el nombre lo dice) */
export function esFormDeCamaron(form, idx) {
  const id = String(form?.templateID ?? form?.TemplateID ?? '');
  return !!(id && idx?.get(id)?.esCamaron);
}

/**
 * ¿Este formulario alimenta esta fila del plan?
 *
 * Además de la actividad, desempata por ESPECIE. Hace falta porque 9
 * actividades — Empaque, Descarga, Clasificacion, Descongelar, Cambio de
 * Etiquetas, Imprimir Etiqueta, Lavar Mallas, Reempaque/ Caja Final y Revision
 * de Producto — están en el catálogo de pescado Y en el de camarón, o sea que
 * la misma fila «Empaque» existe en las dos pestañas del plan. Sin desempate,
 * los kilos de camarón se sumarían también en la fila de pescado y al revés.
 *
 * El desempate se aplica SOLO en esas actividades compartidas: en las que
 * pertenecen a un solo catálogo no hay colisión posible y filtrar de más
 * podría dejar afuera formularios válidos.
 *
 * @param {boolean|null} ambitoCamaron  true = pestaña de camarón, false = de
 *        pescado, null = pestaña con nombre propio (no se desempata).
 */
export function formCorrespondeAFila(form, delPlan, idx, ambitoCamaron = null) {
  // ÚNICA fuente: el «Proceso - Productivo» de la PLANTILLA.
  //
  // La actividad del encabezado del formulario ya no participa. Es un dato que
  // casi nadie llena — 14 de 1642 formularios en planta — y tenerla como
  // fuente alternativa hacía que dos formularios de la misma plantilla
  // cayeran en filas distintas del plan según lo que hubiera tipeado quien lo
  // llenó. El plan se arma por lo que la PLANTILLA declara, que es una
  // decisión de configuración y no del día a día.
  //
  // La comparación es EXACTA, a propósito. «Proceso - Productivo» arrastra
  // años de texto libre que describe el área y no la actividad: «Calidad -
  // Fileteo», «Calidad - Empaque», «Jefe de área», «Reempaque». Comparando con
  // tolerancia, esos textos se llevaban los formularios de CALIDAD a las filas
  // de PRODUCCIÓN — 637 matcheos falsos sobre los datos reales de planta.
  // Exigir igualdad deja fuera ese texto libre y a la vez deja funcionar
  // cualquier actividad elegida con el selector, incluidas las escritas a mano.
  const delPlanNorm = normActividad(delPlan);
  if (!delPlanNorm) return false;

  const coincideActividad = actividadesDePlantilla(form, idx)
    .some(a => normActividad(a) === delPlanNorm);
  if (!coincideActividad) return false;

  // Desempate por especie solo en las actividades que están en los dos
  // catálogos (Empaque, Descarga, Clasificacion…): ahí el nombre no alcanza
  // para saber de qué pestaña del plan es el formulario.
  if (ambitoCamaron === null) return true;
  if (origenActividad(delPlan) !== 'ambas') return true;
  return esFormDeCamaron(form, idx) === ambitoCamaron;
}

const TITULO_ENCABEZADO = '📋 Encabezado del formulario';

/**
 * El encabezado solo participa cuando se lo elige explícitamente como "tabla":
 * con "Todas las tablas" queda afuera para no contaminar sumas ya guardadas.
 */
const tablaVisible = (tb, tablaSel) => (tablaSel ? norm(tb.titulo) === tablaSel : !tb.esHeader);

/**
 * Tablas de un formulario, con el formato REAL de BodyData.
 * Incluye el ENCABEZADO como pseudo-tabla de una fila (esHeader: true): ahí
 * viven Fecha, Hora Inicial, Hora Final, Tipo de Control, etc.
 */
function tablasDe(form, cache) {
  const clave = form.formID ?? form.id;
  if (cache.has(clave)) return cache.get(clave);
  let salida = [];
  try {
    const body = JSON.parse(form.bodyData || '[]');
    if (Array.isArray(body)) {
      salida = body
        .filter(el => el?.type === 'table' && Array.isArray(el.data) && el.data.length > 0)
        .map((el, i) => ({
          id: String(el.id ?? i),
          titulo: el.title || el.titulo || `Tabla ${i + 1}`,
          filas: el.data.filter(r => r && typeof r === 'object' && !r._deleted),
        }));
    }
  } catch { /* bodyData ilegible → sin tablas */ }
  try {
    const hdr = typeof form.headerData === 'string'
      ? JSON.parse(form.headerData || '{}')
      : (form.headerData || {});
    const campos = {};
    for (const [k, v] of Object.entries(hdr)) {
      if (k.startsWith('_') || v === null || typeof v === 'object') continue;
      const s = String(v);
      if (s.length > 120 || s.startsWith('data:')) continue; // firmas / imágenes afuera
      campos[k] = v;
    }
    // Horas de las FIRMAS (se capturan solas al firmar) y del guardado: son las
    // horas que "Ver formulario" muestra aunque el encabezado esté vacío.
    // Acá entran como columnas más, para poder calcular duración con ellas.
    try {
      const fir = typeof form.firmasData === 'string'
        ? JSON.parse(form.firmasData || '{}')
        : (form.firmasData || {});
      for (const [puesto, v] of Object.entries(fir)) {
        if (v && typeof v === 'object' && v.hora) campos[`✍ Hora firma ${puesto}`] = v.hora;
      }
    } catch { /* firmas ilegibles → sin esas columnas */ }
    const creado = String(form.createdAt ?? form.CreatedAt ?? '');
    if (creado.includes('T')) campos['💾 Hora de guardado'] = creado.slice(11, 16);
    if (Object.keys(campos).length > 0) {
      salida.unshift({ id: '__header__', titulo: TITULO_ENCABEZADO, esHeader: true, filas: [campos] });
    }
  } catch { /* headerData ilegible → sin encabezado */ }
  cache.set(clave, salida);
  return salida;
}

/**
 * ¿La fila de la tabla pasa todos los filtros?
 * Dos tipos de filtro:
 *  · { col, texto }    — columna elegida a mano: col CONTIENE texto.
 *  · { patron, texto } — automático (actividad/especie/clasif de la fila del
 *    plan): la columna se busca por patrón de nombre en CADA tabla, así el
 *    mismo filtro sirve aunque la columna se llame "Producto", "Especie" o
 *    "Presentación". Si la tabla no tiene esa columna, la fila pasa (tolerante).
 */
export function filaPasaFiltros(fila, filtros) {
  return (filtros || []).every(fl => {
    if (!fl.texto) return true;
    let clave;
    if (fl.patron) {
      let re; try { re = new RegExp(fl.patron, 'i'); } catch { return true; }
      clave = Object.keys(fila).find(k => re.test(k));
      if (!clave) return true;
    } else {
      if (!fl.col) return true;
      clave = Object.keys(fila).find(k => norm(k) === norm(fl.col)) ?? fl.col;
    }
    return norm(fila[clave]).includes(norm(fl.texto));
  });
}

const AGREGACIONES = [
  { value: 'suma',     label: 'Σ Suma' },
  { value: 'promedio', label: 'x̄ Promedio' },
  { value: 'max',      label: '▲ Máximo' },
  { value: 'min',      label: '▼ Mínimo' },
  { value: 'cuenta',   label: '# Nº de filas' },
];

const OPERADORES = [
  { value: '+', label: '+ sumar' },
  { value: '-', label: '− restar' },
  { value: '*', label: '× multiplicar' },
  { value: '/', label: '÷ dividir' },
];

const terminoNuevo = () => ({
  id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  op: '+',              // cómo se une con el término anterior (el 1º lo ignora)
  templateId: '',       // '' = todas las plantillas
  desde: '', hasta: '', // rango sobre la fecha del encabezado (la del operador)
  formId: '',           // '' = todos los formularios que pasen el filtro
  tabla: '',            // título normalizado; '' = todas las tablas
  columna: '',
  fila: '',             // '' = todas; N = solo la fila N (con formulario elegido,
                        //   término = UNA CELDA exacta de ese formulario)
  agregacion: 'suma',
  duracion: false,      // ⏱ modo duración: valor de la fila = horas entre dos
  columnaHasta: '',     //   columnas de hora (columna = inicial, esta = final)
  filtros: [],          // [{ col, texto }] — la fila cuenta si col CONTIENE texto
});

/**
 * Evalúa un término contra los formularios cargados.
 * @returns {{valor:number, forms:number, filas:number}}
 */
export function evaluarTermino(t, forms, cache) {
  let filasUsadas = 0;
  let sinHora = 0;   // filas que en modo ⏱ no tenían las dos horas legibles
  const formsUsados = new Set();
  const valores = [];

  for (const f of forms) {
    if (t.templateId && String(f.templateID ?? f.TemplateID) !== String(t.templateId)) continue;
    if (t.formId && String(f.formID ?? f.id) !== String(t.formId)) continue;
    const fecha = fechaDeBusqueda(f);
    if (t.desde && fecha && fecha < t.desde) continue;
    if (t.hasta && fecha && fecha > t.hasta) continue;

    for (const tabla of tablasDe(f, cache)) {
      if (!tablaVisible(tabla, t.tabla)) continue;

      // Fila específica: el término apunta a UNA celda de esta tabla.
      const filasFuente = t.fila !== '' && t.fila !== undefined
        ? (tabla.filas[Number(t.fila) - 1] ? [tabla.filas[Number(t.fila) - 1]] : [])
        : tabla.filas;

      for (const fila of filasFuente) {
        // Filtros de fila: todas las condiciones tienen que cumplirse.
        if (!filaPasaFiltros(fila, t.filtros)) continue;

        if (t.agregacion === 'cuenta') {
          valores.push(1);
          filasUsadas++; formsUsados.add(f.formID ?? f.id);
          continue;
        }
        // ⏱ Duración: horas entre dos columnas de hora de la MISMA fila.
        // Si la final es menor que la inicial se asume que cruzó medianoche.
        if (t.duracion) {
          if (!t.columna || !t.columnaHasta) continue;
          const kIni = Object.keys(fila).find(k => norm(k) === norm(t.columna));
          const kFin = Object.keys(fila).find(k => norm(k) === norm(t.columnaHasta));
          const hIni = aHoraDecimal(fila[kIni ?? t.columna]);
          const hFin = aHoraDecimal(fila[kFin ?? t.columnaHasta]);
          if (hIni === null || hFin === null) { sinHora++; continue; }
          let d = hFin - hIni;
          if (d < 0) d += 24;
          valores.push(d);
          filasUsadas++; formsUsados.add(f.formID ?? f.id);
          continue;
        }
        if (!t.columna) continue;
        const clave = Object.keys(fila).find(k => norm(k) === norm(t.columna));
        const crudo = fila[clave ?? t.columna];
        if (crudo === undefined || crudo === null || String(crudo).trim() === '') continue;
        valores.push(aNumero(crudo));
        filasUsadas++; formsUsados.add(f.formID ?? f.id);
      }
    }
  }

  let valor = 0;
  if (valores.length > 0) {
    switch (t.agregacion) {
      case 'promedio': valor = valores.reduce((a, b) => a + b, 0) / valores.length; break;
      case 'max':      valor = Math.max(...valores); break;
      case 'min':      valor = Math.min(...valores); break;
      case 'cuenta':   valor = valores.length; break;
      default:         valor = valores.reduce((a, b) => a + b, 0);
    }
  }
  return { valor, forms: formsUsados.size, filas: filasUsadas, sinHora };
}

/**
 * Ejecuta una RECETA completa (los términos guardados de una celda/columna)
 * contra un conjunto de formularios ya filtrado — sin abrir el modal.
 * Es lo que usa el botón "▶ Ejecutar consultas" del plan: configurás una vez
 * y después se recalcula solo con los formularios del día.
 */
export function evaluarReceta(receta, forms) {
  const cache = new Map();
  let acc = null;
  for (const t of (receta?.terminos || [])) {
    const { valor } = evaluarTermino(t, forms, cache);
    if (acc === null) { acc = valor; continue; }
    switch (t.op) {
      case '-': acc -= valor; break;
      case '*': acc *= valor; break;
      case '/': acc = valor === 0 ? 0 : acc / valor; break;
      default:  acc += valor;
    }
  }
  const dec = receta?.decimales ?? 2;
  return Number((acc ?? 0).toFixed(dec));
}

// ── estilos compactos ─────────────────────────────────────────────────────────

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' },
  modal:   { background: 'white', borderRadius: '14px', width: 'min(880px, 96vw)', maxHeight: '92vh', overflowY: 'auto', padding: '22px', boxShadow: '0 24px 60px rgba(0,0,0,.28)' },
  label:   { fontSize: '10.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: '2px' },
  input:   { width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', background: 'white' },
  chipOp:  { padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700, background: '#f8fafc' },
  btn:     { padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' },
};

// ── componente ────────────────────────────────────────────────────────────────

/**
 * @param {boolean}  open
 * @param {Function} onClose
 * @param {Function} onApply  — (valorNumerico, receta) => void. La receta es la
 *                              configuración completa de la expresión: quien la
 *                              guarde puede reabrir la calculadora ya armada.
 * @param {string}   destino  — etiqueta de la celda destino, solo informativa
 * @param {Object}   recetaInicial — { terminos, decimales } guardados antes para
 *                              esta celda/columna; se cargan al abrir y solo
 *                              queda ajustar el registro puntual.
 * @param {string}   fechaPlan — fecha del plan (AAAA-MM-DD). Si viene, la
 *                              calculadora arranca mostrando SOLO los
 *                              formularios de ese día (sin tocar desde/hasta).
 * @param {string}   actividad — actividad de la fila del plan. Si viene, se
 *                              muestran SOLO los formularios PD guardados con
 *                              esa "Actividad de Proceso" en su encabezado.
 * @param {string}   producto  — producto/especie de la sub-fila del plan: agrega
 *                              un filtro automático de filas (columna Producto/
 *                              Especie/Presentación contiene ese texto).
 * @param {string}   clasif    — clasificación de la sub-fila: filtro automático
 *                              sobre la columna Clasificación.
 * @param {boolean|null} ambitoCamaron — especie de la pestaña del plan de donde
 *                              salió la celda. Desempata las 9 actividades que
 *                              existen en los dos catálogos (Empaque, Descarga…).
 */
export default function CalculadoraFormularios({ open, onClose, onApply, destino = '', recetaInicial = null, fechaPlan = '', actividad = '', producto = '', clasif = '', ambitoCamaron = null }) {
  const [forms, setForms] = useState([]);
  const [plantillas, setPlantillas] = useState([]);

  // Las actividades que declara cada plantilla en «Proceso - Productivo»: con
  // esto el filtro de actividad alcanza también a los formularios cuyo
  // encabezado quedó sin actividad elegida.
  const idxActividades = useMemo(() => indiceActividadesPlantilla(plantillas), [plantillas]);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [terminos, setTerminos] = useState([terminoNuevo()]);
  const [decimales, setDecimales] = useState(2);
  const [desdeReceta, setDesdeReceta] = useState(false);
  // Filtros base (se aplican ANTES que cualquier término): día del plan y
  // actividad de la fila. Arrancan prendidos cuando el dato viene del plan;
  // se pueden apagar para buscar en todo el histórico.
  const [soloFecha, setSoloFecha] = useState(false);
  const [soloActividad, setSoloActividad] = useState(false);

  // El parse de BodyData es caro: una sola vez por formulario y por apertura.
  const cache = useMemo(() => new Map(), [forms]);

  useEffect(() => {
    if (!open) return;
    setSoloFecha(!!fechaPlan);
    setSoloActividad(!!actividad);
  }, [open, fechaPlan, actividad]);

  // Los formularios sobre los que trabaja TODO lo demás (términos, selectores,
  // sugerencias). Con los interruptores prendidos: solo los del día del plan
  // y/o solo los que se guardaron con la actividad de esta fila.
  const formsFiltrados = useMemo(() => forms.filter(f => {
    if (soloFecha && fechaPlan) {
      // La del encabezado: el formulario pertenece al día que trabajó el
      // operador, no al día en que alguien apretó guardar.
      const fch = fechaDeBusqueda(f);
      if (fch && fch !== fechaPlan) return false;
    }
    if (soloActividad && actividad
        && !formCorrespondeAFila(f, actividad, idxActividades, ambitoCamaron)) return false;
    return true;
  }), [forms, soloFecha, fechaPlan, soloActividad, actividad, idxActividades, ambitoCamaron]);

  // ── CONFIGURAR AUNQUE ESE DÍA NO TENGA NADA ─────────────────────────────────
  //
  // Los desplegables de plantilla, tabla y columna se arman a partir de los
  // formularios que pasan los filtros. Si ese día no hay ninguno quedan todos
  // vacíos y la consulta se vuelve imposible de armar — que es distinto de que
  // dé cero.
  //
  // Cuando los filtros dejan la lista en cero se cae a TODO el histórico, solo
  // para poder configurar. La consulta se guarda igual y al ejecutar cada día
  // usa los formularios que le corresponden: si ese día no tiene, da cero.
  const sinDatosConFiltros = formsFiltrados.length === 0 && forms.length > 0;
  const formsBase = sinDatosConFiltros ? forms : formsFiltrados;

  /** Cuántos formularios tienen la actividad de la fila (para el rótulo). */
  const conActividad = useMemo(
    () => (actividad
      ? forms.filter(f => formCorrespondeAFila(f, actividad, idxActividades, ambitoCamaron)).length
      : 0),
    [forms, actividad, idxActividades, ambitoCamaron]
  );

  // Al abrir: si la celda ya tiene una consulta guardada, se carga tal cual;
  // si no, arranca en blanco. Los ids se regeneran para no chocar con React.
  useEffect(() => {
    if (!open) return;
    // Filtros automáticos de la sub-fila del plan (producto/clasificación):
    // se aplican por PATRÓN de nombre de columna, y siempre con el valor
    // actual de la fila — si la receta guardada traía filtros auto de otra
    // fila, se reemplazan.
    const autoF = [];
    if (producto) autoF.push({ patron: '(producto|especie|presentaci)', texto: producto });
    if (clasif) autoF.push({ patron: 'clasif', texto: clasif });
    const conAuto = (t) => ({ ...t, filtros: [...(t.filtros || []).filter(f => !f.patron), ...autoF] });
    if (recetaInicial?.terminos?.length) {
      // desde/hasta se anulan: el rango manual se reemplazó por el filtro base
      // "día del plan" — una receta vieja con fechas de otra semana taparía todo.
      setTerminos(recetaInicial.terminos.map(t => conAuto({ ...terminoNuevo(), ...t, desde: '', hasta: '', id: terminoNuevo().id })));
      if (recetaInicial.decimales !== undefined) setDecimales(recetaInicial.decimales);
      setDesdeReceta(true);
    } else {
      setTerminos([conAuto(terminoNuevo())]);
      setDesdeReceta(false);
    }
  }, [open, recetaInicial, producto, clasif]);

  useEffect(() => {
    if (!open) return;
    setCargando(true);
    setErrorCarga('');
    // Los mismos registros que usa el motor del plan, borradores incluidos: si
    // la vista previa contara otra cosa que el cálculo, no serviría de nada.
    Promise.all([
      cargarFormularios({ incluirBorradores: true }).catch(() => ({ formularios: [] })),
      fetch(`${API_BASE_URL}/Templates`).then(r => (r.ok ? r.json() : [])),
    ])
      .then(([datos, ts]) => {
        setForms(lista(datos.formularios).sort((a, b) => (b.formID ?? 0) - (a.formID ?? 0)));
        setPlantillas(lista(ts));
      })
      .catch(e => setErrorCarga(`No se pudieron cargar los formularios: ${e.message}`))
      .finally(() => setCargando(false));
  }, [open]);

  // Plantillas que realmente tienen formularios llenados (dentro de los
  // filtros base de fecha/actividad), para el selector.
  const plantillasConDatos = useMemo(() => {
    const ids = new Set(formsBase.map(f => String(f.templateID ?? f.TemplateID)));
    return plantillas
      .filter(t => ids.has(String(t.templateID ?? t.TemplateID)))
      .map(t => ({
        id: String(t.templateID ?? t.TemplateID),
        etiqueta: `${t.codigo ?? ''} — ${t.nombre ?? ''}`.trim().replace(/^—\s*/, ''),
      }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
  }, [forms, plantillas]);

  /** Formularios que pasan el filtro del término, para elegir uno puntual. */
  const formsParaTermino = (t) => {
    const codigoDe = (f) => {
      const p = plantillas.find(x => String(x.templateID ?? x.TemplateID) === String(f.templateID ?? f.TemplateID));
      return p?.codigo || '';
    };
    return formsBase
      .filter(f => {
        // Un borrador desaparece cuando el operador cierra el formulario: una
        // consulta amarrada a ese id quedaría devolviendo 0 para siempre. Los
        // borradores suman en el total, pero no se pueden fijar de a uno.
        if (esBorrador(f)) return false;
        if (t.templateId && String(f.templateID ?? f.TemplateID) !== String(t.templateId)) return false;
        const fecha = fechaDeBusqueda(f);
        if (t.desde && fecha && fecha < t.desde) return false;
        if (t.hasta && fecha && fecha > t.hasta) return false;
        return true;
      })
      .slice(0, 300)   // el desplegable no necesita miles de opciones
      .map(f => {
        // 🏭 = actividad del encabezado; 📋 = la que declara la plantilla
        // en «Proceso - Productivo» (cuando el encabezado no trae ninguna).
        const act = actividadDe(f);
        const dePlant = actividadesDePlantilla(f, idxActividades);
        const sufijo = act ? ` · 🏭 ${act}`
          : (dePlant.length ? ` · 📋 ${dePlant.join(', ')}` : '');
        return {
          id: String(f.formID ?? f.id),
          label: `#${f.formID ?? f.id} · ${fechaDeBusqueda(f)} · ${codigoDe(f)}${sufijo}`,
        };
      });
  };

  /** Filas de la tabla elegida en un formulario puntual, con vista previa. */
  const filasParaTermino = (t) => {
    if (!t.formId || !t.tabla) return [];
    const f = formsBase.find(x => String(x.formID ?? x.id) === String(t.formId));
    if (!f) return [];
    const tb = tablasDe(f, cache).find(x => norm(x.titulo) === t.tabla);
    if (!tb) return [];
    return tb.filas.map((fila, i) => {
      const vista = Object.entries(fila)
        .filter(([k, v]) => !k.startsWith('_') && String(v ?? '').trim() !== '')
        .slice(0, 3)
        .map(([, v]) => String(v).slice(0, 14))
        .join(' · ');
      return { value: String(i + 1), label: `Fila ${i + 1} — ${vista || '(vacía)'}` };
    });
  };

  /** Tablas visibles para un término (según su filtro de plantilla/fechas). */
  const tablasParaTermino = (t) => {
    const titulos = new Map();
    for (const f of formsBase) {
      if (t.templateId && String(f.templateID ?? f.TemplateID) !== String(t.templateId)) continue;
      if (t.formId && String(f.formID ?? f.id) !== String(t.formId)) continue;
      for (const tb of tablasDe(f, cache)) titulos.set(norm(tb.titulo), tb.titulo);
    }
    return [...titulos.entries()].map(([v, label]) => ({ value: v, label }));
  };

  /** Columnas visibles para un término (según plantilla + tabla elegida). */
  const columnasParaTermino = (t) => {
    const cols = new Map();
    for (const f of formsBase) {
      if (t.templateId && String(f.templateID ?? f.TemplateID) !== String(t.templateId)) continue;
      for (const tb of tablasDe(f, cache)) {
        if (!tablaVisible(tb, t.tabla)) continue;
        for (const fila of tb.filas) {
          for (const k of Object.keys(fila)) {
            if (k.startsWith('_')) continue;
            if (!cols.has(norm(k))) cols.set(norm(k), k);
          }
        }
      }
    }
    return [...cols.values()];
  };

  const setTermino = (id, cambios) =>
    setTerminos(ts => ts.map(t => (t.id === id ? { ...t, ...cambios } : t)));

  /**
   * Valores DISTINTOS que una columna tiene en los formularios del término.
   * Alimenta las sugerencias del filtro: en vez de escribir "Mahi" de memoria,
   * se elige entre lo que de verdad está cargado.
   */
  const valoresDeColumna = (t, col) => {
    if (!col) return [];
    const vistos = new Set();
    const salida = [];
    for (const f of formsBase) {
      if (t.templateId && String(f.templateID ?? f.TemplateID) !== String(t.templateId)) continue;
      if (t.formId && String(f.formID ?? f.id) !== String(t.formId)) continue;
      for (const tb of tablasDe(f, cache)) {
        if (!tablaVisible(tb, t.tabla)) continue;
        for (const fila of tb.filas) {
          const clave = Object.keys(fila).find(k => norm(k) === norm(col));
          const v = String(fila[clave ?? col] ?? '').trim();
          if (!v || vistos.has(norm(v))) continue;
          vistos.add(norm(v));
          salida.push(v);
          if (salida.length >= 80) return salida.sort((a, b) => a.localeCompare(b, 'es'));
        }
      }
    }
    return salida.sort((a, b) => a.localeCompare(b, 'es'));
  };

  /**
   * Vista previa VISUAL de la tabla del término: el formulario puntual si hay
   * uno elegido, o el más reciente que pase los filtros base. Sirve para VER
   * las columnas y filas reales antes de calcular — y elegir la columna con
   * un clic en su encabezado.
   */
  const vistaPrevia = (t) => {
    if (!t.tabla) return null;
    const f = t.formId
      ? formsBase.find(x => String(x.formID ?? x.id) === String(t.formId))
      : formsBase.find(x => {
          if (t.templateId && String(x.templateID ?? x.TemplateID) !== String(t.templateId)) return false;
          return tablasDe(x, cache).some(tb => norm(tb.titulo) === t.tabla);
        });
    if (!f) return null;
    const tb = tablasDe(f, cache).find(x => norm(x.titulo) === t.tabla);
    if (!tb || tb.filas.length === 0) return null;
    const columnas = [];
    for (const fila of tb.filas) {
      for (const k of Object.keys(fila)) {
        if (!k.startsWith('_') && !columnas.includes(k)) columnas.push(k);
      }
    }
    const pasaFiltros = (fila) => filaPasaFiltros(fila, t.filtros);
    return {
      formId: String(f.formID ?? f.id),
      fecha: fechaDeBusqueda(f),
      titulo: tb.titulo, columnas, filas: tb.filas, pasaFiltros,
    };
  };

  /** Columna del término cuyo nombre matchea el patrón (producto, clasif…). */
  const columnaQueMatchea = (t, patron) =>
    columnasParaTermino(t).find(c => patron.test(c)) || '';

  /** Agrega un filtro con la columna ya elegida (especie / clasificación). */
  const agregarFiltroRapido = (t, patron) => {
    const col = columnaQueMatchea(t, patron);
    setTermino(t.id, { filtros: [...(t.filtros || []), { col, texto: '' }] });
  };

  const resultados = useMemo(
    () => terminos.map(t => evaluarTermino(t, formsBase, cache)),
    [terminos, formsBase, cache]
  );

  const total = useMemo(() => {
    let acc = null;
    terminos.forEach((t, i) => {
      const v = resultados[i]?.valor ?? 0;
      if (acc === null) { acc = v; return; }
      switch (t.op) {
        case '-': acc -= v; break;
        case '*': acc *= v; break;
        case '/': acc = v === 0 ? 0 : acc / v; break;
        default:  acc += v;
      }
    });
    return acc ?? 0;
  }, [terminos, resultados]);

  const fmt = (v) => Number(v).toLocaleString('es-EC', {
    minimumFractionDigits: 0, maximumFractionDigits: decimales,
  });

  if (!open) return null;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <div style={{ fontSize: '1.6rem', background: '#e0e7ff', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🧮</div>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px' }}>Calculadora de formularios</h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              Filtrá los registros reales, agregalos y combiná los valores.
              {destino && <> Resultado → <strong>{destino}</strong>.</>}
            </p>
          </div>
        </div>

        {desdeReceta && !cargando && (
          <div style={{ marginTop: '10px', padding: '8px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', fontSize: '12px', color: '#166534' }}>
            📌 Se cargó la <strong>consulta guardada</strong> de esta celda/columna.
            Cambiá el <strong>registro puntual</strong> (u otro dato) y aplicá — la estructura queda igual.
          </div>
        )}

        {/* Filtros base: la calculadora arranca ya acotada al día del plan y a
            la actividad de la fila — sin poner fechas ni filtros a mano. Cada
            uno se puede apagar para ampliar la búsqueda. */}
        {!cargando && (fechaPlan || actividad) && (
          <div style={{ marginTop: '10px', padding: '10px 12px', background: '#eef2ff', border: '1.5px solid #c7d2fe', borderRadius: '10px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', fontSize: '12.5px' }}>
            {fechaPlan && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, color: '#3730a3' }}>
                <input type="checkbox" checked={soloFecha} onChange={e => setSoloFecha(e.target.checked)} />
                📅 Solo del día del plan ({fechaPlan})
              </label>
            )}
            {actividad && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, color: '#3730a3' }}>
                <input type="checkbox" checked={soloActividad} onChange={e => setSoloActividad(e.target.checked)} />
                🏭 Solo actividad «{actividad}»
                <span style={{ fontWeight: 400, color: '#6366f1' }}>({conActividad} form con esa actividad)</span>
              </label>
            )}
            <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#4338ca' }}>
              {formsFiltrados.length} de {forms.length} formularios
            </span>
            {sinDatosConFiltros && (
              <div style={{ flexBasis: '100%', color: '#1e40af', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', lineHeight: 1.5 }}>
                📋 <strong>Ningún formulario pasa estos filtros</strong>, así que se está
                configurando sobre <strong>todo el histórico ({forms.length} formularios)</strong> para
                que puedas armar la consulta igual.
                <br />
                La consulta se guarda normal: al ejecutar, cada día usa los formularios que le
                correspondan — y si ese día no tiene, da cero.
                <br />
                <strong>Ojo:</strong> el valor que ves abajo sale de todo el histórico, no de ese día.
                {soloActividad && actividad && conActividad === 0 && (
                  <>
                    <br />
                    🏭 Además, ningún formulario tiene la actividad «{actividad}». Se
                    declara en <strong>Proceso - Productivo</strong> de la plantilla.
                  </>
                )}
              </div>
            )}
            {actividad && soloActividad && conActividad === 0 && forms.length > 0 && !sinDatosConFiltros && (
              <div style={{ flexBasis: '100%', color: '#9a3412', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '8px', padding: '6px 10px', fontSize: '12px' }}>
                ⚠️ Ningún formulario tiene guardada la actividad «{actividad}». La actividad
                se declara en <strong>Proceso - Productivo</strong> de la plantilla — o apagá
                este filtro para ver todos.
              </div>
            )}
          </div>
        )}

        {cargando && <div style={{ padding: '18px 0', color: '#64748b', fontSize: '13px' }}>⏳ Cargando formularios…</div>}
        {errorCarga && <div style={{ padding: '10px', background: '#fef2f2', color: '#b91c1c', borderRadius: '8px', fontSize: '12px', margin: '10px 0' }}>{errorCarga}</div>}

        {!cargando && terminos.map((t, i) => {
          const res = resultados[i] || { valor: 0, forms: 0, filas: 0 };
          const tablas = tablasParaTermino(t);
          const columnas = columnasParaTermino(t);
          return (
            <div key={t.id}>
              {i > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                  <select
                    value={t.op}
                    onChange={e => setTermino(t.id, { op: e.target.value })}
                    style={{ ...S.chipOp, cursor: 'pointer' }}
                    title="Cómo se combina con lo anterior"
                  >
                    {OPERADORES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}

              <div style={{ border: '1.5px solid #c7d2fe', background: '#f8faff', borderRadius: '10px', padding: '12px', display: 'grid', gap: '8px' }}>
                {/* fila 1: origen. Sin Desde/Hasta: la fecha la pone el filtro
                    base "día del plan" (arriba) — se apaga para ver histórico. */}
                <div>
                  <span style={S.label}>Formulario (plantilla)</span>
                  <select style={S.input} value={t.templateId}
                    onChange={e => setTermino(t.id, { templateId: e.target.value, formId: '', tabla: '', columna: '', fila: '' })}>
                    <option value="">— Todos los formularios —</option>
                    {plantillasConDatos.map(p => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
                  </select>
                </div>

                {/* fila 1b: afinar a UN registro puntual (opcional) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <span style={S.label}>Registro puntual (opcional)</span>
                    <select style={S.input} value={t.formId}
                      onChange={e => setTermino(t.id, { formId: e.target.value, fila: '' })}>
                      <option value="">— Todos los que pasan el filtro —</option>
                      {formsParaTermino(t).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <span style={S.label}>Fila puntual (opcional)</span>
                    <select style={S.input} value={t.fila}
                      onChange={e => setTermino(t.id, { fila: e.target.value })}
                      disabled={!t.formId || !t.tabla}
                      title={!t.formId || !t.tabla ? 'Elegí primero un registro puntual y una tabla' : 'Con fila elegida, el término es UNA celda exacta'}>
                      <option value="">— Todas las filas —</option>
                      {filasParaTermino(t).map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* fila 2: qué dato. En modo ⏱ duración la "columna a calcular"
                    pasa a ser la hora inicial y aparece el selector de hora final:
                    cada fila vale (final − inicial) en horas. */}
                <div style={{ display: 'grid', gridTemplateColumns: t.duracion ? '1.1fr 1.1fr 1.1fr 0.9fr' : '1.4fr 1.4fr 1fr', gap: '8px' }}>
                  <div>
                    <span style={S.label}>Tabla</span>
                    <select style={S.input} value={t.tabla} onChange={e => setTermino(t.id, { tabla: e.target.value, columna: '', columnaHasta: '', fila: '' })}>
                      <option value="">— Todas las tablas —</option>
                      {tablas.map(tb => <option key={tb.value} value={tb.value}>{tb.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <span style={S.label}>{t.duracion ? '🕐 Hora inicial' : 'Columna a calcular'}</span>
                    <select style={S.input} value={t.columna} onChange={e => setTermino(t.id, { columna: e.target.value })}
                      disabled={t.agregacion === 'cuenta'}>
                      <option value="">{t.agregacion === 'cuenta' ? '(no hace falta)' : '— Elegir columna —'}</option>
                      {columnas.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {t.duracion && (
                    <div>
                      <span style={S.label}>🕔 Hora final</span>
                      <select style={S.input} value={t.columnaHasta} onChange={e => setTermino(t.id, { columnaHasta: e.target.value })}
                        disabled={t.agregacion === 'cuenta'}>
                        <option value="">— Elegir columna —</option>
                        {columnas.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <span style={S.label}>Operación</span>
                    <select style={S.input} value={t.agregacion} onChange={e => setTermino(t.id, { agregacion: e.target.value })}>
                      {AGREGACIONES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Vista previa visual: columnas y filas reales de la tabla.
                    Clic en el encabezado de una columna = usarla en el cálculo.
                    Las filas que no pasan los filtros se ven apagadas. */}
                {(() => {
                  const vp = vistaPrevia(t);
                  if (!vp) return null;
                  const MAX = 6;
                  const thMini = { padding: '4px 8px', fontSize: '11px', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0 };
                  const tdMini = { padding: '3px 8px', fontSize: '11.5px', whiteSpace: 'nowrap', borderBottom: '1px solid #f1f5f9' };
                  return (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: 'white' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', padding: '4px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        👁️ <strong>{vp.titulo}</strong> — formulario #{vp.formId} ({vp.fecha}).
                        {' '}Clic en una columna para calcularla.
                      </div>
                      <div style={{ overflowX: 'auto', maxHeight: '190px', overflowY: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ ...thMini, background: '#f1f5f9', color: '#94a3b8' }}>#</th>
                              {vp.columnas.map(c => {
                                const activa = norm(c) === norm(t.columna) && t.columna;
                                return (
                                  <th key={c}
                                    onClick={() => setTermino(t.id, { columna: c })}
                                    title="Clic: calcular esta columna"
                                    style={{ ...thMini, cursor: 'pointer', background: activa ? '#4338ca' : '#f1f5f9', color: activa ? 'white' : '#334155' }}>
                                    {c}{activa ? ' ✓' : ''}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {vp.filas.slice(0, MAX).map((fila, fi) => {
                              const pasa = vp.pasaFiltros(fila);
                              const esLaFila = t.fila !== '' && Number(t.fila) === fi + 1;
                              return (
                                <tr key={fi} style={{ opacity: pasa ? 1 : 0.35, background: esLaFila ? '#fef9c3' : (fi % 2 ? '#fafafa' : 'white') }}>
                                  <td style={{ ...tdMini, color: '#94a3b8' }}>{fi + 1}</td>
                                  {vp.columnas.map(c => {
                                    const activa = norm(c) === norm(t.columna) && t.columna;
                                    return (
                                      <td key={c} style={{ ...tdMini, background: activa ? '#eef2ff' : undefined, fontWeight: activa ? 700 : 400 }}>
                                        {String(fila[c] ?? '')}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {vp.filas.length > MAX && (
                        <div style={{ fontSize: '10.5px', color: '#94a3b8', padding: '3px 10px', background: '#f8fafc' }}>
                          … y {vp.filas.length - MAX} filas más (todas cuentan en el cálculo)
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* fila 3: filtros por contenido (producto, clasificación, lo que sea) */}
                {(t.filtros || []).map((fl, fi) => {
                  const dlId = `dl-${t.id}-${fi}`;
                  const esAuto = !!fl.patron;
                  const colAuto = esAuto
                    ? (columnas.find(c => { try { return new RegExp(fl.patron, 'i').test(c); } catch { return false; } }) || '')
                    : '';
                  const sugerencias = valoresDeColumna(t, esAuto ? colAuto : fl.col);
                  const etiquetaAuto = /clasif/i.test(fl.patron || '') ? '🏷️ Clasificación' : '🐟 Producto / Especie';
                  return (
                    <div key={dlId} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr auto', gap: '8px', alignItems: 'end' }}>
                      <div>
                        <span style={S.label}>Solo filas donde…</span>
                        {esAuto ? (
                          <div style={{ ...S.input, background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', fontWeight: 600 }}
                            title={colAuto ? `Columna detectada: ${colAuto}` : 'Se busca la columna por nombre en cada tabla'}>
                            {etiquetaAuto} <span style={{ fontWeight: 400, fontSize: '11px' }}>(auto{colAuto ? `: ${colAuto}` : ''})</span>
                          </div>
                        ) : (
                          <select style={S.input} value={fl.col}
                            onChange={e => setTermino(t.id, { filtros: t.filtros.map((x, xi) => xi === fi ? { ...x, col: e.target.value, texto: '' } : x) })}>
                            <option value="">— Columna —</option>
                            {columnas.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        )}
                      </div>
                      <div>
                        <span style={S.label}>…contiene {sugerencias.length > 0 && <em style={{ textTransform: 'none', fontWeight: 400 }}>({sugerencias.length} valores reales)</em>}</span>
                        {/* Con datalist: elegís entre los valores que DE VERDAD
                            están cargados en esa columna, o escribís parte. */}
                        <input style={S.input} value={fl.texto} list={dlId}
                          placeholder={sugerencias.length ? 'Elegir o escribir…' : 'Ej: Mahi, 8oz, Swordfish…'}
                          onChange={e => setTermino(t.id, { filtros: t.filtros.map((x, xi) => xi === fi ? { ...x, texto: e.target.value } : x) })} />
                        <datalist id={dlId}>
                          {sugerencias.map(v => <option key={v} value={v} />)}
                        </datalist>
                      </div>
                      <button
                        style={{ ...S.btn, background: '#fee2e2', color: '#b91c1c', padding: '6px 10px' }}
                        onClick={() => setTermino(t.id, { filtros: t.filtros.filter((_, xi) => xi !== fi) })}
                        title="Quitar este filtro"
                      >✕</button>
                    </div>
                  );
                })}

                {/* pie del término */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {/* Accesos directos: agregan el filtro con la columna ya
                      apuntada a especie / clasificación de esta tabla. */}
                  <button
                    style={{ ...S.btn, background: '#ecfdf5', color: '#047857', padding: '5px 10px', fontSize: '12px' }}
                    onClick={() => agregarFiltroRapido(t, /(producto|especie|presentaci)/i)}
                    title="Filtrar por producto / especie"
                  >🐟 + Especie</button>
                  <button
                    style={{ ...S.btn, background: '#fdf4ff', color: '#a21caf', padding: '5px 10px', fontSize: '12px' }}
                    onClick={() => agregarFiltroRapido(t, /clasif/i)}
                    title="Filtrar por clasificación"
                  >🏷️ + Clasificación</button>
                  <button
                    style={{ ...S.btn, background: t.duracion ? '#4338ca' : '#fffbeb', color: t.duracion ? 'white' : '#b45309', padding: '5px 10px', fontSize: '12px', border: t.duracion ? 'none' : '1px solid #fcd34d' }}
                    onClick={() => {
                      if (t.duracion) { setTermino(t.id, { duracion: false, columnaHasta: '' }); return; }
                      // Al prender, se auto-apuntan las columnas de hora típicas.
                      const ini = columnas.find(c => /(inici|entrada|arranq|desde)/i.test(c)) || t.columna || '';
                      const fin = columnas.find(c => /(final|salida|hasta|termin)/i.test(c)) || '';
                      setTermino(t.id, { duracion: true, columna: ini, columnaHasta: fin });
                    }}
                    title="Horas transcurridas entre dos campos de hora (ej: Hora Inicial → Hora Final). Si están en el encabezado, elegí «📋 Encabezado del formulario» como Tabla."
                  >⏱ {t.duracion ? 'Duración de horas ✓' : '+ Duración de horas'}</button>
                  <button
                    style={{ ...S.btn, background: '#eef2ff', color: '#4338ca', padding: '5px 10px', fontSize: '12px' }}
                    onClick={() => setTermino(t.id, { filtros: [...(t.filtros || []), { col: '', texto: '' }] })}
                  >+ Otro filtro</button>

                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {res.forms} form · {res.filas} filas
                    </span>
                    {t.duracion && res.sinHora > 0 && (
                      <span style={{ fontSize: '11px', color: '#b45309', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', padding: '2px 6px' }}
                        title="Registros donde la hora inicial o final está vacía o ilegible: no cuentan en la duración">
                        ⚠ {res.sinHora} sin hora
                      </span>
                    )}
                    <strong style={{ fontSize: '18px', color: '#4338ca', fontVariantNumeric: 'tabular-nums' }}>{fmt(res.valor)}{t.duracion ? ' h' : ''}</strong>
                    {terminos.length > 1 && (
                      <button
                        style={{ ...S.btn, background: 'transparent', color: '#b91c1c', padding: '2px 6px' }}
                        onClick={() => setTerminos(ts => ts.filter(x => x.id !== t.id))}
                        title="Quitar este término"
                      >🗑️</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {!cargando && (
          <button
            style={{ ...S.btn, background: '#f1f5f9', color: '#334155', width: '100%', marginTop: '10px', border: '1.5px dashed #cbd5e1' }}
            onClick={() => setTerminos(ts => [...ts, terminoNuevo()])}
          >+ Agregar término (sumar, restar, multiplicar o dividir otro dato)</button>
        )}

        {/* resultado final */}
        <div style={{ marginTop: '14px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>Resultado</div>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#4338ca', fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</div>
          {terminos.some(t => t.duracion) && Number.isFinite(total) && total >= 0 && (() => {
            const totMin = Math.round(total * 60);
            return (
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginTop: '-2px' }}>
                ⏱ = {Math.floor(totMin / 60)} h {String(totMin % 60).padStart(2, '0')} min
              </div>
            );
          })()}
          <label style={{ fontSize: '11px', color: '#64748b' }}>
            Decimales:{' '}
            <select value={decimales} onChange={e => setDecimales(Number(e.target.value))} style={{ ...S.chipOp, padding: '2px 6px' }}>
              {[0, 1, 2, 4].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <button style={{ ...S.btn, background: '#f1f5f9', color: '#64748b' }} onClick={onClose}>Cancelar</button>
          <button
            style={{ ...S.btn, background: '#dbeafe', color: '#1d4ed8' }}
            onClick={() => navigator.clipboard?.writeText(String(Number(total.toFixed(decimales))))}
            title="Copiar el resultado al portapapeles"
          >📋 Copiar</button>
          {onApply && (
            <button
              style={{ ...S.btn, background: '#4338ca', color: 'white' }}
              onClick={() => onApply(
                Number(total.toFixed(decimales)),
                // La receta viaja con el valor: quien aplica guarda la consulta
                // completa y la próxima vez la calculadora abre ya armada.
                { terminos, decimales }
              )}
            >✓ Aplicar y guardar consulta</button>
          )}
        </div>
      </div>
    </div>
  );
}
