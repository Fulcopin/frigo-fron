/**
 * combinarFilas.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔁 Repetir en cada fila hija el valor de las columnas «combinadas».
 *
 * En las tablas del formulario hay columnas que se escriben UNA sola vez y
 * bajan combinadas (lote, talla, zona, estación…): el operario pone el valor en
 * la primera fila del grupo y las siguientes quedan cubiertas por la celda
 * combinada. Al guardar, ese dato queda SOLO en la primera fila y las hijas se
 * guardan en blanco; al exportar a Excel (o al reporte ERP) esas filas salen
 * vacías y hay que rellenarlas a mano, fila por fila.
 *
 * Acá se recupera de la PLANTILLA qué columnas son combinadas
 * (`predefinedRows[]._rowSpan`) y se arrastra su valor hacia las filas
 * siguientes. Cuando aparece un valor nuevo (otro lote) el arrastre se
 * reemplaza, así el relleno nunca se sale del grupo.
 *
 * ── Por qué solo se arrastra TEXTO ──────────────────────────────────────────
 * Un valor numérico repetido en las filas hijas se sumaría dos veces en los
 * subtotales, así que las columnas numéricas no se rellenan. Lote, talla y
 * zona son identificadores (texto), que es justo lo que se quiere repetir.
 */

/**
 * Recorre las plantillas y devuelve, por id de plantilla, el conjunto de
 * columnas que la plantilla dibuja combinadas (rowSpan > 1).
 *
 * @param {Array} plantillas   plantillas con `bodyElements` (objeto o JSON).
 * @param {(raw: string) => string} limpiarClave
 *        Normalizador de la clave de columna. Debe ser EL MISMO que usa la
 *        exportación para armar las columnas, para que los nombres coincidan.
 * @returns {Map<string, Set<string>>} id de plantilla → claves combinadas
 */
export function mapaColumnasCombinadas(plantillas, limpiarClave = (k) => String(k ?? '').trim()) {
    const mapa = new Map();

    (plantillas || []).forEach(t => {
        let elementos = t?.bodyElements ?? t?.BodyElements;
        if (typeof elementos === 'string') {
            try { elementos = JSON.parse(elementos); } catch { elementos = null; }
        }
        if (!Array.isArray(elementos)) return;

        const combinadas = new Set();
        elementos.forEach(el => {
            (el?.predefinedRows || []).forEach(preFila => {
                Object.entries(preFila?._rowSpan || {}).forEach(([colKey, span]) => {
                    if (Number(span) > 1) {
                        const clave = limpiarClave(colKey);
                        if (clave) combinadas.add(clave);
                    }
                });
            });
        });

        const id = String(t?.templateID ?? t?.TemplateID ?? '');
        if (id && combinadas.size > 0) mapa.set(id, combinadas);
    });

    return mapa;
}

/** Por defecto: un valor es número si `Number()` lo acepta (4714-26 y 41-50 no). */
const esNumeroBasico = (valor) => {
    const texto = String(valor ?? '').trim();
    if (texto === '') return false;
    return Number.isFinite(Number(texto.replace(',', '.')));
};

/**
 * ¿La fila trae algún dato propio? Los renglones en blanco de la plantilla
 * viajan con el encabezado (fecha, plantilla, lote del título) y con ceros de
 * fórmula (% RENDIMIENTO, TOTAL…). Si solo tiene eso, es un renglón vacío: no
 * hay que escribirle el lote encima, quedaría como una fila de datos falsa.
 */
const tieneDatosPropios = (fila, combinadas, clavesContexto) => {
    const ctxKeys = fila.__ctxKeys;   // el reporte ERP marca ahí las claves del encabezado
    return Object.entries(fila).some(([clave, valor]) => {
        if (clave.startsWith('_')) return false;                 // __formId, __ctxKeys, _deleted
        if (combinadas.has(clave)) return false;                 // la columna que se está rellenando
        if (ctxKeys && ctxKeys.has(clave)) return false;         // dato del encabezado
        if (clavesContexto && clavesContexto.has(clave)) return false;
        if (valor === undefined || valor === null) return false;
        const texto = String(valor).trim();
        if (texto === '') return false;
        const n = Number(texto.replace(',', '.'));
        if (Number.isFinite(n) && n === 0) return false;         // el 0 de fórmula no es dato
        return true;
    });
};

/**
 * Arrastra el último valor de las columnas combinadas hacia las filas que
 * quedaron en blanco. Modifica `filas` en el rango [desde, hasta).
 *
 * @param {Array<Object>} filas        filas del reporte (se modifican in situ).
 * @param {number} desde               primera fila del formulario/bloque.
 * @param {number} hasta               posición siguiente a la última fila.
 * @param {Set<string>} combinadas     columnas a repetir.
 * @param {Object} [opciones]
 * @param {(v: any) => boolean} [opciones.esNumero]
 *        Detecta valores que NO deben repetirse (se sumarían dos veces).
 * @param {Set<string>} [opciones.clavesContexto]
 *        Claves que vienen del encabezado y no cuentan como dato de la fila.
 */
export function rellenarCombinadas(filas, desde, hasta, combinadas, opciones = {}) {
    if (!combinadas || combinadas.size === 0 || hasta <= desde) return;
    if (!Array.isArray(filas)) return;

    const esNumero = opciones.esNumero || esNumeroBasico;
    const clavesContexto = opciones.clavesContexto || null;

    const arrastre = new Map();
    for (let i = Math.max(0, desde); i < hasta && i < filas.length; i++) {
        const fila = filas[i];
        if (!fila || typeof fila !== 'object') continue;

        // Renglón en blanco de la plantilla: no se toca.
        if (!tieneDatosPropios(fila, combinadas, clavesContexto)) continue;

        combinadas.forEach(col => {
            const valor = fila[col];
            const vacio = valor === undefined || valor === null || String(valor).trim() === '';

            if (!vacio) {
                // Valor nuevo: manda (y corta el arrastre anterior si es número).
                if (esNumero(valor)) arrastre.delete(col);
                else arrastre.set(col, valor);
                return;
            }

            if (arrastre.has(col)) fila[col] = arrastre.get(col);
        });
    }
}
