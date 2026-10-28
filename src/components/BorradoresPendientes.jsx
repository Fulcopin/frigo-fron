/**
 * BorradoresPendientes.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * EL AVISO DE LOS DOCUMENTOS QUE TODAVÍA NO SE GUARDARON.
 *
 * El problema que lo motiva: Costos arma su reporte con lo que ya está en
 * FilledForms, pero mientras un operario no cierre el formulario, lo que cargó
 * vive en un borrador y para Costos simplemente no existe. Se entera al otro
 * día, cuando alguien "se acordó" de guardar, y el reporte ya salió incompleto.
 *
 * Este recuadro le muestra, mientras tanto, tres cosas por cada borrador:
 *   · qué formulario es (código y nombre),
 *   · la fecha escrita en el ENCABEZADO (no la de guardado),
 *   · quién lo está llenando.
 *
 * Por defecto solo mira los PD, que son los que le importan; el check
 * "Solo PD" permite ver todos los formularios si hace falta.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../apiConfig';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService';
import { fetchUsers } from '../services/userService';
import { fechaInternaDeFormulario } from '../utils/fechaFormulario';
import './BorradoresPendientes.css';

// Costos es la usuaria del aviso; admin y supervisor lo ven para poder ayudar.
const ROLES_QUE_LO_VEN = ['costos', 'admin', 'supervisor'];

// Con el reporte abierto, la lista se refresca sola cada minuto: si alguien
// guarda, el documento desaparece sin que haya que recargar la página.
const REFRESCO_MS = 60 * 1000;

const lista = (x) => (Array.isArray(x) ? x : (x?.$values ?? []));

/**
 * Normaliza un borrador venga del endpoint liviano (`pendientes`) o del
 * histórico (`con-datos`, que es el que ya está desplegado en planta).
 */
const normalizar = (d) => ({
  draftID: d.draftID ?? d.DraftID,
  templateCodigo: d.templateCodigo ?? d.TemplateCodigo ?? '',
  templateName: d.templateName ?? d.TemplateName ?? '',
  userName: d.userName ?? d.UserName ?? d.filledBy ?? d.FilledBy ?? '',
  userEmail: d.userEmail ?? d.UserEmail ?? d.filledByEmail ?? d.FilledByEmail ?? '',
  headerData: d.headerData ?? d.HeaderData,
  progress: d.progress ?? d.Progress ?? 0,
  createdAt: d.createdAt ?? d.CreatedAt,
  updatedAt: d.updatedAt ?? d.UpdatedAt,
});

const esPD = (codigo) => /^(FOR-)?PD/i.test(String(codigo || '').trim());

/** '2026-10-27' → '27/10/2026' */
const fechaCorta = (iso) => {
  const [a, m, d] = String(iso || '').split('-');
  return d && m && a ? `${d}/${m}/${a}` : '';
};

/** "hace 5 min", "hace 2 h", "ayer", "hace 3 días" */
const hace = (valor) => {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  const minutos = Math.floor((Date.now() - fecha.getTime()) / 60000);
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'ayer' : `hace ${dias} días`;
};

/** "27/10/2026 15:04" para el tooltip */
const fechaHora = (valor) => {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleString('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export default function BorradoresPendientes() {
  const { user } = useAuth();
  const puedeVer = Boolean(user && ROLES_QUE_LO_VEN.includes(user.rol));

  const [soloPD, setSoloPD] = useState(true);
  const [borradores, setBorradores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState(true);
  // Si se cambia el check mientras viaja una consulta, la respuesta vieja no
  // debe pisar a la nueva.
  const ultimaPeticion = useRef(0);

  // userName/email → nombre completo, para que el aviso diga "Grace Mora" y no
  // "Gmora". Si la API de usuarios no responde, se muestra el usuario y listo.
  const [nombres, setNombres] = useState({});

  useEffect(() => {
    if (!puedeVer) return undefined;
    let vivo = true;
    (async () => {
      try {
        const usuarios = await fetchUsers(authService.getToken());
        if (!vivo) return;
        const mapa = {};
        (usuarios || []).forEach((u) => {
          const nombre = u.nombreCompleto || u.nombre || '';
          if (!nombre) return;
          if (u.userName) mapa[String(u.userName).toLowerCase()] = nombre;
          if (u.email) mapa[String(u.email).toLowerCase()] = nombre;
        });
        setNombres(mapa);
      } catch {
        // Sin nombres: el aviso sigue funcionando con el usuario.
      }
    })();
    return () => { vivo = false; };
  }, [puedeVer]);

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!puedeVer) return;
    if (!silencioso) setCargando(true);
    const peticion = ++ultimaPeticion.current;
    try {
      let datos = null;

      // 1) Endpoint liviano del servidor (devuelve solo lo mínimo del aviso).
      try {
        const res = await fetch(`${API_BASE_URL}/FormDrafts/pendientes?soloPD=${soloPD}`);
        if (res.ok) datos = lista(await res.json()).map(normalizar);
      } catch {
        // Se cae al respaldo de abajo.
      }

      // 2) Respaldo con `con-datos`, que ya existe en la versión desplegada
      //    del servidor. Trae el cuerpo completo, así que se pide una ventana
      //    corta: los borradores vencen a los 7 días igual.
      if (datos === null) {
        const res = await fetch(`${API_BASE_URL}/FormDrafts/con-datos?dias=7`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const todos = lista(await res.json()).map(normalizar);
        datos = soloPD ? todos.filter((d) => esPD(d.templateCodigo)) : todos;
      }

      if (peticion !== ultimaPeticion.current) return;
      setBorradores(datos || []);
      setError('');
    } catch (e) {
      if (peticion !== ultimaPeticion.current) return;
      console.warn('📝 No se pudieron cargar los borradores pendientes:', e);
      // En un refresco silencioso se conserva lo que ya estaba a la vista.
      if (!silencioso) {
        setBorradores([]);
        setError('No se pudo consultar la lista de borradores.');
      }
    } finally {
      if (peticion === ultimaPeticion.current) setCargando(false);
    }
  }, [puedeVer, soloPD]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!puedeVer) return undefined;
    const id = setInterval(() => cargar({ silencioso: true }), REFRESCO_MS);
    return () => clearInterval(id);
  }, [puedeVer, cargar]);

  if (!puedeVer) return null;

  // Un formulario puede tener varios borradores repetidos (se abre, se cierra y
  // se vuelve a abrir). Para el aviso vale uno solo: el más reciente de cada
  // formulario + responsable + fecha de encabezado. Los que no tienen fecha no
  // se juntan, porque podrían ser documentos distintos.
  const filas = useMemo(() => {
    const porClave = new Map();
    for (const d of borradores) {
      const fecha = fechaInternaDeFormulario(d);
      const clave = fecha
        ? `${d.templateCodigo}|${String(d.userName || '').toLowerCase()}|${fecha}`
        : `sin-fecha|${d.draftID}`;
      const previo = porClave.get(clave);
      if (!previo || new Date(d.updatedAt || 0) > new Date(previo.updatedAt || 0)) {
        porClave.set(clave, { ...d, fecha });
      }
    }

    return [...porClave.values()].sort((a, b) => {
      // Primero lo más reciente (es lo que se necesita para el reporte de hoy).
      if (a.fecha && b.fecha && a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
      if (a.fecha && !b.fecha) return -1;
      if (!a.fecha && b.fecha) return 1;
      const porCodigo = String(a.templateCodigo || '').localeCompare(String(b.templateCodigo || ''));
      return porCodigo !== 0 ? porCodigo : String(a.userName || '').localeCompare(String(b.userName || ''));
    });
  }, [borradores]);
  const total = filas.length;

  return (
    <section
      className={`borradores-panel${total > 0 ? ' borradores-panel-pendiente' : ''}`}
      aria-label="Documentos en borrador"
    >
      <div className="borradores-cabecera">
        <div className="borradores-titulo">
          <h2>
            📝 Documentos en borrador
            {total > 0 && <span className="borradores-contador">{total}</span>}
          </h2>
          <p>
            {total > 0
              ? 'Estos formularios todavía no se guardaron. Si necesitás el dato para el reporte, avisá al responsable.'
              : 'Todo al día: no hay formularios pendientes de guardar.'}
          </p>
        </div>

        <div className="borradores-acciones">
          <label className="borradores-filtro" title="Mostrar solo los formularios PD">
            <input
              type="checkbox"
              checked={soloPD}
              onChange={(e) => setSoloPD(e.target.checked)}
            />
            Solo PD
          </label>
          <button
            type="button"
            className="borradores-boton"
            onClick={() => cargar()}
            disabled={cargando}
            title="Actualizar la lista"
          >
            {cargando ? '⏳' : '↻'} Actualizar
          </button>
          <button
            type="button"
            className="borradores-boton borradores-boton-icono"
            onClick={() => setAbierto((a) => !a)}
            aria-expanded={abierto}
            title={abierto ? 'Ocultar la lista' : 'Mostrar la lista'}
          >
            {abierto ? '▾' : '▸'}
          </button>
        </div>
      </div>

      {abierto && (
        <>
          {error && (
            <p className="borradores-error" role="alert">⚠️ {error}</p>
          )}

          {cargando && total === 0 && !error && (
            <p className="borradores-vacio">Consultando borradores…</p>
          )}

          {!cargando && total === 0 && !error && (
            <p className="borradores-vacio">
              {soloPD ? 'No hay formularios PD en borrador. ✅' : 'No hay formularios en borrador. ✅'}
            </p>
          )}

          {total > 0 && (
            <div className="borradores-tabla-wrap">
              <table className="borradores-tabla">
                <thead>
                  <tr>
                    <th>Formulario</th>
                    <th>Fecha del encabezado</th>
                    <th>Responsable</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((d) => {
                    const id = d.draftID ?? d.DraftID;
                    const codigo = d.templateCodigo ?? d.TemplateCodigo ?? '';
                    const nombre = d.templateName ?? d.TemplateName ?? '';
                    const fecha = d.fecha;
                    const usuario = d.userName || d.UserName || '';
                    const email = d.userEmail || d.UserEmail || '';
                    const nombreCompleto = nombres[String(usuario).toLowerCase()]
                      || nombres[String(email).toLowerCase()]
                      || '';
                    const responsable = nombreCompleto || usuario || email || 'Sin usuario';
                    const progreso = Number(d.progress ?? d.Progress ?? 0);
                    const actualizado = d.updatedAt ?? d.UpdatedAt;

                    return (
                      <tr key={id}>
                        <td>
                          <span className="borradores-codigo">{codigo || 'Sin código'}</span>
                          {nombre && <span className="borradores-nombre">{nombre}</span>}
                        </td>
                        <td>
                          {fecha ? (
                            <span className="borradores-fecha">{fechaCorta(fecha)}</span>
                          ) : (
                            <span
                              className="borradores-sin-fecha"
                              title={
                                (d.createdAt ?? d.CreatedAt)
                                  ? `Todavía no escribieron la fecha en el encabezado. Borrador iniciado el ${fechaHora(d.createdAt ?? d.CreatedAt)}`
                                  : 'Todavía no escribieron la fecha en el encabezado'
                              }
                            >
                              Sin fecha
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="borradores-responsable">{responsable}</span>
                          <span className="borradores-detalle">
                            {nombreCompleto && usuario ? `${usuario} · ` : ''}
                            {progreso > 0 ? `${progreso}% llenado` : 'Recién empezado'}
                            {actualizado ? ` · ${hace(actualizado)}` : ''}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
