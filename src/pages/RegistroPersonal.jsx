import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import personalService from '../services/personalService';
import { API_BASE_URL } from '../apiConfig';
import './RegistroPersonal.css';

const hoy = () => new Date().toISOString().split('T')[0];

const CAMPOS_VACIOS = {
  formId: '',
  proceso: '',
  fecha: hoy(),
  personalPlanta: '',
  personalExterno: '',
  horaDesde: '',
  horaHasta: '',
  observaciones: '',
};

export default function RegistroPersonal() {
  const navigate = useNavigate();

  const [formularios, setFormularios] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [campos, setCampos] = useState(CAMPOS_VACIOS);
  const [cargandoListas, setCargandoListas] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [requiereJustificacion, setRequiereJustificacion] = useState(null); // { motivo }
  const [justificacion, setJustificacion] = useState('');
  const [ultimosGuardados, setUltimosGuardados] = useState([]);
  const [exito, setExito] = useState('');

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setCargandoListas(true);
        const [formsRes, templatesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/FilledForms/list`).then(r => r.json()),
          fetch(`${API_BASE_URL}/Templates`).then(r => r.json()),
        ]);
        if (cancel) return;
        const forms = Array.isArray(formsRes) ? formsRes : (formsRes?.$values || []);
        const templates = Array.isArray(templatesRes) ? templatesRes : (templatesRes?.$values || []);
        setFormularios(forms);
        const procesosUnicos = [...new Set(templates.map(t => t.proceso || t.Proceso).filter(Boolean))];
        setProcesos(procesosUnicos.sort());
      } catch {
        if (!cancel) setError('No se pudieron cargar los formularios/procesos disponibles.');
      } finally {
        if (!cancel) setCargandoListas(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const horasCalculadas = useMemo(() => {
    if (!campos.horaDesde || !campos.horaHasta) return null;
    const [h1, m1] = campos.horaDesde.split(':').map(Number);
    const [h2, m2] = campos.horaHasta.split(':').map(Number);
    const minutos = (h2 * 60 + m2) - (h1 * 60 + m1);
    return minutos > 0 ? (minutos / 60).toFixed(2) : null;
  }, [campos.horaDesde, campos.horaHasta]);

  const handleChange = (campo, valor) => {
    setCampos(prev => ({ ...prev, [campo]: valor }));
    setError('');
  };

  const handleFormularioChange = (formId) => {
    const form = formularios.find(f => String(f.formID ?? f.FormID) === String(formId));
    setCampos(prev => ({
      ...prev,
      formId,
      proceso: form?.templateName || form?.TemplateName || prev.proceso,
    }));
  };

  const construirDto = () => ({
    formID: Number(campos.formId),
    proceso: campos.proceso,
    fecha: campos.fecha,
    personalPlanta: Number(campos.personalPlanta) || 0,
    personalExterno: Number(campos.personalExterno) || 0,
    horaDesde: `${campos.horaDesde}:00`,
    horaHasta: `${campos.horaHasta}:00`,
    observaciones: campos.observaciones || null,
    justificacionVariacion: justificacion || null,
  });

  const validarCamposBase = () => {
    if (!campos.formId) return 'Selecciona el formulario/registro relacionado.';
    if (!campos.proceso) return 'Indica el proceso que se está midiendo.';
    if (!campos.fecha) return 'Indica la fecha.';
    if (!campos.horaDesde || !campos.horaHasta) return 'Indica el rango de horario (desde - hasta).';
    if (campos.horaHasta <= campos.horaDesde) return "La hora 'hasta' debe ser posterior a la hora 'desde'.";
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setExito('');
    const mensajeValidacion = validarCamposBase();
    if (mensajeValidacion) {
      setError(mensajeValidacion);
      return;
    }

    try {
      setGuardando(true);
      setError('');
      const registro = await personalService.crearRegistro(construirDto());
      setExito(`Registro guardado (${registro.horasTrabajadas ?? ''} hrs).`);
      setUltimosGuardados(prev => [registro, ...prev].slice(0, 5));
      setCampos(CAMPOS_VACIOS);
      setJustificacion('');
      setRequiereJustificacion(null);
    } catch (err) {
      if (err.status === 400 && err.data?.error === 'justificacion_requerida') {
        setRequiereJustificacion({ motivo: err.data.motivo, mensaje: err.data.message });
        setError(err.data.message);
      } else {
        setError(err.message || 'Error al guardar el registro.');
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="rp-page">
      <div className="rp-header">
        <h1>👥 Registro de Personal</h1>
        <p className="rp-sub">
          Registra personal de planta/externo por proceso, con validación automática
          del estándar de tiempo (sin necesidad de escribir código adicional).
        </p>
        <button type="button" className="rp-link-btn" onClick={() => navigate('/personal-indicadores')}>
          📈 Ver indicadores de Personal
        </button>
      </div>

      <form className="rp-form" onSubmit={handleSubmit}>
        <div className="rp-grid">
          <div className="rp-campo rp-campo-ancho">
            <label>Formulario / registro relacionado *</label>
            <select
              value={campos.formId}
              onChange={(e) => handleFormularioChange(e.target.value)}
              disabled={cargandoListas}
            >
              <option value="">{cargandoListas ? 'Cargando…' : 'Selecciona un formulario'}</option>
              {formularios.map(f => {
                const id = f.formID ?? f.FormID;
                const nombre = f.templateName ?? f.TemplateName ?? 'Sin nombre';
                const fecha = new Date(f.createdAt ?? f.CreatedAt).toLocaleDateString('es-EC');
                return (
                  <option key={id} value={id}>
                    #{id} — {nombre} ({fecha})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="rp-campo rp-campo-ancho">
            <label>Proceso que se está midiendo *</label>
            <input
              list="rp-lista-procesos"
              value={campos.proceso}
              onChange={(e) => handleChange('proceso', e.target.value)}
              placeholder="Ej: Fileteo, Empaque, Recepción de materia prima…"
            />
            <datalist id="rp-lista-procesos">
              {procesos.map(p => <option key={p} value={p} />)}
            </datalist>
          </div>

          <div className="rp-campo">
            <label>Fecha *</label>
            <input type="date" value={campos.fecha} onChange={(e) => handleChange('fecha', e.target.value)} />
          </div>

          <div className="rp-campo">
            <label>Personal de planta</label>
            <input
              type="number"
              min="0"
              value={campos.personalPlanta}
              onChange={(e) => handleChange('personalPlanta', e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="rp-campo">
            <label>Personal externo</label>
            <input
              type="number"
              min="0"
              value={campos.personalExterno}
              onChange={(e) => handleChange('personalExterno', e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="rp-campo">
            <label>Hora desde *</label>
            <input type="time" value={campos.horaDesde} onChange={(e) => handleChange('horaDesde', e.target.value)} />
          </div>

          <div className="rp-campo">
            <label>Hora hasta *</label>
            <input type="time" value={campos.horaHasta} onChange={(e) => handleChange('horaHasta', e.target.value)} />
          </div>

          {horasCalculadas && (
            <div className="rp-campo">
              <label>Horas trabajadas</label>
              <div className="rp-valor-calculado">{horasCalculadas} hrs</div>
            </div>
          )}

          <div className="rp-campo rp-campo-ancho">
            <label>Observaciones generales</label>
            <textarea
              rows={3}
              value={campos.observaciones}
              onChange={(e) => handleChange('observaciones', e.target.value)}
              placeholder="Observaciones del turno, incidencias, etc."
            />
          </div>
        </div>

        {requiereJustificacion && (
          <div className="rp-alerta">
            <strong>⚠️ Variación fuera del estándar del proceso</strong>
            <p>{requiereJustificacion.mensaje}</p>
            <label>Justificación de la variación *</label>
            <textarea
              rows={2}
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              placeholder="Explica por qué el horario/duración se salió del estándar…"
            />
          </div>
        )}

        {error && <div className="rp-error">{error}</div>}
        {exito && <div className="rp-exito">{exito}</div>}

        <div className="rp-acciones">
          <button type="submit" className="rp-btn-primary" disabled={guardando}>
            {guardando ? 'Guardando…' : '💾 Guardar registro'}
          </button>
        </div>
      </form>

      {ultimosGuardados.length > 0 && (
        <div className="rp-recientes">
          <h3>Últimos registros guardados en esta sesión</h3>
          <table>
            <thead>
              <tr>
                <th>Proceso</th>
                <th>Fecha</th>
                <th>Planta</th>
                <th>Externo</th>
                <th>Horario</th>
                <th>Horas</th>
                <th>Estándar</th>
              </tr>
            </thead>
            <tbody>
              {ultimosGuardados.map(r => (
                <tr key={r.id}>
                  <td>{r.proceso}</td>
                  <td>{new Date(r.fecha).toLocaleDateString('es-EC')}</td>
                  <td>{r.personalPlanta}</td>
                  <td>{r.personalExterno}</td>
                  <td>{r.horaDesde} - {r.horaHasta}</td>
                  <td>{r.horasTrabajadas}</td>
                  <td>{r.cumpleEstandar ? '✅ Cumple' : '⚠️ Fuera de rango'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
