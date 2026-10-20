/**
 * ⚖️ REGLAS DE DATOS CRÍTICOS
 * ---------------------------------------------------------------------------
 * Antes de guardar se comparan totales de columnas del formulario y se avisa
 * si algo no cuadra. Nunca bloquea: solo muestra advertencias.
 *
 * Cada regla tiene:
 *   - columna A (total del formulario)
 *   - operador (mayor, mayor o igual, menor, menor o igual, igual, distinto)
 *   - columna B  ó  un valor fijo
 *   - un mensaje propio (si se deja vacío se arma uno automático)
 *
 * Las reglas se recuerdan por código de formulario en el navegador
 * (localStorage), así que se configuran una vez y después solo se revisan.
 */

const norm = (s) =>
  String(s ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** "1,234.50" / "20,5" / "1.234,5" → número. */
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

/** Columnas que nunca se comparan como cantidad (horas, fechas, códigos). */
const NO_COMPARABLE = /^(HORA|FECHA|CODIGO|LOTE|CEDULA|TELEFONO|N°|NO\.|NUMERO)/;

/** Celdas de hora: "15:30", "15h30", "7:05". */
const PARECE_HORA = /^\s*\d{1,2}\s*[:h]\s*\d{2}/i;

/** Un valor que es realmente una cantidad (no texto con números adentro). */
const NUMERO_SIMPLE = /^-?\d+(?:[.,]\d+)?$/;
const NUMERO_MILES = /^-?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?$/;

export function esCantidad(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor);
  const texto = String(valor ?? '')
    .trim()
    .replace(/^\$\s*/, '')
    .replace(/\s*(kg|lbs?|g|oz|%)\.?$/i, '')
    .trim();
  if (!texto) return false;
  return NUMERO_SIMPLE.test(texto) || NUMERO_MILES.test(texto);
}

const parsear = (valor, porDefecto) => {
  if (!valor) return porDefecto;
  if (typeof valor !== 'string') return valor;
  try {
    return JSON.parse(valor);
  } catch {
    return porDefecto;
  }
};

/**
 * Todas las columnas numéricas del formulario, con su total.
 * @returns {{key:string, tabla:string, columna:string, total:number, celdas:number}[]}
 */
export function columnasNumericas(bodyData, bodyElements) {
  const bloques = parsear(bodyData, []);
  const elementos = parsear(bodyElements, []);
  if (!Array.isArray(bloques)) return [];

  const titulos = new Map();
  const ordenDe = new Map();
  if (Array.isArray(elementos)) {
    elementos.forEach((el, i) => {
      if (el && el.id !== undefined) {
        titulos.set(String(el.id), el.title || el.titulo || '');
        ordenDe.set(String(el.id), i);
      }
    });
  }

  const mapa = new Map();

  for (const bloque of bloques) {
    if (!bloque || bloque.type !== 'table' || !Array.isArray(bloque.data)) continue;
    const tabla = titulos.get(String(bloque.id)) || 'Tabla';
    const orden = ordenDe.get(String(bloque.id)) ?? 999;

    for (const fila of bloque.data) {
      if (!fila || typeof fila !== 'object') continue;
      for (const [columna, valor] of Object.entries(fila)) {
        if (columna.startsWith('_')) continue;           // metadatos de la API
        if (NO_COMPARABLE.test(norm(columna))) continue;  // horas, fechas, códigos, lotes
        if (PARECE_HORA.test(String(valor ?? ''))) continue;
        if (!esCantidad(valor)) continue;                 // columnas de texto

        const key = `${bloque.id}::${columna}`;
        const actual = mapa.get(key) || {
          key,
          tabla,
          orden,
          columna,
          total: 0,
          celdas: 0,
        };
        actual.total += aNumero(valor);
        actual.celdas += 1;
        mapa.set(key, actual);
      }
    }
  }

  return [...mapa.values()].sort((a, b) => a.orden - b.orden || b.total - a.total);
}

/* ── Operadores ──────────────────────────────────────────────────────────── */

export const OPERADORES = [
  { id: 'mayor', etiqueta: 'debe ser mayor que', corto: 'mayor', signo: '>' },
  { id: 'mayor_igual', etiqueta: 'debe ser mayor o igual que', corto: 'mayor o igual', signo: '≥' },
  { id: 'menor', etiqueta: 'debe ser menor que', corto: 'menor', signo: '<' },
  { id: 'menor_igual', etiqueta: 'debe ser menor o igual que', corto: 'menor o igual', signo: '≤' },
  { id: 'igual', etiqueta: 'debe ser igual a', corto: 'igual', signo: '=' },
  { id: 'distinto', etiqueta: 'debe ser distinto de', corto: 'distinto', signo: '≠' },
];

const CUMPLE = {
  mayor: (a, b) => a > b,
  mayor_igual: (a, b) => a >= b,
  menor: (a, b) => a < b,
  menor_igual: (a, b) => a <= b,
  igual: (a, b) => a === b,
  distinto: (a, b) => a !== b,
};

const nf = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 });
export const formatear = (n) => (Number.isFinite(n) ? nf.format(n) : '—');

/* ── Reglas por defecto ──────────────────────────────────────────────────── */

const ES_MP = (c) =>
  /MATERIA PRIMA|PESO MP|LIBRAS MATERIA PRIMA/.test(norm(`${c.tabla} ${c.columna}`)) &&
  !/NETO|NETAS/.test(norm(c.columna));

const ES_PT = (c) => /NETO|NETAS|PRODUCTO TERMINADO|SUBTOTAL/.test(norm(c.columna));

const ES_CAPACIDAD = (c) => /CAPACIDAD/.test(norm(c.columna));

let contador = 0;
export const nuevoId = () =>
  `r${Date.now().toString(36)}${(contador++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/**
 * Reglas que se proponen la primera vez: materia prima contra producto
 * terminado. Si el formulario no tiene materia prima (p. ej. liberación de
 * túneles), se compara la capacidad de cajas contra las libras netas.
 */
export function reglasPorDefecto(columnas) {
  if (!Array.isArray(columnas) || columnas.length < 2) return [];

  const mp = columnas.find(ES_MP);
  const pt = columnas.find(ES_PT);

  if (mp && pt && mp.key !== pt.key) {
    return [
      {
        id: nuevoId(),
        aKey: mp.key,
        op: 'mayor',
        tipo: 'columna',
        bKey: pt.key,
        valor: 0,
        mensaje: 'El producto terminado no puede superar la materia prima.',
      },
    ];
  }

  const cap = columnas.find(ES_CAPACIDAD);
  if (cap && pt && cap.key !== pt.key) {
    return [
      {
        id: nuevoId(),
        aKey: cap.key,
        op: 'mayor_igual',
        tipo: 'columna',
        bKey: pt.key,
        valor: 0,
        mensaje: 'Las libras netas no pueden superar la capacidad de las cajas.',
      },
    ];
  }

  // Sin pistas claras: se deja una regla vacía para que la persona la arme.
  return [
    {
      id: nuevoId(),
      aKey: columnas[0].key,
      op: 'mayor',
      tipo: 'columna',
      bKey: columnas[1].key,
      valor: 0,
      mensaje: '',
    },
  ];
}

/* ── Evaluación ──────────────────────────────────────────────────────────── */

/**
 * Evalúa una regla contra los totales del formulario.
 * @returns {null | {regla, a, b, cumple, mensaje, automatico, signo, operador}}
 */
export function evaluarRegla(columnas, regla) {
  if (!regla || regla.activa === false) return null;

  const a = columnas.find((c) => c.key === regla.aKey);
  if (!a) return null;

  let b;
  if (regla.tipo === 'valor') {
    const valor = Number(regla.valor);
    if (!Number.isFinite(valor)) return null;
    b = { key: '__valor__', tabla: '', columna: 'Valor fijo', total: valor, celdas: 1 };
  } else {
    b = columnas.find((c) => c.key === regla.bKey);
    if (!b) return null;
  }

  const operador = OPERADORES.find((o) => o.id === regla.op) || OPERADORES[0];
  const cumple = (CUMPLE[operador.id] || CUMPLE.mayor)(a.total, b.total);

  const automatico = `${a.columna} (${formatear(a.total)}) ${operador.etiqueta} ${
    regla.tipo === 'valor' ? formatear(b.total) : `${b.columna} (${formatear(b.total)})`
  }.`;

  const mensaje = String(regla.mensaje || '').trim() || automatico;

  return {
    regla,
    a,
    b,
    cumple,
    mensaje,
    automatico,
    signo: operador.signo,
    operador,
  };
}

export function evaluarReglas(columnas, reglas) {
  return (reglas || []).map((r) => evaluarRegla(columnas, r)).filter(Boolean);
}

/** Nombre corto de una columna: "TABLA · Columna". */
export const etiquetaColumna = (c) =>
  c ? `${c.tabla || 'Tabla'} · ${c.columna}` : '';

/* ── Memoria por formulario ──────────────────────────────────────────────── */

const clave = (codigo) => `fishcort_reglas_${String(codigo || 'FORM').toUpperCase()}`;
const claveVieja = (codigo) => `fishcort_comparacion_${String(codigo || 'FORM').toUpperCase()}`;

export function leerReglas(codigo) {
  try {
    const crudo = localStorage.getItem(clave(codigo));
    if (crudo) {
      const guardadas = JSON.parse(crudo);
      if (Array.isArray(guardadas)) return guardadas;
    }

    // Migración: la versión anterior guardaba una sola comparación.
    const vieja = localStorage.getItem(claveVieja(codigo));
    if (vieja) {
      const cfg = JSON.parse(vieja);
      if (cfg?.aKey && cfg?.bKey) {
        return [
          {
            id: nuevoId(),
            aKey: cfg.aKey,
            op: cfg.direccion || 'mayor',
            tipo: 'columna',
            bKey: cfg.bKey,
            valor: 0,
            mensaje: '',
          },
        ];
      }
    }

    // Sin configuración guardada (null = usar las reglas propuestas).
    return null;
  } catch {
    return null;
  }
}

export function guardarReglas(codigo, reglas) {
  try {
    localStorage.setItem(clave(codigo), JSON.stringify(reglas || []));
  } catch {
    // Sin almacenamiento (modo privado): la configuración vale para esta sesión.
  }
}

/**
 * Advertencias que saldrían al guardar este formulario, sin abrir nada.
 * Sirve para decidir si hace falta mostrar la ventana de aviso.
 */
export function advertenciasDe(codigo, bodyData, bodyElements) {
  const columnas = columnasNumericas(bodyData, bodyElements);
  if (columnas.length < 2) return [];

  const guardadas = leerReglas(codigo);
  const reglas = guardadas === null ? reglasPorDefecto(columnas) : guardadas;

  return evaluarReglas(columnas, reglas).filter((r) => !r.cumple);
}
