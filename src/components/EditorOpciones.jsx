import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * 📋 Editor de opciones de una lista desplegable.
 *
 * Reemplaza al campo "Opciones (coma)" que convertía el texto en lista en cada
 * tecla: al escribir "Kg," la coma desaparecía al instante (y también el
 * espacio final), así que no se podía agregar una segunda opción ni escribir
 * opciones de dos palabras.
 *
 * Formas de cargar opciones:
 *  - Escribir y presionar Enter o ➕ (una coma también separa: "Kg, Lbs").
 *  - Pegar varias separadas por coma o por línea.
 *  - "📝 Editar lista": ventana emergente con una opción por línea.
 *
 * Props:
 *  - opciones: string[]
 *  - onChange(nuevas: string[])
 *  - titulo: texto para la ventana (ej. "UNIDAD DE MEDIDA")
 */

/** "Kg, Lbs\nUnidad" → ["Kg", "Lbs", "Unidad"], sin vacíos ni repetidos. */
export const separarOpciones = (texto) => {
  const vistas = new Set();
  return String(texto ?? "")
    .split(/[\n,;]/)
    .map(o => o.trim())
    .filter(o => {
      const clave = o.toLowerCase();
      if (!o || vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    });
};

// Los botones no le quitan el foco al campo: si lo hicieran, el onBlur
// agregaría lo escrito y el clic aplicaría otro cambio sobre la lista vieja.
const noRobarFoco = (e) => e.preventDefault();

const unir = (actuales, nuevas) => separarOpciones([...actuales, ...nuevas].join("\n"));

export default function EditorOpciones({ opciones = [], onChange, titulo = "" }) {
  const lista = Array.isArray(opciones) ? opciones.map(String) : [];
  const [nueva, setNueva] = useState("");
  const [ventanaAbierta, setVentanaAbierta] = useState(false);

  const agregar = (texto) => {
    const aAgregar = separarOpciones(texto);
    if (aAgregar.length === 0) return;
    onChange(unir(lista, aAgregar));
    setNueva("");
  };

  const quitar = (i) => onChange(lista.filter((_, j) => j !== i));

  const mover = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    const copia = [...lista];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    onChange(copia);
  };

  const estiloChip = {
    display: "inline-flex", alignItems: "center", gap: "4px",
    background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: "999px",
    padding: "2px 4px 2px 10px", fontSize: "12.5px", color: "#1e3a8a",
  };
  const estiloBotonChip = {
    border: "none", background: "transparent", cursor: "pointer",
    padding: "0 4px", fontSize: "12px", lineHeight: 1, color: "#1e40af",
  };

  return (
    <div>
      {/* Opciones cargadas */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: lista.length ? "6px" : 0 }}>
        {lista.map((op, i) => (
          <span key={`${op}-${i}`} style={estiloChip}>
            {op}
            <button type="button" onMouseDown={noRobarFoco} style={estiloBotonChip} title="Mover a la izquierda"
              onClick={() => mover(i, -1)} disabled={i === 0}
              aria-label={`Mover ${op} antes`}>‹</button>
            <button type="button" onMouseDown={noRobarFoco} style={estiloBotonChip} title="Mover a la derecha"
              onClick={() => mover(i, 1)} disabled={i === lista.length - 1}
              aria-label={`Mover ${op} después`}>›</button>
            <button type="button" onMouseDown={noRobarFoco} style={{ ...estiloBotonChip, color: "#dc2626" }} title="Quitar"
              onClick={() => quitar(i)} aria-label={`Quitar ${op}`}>✕</button>
          </span>
        ))}
      </div>

      {/* Agregar */}
      <div style={{ display: "flex", gap: "4px" }}>
        <input
          type="text"
          value={nueva}
          onChange={(e) => {
            const v = e.target.value;
            // Una coma cierra la opción escrita y deja el campo listo para la siguiente.
            if (/[,;\n]/.test(v)) agregar(v);
            else setNueva(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); agregar(nueva); }
            else if (e.key === "Backspace" && nueva === "" && lista.length > 0) {
              quitar(lista.length - 1);   // borrar la última, como en un campo de etiquetas
            }
          }}
          onBlur={() => { if (nueva.trim()) agregar(nueva); }}
          onPaste={(e) => {
            const pegado = e.clipboardData.getData("text");
            if (/[,;\n]/.test(pegado)) { e.preventDefault(); agregar(nueva + pegado); }
          }}
          placeholder={lista.length ? "Otra opción + Enter" : "Ej: Kg + Enter"}
          style={{ flex: 1, minWidth: 0, padding: "6px 8px", border: "1px solid #93c5fd", borderRadius: "5px", fontSize: "13px" }}
        />
        <button type="button" onMouseDown={noRobarFoco} onClick={() => agregar(nueva)} title="Agregar opción"
          style={{ background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: "5px", padding: "0 9px", cursor: "pointer" }}>
          ➕
        </button>
        <button type="button" onClick={() => setVentanaAbierta(true)} title="Escribir varias opciones, una por línea"
          style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: "5px", padding: "0 9px", cursor: "pointer", whiteSpace: "nowrap", fontSize: "12.5px", color: "#1e40af" }}>
          📝 Lista
        </button>
      </div>

      {ventanaAbierta && (
        <VentanaOpciones
          titulo={titulo}
          opciones={lista}
          onCancelar={() => setVentanaAbierta(false)}
          onGuardar={(nuevas) => { onChange(nuevas); setVentanaAbierta(false); }}
        />
      )}
    </div>
  );
}

/** Ventana emergente: todas las opciones en un cuadro, una por línea. */
function VentanaOpciones({ titulo, opciones, onCancelar, onGuardar }) {
  const [texto, setTexto] = useState(opciones.join("\n"));
  const areaRef = useRef(null);
  const resultado = separarOpciones(texto);

  const cancelarRef = useRef(onCancelar);
  cancelarRef.current = onCancelar;

  // Foco una sola vez al abrir; Escape cierra.
  useEffect(() => {
    areaRef.current?.focus();
    const alPresionar = (e) => { if (e.key === "Escape") cancelarRef.current(); };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editar opciones"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancelar(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15, 23, 42, 0.45)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
      }}
    >
      <div style={{
        background: "white", borderRadius: "12px", width: "min(460px, 100%)",
        boxShadow: "0 20px 50px rgba(0,0,0,0.25)", overflow: "hidden",
      }}>
        <div style={{ background: "#1e40af", color: "white", padding: "12px 16px", fontWeight: 700 }}>
          📋 Opciones{titulo ? ` de "${titulo}"` : ""}
        </div>

        <div style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "12.5px", color: "#475569", marginBottom: "8px" }}>
            Escribe <strong>una opción por línea</strong>. Las repetidas y las líneas vacías se ignoran.
          </div>
          <textarea
            ref={areaRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl/Cmd + Enter guarda
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onGuardar(resultado); }
            }}
            rows={10}
            placeholder={"Kg\nLbs\nUnidad\nCaja"}
            style={{
              width: "100%", boxSizing: "border-box", padding: "10px", fontSize: "14px",
              border: "2px solid #93c5fd", borderRadius: "8px", resize: "vertical", fontFamily: "inherit",
            }}
          />
          <div style={{ fontSize: "12px", color: "#1e40af", marginTop: "6px" }}>
            {resultado.length === 0
              ? "Sin opciones"
              : `${resultado.length} opción(es): ${resultado.join(" · ")}`}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "10px 16px", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
          <button type="button" onClick={onCancelar}
            style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "white", cursor: "pointer" }}>
            Cancelar
          </button>
          <button type="button" onClick={() => onGuardar(resultado)}
            style={{ padding: "8px 14px", borderRadius: "6px", border: "none", background: "#2563eb", color: "white", fontWeight: 600, cursor: "pointer" }}>
            Guardar opciones
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
