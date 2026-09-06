/**
 * Empareja cada elemento de la plantilla con sus datos guardados.
 *
 * El cuerpo de un formulario se guarda como una lista paralela a
 * `template.bodyElements`: la posición 2 de `bodyData` son los datos del cuadro
 * que está en la posición 2 de la plantilla, y cada entrada lleva además el `id`
 * del elemento.
 *
 * Esa doble referencia (posición + id) se rompe cuando alguien reordena los
 * cuadros en Editar Plantilla mientras hay pestañas abiertas: lo escrito se
 * queda en la posición vieja pero se sigue guardando con el id de esa posición,
 * así que id y contenido dejan de corresponder. La vista y el PDF, que buscaban
 * por id, terminaban leyendo el cuadro equivocado y lo pintaban vacío, mientras
 * que Editar, que busca por posición, mostraba los datos correctos.
 *
 * Aquí se decide con el propio contenido: si lo que trae la entrada elegida no
 * tiene nada que ver con las columnas del cuadro, se busca la entrada que sí
 * encaja. Ningún dato se reescribe: sólo se elige de dónde leerlo.
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

/** Nombres de columna (o de campo, si es sección) que admite un elemento. */
const clavesDelElemento = (el) => {
  const set = new Set();
  const agregar = (v) => { const n = norm(v); if (n) set.add(n); };
  (Array.isArray(el?.columns) ? el.columns : []).forEach(c => {
    agregar(c?.label); agregar(c?.header); agregar(c?.name); agregar(c?.id);
  });
  (Array.isArray(el?.fields) ? el.fields : []).forEach(f => {
    agregar(f?.label); agregar(f?.name); agregar(f?.id);
  });
  return set;
};

/** Nombres de columna que traen algo escrito en una entrada guardada. */
const clavesConValor = (dato) => {
  const set = new Set();
  const recorrer = (obj) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    Object.entries(obj).forEach(([k, v]) => {
      if (String(k).startsWith('_')) return;
      if (v === '' || v === null || v === undefined) return;
      if (typeof v === 'object') return;
      const n = norm(k);
      if (n) set.add(n);
    });
  };
  const cuerpo = dato?.rows ?? dato?.data ?? dato;
  if (Array.isArray(cuerpo)) cuerpo.forEach(recorrer);
  else recorrer(cuerpo);
  return set;
};

/**
 * @returns {{aciertos:number, fallos:number}} claves escritas que corresponden
 * (o no) a las columnas del elemento.
 */
const puntaje = (el, dato) => {
  const columnas = clavesDelElemento(el);
  if (!columnas.size) return { aciertos: 0, fallos: 0 };
  let aciertos = 0, fallos = 0;
  clavesConValor(dato).forEach(k => { if (columnas.has(k)) aciertos++; else fallos++; });
  return { aciertos, fallos };
};

/** Un candidato sirve si trae datos de este cuadro, o si no trae nada. */
const encaja = (el, dato) => {
  const { aciertos, fallos } = puntaje(el, dato);
  return aciertos > 0 || fallos === 0;
};

const mismoId = (dato, el) => dato && el && el.id !== undefined && el.id !== null &&
  (dato.id === el.id || String(dato.id) === String(el.id));

/**
 * Devuelve los datos guardados en el mismo orden que `bodyElements`, para poder
 * leerlos por posición. Una entrada por elemento (`null` si no hay datos); nunca
 * se reparte la misma entrada entre dos cuadros.
 *
 * @param {Array} bodyElements elementos de la plantilla actual
 * @param {Array} guardados    bodyData tal como vino del servidor
 * @returns {Array} alineado a `bodyElements`
 */
export function alinearBodyData(bodyElements, guardados) {
  const els = Array.isArray(bodyElements) ? bodyElements : [];
  const datos = Array.isArray(guardados) ? guardados : [];
  if (!els.length) return datos;

  const resultado = new Array(els.length).fill(null);
  const usados = new Set();

  const tomar = (i, dato) => {
    if (!dato || usados.has(dato)) return false;
    resultado[i] = dato;
    usados.add(dato);
    return true;
  };

  // 1) Lo de siempre: por id, y si no hay id, por posición. Sólo se acepta si el
  //    contenido corresponde al cuadro.
  const pendientes = [];
  els.forEach((el, i) => {
    if (!el) return;
    const porId = datos.find(d => mismoId(d, el));
    const preferido = porId !== undefined ? porId : (datos[i] ?? null);
    if (preferido && encaja(el, preferido) && tomar(i, preferido)) return;
    pendientes.push({ el, i, preferido });
  });

  // 2) Los que quedaron descolgados se emparejan por contenido.
  pendientes.forEach(({ el, i }) => {
    let mejor = null, mejorAciertos = 0;
    datos.forEach(cand => {
      if (!cand || usados.has(cand)) return;
      const { aciertos } = puntaje(el, cand);
      if (aciertos > mejorAciertos) { mejor = cand; mejorAciertos = aciertos; }
    });
    tomar(i, mejor);
  });

  // 3) Si aun así no hubo con qué, se deja el candidato original: es mejor
  //    mostrar lo de siempre que dejar el cuadro en blanco.
  pendientes.forEach(({ i, preferido }) => {
    if (resultado[i] === null) tomar(i, preferido);
  });

  // 4) Lo que sobra (un cuadro que ya no existe en la plantilla) se conserva al
  //    final: quien lee recorre la plantilla y lo ignora, pero si el formulario
  //    se vuelve a guardar desde Editar no se pierde.
  const sobrantes = datos.filter(d => d && !usados.has(d));

  return sobrantes.length ? [...resultado, ...sobrantes] : resultado;
}

/** Igual que `alinearBodyData` pero para un solo elemento. */
export function datosDeElemento(bodyElements, guardados, indice) {
  return alinearBodyData(bodyElements, guardados)[indice] ?? null;
}
