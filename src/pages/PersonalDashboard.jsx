import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import personalService from '../services/personalService';
import { ordenarFormularios, etiquetaFormulario } from '../utils/ordenFormularios';
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

// TimeSpan del backend llega como "HH:MM:SS" -> input[type=time] necesita "HH:MM"
const aInputHora = (ts) => (ts ? String(ts).substring(0, 5) : '');

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

  // Mismo orden por código (FOR-PD-04 antes que FOR-PD-14) que el resto del
  // sistema, para que un formulario como Fileteo sea fácil de encontrar en
  // una lista con decenas de plantillas en vez de quedar perdido por fecha.
  const formulariosOrdenados = useMemo(() => ordenarFormularios(formularios), [formularios]);

  const buscarFormulario = (id) => formularios.find(f => (f.templateID ?? f.TemplateID) === Number(id));

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
          className={`pd-tab ${vista === 'estandares' ? 'active' : ''}`}
          onClick={() => setVista('estandares')}
        >
          ⚙️ Configurar tiempo estimado por formulario
        </button>
      </div>

      {vista === 'registros' ? (
        loading ? (
          <div className="pd-loading">Cargando…</div>
        ) : (
          <div className="pd-tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Formulario</th>
                  <th>Proceso</th>
                  <th>Fecha</th>
                  <th>Planta</th>
                  <th>Externo</th>
                  <th>Hora inicio</th>
                  <th>Hora fin</th>
                  <th>Horas</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {registros.length === 0 && (
                  <tr><td colSpan={9} className="pd-vacio">Sin registros de Control de Personal en el período seleccionado.</td></tr>
                )}
                {registros.map((r) => (
                  <tr key={r.formID}>
                    <td>{r.formulario}</td>
                    <td>{r.proceso}</td>
                    <td>{new Date(r.fecha).toLocaleDateString('es-EC')}</td>
                    <td>{r.personalPlanta}</td>
                    <td>{r.personalExterno}</td>
                    <td>{aInputHora(r.horaInicio) || '—'}</td>
                    <td>{aInputHora(r.horaFin) || '—'}</td>
                    <td>{r.horasTrabajadas != null ? r.horasTrabajadas.toFixed(2) : '—'}</td>
                    <td className={!r.cumpleEstandar ? 'pd-celda-alerta pd-obs' : 'pd-obs'}>
                      {r.observaciones || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
