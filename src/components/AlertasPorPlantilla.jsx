// ====================================
// ALERTAS POR PLANTILLA
// ====================================
// La configuración de alertas es una sola para todo el sistema: el mismo plazo
// de firma para los 57 formularios. Este panel permite apartar a las que
// necesitan otro criterio, eligiendo varias a la vez y aplicándoles lo mismo.
//
// Lo que no se toca acá sigue con la configuración global, así que cambiar el
// default sigue afectando a todas las demás.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE_URL } from '../apiConfig';
import './AlertasPorPlantilla.css';

const API = `${API_BASE_URL}/Alerts`;

/** Las listas del backend llegan envueltas en $values (ReferenceHandler.Preserve). */
function desenvolver(nodo) {
  if (Array.isArray(nodo)) return nodo.map(desenvolver);
  if (nodo && typeof nodo === 'object') {
    if (Array.isArray(nodo.$values)) return nodo.$values.map(desenvolver);
    const out = {};
    for (const [k, v] of Object.entries(nodo)) {
      if (k === '$id' || k === '$ref') continue;
      out[k] = desenvolver(v);
    }
    return out;
  }
  return nodo;
}

const leerCorreos = (json) => {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export default function AlertasPorPlantilla({ usuario }) {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [seleccion, setSeleccion] = useState(new Set());
  const [busqueda, setBusqueda] = useState('');
  const [soloExcepciones, setSoloExcepciones] = useState(false);

  // Valores del formulario que se aplican a todas las elegidas.
  const [activa, setActiva] = useState(true);
  const [horas, setHoras] = useState(24);
  const [horaChequeo, setHoraChequeo] = useState('');
  const [correos, setCorreos] = useState('');
  const [sumarCorreos, setSumarCorreos] = useState(true);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const r = await fetch(`${API}/config-plantillas`);
      if (!r.ok) throw new Error('No se pudo cargar la configuración');
      setDatos(desenvolver(await r.json()));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const plantillas = useMemo(() => {
    const lista = Array.isArray(datos?.plantillas) ? datos.plantillas : [];
    const q = busqueda.trim().toLowerCase();
    return lista.filter(p => {
      if (soloExcepciones && !p.tieneExcepcion) return false;
      if (!q) return true;
      return `${p.codigo} ${p.nombre} ${p.proceso || ''}`.toLowerCase().includes(q);
    });
  }, [datos, busqueda, soloExcepciones]);

  const alternar = (id) => setSeleccion(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const alternarTodas = () => setSeleccion(prev =>
    prev.size === plantillas.length ? new Set() : new Set(plantillas.map(p => p.templateID))
  );

  /** Precarga el formulario con lo que ya tiene una plantilla, para no escribirlo de nuevo. */
  const copiarDe = (p) => {
    setActiva(p.enableSignatureAlerts);
    setHoras(p.signatureAlertDelay);
    setHoraChequeo(p.dailyCheckTime || '');
    setCorreos(leerCorreos(p.signatureRecipients).join(', '));
    setSumarCorreos(p.recipientsSeSuman !== false);
  };

  const aplicar = async () => {
    if (seleccion.size === 0) return;

    const lista = correos.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    const invalido = lista.find(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (invalido) {
      setError(`El correo «${invalido}» no parece válido.`);
      return;
    }

    const nombres = (datos?.plantillas || [])
      .filter(p => seleccion.has(p.templateID))
      .map(p => p.codigo);
    const resumen = activa
      ? `avisarán a las ${horas} h de creado el formulario`
      : 'NO avisarán de firmas pendientes';
    if (!window.confirm(
      `${seleccion.size} plantilla(s) ${resumen}:\n\n${nombres.join(', ')}\n\n¿Confirmás?`
    )) return;

    try {
      setGuardando(true);
      setError('');
      const r = await fetch(`${API}/config-plantillas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateIds: [...seleccion],
          enableSignatureAlerts: activa,
          signatureAlertDelay: Number(horas),
          dailyCheckTime: horaChequeo || null,
          signatureRecipients: lista,
          recipientsSeSuman: sumarCorreos,
          actualizadoPor: usuario?.nombre || usuario?.email || '',
        }),
      });
      const cuerpo = await r.json().catch(() => null);
      if (!r.ok) throw new Error(cuerpo?.message || 'No se pudo guardar');

      setMensaje(cuerpo.message);
      setSeleccion(new Set());
      await cargar();
      setTimeout(() => setMensaje(''), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const volverAlGlobal = async () => {
    if (seleccion.size === 0) return;
    if (!window.confirm(
      `${seleccion.size} plantilla(s) volverán a usar la configuración general. ¿Confirmás?`
    )) return;

    try {
      setGuardando(true);
      const r = await fetch(`${API}/config-plantillas`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([...seleccion]),
      });
      const cuerpo = await r.json().catch(() => null);
      if (!r.ok) throw new Error(cuerpo?.message || 'No se pudo quitar');
      setMensaje(cuerpo.message);
      setSeleccion(new Set());
      await cargar();
      setTimeout(() => setMensaje(''), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <div className="ap-cargando">Cargando plantillas…</div>;

  const g = datos?.global || {};
  const conExcepcion = (datos?.plantillas || []).filter(p => p.tieneExcepcion).length;

  return (
    <div className="ap-panel">
      <div className="ap-encabezado">
        <h3>🔔 Alertas de firma por formulario</h3>
        <p>
          Elegí varios formularios y aplicales el mismo criterio. Los que no toques siguen con
          la configuración general: <strong>{g.enableSignatureAlerts ? `aviso a las ${g.signatureAlertDelay} h` : 'sin aviso'}</strong>,
          chequeo a las <strong>{g.dailyCheckTime}</strong>.
        </p>
        {conExcepcion > 0 && (
          <span className="ap-badge">{conExcepcion} con configuración propia</span>
        )}
      </div>

      {error && <div className="ap-error">{error}</div>}
      {mensaje && <div className="ap-ok">✅ {mensaje}</div>}

      <div className="ap-cuerpo">
        {/* ── Lista de plantillas ── */}
        <div className="ap-lista-zona">
          <div className="ap-filtros">
            <input
              type="text"
              placeholder="Buscar por código, nombre o proceso…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="ap-input"
            />
            <label className="ap-check-inline">
              <input
                type="checkbox"
                checked={soloExcepciones}
                onChange={e => setSoloExcepciones(e.target.checked)}
              />
              Solo las que tienen configuración propia
            </label>
          </div>

          <div className="ap-lista-cabecera">
            <label className="ap-check-inline">
              <input
                type="checkbox"
                checked={plantillas.length > 0 && seleccion.size === plantillas.length}
                onChange={alternarTodas}
              />
              Seleccionar las {plantillas.length} visibles
            </label>
            <span className="ap-contador">{seleccion.size} elegida(s)</span>
          </div>

          <ul className="ap-lista">
            {plantillas.length === 0 && <li className="ap-vacio">No hay plantillas que coincidan.</li>}
            {plantillas.map(p => {
              const elegida = seleccion.has(p.templateID);
              return (
                <li key={p.templateID} className={`ap-item ${elegida ? 'elegida' : ''} ${p.tieneExcepcion ? 'propia' : ''}`}>
                  <label className="ap-item-check">
                    <input type="checkbox" checked={elegida} onChange={() => alternar(p.templateID)} />
                  </label>

                  <div className="ap-item-datos" onClick={() => alternar(p.templateID)}>
                    <div className="ap-item-titulo">
                      <strong>{p.codigo}</strong>
                      <span className="ap-item-nombre">{p.nombre}</span>
                    </div>
                    <div className="ap-item-config">
                      {p.enableSignatureAlerts
                        ? <span className="ap-tag ap-tag-on">avisa a las {p.signatureAlertDelay} h</span>
                        : <span className="ap-tag ap-tag-off">sin aviso</span>}
                      {p.dailyCheckTime && <span className="ap-tag">🕐 {p.dailyCheckTime}</span>}
                      {p.tieneExcepcion
                        ? <span className="ap-tag ap-tag-propia">config. propia</span>
                        : <span className="ap-tag ap-tag-hereda">hereda la general</span>}
                    </div>
                  </div>

                  {p.tieneExcepcion && (
                    <button
                      type="button"
                      className="ap-btn-copiar"
                      onClick={() => copiarDe(p)}
                      title="Copiar esta configuración al formulario de la derecha"
                    >
                      ⧉
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Formulario que se aplica ── */}
        <div className="ap-form-zona">
          <h4>Aplicar a las seleccionadas</h4>

          <label className="ap-check-grande">
            <input type="checkbox" checked={activa} onChange={e => setActiva(e.target.checked)} />
            <span>
              <strong>Avisar de firmas pendientes</strong>
              <small>Si se desmarca, estos formularios no generan alertas de firma.</small>
            </span>
          </label>

          <div className={`ap-campo ${!activa ? 'ap-apagado' : ''}`}>
            <label>⏱️ Avisar después de</label>
            <div className="ap-horas">
              <input
                type="number"
                min="1"
                max="720"
                value={horas}
                onChange={e => setHoras(e.target.value)}
                disabled={!activa}
                className="ap-input"
              />
              <span>horas de creado el formulario</span>
            </div>
            <div className="ap-atajos">
              {[4, 8, 12, 24, 48, 72].map(h => (
                <button key={h} type="button" onClick={() => setHoras(h)} disabled={!activa}
                  className={Number(horas) === h ? 'activo' : ''}>
                  {h}h
                </button>
              ))}
            </div>
          </div>

          <div className={`ap-campo ${!activa ? 'ap-apagado' : ''}`}>
            <label>🕐 Hora del chequeo diario</label>
            <input
              type="time"
              value={horaChequeo}
              onChange={e => setHoraChequeo(e.target.value)}
              disabled={!activa}
              className="ap-input"
            />
            <small>Vacío = usa la hora general ({g.dailyCheckTime}).</small>
          </div>

          <div className={`ap-campo ${!activa ? 'ap-apagado' : ''}`}>
            <label>📧 Destinatarios</label>
            <textarea
              rows={3}
              value={correos}
              onChange={e => setCorreos(e.target.value)}
              placeholder="correo1@frigolab.com.ec, correo2@frigolab.com.ec"
              disabled={!activa}
              className="ap-input"
            />
            <label className="ap-check-inline">
              <input
                type="checkbox"
                checked={sumarCorreos}
                onChange={e => setSumarCorreos(e.target.checked)}
                disabled={!activa}
              />
              Sumarlos a los generales (si se desmarca, los reemplazan)
            </label>
            <small>Vacío = usa solo los destinatarios generales.</small>
          </div>

          <div className="ap-acciones">
            <button
              className="ap-btn ap-btn-primario"
              onClick={aplicar}
              disabled={guardando || seleccion.size === 0}
            >
              {guardando ? 'Guardando…' : `💾 Aplicar a ${seleccion.size} formulario(s)`}
            </button>
            <button
              className="ap-btn ap-btn-secundario"
              onClick={volverAlGlobal}
              disabled={guardando || seleccion.size === 0}
              title="Quita la configuración propia y vuelven a la general"
            >
              ↩️ Volver a la general
            </button>
          </div>

          {seleccion.size === 0 && (
            <p className="ap-nota">Elegí al menos un formulario de la lista de la izquierda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
