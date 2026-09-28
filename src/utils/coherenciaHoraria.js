/**
 * coherenciaHoraria.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ⏰ AVISO (no bloquea) cuando lo registrado no cuadra con el momento en que se
 * guarda el formulario.
 *
 * El caso real: a las 17:15 del 23 se carga el reporte del turno de la NOCHE
 * ANTERIOR, pero con la fecha de hoy. Queda un registro que dice que a las
 * 21:00 del 23 pasó algo… cuando todavía no son las 21:00. Nadie lo nota hasta
 * la auditoría.
 *
 * Qué revisa:
 *   1. Fecha del encabezado POSTERIOR al día en que se está guardando.
 *   2. Fecha de hoy con horas del registro que TODAVÍA NO OCURRIERON.
 *   3. Horas del registro posteriores a la hora de la firma.
 *
 * A propósito NO bloquea: hay turnos que cruzan la medianoche y registros que
 * se cargan al día siguiente, y son válidos. Solo obliga a mirar dos veces.
 */

/**
 * Minutos de tolerancia. Media hora: los relojes de las tablets no están al
 * segundo y es normal anotar el fin del turno un rato antes de que termine.
 * Con este margen igual se atrapa el caso real (21:00 anotado a las 17:15).
 */
const TOLERANCIA_MIN = 30;

const dos = (n) => String(n).padStart(2, '0');
export const aISO = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

const norm = (t) => String(t ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim();

/** "HH:MM" → minutos desde medianoche, o null si no es una hora. */
export function aMinutos(valor) {
  const m = String(valor ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Fecha (YYYY-MM-DD) escrita en el encabezado, o '' si no hay ninguna. */
export function fechaDelEncabezado(headerData) {
  const hdr = typeof headerData === 'string' ? (() => {
    try { return JSON.parse(headerData || '{}'); } catch { return {}; }
  })() : (headerData || {});

  for (const [clave, valor] of Object.entries(hdr)) {
    const k = norm(clave);
    if (!k.includes('fecha')) continue;
    if (k.includes('vencim') || k.includes('caduc') || k.includes('elabor')) continue;
    const texto = String(valor ?? '').trim();
    const iso = texto.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const dmy = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmy) return `${dmy[3]}-${dos(dmy[2])}-${dos(dmy[1])}`;
  }
  return '';
}

/** Columnas de hora de una tabla: por la marca de la plantilla o por el nombre. */
function columnasDeHora(tabla) {
  const cols = tabla?.columns || [];
  return cols
    .filter((c) => {
      const rol = String(c?.rol || '');
      if (rol === 'horaInicio' || rol === 'horaFin') return true;
      if (rol) return false;
      const tipo = String(c?.type || '').toLowerCase();
      const nombre = norm(c?.label || c?.header || '');
      return tipo === 'time' || (nombre.includes('hora') && !nombre.includes('horas'));
    })
    .map((c) => String(c?.label || c?.header || '').trim())
    .filter(Boolean);
}

const valorDeFila = (fila, columna) => {
  if (!fila || typeof fila !== 'object') return '';
  if (fila[columna] !== undefined) return fila[columna];
  // Columnas repetidas se guardan como "NOMBRE_colN"
  const clave = Object.keys(fila).find((k) => k.replace(/_col\d+$/, '') === columna);
  return clave ? fila[clave] : '';
};

/** Hora más tarde registrada en el formulario, en minutos ({} si no hay). */
export function horaMasTardia(bodyData, bodyElements) {
  let max = null;
  let dondeTabla = '';
  let dondeFila = 0;
  let dondeColumna = '';

  (bodyData || []).forEach((elemento, i) => {
    const plantilla = bodyElements?.[i];
    const filas = elemento?.rows || elemento?.data;
    if (!Array.isArray(filas)) return;

    const columnas = columnasDeHora(plantilla);
    if (columnas.length === 0) return;

    filas.forEach((fila, f) => {
      columnas.forEach((columna) => {
        const min = aMinutos(valorDeFila(fila, columna));
        if (min === null) return;
        if (max === null || min > max) {
          max = min;
          dondeTabla = plantilla?.title || elemento?.title || `Tabla ${i + 1}`;
          dondeFila = f + 1;
          dondeColumna = columna;
        }
      });
    });
  });

  return max === null ? {} : { minutos: max, tabla: dondeTabla, fila: dondeFila, columna: dondeColumna };
}

const comoHora = (minutos) => `${dos(Math.floor(minutos / 60))}:${dos(minutos % 60)}`;

/**
 * Revisa la coherencia. Devuelve { hayAvisos, avisos[], mensaje }.
 *
 * @param {object}   opciones
 * @param {object|string} opciones.headerData
 * @param {Array}    opciones.bodyData
 * @param {Array}    opciones.bodyElements
 * @param {Date}     [opciones.ahora]  para poder probarlo
 */
export function revisarCoherenciaHoraria({ headerData, bodyData, bodyElements, ahora = new Date() }) {
  const avisos = [];
  const hoy = aISO(ahora);
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const fecha = fechaDelEncabezado(headerData);

  // 1. Fecha del encabezado en el futuro
  if (fecha && fecha > hoy) {
    avisos.push(
      `La fecha del encabezado (${fecha}) es posterior a hoy (${hoy}).`
    );
  }

  const tardia = horaMasTardia(bodyData, bodyElements);

  // 2. Registro de hoy con horas que todavía no ocurrieron
  if (fecha === hoy && tardia.minutos !== undefined
      && tardia.minutos > minutosAhora + TOLERANCIA_MIN) {
    avisos.push(
      `El registro es de HOY y anota ${comoHora(tardia.minutos)} ` +
      `(${tardia.tabla}, fila ${tardia.fila}, ${tardia.columna}), ` +
      `pero todavía son las ${comoHora(minutosAhora)}.`
    );
  }

  // 3. Sin fecha en el encabezado: se compara igual contra la hora actual
  if (!fecha && tardia.minutos !== undefined && tardia.minutos > minutosAhora + TOLERANCIA_MIN) {
    avisos.push(
      `Se anota ${comoHora(tardia.minutos)} y todavía son las ${comoHora(minutosAhora)}. ` +
      `El encabezado no tiene fecha, así que se asume hoy.`
    );
  }

  const mensaje = avisos.length === 0 ? '' : [
    '⏰ Revisa las horas antes de guardar',
    '',
    ...avisos.map((a) => `• ${a}`),
    '',
    'Si el registro es del turno de anoche, corrige la FECHA del encabezado.',
    '',
    '¿Guardar de todas formas?',
  ].join('\n');

  return { hayAvisos: avisos.length > 0, avisos, mensaje };
}
