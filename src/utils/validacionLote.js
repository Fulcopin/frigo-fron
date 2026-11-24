/**
 * validacionLote.js
 * ─────────────────────────────────────────────────────────────────────────────
 * VALIDACIÓN DEL NÚMERO DE LOTE.
 *
 * Por defecto un lote de proceso se acepta LIBRE: letras y números hasta el
 * largo configurado (40 por defecto). Antes solo se admitían SEIS dígitos
 * (año-mes-día: 260531) y eso bloqueaba a las plantas que numeran distinto.
 *
 * El formato "fecha" de seis dígitos sigue disponible por campo: la plantilla
 * declara `loteFormato: 'fecha'` y ahí vuelve el candado que evita los lotes con
 * un dígito de más — "2605318" en vez de "260531" —, que no cruzan con nada: no
 * aparecen en los desplegables de los otros formularios ni se les puede
 * descontar inventario.
 *
 * Los lotes hijos llevan sufijo ("260531-P01", "260531-PT-TNA-1000"): eso es
 * válido, lo que se controla es el número de la izquierda.
 *
 * El servidor guarda el número en nvarchar(100), así que el límite es del front.
 */

/** Cuántos dígitos tiene que tener el número de lote en el formato "fecha". */
export const DIGITOS_LOTE = 6;

/** Largo máximo cuando el lote es libre (letras y números). */
export const LOTE_LIBRE_MAX = 40;

/** Regla por defecto: libre alfanumérico, que es lo que usan casi todos los FOR. */
export const REGLA_LOTE_POR_DEFECTO = { soloDigitos: false, largo: LOTE_LIBRE_MAX };

/**
 * Lee la regla declarada en la plantilla para un campo del encabezado.
 *
 * Sin configuración devuelve el formato LIBRE. Una plantilla puede pedir el
 * candado de seis dígitos con `loteFormato: 'fecha'`.
 *
 * @param {Object} [campo] campo del encabezado (`headerFields`)
 * @returns {{soloDigitos: boolean, largo: number}}
 */
export function reglaLoteDeCampo(campo) {
  const esFecha = campo?.loteFormato === 'fecha';
  const pedido = Number(campo?.loteLargoMax);
  const porDefecto = esFecha ? DIGITOS_LOTE : LOTE_LIBRE_MAX;
  const largo = Number.isFinite(pedido) && pedido > 0
    ? Math.min(120, Math.trunc(pedido))
    : porDefecto;
  return { soloDigitos: esFecha, largo };
}

/**
 * Limpia lo que se está escribiendo en el cuadro del lote.
 * - Siempre saca espacios y comas (la coma separa lotes en el encabezado).
 * - En formato "fecha" saca además todo lo que no sea dígito.
 *
 * @param {string} valor
 * @param {{soloDigitos?: boolean, largo?: number}} [regla]
 */
export function limpiarNumeroLote(valor, regla = REGLA_LOTE_POR_DEFECTO) {
  const { soloDigitos = false, largo = LOTE_LIBRE_MAX } = regla || {};
  const sinSeparadores = String(valor ?? '').replace(/[\s,;]+/g, '');
  const limpio = soloDigitos ? sinSeparadores.replace(/\D+/g, '') : sinSeparadores;
  return limpio.slice(0, largo);
}

/**
 * Revisa un número de lote escrito a mano.
 *
 * @param {string} valor
 * @param {{soloDigitos?: boolean, largo?: number}} [regla]
 * @returns {{valido: boolean, motivo: string, sugerencia: string}}
 *   valido: false solo cuando hay algo claramente mal escrito.
 *   sugerencia: el lote corregido, cuando se puede deducir.
 */
export function validarNumeroLote(valor, regla) {
  const { soloDigitos, largo } = { ...REGLA_LOTE_POR_DEFECTO, ...(regla || {}) };
  const v = String(valor ?? '').trim();
  if (!v) return { valido: true, motivo: '', sugerencia: '' };

  // Formato libre: solo se controla que no se pase del largo configurado.
  if (!soloDigitos) {
    if (v.length > largo) {
      return {
        valido: false,
        motivo: `El lote tiene ${v.length} caracteres y el máximo configurado es ${largo}.`,
        sugerencia: v.slice(0, largo),
      };
    }
    return { valido: true, motivo: '', sugerencia: '' };
  }

  // Se mira solo el bloque numérico del principio; el sufijo del hijo no cuenta.
  const m = v.match(/^(\d+)/);
  if (!m) return { valido: true, motivo: '', sugerencia: '' }; // lotes con letras: no se juzga
  // Un lote que mezcla letras (260531-P01) es un hijo, no un número mal escrito.
  if (/[a-z]/i.test(v)) return { valido: true, motivo: '', sugerencia: '' };

  const numero = m[1];

  if (numero.length > DIGITOS_LOTE) {
    return {
      valido: false,
      motivo: `El lote tiene ${numero.length} dígitos y debe tener ${DIGITOS_LOTE}. `
        + 'Parece que se escribió un dígito de más.',
      sugerencia: numero.slice(0, DIGITOS_LOTE) + v.slice(numero.length),
    };
  }

  if (numero.length < DIGITOS_LOTE) {
    return {
      valido: false,
      motivo: `El lote tiene ${numero.length} dígitos y debe tener ${DIGITOS_LOTE}.`,
      sugerencia: '',
    };
  }

  return { valido: true, motivo: '', sugerencia: '' };
}

/** Atajo: ¿este lote está bien escrito? */
export const loteValido = (valor, regla) => validarNumeroLote(valor, regla).valido;

/**
 * Revisa una lista de lotes y devuelve solo los que están mal.
 * @returns {Array<{valor: string, motivo: string, sugerencia: string}>}
 */
export function lotesConProblema(lotes, regla) {
  const salida = [];
  for (const l of (lotes || [])) {
    const r = validarNumeroLote(l, regla);
    if (!r.valido) salida.push({ valor: l, motivo: r.motivo, sugerencia: r.sugerencia });
  }
  return salida;
}

export default { DIGITOS_LOTE, LOTE_LIBRE_MAX, reglaLoteDeCampo, limpiarNumeroLote, validarNumeroLote, loteValido, lotesConProblema };
