/**
 * Columnas con las que hay que dibujar un cuadro ya guardado.
 *
 * Un formulario guardado es un documento cerrado: sus filas quedaron con los
 * nombres de columna que tenia la plantilla el dia que se lleno. Cuando despues
 * se renombra una columna en Editar Plantilla, esas filas dejan de coincidir con
 * la definicion nueva y el cuadro sale en blanco en Ver, en el PDF y en el
 * Excel, aunque el dato siga guardado.
 *
 * Aca se decide con el contenido: las columnas de la plantilla que el
 * formulario reconoce se muestran como siempre, y las que traen dato pero ya no
 * existen en la plantilla se recuperan con el nombre con el que se guardaron.
 * No se renombra ni se adivina nada: se muestra lo que el operario escribio.
 */

const norm = (s) => {
  const crudo = String(s ?? '').trim().toUpperCase();
  const limpio = crudo
    .normalize('NFD')
    .replace(/_COL\d+$/i, '')
    .replace(/[^A-Z0-9]/g, '');
  // Hay columnas que son puro simbolo ("%", "N°"): si al limpiar no queda nada,
  // se compara el texto tal cual, o dos columnas distintas serian la misma.
  return limpio || crudo;
};

const esClaveInterna = (k) => String(k).startsWith('_');

/** Nombres que admite una columna de la plantilla. */
const alias = (col) => [col?.label, col?.header, col?.name, col?.id]
  .map(norm).filter(Boolean);

/**
 * @param {object} el   elemento (tabla) de la plantilla
 * @param {Array}  filas filas guardadas de ese cuadro
 * @returns {{columnas: Array, recuperadas: Array}} `columnas` son las de la
 * plantilla mas las recuperadas; `recuperadas` van marcadas con `_recuperada`.
 */
export function columnasDelCuadro(el, filas) {
  const deLaPlantilla = Array.isArray(el?.columns) ? el.columns : [];
  const filasArr = Array.isArray(filas) ? filas : [];
  if (!filasArr.length) return { columnas: deLaPlantilla, recuperadas: [] };

  // Claves que traen algo escrito, en el orden en que se guardaron: ese es el
  // orden que tenian las columnas en la plantilla de entonces.
  const conDato = [];
  const vistas = new Set();
  filasArr.forEach(fila => {
    if (!fila || typeof fila !== 'object') return;
    Object.entries(fila).forEach(([k, v]) => {
      if (esClaveInterna(k) || v === '' || v === null || v === undefined) return;
      if (typeof v === 'object') return;
      if (vistas.has(k)) return;
      vistas.add(k);
      conDato.push(k);
    });
  });
  if (!conDato.length) return { columnas: deLaPlantilla, recuperadas: [] };

  const nombresPlantilla = new Set(deLaPlantilla.flatMap(alias));
  const reconocidas = conDato.filter(k => nombresPlantilla.has(norm(k)));
  const huerfanas = conDato.filter(k => !nombresPlantilla.has(norm(k)));

  if (!huerfanas.length) return { columnas: deLaPlantilla, recuperadas: [] };

  const recuperadas = huerfanas.map((clave, i) => ({
    label: clave,
    name: clave,
    // Indice imposible de confundir con el de una columna real: la busqueda por
    // sufijo `_colN` no lo puede pescar por accidente.
    originalIndex: -1 - i,
    _recuperada: true,
  }));

  // Si el cuadro no reconoce NINGUNA de sus columnas actuales, es de otra epoca
  // entera: se dibuja como se lleno, y no con las columnas de hoy vacias al lado.
  const columnas = reconocidas.length === 0
    ? recuperadas
    : [...deLaPlantilla, ...recuperadas];

  return { columnas, recuperadas };
}

/** Solo las columnas, para los sitios que no necesitan saber cuales se recuperaron. */
export const columnasParaDibujar = (el, filas) => columnasDelCuadro(el, filas).columnas;
