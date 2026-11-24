/**
 * 🏷️ Nombres de columna: la plantilla vs lo que quedó guardado.
 *
 * Las tablas guardan cada celda con la clave = el nombre que la columna tenía
 * EN ESE MOMENTO. Si después alguien renombra la columna en la plantilla
 * —"PERSONAL EVENTUAL" → "PERSONAL EXTERNO (CUADRILLA/EVENTUAL)"— los datos
 * viejos quedan con la llave anterior. La vista, el PDF y los reportes buscan
 * por el nombre NUEVO, no encuentran nada y muestran la celda vacía, aunque el
 * dato esté perfectamente guardado.
 *
 * Estas funciones permiten reconocer que dos nombres son la misma columna y
 * reetiquetar las filas antes de dibujarlas. Son conservadoras a propósito:
 * si hay más de un candidato posible, no se toca nada.
 */

// Palabras que no distinguen una columna de otra.
const PALABRAS_IGNORADAS = new Set([
    'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'EN', 'Y', 'A', 'POR', 'PARA',
    'N', 'NO', 'NUM', 'NRO', 'DATOS',
]);

/** Palabras significativas de un nombre de columna, sin tildes ni símbolos. */
export const palabrasDeColumna = (nombre) => String(nombre ?? '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter(w => w && !PALABRAS_IGNORADAS.has(w));

/**
 * ¿Dos nombres son la misma columna escrita distinto?
 * Ej.: "PERSONAL EVENTUAL" ≈ "PERSONAL EXTERNO (CUADRILLA/EVENTUAL)".
 */
export const mismoNombreDeColumna = (a, b) => {
    if (!a || !b) return false;
    if (a === b) return true;
    const pa = palabrasDeColumna(a);
    const pb = palabrasDeColumna(b);
    if (pa.length === 0 || pb.length === 0) return false;

    const corto = pa.length <= pb.length ? pa : pb;
    const largo = pa.length <= pb.length ? pb : pa;

    // Una sola palabra ("CANTIDAD", "PESO", "TOTAL") es demasiado genérica:
    // se repite en varias secciones y unirlas mezclaría tablas distintas.
    if (corto.length < 2) return false;

    const comunes = corto.filter(w => largo.includes(w)).length;
    if (comunes / corto.length < 0.75) return false;

    // El nombre largo no puede tener demasiadas palabras de más.
    return largo.length <= corto.length + 4;
};

/** Claves de la fila que NO son columnas de la plantilla. */
const esClaveInterna = (k) => typeof k !== 'string' || k.startsWith('_') || k.startsWith('$');

/** Nombre reducido a sus palabras: "Lote  " y "LOTE" quedan iguales. */
const simplificado = (s) => palabrasDeColumna(s).join(' ');

/**
 * Devuelve la llave de la fila que corresponde a una etiqueta de la plantilla.
 * 1) la etiqueta exacta; 2) la misma escrita igual salvo espacios/tildes
 * ("LOTE " vs "LOTE"); 3) la única con nombre parecido.
 * @returns {string|null}
 */
export const claveDeColumna = (fila, etiqueta, etiquetasConocidas = []) => {
    if (!fila || typeof fila !== 'object' || !etiqueta) return null;
    if (fila[etiqueta] !== undefined) return etiqueta;

    const otras = new Set(etiquetasConocidas.map(String));
    const clavesUtiles = Object.keys(fila).filter(k => !esClaveInterna(k) && !otras.has(k));

    // 2) Mismo nombre salvo espacios de más, mayúsculas o tildes.
    const objetivo = simplificado(etiqueta);
    if (objetivo) {
        const iguales = clavesUtiles.filter(k => simplificado(k) === objetivo);
        if (iguales.length === 1) return iguales[0];
    }

    // 3) Única con nombre parecido (columna renombrada).
    const candidatas = clavesUtiles.filter(k => mismoNombreDeColumna(k, etiqueta));
    return candidatas.length === 1 ? candidatas[0] : null;
};

/** Etiqueta visible de una columna de tabla de la plantilla. */
export const etiquetaDeColumna = (col, ci = 0) =>
    col?.label || col?.header || col?.name || col?.id || `col_${ci}`;

/**
 * Deja que `objeto[nombreNuevo]` devuelva y escriba el valor de `nombreViejo`,
 * SIN agregar una propiedad más al objeto.
 *
 * Por qué no es un simple `objeto[nuevo] = valor`: al guardar, el cuerpo se
 * serializa con JSON.stringify y el backend compara celda por celda contra lo
 * que había. Una llave nueva con el valor repetido aparecía como un cambio
 * "antes: (vacío)" en TODAS las celdas —el historial decía "este reporte fue
 * modificado — 211 valores" sobre un formulario que nadie tocó—. Con una
 * propiedad no enumerable el alias se lee y se escribe, pero no viaja al
 * guardado, así que el historial sigue comparando las llaves de siempre.
 */
export const aliasNoEnumerable = (objeto, nombreNuevo, nombreViejo) => {
    try {
        Object.defineProperty(objeto, nombreNuevo, {
            enumerable: false,
            configurable: true,
            get() { return this[nombreViejo]; },
            set(v) { this[nombreViejo] = v; },
        });
    } catch {
        // Objeto congelado o nombre no válido: se agrega normal y listo.
        objeto[nombreNuevo] = objeto[nombreViejo];
    }
};

/**
 * Reetiqueta las llaves de las tablas para que usen el nombre ACTUAL de la
 * plantilla. Agrega la llave nueva sin borrar la vieja: lo que ya leía por el
 * nombre viejo sigue funcionando.
 *
 * @param {Array} bodyData      bloques del bodyData [{id,type,data|rows}]
 * @param {Array} bodyElements  elementos de la plantilla
 * @returns {{ bodyData: Array, cambios: Array<{de: string, a: string}> }}
 */
export const alinearClavesConPlantilla = (bodyData, bodyElements) => {
    const cambios = [];
    if (!Array.isArray(bodyData) || !Array.isArray(bodyElements) || bodyElements.length === 0) {
        return { bodyData, cambios };
    }

    const porId = new Map();
    bodyElements.forEach(el => { if (el?.id != null) porId.set(String(el.id), el); });

    const nuevo = bodyData.map((bloque, posicion) => {
        if (!bloque || typeof bloque !== 'object') return bloque;
        const filas = Array.isArray(bloque.rows) ? bloque.rows
            : Array.isArray(bloque.data) ? bloque.data : null;
        if (!filas || filas.length === 0) return bloque;

        const elemento = (bloque.id != null && porId.get(String(bloque.id)))
            || (bloque.id == null ? bodyElements[posicion] : null);
        const columnas = Array.isArray(elemento?.columns) ? elemento.columns : null;
        if (!columnas || columnas.length === 0) return bloque;

        const etiquetas = columnas.map((c, ci) => String(etiquetaDeColumna(c, ci)));
        let tocado = false;

        const nuevasFilas = filas.map(fila => {
            if (!fila || typeof fila !== 'object') return fila;
            let copia = null;
            etiquetas.forEach(etiqueta => {
                if (fila[etiqueta] !== undefined) return;           // ya coincide
                const clave = claveDeColumna(fila, etiqueta, etiquetas);
                if (!clave) return;                                 // ambiguo: no se toca
                if (fila[clave] === undefined) return;
                copia = copia || { ...fila };
                // Alias, no copia: se lee y se escribe, pero no se guarda.
                aliasNoEnumerable(copia, etiqueta, clave);
                if (!cambios.some(c => c.de === clave && c.a === etiqueta)) {
                    cambios.push({ de: clave, a: etiqueta });
                }
            });
            if (copia) tocado = true;
            return copia || fila;
        });

        if (!tocado) return bloque;
        const copiaBloque = { ...bloque };
        if (Array.isArray(bloque.rows)) copiaBloque.rows = nuevasFilas;
        if (Array.isArray(bloque.data)) copiaBloque.data = nuevasFilas;
        return copiaBloque;
    });

    if (cambios.length > 0) {
        console.warn('🔗 Columnas con nombre viejo realineadas con la plantilla:',
            cambios.map(c => `${c.de} → ${c.a}`).join('  |  '));
    }

    return { bodyData: nuevo, cambios };
};
