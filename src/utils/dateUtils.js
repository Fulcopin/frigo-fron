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
