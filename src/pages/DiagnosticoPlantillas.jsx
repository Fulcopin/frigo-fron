// ====================================
// DIAGNÓSTICO DE CONFIGURACIÓN DE INVENTARIO
// ====================================
// Muestra qué plantillas tienen tablas con columna de lote y de cantidad
// pero no están marcadas para mover inventario. Cada fila lleva directo a
// Editar Plantilla, donde están los paneles verde (crear saldo) y naranja
// (restar saldo) que ya existen.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import diagnosticoService from '../services/diagnosticoService';
import './DiagnosticoPlantillas.css';

const ESTADOS = {
  pendiente:  { icono: '🔴', texto: 'Sin configurar', clase: 'dp-pendiente' },
  parcial:    { icono: '🟡', texto: 'Revisar',        clase: 'dp-parcial' },
  ok:         { icono: '🟢', texto: 'Configurada',    clase: 'dp-ok' },
  sin_tablas: { icono: '⚪', texto: 'No aplica',      clase: 'dp-neutro' },
};

const ROLES = {
  entrada: { icono: '📥', texto: 'Materia prima — debería RESTAR saldo', clase: 'dp-rol-entrada' },
  salida:  { icono: '📤', texto: 'Producción — debería CREAR saldo',     clase: 'dp-rol-salida' },
  merma:   { icono: '🗑️', texto: 'Merma / subproducto',                  clase: 'dp-rol-merma' },
  insumo:  { icono: '📦', texto: 'Material de empaque — no toca inventario', clase: 'dp-rol-merma' },
  revisar: { icono: '❓', texto: 'Revisar a mano qué rol tiene',          clase: 'dp-rol-revisar' },
};

// El backend puede serializar en PascalCase o camelCase según la config de
// JSON del proyecto; se leen las dos formas para no depender de eso.
// Va a nivel de módulo a propósito: si se define dentro del componente se
// recrea en cada render y anula los useMemo que la tienen como dependencia.
const v = (obj, nombre) =>
  obj?.[nombre] ?? obj?.[nombre.charAt(0).toUpperCase() + nombre.slice(1)];

/**
 * Panel para configurar las tablas de UNA plantilla y guardar el cambio.
 * Es genérico: sirve para cualquier FOR. Arranca con lo que sugirió el
 * detector, pero todo se puede cambiar antes de aplicar.
 */
function ConfiguradorPlantilla({ plantilla, onAplicado }) {
  const templateID = v(plantilla, 'templateID') ?? v(plantilla, 'TemplateID');
  const tablas = useMemo(() => {
    const lista = v(plantilla, 'tablas');
    return Array.isArray(lista) ? lista : [];
  }, [plantilla]);

  // Estado editable, uno por tabla, precargado con la sugerencia.
  const [config, setConfig] = useState(() =>
    tablas.map((t) => {
      const sug = v(t, 'sugerencia') || {};
      const rol = v(t, 'rolSugerido');
      const yaConfigurada = v(t, 'configurada');
      const candidata = v(t, 'candidata');
      // Solo se propone una acción si la tabla puede moverla de verdad: sin
      // columna de lote, precargarla bloquea el guardado de las demás.
      const proponer = candidata && !yaConfigurada;
      return {
        tablaId: v(t, 'tablaId') ?? null,
        indice: v(t, 'indice') ?? -1,
        accion: proponer ? (rol === 'entrada' ? 'restar' : rol === 'salida' ? 'crear' : 'ninguna') : 'ninguna',
        loteCol: v(sug, 'columnaLote') || '',
        cantidadCol: v(sug, 'columnaCantidad') || '',
        productoCol: v(sug, 'columnaProducto') || '',
        clasificacionCol: v(sug, 'columnaClasificacion') || '',
        lotePadreCol: v(sug, 'columnaLotePadre') || '',
      };
    })
  );

  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [fallo, setFallo] = useState('');

  const set = (i, campo, valor) =>
    setConfig((prev) => prev.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)));

  const aCambiar = config.filter((c) => c.accion !== 'ninguna');

  const aplicar = async (soloPrevisualizar) => {
    try {
      setGuardando(true);
      setFallo('');
      setResultado(null);
      const r = await diagnosticoService.aplicar({
        templateID,
        // Solo viajan las tablas con acción elegida. Mandar las demás hacía
        // que una tabla sin configurar bloqueara el guardado de todas.
        tablas: aCambiar,
        soloPrevisualizar,
      });
      setResultado(r);
      // Solo al guardar de verdad conviene refrescar la lista de arriba.
      if (!soloPrevisualizar && onAplicado) onAplicado();
    } catch (err) {
      setFallo(err.message || 'No se pudo aplicar la configuración.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="dp-detalle">
      {tablas.length === 0 && <p className="dp-nota">Esta plantilla no tiene tablas con columnas.</p>}

      {tablas.map((t, i) => {
        const candidata = v(t, 'candidata');
        const configurada = v(t, 'configurada');
        const avisos = Array.isArray(v(t, 'avisos')) ? v(t, 'avisos') : [];
        const columnas = Array.isArray(v(t, 'columnas')) ? v(t, 'columnas') : [];
        const rol = ROLES[v(t, 'rolSugerido')] || ROLES.revisar;
        const c = config[i];

        if (!candidata && !configurada && avisos.length === 0) return null;

        return (
          <div key={i} className={`dp-tabla ${configurada ? 'dp-tabla-ok' : 'dp-tabla-pend'}`}>
            <div className="dp-tabla-titulo">
              <strong>{v(t, 'titulo')}</strong>
              {configurada
                ? <span className="dp-pill dp-pill-ok">✅ ya mueve inventario</span>
                : <span className={`dp-pill ${rol.clase}`}>{rol.icono} {rol.texto}</span>}
            </div>

            {avisos.map((a, j) => <div key={j} className="dp-aviso">⚠️ {a}</div>)}

            <div className="dp-form">
              <div className="dp-campo">
                <label>Qué hace esta tabla</label>
                <select value={c.accion} onChange={(e) => set(i, 'accion', e.target.value)}>
                  <option value="ninguna">— No tocar —</option>
                  <option value="restar">📥 Restar saldo (materia prima que se consume)</option>
                  <option value="crear">📤 Crear saldo (producción que se genera)</option>
                </select>
              </div>

              {c.accion !== 'ninguna' && (
                <>
                  <div className="dp-campo">
                    <label>Columna del lote *</label>
                    <select
                      value={c.loteCol}
                      onChange={(e) => set(i, 'loteCol', e.target.value)}
                      className={c.loteCol ? '' : 'dp-falta'}
                    >
                      <option value="">— Elegir —</option>
                      {columnas.map((col) => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>

                  <div className="dp-campo">
                    <label>Columna de la cantidad *</label>
                    <select
                      value={c.cantidadCol}
                      onChange={(e) => set(i, 'cantidadCol', e.target.value)}
                      className={c.cantidadCol ? '' : 'dp-falta'}
                    >
                      <option value="">— Elegir —</option>
                      {columnas.map((col) => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>

                  <div className="dp-campo">
                    <label>Producto (opcional)</label>
                    <select value={c.productoCol} onChange={(e) => set(i, 'productoCol', e.target.value)}>
                      <option value="">— No usar —</option>
                      {columnas.map((col) => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>

                  {c.accion === 'crear' && (
                    <>
                      <div className="dp-campo">
                        <label>Clasificación (opcional)</label>
                        <select
                          value={c.clasificacionCol}
                          onChange={(e) => set(i, 'clasificacionCol', e.target.value)}
                        >
                          <option value="">— No usar —</option>
                          {columnas.map((col) => <option key={col} value={col}>{col}</option>)}
                        </select>
                      </div>
                      <div className="dp-campo">
                        <label>Lote padre (opcional)</label>
                        <select
                          value={c.lotePadreCol}
                          onChange={(e) => set(i, 'lotePadreCol', e.target.value)}
                        >
                          <option value="">— No usar —</option>
                          {columnas.map((col) => <option key={col} value={col}>{col}</option>)}
                        </select>
                        <span className="dp-ayuda">De qué lote viene, para la trazabilidad.</span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}

      {fallo && <div className="dp-error">{fallo}</div>}

      {resultado && (
        <div className={resultado.previsualizacion ? 'dp-preview' : 'dp-exito'}>
          <strong>
            {resultado.previsualizacion
              ? '👁️ Así quedaría (todavía no se guardó):'
              : `✅ ${resultado.message}`}
          </strong>
          <ul>
            {(Array.isArray(resultado.cambios) ? resultado.cambios : []).map((ch, k) => (
              <li key={k}>
                <strong>{ch.tabla}</strong> → {ch.accion === 'restar' ? 'resta' : 'crea'} saldo,
                lote «{ch.loteCol}», cantidad «{ch.cantidadCol}»
              </li>
            ))}
          </ul>
          {resultado.nota && <p className="dp-nota">{resultado.nota}</p>}
        </div>
      )}

      <div className="dp-acciones">
        <button
          className="dp-btn dp-btn-sec"
          onClick={() => aplicar(true)}
          disabled={guardando || aCambiar.length === 0}
        >
          👁️ Previsualizar
        </button>
        <button
          className="dp-btn"
          onClick={() => aplicar(false)}
          disabled={guardando || aCambiar.length === 0}
        >
          {guardando ? 'Guardando…' : `💾 Aplicar a ${aCambiar.length} tabla${aCambiar.length === 1 ? '' : 's'}`}
        </button>
        <Link to={`/edit-template/${templateID}`} className="dp-editar">
          ✏️ Abrir en Editar Plantilla
        </Link>
      </div>
    </div>
  );
}

export default function DiagnosticoPlantillas() {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [abierta, setAbierta] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setDatos(await diagnosticoService.getDiagnostico({ soloPendientes }));
    } catch (err) {
      setError(err.message || 'No se pudo cargar el diagnóstico.');
    } finally {
      setLoading(false);
    }
  }, [soloPendientes]);

  useEffect(() => { cargar(); }, [cargar]);

  // Doble red: el servicio ya desenvuelve los $values, pero si el backend
  // devolviera otra forma la pantalla muestra vacío en vez de romperse.
  const plantillas = useMemo(() => {
    const lista = datos?.plantillas ?? datos?.Plantillas;
    return Array.isArray(lista) ? lista : [];
  }, [datos]);
  const resumen = datos?.resumen || datos?.Resumen || {};

  return (
    <div className="dp-page">
      <div className="dp-header">
        <h1>🔍 Configuración de inventario por plantilla</h1>
        <p className="dp-sub">
          Tablas que tienen columna de lote y de cantidad pero no están marcadas para mover
          inventario. Mientras no se configuren, los formularios se llenan sin descontar
          ni crear saldo.
        </p>
      </div>

      {error && <div className="dp-error">{error}</div>}

      {!loading && datos && (
        <div className="dp-kpis">
          <div className="dp-kpi dp-kpi-rojo">
            <span className="dp-kpi-label">Sin configurar</span>
            <span className="dp-kpi-valor">{v(resumen, 'pendientes') ?? 0}</span>
          </div>
          <div className="dp-kpi dp-kpi-ambar">
            <span className="dp-kpi-label">Con avisos</span>
            <span className="dp-kpi-valor">{v(resumen, 'parciales') ?? 0}</span>
          </div>
          <div className="dp-kpi dp-kpi-verde">
            <span className="dp-kpi-label">Configuradas</span>
            <span className="dp-kpi-valor">{v(resumen, 'ok') ?? 0}</span>
          </div>
          <div className="dp-kpi dp-kpi-rojo">
            <span className="dp-kpi-label">Formularios sin registrar movimiento</span>
            <span className="dp-kpi-valor">{v(resumen, 'formulariosEnRiesgo') ?? 0}</span>
          </div>
        </div>
      )}

      <div className="dp-barra">
        <label className="dp-check">
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
          />
          Mostrar solo las que faltan
        </label>
        <button className="dp-btn" onClick={cargar} disabled={loading}>
          {loading ? 'Analizando…' : '🔄 Volver a analizar'}
        </button>
      </div>

      {loading ? (
        <div className="dp-loading">Analizando las plantillas…</div>
      ) : plantillas.length === 0 ? (
        <div className="dp-vacio">
          No hay plantillas con tablas de inventario que revisar.
        </div>
      ) : (
        <div className="dp-lista">
          {plantillas.map((p) => {
            const id = v(p, 'templateID') ?? v(p, 'TemplateID');
            const estado = ESTADOS[v(p, 'estado')] || ESTADOS.sin_tablas;
            const usos = v(p, 'formulariosLlenados') ?? 0;
            const pendientes = v(p, 'tablasPendientes') ?? 0;
            const expandida = abierta === id;

            return (
              <div key={id} className={`dp-card ${estado.clase}`}>
                <button className="dp-card-cabecera" onClick={() => setAbierta(expandida ? null : id)}>
                  <span className="dp-estado" title={estado.texto}>{estado.icono}</span>
                  <span className="dp-codigo">{v(p, 'codigo')}</span>
                  <span className="dp-nombre">{v(p, 'nombre')}</span>
                  <span className="dp-usos" title="Formularios ya llenados con esta plantilla">
                    {usos} llenado{usos === 1 ? '' : 's'}
                  </span>
                  {pendientes > 0 && (
                    <span className="dp-badge">{pendientes} tabla{pendientes === 1 ? '' : 's'} sin configurar</span>
                  )}
                  <span className="dp-flecha">{expandida ? '▲' : '▼'}</span>
                </button>

                {expandida && (
                  <ConfiguradorPlantilla plantilla={p} onAplicado={cargar} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}