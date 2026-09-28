import { useCallback, useEffect, useMemo, useState } from 'react';
import NovedadTarjeta from '../components/NovedadTarjeta';
import {
  IMPORTANCIAS, puedePublicar, listarVigentes, listarTodas, marcarLeidas,
  crearNovedad, actualizarNovedad, eliminarNovedad, lecturasDe, estadoDe,
} from '../services/novedadesService';
import './Novedades.css';

const VACIA = {
  titulo: '', mensaje: '', importancia: 'importante', activa: true, mostrarAlEntrar: true,
  visibleDesde: '', visibleHasta: '',
};
const soloFecha = (f) => (f ? String(f).slice(0, 10) : '');

/**
 * 📢 NOVEDADES
 * - Todos: las novedades vigentes. Al abrir la pantalla quedan marcadas como leídas.
 * - Administrador: además publica, edita, archiva, elimina y ve quién leyó cada una.
 */
export default function Novedades() {
  const esAdmin = puedePublicar();
  // Desde el Inicio el administrador entra directo a publicar (?tab=administrar).
  const [pestana, setPestana] = useState(() =>
    esAdmin && new URLSearchParams(window.location.search).get('tab') === 'administrar'
      ? 'administrar' : 'vigentes');
  const [vigentes, setVigentes] = useState([]);
  const [todas, setTodas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [form, setForm] = useState(VACIA);
  const [editandoId, setEditandoId] = useState(null);
  const [volverAMostrar, setVolverAMostrar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [lecturas, setLecturas] = useState({ id: null, lista: [], cargando: false });

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const lista = await listarVigentes();
      setVigentes(lista);
      if (esAdmin) setTodas(await listarTodas());

      // Verlas en esta pantalla cuenta como leerlas.
      const sinLeer = lista.filter((n) => n.leida === false).map((n) => n.id);
      if (sinLeer.length > 0) marcarLeidas(sinLeer).catch(() => {});
    } catch (e) {
      setError(e.message || 'No se pudieron cargar las novedades.');
    } finally {
      setCargando(false);
    }
  }, [esAdmin]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiar = (campo) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [campo]: v }));
  };

  const limpiar = () => {
    setForm(VACIA);
    setEditandoId(null);
    setVolverAMostrar(false);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setAviso('');
    if (!form.titulo.trim() || !form.mensaje.trim()) {
      setError('Escribe un título y el mensaje.');
      return;
    }
    if (form.visibleDesde && form.visibleHasta && form.visibleHasta < form.visibleDesde) {
      setError('La fecha "hasta" es anterior a la fecha "desde".');
      return;
    }
    setGuardando(true);
    try {
      if (editandoId) {
        await actualizarNovedad(editandoId, form, { volverAMostrar });
        setAviso(volverAMostrar
          ? '✅ Novedad actualizada. Todos la van a ver de nuevo al entrar.'
          : '✅ Novedad actualizada.');
      } else {
        await crearNovedad(form);
        setAviso(form.mostrarAlEntrar
          ? '✅ Novedad publicada. Cada usuario la verá en pantalla completa al entrar al sistema.'
          : '✅ Novedad publicada. Aparece en el Inicio y en Novedades.');
      }
      limpiar();
      await cargar();
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const editar = (n) => {
    setEditandoId(n.id);
    setVolverAMostrar(false);
    setForm({
      titulo: n.titulo || '',
      mensaje: n.mensaje || '',
      importancia: n.importancia || 'info',
      activa: n.activa !== false,
      mostrarAlEntrar: n.mostrarAlEntrar !== false,
      visibleDesde: soloFecha(n.visibleDesde),
      visibleHasta: soloFecha(n.visibleHasta),
    });
    setPestana('administrar');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const alternarArchivo = async (n) => {
    try {
      await actualizarNovedad(n.id, {
        titulo: n.titulo, mensaje: n.mensaje, importancia: n.importancia,
        activa: !n.activa,
        mostrarAlEntrar: n.mostrarAlEntrar !== false,
        visibleDesde: soloFecha(n.visibleDesde) || null,
        visibleHasta: soloFecha(n.visibleHasta) || null,
      });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const eliminar = async (n) => {
    if (!window.confirm(`¿Eliminar la novedad "${n.titulo}"?\nTambién se borra el registro de quién la leyó.`)) return;
    try {
      await eliminarNovedad(n.id);
      if (editandoId === n.id) limpiar();
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const verLecturas = async (n) => {
    if (lecturas.id === n.id) {
      setLecturas({ id: null, lista: [], cargando: false });
      return;
    }
    setLecturas({ id: n.id, lista: [], cargando: true });
    try {
      setLecturas({ id: n.id, lista: await lecturasDe(n.id), cargando: false });
    } catch (err) {
      setLecturas({ id: null, lista: [], cargando: false });
      setError(err.message);
    }
  };

  const hoy = useMemo(() => new Date(), [todas]);

  return (
    <div className="nov-pagina">
      <div className="nov-encabezado">
        <h1>📢 Novedades</h1>
        <p>Avisos de la administración para todo el personal.</p>
      </div>

      {esAdmin && (
        <div className="nov-pestanas" role="tablist">
          <button type="button" role="tab" aria-selected={pestana === 'vigentes'}
                  className={pestana === 'vigentes' ? 'activa' : ''} onClick={() => setPestana('vigentes')}>
            Lo que ven todos ({vigentes.length})
          </button>
          <button type="button" role="tab" aria-selected={pestana === 'administrar'}
                  className={pestana === 'administrar' ? 'activa' : ''} onClick={() => setPestana('administrar')}>
            ✍️ Publicar y administrar ({todas.length})
          </button>
        </div>
      )}

      {error && <div className="nov-error" role="alert">{error}</div>}
      {aviso && <div className="nov-ok" role="status">{aviso}</div>}

      {/* ── Lo que ven todos ── */}
      {(!esAdmin || pestana === 'vigentes') && (
        <section>
          {cargando ? (
            <div className="nov-cargando">Cargando…</div>
          ) : vigentes.length === 0 ? (
            <div className="nov-vacio">No hay novedades por ahora. 👍</div>
          ) : (
            <div className="nov-lista">
              {vigentes.map((n) => <NovedadTarjeta key={n.id} novedad={n} nueva={n.leida === false} />)}
            </div>
          )}
        </section>
      )}

      {/* ── Administración ── */}
      {esAdmin && pestana === 'administrar' && (
        <section>
          <form className="nov-formulario" onSubmit={guardar}>
            <h2>{editandoId ? '✏️ Editar novedad' : '➕ Nueva novedad'}</h2>

            <label className="nov-campo">
              <span>Título</span>
              <input type="text" value={form.titulo} onChange={cambiar('titulo')} maxLength={200}
                     placeholder="Ej: Cambio en el formato FOR-PD-07" required />
            </label>

            <label className="nov-campo">
              <span>Mensaje</span>
              <textarea value={form.mensaje} onChange={cambiar('mensaje')} rows={6} required
                        placeholder="Escribe aquí la novedad. Los saltos de línea se respetan." />
            </label>

            <div className="nov-fila">
              <label className="nov-campo">
                <span>Importancia</span>
                <select value={form.importancia} onChange={cambiar('importancia')}>
                  {IMPORTANCIAS.map((i) => <option key={i.valor} value={i.valor}>{i.etiqueta}</option>)}
                </select>
              </label>
              <label className="nov-campo">
                <span>Mostrar desde (opcional)</span>
                <input type="date" value={form.visibleDesde} onChange={cambiar('visibleDesde')} />
              </label>
              <label className="nov-campo">
                <span>Mostrar hasta (opcional)</span>
                <input type="date" value={form.visibleHasta} onChange={cambiar('visibleHasta')} />
              </label>
            </div>

            <label className="nov-check nov-check-grande">
              <input type="checkbox" checked={form.mostrarAlEntrar} onChange={cambiar('mostrarAlEntrar')} />
              <span>
                <strong>📺 Novedad grande: mostrar en pantalla completa al entrar</strong>
                <small>Todos la ven antes de poder usar el sistema y confirman que la leyeron.
                  Si la desmarcas, solo aparece en el Inicio y en Novedades.</small>
              </span>
            </label>

            <label className="nov-check">
              <input type="checkbox" checked={form.activa} onChange={cambiar('activa')} />
              Visible (si la desmarcas queda archivada y nadie la ve)
            </label>

            {editandoId && (
              <label className="nov-check">
                <input type="checkbox" checked={volverAMostrar} onChange={(e) => setVolverAMostrar(e.target.checked)} />
                Volver a mostrar a todos (también a quienes ya la leyeron)
              </label>
            )}

            {(form.titulo || form.mensaje) && (
              <div className="nov-vista-previa">
                <span className="nov-vista-previa-etiqueta">Así la van a ver:</span>
                <NovedadTarjeta novedad={{ ...form, creadoPorNombre: 'Tú', createdAt: new Date().toISOString() }} nueva />
              </div>
            )}

            <div className="nov-botones">
              <button type="submit" className="nov-boton-principal" disabled={guardando}>
                {guardando ? 'Guardando…' : editandoId ? '💾 Guardar cambios' : '📢 Publicar'}
              </button>
              {editandoId && (
                <button type="button" className="nov-boton-secundario" onClick={limpiar} disabled={guardando}>
                  Cancelar edición
                </button>
              )}
            </div>
          </form>

          <h2 className="nov-subtitulo">Todas las novedades</h2>
          {cargando ? (
            <div className="nov-cargando">Cargando…</div>
          ) : todas.length === 0 ? (
            <div className="nov-vacio">Todavía no se publicó ninguna.</div>
          ) : (
            <div className="nov-lista">
              {todas.map((n) => (
                <div key={n.id}>
                  <NovedadTarjeta
                    novedad={n}
                    estado={estadoDe(n, hoy)}
                    acciones={(
                      <>
                        <button type="button" onClick={() => verLecturas(n)}>👁️ Leída por {n.lecturas ?? 0}</button>
                        <button type="button" onClick={() => editar(n)}>✏️ Editar</button>
                        <button type="button" onClick={() => alternarArchivo(n)}>
                          {n.activa ? '🗄️ Archivar' : '♻️ Reactivar'}
                        </button>
                        <button type="button" className="nov-peligro" onClick={() => eliminar(n)}>🗑️ Eliminar</button>
                      </>
                    )}
                  />
                  {lecturas.id === n.id && (
                    <div className="nov-lecturas">
                      {lecturas.cargando ? 'Cargando…'
                        : lecturas.lista.length === 0 ? 'Nadie la leyó todavía.'
                        : (
                          <table>
                            <thead><tr><th>Usuario</th><th>Nombre</th><th>Leída el</th></tr></thead>
                            <tbody>
                              {lecturas.lista.map((l) => (
                                <tr key={l.usuario}>
                                  <td>{l.usuario}</td>
                                  <td>{l.nombreUsuario || '—'}</td>
                                  <td>{new Date(l.leidaEn).toLocaleString('es-EC')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
