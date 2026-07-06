/**
 * Retorna la fecha/hora actual como string ISO en hora LOCAL (sin Z).
 * Usar en lugar de new Date().toISOString() cuando se envía al backend,
 * ya que toISOString() convierte a UTC y causa desfase de hora.
 * Ejemplo: "2026-03-10T14:03:25" (hora Ecuador real)
 */
export function toLocalISOString(date) {
  const d = date || new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Cuenta las horas transcurridas entre dos fechas EXCLUYENDO sábados y domingos
 * (son horas no oficiales y no deben contar para el bloqueo de formularios).
 * Debe mantenerse equivalente a BusinessHoursBetween del backend (SignaturesController.cs).
 * @param {Date|string|number} start
 * @param {Date|string|number} end
 * @returns {number} horas hábiles transcurridas
 */
export function businessHoursBetween(start, end) {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  if (endDate <= startDate) return 0;

  const MS_PER_HOUR = 1000 * 60 * 60;
  let totalHours = 0;
  let cursor = new Date(startDate);

  while (cursor < endDate) {
    // Medianoche del día siguiente
    const nextMidnight = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 0, 0, 0, 0);
    const segmentEnd = nextMidnight < endDate ? nextMidnight : endDate;

    const day = cursor.getDay(); // 0 = domingo, 6 = sábado
    if (day !== 0 && day !== 6) {
      totalHours += (segmentEnd - cursor) / MS_PER_HOUR;
    }

    cursor = segmentEnd;
  }

  return totalHours;
}
