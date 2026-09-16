import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import personalService from '../services/personalService';
import { exportarPersonalExcel } from '../services/personalExcelService';
import { ordenarFormularios, etiquetaFormulario } from '../utils/ordenFormularios';
import {
  COLUMNAS_PERSONAL,
  definicionColumna,
  valorTexto,
  leerConfigGuardada,
  guardarConfig,
  configPorDefecto,
} from '../utils/personalColumnas';
import {
  analizarAgrupacion,
  aHoraTexto,
  duracionTexto,
  recomendacionGrupo,
} from '../utils/agrupacionPersonal';
import './PersonalDashboard.css';

const hoy = () => new Date().toISOString().split('T')[0];
const haceDias = (d) => new Date(Date.now() - d * 86400000).toISOString().split('T')[0];

const ESTANDAR_VACIO = {
  id: null,
  templateID: '',
  proceso: '',
  tiempoEstimadoHoras: '',
  activo: true,
};

export default function PersonalDashboard() {
  const [filters, setFilters] = useState({ desde: haceDias(30), hasta: hoy(), templateId: '', proceso: '' });
  const [registros, setRegistros] = useState([]);
  const [formularios, setFormularios] = useState([]);
  const [estandares, setEstandares] = useState([]);
  const [vista, setVista] = useState('registros'); // 'registros' | 'estandares'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formEstandar, setFormEstandar] = useState(ESTANDAR_VACIO);
  const [guardandoEstandar, setGuardandoEstandar] = useState(false);
  const [errorEstandar, setErrorEstandar] = useState('');

  // Columnas: qué se ve y en qué orden. Manda igual en la tabla y en el Excel.
  const [columnas, setColumnas] = useState(() => leerConfigGuardada());
  const [panelColumnas, setPanelColumnas] = useState(false);
  const [exportando, setExportando] = useState(false);

  // Agrupación: "misma naturaleza" puede significar mismo formulario (fileteo
  // vs productividad) o mismo proceso, según cómo esté cargado el dato.
  const [agruparPor, setAgruparPor] = useState('formulario');

  useEffect(() => { guardarConfig(columnas); }, [columnas]);

  const cargarRegistros = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await personalService.getExtraidos(filters);
      setRegistros(data);
    } catch (err) {
      setError(err.message || 'Error al cargar los registros de Control de Personal.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const cargarFormulariosYEstandares = useCallback(async () => {
    try {
      const [forms, ests] = await Promise.all([
        personalService.getFormularios(),
        personalService.getEstandares(),
      ]);
      setFormularios(forms);
      setEstandares(ests);
    } catch {
      // silencioso: no bloquea la vista de registros
    }
  }, []);

  useEffect(() => { cargarRegistros(); }, [cargarRegistros]);
  useEffect(() => { cargarFormulariosYEstandares(); }, [cargarFormulariosYEstandares]);

  const totales = useMemo(() => {
    return registros.reduce((acc, r) => ({
      planta: acc.planta + (r.personalPlanta || 0),
      externo: acc.externo + (r.personalExterno || 0),
      horas: acc.horas + (r.horasTrabajadas || 0),
      formularios: acc.formularios + 1,
      incumplimientos: acc.incumplimientos + (r.cumpleEstandar ? 0 : 1),
    }), { planta: 0, externo: 0, horas: 0, formularios: 0, incumplimientos: 0 });
  }, [registros]);

  const handleFilterChange = (campo, valor) => {
    setFilters(prev => ({ ...prev, [campo]: valor }));
  };

  // ── Columnas ───────────────────────────────────────────────────────────────
  const columnasVisibles = useMemo(
    () => columnas.filter(c => c.visible).map(c => c.id),
    [columnas],
  );

  const alternarColumna = (id) => {
    setColumnas(prev => {
      const siguiente = prev.map(c => (c.id === id ? { ...c, visible: !c.visible } : c));
      // Dejar cero columnas rompería la tabla; se ignora el último apagado.
      return siguiente.some(c => c.visible) ? siguiente : prev;
    });
  };

  const moverColumna = (id, delta) => {
    setColumnas(prev => {
      const i = prev.findIndex(c => c.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const siguiente = [...prev];
      [siguiente[i], siguiente[j]] = [siguiente[j], siguiente[i]];
      return siguiente;
    });
  };

  // ── Agrupación por día ─────────────────────────────────────────────────────
  const agrupacion = useMemo(
    () => analizarAgrupacion(registros, agruparPor),
    [registros, agruparPor],
  );

  // ── Exportar a Excel ───────────────────────────────────────────────────────
  // (definido más abajo, después de buscarFormulario)

  // Mismo orden por código (FOR-PD-04 antes que FOR-PD-14) que el resto del
  // sistema, para que un formulario como Fileteo sea fácil de encontrar en
  // una lista con decenas de plantillas en vez de quedar perdido por fecha.
  const formulariosOrdenados = useMemo(() => ordenarFormularios(formularios), [formularios]);

  const buscarFormulario = (id) => formularios.find(f => (f.templateID ?? f.TemplateID) === Number(id));

  // ── Exportar a Excel ───────────────────────────────────────────────────────
  // Va después de buscarFormulario a propósito: mantener las declaraciones en
  // orden de uso evita sorpresas cuando algo pase a un array de dependencias.
  const exportarExcel = async () => {
    try {
      setExportando(true);
      setError('');
      const tpl = buscarFormulario(filters.templateId);
      await exportarPersonalExcel({
        registros,
        columnas: columnasVisibles,
        filtros: filters,
        totales,
        agrupacion,
        nombreFormulario: tpl ? etiquetaFormulario(tpl) : '',
      });
    } catch (err) {
      setError(err.message || 'Error al generar el archivo Excel.');
    } finally {
      setExportando(false);
    }
  };

  const handleSeleccionarFormulario = (templateId) => {
    const tpl = buscarFormulario(templateId);
    setFormEstandar(prev => ({
      ...prev,
      templateID: templateId,
      proceso: tpl?.proceso || tpl?.Proceso || prev.proceso,
    }));
  };

  const iniciarEdicionEstandar = (est) => {
    setFormEstandar({
      id: est.id,
      templateID: est.templateID ?? '',
      proceso: est.proceso || '',
      tiempoEstimadoHoras: est.duracionMaximaHoras ?? '',
      activo: est.activo,
    });
    setErrorEstandar('');
    setVista('estandares');
  };

  const cancelarEdicionEstandar = () => {
    setFormEstandar(ESTANDAR_VACIO);
    setErrorEstandar('');
  };

  const guardarEstandar = async (e) => {
    e.preventDefault();
    if (!formEstandar.templateID) {
      setErrorEstandar('Selecciona el formulario al que aplica este tiempo estimado.');
      return;
    }
    if (!formEstandar.proceso.trim()) {
      setErrorEstandar('El proceso es obligatorio.');
      return;
    }
    if (formEstandar.tiempoEstimadoHoras === '' || Number(formEstandar.tiempoEstimadoHoras) <= 0) {
      setErrorEstandar('Indica el tiempo estimado en horas (ej: 5).');
      return;
    }

    const dto = {
      templateID: Number(formEstandar.templateID),
      proceso: formEstandar.proceso.trim(),
      duracionMaximaHoras: Number(formEstandar.tiempoEstimadoHoras),
      activo: formEstandar.activo,
    };

    try {
      setGuardandoEstandar(true);
      setErrorEstandar('');
      if (formEstandar.id) {
        await personalService.actualizarEstandar(formEstandar.id, dto);
      } else {
        await personalService.crearEstandar(dto);
      }
      setFormEstandar(ESTANDAR_VACIO);
      await cargarFormulariosYEstandares();
      await cargarRegistros();
    } catch (err) {
      setErrorEstandar(err.message || 'Error al guardar el tiempo estimado.');
    } finally {
      setGuardandoEstandar(false);
    }
  };

  const eliminarEstandar = async (id) => {
    if (!window.confirm('¿Eliminar este tiempo estimado?')) return;
    try {
      await personalService.eliminarEstandar(id);
      await cargarFormulariosYEstandares();
      await cargarRegistros();
    } catch (err) {
      setError(err.message || 'Error al eliminar el estándar.');
    }
  };

  return (
    <div className="pd-page">
      <div className="pd-header">
        <h1>👥 Control del Personal por Formulario</h1>
        <p className="pd-sub">
          Datos extraídos directamente de la tabla "Control del Personal" dentro de cada formulario:
          suma el personal de planta/externo y calcula la hora de inicio y fin real del formulario.
        </p>
        <Link to="/registro-personal" className="pd-link-btn">➕ Registro manual de Personal</Link>
      </div>

      <div className="pd-filtros">
        <div className="pd-campo">
          <label>Desde</label>
          <input type="date" value={filters.desde} onChange={(e) => handleFilterChange('desde', e.target.value)} />
        </div>
        <div className="pd-campo">
          <label>Hasta</label>
          <input type="date" value={filters.hasta} onChange={(e) => handleFilterChange('hasta', e.target.value)} />
        </div>
        <div className="pd-campo pd-campo-ancho">
          <label>Formulario</label>
          <select value={filters.templateId} onChange={(e) => handleFilterChange('templateId', e.target.value)}>
            <option value="">Todos los formularios</option>
            {formulariosOrdenados.map(f => (
              <option key={f.templateID ?? f.TemplateID} value={f.templateID ?? f.TemplateID}>
                {etiquetaFormulario(f)}
              </option>
            ))}
          </select>
        </div>
        <div className="pd-campo pd-campo-ancho">
          <label>Proceso</label>
          <input
            type="text"
            value={filters.proceso}
            onChange={(e) => handleFilterChange('proceso', e.target.value)}
            placeholder="Filtrar por proceso…"
          />
        </div>
      </div>

      {error && <div className="pd-error">{error}</div>}

      <div className="pd-kpis">
        <div className="pd-kpi">
          <span className="pd-kpi-label">Horas-hombre</span>
          <span className="pd-kpi-valor">{totales.horas.toFixed(1)}</span>
        </div>
        <div className="pd-kpi">
          <span className="pd-kpi-label">Personal planta</span>
          <span className="pd-kpi-valor">{totales.planta}</span>
        </div>
        <div className="pd-kpi">
          <span className="pd-kpi-label">Personal externo</span>
          <span className="pd-kpi-valor">{totales.externo}</span>
        </div>
        <div className="pd-kpi">
          <span className="pd-kpi-label">Formularios</span>
          <span className="pd-kpi-valor">{totales.formularios}</span>
        </div>
        <div className="pd-kpi pd-kpi-alerta">
          <span className="pd-kpi-label">Fuera de estándar</span>
          <span className="pd-kpi-valor">{totales.incumplimientos}</span>
        </div>
      </div>

      <div className="pd-tabs">
        <button
          className={`pd-tab ${vista === 'registros' ? 'active' : ''}`}
          onClick={() => setVista('registros')}
        >
          Registros por formulario
        </button>
        <button
          className={`pd-tab ${vista === 'agrupacion' ? 'active' : ''}`}
          onClick={() => setVista('agrupacion')}
        >
          📅 Agrupación por día
        </button>
        <button
          className={`pd-tab ${vista === 'estandares' ? 'active' : ''}`}
          onClick={() => setVista('estandares')}
        >
          ⚙️ Configurar tiempo estimado por formulario
        </button>
      </div>

      {(vista === 'registros' || vista === 'agrupacion') && (
        <div className="pd-toolbar">
          <span className="pd-toolbar-info">
            {registros.length} registro{registros.length === 1 ? '' : 's'} en el período
          </span>

          <div className="pd-toolbar-acciones">
            {vista === 'agrupacion' && (
              <div className="pd-agrupar-por">
                <span>Agrupar por</span>
                <button
                  className={`pd-chip ${agruparPor === 'formulario' ? 'active' : ''}`}
                  onClick={() => setAgruparPor('formulario')}
                >
                  Formulario
                </button>
                <button
                  className={`pd-chip ${agruparPor === 'proceso' ? 'active' : ''}`}
                  onClick={() => setAgruparPor('proceso')}
                >
                  Proceso
                </button>
              </div>
            )}

            {vista === 'registros' && (
              <div className="pd-columnas-wrap">
                <button
                  className="pd-btn pd-btn-secundario"
                  onClick={() => setPanelColumnas(v => !v)}
                >
                  ⚙ Columnas ({columnasVisibles.length}/{COLUMNAS_PERSONAL.length})
                </button>

                {panelColumnas && (
                  <div className="pd-columnas-panel">
                    <div className="pd-columnas-titulo">
                      <span>Columnas de la tabla y del Excel</span>
                      <button className="pd-btn-mini" onClick={() => setColumnas(configPorDefecto())}>
                        Restablecer
                      </button>
                    </div>
                    <p className="pd-columnas-ayuda">
                      Desmarca para quitarla. Las flechas cambian el orden.
                    </p>
                    <ul className="pd-columnas-lista">
                      {columnas.map((c, i) => (
                        <li key={c.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={c.visible}
                              onChange={() => alternarColumna(c.id)}
                            />
                            {definicionColumna(c.id).label}
                          </label>
                          <span className="pd-columnas-orden">
                            <button
                              className="pd-btn-mini"
                              disabled={i === 0}
                              onClick={() => moverColumna(c.id, -1)}
                              title="Subir"
                            >↑</button>
                            <button
                              className="pd-btn-mini"
                              disabled={i === columnas.length - 1}
                              onClick={() => moverColumna(c.id, 1)}
                              title="Bajar"
                            >↓</button>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <button
                      className="pd-btn pd-btn-secundario pd-columnas-cerrar"
                      onClick={() => setPanelColumnas(false)}
                    >
                      Cerrar
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              className="pd-btn"
              onClick={exportarExcel}
              disabled={exportando || registros.length === 0}
            >
              {exportando ? 'Generando…' : '📥 Descargar Excel'}
            </button>
          </div>
        </div>
      )}

      {vista === 'registros' ? (
        loading ? (
          <div className="pd-loading">Cargando…</div>
        ) : (
          <div className="pd-tabla-wrap">
            <table>
              <thead>
                <tr>
                  {columnasVisibles.map(id => (
                    <th key={id}>{definicionColumna(id).label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.length === 0 && (
                  <tr><td colSpan={columnasVisibles.length} className="pd-vacio">Sin registros de Control de Personal en el período seleccionado.</td></tr>
                )}
                {registros.map((r, i) => {
                  // ── Encadenado del FLUJO ────────────────────────────────
                  // Cada formulario es UN PASO del proceso: recepción de 07 a
                  // 08, fileteo de 08 a 10, empaque de 10 a 16. Son formularios
                  // distintos que juntos forman la jornada.
                  //
                  // Dos pasos son del mismo flujo cuando comparten día y destino
                  // Y la hora de fin de uno es la de inicio del otro. Esa
                  // continuidad horaria es la señal: si terminó a las 10 y el
                  // siguiente arranca a las 10, es la misma cadena.
                  //
                  // Vistos sueltos, cada paso parecía un turno incompleto de dos
                  // o tres horas. Encadenados se ve la jornada entera.
                  const mismaCadena = (a, b) => {
                    if (!a || !b) return false;
                    if (String(a.fecha).split('T')[0] !== String(b.fecha).split('T')[0]) return false;

                    // El LOTE manda. Dos formularios del mismo lote son pasos del
                    // mismo flujo aunque se hayan cargado desordenados, aunque
                    // corran en paralelo o aunque haya una pausa entre ellos.
                    const loteA = String(a.lote || '').trim();
                    const loteB = String(b.lote || '').trim();
                    if (loteA && loteB) return loteA === loteB;

                    // Sin lote no hay forma de saber que son el mismo recorrido:
                    // se cae al destino y a la continuidad horaria, que es una
                    // aproximación y solo funciona si son estrictamente seguidos.
                    if ((a.destino || '') !== (b.destino || '')) return false;
                    const fin = (a.horaFin || '').substring(0, 5);
                    const ini = (b.horaInicio || '').substring(0, 5);
                    return !!fin && !!ini && fin === ini;
                  };

                  const anterior = registros[i - 1];
                  const siguiente = registros[i + 1];
                  const mismoQueAnterior  = mismaCadena(anterior, r);
                  const mismoQueSiguiente = mismaCadena(r, siguiente);
                  // Cambio de día o de destino: línea marcada arriba. Sin ella
                  // el listado se lee como un bloque corrido y no se distingue
                  // dónde termina una jornada y empieza otra.
                  const cambiaGrupo = anterior && (
                    String(anterior.fecha).split('T')[0] !== String(r.fecha).split('T')[0]
                    || (anterior.destino || '') !== (r.destino || '')
                  );

                  const clases = [
                    mismoQueAnterior  ? 'pd-flujo-cont'  : '',
                    mismoQueSiguiente ? 'pd-flujo-sigue' : '',
                    (mismoQueAnterior || mismoQueSiguiente) ? 'pd-flujo' : '',
                    cambiaGrupo ? 'pd-corte' : '',
                  ].filter(Boolean).join(' ');

                  return (
                  <tr key={`${r.formID}-${i}`} className={clases}>
                    {columnasVisibles.map(id => (
                      <td
                        key={id}
                        className={
                          id === 'observacion'
                            ? (!r.cumpleEstandar ? 'pd-celda-alerta pd-obs' : 'pd-obs')
                            : undefined
                        }
                      >
                        {/* En una continuación no se repiten el código, el
                            número ni la fecha: son los mismos y repetirlos hace
                            leer cuatro registros donde hay uno. */}
                        {/* En un paso encadenado solo se omiten fecha y destino,
                            que son los del flujo. El código, el número y el
                            proceso SÍ se muestran: cada paso es un formulario
                            distinto y hay que poder identificarlo. */}
                        {mismoQueAnterior && ['fecha', 'destino', 'lote'].includes(id)
                          ? <span className="pd-idem">↳</span>
                          : valorTexto(r, id)}
                      </td>
                    ))}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : vista === 'agrupacion' ? (
        loading ? (
          <div className="pd-loading">Cargando…</div>
        ) : (
          <div className="pd-agrupacion">
            <p className="pd-sub">
              Cada barra es la franja del día en que se trabajó ese proceso. Las barras
              cortadas en varios pedazos son tareas de la misma naturaleza repartidas a
              lo largo de la jornada: juntarlas evita arranques y paradas.
            </p>

            {agrupacion.length === 0 && (
              <div className="pd-vacio">Sin registros con horario en el período seleccionado.</div>
            )}

            {agrupacion.map(dia => {
              const span = dia.rango ? Math.max(dia.rango.fin - dia.rango.inicio, 1) : 1;
              const pct = (min) => ((min - dia.rango.inicio) / span) * 100;

              return (
                <div key={dia.clave} className="pd-dia">
                  <div className="pd-dia-cabecera">
                    <h3>{dia.fecha.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                    <div className="pd-dia-badges">
                      {dia.rango && (
                        <span className="pd-badge">
                          {aHoraTexto(dia.rango.inicio)}–{aHoraTexto(dia.rango.fin)}
                        </span>
                      )}
                      {dia.gruposFragmentados > 0 && (
                        <span className="pd-badge pd-badge-alerta">
                          {dia.gruposFragmentados} sin agrupar · {duracionTexto(dia.minutosDispersos)} muertos
                        </span>
                      )}
                      {dia.solapes.length > 0 && (
                        <span className="pd-badge pd-badge-aviso">
                          {dia.solapes.length} en paralelo
                        </span>
                      )}
                      {dia.sinHorario > 0 && (
                        <span className="pd-badge">{dia.sinHorario} sin horario</span>
                      )}
                    </div>
                  </div>

                  {dia.grupos.map(g => (
                    <div key={g.clave} className={`pd-grupo ${g.fragmentado ? 'fragmentado' : ''}`}>
                      <div className="pd-grupo-nombre" title={g.clave}>{g.clave}</div>
                      <div className="pd-grupo-barra">
                        {g.tramos.map((t, i) => (
                          <div
                            key={i}
                            className="pd-tramo"
                            style={{ left: `${pct(t.inicio)}%`, width: `${Math.max(((t.fin - t.inicio) / span) * 100, 1.2)}%` }}
                            title={`${aHoraTexto(t.inicio)}–${aHoraTexto(t.fin)}`}
                          />
                        ))}
                      </div>
                      <div className="pd-grupo-datos">
                        <strong>{duracionTexto(g.minutosTrabajados)}</strong>
                        <span>{g.cantidadBloques} reg.</span>
                      </div>
                    </div>
                  ))}

                  <ul className="pd-recomendaciones">
                    {dia.grupos.filter(g => g.fragmentado).map(g => (
                      <li key={g.clave}>
                        <strong>{g.clave}:</strong> {recomendacionGrupo(g)}
                      </li>
                    ))}
                    {dia.solapes.map(s => (
                      <li key={s.id}>
                        <strong>{s.a}</strong> y <strong>{s.b}</strong> corrieron en paralelo{' '}
                        {duracionTexto(s.minutos)} ({aHoraTexto(s.desde)}–{aHoraTexto(s.hasta)});
                        conviene secuenciarlas.
                      </li>
                    ))}
                    {dia.gruposFragmentados === 0 && dia.solapes.length === 0 && dia.grupos.length > 0 && (
                      <li className="pd-ok">Jornada agrupada y en secuencia: nada que corregir.</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="pd-estandares">
          <form className="pd-form-estandar" onSubmit={guardarEstandar}>
            <h3>{formEstandar.id ? 'Editar tiempo estimado' : 'Nuevo tiempo estimado por formulario'}</h3>

            {errorEstandar && <div className="pd-error">{errorEstandar}</div>}

            <div className="pd-form-fila">
              <div className="pd-campo pd-campo-ancho">
                <label>Formulario *</label>
                <select
                  value={formEstandar.templateID}
                  onChange={(e) => handleSeleccionarFormulario(e.target.value)}
                >
                  <option value="">Selecciona un formulario…</option>
                  {formulariosOrdenados.map(f => (
                    <option key={f.templateID ?? f.TemplateID} value={f.templateID ?? f.TemplateID}>
                      {etiquetaFormulario(f)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pd-campo pd-campo-ancho">
                <label>Proceso *</label>
                <input
                  type="text"
                  value={formEstandar.proceso}
                  onChange={(e) => setFormEstandar(prev => ({ ...prev, proceso: e.target.value }))}
                  placeholder="Ej: Fileteo"
                />
              </div>
            </div>

            <div className="pd-form-fila">
              <div className="pd-campo">
                <label>Tiempo estimado (horas) *</label>
                <input
                  type="number" step="0.5" min="0"
                  value={formEstandar.tiempoEstimadoHoras}
                  onChange={(e) => setFormEstandar(prev => ({ ...prev, tiempoEstimadoHoras: e.target.value }))}
                  placeholder="Ej: 5"
                />
              </div>
              <div className="pd-campo pd-campo-check">
                <label>
                  <input
                    type="checkbox"
                    checked={formEstandar.activo}
                    onChange={(e) => setFormEstandar(prev => ({ ...prev, activo: e.target.checked }))}
                  />
                  Activo
                </label>
              </div>
            </div>

            <div className="pd-form-acciones">
              <button type="submit" className="pd-btn" disabled={guardandoEstandar}>
                {guardandoEstandar ? 'Guardando…' : formEstandar.id ? 'Actualizar' : 'Guardar'}
              </button>
              {formEstandar.id && (
                <button type="button" className="pd-btn pd-btn-secundario" onClick={cancelarEdicionEstandar}>
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="pd-tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Formulario</th>
                  <th>Proceso</th>
                  <th>Tiempo estimado (h)</th>
                  <th>Activo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {estandares.length === 0 && (
                  <tr><td colSpan={5} className="pd-vacio">Aún no hay tiempos estimados configurados.</td></tr>
                )}
                {estandares.map(est => (
                  <tr key={est.id}>
                    <td>{est.formularioNombre || <em>Por proceso</em>}</td>
                    <td>{est.proceso}</td>
                    <td>{est.duracionMaximaHoras ?? '—'}</td>
                    <td>{est.activo ? 'Sí' : 'No'}</td>
                    <td className="pd-acciones-celda">
                      <button className="pd-btn-mini" onClick={() => iniciarEdicionEstandar(est)}>Editar</button>
                      <button className="pd-btn-mini pd-btn-mini-danger" onClick={() => eliminarEstandar(est.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}