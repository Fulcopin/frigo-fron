/**
 * aplanarRegistros.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 📊 Convierte los formularios dinámicos en una tabla lista para Excel.
 *
 * Resuelve los dos problemas de la exportación actual:
 *
 * 1. EXPLOSIÓN DE COLUMNAS. Las columnas NO se deducen de los datos ni se
 *    acumulan entre consultas: salen SIEMPRE del esquema del formulario
 *    seleccionado. Cambiar de formulario o de filtro produce un conjunto nuevo
 *    y completo, sin restos de la consulta anterior. Un dato que llega y no
 *    está en el esquema no inventa columna: queda en `huerfanos` para revisarlo.
 *
 * 2. CLAVES REPETIDAS. "Código" existe en el registro, en el insumo y en el
 *    proveedor. Cada columna se identifica por una clave con prefijo de su
 *    origen (`insumo.codigo`, `header.codigo`), única y estable; la etiqueta
 *    que ve el usuario se desambigua sola ("Código Insumos", "Código Registro")
 *    solo cuando hace falta.
 *
 * Los tipos van como JSDoc: el editor avisa igual que con TypeScript, pero el
 * archivo es JavaScript como el resto del proyecto.
 */

/**
 * @typedef {'header'|'tabla'|'firma'|'meta'} OrigenCampo
 *   De dónde sale el campo. Define el prefijo y el grupo en el Excel.
 *
 * @typedef {Object} CampoEsquema
 * @property {string}  clave          Identificador dentro de su bloque, tal como viene en los datos.
 * @property {string}  [etiqueta]     Lo que lee el usuario. Si falta, se usa la clave.
 * @property {'texto'|'numero'|'fecha'|'hora'|'booleano'} [tipo]
 * @property {boolean} [obligatorio]  No se puede guardar vacío (ver validarObligatorios).
 *
 * @typedef {Object} BloqueEsquema
 * @property {string} id       Único dentro del formulario: 'header', 'produccion', 'insumo'…
 * @property {string} titulo
 * @property {OrigenCampo} origen
 * @property {CampoEsquema[]} campos
 *
 * @typedef {Object} EsquemaFormulario
 * @property {string|number} formularioId
 * @property {string} codigo
 * @property {string} nombre
 * @property {BloqueEsquema[]} bloques
 *
 * @typedef {Object<string, unknown>} FilaTabla  Una fila de tabla: columna → valor.
 *
 * @typedef {Object} RegistroFormulario
 * @property {number} id
 * @property {string|number} formularioId
 * @property {Object<string, unknown>} [header]  Campos del encabezado (fecha, turno, especie…).
 * @property {Object<string, FilaTabla[]>} [tablas]  Filas por bloque: { produccion: [...], insumo: [...] }.
 * @property {Object<string, unknown>} [firmas]
 * @property {Object<string, unknown>} [meta]    N° de registro, código del formato, fecha de guardado…
 *
 * @typedef {Object} ColumnaSalida
 * @property {string} clave         Única y estable: 'insumo.codigo'. Es la clave de cada celda.
 * @property {string} etiqueta      Encabezado visible, ya desambiguado.
 * @property {string} bloqueId
 * @property {string} bloqueTitulo
 * @property {OrigenCampo} origen
 *
 * @typedef {Object<string, (string|number|null)>} FilaSalida
 *
 * @typedef {Object} TablaSalida
 * @property {ColumnaSalida[]} columnas
 * @property {FilaSalida[]} filas
 * @property {string[]} huerfanos   Datos que llegaron pero no están en el esquema.
 * @property {string[]} vacias      Columnas sin un solo valor en el rango consultado.
 *
 * @typedef {Object} OpcionesAplanado
 * @property {'una-fila-por-registro'|'por-bloque'|'emparejado'} [modo]
 *   'una-fila-por-registro': una línea por formulario; de cada tabla se toma la
 *     primera fila (útil para totales y tableros).
 *   'por-bloque': una línea por fila de tabla, SIN emparejar bloques entre sí.
 *   'emparejado': el modo clásico, fila i de cada tabla en la misma línea; deja
 *     huecos cuando las tablas tienen distinto largo.
 * @property {boolean} [quitarVacias]  Quitar las columnas sin ningún valor.
 * @property {boolean} [marcarBloque]  Agrega `__bloque` a cada fila (lo usa el Excel por secciones).
 */

const SEPARADOR = '.';

/** Clave reservada: no es una columna, es la marca del bloque de origen. */
export const CLAVE_BLOQUE = '__bloque';

/**
 * Texto comparable: sin tildes, sin signos, en minúsculas.
 * @param {unknown} v
 * @returns {string}
 */
export const normalizar = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Clave única de una columna: 'insumo.codigo'.
 * @param {string} bloqueId
 * @param {string} campo
 * @returns {string}
 */
export const claveDe = (bloqueId, campo) =>
  `${normalizar(bloqueId).replace(/\s+/g, '_')}${SEPARADOR}${normalizar(campo).replace(/\s+/g, '_')}`;

/** null, undefined y '' son vacío; 0 y false NO lo son. */
const esVacio = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/**
 * Valor de celda: siempre texto, número o null. Nunca un objeto, que es lo que
 * rompía el Excel con "[object Object]".
 * @param {unknown} v
 * @returns {string|number|null}
 */
export function valorCelda(v) {
  if (esVacio(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);

  if (Array.isArray(v)) {
    const partes = v.map(valorCelda).filter((x) => x !== null);
    return partes.length ? partes.join(', ') : null;
  }

  if (typeof v === 'object') {
    // Caso real: las celdas de "detalle en ventana" guardan { texto, filas }.
    for (const k of ['texto', 'valor', 'nombre', 'label']) {
      if (!esVacio(v[k])) return valorCelda(v[k]);
    }
    return null;
  }

  const t = String(v).trim();
  return t === '' ? null : t;
}

/**
 * Busca el valor de un campo dentro de un objeto, tolerando diferencias de
 * mayúsculas, tildes y los sufijos "_colN" que agrega el formulario cuando hay
 * columnas repetidas.
 * @param {Object<string, unknown>|undefined} datos
 * @param {string} clave
 */
function buscarValor(datos, clave) {
  if (!datos) return undefined;
  if (clave in datos) return datos[clave];

  const buscada = normalizar(clave);
  for (const [k, v] of Object.entries(datos)) {
    if (normalizar(k.replace(/_col\d+$/i, '')) === buscada) return v;
  }
  return undefined;
}

/**
 * Columnas del formulario seleccionado.
 *
 * Es una función pura: mismas entradas, mismas columnas. No lee estado previo
 * ni los datos, que es justamente lo que producía las 400 columnas.
 *
 * Las etiquetas repetidas se desambiguan con el título del bloque: "Código" en
 * dos bloques pasa a ser "Código Registro" y "Código Insumos".
 *
 * @param {EsquemaFormulario} esquema
 * @returns {ColumnaSalida[]}
 */
export function columnasDelEsquema(esquema) {
  const repetidas = new Map();
  for (const bloque of esquema.bloques) {
    for (const campo of bloque.campos) {
      const etq = normalizar(campo.etiqueta ?? campo.clave);
      repetidas.set(etq, (repetidas.get(etq) ?? 0) + 1);
    }
  }

  const vistas = new Set();
  /** @type {ColumnaSalida[]} */
  const columnas = [];

  for (const bloque of esquema.bloques) {
    for (const campo of bloque.campos) {
      const clave = claveDe(bloque.id, campo.clave);
      if (vistas.has(clave)) continue;   // el mismo campo dos veces en un bloque
      vistas.add(clave);

      const base = String(campo.etiqueta ?? campo.clave).trim();
      const ambigua = (repetidas.get(normalizar(base)) ?? 0) > 1;

      columnas.push({
        clave,
        etiqueta: ambigua ? `${base} ${bloque.titulo}`.trim() : base,
        bloqueId: bloque.id,
        bloqueTitulo: bloque.titulo,
        origen: bloque.origen,
      });
    }
  }
  return columnas;
}

/**
 * Convierte los registros en filas de Excel según el esquema.
 *
 * @param {EsquemaFormulario} esquema     el formulario seleccionado; manda sobre los datos
 * @param {RegistroFormulario[]} registros registros ya filtrados por fecha/turno
 * @param {OpcionesAplanado} [opciones]
 * @returns {TablaSalida}
 */
export function aplanarRegistros(esquema, registros, opciones = {}) {
  const { modo = 'por-bloque', quitarVacias = true, marcarBloque = false } = opciones;

  const columnas = columnasDelEsquema(esquema);
  const huerfanos = new Set();
  /** @type {FilaSalida[]} */
  const filas = [];

  /** Datos que se repiten en cada línea: encabezado, firmas y metadatos. */
  const generalesDe = (registro) => {
    /** @type {FilaSalida} */
    const fila = {};
    for (const bloque of esquema.bloques) {
      if (bloque.origen === 'tabla') continue;
      const fuente = bloque.origen === 'header' ? registro.header
        : bloque.origen === 'firma' ? registro.firmas
        : registro.meta;
      for (const campo of bloque.campos) {
        fila[claveDe(bloque.id, campo.clave)] = valorCelda(buscarValor(fuente, campo.clave));
      }
    }
    return fila;
  };

  const volcarTabla = (bloque, filaTabla, destino) => {
    let aporto = false;
    const conocidas = new Set(bloque.campos.map((c) => normalizar(c.clave)));

    for (const campo of bloque.campos) {
      const valor = valorCelda(buscarValor(filaTabla, campo.clave));
      destino[claveDe(bloque.id, campo.clave)] = valor;
      if (valor !== null) aporto = true;
    }
    // Lo que llegó y no está en el esquema NO crea columna: solo se anota.
    for (const k of Object.keys(filaTabla)) {
      if (!conocidas.has(normalizar(k.replace(/_col\d+$/i, '')))) huerfanos.add(`${bloque.id}.${k}`);
    }
    return aporto;
  };

  for (const registro of registros) {
    // Aislamiento estricto: un registro de otro formulario no aporta nada.
    if (String(registro.formularioId) !== String(esquema.formularioId)) continue;

    const generales = generalesDe(registro);
    const tablas = esquema.bloques.filter((b) => b.origen === 'tabla');

    if (tablas.length === 0 || modo === 'una-fila-por-registro') {
      const fila = { ...generales };
      for (const bloque of tablas) {
        const primera = registro.tablas?.[bloque.id]?.[0];
        if (primera) volcarTabla(bloque, primera, fila);
        else for (const c of bloque.campos) fila[claveDe(bloque.id, c.clave)] = null;
      }
      filas.push(fila);
      continue;
    }

    if (modo === 'emparejado') {
      const largo = Math.max(...tablas.map((b) => registro.tablas?.[b.id]?.length ?? 0), 0);
      for (let i = 0; i < largo; i++) {
        const fila = { ...generales };
        let aporto = false;
        for (const bloque of tablas) {
          const filaTabla = registro.tablas?.[bloque.id]?.[i];
          if (filaTabla) aporto = volcarTabla(bloque, filaTabla, fila) || aporto;
          else for (const c of bloque.campos) fila[claveDe(bloque.id, c.clave)] = null;
        }
        if (aporto) filas.push(fila);
      }
      continue;
    }

    // 'por-bloque': cada tabla aporta sus propias líneas, sin emparejar.
    for (const bloque of tablas) {
      for (const filaTabla of registro.tablas?.[bloque.id] ?? []) {
        const fila = { ...generales };
        for (const otro of tablas) {
          if (otro.id === bloque.id) continue;
          for (const c of otro.campos) fila[claveDe(otro.id, c.clave)] = null;
        }
        if (volcarTabla(bloque, filaTabla, fila)) {
          if (marcarBloque) fila[CLAVE_BLOQUE] = bloque.id;
          filas.push(fila);
        }
      }
    }
  }

  const vacias = columnas
    .filter((c) => filas.every((f) => f[c.clave] === null || f[c.clave] === undefined))
    .map((c) => c.clave);

  const finales = quitarVacias ? columnas.filter((c) => !vacias.includes(c.clave)) : columnas;

  // Cada fila trae exactamente las columnas finales: sin claves de más.
  const filasLimpias = filas.map((f) => {
    /** @type {FilaSalida} */
    const fila = {};
    for (const c of finales) fila[c.clave] = f[c.clave] ?? null;
    if (marcarBloque && f[CLAVE_BLOQUE] !== undefined) fila[CLAVE_BLOQUE] = f[CLAVE_BLOQUE];
    return fila;
  });

  return { columnas: finales, filas: filasLimpias, huerfanos: [...huerfanos].sort(), vacias };
}

/**
 * @typedef {Object} ErrorValidacion
 * @property {string} bloqueId
 * @property {string} bloqueTitulo
 * @property {string} campo
 * @property {number} [fila]
 * @property {string} mensaje
 */

/**
 * Valida los campos marcados como obligatorios en el esquema, antes de guardar.
 *
 * Se valida contra el ESQUEMA y no contra la pantalla: así la misma regla vale
 * para el formulario, la edición y cualquier carga automática.
 *
 * @param {EsquemaFormulario} esquema
 * @param {RegistroFormulario} registro
 * @returns {ErrorValidacion[]}
 */
export function validarObligatorios(esquema, registro) {
  /** @type {ErrorValidacion[]} */
  const errores = [];

  for (const bloque of esquema.bloques) {
    const obligatorios = bloque.campos.filter((c) => c.obligatorio);
    if (obligatorios.length === 0) continue;

    if (bloque.origen === 'tabla') {
      const filas = registro.tablas?.[bloque.id] ?? [];
      filas.forEach((fila, i) => {
        for (const campo of obligatorios) {
          if (esVacio(buscarValor(fila, campo.clave))) {
            errores.push({
              bloqueId: bloque.id,
              bloqueTitulo: bloque.titulo,
              campo: campo.etiqueta ?? campo.clave,
              fila: i + 1,
              mensaje: `Falta «${campo.etiqueta ?? campo.clave}» en ${bloque.titulo}, fila ${i + 1}.`,
            });
          }
        }
      });
      continue;
    }

    const fuente = bloque.origen === 'header' ? registro.header
      : bloque.origen === 'firma' ? registro.firmas
      : registro.meta;

    for (const campo of obligatorios) {
      if (esVacio(buscarValor(fuente, campo.clave))) {
        errores.push({
          bloqueId: bloque.id,
          bloqueTitulo: bloque.titulo,
          campo: campo.etiqueta ?? campo.clave,
          mensaje: `Falta «${campo.etiqueta ?? campo.clave}» en ${bloque.titulo}.`,
        });
      }
    }
  }

  return errores;
}
