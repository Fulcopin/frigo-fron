import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listarActividades, crearActividad, actualizarActividad, darDeBajaActividad,
} from '../services/actividadesService';
import './ActividadesProceso.css';

/**
 * 🏭 ACTIVIDADES DE PROCESO
 * Antes estaban escritas dentro del código: agregar una obligaba a publicar
 * una versión nueva. Acá se administran y quedan guardadas en la base.
 */
export default function ActividadesProceso() {
  const [actividades, setActividades] = useState([]);
  const [verBajas, setVerBajas] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [nueva, setNueva] = useState({ nombre: '', pescado: true, camaron: false });
  const [editando, setEditando] = useState(null);   // { id, nombre, pescado, camaron, activa }

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setActividades(await listarActividades(true));
    } catch (e) {
      setError(e.message || 'No se pudo cargar el catálogo.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return actividades
      .filter((a) => (verBajas || a.activa))
      .filter((a) => !q || String(a.nombre).toLowerCase().includes(q));
  }, [actividades, verBajas, busqueda]);

  const conMensaje = async (accion, textoOk) => {
    setError('');
    setAviso('');
    try {
      const r = await accion();
      setAviso(r?.aviso ? `${textoOk} ${r.aviso}` : textoOk);
      await cargar();
    } catch (e) {
      setError(e.message || 'No se pudo guardar.');
    }
  };

  const agregar = (e) => {
    e.preventDefault();
    if (nueva.nombre.trim().length < 2) { setError('Escribe el nombre de la actividad.'); return; }
    if (!nueva.pescado && !nueva.camaron) { setError('Elige al menos un catálogo: pescado o camarón.'); return; }
    conMensaje(() => crearActividad(nueva), `✅ "${nueva.nombre.trim()}" agregada.`)
      .then(() => setNueva({ nombre: '', pescado: true, camaron: false }));
  };

  const guardarEdicion = () => {
    conMensaje(() => actualizarActividad(editando.id, editando), '✅ Actividad actualizada.')
      .then(() => setEditando(null));
  };

  const darDeBaja = (a) => {
    if (!window.confirm(
      `¿Dar de baja "${a.nombre}"?\n\nDeja de ofrecerse al llenar y al planificar. ` +
      `Los formularios que ya la usaron NO se tocan.`)) return;
    conMensaje(() => darDeBajaActividad(a.id), `🗄️ "${a.nombre}" dada de baja.`);
  };

  const reactivar = (a) =>
    conMensaje(() => actualizarActividad(a.id, { ...a, activa: true }), `♻️ "${a.nombre}" reactivada.`);

  const totales = {
    activas: actividades.filter((a) => a.activa).length,
    pescado: actividades.filter((a) => a.activa && a.pescado).length,
    camaron: actividades.filter((a) => a.activa && a.camaron).length,
  };

  return (
    <div className="act-pagina">
      <div className="act-encabezado">
        <h1>🏭 Actividades de proceso</h1>
        <p>Las que se eligen al llenar los formularios y en el plan de producción.</p>
      </div>

      <form className="act-nueva" onSubmit={agregar}>
        <input
          type="text"
          value={nueva.nombre}
          onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
          placeholder="Nombre de la actividad (ej: Pelado de Camarón)"
          maxLength={200}
        />
        <label><input type="checkbox" checked={nueva.pescado}
                      onChange={(e) => setNueva({ ...nueva, pescado: e.target.checked })} /> 🐟 Pescado</label>
        <label><input type="checkbox" checked={nueva.camaron}
                      onChange={(e) => setNueva({ ...nueva, camaron: e.target.checked })} /> 🦐 Camarón</label>
        <button type="submit">➕ Agregar</button>
      </form>

      {error && <div className="act-error" role="alert">{error}</div>}
      {aviso && <div className="act-ok" role="status">{aviso}</div>}

      <div className="act-filtros">
        <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
               placeholder="Buscar…" />
        <label><input type="checkbox" checked={verBajas}
                      onChange={(e) => setVerBajas(e.target.checked)} /> Ver las dadas de baja</label>
        <span className="act-chip">Activas: <strong>{totales.activas}</strong></span>
        <span className="act-chip">🐟 {totales.pescado}</span>
        <span className="act-chip">🦐 {totales.camaron}</span>
      </div>

      {cargando ? (
        <div className="act-vacio">Cargando…</div>
      ) : visibles.length === 0 ? (
        <div className="act-vacio">No hay actividades para ese filtro.</div>
      ) : (
        <table className="act-tabla">
          <thead>
            <tr><th>Actividad</th><th>🐟 Pescado</th><th>🦐 Camarón</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {visibles.map((a) => {
              const enEdicion = editando?.id === a.id;
              return (
                <tr key={a.id} className={a.activa ? '' : 'act-baja'}>
                  <td>
                    {enEdicion ? (
                      <input type="text" value={editando.nombre} maxLength={200}
                             onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} />
                    ) : a.nombre}
                  </td>
                  <td>
                    <input type="checkbox" disabled={!enEdicion}
                           checked={enEdicion ? editando.pescado : !!a.pescado}
                           onChange={(e) => setEditando({ ...editando, pescado: e.target.checked })} />
                  </td>
                  <td>
                    <input type="checkbox" disabled={!enEdicion}
                           checked={enEdicion ? editando.camaron : !!a.camaron}
                           onChange={(e) => setEditando({ ...editando, camaron: e.target.checked })} />
                  </td>
                  <td>{a.activa ? '🟢 Activa' : '🗄️ De baja'}</td>
                  <td className="act-acciones">
                    {enEdicion ? (
                      <>
                        <button type="button" onClick={guardarEdicion}>💾 Guardar</button>
                        <button type="button" onClick={() => setEditando(null)}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => setEditando({
                          id: a.id, nombre: a.nombre, pescado: !!a.pescado,
                          camaron: !!a.camaron, activa: !!a.activa,
                        })}>✏️ Editar</button>
                        {a.activa
                          ? <button type="button" className="act-peligro" onClick={() => darDeBaja(a)}>🗄️ Dar de baja</button>
                          : <button type="button" onClick={() => reactivar(a)}>♻️ Reactivar</button>}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="act-nota">
        Al renombrar una actividad, <strong>los formularios ya guardados siguen con el nombre anterior</strong>:
        el plan de producción los cruza por ese texto. Dar de baja no borra nada, solo deja de ofrecerla.
      </p>
    </div>
  );
}
