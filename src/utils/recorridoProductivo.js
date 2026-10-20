/**
 * 🏭 RECORRIDO PRODUCTIVO — configuración y lectura de datos
 * ---------------------------------------------------------------------------
 * El backend no tiene el concepto de "etapa": solo plantillas sueltas. El
 * recorrido del producto (recepción → fresco → fileteo → colgado → CO →
 * túneles → corte → empaque) es una vista de producción, así que el mapa
 * etapa → plantillas vive acá y se puede ajustar sin tocar la base.
 *
 * Todo se calcula con lo que ya devuelven los endpoints existentes
 * (`/FilledForms/lista` para conteos y `/FilledForms/erp-report` para el
 * detalle), sin cambios de backend.
 */

import { API_BASE_URL } from '../apiConfig';

/**
 * ASP.NET serializa con `ReferenceHandler.Preserve`: las listas llegan como
 * `{ $id, $values: [...] }`. Esto las devuelve planas.
 */
export const desenvolver = (x) =>
  x && typeof x === 'object' && Array.isArray(x.$values) ? x.$values : x;

/* ── Etapas del recorrido ────────────────────────────────────────────────── */

export const ETAPAS = [
  {
    id: 'recepcion',
    numero: '01',
    nombre: 'Recepción',
    detalle: 'Llegada y control de materia prima',
    plantillas: [
      { id: 81, codigo: 'FOR-CC-08', nombre: 'Inspección de materiales de empaque' },
      { id: 19, codigo: 'FOR-CC-42', nombre: 'Recepción de congelados / importaciones' },
      { id: 136, codigo: 'FOR-BOD-05', nombre: 'Recepción de materiales de empaque' },
    ],
  },
  {
    id: 'fresco',
    numero: '02A',
    nombre: 'Fresco',
    detalle: 'Fileteo de producto fresco para CO',
    plantillas: [
      { id: 17, codigo: 'FOR-CC-20', nombre: 'Control de fileteo para congelación / CO' },
    ],
  },
  {
    id: 'fileteo',
    numero: '02B',
    nombre: 'Fileteo',
    detalle: 'Control de producción para fileteo',
    plantillas: [
      { id: 101, codigo: 'FOR-PD-04', nombre: 'Control de producción para fileteo' },
    ],
  },
  {
    id: 'colgado',
    numero: '02C',
    nombre: 'Colgado',
    detalle: 'Control de producción para congelado',
    plantillas: [
      { id: 153, codigo: 'FOR-PD-16', nombre: 'Control de producción para congelado (colgado)' },
    ],
  },
  {
    id: 'co',
    numero: '03',
    nombre: 'Preparación para CO',
    detalle: 'Producto fresco que entra a congelación',
    plantillas: [
      { id: 150, codigo: 'FOR-PD-10', nombre: 'Control de productos frescos para congelación (CO)' },
    ],
  },
  {
    id: 'tuneles',
    numero: '04',
    nombre: 'Liberación de túneles',
    detalle: 'Salida de túneles y glaseo inicial',
    plantillas: [
      { id: 148, codigo: 'FOR-PD-05', nombre: 'Control de productos congelados (liberación de túneles)' },
      { id: 64, codigo: 'FOR-CC-14', nombre: 'Control de glaseo inicial (liberación de túneles)' },
    ],
  },
  {
    id: 'corte',
    numero: '05',
    nombre: 'Corte y clasificación',
    detalle: 'Corte, clasificación y empaque al vacío',
    plantillas: [
      { id: 147, codigo: 'FOR-PD-06', nombre: 'Control de corte y empaque al vacío' },
      { id: 63, codigo: 'FOR-CC-13', nombre: 'Control de clasificación, peso y dimensiones' },
      { id: 65, codigo: 'FOR-CC-15', nombre: 'Control de glaseo final (corte y clasificación)' },
    ],
  },
  {
    id: 'empaque',
    numero: '06',
    nombre: 'Empaque final',
    detalle: 'Empaque, etiquetado y sellos',
    plantillas: [
      { id: 149, codigo: 'FOR-PD-07', nombre: 'Control de empaque final de productos congelados' },
      { id: 23, codigo: 'FOR-CC-06', nombre: 'Control de producto durante empaque y etiquetado' },
      { id: 135, codigo: 'FOR-CC-06.2', nombre: 'Control de producto durante empaque y etiquetado' },
      { id: 24, codigo: 'FOR-CC-24', nombre: 'Control de sellos (producto fresco al vacío)' },
      { id: 27, codigo: 'FOR-CC-10', nombre: 'Control de sellos (producto congelado al vacío)' },
    ],
  },
  {
    id: 'reempaque',
    numero: '07',
    nombre: 'Reempaque',
    detalle: 'Reempaque y reproceso de producto congelado',
    plantillas: [
      { id: 155, codigo: 'FOR-PD-11', nombre: 'Control de reempaque / reproceso' },
    ],
  },
];

/**
 * Plantillas que no son una etapa del recorrido pero alimentan los
 * indicadores de productividad y personal.
 */
export const COMPLEMENTARIAS = [
  { id: 144, codigo: 'FOR-PD-14', nombre: 'Control productividad' },
  { id: 146, codigo: 'FOR-PD-15', nombre: 'Control de productividad · personal' },
  { id: 133, codigo: 'FOR-PD-18C', nombre: 'Control de productividad · camarón 1' },
  { id: 145, codigo: 'FOR-PD-19C', nombre: 'Control de productividad · camarón 2' },
];

export const TODAS_LAS_PLANTILLAS = [
  ...ETAPAS.flatMap((e) => e.plantillas),
  ...COMPLEMENTARIAS,
];

/* ── Lectura de pesos ────────────────────────────────────────────────────── */

const norm = (s) =>
  String(s ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Convierte "1,234.50" / "20,5" / "1.234,5" / " 12 " a número. */
export function aNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  if (valor === null || valor === undefined) return 0;
  let s = String(valor).trim();
  if (!s) return 0;
  s = s.replace(/[^\d.,-]/g, '');
  if (s.includes('.') && s.includes(',')) s = s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(/,/g, '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Columnas de peso. Las de glaseo, cajas o tara se descartan a propósito. */
const COL_NETO =
  /^(TOTAL LBS? NETAS?|TOTAL LBS NETAS|PESO NETO TOTAL|SUBTOTAL \(LBS NETAS\)|SUBTOTAL LBS NETAS|LIBRAS PRODUCTO TERMINADO|PESO PT)$/;

const COL_BRUTO =
  /^(PESO MATERIA PRIMA \(BRUTO\)|PESO MATERIA PRIMA|PESO MP|LIBRAS MATERIA PRIMA|PESO)$/;

const COL_PROCESADO = /^(PESO PROCESADO|PESO PROCESO)$/;

const NO_SUMAR = /OZ|GLASEO|TARA|CAJA|FUNDA|CAPACIDAD|%|PROM/;

const COL_PRODUCTO = /^PRODUCTO$/;
const COL_CLASIF = /CLASIFICACION/;
const COL_PERSONAL = /PERSONAL|N° PERSONAL|N PERSONAL|# PERSONAL/;

/**
 * Recorre el cuerpo de un formulario y suma los pesos de sus tablas.
 *
 * El cuerpo viene como una lista de bloques `{ type, data }`; las tablas son
 * `{ type:'table', data: [{columna: valor}, ...] }`. No se usan los títulos de
 * los bloques (no viajan en el registro): las columnas se reconocen por nombre.
 */
export function analizarFormulario(form) {
  const lectura = {
    formID: form.formID,
    codigo: form.formCode || '',
    nombre: form.templateName || '',
    fecha: null,
    lote: '',
    usuario: '',
    neto: 0,
    bruto: 0,
    reempaque: 0,
    procesado: 0,
    personas: 0,
    productos: [],
  };

  let body = [];
  let header = {};
  try {
    body = JSON.parse(form.bodyData || '[]');
  } catch {
    body = [];
  }
  try {
    header = JSON.parse(form.headerData || '{}');
  } catch {
    header = {};
  }

  // Fecha: la del encabezado si está, si no la de guardado.
  const fechaHeader = Object.entries(header).find(([k]) => /FECHA/i.test(k))?.[1];
  lectura.fecha = String(fechaHeader || form.createdAt || '').slice(0, 10);
  lectura.lote = String(Object.entries(header).find(([k]) => /LOTE/i.test(k))?.[1] ?? '').trim();
  lectura.usuario = form.filledBy || '';

  if (!Array.isArray(body)) return lectura;

  for (const bloque of body) {
    if (!bloque || bloque.type !== 'table' || !Array.isArray(bloque.data)) continue;
    const filas = bloque.data.filter((f) => f && typeof f === 'object');
    if (filas.length === 0) continue;

    const columnas = Object.keys(filas[0]);
    const esTablaMateriaPrima = columnas.some((c) => /LOTE MP|MATERIA PRIMA|N° TANQUE/.test(norm(c)));

    for (const fila of filas) {
      const producto = Object.entries(fila).find(([k]) => COL_PRODUCTO.test(norm(k)))?.[1];
      const clasif = Object.entries(fila).find(([k]) => COL_CLASIF.test(norm(k)))?.[1];
      let netoFila = 0;

      for (const [clave, valor] of Object.entries(fila)) {
        const col = norm(clave);
        if (!col) continue;

        // Personal: se cuenta aparte, no es un peso.
        if (COL_PERSONAL.test(col)) {
          lectura.personas += aNumero(valor);
          continue;
        }

        const numero = aNumero(valor);
        if (!numero) continue;

        if (/REEMPAQUE/.test(col)) {
          lectura.reempaque += numero;
          continue;
        }

        if (COL_PROCESADO.test(col)) {
          lectura.procesado += numero;
          continue;
        }

        if (NO_SUMAR.test(col)) continue;

        if (COL_NETO.test(col)) {
          lectura.neto += numero;
          netoFila += numero;
          continue;
        }

        // "PESO" pelado solo es materia prima en las tablas que traen lote/tanque.
        if (COL_BRUTO.test(col) && (col !== 'PESO' || esTablaMateriaPrima)) {
          lectura.bruto += numero;
        }
      }

      if (netoFila > 0 && producto) {
        lectura.productos.push({
          producto: String(producto).trim(),
          clasificacion: String(clasif ?? '').trim(),
          lbs: netoFila,
        });
      }
    }
  }

  return lectura;
}

/** Suma varias lecturas en los indicadores que muestra la pantalla. */
export function consolidar(lecturas) {
  const total = {
    formularios: lecturas.length,
    neto: 0,
    bruto: 0,
    reempaque: 0,
    procesado: 0,
    personas: 0,
    porDia: new Map(),
    porProducto: new Map(),
    porFormulario: [],
  };

  for (const l of lecturas) {
    total.neto += l.neto;
    total.bruto += l.bruto;
    total.reempaque += l.reempaque;
    total.procesado += l.procesado;
    total.personas += l.personas;

    if (l.fecha) total.porDia.set(l.fecha, (total.porDia.get(l.fecha) || 0) + 1);

    for (const p of l.productos) {
      const clave = `${p.producto}|${p.clasificacion}`;
      const actual = total.porProducto.get(clave) || {
        producto: p.producto,
        clasificacion: p.clasificacion,
        lbs: 0,
      };
      actual.lbs += p.lbs;
      total.porProducto.set(clave, actual);
    }

    total.porFormulario.push(l);
  }

  total.rendimiento = total.bruto > 0 ? (total.neto / total.bruto) * 100 : null;
  total.productividad = total.personas > 0 ? (total.procesado || total.neto) / total.personas : null;

  return total;
}

/* ── Consultas ───────────────────────────────────────────────────────────── */

/** Corre tareas de a tandas para no saturar el IIS de la planta. */
async function enTandas(items, fn, tamano = 5) {
  const salida = [];
  for (let i = 0; i < items.length; i += tamano) {
    const tanda = items.slice(i, i + tamano);
    const resultados = await Promise.allSettled(tanda.map(fn));
    salida.push(...resultados);
  }
  return salida;
}

/**
 * Cantidad de registros por plantilla en el rango, más el último registro
 * (para mostrar la fecha y quién llenó por última vez).
 */
export async function contarPorPlantilla(desde, hasta) {
  const resultados = await enTandas(
    TODAS_LAS_PLANTILLAS,
    async (p) => {
      const qs = new URLSearchParams({
        templateId: String(p.id),
        desde,
        hasta,
        pagina: '1',
        tamano: '1',
      });
      const res = await fetch(`${API_BASE_URL}/FilledForms/lista?${qs.toString()}`);
      if (!res.ok) throw new Error(`No se pudo contar ${p.codigo} (${res.status})`);
      const data = await res.json();
      const items = desenvolver(data.items) || [];
      return [p.id, { total: Number(data.total) || 0, ultimo: items[0] || null }];
    },
    4
  );

  const mapa = new Map();
  for (const r of resultados) {
    if (r.status === 'fulfilled') mapa.set(r.value[0], r.value[1]);
  }
  return mapa;
}

/** Firmas pendientes por plantilla (para el KPI "por revisar"). */
export async function contarPendientesFirma() {
  try {
    const res = await fetch(`${API_BASE_URL}/Signatures/pending`);
    if (!res.ok) return new Map();
    const data = desenvolver(await res.json()) || [];
    const mapa = new Map();
    for (const p of data) {
      const id = p.templateId ?? p.TemplateID ?? p.templateID;
      if (!id) continue;
      mapa.set(id, (mapa.get(id) || 0) + 1);
    }
    return mapa;
  } catch {
    return new Map();
  }
}

/**
 * Trae los formularios de una etapa en el rango y devuelve sus lecturas.
 * Se corta a las 3 tandas de 500 por plantilla para que un rango largo no
 * tumbe la pantalla; si queda afuera algo, se avisa con `parcial`.
 */
export async function cargarDetalleEtapa(etapa, desde, hasta) {
  const lecturas = [];
  let parcial = false;

  const resultados = await enTandas(
    etapa.plantillas,
    async (p) => {
      // 1) Lista liviana: es la única que trae quién llenó el formulario
      //    (el reporte ERP devuelve el cuerpo pero no el autor).
      const autores = new Map();
      const qsLista = new URLSearchParams({
        templateId: String(p.id),
        desde,
        hasta,
        pagina: '1',
        tamano: '500',
      });
      try {
        const resLista = await fetch(`${API_BASE_URL}/FilledForms/lista?${qsLista.toString()}`);
        if (resLista.ok) {
          const dataLista = await resLista.json();
          for (const item of desenvolver(dataLista.items) || []) {
            autores.set(item.formID, {
              usuario: item.filledBy || '',
              fechaRegistro: String(item.fechaRegistro || '').slice(0, 10),
            });
          }
        }
      } catch {
        // Si falla solo se pierde el autor; el resto de la etapa se muestra igual.
      }

      // 2) Cuerpo completo para los pesos.
      const propias = [];
      for (let pagina = 1; pagina <= 3; pagina += 1) {
        const qs = new URLSearchParams({
          templateId: String(p.id),
          inicio: desde,
          fin: hasta,
          pagina: String(pagina),
          tamano: '500',
        });
        const res = await fetch(`${API_BASE_URL}/FilledForms/erp-report?${qs.toString()}`);
        if (!res.ok) throw new Error(`No se pudo leer ${p.codigo} (${res.status})`);
        const data = await res.json();
        const datos = desenvolver(data.datos) || [];
        for (const form of datos) {
          const lectura = analizarFormulario(form);
          const autor = autores.get(lectura.formID);
          if (autor) {
            lectura.usuario = autor.usuario || lectura.usuario;
            if (!lectura.fecha) lectura.fecha = autor.fechaRegistro;
          }
          propias.push(lectura);
        }
        if (!data.hayMas || datos.length === 0) break;
        if (pagina === 3) parcial = true;
      }
      return propias;
    },
    2
  );

  for (const r of resultados) {
    if (r.status === 'fulfilled') lecturas.push(...r.value);
    else parcial = true;
  }

  return { lecturas, parcial };
}

/** Etiqueta corta para el rango elegido. */
export const etiquetaRango = (desde, hasta) => {
  const fmt = (iso) => {
    const [a, m, d] = String(iso).split('-');
    return `${d}/${m}/${a}`;
  };
  return desde === hasta ? fmt(desde) : `${fmt(desde)} → ${fmt(hasta)}`;
};
