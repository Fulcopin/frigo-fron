// ====================================
// HORA EN 24 HORAS — a prueba de errores
// ====================================
// El <input type="time"> del navegador se dibuja según la configuración del
// DISPOSITIVO. En una tablet en inglés muestra AM/PM, y si el operario marca
// PM en lugar de AM se guardan las 20:00 cuando quiso poner las 08:00.
//
// Ese error no se detecta al llenar: el formulario queda guardado con 12 horas
// de diferencia y aparece semanas después como un turno imposible en el reporte
// de horas-hombre.
//
// Acá se elige la hora de una lista de 00 a 23 y los minutos de otra. No hay
// AM/PM que marcar, así que no hay forma de equivocarse. Y en tablet un
// desplegable es más rápido y más preciso que escribir en un campo chico.

import { useMemo } from 'react';
import './HoraInput24.css';

/** "08:30:00" o "8:30" → { hh: "08", mm: "30" } */
function partir(valor) {
  const t = String(valor ?? '').trim();
  if (!t) return { hh: '', mm: '' };
  const m = t.match(/^(\d{1,2}):(\d{1,2})/);
  if (!m) return { hh: '', mm: '' };
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return { hh: String(hh).padStart(2, '0'), mm: String(mm).padStart(2, '0') };
}

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

// Los 60 minutos.
//
// Estaban de 5 en 5 para acortar la lista, pero eso impedía anotar una hora
// exacta como 08:37 — y en planta las horas de inicio y fin salen del reloj,
// no de un redondeo. Una hora que no se puede registrar tal cual obliga al
// operario a mentir un poco, y esos minutos se acumulan en el cálculo de
// horas-hombre.
const MINUTOS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

/**
 * @param {string}   value      "HH:MM"
 * @param {Function} onChange   recibe "HH:MM" o ''
 * @param {string}   [turno]    'dia' | 'noche' — solo para el aviso, no bloquea
 * @param {string}   [desde]    hora de inicio, para avisar si el fin es anterior
 * @param {boolean}  [disabled]
 * @param {boolean}  [sinAvisos] apaga los avisos de turno y de orden
 */
export default function HoraInput24({ value, onChange, turno, desde, disabled, sinAvisos = false, className = '', ...rest }) {
  const { hh, mm } = useMemo(() => partir(value), [value]);

  const emitir = (nuevaHh, nuevoMm) => {
    // Elegir solo una de las dos partes deja el valor incompleto: se completa
    // con 00 para no guardar "08:" a medias.
    if (!nuevaHh && !nuevoMm) return onChange('');
    const h = nuevaHh || '00';
    const m = nuevoMm || '00';
    onChange(`${h}:${m}`);
  };

  // ── Avisos, sin bloquear ──────────────────────────────────────────────
  // Bloquear sería peor: hay turnos que cruzan medianoche y jornadas raras que
  // igual hay que poder registrar. El aviso hace que el operario lo mire.
  //
  // Con `sinAvisos` se apagan del todo. En planta no hay jornadas fijas de 8
  // horas, así que el aviso de "turno día con hora de noche" saltaba en casos
  // normales: un aviso que aparece cuando todo está bien entrena a ignorarlo, y
  // entonces tampoco se mira cuando importa.
  const avisos = [];

  if (!sinAvisos && hh !== '' && turno) {
    const h = parseInt(hh, 10);
    if (turno === 'dia' && (h >= 19 || h < 5)) {
      avisos.push(`Turno día con hora ${hh}:${mm}. ¿Seguro que no es ${String((h + 12) % 24).padStart(2, '0')}:${mm}?`);
    }
    if (turno === 'noche' && h >= 6 && h < 17) {
      avisos.push(`Turno noche con hora ${hh}:${mm}. Revisá que sea correcta.`);
    }
  }

  if (!sinAvisos && hh !== '' && desde) {
    const ini = partir(desde);
    if (ini.hh !== '') {
      const minIni = parseInt(ini.hh, 10) * 60 + parseInt(ini.mm || '0', 10);
      const minFin = parseInt(hh, 10) * 60 + parseInt(mm || '0', 10);
      // En turno noche cruzar medianoche es lo normal: 22:00 → 02:00 no es un
      // error y avisar ahí entrena al operario a ignorar los avisos.
      if (minFin < minIni && turno !== 'noche') {
        avisos.push(`Termina antes de empezar (${ini.hh}:${ini.mm} → ${hh}:${mm}). Solo es válido si el turno cruza medianoche.`);
      }
    }
  }

  const conAviso = avisos.length > 0;

  return (
    <div className={`h24 ${conAviso ? 'h24--aviso' : ''} ${className}`} {...rest}>
      <div className="h24-campos">
        <select
          className="h24-sel"
          value={hh}
          onChange={(e) => emitir(e.target.value, mm)}
          disabled={disabled}
          aria-label="Hora"
        >
          <option value="">--</option>
          {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
        </select>

        <span className="h24-sep">:</span>

        <select
          className="h24-sel"
          value={mm}
          onChange={(e) => emitir(hh, e.target.value)}
          disabled={disabled}
          aria-label="Minutos"
        >
          <option value="">--</option>
          {MINUTOS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <span className="h24-nota" title="Formato de 24 horas: las 8 de la noche son 20:00">24h</span>
      </div>

      {conAviso && (
        <div className="h24-mensaje">
          {avisos.map((a, i) => <div key={i}>⚠️ {a}</div>)}
        </div>
      )}
    </div>
  );
}