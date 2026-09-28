import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  obtenerCumplimiento, listarFormatos, descargarExcel, fechaISO,
} from '../services/cumplimientoService';
import './Cumplimiento.css';

const FRECUENCIAS = ['Diaria', 'Semanal', 'Quincenal', 'Mensual', 'Trimestral', 'Semestral', 'Anual', 'Ocasional'];

/**
 * 📋 CONTROL DE CUMPLIMIENTO
 * Por registro y por día: si se llenó y si está firmado por todos.
 * Reemplaza el cuadro que Calidad llevaba en Excel.
 */
export default function Cumplimiento() {
  const navigate = useNavigate();
  const hoy = useMemo(() => new Date(), []);
  const haceUnaSemana = useMemo(() => new Date(Date.now() - 6 * 86400000), []);

  const [desde, setDesde] = useState(fechaISO(haceUnaSemana));
  const [hasta, setHasta] = useState(fechaISO(hoy));
  const [frecuencia, setFrecuencia] = useState('Diaria');
  const [codigo, setCodigo] = useState('');
  const [finDeSemana, setFinDeSemana] = useState(true);
  const [soloFaltantes, setSoloFaltantes] = useState(false);

  const [formatos, setFormatos] = useState([]);
  const [cuadro, setCuadro] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { listarFormatos().then(setFormatos).catch(() => {}); }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setCuadro(await obtenerCumplimiento({ desde, hasta, codigo, frecuencia, incluirFinDeSemana: finDeSemana }));
    } catch (e) {
      setError(e.message || 'No se pudo cargar el cuadro.');
      setCuadro(null);
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, codigo, frecuencia, finDeSemana]);

  useEffect(() => { cargar(); }, [cargar]);

  /** Archivo de Excel (.xlsx): abre directo, sin el asistente de importación. */
  const bajarExcel = async () => {
    if (!cuadro) return;
    setBajando(true);
    try {
      await descargarExcel(cuadro);
    } catch (e) {
      setError(`No se pudo generar el Excel: ${e.message}`);
    } finally {
      setBajando(false);
    }
  };

  // Si el backend todavia es el anterior, no manda reemplazoPrincipal:
  // se toma el primero de la lista para no mostrar "sin reemplazo" de más.
  const responsablesDe = (r) => ({
    principal: r.reemplazoPrincipal ?? r.reemplazos?.[0] ?? '',
    otros: r.otrosQuePuedenFirmar ?? Math.max(0, (r.reemplazos?.length || 0) - 1),
  });

  const registros = (cuadro?.registros || []).filter(
    (r) => !soloFaltantes || r.faltantes?.length > 0 || r.sinFirmar?.length > 0
  );

  const totalFaltantes = (cuadro?.registros || []).reduce((s, r) => s + (r.faltantes?.length || 0), 0);
  const totalSinFirmar = (cuadro?.registros || []).reduce((s, r) => s + (r.sinFirmar?.length || 0), 0);

  return (
    <div className="cmp-pagina">
      <div className="cmp-encabezado">
        <h1>📋 Control de cumplimiento</h1>
        <p>Por cada registro y día: si se llenó y si está firmado por todos.</p>
      </div>

      <div className="cmp-filtros">
        <label>Desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
        <label>Hasta<input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
        <label>Frecuencia
          <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}>
            <option value="">Todas</option>
            {FRECUENCIAS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label>Formato
          <select value={codigo} onChange={(e) => setCodigo(e.target.value)}>
            <option value="">Todos</option>
            {formatos.map((f) => <option key={f.templateID} value={f.codigo}>{f.codigo}</option>)}
          </select>
        </label>
        <label className="cmp-check">
          <input type="checkbox" checked={finDeSemana} onChange={(e) => setFinDeSemana(e.target.checked)} />
          Exigir sábado y domingo
        </label>
        <label className="cmp-check">
          <input type="checkbox" checked={soloFaltantes} onChange={(e) => setSoloFaltantes(e.target.checked)} />
          Solo lo que falta
        </label>
        <button type="button" onClick={cargar} disabled={cargando}>{cargando ? 'Cargando…' : '🔄 Actualizar'}</button>
        <button type="button" className="cmp-excel" onClick={bajarExcel} disabled={!cuadro || bajando}>
          {bajando ? 'Generando…' : '⬇️ Excel'}
        </button>
      </div>

      {error && <div className="cmp-error" role="alert">{error}</div>}

      {cuadro && !error && (
        <div className="cmp-resumen">
          <span className="cmp-chip cmp-rojo">Sin llenar: <strong>{totalFaltantes}</strong></span>
          <span className="cmp-chip cmp-amarillo">Llenados sin firmar: <strong>{totalSinFirmar}</strong></span>
          <span className="cmp-chip">Registros: <strong>{cuadro.registros?.length || 0}</strong></span>
        </div>
      )}

      {cargando ? (
        <div className="cmp-vacio">Cargando…</div>
      ) : !cuadro || registros.length === 0 ? (
        <div className="cmp-vacio">No hay registros para esos filtros.</div>
      ) : (
        <div className="cmp-tabla-caja">
          <table className="cmp-tabla">
            <thead>
              <tr>
                <th className="cmp-fija">FORMULARIO</th>
                <th className="cmp-fija2">RESPONSABLE</th>
                {cuadro.dias.map((d) => (
                  <th key={d.fecha} className={d.esFinDeSemana ? 'cmp-finde' : ''}>
                    <div>{d.etiqueta}</div>
                    <small>{d.diaSemana}</small>
                  </th>
                ))}
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.templateID}>
                  <td className="cmp-fija">
                    <strong>{r.codigo}</strong>
                    <small>{r.frecuencia}</small>
                  </td>
                  {/* Responsables: solo el titular y su primer reemplazo. Los
                      demás siguen en la plantilla y pueden llenar y firmar. */}
                  <td className="cmp-fija2">
                    {r.responsable || <span className="cmp-sin">sin responsable</span>}
                    {responsablesDe(r).principal
                      ? <small>reemplazo: {responsablesDe(r).principal}</small>
                      : <small className="cmp-sin">sin reemplazo</small>}
                    {responsablesDe(r).otros > 0 && (
                      <small
                        className="cmp-otros"
                        title={`También pueden llenar y firmar: ${(r.reemplazos || []).slice(1).join(', ')}`}
                      >
                        +{responsablesDe(r).otros} más pueden firmar
                      </small>
                    )}
                  </td>
                  {r.dias.map((c) => {
                    const clase = c.llenado
                      ? (c.firmadoPorTodos ? 'cmp-si' : 'cmp-parcial')
                      : (c.seEspera ? 'cmp-no' : 'cmp-na');
                    const texto = c.llenado ? (c.firmadoPorTodos ? 'SI' : 'SI*') : (c.seEspera ? 'NO' : '–');
                    const titulo = c.llenado
                      ? `${c.formularios} formulario(s): ${c.ids.join(', ')}` +
                        (c.personas?.length ? ` · ${c.personas.join(', ')}` : '') +
                        (c.firmadoPorTodos ? '' : ' · falta firmar')
                      : (c.seEspera ? 'No se llenó' : 'No corresponde por la frecuencia');
                    return (
                      <td
                        key={c.fecha}
                        className={`cmp-celda ${clase}`}
                        title={titulo}
                        onClick={() => c.ids?.length === 1 && navigate(`/view-forms?formId=${c.ids[0]}`)}
                      >
                        {texto}
                      </td>
                    );
                  })}
                  <td className={`cmp-pct ${r.cumplimiento < 100 ? 'cmp-pct-bajo' : ''}`}>{r.cumplimiento}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="cmp-leyenda">
        <span><b className="cmp-si">SI</b> llenado y firmado por todos</span>
        <span><b className="cmp-parcial">SI*</b> llenado, falta alguna firma</span>
        <span><b className="cmp-no">NO</b> no se llenó y se esperaba</span>
        <span><b className="cmp-na">–</b> no corresponde por la frecuencia</span>
      </div>
    </div>
  );
}