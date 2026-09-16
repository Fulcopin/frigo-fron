// ====================================
// REPORTAR UN CAMBIO
// ====================================
// Cualquiera del equipo puede pedir un ajuste sin buscar a quién avisarle.
//
// Antes los pedidos llegaban por WhatsApp, de pasillo o en una reunión, y se
// perdían: nadie sabía qué estaba pedido, qué ya se hizo ni quién lo pidió.
// Acá queda registrado, con su estado y su respuesta.
//
// Se apoya en la tabla Tickets, que ya existía. No hace falta tocar la base.

import { useState, useEffect, useCallback } from 'react';
import {
  enviarMensajeAdmin,
  listarMensajes,
  responderMensaje,
  cambiarEstado,
  esAdminDeMensajes,
  remitenteActual,
  ESTADOS_MENSAJE,
} from '../services/mensajesAdminService';
import './ReportarCambio.css';

const AREAS = [
  '📋 Formularios',
  '✍️ Firmas',
  '📊 Reportes y descargas',
  '📦 Inventario y trazabilidad',
  '📈 Plan de producción',
  '👥 Personal',
  '🔧 Otro',
];

const URGENCIAS = [
  { valor: 'baja',   label: '🟢 Puede esperar' },
  { valor: 'media',  label: '🟡 Esta semana' },
  { valor: 'alta',   label: '🔴 Frena el trabajo' },
];

const fechaCorta = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function ReportarCambio() {
  const soyAdmin = esAdminDeMensajes();
  const yo = remitenteActual();

  const [area, setArea] = useState(AREAS[0]);
  const [urgencia, setUrgencia] = useState('media');
  const [titulo, setTitulo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);

  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [respuestas, setRespuestas] = useState({});

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setLista(await listarMensajes());
    } catch (e) {
      console.error('No se pudieron cargar los reportes:', e);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const enviar = async () => {
    if (!titulo.trim()) { alert('Poné un título corto de qué querés cambiar.'); return; }
    if (!detalle.trim()) { alert('Contá qué pasa y qué esperarías que pase.'); return; }

    setEnviando(true);
    try {
      // El área y la urgencia van dentro del asunto: la tabla Tickets no tiene
      // columnas propias para eso, y agregarlas obligaría a una migración por
      // dos datos que se leen igual de bien acá.
      await enviarMensajeAdmin({
        asunto: `${area} · ${URGENCIAS.find(u => u.valor === urgencia)?.label ?? ''} — ${titulo.trim()}`,
        mensaje: detalle.trim(),
      });
      setTitulo(''); setDetalle(''); setUrgencia('media');
      await cargar();
      alert('✅ Reporte enviado. Vas a ver la respuesta acá mismo.');
    } catch (e) {
      alert(`No se pudo enviar: ${e.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const responder = async (t, cerrar) => {
    const texto = (respuestas[t.id] || '').trim();
    if (!texto) { alert('Escribí la respuesta.'); return; }
    try {
      await responderMensaje(t, texto, cerrar);
      setRespuestas(r => ({ ...r, [t.id]: '' }));
      await cargar();
    } catch (e) {
      alert(`No se pudo responder: ${e.message}`);
    }
  };

  // Quien no es admin ve solo lo suyo: los pedidos de otras áreas no le sirven
  // y llenarían la pantalla.
  const visibles = lista.filter(t => {
    if (!soyAdmin && t.creadoPorEmail !== yo.email) return false;
    if (filtro === 'todos') return true;
    if (filtro === 'pendientes') return t.estado !== 'cerrado';
    if (filtro === 'respondidos') return !!t.respuestaAdmin;
    return true;
  });

  const pendientes = lista.filter(t => t.estado !== 'cerrado').length;

  return (
    <div className="rc-wrap">
      <div className="rc-cab">
        <h1>📝 Reportar un cambio</h1>
        <p>
          ¿Algo no funciona como debería, o se te ocurre una mejora? Contalo acá.
          Queda registrado y vas a ver la respuesta en esta misma pantalla.
        </p>
      </div>

      {/* ── Formulario ──────────────────────────────────────────────────── */}
      <div className="rc-form">
        <div className="rc-fila">
          <div className="rc-campo">
            <label>¿De qué parte del sistema?</label>
            <select value={area} onChange={(e) => setArea(e.target.value)}>
              {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="rc-campo">
            <label>¿Qué tan urgente es?</label>
            <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)}>
              {URGENCIAS.map(u => <option key={u.valor} value={u.valor}>{u.label}</option>)}
            </select>
          </div>
        </div>

        <div className="rc-campo">
          <label>En una línea, ¿qué querés cambiar?</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: El peso del PD-14 sale duplicado en el reporte"
            maxLength={160}
          />
        </div>

        <div className="rc-campo">
          <label>Contalo con detalle</label>
          <textarea
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            rows={5}
            placeholder={'Qué hiciste, qué pasó y qué esperabas que pasara.\n\nSi es sobre un formulario puntual, poné su número: se arregla mucho más rápido con un caso concreto que con una descripción general.'}
          />
          <small>
            Mientras más concreto, mejor: el número del formulario, el código del
            formato y la fecha ahorran medio día de búsqueda.
          </small>
        </div>

        <button className="rc-enviar" onClick={enviar} disabled={enviando}>
          {enviando ? 'Enviando…' : '📨 Enviar reporte'}
        </button>
      </div>

      {/* ── Listado ─────────────────────────────────────────────────────── */}
      <div className="rc-lista-cab">
        <h2>{soyAdmin ? `Reportes del equipo (${pendientes} sin cerrar)` : 'Mis reportes'}</h2>
        <div className="rc-filtros">
          {[['todos', 'Todos'], ['pendientes', 'Sin cerrar'], ['respondidos', 'Respondidos']].map(([k, l]) => (
            <button key={k} className={filtro === k ? 'activo' : ''} onClick={() => setFiltro(k)}>{l}</button>
          ))}
          <button onClick={cargar} title="Volver a cargar">🔄</button>
        </div>
      </div>

      {cargando && <div className="rc-vacio">Cargando…</div>}

      {!cargando && visibles.length === 0 && (
        <div className="rc-vacio">
          {soyAdmin ? 'No hay reportes todavía.' : 'Todavía no reportaste nada. Usá el formulario de arriba.'}
        </div>
      )}

      {visibles.map(t => (
        <div key={t.id} className={`rc-item rc-${t.estado || 'abierto'}`}>
          <div className="rc-item-cab">
            <span className="rc-titulo">{t.titulo}</span>
            <span className={`rc-estado rc-e-${t.estado || 'abierto'}`}>
              {ESTADOS_MENSAJE.find(e => e.valor === t.estado)?.label || t.estado || 'abierto'}
            </span>
          </div>

          <div className="rc-meta">
            {t.creadoPorNombre} · {fechaCorta(t.creadoEn)}
          </div>

          <div className="rc-detalle">{t.descripcion}</div>

          {t.respuestaAdmin && (
            <div className="rc-respuesta">
              <div className="rc-respuesta-cab">
                ✅ Respuesta de {t.respondidoPor} · {fechaCorta(t.respondidoEn)}
              </div>
              {t.respuestaAdmin}
            </div>
          )}

          {soyAdmin && (
            <div className="rc-responder">
              <textarea
                value={respuestas[t.id] || ''}
                onChange={(e) => setRespuestas(r => ({ ...r, [t.id]: e.target.value }))}
                rows={2}
                placeholder="Responder…"
              />
              <div className="rc-acciones">
                <button onClick={() => responder(t, false)}>💬 Responder</button>
                <button className="rc-cerrar" onClick={() => responder(t, true)}>✅ Responder y cerrar</button>
                {t.estado !== 'en_progreso' && (
                  <button onClick={async () => { await cambiarEstado(t, 'en_progreso'); cargar(); }}>
                    🔧 En progreso
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
