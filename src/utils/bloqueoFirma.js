/**
 * bloqueoFirma.js
 * ─────────────────────────────────────────────────────────────────────────────
 * UN SOLO CRITERIO PARA DECIDIR SI UN REGISTRO YA NO SE PUEDE FIRMAR.
 *
 * El bloqueo por antigüedad estaba copiado a mano en Gestión de Firmas y en Ver
 * Formularios, y en Editar Formulario Llenado directamente no existía: el mismo
 * registro vencido se bloqueaba por una pantalla y se firmaba sin problema por
 * otra. Todas las pantallas deben preguntar acá.
 *
 * El reloj arranca en la fecha de CREACIÓN del registro (CreatedAt), igual que
 * el backend en SignaturesController.cs. No se cuentan sábados ni domingos.
 */

import { businessHoursBetween } from './dateUtils';

/** Umbral por defecto si el admin todavía no configuró uno (Gestión de Alertas). */
export const UMBRAL_BLOQUEO_POR_DEFECTO = 36;

/**
 * Fecha de GUARDADO del registro, para el reloj del bloqueo.
 *
 * ⚠️ Tiene que ser cuándo entró al sistema, NO la fecha del encabezado.
 *
 * Son distintas: un formulario del 20 de agosto puede guardarse hoy. Si el
 * bloqueo se contara desde la del papel, ese registro nacería bloqueado —con
 * "23 días de antigüedad"— y el firmante nunca tendría oportunidad de firmarlo.
 * Es exactamente lo que se reportó: registros que aparecen ya bloqueados sin
 * que nadie los haya dejado vencer.
 *
 * `fechaGuardado` viene de /Signatures/pending y es el CreatedAt real.
 * `createdDate` quedó de último a propósito: en ese endpoint ahora trae la
 * fecha del encabezado, que sirve para mostrar pero no para contar el plazo.
 */
export function fechaDeGuardado(form) {
  return form?.fechaGuardado
      || form?.createdAt
      || form?.CreatedAt
      || form?.createdDate
      || null;
}

/** @deprecated Usar fechaDeGuardado: el nombre viejo confundía las dos fechas. */
export const fechaDeCreacion = fechaDeGuardado;

/**
 * ¿Un Administrador lo habilitó desde Supervisión General?
 *
 * La marca vive dentro de HeaderData (la escribe /Signatures/unlock-multiple),
 * pero /Signatures/pending ya la trae desplegada como campo suelto. Se aceptan
 * las dos formas, y el encabezado sin parsear también, porque en algunas
 * pantallas headerData todavía es el string crudo.
 */
export function estaHabilitadoPorAdmin(form) {
  if (form?.unlocked36h) return true;

  const header = form?.headerData;
  if (header && typeof header === 'object') return !!header.unlocked36h;
  if (typeof header === 'string') return header.includes('unlocked36h');
  return false;
}

/**
 * Estado de bloqueo de un registro.
 *
 * @param {Object} form — registro con createdAt/createdDate y headerData
 * @param {number} umbral — horas configuradas por el admin
 * @returns {{bloqueado: boolean, horas: number, habilitado: boolean, sinFecha: boolean}}
 */
export function estadoBloqueoFirma(form, umbral = UMBRAL_BLOQUEO_POR_DEFECTO) {
  // El plazo corre desde que el registro ENTRÓ al sistema, no desde la fecha
  // que dice el papel: si no, un registro cargado con fecha vieja nacería
  // bloqueado y nadie podría firmarlo nunca.
  const creado = fechaDeGuardado(form);
  const habilitado = estaHabilitadoPorAdmin(form);

  // Sin fecha de creación no se puede calcular nada. No se bloquea acá: el
  // backend sí tiene el CreatedAt real y es quien decide de verdad.
  if (!creado) return { bloqueado: false, horas: 0, habilitado, sinFecha: true };

  const horas = businessHoursBetween(creado, new Date());
  return { bloqueado: horas > umbral && !habilitado, horas, habilitado, sinFecha: false };
}

/** Atajo para los `disabled` y los renderizados condicionales. */
export function estaBloqueadoParaFirma(form, umbral = UMBRAL_BLOQUEO_POR_DEFECTO) {
  return estadoBloqueoFirma(form, umbral).bloqueado;
}

/** Texto único del aviso, para que todas las pantallas digan lo mismo. */
export function mensajeBloqueoFirma(umbral = UMBRAL_BLOQUEO_POR_DEFECTO) {
  return `🔒 Este registro superó las ${umbral} horas de antigüedad (sin contar sábados ni domingos) ` +
    `y está bloqueado para firma. Un Administrador debe habilitarlo en Supervisión General.`;
}

/**
 * Lee el umbral configurado por el admin. Si el servidor no responde o el valor
 * no sirve, se queda con el de por defecto en vez de dejar todo sin bloquear.
 */
export async function cargarUmbralBloqueo(apiBaseUrl) {
  try {
    const res = await fetch(`${apiBaseUrl}/Alerts/config`);
    if (!res.ok) return UMBRAL_BLOQUEO_POR_DEFECTO;
    const cfg = await res.json();
    return cfg?.lockThresholdHours > 0 ? cfg.lockThresholdHours : UMBRAL_BLOQUEO_POR_DEFECTO;
  } catch {
    return UMBRAL_BLOQUEO_POR_DEFECTO;
  }
}