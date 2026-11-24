import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../apiConfig';
import authService from '../services/authService';

/**
 * ⚙️ Horarios de turno (DÍA / NOCHE) — botón + ventana.
 *
 * Se usa en "Editar Plantilla". La configuración es GLOBAL (una sola para toda
 * la planta) y vive en el backend (tabla ConfiguracionHorarios); el localStorage
 * queda como respaldo si el servidor no responde.
 */

const KEY_LOCAL = 'frigolab.horarios.config';
const DEFECTO = {
  dia: { inicio: '06:00', fin: '17:00' },
  noche: { inicio: '17:00', fin: '05:59' },
};

export function leerConfigHorariosLocal() {
  try {
    const raw = localStorage.getItem(KEY_LOCAL);
    const p = raw ? JSON.parse(raw) : null;
    return {
      dia: { ...DEFECTO.dia, ...(p?.dia || {}) },
      noche: { ...DEFECTO.noche, ...(p?.noche || {}) },
    };
  } catch {
    return DEFECTO;
  }
}

function guardarLocal(cfg) {
  try { localStorage.setItem(KEY_LOCAL, JSON.stringify(cfg)); } catch { /* sin storage */ }
}

export default function ConfigHorarios() {
  const [config, setConfig] = useState(leerConfigHorariosLocal);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Al montar, se trae la config compartida del servidor.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/ConfiguracionHorarios`);
        if (!r.ok) return;
        const d = await r.json();
        if (cancelado || !d) return;
        const cfg = {
          dia: { inicio: d.TurnoDiaInicio || d.turnoDiaInicio || DEFECTO.dia.inicio, fin: d.TurnoDiaFin || d.turnoDiaFin || DEFECTO.dia.fin },
          noche: { inicio: d.TurnoNocheInicio || d.turnoNocheInicio || DEFECTO.noche.inicio, fin: d.TurnoNocheFin || d.turnoNocheFin || DEFECTO.noche.fin },
        };
        setConfig(cfg);
        guardarLocal(cfg);
      } catch { /* sin red: queda el respaldo local */ }
    })();
    return () => { cancelado = true; };
  }, []);

  const guardar = async (nueva) => {
    setGuardando(true);
    guardarLocal(nueva);
    try {
      const r = await fetch(`${API_BASE_URL}/ConfiguracionHorarios`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          TurnoDiaInicio: nueva.dia.inicio,
          TurnoDiaFin: nueva.dia.fin,
          TurnoNocheInicio: nueva.noche.inicio,
          TurnoNocheFin: nueva.noche.fin,
          ActualizadoPor: authService.getCurrentUser()?.nombre || '',
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setConfig(nueva);
      setAbierto(false);
    } catch (e) {
      console.warn('⚠️ No se pudo guardar la configuración de horarios en el backend:', e);
      alert('⚠️ No se pudo guardar en el servidor: ' + (e?.message || e)
        + '\n\nRevisá que el backend esté actualizado (endpoint /api/ConfiguracionHorarios y tabla ConfiguracionHorarios).');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="btn-secondary"
        style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #93c5fd' }}
        title="Configurar horarios de turno (DÍA / NOCHE) para los bloqueos"
      >
        ⚙️ Horarios
      </button>

      {abierto && (
        <VentanaHorarios
          config={config}
          guardando={guardando}
          onGuardar={guardar}
          onCancelar={() => setAbierto(false)}
        />
      )}
    </>
  );
}

function VentanaHorarios({ config, guardando, onGuardar, onCancelar }) {
  const [dia, setDia] = useState(config.dia);
  const [noche, setNoche] = useState(config.noche);
  const estiloHora = { padding: '7px 9px', borderRadius: '6px', border: '1px solid #93c5fd', fontSize: '14px', width: '100%', boxSizing: 'border-box' };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancelar(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
    >
      <div style={{ background: 'white', borderRadius: '12px', width: 'min(540px,100%)', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,.3)' }}>
        <div style={{ background: '#1e40af', color: 'white', padding: '12px 16px', fontWeight: 700 }}>⚙️ Horarios de turno</div>
        <div style={{ padding: '16px' }}>
          <p style={{ fontSize: '12.5px', color: '#475569', marginTop: 0 }}>
            El bloqueo compara el turno del encabezado con las horas del <b>Control del Personal</b>. Las horas fuera del rango del turno no dejan guardar.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '8px', alignItems: 'center' }}>
            <strong>DÍA</strong>
            <input type="time" style={estiloHora} value={dia.inicio} onChange={e => setDia({ ...dia, inicio: e.target.value })} />
            <input type="time" style={estiloHora} value={dia.fin} onChange={e => setDia({ ...dia, fin: e.target.value })} />
            <strong>NOCHE</strong>
            <input type="time" style={estiloHora} value={noche.inicio} onChange={e => setNoche({ ...noche, inicio: e.target.value })} />
            <input type="time" style={estiloHora} value={noche.fin} onChange={e => setNoche({ ...noche, fin: e.target.value })} />
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: 0 }}>
            Si la hora de fin es menor que la de inicio, el turno cruza la medianoche (ej. NOCHE 17:00 → 05:59). Se guarda en el servidor y lo ven todas las tablets.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '10px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <button type="button" onClick={onCancelar} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>Cancelar</button>
          <button type="button" disabled={guardando} onClick={() => onGuardar({ dia, noche })} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? .6 : 1 }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
