/**
 * validacionLote.js
 * ─────────────────────────────────────────────────────────────────────────────
 * VALIDACIÓN DEL NÚMERO DE LOTE.
 *
 * Un lote de proceso son SEIS dígitos (año-mes-día: 260531). Se coló más de un
 * registro con un dígito de más — "2605318" en vez de "260531" — y ese lote
 * fantasma no cruza con nada: no aparece en los desplegables de los otros
 * formularios ni se le puede descontar inventario.
 *
 * Los lotes hijos llevan sufijo ("260531-P01", "260531-PT-TNA-1000"): eso es
 * válido, lo que se controla es el número de la izquierda.
 */

/** Cuántos dígitos tiene que tener el número de lote. */
export const DIGITOS_LOTE = 6;

/**
 * Revisa un número de lote escrito a mano.
 *
 * @param {string} valor
 * @returns {{valido: boolean, motivo: string, sugerencia: string}}
 *   valido: false solo cuando hay algo claramente mal escrito.
 *   sugerencia: el lote corregido, cuando se puede deducir.
 */
export function validarNumeroLote(valor) {
  const v = String(valor ?? '').trim();
  if (!v) return { valido: true, motivo: '', sugerencia: '' };

  // Se mira solo el bloque numérico del principio; el sufijo del hijo no cuenta.
  const m = v.match(/^(\d+)/);
  if (!m) return { valido: true, motivo: '', sugerencia: '' }; // lotes con letras: no se juzga

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
export const loteValido = (valor) => validarNumeroLote(valor).valido;

/**
 * Revisa una lista de lotes y devuelve solo los que están mal.
 * @returns {Array<{valor: string, motivo: string, sugerencia: string}>}
 */
export function lotesConProblema(lotes) {
  const salida = [];
  for (const l of (lotes || [])) {
    const r = validarNumeroLote(l);
    if (!r.valido) salida.push({ valor: l, motivo: r.motivo, sugerencia: r.sugerencia });
  }
  return salida;
}

export default { DIGITOS_LOTE, validarNumeroLote, loteValido, lotesConProblema };
