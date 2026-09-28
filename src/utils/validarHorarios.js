/**
 * ⏱️ Validación de horarios (hora de fin vs hora de inicio).
 *
 * Es la MISMA regla que aplica el backend (Services/ValidadorHorarios.cs).
 * Aquí solo sirve para avisar antes de enviar; el backend es quien bloquea
 * de verdad, así que si se cambia la regla hay que cambiarla en los dos lados.
 *
 *   08:00 → 16:30  ✅
 *   21:00 → 01:30  ✅ turno que pasa la medianoche (4,5 h)
 *   08:00 → 04:00  ❌ serían 20 h: error de digitación
 *   08:00 → 08:00  ❌ cero horas
 */

export const REGLAS_HORARIO = {
  permitirCruceMedianoche: true,
  maxHorasCruceMedianoche: 12,
};

const RX_HORA_INICIO = /HORA\s*(DE\s*)?INICI|HORA\s*(DE\s*)?ENTRADA/i;
const RX_HORA_FIN = /HORA\s*(DE\s*)?FIN|HORA\s*(DE\s*)?SALIDA|HORA\s*(DE\s*)?T[EÉ]RMINO/i;
const RX_SUFIJO = /_col\d+$/;

/** "08:00" / "8:00" / "08:00:00" → minutos. null si no es una hora. */
export const horaAMinutos = (valor) => {
  if (valor === null || valor === undefined) return null;
  const m = String(valor).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

/** Devuelve el motivo del error, o null si el rango es válido. */
export const validarRangoHorario = (inicio, fin, reglas = REGLAS_HORARIO) => {
  const a = horaAMinutos(inicio);
  const b = horaAMinutos(fin);
  if (a === null || b === null) return null;   // incompleto: no se valida

  const diferencia = b - a;
  if (diferencia === 0) return 'La hora de fin es igual a la de inicio.';
  if (diferencia > 0) return null;

  if (!reglas.permitirCruceMedianoche) return 'La hora de fin es anterior a la de inicio.';

  const horas = (diferencia + 1440) / 60;
  if (horas > reglas.maxHorasCruceMedianoche) {
    return `La hora de fin es anterior a la de inicio. Si fuera un turno que pasa la medianoche `
      + `duraría ${Number(horas.toFixed(1))} h, y el máximo permitido es ${reglas.maxHorasCruceMedianoche} h.`;
  }
  return null;
};

const tipoColumna = (clave, roles) => {
  const limpio = String(clave).replace(RX_SUFIJO, '').trim();
  const rol = roles.get(limpio.toLowerCase());
  if (rol) return rol === 'horaInicio' ? 'inicio' : rol === 'horaFin' ? 'fin' : null;
  if (RX_HORA_INICIO.test(limpio)) return 'inicio';
  if (RX_HORA_FIN.test(limpio)) return 'fin';
  return null;
};

/**
 * Revisa todas las tablas del formulario.
 *
 * @param {Array} bodyData       bloques del formulario (con `data` o `rows`)
 * @param {Array} bodyElements   elementos de la plantilla (para títulos y roles)
 * @returns {{ esValido: boolean, errores: Array, mensaje: string }}
 */
export const validarHorariosFormulario = (bodyData, bodyElements = [], reglas = REGLAS_HORARIO) => {
  const elementos = Array.isArray(bodyElements) ? bodyElements : [];
  const titulos = new Map();
  const roles = new Map();
  elementos.forEach(el => {
    if (el?.id != null && el?.title) titulos.set(String(el.id), el.title);
    (el?.columns || []).forEach(c => {
      if (c?.label && c?.rol) roles.set(String(c.label).trim().toLowerCase(), c.rol);
    });
  });

  const errores = [];
  let indiceTabla = 0;

  (Array.isArray(bodyData) ? bodyData : []).forEach((bloque, posicion) => {
    const filas = Array.isArray(bloque?.rows) ? bloque.rows
      : Array.isArray(bloque?.data) ? bloque.data : null;
    if (!filas) return;
    indiceTabla += 1;

    const tabla = bloque.title
      || (bloque.id != null && titulos.get(String(bloque.id)))
      || elementos[posicion]?.title
      || `Tabla ${indiceTabla}`;

    filas.forEach((fila, i) => {
      if (!fila || typeof fila !== 'object') return;
      let inicio = null;
      let fin = null;
      Object.entries(fila).forEach(([clave, valor]) => {
        const tipo = tipoColumna(clave, roles);
        if (tipo === 'inicio' && inicio === null) inicio = valor;
        else if (tipo === 'fin' && fin === null) fin = valor;
      });

      const motivo = validarRangoHorario(inicio, fin, reglas);
      if (motivo) {
        errores.push({ tabla, fila: i + 1, horaInicio: String(inicio), horaFin: String(fin), motivo });
      }
    });
  });

  const mensaje = errores.length === 0 ? '' :
    '⏱️ Revisa bien la hora de inicio y la hora de fin. No se guardó el formulario.\n'
    + errores.slice(0, 10).map(e => `• ${e.tabla}, fila ${e.fila}: ${e.horaInicio} → ${e.horaFin}. ${e.motivo}`).join('\n')
    + (errores.length > 10 ? `\n… y ${errores.length - 10} fila(s) más.` : '');

  return { esValido: errores.length === 0, errores, mensaje };
};

/**
 * Mensaje legible de una respuesta de error del backend.
 * El backend responde { message: "..." } con texto pensado para el usuario.
 */
export const mensajeDeErrorServidor = (status, textoRespuesta) => {
  try {
    const cuerpo = JSON.parse(textoRespuesta);
    if (cuerpo?.message) return cuerpo.message;
  } catch { /* no era JSON */ }
  return `Error al guardar (${status}): ${textoRespuesta}`;
};
