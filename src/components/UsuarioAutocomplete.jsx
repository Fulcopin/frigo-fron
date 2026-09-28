import { useEffect, useMemo, useRef, useState } from 'react';
import { obtenerPersonas } from '../services/personasService';
import { filtrarPersonas } from '../utils/busquedaUsuario';
import './UsuarioAutocomplete.css';

/**
 * 👤 Celda con búsqueda de personas.
 *
 * Se escribe y va mostrando los nombres que coinciden (por nombre, puesto o
 * usuario). Se puede elegir uno o dejar lo escrito: hay gente de planta que no
 * está en ninguna lista, y bloquearlo dejaría la celda sin llenar.
 *
 * @param {string}   value
 * @param {function} onChange  recibe el nombre elegido o escrito
 * @param {'usuarios'|'catalogo'|'ambos'} origen
 */
export default function UsuarioAutocomplete({
  value, onChange, origen = 'ambos', disabled = false, placeholder = 'Buscar persona…', className = '',
}) {
  const [personas, setPersonas] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState(value || '');
  const [resaltado, setResaltado] = useState(0);
  const caja = useRef(null);

  useEffect(() => { setTexto(value || ''); }, [value]);

  useEffect(() => {
    let vigente = true;
    obtenerPersonas(origen)
      .then((l) => { if (vigente) setPersonas(l); })
      .catch(() => {});
    return () => { vigente = false; };
  }, [origen]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  const sugerencias = useMemo(() => filtrarPersonas(personas, texto), [personas, texto]);

  const elegir = (p) => {
    setTexto(p.nombre);
    onChange(p.nombre);
    setAbierto(false);
  };

  const teclas = (e) => {
    if (!abierto || sugerencias.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setResaltado((i) => Math.min(i + 1, sugerencias.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setResaltado((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(sugerencias[resaltado] || sugerencias[0]); }
    else if (e.key === 'Escape') setAbierto(false);
  };

  return (
    <div className="ua-caja" ref={caja}>
      <input
        type="text"
        className={`ua-input ${className}`}
        value={texto}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => { setTexto(e.target.value); onChange(e.target.value); setAbierto(true); setResaltado(0); }}
        onFocus={() => !disabled && setAbierto(true)}
        onKeyDown={teclas}
        autoComplete="off"
      />
      {abierto && !disabled && (
        <div className="ua-lista">
          {sugerencias.length === 0 ? (
            <div className="ua-vacio">
              {personas.length === 0 ? 'Cargando personas…' : 'Sin coincidencias. Puedes escribir el nombre.'}
            </div>
          ) : sugerencias.map((p, i) => (
            <button
              type="button"
              key={`${p.nombre}-${i}`}
              className={`ua-opcion ${i === resaltado ? 'ua-resaltada' : ''}`}
              onMouseEnter={() => setResaltado(i)}
              onClick={() => elegir(p)}
            >
              <span className="ua-nombre">{p.nombre}</span>
              {p.puesto && <span className="ua-puesto">{p.puesto}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
