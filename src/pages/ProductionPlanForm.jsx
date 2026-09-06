import React, { useState, useMemo, useEffect, useRef } from 'react';
import './ProductionPlanForm.css';
import { API_BASE_URL } from '../apiConfig';
import CalculadoraFormularios, { evaluarReceta, lista,
  indiceActividadesPlantilla, formCorrespondeAFila } from '../components/CalculadoraFormularios';
import { fechaDeBusqueda } from '../utils/fechaFormulario';
import PlanDashboard from '../components/PlanDashboard';
import { catalogoClasificaciones } from '../services/clasificacionesService';
import { getLotes } from '../hooks/useLoteStore';
import {
  cargarCatalogoConsultas, guardarConsultaCatalogo, quitarConsultaCatalogo,
  recetaDelCatalogo, clavesDelCatalogo, actividadesConfiguradas,
  sincronizarCatalogo, pendientesDeSubir,
} from '../services/consultasPlanService';
import authService from '../services/authService';

/** Comparación sin tildes ni mayúsculas, para el filtro de la grilla. */
const normTxt = (s) => String(s ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .trim().toLowerCase();

// ── Catálogo de actividades para la columna "Proceso / Actividad" ────────────
// Vive en utils/actividadesProceso.js porque los formularios PD (FillForm)
// usan el mismo catálogo: así el dato queda escrito igual en los dos lados.
// El input las ofrece como sugerencias (datalist): se puede elegir de la lista
// o escribir una nueva — lo tipeado vale igual, así "agregar más" es escribirla.
import { ACTIVIDADES_PESCADO as ACTIVIDADES_GENERAL, ACTIVIDADES_CAMARON } from '../utils/actividadesProceso';
// Planta pidió UNA sola pestaña con pescado y camarón juntos, separados a la
// vista: el desempate de especie pasó del nombre de la pestaña al grupo de
// cada fila (utils/gruposPlan.js mantiene compatible lo viejo).
import {
  GRUPOS, GRUPO_PESCADO, GRUPO_CAMARON, ORDEN_GRUPOS, catalogoCompleto,
  claveActividad, ambitoDeCategoria, ambitoDeFila, grupoEfectivo,
  unificarMatriz, esFormatoViejo, ordenarPorGrupo,
} from '../utils/gruposPlan';
import {
  exportarPlanificacionPDF, exportarAvancePDF, exportarComparativoPDF,
} from '../services/planPdfService';
// Los registros que el operador todavía no cerró también alimentan el plan:
// en planta el cierre suele ser al final del turno y el número iba siempre
// atrás de la realidad.
import { cargarFormularios, esBorrador } from '../services/formulariosService';

const n = (v) => Number.parseFloat(v) || 0;
const safeDiv = (num, den) => (n(den) === 0 ? 0 : n(num) / n(den));

export default function ProductionPlanForm() {
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [turno, setTurno] = useState('DIA');

  const [customFields, setCustomFields] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFieldData, setNewFieldData] = useState({ section: 'plan', label: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const createProcess = (name = 'Nuevo Proceso', grupo = null) => ({
    id: `proc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    // PESCADO | CAMARON: en la pestaña única es lo que separa los bloques y lo
    // que usa el motor de consultas para desempatar la especie.
    grupo,
    plan: { libras: '', hrs: '', personas: '', costo: '', proyPers: '', proyCt: '' },
    prod: { libras: '', hrs: '', personas: '', costo: '', fileteo: '' },
    res: { obs: '' },
    customData: {}
  });

  const createCategory = (name = 'NUEVA PESTAÑA') => ({
    id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    processes: [createProcess('')]
  });

  /**
   * 📋 Matriz ESTÁNDAR: UNA sola pestaña con TODAS las actividades del
   * catálogo como filas, sin valores — pescado primero y camarón después,
   * separados por una banda de color (planta manda todo junto en el mismo
   * reporte, así que no van en pestañas distintas). Es el punto de partida
   * cuando una fecha nueva no tiene ningún plan anterior que heredar — y el
   * botón "📋 Matriz estándar" la carga a pedido. Como las filas usan los
   * nombres oficiales del catálogo, las consultas 📌 por actividad les aplican
   * solas al ▶ Ejecutar.
   */
  const matrizEstandar = () => ([
    {
      ...createCategory('PROCESOS PLANTA'),
      processes: [
        ...ACTIVIDADES_GENERAL.map(a => createProcess(a, GRUPO_PESCADO)),
        ...ACTIVIDADES_CAMARON.map(a => createProcess(a, GRUPO_CAMARON)),
      ],
    },
  ]);

  const [categories, setCategories] = useState([
    {
      id: 'cat-1', name: 'PROCESOS PLANTA',
      processes: [
        createProcess('Corte, Clasif. Mahi', GRUPO_PESCADO),
        createProcess('Pelar', GRUPO_CAMARON),
      ]
    }
  ]);

  const [activeTabId, setActiveTabId] = useState(categories[0]?.id);

  // ====== CALCULADORA DE FORMULARIOS (reemplaza al Linker) ======
  // La celda destino del resultado: { catId, procId, section, field, etiqueta }
  const [calcTarget, setCalcTarget] = useState(null);
  // Panel "⚙️ Consultas": ver/quitar las consultas guardadas, ejecutarlas todas
  // con los formularios del día, y limpiar celdas en masa.
  const [verConfig, setVerConfig] = useState(false);
  // Matriz 📌: mostrar solo las actividades del plan de hoy, o TODO el
  // catálogo (pescado + camarón) para dejar configurado lo que no se trabaja
  // hoy pero se va a trabajar otro día.
  const [verTodasMatriz, setVerTodasMatriz] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  // 🎯 Panel "Actividades de hoy": elegir rápido qué filas del catálogo van
  // en la pestaña activa, en vez de armarlas o borrarlas una por una.
  const [verSelector, setVerSelector] = useState(false);
  const [selMarcadas, setSelMarcadas] = useState(new Set());
  const [formsHoyPorActividad, setFormsHoyPorActividad] = useState({});
  // 📌 Catálogo FIJO de consultas por actividad: "Corte → total de cortes del
  // PD-04". Se configura una vez y vale para cualquier día y cualquier plan
  // (independiente de la herencia del plan anterior).
  const [catalogo, setCatalogo] = useState(() => cargarCatalogoConsultas());
  // De dónde salió lo que se está viendo: la base (todos lo ven) o la caché
  // de este navegador porque el servidor no contestó.
  const [catalogoEnServidor, setCatalogoEnServidor] = useState(null);
  const [catalogoPendientes, setCatalogoPendientes] = useState(() => pendientesDeSubir());

  // ====== MODO SELECCIÓN: elegir celdas de la grilla y ver sus totales ======
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [celdasSel, setCeldasSel] = useState([]); // [{ key, valor }]

  // ====== DASHBOARD DE GRÁFICOS (plan vs real, historial por día) ======
  const [verDashboard, setVerDashboard] = useState(false);

  // ====== MENÚ DE REPORTES PDF ======
  const [verMenuPdf, setVerMenuPdf] = useState(false);

  // ====== INDICADORES EN VIVO: contar también los borradores ======
  // Los registros sin cerrar suman al plan mientras se llenan. Es provisional
  // y se avisa con el asterisco; la preferencia queda por navegador.
  const [borradoresEnVivo, setBorradoresEnVivo] = useState(
    () => localStorage.getItem('frigolab_plan_borradores') !== 'off'
  );
  const [conteoDelDia, setConteoDelDia] = useState({ guardados: 0, borradores: 0 });

  const alternarBorradores = () => setBorradoresEnVivo(v => {
    localStorage.setItem('frigolab_plan_borradores', v ? 'off' : 'on');
    return !v;
  });

  // ====== SUBCATEGORÍAS Y FILTRO DE LA GRILLA ======
  // Clasificaciones del catálogo (Clasificación General + las ya usadas en el
  // inventario): son las sugerencias de las sub-filas.
  const [clasifs, setClasifs] = useState([]);
  const [productos, setProductos] = useState([]);
  const [filtroGrid, setFiltroGrid] = useState('');

  useEffect(() => {
    getLotes()
      .then(lotes => {
        setClasifs(catalogoClasificaciones(lotes));
        // Especies / productos: los que ya existen en el inventario de lotes.
        const vistos = new Set();
        const lista = [];
        for (const l of (lotes || [])) {
          const p = String(l?.producto || '').trim();
          if (!p || vistos.has(normTxt(p))) continue;
          vistos.add(normTxt(p));
          lista.push(p);
        }
        setProductos(lista.sort((a, b) => a.localeCompare(b, 'es')));
      })
      .catch(() => setClasifs(catalogoClasificaciones([])));
  }, []);

  /**
   * Cambia producto o clasificación de una sub-fila. El nombre visible se
   * recompone solo ("Mahi — 4-8 oz"): así el filtro, los totales y el
   * dashboard siguen funcionando sin conocer los campos nuevos.
   */
  const updateSubcat = (catId, procId, cambios) => setCategories(cats => cats.map(c => {
    if (c.id !== catId) return c;
    return {
      ...c,
      processes: c.processes.map(p => {
        if (p.id !== procId) return p;
        const nuevo = { ...p, ...cambios };
        nuevo.name = [nuevo.producto, nuevo.clasif].filter(Boolean).join(' — ');
        return nuevo;
      }),
    };
  }));

  /** Agrega una sub-fila (clasificación) debajo de la actividad y sus subs. */
  const addSubProcess = (catId, procId) => setCategories(cats => cats.map(c => {
    if (c.id !== catId) return c;
    const idx = c.processes.findIndex(p => p.id === procId);
    if (idx === -1) return c;
    // Insertar después del padre y de las sub-filas que ya tenga.
    let fin = idx + 1;
    while (fin < c.processes.length && c.processes[fin].parentId === procId) fin++;
    const sub = { ...createProcess(''), sub: true, parentId: procId, producto: '', clasif: '' };
    return { ...c, processes: [...c.processes.slice(0, fin), sub, ...c.processes.slice(fin)] };
  }));

  /**
   * Filas visibles según el filtro: matchea por nombre (actividad o
   * clasificación). Un padre queda si él o alguna de sus subs matchea, y una
   * sub queda si matchea ella o su padre — así el contexto no se corta.
   */
  const filtrarProcesos = (procesos) => {
    const q = normTxt(filtroGrid);
    if (!q) return procesos;
    const pasa = (p) => normTxt(p.name).includes(q);
    const idsVisibles = new Set();
    for (const p of procesos) {
      if (!pasa(p)) continue;
      idsVisibles.add(p.id);
      if (p.parentId) idsVisibles.add(p.parentId);                      // sub → su padre
      else procesos.filter(s => s.parentId === p.id).forEach(s => idsVisibles.add(s.id)); // padre → sus subs
    }
    return procesos.filter(p => idsVisibles.has(p.id));
  };

  // Mantiene sincronizada la pestaña activa
  useEffect(() => {
    if (categories.length > 0 && !categories.find(c => c.id === activeTabId)) {
      setActiveTabId(categories[0].id);
    }
  }, [categories, activeTabId]);

  // CARGAR DATOS
  /** Deja la estructura (actividades, sub-filas, consultas, operaciones) pero
   *  vacía los VALORES: así un día nuevo hereda la configuración sin números. */
  const limpiarValores = (cats) => cats.map(c => ({
    ...c,
    processes: c.processes.map(p => ({
      ...p,
      plan: { libras: '', hrs: '', personas: '', costo: '', proyPers: '', proyCt: '' },
      prod: { libras: '', hrs: '', personas: '', costo: '', fileteo: '' },
      res: { obs: '' },
      customData: {},
    })),
  }));

  /**
   * 🧭 Fecha sin plan guardado → heredar la CONFIGURACIÓN del último plan
   * guardado (mismo turno si hay; si no, cualquiera): actividades, sub-filas,
   * consultas por celda/columna, operaciones entre columnas, filtros y columnas
   * personalizadas — todo menos los valores. Es el "configuro una vez y queda":
   * lo que armaste ayer te espera hoy, listo para ▶ Ejecutar.
   */
  const heredarConfiguracion = async () => {
    const desde = new Date(new Date(fecha).getTime() - 120 * 86400000).toISOString().slice(0, 10);
    const res = await fetch(`${API_BASE_URL}/ProductionPlans/historial?desde=${desde}&hasta=${fecha}`);
    if (!res.ok) return false;
    const crudo = await res.json();
    const planes = (Array.isArray(crudo) ? crudo : crudo?.$values || [])
      // el plan de ESTA fecha+turno no existe (por eso estamos acá); igual se filtra por las dudas
      .filter(p => !(String(p.fechaOperacion ?? p.FechaOperacion ?? '').slice(0, 10) === fecha
        && (p.turno ?? p.Turno) === turno));
    if (planes.length === 0) return false;
    const mismoTurno = planes.filter(p => (p.turno ?? p.Turno) === turno);
    const elegido = (mismoTurno.length > 0 ? mismoTurno : planes).at(-1); // historial viene ascendente
    let cats;
    try { cats = JSON.parse(elegido.planData ?? elegido.PlanData ?? '[]'); } catch { return false; }
    if (!Array.isArray(cats) || cats.length === 0) return false;
    const limpias = unificarMatriz(limpiarValores(cats));
    setCategories(limpias);
    setActiveTabId(limpias[0].id);
    const cfd = elegido.customFieldsDefinition ?? elegido.CustomFieldsDefinition;
    if (cfd) { try { setCustomFields(JSON.parse(cfd)); } catch { /* sin columnas extra */ } }
    const fOrigen = String(elegido.fechaOperacion ?? elegido.FechaOperacion ?? '').slice(0, 10);
    return { cats: limpias, fOrigen };
  };

  // Nº de secuencia de cargas: si el usuario cambia la fecha mientras una
  // carga vieja sigue en vuelo, esa carga se descarta al volver (no pisa).
  const cargaSeq = useRef(0);
  // Índice templateID → actividades de «Proceso - Productivo». Lo llena
  // formulariosDelDia la primera vez que se piden formularios.
  const idxActividadesRef = useRef(null);

  useEffect(() => {
    const loadPlan = async () => {
      const miCarga = ++cargaSeq.current;
      const vigente = () => cargaSeq.current === miCarga;
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/ProductionPlans?fecha=${fecha}&turno=${turno}`);
        if (!vigente()) return;
        if (res.ok) {
          const data = await res.json();
          if (!vigente()) return;
          // isNew = no hay plan guardado para esta fecha+turno.
          if (data && data.isNew) {
            const heredado = await heredarConfiguracion().catch(() => false);
            if (!vigente()) return;
            if (!heredado) {
              // Sin plan anterior que heredar → matriz estándar del catálogo,
              // para que la fecha nueva NUNCA quede sin la grilla de actividades.
              const estandar = matrizEstandar();
              setCategories(estandar);
              setActiveTabId(estandar[0].id);
              setCustomFields([]);
              setSaveMessage('📋 Plan nuevo: no había plan anterior que heredar — se cargó la matriz estándar con todas las actividades. Configurala y 💾 guardá: los próximos días heredan esa configuración.');
            } else {
              // ✨ Auto-cálculo: las celdas configuradas se llenan solas con los
              // formularios de la fecha elegida — sin apretar ▶. No se guarda en
              // BD hasta que el usuario guarde/aplique algo (así mirar una fecha
              // no crea planes fantasma).
              let msgExtra = 'Tocá ▶ Ejecutar en ⚙️ cuando haya formularios.';
              try {
                const delDia = await formulariosDelDia(fecha);
                if (!vigente()) return;
                if (delDia.length > 0) {
                  const { next, celdas } = ejecutarConsultasSobre(heredado.cats, delDia);
                  if (celdas > 0) {
                    setCategories(next);
                    msgExtra = `${celdas} celda(s) ya calculadas con los ${delDia.length} formularios del día — guardá para fijarlas.`;
                  }
                } else {
                  msgExtra = 'Aún no hay formularios de este día; al llenarlos, tocá ▶ Ejecutar en ⚙️.';
                }
              } catch { /* sin conexión: la configuración heredada queda igual */ }
              setSaveMessage(`🧭 Plan nuevo: configuración heredada del ${heredado.fOrigen}. ${msgExtra}`);
            }
          } else {
            let msg = 'Plan cargado correctamente.';
            if (data.planData) {
              const guardadas = JSON.parse(data.planData);
              // El plan de BD puede venir en el formato viejo (una pestaña por
              // especie): se une en la matriz única antes de mostrarlo.
              const migrado = esFormatoViejo(guardadas);
              const parsedCats = unificarMatriz(guardadas);
              setCategories(parsedCats);
              if (parsedCats.length > 0) setActiveTabId(parsedCats[0].id);
              if (migrado) msg = 'Plan cargado y unido en una sola matriz (pescado + camarón) — 💾 guardá para dejarlo así.';
              // ✨ Auto-cálculo también en planes YA guardados: las celdas con
              // consulta configurada (celda/columna/catálogo 📌) se recalculan
              // solas con los formularios de ESTA fecha al abrir. Lo tipeado a
              // mano (sin consulta) no se toca. Queda en pantalla; se fija en
              // BD cuando guardás.
              try {
                const delDia = await formulariosDelDia(fecha);
                if (!vigente()) return;
                if (delDia.length > 0) {
                  const { next, celdas } = ejecutarConsultasSobre(parsedCats, delDia);
                  if (celdas > 0) {
                    setCategories(next);
                    msg = `Plan cargado${migrado ? ' y unido en una sola matriz' : ''} — ${celdas} celda(s) recalculadas con los ${delDia.length} formularios del ${fecha}. 💾 Guardá para fijarlo.`;
                  }
                }
              } catch { /* sin conexión a FilledForms: quedan los valores guardados */ }
            }
            if (data.customFieldsDefinition) setCustomFields(JSON.parse(data.customFieldsDefinition));
            setSaveMessage(msg);
          }
        } else {
          setSaveMessage('Cargado plan en blanco para esta fecha.');
        }
      } catch (e) {
        console.warn("Se ignoró error de conexión inicial:", e);
        // Si hay error de CORS porque devuelve 404, no asustamos al usuario.
        setSaveMessage('Modo Nuevo Plan (No se encontró en BD).');
      }
      setIsLoading(false);
      setTimeout(() => setSaveMessage(''), 8000);
    };
    // ⏱️ Anti-reinicio: el <input type="date"> dispara un cambio por cada
    // parte que se tipea (día, mes, año) y cada uno lanzaba una recarga
    // completa que pisaba a la anterior — la pantalla "se reiniciaba".
    // Ahora se espera a que la fecha quede quieta 700 ms y recién ahí se
    // carga UNA sola vez. Además, si una fecha incompleta ('' mientras se
    // tipea) llega, se ignora.
    if (!fecha || fecha.length < 10) return;
    const timer = setTimeout(loadPlan, 700);
    return () => clearTimeout(timer);
  }, [fecha, turno]);

  // 🔄 AUTO-CÁLCULO EN VIVO: cada 60 segundos (y al volver a esta pestaña del
  // navegador) se recalculan solas las celdas con consulta configurada, con
  // los formularios del día. No hay que apretar nada: si en planta guardan un
  // PD nuevo, en menos de un minuto aparece en el plan. Solo pantalla — en BD
  // se fija cuando guardás. Lo tipeado a mano nunca se toca (el motor solo
  // escribe celdas con consulta).
  const [ultimaAuto, setUltimaAuto] = useState(null);
  useEffect(() => {
    if (!fecha || fecha.length < 10) return;
    let vivo = true;
    const tick = async () => {
      try {
        const delDia = await formulariosDelDia(fecha);
        if (!vivo || delDia.length === 0) return;
        // Funcional sobre prev: no pisa lo que estés tipeando en ese momento.
        setCategories(prev => {
          const { next, celdas } = ejecutarConsultasSobre(prev, delDia);
          return celdas > 0 ? next : prev;
        });
        setUltimaAuto(new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }));
      } catch { /* sin conexión: se reintenta en el próximo tick */ }
    };
    tick();   // al prender/apagar los borradores, el número se rehace al toque
    const id = setInterval(tick, 60000);
    const alVolver = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { vivo = false; clearInterval(id); document.removeEventListener('visibilitychange', alVolver); };
  }, [fecha, turno, catalogo, borradoresEnVivo]);

  // GUARDAR DATOS
  // Recibe las categorías por parámetro (y no del estado) para poder guardar
  // inmediatamente después de un setCategories, sin esperar el re-render.
  const guardarEnBD = async (cats, fields = customFields) => {
    const payload = {
      FechaOperacion: fecha,
      Turno: turno,
      CustomFieldsDefinition: JSON.stringify(fields),
      PlanData: JSON.stringify(cats),
      CreatedBy: 'Usuario Actual'
    };
    const res = await fetch(`${API_BASE_URL}/ProductionPlans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  };

  const savePlan = async () => {
    setIsSaving(true);
    try {
      await guardarEnBD(categories);
      setSaveMessage('✅ Plan guardado exitosamente.');
    } catch (e) {
      console.error(e);
      setSaveMessage('❌ Error al guardar en la base de datos.');
    }
    setIsSaving(false);
    setTimeout(() => setSaveMessage(''), 4000);
  };

  /** Nombre para la auditoría de las consultas guardadas en la base. */
  const usuarioActual = () => {
    const u = authService.getCurrentUser?.();
    return u?.nombre || u?.username || u?.email || '';
  };

  /**
   * 🖨️ Genera uno de los tres reportes con lo que hay en pantalla (no lo que
   * está en BD): se arma desde `categories`, así lo recién tipeado sale igual.
   */
  const generarPDF = (exportar, nombre) => {
    setVerMenuPdf(false);
    try {
      exportar({ fecha, turno, categories });
    } catch (e) {
      console.error(`Error generando el PDF de ${nombre}:`, e);
      setSaveMessage(`⚠️ No se pudo generar el PDF de ${nombre}: ${e.message}`);
      setTimeout(() => setSaveMessage(''), 6000);
    }
  };

  // 📌 El catálogo de consultas vive en la BASE: al abrir se trae de ahí, así
  // lo que configuró cualquiera de la planta se ve y se ejecuta acá. Mientras
  // viaja, la pantalla ya muestra lo último cacheado.
  useEffect(() => {
    let cancelado = false;
    sincronizarCatalogo({ actualizadoPor: usuarioActual() }).then(r => {
      if (cancelado) return;
      setCatalogo({ porActividad: r.porActividad, porColumna: r.porColumna });
      setCatalogoEnServidor(r.enServidor);
      setCatalogoPendientes(r.pendientes || 0);
    });
    return () => { cancelado = true; };
  }, []);

  // El menú de PDF se cierra al tocar cualquier otro lado de la pantalla.
  useEffect(() => {
    if (!verMenuPdf) return undefined;
    const cerrar = (e) => { if (!e.target.closest?.('.pl-print-menu')) setVerMenuPdf(false); };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [verMenuPdf]);

  // KPIs Globales
  const kpis = useMemo(() => {
    let totPlanLbs = 0, totProdLbs = 0, totPlanCost = 0, totProdCost = 0;
    categories.forEach(c => {
      c.processes.forEach(p => {
        totPlanLbs += n(p.plan.libras);
        totProdLbs += n(p.prod.libras);
        totPlanCost += n(p.plan.costo);
        totProdCost += n(p.prod.costo);
      });
    });
    return {
      totPlanLbs, totProdLbs, totPlanCost, totProdCost,
      cumplimiento: totPlanLbs > 0 ? (totProdLbs / totPlanLbs) * 100 : 0
    };
  }, [categories]);

  // Handlers
  const addCategory = () => {
    const newCat = createCategory();
    setCategories([...categories, newCat]);
    setActiveTabId(newCat.id);
  };

  /** Botón "📋 Matriz estándar": reemplaza las pestañas por la matriz completa. */
  const cargarMatrizEstandar = () => {
    const hayDatos = categories.some(c => c.processes.some(p =>
      p.name || Object.values(p.plan || {}).some(v => v) || Object.values(p.prod || {}).some(v => v)));
    if (hayDatos && !window.confirm('¿Reemplazar lo que hay por la MATRIZ ESTÁNDAR (una sola pestaña con todas las actividades: pescado y camarón)?\nLo que no esté guardado en BD se pierde.')) return;
    const estandar = matrizEstandar();
    setCategories(estandar);
    setActiveTabId(estandar[0].id);
    setSaveMessage('📋 Matriz estándar cargada. Configurá consultas y valores, y 💾 guardá: los días siguientes heredan esta configuración.');
    setTimeout(() => setSaveMessage(''), 8000);
  };
  const updateCategoryName = (catId, val) => setCategories(cats => cats.map(c => c.id === catId ? { ...c, name: val } : c));
  /** Añade una fila. Con grupo, la mete al final de SU bloque (pescado o
   *  camarón) para que quede debajo de la banda que le corresponde. */
  const addProcess = (catId, grupo = null) => setCategories(cats => cats.map(c => {
    if (c.id !== catId) return c;
    const nueva = createProcess('', grupo);
    if (!grupo) return { ...c, processes: [...c.processes, nueva] };
    let ultima = -1;
    c.processes.forEach((p, i) => { if (grupoEfectivo(c, p) === grupo) ultima = i; });
    if (ultima < 0) return { ...c, processes: [...c.processes, nueva] };
    const processes = [...c.processes];
    processes.splice(ultima + 1, 0, nueva);
    return { ...c, processes };
  }));
  // Al borrar una actividad se van también sus sub-filas (clasificaciones).
  const removeProcess = (catId, procId) => setCategories(cats => cats.map(c => c.id === catId
    ? { ...c, processes: c.processes.filter(p => p.id !== procId && p.parentId !== procId) }
    : c));
  const removeCategory = (catId) => {
    if (window.confirm('¿Seguro que deseas eliminar esta pestaña completa?')) {
      setCategories(cats => cats.filter(c => c.id !== catId));
    }
  };

  const updateField = (catId, procId, section, field, value) => {
    setCategories(cats => cats.map(c => {
      if (c.id !== catId) return c;
      return {
        ...c,
        processes: c.processes.map(p => {
          if (p.id !== procId) return p;
          if (section === 'custom') {
            return { ...p, customData: { ...p.customData, [field]: value } };
          }
          if (section === 'name') {
            return { ...p, name: value };
          }
          return { ...p, [section]: { ...p[section], [field]: value } };
        })
      };
    }));
  };

  const handleAddField = () => {
    if (!newFieldData.label.trim()) return;
    const id = `fld-${Date.now()}`;
    setCustomFields([...customFields, { id, ...newFieldData }]);
    setIsModalOpen(false);
    setNewFieldData({ section: 'plan', label: '' });
  };

  // ====== CALCULADORA: abrir apuntando a una celda ======
  // El nombre openLinker se conserva porque lo llaman los ~15 botones 🔗 del grid.
  //
  // Recetas: al aplicar un cálculo, la consulta queda guardada en la CELDA y
  // como predefinida de la COLUMNA. Al reabrir, se carga la de la celda; si la
  // celda no tiene, hereda la de la columna — así una consulta armada una vez
  // sirve para toda la columna y solo se cambia el registro puntual.
  const openLinker = (catId, procId, section, field) => {
    const cat = categories.find(c => c.id === catId);
    const proc = cat?.processes.find(p => p.id === procId);
    const clave = `${section}.${field}`;
    // La actividad de la fila: en una sub-fila (producto — clasif) es la de su
    // fila madre. Con ella la calculadora arranca mostrando SOLO los
    // formularios PD guardados con esa "Actividad de Proceso".
    const actividad = proc?.sub
      ? (cat?.processes.find(p => p.id === proc.parentId)?.name || '')
      : (proc?.name || '');
    // Prioridad de la consulta precargada (igual que el motor): la MATRIZ 📌
    // manda — actividad → genérica; lo viejo del plan solo de respaldo.
    const receta = catalogo.porActividad?.[normTxt(actividad)]?.[clave]
      || catalogo.porColumna?.[clave]
      || proc?.recetas?.[clave]
      || cat?.recetasCol?.[clave]
      || null;
    setCalcTarget({
      catId, procId, section, field, clave, receta, actividad,
      // De qué bloque salió (pescado o camarón): la calculadora tiene que
      // filtrar con el MISMO criterio que el motor, o mostraría una cantidad
      // de formularios distinta a la que después calcula el plan.
      ambitoCamaron: ambitoDeFila(cat, proc),
      // El bloque de la fila: la consulta que se guarde queda fija para las
      // actividades de ESE bloque, no para las del otro que se llaman igual.
      grupo: grupoEfectivo(cat, proc),
      // En una sub-fila, producto/clasificación se vuelven filtros automáticos
      // de filas dentro de la calculadora.
      producto: proc?.sub ? (proc.producto || '') : '',
      clasif: proc?.sub ? (proc.clasif || '') : '',
      etiqueta: `${proc?.name || 'fila'} · ${field}`,
    });
  };

  /**
   * 📋 Abre la calculadora desde la MATRIZ de configuración: el destino no es
   * una celda del plan sino la combinación actividad × columna del catálogo
   * fijo. Al aplicar, se guarda en el catálogo y se recalcula todo.
   * actividad '' = consulta genérica de la columna.
   */
  const abrirMatrizConsulta = (actividadNombre, clave, grupo = null) => {
    let receta = recetaDelCatalogo(catalogo, actividadNombre, clave, grupo);
    // ♻️ Cruce sin consulta propia → heredar la BASE de otra columna ya
    // configurada (primero de la misma actividad, si no de cualquier
    // genérica): mismo formulario, tabla y filtros — solo queda elegir la
    // columna a calcular. Así el filtro se configura UNA vez por actividad
    // y sirve para todas sus columnas.
    if (!receta?.terminos?.length) {
      const propias = {
        ...(catalogo.porActividad?.[normTxt(actividadNombre)] || {}),
        ...(grupo ? (catalogo.porActividad?.[`${grupo}::${normTxt(actividadNombre)}`] || {}) : {}),
      };
      const base = Object.values(propias).find(r => r?.terminos?.length)
        || Object.values(catalogo.porColumna || {}).find(r => r?.terminos?.length);
      if (base) {
        receta = {
          ...base,
          terminos: base.terminos.map(t => ({ ...t, columna: '', formId: '', fila: '' })),
        };
      }
    }
    setCalcTarget({
      matriz: true,
      ambitoCamaron: grupo ? grupo === GRUPO_CAMARON : ambitoDeCategoria(activeCategory),
      actividad: actividadNombre,
      grupo,
      clave,
      receta,
      etiqueta: `📌 ${actividadNombre || 'Genérica (todas las actividades)'}${grupo ? ` (${GRUPOS[grupo].label})` : ''} · ${etiquetaClave(clave)}`,
    });
  };

  const aplicarCalculo = async (valor, receta) => {
    if (!calcTarget) return;

    // ── Rama MATRIZ: guarda en el catálogo fijo y recalcula el plan entero ──
    if (calcTarget.matriz) {
      const { actividad, grupo, clave } = calcTarget;
      let catNuevo = catalogo;
      if (receta?.terminos?.length) {
        catNuevo = await guardarConsultaCatalogo({
          actividad, grupo, clave, receta, actualizadoPor: usuarioActual(),
        });
        setCatalogo(catNuevo);
        setCatalogoPendientes(pendientesDeSubir());
      }
      setCalcTarget(null);
      try {
        const delDia = await formulariosDelDia(fecha);
        const { next, celdas } = ejecutarConsultasSobre(categories, delDia, null, catNuevo);
        setCategories(next);
        await guardarEnBD(next);
        setSaveMessage(`📌 Consulta fija guardada para «${actividad || 'todas las actividades'}${grupo ? ` · ${GRUPOS[grupo].label}` : ''}» y ${celdas} celda(s) recalculadas con los formularios del ${fecha}.`);
      } catch {
        setSaveMessage('📌 Consulta fija guardada. Tocá ▶ Ejecutar cuando quieras aplicarla.');
      }
      setTimeout(() => setSaveMessage(''), 6000);
      return;
    }

    const { catId, procId, section, field, clave } = calcTarget;

    // Se arma el estado siguiente COMPLETO (valor + receta) en una sola pasada,
    // para poder mandarlo a la base de datos en el acto: si se leyera del
    // estado de React justo después del set, se guardaría la versión anterior.
    let next = categories.map(c => {
      if (c.id !== catId) return c;
      return {
        ...c,
        recetasCol: receta ? { ...(c.recetasCol || {}), [clave]: receta } : c.recetasCol,
        processes: c.processes.map(p => {
          if (p.id !== procId) return p;
          const conValor = section === 'custom'
            ? { ...p, customData: { ...p.customData, [field]: valor } }
            : { ...p, [section]: { ...p[section], [field]: valor } };
          return receta ? { ...conValor, recetas: { ...(p.recetas || {}), [clave]: receta } } : conValor;
        }),
      };
    });

    // 📌 Al catálogo FIJO: la consulta queda amarrada a la ACTIVIDAD de la
    // fila ("Corte → total de cortes del PD-04") y como genérica de la
    // columna. De acá en adelante vale para cualquier día y cualquier plan,
    // sin depender de heredar el plan anterior.
    if (receta?.terminos?.length) {
      setCatalogo(await guardarConsultaCatalogo({
        actividad: calcTarget.actividad || '', grupo: calcTarget.grupo || null, clave, receta,
        actualizadoPor: usuarioActual(),
      }));
      setCatalogoPendientes(pendientesDeSubir());
    }

    // ✨ "Configurar una vez": la consulta recién guardada se ejecuta AL TOQUE
    // para las demás filas de la columna — cada fila con SUS filtros (su
    // actividad, y producto/clasificación si es sub-fila). Sin pasar por ⚙️.
    let filasExtra = 0;
    if (receta?.terminos?.length) {
      try {
        const res = await fetch(`${API_BASE_URL}/FilledForms`);
        if (res.ok) {
          const delDia = lista(await res.json())
            .filter(f => fechaDeBusqueda(f) === fecha);
          next = next.map(c => {
            if (c.id !== catId) return c;
            const usar = (k) => (c.cfgConsultas?.[k]) !== false;
            return {
              ...c,
              processes: c.processes.map(p => {
                if (p.id === procId) return p;                    // la celda origen ya tiene su valor
                // Con el filtro de actividad prendido, una fila sin nombre no
                // tiene con qué filtrar — mejor dejarla vacía que llenarla mal.
                if (usar('actividad') && !actividadDeFila(c, p)) return p;
                const recetaFila = p.recetas?.[clave] || receta;  // respeta la receta propia de la celda
                const v = evaluarRecetaParaFila(c, p, recetaFila, delDia);
                filasExtra++;
                const [sec, f2] = clave.split('.');
                return sec === 'custom'
                  ? { ...p, customData: { ...p.customData, [f2]: v } }
                  : { ...p, [sec]: { ...p[sec], [f2]: v } };
              }),
            };
          });
        }
      } catch (e) {
        console.warn('La consulta quedó guardada, pero no se pudo llenar el resto de la columna:', e);
      }
    }

    setCategories(next);
    setCalcTarget(null);

    // Directo a la base de datos, sin esperar al botón "Guardar en BD".
    try {
      await guardarEnBD(next);
      setSaveMessage(filasExtra > 0
        ? `✅ Consulta guardada y aplicada a TODA la columna: ${filasExtra + 1} filas, cada una con los formularios de su actividad.`
        : '✅ Valor y consulta guardados en la base de datos.');
    } catch (e) {
      console.error('No se pudo autoguardar el plan:', e);
      setSaveMessage('⚠️ El valor quedó en pantalla pero NO se guardó en BD — usá «Guardar en BD».');
    }
    setTimeout(() => setSaveMessage(''), 5000);
  };

  // ====== ⚙️ CONSULTAS: configurás una vez, después corren solas ======

  const NOMBRES_CAMPO = {
    libras: 'Libras', hrs: 'Hrs', personas: 'Nº Personas', costo: 'Costo $',
    proyPers: 'Proy. Pers', proyCt: 'Proy. CtxLb', fileteo: 'Fileteo/Ext', obs: 'Observaciones',
  };
  const etiquetaClave = (clave) => {
    const [sec, field] = clave.split('.');
    const secLbl = { plan: 'PLAN', prod: 'PROD', res: 'RES' }[sec] || 'COL';
    const fLbl = sec === 'custom'
      ? (customFields.find(c => c.id === field)?.label || field)
      : (NOMBRES_CAMPO[field] || field);
    return `${secLbl} · ${fLbl}`;
  };

  /** Actividad que corresponde a una fila (las sub-filas usan la de su madre). */
  const actividadDeFila = (cat, proc) => proc?.sub
    ? (cat?.processes.find(p => p.id === proc.parentId)?.name || '')
    : (proc?.name || '');

  // ====== 🎯 SELECTOR "ACTIVIDADES DE HOY" ======
  // Catálogo que corresponde a la pestaña, ya etiquetado por grupo: si la
  // pestaña dice camarón (o pescado) va solo ese; si es general — el caso
  // normal ahora — van los dos, uno detrás del otro.
  const catalogoActividadesTab = (cat) => {
    const ambito = ambitoDeCategoria(cat);
    if (ambito === true) return ACTIVIDADES_CAMARON.map(nombre => ({ nombre, grupo: GRUPO_CAMARON }));
    if (ambito === false) return ACTIVIDADES_GENERAL.map(nombre => ({ nombre, grupo: GRUPO_PESCADO }));
    return catalogoCompleto();
  };

  /** Abre el panel: marca lo que ya está en la pestaña y trae qué actividades
   *  tienen formularios guardados HOY, para sugerir con un clic. */
  const abrirSelectorActividades = async () => {
    if (!activeCategory) return;
    // Las claves llevan el grupo adelante: «Empaque» está en los dos
    // catálogos y, con pescado y camarón en la misma pestaña, el nombre solo
    // ya no alcanza para distinguirlas.
    setSelMarcadas(new Set(
      activeCategory.processes
        .filter(p => !p.sub && (p.name || '').trim())
        .map(p => claveActividad(grupoEfectivo(activeCategory, p), p.name))
    ));
    setFormsHoyPorActividad({});
    setVerSelector(true);
    try {
      const delDia = await formulariosDelDia(fecha);
      // Se cuenta contra el catálogo de ESTA pestaña y con el mismo criterio que
      // usa el motor al ejecutar (actividad + especie), para que el número que
      // muestra el panel sea el que la fila va a traer de verdad.
      const conteo = {};
      for (const act of catalogoActividadesTab(activeCategory)) {
        const ambito = act.grupo === GRUPO_CAMARON;
        const n = delDia.filter(f => correspondeAFila(f, activeCategory, act.nombre, ambito)).length;
        if (n > 0) conteo[claveActividad(act.grupo, act.nombre)] = n;
      }
      setFormsHoyPorActividad(conteo);
    } catch { /* sin conexión: el panel igual sirve para elegir a mano */ }
  };

  const toggleSelActividad = (grupo, nombre) => setSelMarcadas(prev => {
    const k = claveActividad(grupo, nombre);
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  /** Marca solo las actividades que YA tienen formularios guardados hoy. */
  const marcarSoloLasDeHoy = () => setSelMarcadas(new Set(Object.keys(formsHoyPorActividad)));

  /**
   * Aplica el panel: agrega filas nuevas para lo marcado que faltaba, y quita
   * las filas (con sus sub-filas) de lo que se desmarcó. Si alguna fila a
   * quitar ya tiene datos cargados, pide confirmación antes de perderlos.
   */
  const aplicarSelectorActividades = () => {
    if (!activeCategory) return;
    const catalogoTab = catalogoActividadesTab(activeCategory);
    const tieneDatos = (p) => Object.values(p.plan || {}).some(v => String(v ?? '').trim())
      || Object.values(p.prod || {}).some(v => String(v ?? '').trim())
      || Object.values(p.customData || {}).some(v => String(v ?? '').trim());

    const aQuitar = activeCategory.processes.filter(p => !p.sub && (p.name || '').trim()
      && !selMarcadas.has(claveActividad(grupoEfectivo(activeCategory, p), p.name)));
    const conDatos = aQuitar.filter(tieneDatos);
    if (conDatos.length > 0 && !window.confirm(
      `${conDatos.length} actividad(es) que vas a quitar ya tienen datos cargados (ej: «${conDatos[0].name}»).\n¿Igual las quitás de esta pestaña?`
    )) return;

    const idsAQuitar = new Set(aQuitar.map(p => p.id));
    const porClave = new Map(catalogoTab.map(a => [claveActividad(a.grupo, a.nombre), a]));
    setCategories(cats => cats.map(c => {
      if (c.id !== activeCategory.id) return c;
      const existentes = new Set(c.processes
        .filter(p => !p.sub && (p.name || '').trim())
        .map(p => claveActividad(grupoEfectivo(c, p), p.name)));
      const nuevas = [...selMarcadas]
        .filter(k => !existentes.has(k))
        .map(k => {
          const act = porClave.get(k);
          return createProcess(act?.nombre || k.split('::')[1] || '', act?.grupo || k.split('::')[0]);
        });
      const quedan = c.processes.filter(p => !idsAQuitar.has(p.id) && !idsAQuitar.has(p.parentId));
      return { ...c, processes: ordenarPorGrupo(c, [...quedan, ...nuevas]) };
    }));
    setVerSelector(false);
    setSaveMessage(`🎯 «${activeCategory.name}» quedó con ${selMarcadas.size} actividad(es) activa(s) — guardá en BD para fijarlo.`);
    setTimeout(() => setSaveMessage(''), 6000);
  };

  /**
   * Evalúa UNA receta para UNA fila del plan con sus filtros automáticos:
   * formularios del día ya vienen en delDia; acá se filtra por la actividad de
   * la fila y, en sub-filas, por producto/especie y clasificación (por patrón
   * de nombre de columna). Lo usan tanto «Aplicar y guardar consulta» (que
   * llena toda la columna al toque) como «▶ Ejecutar consultas del día».
   */
  const evaluarRecetaParaFila = (c, p, receta, delDia) => {
    const usar = (k) => (c.cfgConsultas?.[k]) !== false;
    const actividad = usar('actividad') ? actividadDeFila(c, p) : '';
    const base = actividad
      ? delDia.filter(f => correspondeAFila(f, c, actividad, ambitoDeFila(c, p)))
      : delDia;
    const filtrosAuto = [];
    if (usar('especie') && p.sub && p.producto) {
      filtrosAuto.push({ patron: '(producto|especie|presentaci)', texto: p.producto });
    }
    if (usar('clasif') && p.sub && p.clasif) {
      filtrosAuto.push({ patron: 'clasif', texto: p.clasif });
    }
    // La receta se generaliza: sin rango manual de fechas, el registro puntual
    // solo vale si ese formulario es del día, y los filtros auto se reemplazan
    // por los de ESTA fila.
    const terminos = receta.terminos.map(t => ({
      ...t, desde: '', hasta: '',
      filtros: [...(t.filtros || []).filter(f => !f.patron), ...filtrosAuto],
      ...(t.formId && !base.some(f => String(f.formID ?? f.id) === String(t.formId))
        ? { formId: '', fila: '' } : {}),
    }));
    return evaluarReceta({ ...receta, terminos }, base);
  };

  /** Campos del grid utilizables en consultas y operaciones entre columnas.
   *  PRODUCCIÓN va primero: la ejecución real es lo que se extrae de los
   *  formularios; la planificación es la meta que se tipea. */
  const camposOperables = [
    ['prod.libras', 'PROD · Libras'], ['prod.hrs', 'PROD · Hrs'],
    ['prod.personas', 'PROD · Nº Personas'], ['prod.costo', 'PROD · M.Obra $'],
    ['plan.libras', 'PLAN · Libras'], ['plan.hrs', 'PLAN · Hrs'],
    ['plan.personas', 'PLAN · Nº Personas'], ['plan.costo', 'PLAN · M.Obra $'],
    ['plan.proyPers', 'PLAN · Proy. Pers'], ['plan.proyCt', 'PLAN · Proy. CtxLb'],
    ...customFields.map(c => [`custom.${c.id}`, `COL · ${c.label}`]),
  ];

  const valorDeClave = (p, clave) => {
    const [sec, field] = String(clave || '').split('.');
    return n(sec === 'custom' ? p.customData?.[field] : p[sec]?.[field]);
  };

  /** Aplica las operaciones entre columnas de la pestaña a UNA fila. */
  const aplicarFormulasAFila = (cat, p) => {
    let np = p;
    for (const f of (cat.formulasCol || [])) {
      if (!f.destino || !f.a) continue;
      const a = valorDeClave(np, f.a);
      const b = f.b === '#num' ? n(f.bNum) : valorDeClave(np, f.b);
      let v;
      switch (f.op) {
        case '-': v = a - b; break;
        case '*': v = a * b; break;
        case '/': v = b === 0 ? 0 : a / b; break;
        default: v = a + b;
      }
      v = Number(v.toFixed(2));
      const [sec, field] = f.destino.split('.');
      np = sec === 'custom'
        ? { ...np, customData: { ...np.customData, [field]: v } }
        : { ...np, [sec]: { ...np[sec], [field]: v } };
    }
    return np;
  };

  /** 🧮 Aplica las operaciones entre columnas a TODAS las filas y guarda. */
  const aplicarOperacionesColumnas = async () => {
    if (!activeCategory?.formulasCol?.length) return;
    const next = categories.map(c => {
      if (c.id !== activeTabId) return c;
      return { ...c, processes: c.processes.map(p => aplicarFormulasAFila(c, p)) };
    });
    setCategories(next);
    try {
      await guardarEnBD(next);
      setSaveMessage(`🧮 Operaciones aplicadas a todas las filas y guardadas en BD.`);
    } catch {
      setSaveMessage('⚠️ Aplicadas en pantalla pero NO en BD — usá «Guardar en BD».');
    }
    setTimeout(() => setSaveMessage(''), 5000);
  };

  const setFormulasCol = (formulas) => {
    setCategories(cats => cats.map(c => c.id !== activeTabId ? c : { ...c, formulasCol: formulas }));
  };

  /** Interruptores de los filtros automáticos de las consultas (por pestaña). */
  const cfgConsulta = (k) => (activeCategory?.cfgConsultas?.[k]) !== false; // default: prendidos
  const setCfgConsulta = (k, valor) => {
    setCategories(cats => cats.map(c => c.id !== activeTabId
      ? c
      : { ...c, cfgConsultas: { ...(c.cfgConsultas || {}), [k]: valor } }));
  };

  /**
   * ▶ Recalcula TODAS las celdas con consulta guardada de la pestaña activa,
   * usando solo los formularios del día del plan y de la actividad de cada
   * fila. Es el "configuro una vez y ya funciona": armás la consulta con la
   * calculadora, y cada día con este botón se llena solo.
   */
  /** Trae los formularios llenados del día indicado (para las consultas). */
  const formulariosDelDia = async (dia) => {
    // Se piden las plantillas junto con los formularios porque el filtro de
    // actividad del plan necesita el «Proceso - Productivo» de cada plantilla,
    // no solo la actividad del encabezado. Se cachea en el ref: el catálogo de
    // plantillas no cambia dentro de una sesión del plan.
    const [datos, plants] = await Promise.all([
      cargarFormularios({ incluirBorradores: borradoresEnVivo }),
      idxActividadesRef.current
        ? Promise.resolve(null)
        : fetch(`${API_BASE_URL}/Templates`).then(r => (r.ok ? r.json() : [])).catch(() => []),
    ]);
    if (plants) idxActividadesRef.current = indiceActividadesPlantilla(plants);
    // Por la FECHA QUE ESCRIBIÓ EL OPERADOR en el encabezado, no por createdAt:
    // un formulario del día 20 que se guarda el 25 pertenece al plan del 20.
    const delDia = datos.formularios.filter(f => fechaDeBusqueda(f) === dia);

    // Cuántos de los que entran al cálculo están sin cerrar: es lo que muestra
    // el asterisco arriba, para que nadie lea el número como definitivo.
    const sinCerrar = delDia.filter(esBorrador).length;
    setConteoDelDia({ guardados: delDia.length - sinCerrar, borradores: sinCerrar });

    return delDia;
  };

  /* La especie de la pestaña (ambitoDeCategoria) vive ahora en
     utils/gruposPlan.js: la comparten la grilla, el selector de actividades
     y los PDF. */

  /**
   * ¿El formulario alimenta esta fila del plan? (actividad + especie)
   * Sin ámbito explícito manda el nombre de la pestaña, como antes; la grilla
   * le pasa el de la FILA, que es lo que separa pescado de camarón ahora que
   * los dos bloques viven en la misma pestaña.
   */
  const correspondeAFila = (f, cat, actividad, ambito = ambitoDeCategoria(cat)) =>
    formCorrespondeAFila(f, actividad, idxActividadesRef.current, ambito);

  /**
   * Motor de las consultas: recalcula todas las celdas con consulta guardada
   * sobre el juego de categorías que recibe (puro, sin tocar estado).
   * soloCatId acota a una pestaña; null = todas (lo usa el auto-cálculo al
   * cambiar de fecha). Devuelve { next, celdas }.
   */
  const ejecutarConsultasSobre = (cats, delDia, soloCatId = null, catAct = catalogo) => {
    let celdas = 0;
    const next = cats.map(c => {
      if (soloCatId && c.id !== soloCatId) return c;
      const usar = (k) => (c.cfgConsultas?.[k]) !== false;
      return {
        ...c,
        processes: c.processes.map(p => {
          const actividadFila = actividadDeFila(c, p);
          // El bloque de la fila (pescado o camarón): la matriz 📌 guarda una
          // consulta por bloque, porque «Empaque» de camarón no sale del mismo
          // formulario que el de pescado.
          const grupoFila = grupoEfectivo(c, p);
          // Columnas a calcular: las del plan (celda/columna) MÁS las del
          // catálogo fijo que apliquen a la actividad de esta fila.
          const claves = new Set([
            ...Object.keys(c.recetasCol || {}),
            ...Object.keys(p.recetas || {}),
            ...clavesDelCatalogo(catAct, actividadFila, grupoFila),
          ]);
          let np = p;
          // Con el filtro de actividad prendido, una fila sin nombre no tiene
          // con qué filtrar — se deja como está.
          if (claves.size > 0 && !(usar('actividad') && !actividadFila)) {
            for (const clave of claves) {
              // Prioridad: la MATRIZ 📌 es la configuración ESTÁNDAR del plan —
              // 1º catálogo de esta actividad EN SU BLOQUE, 2º la del nombre
              // suelto (lo configurado antes de separar bloques), 3º genérica.
              // Solo si la matriz no tiene nada para el cruce, se cae a lo
              // guardado antes en el plan: columna, y por último la celda.
              const receta = recetaDelCatalogo(catAct, actividadFila, clave, grupoFila)
                || c.recetasCol?.[clave]
                || p.recetas?.[clave];
              if (!receta?.terminos?.length) continue;
              const valor = evaluarRecetaParaFila(c, np, receta, delDia);
              const [sec, field] = clave.split('.');
              np = sec === 'custom'
                ? { ...np, customData: { ...np.customData, [field]: valor } }
                : { ...np, [sec]: { ...np[sec], [field]: valor } };
              celdas++;
            }
          }
          // Al final, las operaciones entre columnas de la pestaña (si hay).
          return aplicarFormulasAFila(c, np);
        }),
      };
    });
    return { next, celdas };
  };

  const ejecutarConsultas = async () => {
    if (!activeCategory || ejecutando) return;
    setEjecutando(true);
    try {
      const delDia = await formulariosDelDia(fecha);
      const { next, celdas } = ejecutarConsultasSobre(categories, delDia, activeCategory.id);
      setCategories(next);
      await guardarEnBD(next);
      setSaveMessage(`✅ ${celdas} celda(s) recalculada(s) con los formularios del ${fecha} y guardadas en BD.`);
    } catch (e) {
      console.error('Error ejecutando consultas:', e);
      setSaveMessage(`⚠️ No se pudieron ejecutar las consultas: ${e.message}`);
    }
    setEjecutando(false);
    setTimeout(() => setSaveMessage(''), 6000);
  };

  const quitarRecetaCol = (clave) => {
    setCategories(cats => cats.map(c => {
      if (c.id !== activeTabId) return c;
      const { [clave]: _, ...resto } = c.recetasCol || {};
      return { ...c, recetasCol: resto };
    }));
  };

  const quitarRecetaCelda = (procId, clave) => {
    setCategories(cats => cats.map(c => {
      if (c.id !== activeTabId) return c;
      return {
        ...c,
        processes: c.processes.map(p => {
          if (p.id !== procId) return p;
          const { [clave]: _, ...resto } = p.recetas || {};
          return { ...p, recetas: resto };
        }),
      };
    }));
  };

  /**
   * 🧹 Limpieza masiva de la pestaña activa.
   * soloCalculadas=true → vacía solo las celdas que tienen consulta guardada;
   * false → vacía TODOS los valores (actividades, columnas y consultas quedan).
   */
  const limpiarPestania = async (soloCalculadas) => {
    if (!activeCategory) return;
    const msg = soloCalculadas
      ? '¿Vaciar las celdas que tienen consulta configurada en esta pestaña?'
      : '¿Vaciar TODOS los valores de esta pestaña?\n(Las actividades, columnas y consultas guardadas quedan.)';
    if (!window.confirm(msg)) return;

    const next = categories.map(c => {
      if (c.id !== activeCategory.id) return c;
      return {
        ...c,
        processes: c.processes.map(p => {
          if (soloCalculadas) {
            const claves = new Set([...Object.keys(c.recetasCol || {}), ...Object.keys(p.recetas || {})]);
            let np = p;
            for (const clave of claves) {
              const [sec, field] = clave.split('.');
              np = sec === 'custom'
                ? { ...np, customData: { ...np.customData, [field]: '' } }
                : { ...np, [sec]: { ...np[sec], [field]: '' } };
            }
            return np;
          }
          return {
            ...p,
            plan: { libras: '', hrs: '', personas: '', costo: '', proyPers: '', proyCt: '' },
            prod: { libras: '', hrs: '', personas: '', costo: '', fileteo: '' },
            res: { obs: '' },
            customData: {},
          };
        }),
      };
    });

    setCategories(next);
    try {
      await guardarEnBD(next);
      setSaveMessage('🧹 Celdas vaciadas y guardado en BD.');
    } catch {
      setSaveMessage('⚠️ Vaciadas en pantalla pero NO en BD — usá «Guardar en BD».');
    }
    setTimeout(() => setSaveMessage(''), 5000);
  };

  // ====== MODO SELECCIÓN: clic en celdas → totales al pie ======
  // Captura el clic ANTES de que llegue al input: en modo selección la grilla
  // no se edita, se elige. La celda se identifica por posición (fila/columna),
  // así el mismo clic la saca de la selección.
  const onGridClickCapture = (e) => {
    if (!modoSeleccion) return;
    const td = e.target.closest('td');
    if (!td || td.classList.contains('sticky-col')) return;
    e.preventDefault();
    e.stopPropagation();

    const fila = td.parentElement?.rowIndex ?? -1;
    const key = `${activeTabId}:${fila}:${td.cellIndex}`;
    const crudo = td.querySelector('input')?.value ?? td.textContent ?? '';
    const valor = Number.parseFloat(String(crudo).replace(/[^\d.,-]/g, '').replace(/,/g, ''));

    setCeldasSel(prev => {
      const ya = prev.some(c => c.key === key);
      td.classList.toggle('pl-cell-selected', !ya);
      if (ya) return prev.filter(c => c.key !== key);
      // Las celdas de texto o vacías también se pueden seleccionar (p.ej. para
      // limpiarlas); solo que no aportan a los totales (valor null).
      return [...prev, { key, valor: Number.isFinite(valor) ? valor : null }];
    });
  };

  const salirSeleccion = () => {
    setModoSeleccion(false);
    setCeldasSel([]);
    document.querySelectorAll('.pl-cell-selected').forEach(el => el.classList.remove('pl-cell-selected'));
  };

  /**
   * Qué campo del proceso vive en cada columna del <table>, en el MISMO orden
   * en que se renderizan los <td>. null = celda calculada/sticky (no se limpia).
   * Se usa para traducir la posición de una celda seleccionada a su campo real.
   */
  const mapaColumnas = () => {
    const cols = [null]; // 0: sticky (Proceso / Actividad)
    cols.push(
      { s: 'plan', f: 'libras' }, null /* Lbs/Hrs */, { s: 'plan', f: 'hrs' },
      { s: 'plan', f: 'personas' }, { s: 'plan', f: 'costo' },
      { s: 'plan', f: 'proyPers' }, { s: 'plan', f: 'proyCt' },
    );
    planCols.forEach(c => cols.push({ s: 'custom', f: c.id }));
    cols.push(
      { s: 'prod', f: 'libras' }, null /* Lbs/Hrs */, { s: 'prod', f: 'hrs' },
      { s: 'prod', f: 'personas' }, { s: 'prod', f: 'costo' }, { s: 'prod', f: 'fileteo' },
    );
    prodCols.forEach(c => cols.push({ s: 'custom', f: c.id }));
    cols.push(null, null, null /* Costo xLb, Dif, %Meta */, { s: 'res', f: 'obs' });
    resCols.forEach(c => cols.push({ s: 'custom', f: c.id }));
    return cols;
  };

  /** 🧹 Vacía las celdas seleccionadas (limpieza casillero por casillero). */
  const limpiarSeleccion = async () => {
    if (celdasSel.length === 0 || !activeCategory) return;
    if (!window.confirm(`¿Vaciar la(s) ${celdasSel.length} celda(s) seleccionada(s)?`)) return;

    const cols = mapaColumnas();
    const visibles = filtrarProcesos(activeCategory.processes);
    const objetivos = [];
    for (const cel of celdasSel) {
      const partes = cel.key.split(':');
      const colIdx = Number(partes.at(-1));
      const filaIdx = Number(partes.at(-2));
      const tabId = partes.slice(0, -2).join(':');
      if (tabId !== activeTabId) continue;
      // rowIndex del <tr> cuenta también las 2 filas del thead.
      const proc = visibles[filaIdx - 2];
      const colDef = cols[colIdx];
      if (proc && colDef) objetivos.push({ procId: proc.id, ...colDef });
    }

    const next = categories.map(c => {
      if (c.id !== activeTabId) return c;
      return {
        ...c,
        processes: c.processes.map(p => {
          const propios = objetivos.filter(o => o.procId === p.id);
          if (propios.length === 0) return p;
          let np = p;
          for (const o of propios) {
            np = o.s === 'custom'
              ? { ...np, customData: { ...np.customData, [o.f]: '' } }
              : { ...np, [o.s]: { ...np[o.s], [o.f]: '' } };
          }
          return np;
        }),
      };
    });

    setCategories(next);
    salirSeleccion();
    try {
      await guardarEnBD(next);
      setSaveMessage(`🧹 ${objetivos.length} celda(s) vaciada(s) y guardado en BD.`);
    } catch {
      setSaveMessage('⚠️ Vaciadas en pantalla pero NO en BD — usá «Guardar en BD».');
    }
    setTimeout(() => setSaveMessage(''), 5000);
  };

  // Totales de la selección: suma, resta y división son secuenciales
  // (primera celda, luego las demás en el orden en que se eligieron).
  const totalesSel = useMemo(() => {
    const vs = celdasSel.map(c => c.valor).filter(v => v !== null);
    if (vs.length === 0) return null;
    const suma = vs.reduce((a, b) => a + b, 0);
    return {
      n: vs.length,
      suma,
      resta: vs.slice(1).reduce((a, b) => a - b, vs[0]),
      producto: vs.reduce((a, b) => a * b, 1),
      division: vs.slice(1).reduce((a, b) => (b === 0 ? 0 : a / b), vs[0]),
      promedio: suma / vs.length,
    };
  }, [celdasSel]);

  // 🔗 Estilo de los botones "vincular con datos" según a qué columna van: se
  // distinguen a propósito (ámbar = PLAN estimado, verde = PRODUCCIÓN real)
  // para que no se aplique por error un cálculo en la columna que no es.
  const iconoPlan = { background: '#fef3c7', color: '#92400e' };
  const iconoProd = { background: '#bbf7d0', color: '#065f46' };

  const planCols = customFields.filter(f => f.section === 'plan');
  const prodCols = customFields.filter(f => f.section === 'prod');
  const resCols = customFields.filter(f => f.section === 'res');

  const activeCategory = categories.find(c => c.id === activeTabId);
  // Pestaña general (ni «camarón» ni «pescado» en el nombre): es la de la
  // matriz nueva, donde los dos bloques conviven separados por una banda.
  const pestaniaUnificada = !!activeCategory && ambitoDeCategoria(activeCategory) === null;
  // Ancho total de la grilla: lo usa la banda de grupo para cruzar la tabla.
  const totalColumnas = 19 + planCols.length + prodCols.length + resCols.length;

  return (
    <div className="pl-page">
      {/* HEADER DASHBOARD */}
      <div className="pl-header-container no-print">
        <div className="pl-header-content">
          <div className="pl-header-titles">
            <h1>Comparativo Plan <span>vs Producción</span></h1>
            <p>
              Una sola matriz con los bloques de pescado y camarón separados.{' '}
              {/* Marcador de versión: si NO se ve este número, el navegador
                  está mostrando una copia vieja del sistema. */}
              <span style={{ fontSize: '10px', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                v26.08.5 · en vivo con borradores 🟡
              </span>
            </p>
          </div>
          <div className="pl-header-actions">
            <button
              className="pl-btn pl-btn-print"
              style={verDashboard ? { background: '#4338ca', color: 'white' } : undefined}
              onClick={() => setVerDashboard(v => !v)}
            >
              {verDashboard ? '📊 Ocultar dashboard' : '📊 Dashboard'}
            </button>
            {/* 🟡 Registros sin cerrar: el plan se alimenta mientras se
                llenan, sin esperar a que el operador guarde al final del
                turno. Es provisional y se avisa abajo con el asterisco. */}
            <button
              className="pl-btn pl-btn-print"
              style={borradoresEnVivo
                ? { background: '#fef3c7', color: '#92400e', border: '1.5px solid #fbbf24' }
                : { background: '#f1f5f9', color: '#64748b' }}
              onClick={alternarBorradores}
              title={borradoresEnVivo
                ? 'Los registros sin cerrar (borradores) están sumando al plan. Clic para contar solo los cerrados.'
                : 'Solo se cuentan los formularios ya guardados. Clic para incluir también los que se están llenando.'}
            >
              {borradoresEnVivo ? '🟡 En vivo (con borradores)' : '⚪ Solo cerrados'}
            </button>
            <button className="pl-btn pl-btn-print" onClick={savePlan} disabled={isSaving || isLoading}>
              {isSaving ? '⏳ Guardando...' : '💾 Guardar en BD'}
            </button>
            {/* 🖨️ Tres reportes distintos, no una captura de la pantalla:
                planificación, avance (con gráfico) y comparativo completo. */}
            <div className="pl-print-menu">
              <button
                className="pl-btn pl-btn-print"
                style={verMenuPdf ? { background: '#4338ca', color: 'white' } : undefined}
                onClick={() => setVerMenuPdf(v => !v)}
              >
                🖨️ Imprimir / PDF ▾
              </button>
              {verMenuPdf && (
                <div className="pl-print-dropdown">
                  <button onClick={() => generarPDF(exportarPlanificacionPDF, 'Planificación')}>
                    📋 <span><strong>Planificación de labores</strong><small>Libras, horas, personal y M.O. estimada</small></span>
                  </button>
                  <button onClick={() => generarPDF(exportarAvancePDF, 'Avance')}>
                    📈 <span><strong>Avance de producción</strong><small>Plan vs real, % cumplimiento y gráfico</small></span>
                  </button>
                  <button onClick={() => generarPDF(exportarComparativoPDF, 'Comparativo')}>
                    📊 <span><strong>Comparativo completo</strong><small>Matriz con indicadores y gráfico</small></span>
                  </button>
                  <button className="pl-print-dropdown-sec" onClick={() => { setVerMenuPdf(false); window.print(); }}>
                    🖨️ <span><strong>Imprimir la pantalla</strong><small>La grilla tal cual se ve</small></span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {saveMessage && (
          <div style={{ background: '#dcfce7', color: '#166534', padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontWeight: 600 }}>
            {saveMessage}
          </div>
        )}

        {/* KPIs */}
        <div className="pl-dashboard-grid">
          <div className="pl-dash-card pl-meta-card">
            <div className="pl-input-group">
              <label>Fecha de Operación</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div className="pl-input-group">
              <label>Turno Asignado</label>
              <select value={turno} onChange={e => setTurno(e.target.value)}>
                <option value="DIA">DIA</option>
                <option value="NOCHE">NOCHE</option>
              </select>
            </div>
          </div>
          <div className="pl-dash-card">
            <div className="pl-kpi-data">
              <span className="pl-kpi-label">Planificado Total</span>
              <span className="pl-kpi-value">{kpis.totPlanLbs.toLocaleString()} <small>lbs</small></span>
              <span className="pl-kpi-sub">Est. Costo: ${kpis.totPlanCost.toLocaleString()}</span>
            </div>
          </div>
          <div className="pl-dash-card">
            <div className="pl-kpi-data">
              <span className="pl-kpi-label">Producción Real</span>
              <span className="pl-kpi-value">{kpis.totProdLbs.toLocaleString()} <small>lbs</small></span>
              <span className="pl-kpi-sub">Costo Real: ${kpis.totProdCost.toLocaleString()}</span>
            </div>
          </div>
          <div className="pl-dash-card" style={{ background: kpis.cumplimiento >= 100 ? 'var(--success-bg)' : kpis.cumplimiento >= 80 ? 'var(--warning-bg)' : 'white' }}>
            <div className="pl-kpi-data">
              <span className="pl-kpi-label">Cumplimiento Global</span>
              <span className="pl-kpi-value">
                {kpis.cumplimiento.toFixed(1)} <small>%</small>
                {borradoresEnVivo && conteoDelDia.borradores > 0 && (
                  <small style={{ color: '#b45309', fontWeight: 800 }} title="Incluye registros sin cerrar">*</small>
                )}
              </span>
              <span className="pl-kpi-sub">De la meta planificada</span>
            </div>
          </div>
        </div>

        {/* La aclaración que pidió planta: el número es útil en vivo, pero se
            dice de dónde sale. Sin esto, un total con borradores se lee como
            definitivo y después "no cuadra". */}
        {borradoresEnVivo && conteoDelDia.borradores > 0 && (
          <div style={{
            background: '#fffbeb', border: '1.5px solid #fbbf24', color: '#92400e',
            borderRadius: '10px', padding: '8px 14px', marginTop: '10px',
            fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
          }}>
            <span>
              * Estos números incluyen <strong>{conteoDelDia.borradores} registro(s) sin cerrar</strong>
              {conteoDelDia.guardados > 0 && <> y {conteoDelDia.guardados} ya guardado(s)</>} del {fecha}.
              Pueden variar hasta que el operador cierre el formulario.
            </span>
            <button
              className="pl-btn"
              style={{ marginLeft: 'auto', background: '#fef3c7', color: '#92400e', fontWeight: 700 }}
              onClick={alternarBorradores}
              title="Contar solo los formularios ya guardados"
            >
              Ver solo cerrados
            </button>
          </div>
        )}
      </div>

      {/* DASHBOARD DE GRÁFICOS */}
      {verDashboard && (
        <PlanDashboard fecha={fecha} turno={turno} categories={categories} />
      )}

      {/* Sugerencias de actividad para la columna Proceso / Actividad.
          La pestaña de camarón ofrece su propia lista. */}
      <datalist id="pl-actividades-general">
        {ACTIVIDADES_GENERAL.map(a => <option key={a} value={a} />)}
      </datalist>
      <datalist id="pl-actividades-camaron">
        {ACTIVIDADES_CAMARON.map(a => <option key={a} value={a} />)}
      </datalist>
      {/* Clasificaciones del catálogo (Clasificación de Producto + inventario):
          son las sugerencias de las sub-filas. También acepta texto libre. */}
      <datalist id="pl-clasificaciones">
        {clasifs.map(c => <option key={c} value={c} />)}
      </datalist>
      {/* Especies / productos ya usados en el Inventario de Lotes. */}
      <datalist id="pl-productos">
        {productos.map(p => <option key={p} value={p} />)}
      </datalist>

      {/* TABS NAVIGATION */}
      <div className="pl-tabs-container no-print">
        {categories.map(cat => (
          <div key={cat.id} className={`pl-tab ${activeTabId === cat.id ? 'active' : ''}`} onClick={() => setActiveTabId(cat.id)}>
            {activeTabId === cat.id ? (
              <input 
                className="pl-tab-input" 
                value={cat.name} 
                onChange={e => updateCategoryName(cat.id, e.target.value)} 
                onClick={e => e.stopPropagation()}
                placeholder="Nombre de pestaña..."
              />
            ) : (
              <span>{cat.name}</span>
            )}
          </div>
        ))}
        <button className="pl-tab-add" onClick={addCategory}>+ Nueva Pestaña</button>
        <button
          className="pl-tab-add"
          style={{ background: '#fffbeb', border: '1.5px dashed #f59e0b', color: '#b45309' }}
          onClick={cargarMatrizEstandar}
          title="Cargar la matriz completa con todas las actividades del catálogo (pescado + camarón)"
        >📋 Matriz estándar</button>
      </div>

      {/* ACTIVE TAB ACTIONS */}
      {activeCategory && (
        <div className="pl-active-tab-toolbar no-print">
          {/* Con pescado y camarón en la misma pestaña, la fila nueva tiene
              que saber a qué bloque entra: un botón por bloque. */}
          {pestaniaUnificada ? ORDEN_GRUPOS.map(g => (
            <button
              key={g}
              className="pl-add-row-btn-top"
              style={{ background: GRUPOS[g].fondo, color: GRUPOS[g].color, border: `1.5px solid ${GRUPOS[g].borde}` }}
              onClick={() => addProcess(activeCategory.id, g)}
              title={`Añadir una actividad al bloque de ${GRUPOS[g].label.toLowerCase()}`}
            >
              + Fila {GRUPOS[g].icono} {GRUPOS[g].label}
            </button>
          )) : (
            <button className="pl-add-row-btn-top" onClick={() => addProcess(activeCategory.id)}>
              + Añadir Fila a {activeCategory.name}
            </button>
          )}
          <button
            className="pl-add-row-btn-top"
            style={modoSeleccion ? { background: '#4338ca', color: 'white' } : { background: '#eef2ff', color: '#4338ca' }}
            onClick={() => (modoSeleccion ? salirSeleccion() : setModoSeleccion(true))}
            title="Elegí celdas de la grilla con un clic y mirá la suma, resta, multiplicación o división al pie"
          >
            {modoSeleccion ? '✕ Salir de selección' : '🧮 Seleccionar celdas'}
          </button>
          <button
            className="pl-add-row-btn-top"
            style={verConfig ? { background: '#0f766e', color: 'white' } : { background: '#f0fdfa', color: '#0f766e' }}
            onClick={() => setVerConfig(v => !v)}
            title="Ver las consultas guardadas, ejecutarlas todas con los formularios del día, y limpiar celdas"
          >
            ⚙️ Consultas
          </button>
          <button
            className="pl-add-row-btn-top"
            style={verSelector ? { background: '#1d4ed8', color: 'white' } : { background: '#eff6ff', color: '#1d4ed8' }}
            onClick={() => (verSelector ? setVerSelector(false) : abrirSelectorActividades())}
            title="Elegir rápido qué actividades del catálogo van en el plan de hoy"
          >
            🎯 Actividades de hoy
          </button>
          {ultimaAuto && (
            <span
              style={{ fontSize: '11.5px', color: '#0f766e', fontWeight: 600, alignSelf: 'center' }}
              title="Las celdas con consulta se recalculan solas cada minuto con los formularios del día"
            >
              🔄 auto {ultimaAuto}
            </span>
          )}
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '340px' }}>
            <input
              type="text"
              value={filtroGrid}
              onChange={e => setFiltroGrid(e.target.value)}
              placeholder="🔍 Filtrar por actividad, producto o clasificación…"
              style={{ width: '100%', padding: '8px 30px 8px 10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
            />
            {filtroGrid && (
              <button
                onClick={() => setFiltroGrid('')}
                title="Limpiar filtro"
                style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', fontWeight: 700 }}
              >✕</button>
            )}
          </div>
          <button className="pl-delete-tab-btn" onClick={() => removeCategory(activeCategory.id)}>
            🗑️ Eliminar esta pestaña
          </button>
        </div>
      )}

      {/* 🎯 PANEL "ACTIVIDADES DE HOY": elegir de un vistazo qué filas del
          catálogo van en la pestaña activa — en vez de agregar/borrar a mano.
          «✨ Solo las de hoy» marca automáticamente lo que YA tiene
          formularios PD guardados en la fecha del plan. */}
      {activeCategory && verSelector && (() => {
        const catalogoTab = catalogoActividadesTab(activeCategory);
        const existentes = new Set(activeCategory.processes
          .filter(p => !p.sub && (p.name || '').trim())
          .map(p => claveActividad(grupoEfectivo(activeCategory, p), p.name)));
        const conFormsHoy = Object.keys(formsHoyPorActividad).length;
        // Con los dos catálogos juntos, cada bloque lleva su propio título.
        const bloques = ORDEN_GRUPOS
          .map(g => ({ grupo: g, items: catalogoTab.filter(a => a.grupo === g) }))
          .filter(b => b.items.length > 0);
        return (
          <div className="no-print" style={{ background: '#eff6ff', border: '2px solid #93c5fd', borderRadius: '12px', padding: '14px 18px', margin: '0 0 14px', display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <strong style={{ color: '#1d4ed8', fontSize: '14px' }}>🎯 Actividades activas de «{activeCategory.name}»</strong>
              <span style={{ fontSize: '12px', color: '#1e40af' }}>
                Marcá las del plan de hoy — el resto se quita de esta pestaña (la consulta 📌 de cada una
                queda guardada igual: si la volvés a marcar otro día, no hay que reconfigurar nada).
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                <button
                  className="pl-btn"
                  style={{ background: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }}
                  onClick={marcarSoloLasDeHoy}
                  disabled={conFormsHoy === 0}
                  title="Marca automáticamente las actividades que ya tienen formularios PD guardados hoy"
                >✨ Solo las de hoy ({conFormsHoy})</button>
                <button className="pl-btn" style={{ background: '#1d4ed8', color: 'white', fontWeight: 700 }} onClick={aplicarSelectorActividades}>
                  ✓ Aplicar ({selMarcadas.size})
                </button>
                <button className="pl-btn" style={{ background: '#f1f5f9', color: '#64748b' }} onClick={() => setVerSelector(false)}>Cancelar</button>
              </div>
            </div>
            {conFormsHoy === 0 && (
              <div style={{ fontSize: '12px', color: '#1e40af' }}>
                Aún no hay formularios PD guardados para el {fecha} — «✨ Solo las de hoy» se activa apenas
                llenen alguno. Mientras tanto, marcá a mano.
              </div>
            )}
            <div style={{ display: 'grid', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
              {bloques.map(b => (
                <div key={b.grupo} style={{ display: 'grid', gap: '4px' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800,
                    color: GRUPOS[b.grupo].color, background: GRUPOS[b.grupo].fondo,
                    borderLeft: `4px solid ${GRUPOS[b.grupo].color}`, borderRadius: '4px', padding: '3px 8px',
                  }}>
                    <span>{GRUPOS[b.grupo].icono}</span>{GRUPOS[b.grupo].label}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '4px 12px' }}>
                    {b.items.map(a => {
                      const k = claveActividad(a.grupo, a.nombre);
                      const marcada = selMarcadas.has(k);
                      const nForms = formsHoyPorActividad[k] || 0;
                      const yaEstaba = existentes.has(k);
                      return (
                        <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '3px 6px', borderRadius: '6px', background: marcada ? '#dbeafe' : 'transparent', cursor: 'pointer' }}>
                          <input type="checkbox" checked={marcada} onChange={() => toggleSelActividad(a.grupo, a.nombre)} />
                          <span style={{ flex: 1, fontWeight: marcada ? 700 : 400, color: marcada ? '#1e3a8a' : '#334155' }}>{a.nombre}</span>
                          {nForms > 0 && (
                            <span title={`${nForms} formulario(s) guardado(s) hoy con esta actividad`}
                              style={{ fontSize: '10px', background: '#bbf7d0', color: '#065f46', borderRadius: '999px', padding: '1px 6px', fontWeight: 700 }}>
                              📋{nForms}
                            </span>
                          )}
                          {yaEstaba && <span title="Ya está en esta pestaña" style={{ fontSize: '13px', color: '#93c5fd' }}>●</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ⚙️ PANEL DE CONSULTAS: lo configurado una vez corre solo cada día */}
      {activeCategory && verConfig && (() => {
        const clavesCol = Object.keys(activeCategory.recetasCol || {});
        const procsConReceta = activeCategory.processes.filter(p => Object.keys(p.recetas || {}).length > 0);
        const chip = { display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'white', border: '1px solid #99f6e4', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 600, color: '#0f766e' };
        const btnX = { border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: '12px', padding: 0 };
        return (
          <div className="no-print" style={{ background: '#f0fdfa', border: '2px solid #5eead4', borderRadius: '12px', padding: '14px 18px', margin: '0 0 14px', display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <strong style={{ color: '#0f766e', fontSize: '14px' }}>⚙️ Consultas de «{activeCategory.name}»</strong>
              <span style={{ fontSize: '12px', color: '#115e59' }}>
                Se guardan con el plan. Con «Ejecutar» se recalculan solas: formularios del día
                ({fecha}) y de la actividad de cada fila.
              </span>
              <button
                className="pl-btn"
                style={{ marginLeft: 'auto', background: '#0f766e', color: 'white', fontWeight: 700 }}
                onClick={ejecutarConsultas}
                disabled={ejecutando || (clavesCol.length === 0 && procsConReceta.length === 0 && (activeCategory.formulasCol || []).length === 0
                  && Object.keys(catalogo.porActividad).length === 0 && Object.keys(catalogo.porColumna).length === 0)}
              >
                {ejecutando ? '⏳ Ejecutando…' : '▶ Ejecutar consultas del día'}
              </button>
            </div>

            {clavesCol.length === 0 && procsConReceta.length === 0 && Object.keys(catalogo.porActividad).length === 0 && Object.keys(catalogo.porColumna).length === 0 && (
              <div style={{ fontSize: '12.5px', color: '#115e59' }}>
                Todavía no hay consultas guardadas. Abrí la calculadora con el
                🔗 de una celda, armá el cálculo y tocá <strong>«✓ Aplicar y guardar consulta»</strong> —
                queda fija para esa <strong>actividad + columna</strong> (catálogo 📌, vale cualquier día)
                y como predefinida de toda la columna.
              </div>
            )}

            {/* 📋 MATRIZ DE CONFIGURACIÓN: actividad × columna. Cada cruce es
                una consulta fija del catálogo (vale cualquier día y cualquier
                plan). Clic en ＋ para configurarla, 📌 para editarla, ✕ para
                quitarla. La sección PRODUCCIÓN normalmente se ingresa a mano:
                configurá solo las columnas que quieras autocalcular. */}
            {(() => {
              // Una línea por actividad Y BLOQUE: «Empaque» de camarón no sale
              // del mismo formulario que el de pescado, así que cada uno tiene
              // su propia consulta fija.
              const lineas = [];
              const vistas = new Set();
              const agregar = (nombre, grupo, nota = '') => {
                const limpio = String(nombre || '').trim();
                const k = `${grupo || ''}::${normTxt(limpio)}`;
                if (!limpio || vistas.has(k)) return;
                vistas.add(k);
                lineas.push({ nombre: limpio, grupo, nota });
              };
              // 1) Lo que hoy está en el plan.
              for (const p of activeCategory.processes) {
                if (p.sub) continue;
                agregar(p.name, grupoEfectivo(activeCategory, p));
              }
              // 2) Con «ver todo el catálogo», TODAS las actividades de los dos
              //    bloques — así se deja configurado camarón (o pescado) aunque
              //    ese día no estén en el plan.
              if (verTodasMatriz) for (const a of catalogoCompleto()) agregar(a.nombre, a.grupo);
              // 3) Las que ya tienen consulta guardada van siempre: si no, su
              //    configuración quedaría invisible y no se podría editar.
              for (const a of actividadesConfiguradas(catalogo)) {
                agregar(a.actividad, a.grupo, a.grupo ? '' : ' · sin bloque');
              }

              const bloques = [...ORDEN_GRUPOS, null]
                .map(g => ({ grupo: g, items: lineas.filter(l => (l.grupo || null) === g) }))
                .filter(b => b.items.length > 0);

              const thM = { padding: '4px 6px', fontSize: '10.5px', fontWeight: 700, whiteSpace: 'nowrap', borderBottom: '1px solid #99f6e4', textAlign: 'center' };
              const tdM = { padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #ccfbf1' };
              const btnCell = (activa, heredada) => ({
                border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                padding: '3px 8px', fontWeight: 700,
                background: activa ? (heredada ? '#ccfbf1' : '#0f766e') : '#f0fdfa',
                color: activa ? (heredada ? '#0f766e' : 'white') : '#5eead4',
              });
              const filaMatriz = (etiqueta, actividadReal, grupo = null) => (
                <tr key={`${grupo || 'sin'}::${etiqueta}`}>
                  <td style={{ ...tdM, textAlign: 'left', fontWeight: 700, color: '#115e59', whiteSpace: 'nowrap', fontSize: '12px' }}>{etiqueta}</td>
                  {camposOperables.map(([clave]) => {
                    // Propia del bloque, o heredada de lo configurado por nombre
                    // suelto (antes de que pescado y camarón se separaran). La
                    // heredada se ve más clarita.
                    const propia = actividadReal && grupo
                      ? catalogo.porActividad?.[`${grupo}::${normTxt(actividadReal)}`]?.[clave]
                      : null;
                    const suelta = actividadReal
                      ? catalogo.porActividad?.[normTxt(actividadReal)]?.[clave]
                      : catalogo.porColumna?.[clave];
                    const rec = propia || suelta;
                    const heredada = !propia && !!suelta && !!grupo;
                    return (
                      <td key={clave} style={tdM}>
                        <button
                          style={btnCell(!!rec, heredada)}
                          title={heredada
                            ? 'Configurada por nombre de actividad (sirve para los dos bloques). Clic para darle una propia a este bloque.'
                            : (rec ? 'Editar esta consulta fija' : 'Configurar consulta para esta actividad + columna')}
                          onClick={() => abrirMatrizConsulta(actividadReal, clave, grupo)}
                        >{rec ? '📌' : '＋'}</button>
                        {rec && (
                          <button
                            style={{ ...btnX, marginLeft: '2px' }}
                            title={heredada ? 'Quitar la consulta del nombre (afecta a los dos bloques)' : 'Quitar esta consulta fija'}
                            onClick={async () => {
                              setCatalogo(await quitarConsultaCatalogo({
                                actividad: actividadReal, grupo: propia ? grupo : null, clave,
                                actualizadoPor: usuarioActual(),
                              }));
                              setCatalogoPendientes(pendientesDeSubir());
                            }}
                          >✕</button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
              return (
                <div style={{ borderTop: '1px solid #99f6e4', paddingTop: '10px', display: 'grid', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#134e4a', textTransform: 'uppercase' }}>
                      📋 Matriz de consultas fijas — actividad × columna (valen cualquier día):
                    </span>
                    {/* De dónde sale lo que se ve: la base (lo ve toda la
                        planta) o la copia de este navegador si el servidor no
                        contestó — con lo que quedó esperando para subir. */}
                    {catalogoEnServidor === true && catalogoPendientes === 0 && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: '999px', padding: '2px 10px' }}
                        title="Las consultas se guardan en la base de datos: las ve toda la planta desde cualquier computadora">
                        ☁️ Guardadas en la base — las ve toda la planta
                      </span>
                    )}
                    {(catalogoEnServidor === false || catalogoPendientes > 0) && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#9a3412', background: '#ffedd5', borderRadius: '999px', padding: '2px 10px' }}
                        title="El servidor no contestó: se está usando la copia de este navegador y los cambios se suben solos cuando vuelva">
                        ⚠️ Sin servidor{catalogoPendientes > 0 ? ` — ${catalogoPendientes} cambio(s) por subir` : ''}
                      </span>
                    )}
                    <button
                      className="pl-btn"
                      style={{ marginLeft: 'auto', background: verTodasMatriz ? '#0f766e' : '#ccfbf1', color: verTodasMatriz ? 'white' : '#0f766e', fontWeight: 700 }}
                      onClick={() => setVerTodasMatriz(v => !v)}
                      title="Mostrar todas las actividades de pescado y camarón, aunque hoy no estén en el plan"
                    >
                      {verTodasMatriz ? '➖ Solo las del plan' : '➕ Ver todo el catálogo (pescado + camarón)'}
                    </button>
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#115e59' }}>
                    Clic en ＋ para configurar qué se extrae de los formularios en ese cruce.
                    Los cálculos van en <strong>PRODUCCIÓN (ejecución real)</strong> — lo que de
                    verdad pasó según los formularios del día (ej. Corte × R·Libras = total de
                    cortes del PD-04). La PLANIFICACIÓN es la meta que se tipea.
                  </span>
                  <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', background: 'white', borderRadius: '8px' }}>
                      <thead>
                        <tr>
                          <th style={{ ...thM, textAlign: 'left' }}>Actividad</th>
                          {camposOperables.map(([clave, lbl]) => (
                            <th key={clave} style={{
                              ...thM,
                              color: clave.startsWith('plan.') ? '#b45309' : clave.startsWith('prod.') ? '#a16207' : '#134e4a',
                            }}>{lbl.replace('PLAN · ', 'P·').replace('PROD · ', 'R·').replace('COL · ', 'C·')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bloques.map(b => (
                          <React.Fragment key={b.grupo || 'sin-bloque'}>
                            <tr>
                              <td
                                colSpan={1 + camposOperables.length}
                                style={{
                                  padding: '5px 8px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em',
                                  background: b.grupo ? GRUPOS[b.grupo].fondo : '#f1f5f9',
                                  color: b.grupo ? GRUPOS[b.grupo].color : '#64748b',
                                  borderTop: `2px solid ${b.grupo ? GRUPOS[b.grupo].color : '#cbd5e1'}`,
                                }}
                              >
                                {b.grupo ? `${GRUPOS[b.grupo].icono} ${GRUPOS[b.grupo].label}` : 'SIN BLOQUE (configuradas por nombre)'}
                              </td>
                            </tr>
                            {b.items.map(l => filaMatriz(`${l.nombre}${l.nota}`, l.nombre, l.grupo))}
                          </React.Fragment>
                        ))}
                        {filaMatriz('— Genérica (todas) —', '')}
                      </tbody>
                    </table>
                  </div>
                  <span style={{ fontSize: '10.5px', color: '#0d9488' }}>
                    R· = Producción real (se extrae de los formularios) · P· = Planificación (meta tipeada) · C· = columna agregada.
                    Al guardar desde acá se recalcula todo el plan con los formularios del día.
                  </span>
                </div>
              );
            })()}

            {clavesCol.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#134e4a', textTransform: 'uppercase' }}>Por columna (todas las filas):</span>
                {clavesCol.map(clave => (
                  <span key={clave} style={chip}>
                    📐 {etiquetaClave(clave)}
                    <button style={btnX} title="Quitar esta consulta de columna" onClick={() => quitarRecetaCol(clave)}>✕</button>
                  </span>
                ))}
              </div>
            )}

            {procsConReceta.length > 0 && (
              <div style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#134e4a', textTransform: 'uppercase' }}>Por celda:</span>
                {procsConReceta.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#115e59', fontStyle: p.sub ? 'italic' : 'normal' }}>
                      {p.sub ? '↳ ' : ''}{p.name || '(sin nombre)'}:
                    </span>
                    {Object.keys(p.recetas || {}).map(clave => (
                      <span key={clave} style={chip}>
                        🎯 {etiquetaClave(clave)}
                        <button style={btnX} title="Quitar la consulta de esta celda" onClick={() => quitarRecetaCelda(p.id, clave)}>✕</button>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Configuración general: qué filtros automáticos usa «Ejecutar» */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', borderTop: '1px solid #99f6e4', paddingTop: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#134e4a', textTransform: 'uppercase' }}>Filtros automáticos:</span>
              {[
                ['actividad', '🏭 Actividad de la fila'],
                ['especie', '🐟 Producto / especie (sub-filas)'],
                ['clasif', '🏷️ Clasificación (sub-filas)'],
              ].map(([k, lbl]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#115e59', cursor: 'pointer' }}>
                  <input type="checkbox" checked={cfgConsulta(k)} onChange={e => setCfgConsulta(k, e.target.checked)} />
                  {lbl}
                </label>
              ))}
              <span style={{ fontSize: '11px', color: '#0d9488' }}>
                — se aplican solos al Ejecutar y al abrir la calculadora desde una celda
              </span>
            </div>

            {/* 🧮 Operaciones entre columnas: destino = A (op) B, para todas las filas */}
            <div style={{ borderTop: '1px solid #99f6e4', paddingTop: '10px', display: 'grid', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#134e4a', textTransform: 'uppercase' }}>🧮 Operaciones entre columnas:</span>
                <span style={{ fontSize: '11.5px', color: '#115e59' }}>se configuran una vez y calculan la columna destino en TODAS las filas</span>
                <button
                  className="pl-btn"
                  style={{ marginLeft: 'auto', background: '#ccfbf1', color: '#0f766e', fontWeight: 700, padding: '6px 12px' }}
                  onClick={() => setFormulasCol([...(activeCategory.formulasCol || []), { destino: '', a: '', op: '/', b: '', bNum: '' }])}
                >+ Nueva operación</button>
                {(activeCategory.formulasCol || []).length > 0 && (
                  <button
                    className="pl-btn"
                    style={{ background: '#0f766e', color: 'white', fontWeight: 700, padding: '6px 12px' }}
                    onClick={aplicarOperacionesColumnas}
                  >▶ Aplicar operaciones ahora</button>
                )}
              </div>
              {(activeCategory.formulasCol || []).map((f, fi) => {
                const setF = (cambios) => setFormulasCol(
                  activeCategory.formulasCol.map((x, xi) => xi === fi ? { ...x, ...cambios } : x)
                );
                const sel = { padding: '5px 8px', borderRadius: '6px', border: '1px solid #99f6e4', fontSize: '12.5px', background: 'white' };
                return (
                  <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <select style={sel} value={f.destino} onChange={e => setF({ destino: e.target.value })}>
                      <option value="">— Columna destino —</option>
                      {camposOperables.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <span style={{ fontWeight: 800, color: '#0f766e' }}>=</span>
                    <select style={sel} value={f.a} onChange={e => setF({ a: e.target.value })}>
                      <option value="">— Columna A —</option>
                      {camposOperables.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <select style={{ ...sel, fontWeight: 800 }} value={f.op} onChange={e => setF({ op: e.target.value })}>
                      <option value="+">+</option>
                      <option value="-">−</option>
                      <option value="*">×</option>
                      <option value="/">÷</option>
                    </select>
                    <select style={sel} value={f.b} onChange={e => setF({ b: e.target.value })}>
                      <option value="">— Columna B —</option>
                      <option value="#num">Nº fijo…</option>
                      {camposOperables.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {f.b === '#num' && (
                      <input type="number" style={{ ...sel, width: '90px' }} value={f.bNum}
                        placeholder="valor" onChange={e => setF({ bNum: e.target.value })} />
                    )}
                    <button
                      style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontWeight: 700 }}
                      title="Quitar esta operación"
                      onClick={() => setFormulasCol(activeCategory.formulasCol.filter((_, xi) => xi !== fi))}
                    >✕</button>
                  </div>
                );
              })}
              {(activeCategory.formulasCol || []).length === 0 && (
                <span style={{ fontSize: '12px', color: '#115e59' }}>
                  Ej.: <em>PROD · M.Obra $ = PROD · Hrs × Nº fijo 6.50</em> — tocá «+ Nueva operación» para armarla.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid #99f6e4', paddingTop: '10px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#134e4a', textTransform: 'uppercase', alignSelf: 'center' }}>🧹 Limpiar:</span>
              <button className="pl-btn" style={{ background: '#fef9c3', color: '#854d0e' }} onClick={() => limpiarPestania(true)}>
                Solo celdas con consulta
              </button>
              <button className="pl-btn" style={{ background: '#fee2e2', color: '#b91c1c' }} onClick={() => limpiarPestania(false)}>
                Todos los valores de la pestaña
              </button>
              <span style={{ fontSize: '11.5px', color: '#115e59', alignSelf: 'center' }}>
                Por casillero: usá «🧮 Seleccionar celdas», marcá las que quieras y tocá «🧹 Limpiar» en la barra de abajo.
              </span>
            </div>
          </div>
        );
      })()}

      {/* EXCEL GRID (Only shows active category) */}
      {activeCategory && (
        <div
          className={`pl-table-wrapper ${modoSeleccion ? 'pl-modo-seleccion' : ''}`}
          onClickCapture={onGridClickCapture}
        >
          <table className="pl-data-table">
            <thead>
              {/* Top Level Headers */}
              <tr>
                <th rowSpan={2} className="sticky-col" style={{ minWidth: '300px', background: 'white' }}>Proceso / Actividad</th>
                
                <th colSpan={7 + planCols.length} className="th-top-plan">
                  PLANIFICACIÓN (EXPECTATIVAS)
                  <button className="pl-add-col-btn no-print" onClick={() => { setNewFieldData({ section: 'plan', label: '' }); setIsModalOpen(true); }}>+ Col</button>
                </th>
                
                <th colSpan={6 + prodCols.length} className="th-top-prod">
                  PRODUCCIÓN (EJECUCIÓN REAL)
                  <button className="pl-add-col-btn no-print" onClick={() => { setNewFieldData({ section: 'prod', label: '' }); setIsModalOpen(true); }}>+ Col</button>
                </th>
                
                <th colSpan={4 + resCols.length} className="th-top-res">
                  INDICADORES DE RESULTADOS
                  <button className="pl-add-col-btn no-print" onClick={() => { setNewFieldData({ section: 'res', label: '' }); setIsModalOpen(true); }}>+ Col</button>
                </th>
                
                <th rowSpan={2} className="no-print" style={{ width: '40px', background: 'white', borderRight: 'none' }}></th>
              </tr>
              {/* Sub Headers */}
              <tr>
                {/* PLAN */}
                <th className="th-sub-plan">Libras</th>
                <th className="th-sub-plan">Lbs/Hrs</th>
                <th className="th-sub-plan">Hrs Est.</th>
                <th className="th-sub-plan">Nº Personas</th>
                <th className="th-sub-plan">M.Obra Est. $</th>
                <th className="th-sub-plan">Proy. Pers</th>
                <th className="th-sub-plan">Proy. CtxLb</th>
                {planCols.map(c => <th key={c.id} className="th-sub-plan">{c.label}</th>)}
                
                {/* PROD */}
                <th className="th-sub-prod">Libras</th>
                <th className="th-sub-prod">Lbs/Hrs</th>
                <th className="th-sub-prod">Hrs Reales</th>
                <th className="th-sub-prod">Nº Personas</th>
                <th className="th-sub-prod">M.Obra Real $</th>
                <th className="th-sub-prod" style={{fontWeight: 800}}>Fileteo / Ext</th>
                {prodCols.map(c => <th key={c.id} className="th-sub-prod">{c.label}</th>)}
                
                {/* RES */}
                <th className="th-sub-res">Costo x Lb</th>
                <th className="th-sub-res">Dif. Costo</th>
                <th className="th-sub-res">% Meta</th>
                <th className="th-sub-res" style={{ minWidth: '150px' }}>Observaciones</th>
                {resCols.map(c => <th key={c.id} className="th-sub-res">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {/* Processes Rows.
                  Pescado y camarón van en la MISMA pestaña: cada bloque abre
                  con una banda de color y sus filas llevan un filo del mismo
                  tono, que es la separación que pidió planta. */}
              {filtrarProcesos(activeCategory.processes).flatMap((proc, idxFila, filasVisibles) => {
                const grupoFila = grupoEfectivo(activeCategory, proc);
                const grupoPrevio = idxFila > 0 ? grupoEfectivo(activeCategory, filasVisibles[idxFila - 1]) : null;
                const conBandas = pestaniaUnificada
                  || new Set(filasVisibles.map(p => grupoEfectivo(activeCategory, p))).size > 1;
                const banda = (conBandas && grupoFila !== grupoPrevio) ? (
                  <tr key={`banda-${grupoFila}`} className={`pl-grupo-banda pl-grupo-${grupoFila}`}>
                    <td colSpan={totalColumnas}>
                      <span className="pl-grupo-icono">{GRUPOS[grupoFila].icono}</span>
                      {GRUPOS[grupoFila].label}
                    </td>
                  </tr>
                ) : null;

                const planLbsHrs = safeDiv(proc.plan.libras, proc.plan.hrs).toFixed(2);
                const prodLbsHrs = safeDiv(proc.prod.libras, proc.prod.hrs).toFixed(2);
                const meta = safeDiv(proc.prod.libras, proc.plan.libras) * 100;
                const ctxLbReal = safeDiv(proc.prod.costo, proc.prod.libras).toFixed(4);
                const difCt = (n(ctxLbReal) - n(proc.plan.proyCt)).toFixed(4);

                return [banda, (
                  <tr key={proc.id} className={`pl-fila-grupo pl-fila-${grupoFila}`}>
                    <td className="sticky-col">
                      {/* Actividad (padre) o clasificación (sub-fila). Las dos
                          con lista de sugerencias, y siempre se puede escribir
                          una nueva. La sub va indentada con ↳. */}
                      {proc.sub ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '18px' }}>
                          <span style={{ color: '#94a3b8', fontSize: '13px' }}>↳</span>
                          <input
                            className="pl-cell-input pl-cell-input-text"
                            style={{ fontStyle: 'italic', flex: '1 1 55%' }}
                            list="pl-productos"
                            value={proc.producto ?? ''}
                            onChange={e => updateSubcat(activeCategory.id, proc.id, { producto: e.target.value })}
                            placeholder="Producto / especie…"
                            title="Producto o especie (sugeridos del Inventario de Lotes)"
                          />
                          <input
                            className="pl-cell-input pl-cell-input-text"
                            style={{ fontStyle: 'italic', flex: '1 1 45%', borderLeft: '1px solid #e2e8f0' }}
                            list="pl-clasificaciones"
                            value={proc.clasif ?? proc.name ?? ''}
                            onChange={e => updateSubcat(activeCategory.id, proc.id, { clasif: e.target.value })}
                            placeholder="Clasificación…"
                            title="Clasificación (del catálogo de Clasificación de Producto)"
                          />
                        </div>
                      ) : (
                        <input
                          className="pl-cell-input pl-cell-input-text pl-cell-input-bold"
                          list={grupoFila === GRUPO_CAMARON ? 'pl-actividades-camaron' : 'pl-actividades-general'}
                          value={proc.name}
                          onChange={e => updateField(activeCategory.id, proc.id, 'name', null, e.target.value)}
                          placeholder="Elegir o escribir actividad…"
                        />
                      )}
                    </td>

                    {/* PLAN */}
                    <td className="td-plan pl-cell-wrapper">
                      <input type="number" className="pl-cell-input" value={proc.plan.libras} onChange={e => updateField(activeCategory.id, proc.id, 'plan', 'libras', e.target.value)} />
                      <button className="pl-link-trigger no-print" style={iconoPlan} title="Vincular con datos — PLAN (estimado)" onClick={() => openLinker(activeCategory.id, proc.id, 'plan', 'libras')}>🔗</button>
                    </td>
                    <td className="td-plan"><div className="pl-readonly-cell">{planLbsHrs}</div></td>
                    <td className="td-plan pl-cell-wrapper">
                      <input type="number" className="pl-cell-input" value={proc.plan.hrs} onChange={e => updateField(activeCategory.id, proc.id, 'plan', 'hrs', e.target.value)} />
                      <button className="pl-link-trigger no-print" style={iconoPlan} title="Vincular con datos — PLAN (estimado)" onClick={() => openLinker(activeCategory.id, proc.id, 'plan', 'hrs')}>🔗</button>
                    </td>
                    <td className="td-plan pl-cell-wrapper">
                      <input type="number" className="pl-cell-input" value={proc.plan.personas} onChange={e => updateField(activeCategory.id, proc.id, 'plan', 'personas', e.target.value)} />
                      <button className="pl-link-trigger no-print" style={iconoPlan} title="Vincular con datos — PLAN (estimado)" onClick={() => openLinker(activeCategory.id, proc.id, 'plan', 'personas')}>🔗</button>
                    </td>
                    <td className="td-plan pl-cell-wrapper">
                      <input type="number" className="pl-cell-input" value={proc.plan.costo} onChange={e => updateField(activeCategory.id, proc.id, 'plan', 'costo', e.target.value)} />
                      <button className="pl-link-trigger no-print" style={iconoPlan} title="Vincular con datos — PLAN (estimado)" onClick={() => openLinker(activeCategory.id, proc.id, 'plan', 'costo')}>🔗</button>
                    </td>
                    <td className="td-plan pl-cell-wrapper">
                      <input type="number" className="pl-cell-input" value={proc.plan.proyPers} onChange={e => updateField(activeCategory.id, proc.id, 'plan', 'proyPers', e.target.value)} />
                      <button className="pl-link-trigger no-print" style={iconoPlan} title="Vincular con datos — PLAN (estimado)" onClick={() => openLinker(activeCategory.id, proc.id, 'plan', 'proyPers')}>🔗</button>
                    </td>
                    <td className="td-plan pl-cell-wrapper">
                      <input type="number" step="0.01" className="pl-cell-input" value={proc.plan.proyCt} onChange={e => updateField(activeCategory.id, proc.id, 'plan', 'proyCt', e.target.value)} />
                      <button className="pl-link-trigger no-print" style={iconoPlan} title="Vincular con datos — PLAN (estimado)" onClick={() => openLinker(activeCategory.id, proc.id, 'plan', 'proyCt')}>🔗</button>
                    </td>
                    {planCols.map(c => <td key={c.id} className="td-plan pl-cell-wrapper">
                      <input type="text" className="pl-cell-input" value={proc.customData[c.id] || ''} onChange={e => updateField(activeCategory.id, proc.id, 'custom', c.id, e.target.value)} />
                      <button className="pl-link-trigger no-print" style={iconoPlan} title="Vincular con datos — PLAN (estimado)" onClick={() => openLinker(activeCategory.id, proc.id, 'custom', c.id)}>🔗</button>
                    </td>)}

                    {/* PROD */}
                    <td className="td-prod pl-cell-wrapper">
                      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <input type="number" className="pl-cell-input pl-cell-input-bold" value={proc.prod.libras} onChange={e => updateField(activeCategory.id, proc.id, 'prod', 'libras', e.target.value)} />
                        <button className="pl-link-trigger no-print" style={iconoProd} title="Vincular con datos de Planta — PRODUCCIÓN REAL" onClick={() => openLinker(activeCategory.id, proc.id, 'prod', 'libras')}>🔗</button>
                      </div>
                    </td>
                    <td className="td-prod"><div className="pl-readonly-cell">{prodLbsHrs}</div></td>
                    <td className="td-prod pl-cell-wrapper">
                      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <input type="number" className="pl-cell-input" value={proc.prod.hrs} onChange={e => updateField(activeCategory.id, proc.id, 'prod', 'hrs', e.target.value)} />
                        <button className="pl-link-trigger no-print" style={iconoProd} title="Vincular con datos de Planta — PRODUCCIÓN REAL" onClick={() => openLinker(activeCategory.id, proc.id, 'prod', 'hrs')}>🔗</button>
                      </div>
                    </td>
                    <td className="td-prod"><input type="number" className="pl-cell-input" value={proc.prod.personas} onChange={e => updateField(activeCategory.id, proc.id, 'prod', 'personas', e.target.value)} /></td>
                    <td className="td-prod pl-cell-wrapper">
                       <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                         <input type="number" className="pl-cell-input" value={proc.prod.costo} onChange={e => updateField(activeCategory.id, proc.id, 'prod', 'costo', e.target.value)} />
                         <button className="pl-link-trigger no-print" style={iconoProd} title="Vincular con datos de Planta — PRODUCCIÓN REAL" onClick={() => openLinker(activeCategory.id, proc.id, 'prod', 'costo')}>🔗</button>
                       </div>
                    </td>
                    <td className="td-prod pl-cell-wrapper" style={{ background: '#fefce8' }}>
                      <input type="text" className="pl-cell-input pl-cell-input-text" value={proc.prod.fileteo} onChange={e => updateField(activeCategory.id, proc.id, 'prod', 'fileteo', e.target.value)} />
                    </td>
                    {prodCols.map(c => <td key={c.id} className="td-prod pl-cell-wrapper">
                      <input type="text" className="pl-cell-input" value={proc.customData[c.id] || ''} onChange={e => updateField(activeCategory.id, proc.id, 'custom', c.id, e.target.value)} />
                      <button className="pl-link-trigger no-print" style={iconoProd} title="Vincular con datos de Planta — PRODUCCIÓN REAL" onClick={() => openLinker(activeCategory.id, proc.id, 'custom', c.id)}>🔗</button>
                    </td>)}

                    {/* RES */}
                    <td className="td-res"><div className="pl-readonly-cell">${ctxLbReal}</div></td>
                    <td className="td-res"><div className="pl-readonly-cell" style={{ color: n(difCt) > 0 ? '#ef4444' : '#10b981' }}>${difCt}</div></td>
                    <td className="td-res">
                      <div className="pl-readonly-cell" style={{ justifyContent: 'center' }}>
                        <span className={`pl-badge ${meta >= 100 ? 'badge-green' : meta >= 80 ? 'badge-orange' : meta > 0 ? 'badge-red' : ''}`}>
                          {meta > 0 ? `${meta.toFixed(1)}%` : '-'}
                        </span>
                      </div>
                    </td>
                    <td className="td-res"><input type="text" className="pl-cell-input pl-cell-input-text" style={{ fontStyle: 'italic', color: '#64748b' }} value={proc.res.obs} onChange={e => updateField(activeCategory.id, proc.id, 'res', 'obs', e.target.value)} placeholder="Nota..." /></td>
                    {resCols.map(c => <td key={c.id} className="td-res"><input type="text" className="pl-cell-input" value={proc.customData[c.id] || ''} onChange={e => updateField(activeCategory.id, proc.id, 'custom', c.id, e.target.value)} /></td>)}

                    {/* ACTIONS */}
                    <td className="no-print" style={{ textAlign: 'center', borderRight: 'none', whiteSpace: 'nowrap' }}>
                      {!proc.sub && (
                        <button
                          className="pl-btn-icon"
                          style={{ color: '#4338ca' }}
                          title="Agregar subcategoría (clasificación) debajo de esta actividad"
                          onClick={() => addSubProcess(activeCategory.id, proc.id)}
                        >↳+</button>
                      )}
                      <button className="pl-btn-icon" onClick={() => removeProcess(activeCategory.id, proc.id)}>✕</button>
                    </td>
                  </tr>
                )].filter(Boolean);
              })}
            </tbody>
            <tfoot>
              {(() => {
                let sumPlanLbs = 0, sumPlanHrs = 0, sumPlanCosto = 0;
                let sumProdLbs = 0, sumProdHrs = 0, sumProdCosto = 0;
                
                activeCategory.processes.forEach(p => {
                  sumPlanLbs += n(p.plan.libras);
                  sumPlanHrs += n(p.plan.hrs);
                  sumPlanCosto += n(p.plan.costo);
                  sumProdLbs += n(p.prod.libras);
                  sumProdHrs += n(p.prod.hrs);
                  sumProdCosto += n(p.prod.costo);
                });

                return (
                  <tr style={{ background: '#1e293b', color: 'white', fontWeight: '800' }}>
                    <td className="sticky-col" style={{ background: '#1e293b', color: 'white', textAlign: 'right', padding: '12px', borderBottom: 'none' }}>TOTALES PESTAÑA:</td>
                    
                    {/* PLAN */}
                    <td style={{ padding: '12px', textAlign: 'right' }}>{sumPlanLbs.toLocaleString()}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{safeDiv(sumPlanLbs, sumPlanHrs).toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{sumPlanHrs.toLocaleString()}</td>
                    <td></td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>${sumPlanCosto.toLocaleString()}</td>
                    <td></td>
                    <td></td>
                    {planCols.map(c => <td key={c.id}></td>)}

                    {/* PROD */}
                    <td style={{ padding: '12px', textAlign: 'right', background: '#334155' }}>{sumProdLbs.toLocaleString()}</td>
                    <td style={{ padding: '12px', textAlign: 'right', background: '#334155' }}>{safeDiv(sumProdLbs, sumProdHrs).toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', background: '#334155' }}>{sumProdHrs.toLocaleString()}</td>
                    <td style={{ background: '#334155' }}></td>
                    <td style={{ padding: '12px', textAlign: 'right', background: '#334155' }}>${sumProdCosto.toLocaleString()}</td>
                    <td style={{ background: '#334155' }}></td>
                    {prodCols.map(c => <td key={c.id} style={{ background: '#334155' }}></td>)}

                    {/* RES */}
                    <td style={{ padding: '12px', textAlign: 'right', background: '#0f172a' }}>${safeDiv(sumProdCosto, sumProdLbs).toFixed(4)}</td>
                    <td style={{ background: '#0f172a' }}></td>
                    <td style={{ padding: '12px', textAlign: 'center', background: '#0f172a' }}>{safeDiv(sumProdLbs, sumPlanLbs) > 0 ? (safeDiv(sumProdLbs, sumPlanLbs) * 100).toFixed(1) + '%' : '-'}</td>
                    <td style={{ background: '#0f172a' }}></td>
                    {resCols.map(c => <td key={c.id} style={{ background: '#0f172a' }}></td>)}
                    <td className="no-print" style={{ background: '#0f172a' }}></td>
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
      )}

      {/* MODAL PARA AÑADIR COLUMNA DINÁMICA */}
      {isModalOpen && (
        <div className="pl-modal-overlay">
          <div className="pl-modal">
            <h3>Añadir Nueva Columna</h3>
            <div className="pl-input-group" style={{ marginBottom: '16px' }}>
              <label>¿A qué bloque pertenece?</label>
              <select value={newFieldData.section} onChange={e => setNewFieldData({ ...newFieldData, section: e.target.value })}>
                <option value="plan">Planificación (Naranja)</option>
                <option value="prod">Producción (Amarillo)</option>
                <option value="res">Resultados (Gris)</option>
              </select>
            </div>
            <div className="pl-input-group">
              <label>Nombre de la Columna</label>
              <input type="text" autoFocus value={newFieldData.label} onChange={e => setNewFieldData({ ...newFieldData, label: e.target.value })} placeholder="Ej. Rendimiento extra..." onKeyDown={e => e.key === 'Enter' && handleAddField()} />
            </div>
            <div className="pl-modal-actions">
              <button className="pl-btn" style={{ background: '#f1f5f9', color: '#64748b' }} onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button className="pl-btn pl-btn-add" onClick={handleAddField}>+ Añadir Columna</button>
            </div>
          </div>
        </div>
      )}
      {/* CALCULADORA DE FORMULARIOS (abre desde los botones 🔗 de cada celda) */}
      <CalculadoraFormularios
        open={!!calcTarget}
        destino={calcTarget?.etiqueta || ''}
        recetaInicial={calcTarget?.receta || null}
        fechaPlan={fecha}
        actividad={calcTarget?.actividad || ''}
        ambitoCamaron={calcTarget?.ambitoCamaron ?? null}
        producto={calcTarget?.producto || ''}
        clasif={calcTarget?.clasif || ''}
        onClose={() => setCalcTarget(null)}
        onApply={aplicarCalculo}
      />

      {/* BARRA FLOTANTE: totales de las celdas seleccionadas */}
      {modoSeleccion && (
        <div className="pl-barra-seleccion no-print">
          {celdasSel.length > 0 && (
            <button
              className="pl-sel-chip"
              style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 700 }}
              title="Vaciar el contenido de las celdas seleccionadas"
              onClick={limpiarSeleccion}
            >🧹 Limpiar ({celdasSel.length})</button>
          )}
          {totalesSel ? (
            <>
              <span className="pl-sel-chip pl-sel-n">{totalesSel.n} celda{totalesSel.n !== 1 ? 's' : ''}</span>
              {[
                ['Σ Suma', totalesSel.suma],
                ['− Resta', totalesSel.resta],
                ['× Multip.', totalesSel.producto],
                ['÷ División', totalesSel.division],
                ['x̄ Promedio', totalesSel.promedio],
              ].map(([lbl, v]) => (
                <button
                  key={lbl}
                  className="pl-sel-chip"
                  title="Clic para copiar el valor"
                  onClick={() => navigator.clipboard?.writeText(String(Number(v.toFixed(4))))}
                >
                  {lbl}: <strong>{Number(v.toFixed(4)).toLocaleString('es-EC')}</strong>
                </button>
              ))}
              <span style={{ fontSize: '11px', opacity: 0.8 }}>— la resta y la división siguen el orden del clic</span>
            </>
          ) : (
            <span style={{ fontSize: '13px' }}>Hacé clic en las celdas que quieras calcular o limpiar…</span>
          )}
          <button className="pl-sel-chip pl-sel-salir" onClick={salirSeleccion}>✕ Salir</button>
        </div>
      )}
    </div>
  );
}
