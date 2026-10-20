import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  leerFirma, verFirma, firmarCelda, anularFirma, personasQueFirman, nombreSesion,
  firmarConDocumento, errorDeDocumento, errorDeNombre, limpiarDocumento,
} from '../services/firmaCeldaService';
import { urlImagen } from '../utils/urlImagen';
import './FirmaCelda.css';

/**
 * ✍️ Celda "Firma con PIN".
 *
 * Sin firmar: botón "Firmar" → ventana con dos formas:
 *   🔑 Con PIN:     persona del catálogo de firmas (con o sin imagen).
 *   🪪 Con cédula:  persona SIN usuario, con nombre y cédula/pasaporte.
 * Firmada: quién firmó, fecha, código de verificación y, si corresponde,
 * la imagen de la firma o el número de documento.
 *
 * @param {string}   value     texto guardado en la celda
 * @param {function} onChange  recibe el nuevo texto ('' al quitar la firma)
 * @param {boolean}  disabled  solo lectura
 * @param {string}   campo     nombre de la columna (queda en el registro)
 * @param {number}   fila      índice de la fila (0, 1, 2…)
 */
export default function FirmaCelda({ value, onChange, disabled = false, campo, fila, formId, templateId }) {
  const firma = leerFirma(value);
  const [registro, setRegistro] = useState(null);
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    let vigente = true;
    setRegistro(null);
    if (firma?.codigo) {
      verFirma(firma.codigo)
        .then((r) => { if (vigente) setRegistro(r); })
        .catch(() => { /* sin conexión: se muestra el texto igual */ });
    }
    return () => { vigente = false; };
  }, [firma?.codigo]);

  const quitar = async () => {
    if (!window.confirm(`¿Quitar la firma de ${firma.nombre}?`)) return;
    try { await anularFirma(firma.codigo); } catch { /* se quita igual de la celda */ }
    onChange('');
  };

  if (firma) {
    return (
      <div className={`fc-firmada ${registro?.anulada ? 'fc-anulada' : ''}`}>
        {registro?.conImagen && registro?.firmaImageUrl && (
          <img className="fc-imagen" src={urlImagen(registro.firmaImageUrl)} alt={`Firma de ${firma.nombre}`} />
        )}
        <div className="fc-texto">
          <span className="fc-etiqueta">
            {firma.tipo === 'documento' ? '🪪 Firmado por:' : '✍️ Firmado digitalmente por:'}
          </span>
          <strong>{firma.nombre}</strong>
          {firma.documento && <span className="fc-documento">{firma.documento}</span>}
          <span className="fc-detalle">{firma.fecha} · Cód. {firma.codigo}</span>
          {registro?.anulada && <span className="fc-aviso">⚠️ Esta firma fue anulada</span>}
        </div>
        {!disabled && (
          <button type="button" className="fc-quitar" onClick={quitar} title="Quitar firma">✕</button>
        )}
      </div>
    );
  }

  return (
    <div className="fc-vacia">
      {value ? <span className="fc-otro">{String(value)}</span> : null}
      {disabled ? (
        !value && <span className="fc-sin-firmar">Sin firmar</span>
      ) : (
        <button type="button" className="fc-boton-firmar" onClick={() => setAbierta(true)}>
          ✍️ Firmar
        </button>
      )}
      {abierta && (
        <VentanaFirmar
          campo={campo}
          onCancelar={() => setAbierta(false)}
          onFirmar={async (datos) => {
            const r = await firmarCelda({ ...datos, campo, fila, formId, templateId });
            setAbierta(false);
            onChange(r.texto);
          }}
          onFirmarConDocumento={async (datos) => {
            const r = await firmarConDocumento({ ...datos, campo, fila, formId, templateId });
            setAbierta(false);
            onChange(r.texto);
          }}
        />
      )}
    </div>
  );
}

function VentanaFirmar({ campo, onCancelar, onFirmar, onFirmarConDocumento }) {
  const [modo, setModo] = useState('pin');   // 'pin' | 'documento'
  const [personas, setPersonas] = useState([]);
  // Con documento (persona sin usuario)
  const [nombreDoc, setNombreDoc] = useState('');
  const [tipoDoc, setTipoDoc] = useState('cedula');
  const [numeroDoc, setNumeroDoc] = useState('');
  const [nombre, setNombre] = useState(nombreSesion());
  const [pin, setPin] = useState('');
  const [conImagen, setConImagen] = useState(true);
  const [error, setError] = useState('');
  const [firmando, setFirmando] = useState(false);
  const pinRef = useRef(null);
  const nombreDocRef = useRef(null);
  const cancelarRef = useRef(onCancelar);
  cancelarRef.current = onCancelar;

  useEffect(() => {
    personasQueFirman()
      .then((lista) => {
        setPersonas(lista);
        // Si la sesión no está en el catálogo, se deja vacío para elegir.
        setNombre((n) => (lista.some((p) => p.toLowerCase() === n.toLowerCase()) ? n : ''));
        // Sin nadie en el catálogo, solo queda firmar con documento.
        if (lista.length === 0) setModo('documento');
      })
      .catch(() => { setModo('documento'); });
    pinRef.current?.focus();
    const esc = (e) => { if (e.key === 'Escape') cancelarRef.current(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  const cambiarModo = (m) => {
    setModo(m);
    setError('');
    setTimeout(() => (m === 'pin' ? pinRef : nombreDocRef).current?.focus(), 0);
  };

  const firmarConDocumento = async () => {
    setError('');
    const e1 = errorDeNombre(nombreDoc);
    if (e1) { setError(e1); return; }
    const e2 = errorDeDocumento(tipoDoc, numeroDoc);
    if (e2) { setError(e2); return; }
    setFirmando(true);
    try {
      await onFirmarConDocumento({ nombre: nombreDoc, tipoDocumento: tipoDoc, numeroDocumento: numeroDoc });
    } catch (err) {
      setError(err.message || 'No se pudo firmar.');
    } finally {
      setFirmando(false);
    }
  };

  const firmar = async (e) => {
    e?.preventDefault();
    if (modo === 'documento') { await firmarConDocumento(); return; }
    setError('');
    if (!nombre) { setError('Elige quién firma.'); return; }
    if (pin.trim().length < 4) { setError('Ingresa el PIN (mínimo 4 dígitos).'); return; }
    setFirmando(true);
    try {
      await onFirmar({ nombre, pin: pin.trim(), conImagen });
    } catch (err) {
      setError(err.message || 'No se pudo firmar.');
      setPin('');
      pinRef.current?.focus();
    } finally {
      setFirmando(false);
    }
  };

  return createPortal(
    <div className="fc-fondo" role="dialog" aria-modal="true" aria-label="Firmar con PIN"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onCancelar(); }}>
      {/* div y no form: la celda puede estar dentro de otro formulario */}
      <div className="fc-ventana" onKeyDown={(e) => { if (e.key === 'Enter') firmar(e); }}>
        <div className="fc-ventana-titulo">✍️ Firmar{campo ? `: ${campo}` : ''}</div>

        <div className="fc-pestanas" role="tablist">
          <button type="button" role="tab" aria-selected={modo === 'pin'}
                  className={modo === 'pin' ? 'activa' : ''} onClick={() => cambiarModo('pin')}>
            🔑 Con PIN
          </button>
          <button type="button" role="tab" aria-selected={modo === 'documento'}
                  className={modo === 'documento' ? 'activa' : ''} onClick={() => cambiarModo('documento')}>
            🪪 Con cédula (sin usuario)
          </button>
        </div>

        {modo === 'documento' ? (
          <>
            <label className="fc-campo">
              <span>Nombre y apellido</span>
              <input ref={nombreDocRef} type="text" autoComplete="off" value={nombreDoc}
                     onChange={(e) => setNombreDoc(e.target.value)} placeholder="Ej: Pedro Álvarez" maxLength={200} />
            </label>
            <div className="fc-fila">
              <label className="fc-campo" style={{ flex: '0 0 125px' }}>
                <span>Documento</span>
                <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
                  <option value="cedula">Cédula</option>
                  <option value="pasaporte">Pasaporte</option>
                </select>
              </label>
              <label className="fc-campo" style={{ flex: 1 }}>
                <span>Número</span>
                <input type="text" inputMode={tipoDoc === 'cedula' ? 'numeric' : 'text'} autoComplete="off"
                       value={numeroDoc} maxLength={24}
                       onChange={(e) => setNumeroDoc(e.target.value)}
                       placeholder={tipoDoc === 'cedula' ? '10 dígitos' : 'Letras y números'} />
              </label>
            </div>
            {numeroDoc && !errorDeDocumento(tipoDoc, numeroDoc) && (
              <div className="fc-ok">✔ {tipoDoc === 'cedula' ? 'Cédula válida' : 'Pasaporte'}: {limpiarDocumento(numeroDoc)}</div>
            )}
            <p className="fc-nota fc-nota-doc">
              Para personas que no tienen usuario. Tú das fe de esta firma:
              queda registrado que se hizo con tu sesión.
            </p>
          </>
        ) : (
        <>
        <label className="fc-campo">
          <span>Quién firma</span>
          <select value={nombre} onChange={(e) => setNombre(e.target.value)}>
            <option value="">— Elegir —</option>
            {personas.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>

        <label className="fc-campo">
          <span>PIN</span>
          <input ref={pinRef} type="password" inputMode="numeric" autoComplete="off"
                 value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••" />
        </label>

        <label className="fc-check">
          <input type="checkbox" checked={conImagen} onChange={(e) => setConImagen(e.target.checked)} />
          Incluir la imagen de mi firma
        </label>
        </>
        )}

        {error && <div className="fc-error" role="alert">{error}</div>}

        <div className="fc-botones">
          <button type="button" onClick={onCancelar} disabled={firmando}>Cancelar</button>
          <button type="button" className="fc-principal" onClick={firmar} disabled={firmando}>
            {firmando ? 'Firmando…' : '✍️ Firmar'}
          </button>
        </div>
        {modo === 'pin' && (
          <p className="fc-nota">El PIN es el de “Mi Firma”. Tras 5 intentos fallidos se bloquea 15 minutos.</p>
        )}
      </div>
    </div>,
    document.body
  );
}