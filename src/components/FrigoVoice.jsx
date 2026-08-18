/**
 * FrigoVoice.jsx - Chatbot de voz e IA para trazabilidad
 *
 * Componente flotante que permite consultas por texto y voz.
 * Soporta dos modos:
 *   - RAG (ChromaDB + LLM): busqueda semantica pre-vectorizada
 *   - Agent (LangChain Tool Calling): SQL directo + crea borradores
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  queryTraceability,
  voiceQuery,
  agentQuery,
  agentVoiceQuery,
  getTemplateFields,
  speak,
} from '../services/aiService';
import authService from '../services/authService';
import {
  enviarMensajeAdmin, listarMensajes, responderMensaje, cambiarEstado,
  contarPendientes, esAdminDeMensajes, ESTADOS_MENSAJE,
} from '../services/mensajesAdminService';
import './FrigoVoice.css';

const SUGGESTIONS = [
  'Cual fue el rendimiento de esta semana?',
  'Que novedades hay en observaciones estos 15 dias?',
  'Divide el peso neto entre el peso recibido del mes',
  'Trazabilidad del lote 260302',
];

// Modos de operacion
const MODES = {
  AGENT: 'agent',   // Tool Calling directo a SQL
  RAG: 'rag',       // ChromaDB + embeddings
};

// Operaciones de la consulta guiada (formulario + columna + operacion)
const OPERACIONES = [
  { key: 'promedio', label: '📊 Promedio', frase: (col) => `el promedio de la columna [${col}]` },
  { key: 'maximo', label: '⬆️ Máximo', frase: (col) => `el valor máximo de la columna [${col}]` },
  { key: 'minimo', label: '⬇️ Mínimo', frase: (col) => `el valor mínimo de la columna [${col}]` },
  { key: 'suma', label: '➕ Suma', frase: (col) => `la suma total de la columna [${col}]` },
  { key: 'dividir', label: '➗ Dividir A÷B', frase: null, requiere2: true },
  { key: 'rendimiento', label: '🎯 Rendimiento', frase: null },
  { key: 'observaciones', label: '📝 Observaciones', frase: null },
];

const PERIODOS = [
  { dias: 7, label: '7 días' },
  { dias: 15, label: '15 días' },
  { dias: 30, label: '30 días' },
];

// Pestañas de la ventana
const TABS = {
  CHAT: 'chat',
  ADMIN: 'admin',
};

export default function FrigoVoice() {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState(TABS.CHAT);
  const [mode, setMode] = useState(MODES.AGENT);

  // ✉️ Canal "Mensaje a ADMIN": los mensajes se guardan como tickets.
  const esAdmin = esAdminDeMensajes();
  const [msgAsunto, setMsgAsunto] = useState('');
  const [msgTexto, setMsgTexto] = useState('');
  const [msgEnviando, setMsgEnviando] = useState(false);
  const [msgAviso, setMsgAviso] = useState(null);   // { tipo: 'ok'|'error', texto }
  const [mensajes, setMensajes] = useState([]);
  const [msgCargando, setMsgCargando] = useState(false);
  const [respuestas, setRespuestas] = useState({}); // { [ticketId]: texto }
  const pendientes = esAdmin ? contarPendientes(mensajes) : 0;
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hola, soy FrigoVoice. Puedo consultar trazabilidad de lotes, llenar formularios por voz, o generar reportes de auditoria. Escribe o usa el microfono.',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // 🎯 Consulta guiada: elegir formulario + columnas + operación
  const [showGuided, setShowGuided] = useState(false);
  const [templatesCat, setTemplatesCat] = useState([]);
  const [guidedTemplate, setGuidedTemplate] = useState('');
  const [guidedCols, setGuidedCols] = useState([]);
  const [guidedDias, setGuidedDias] = useState(15);

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Cargar catálogo de formularios/campos al abrir la consulta guiada
  useEffect(() => {
    if (showGuided && templatesCat.length === 0) {
      getTemplateFields().then(setTemplatesCat).catch(() => setTemplatesCat([]));
    }
  }, [showGuided, templatesCat.length]);

  // ── ✉️ Mensaje a ADMIN ──────────────────────────────────────────────────
  const cargarMensajes = useCallback(async () => {
    setMsgCargando(true);
    try {
      setMensajes(await listarMensajes());
    } catch {
      setMensajes([]); // sin conexión: la pestaña sigue sirviendo para escribir
    } finally {
      setMsgCargando(false);
    }
  }, []);

  // Al abrir la ventana se traen los mensajes: así el admin ve el contador de
  // pendientes en la pestaña sin tener que entrar.
  useEffect(() => {
    if (isOpen) cargarMensajes();
  }, [isOpen, cargarMensajes]);

  // Mientras la ventana está abierta se refresca solo, para que un mensaje
  // nuevo aparezca sin recargar la página.
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(cargarMensajes, 60000);
    return () => clearInterval(id);
  }, [isOpen, cargarMensajes]);

  const enviarAlAdmin = async (e) => {
    e.preventDefault();
    setMsgEnviando(true);
    setMsgAviso(null);
    try {
      await enviarMensajeAdmin({ asunto: msgAsunto, mensaje: msgTexto });
      setMsgAsunto('');
      setMsgTexto('');
      setMsgAviso({ tipo: 'ok', texto: '✅ Mensaje enviado. El administrador fue notificado.' });
      await cargarMensajes();
    } catch (err) {
      setMsgAviso({ tipo: 'error', texto: `❌ ${err.message || 'No se pudo enviar.'}` });
    } finally {
      setMsgEnviando(false);
    }
  };

  const enviarRespuesta = async (ticket, cerrar) => {
    try {
      await responderMensaje(ticket, respuestas[ticket.id], cerrar);
      setRespuestas(prev => ({ ...prev, [ticket.id]: '' }));
      await cargarMensajes();
    } catch (err) {
      setMsgAviso({ tipo: 'error', texto: `❌ ${err.message || 'No se pudo responder.'}` });
    }
  };

  const cambiarEstadoMensaje = async (ticket, estado) => {
    try {
      await cambiarEstado(ticket, estado);
      await cargarMensajes();
    } catch (err) {
      setMsgAviso({ tipo: 'error', texto: `❌ ${err.message || 'No se pudo cambiar el estado.'}` });
    }
  };

  const selectedTemplateCat = templatesCat.find(t => t.codigo === guidedTemplate);

  const toggleGuidedCol = (nombre) => {
    setGuidedCols(prev => prev.includes(nombre)
      ? prev.filter(c => c !== nombre)
      : [...prev.slice(-1), nombre]); // máximo 2 columnas seleccionadas
  };

  // Construye la pregunta en lenguaje natural y la envía al agente
  const runGuidedQuery = (op) => {
    const codigo = guidedTemplate;
    const [colA, colB] = guidedCols;
    let msg = '';
    if (op.key === 'rendimiento') {
      msg = `Analiza el rendimiento de los últimos ${guidedDias} días` +
        (codigo ? ` del formulario ${codigo}` : '') + ', dime el mejor y el peor día.';
    } else if (op.key === 'observaciones') {
      msg = `¿Qué observaciones o novedades hay en los últimos ${guidedDias} días` +
        (codigo ? ` del formulario ${codigo}` : '') + '?';
    } else if (op.requiere2) {
      if (!colA || !colB) return;
      msg = `En el formulario ${codigo}, calcula [${colA}] / [${colB}] * 100 de los últimos ${guidedDias} días, día por día.`;
    } else {
      if (!colA) return;
      msg = `En el formulario ${codigo}, calcula ${op.frase(colA)} de los últimos ${guidedDias} días, día por día.`;
    }
    setShowGuided(false);
    handleSend(msg);
  };

  // Auto-scroll al ultimo mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Enviar consulta por texto
  const handleSend = useCallback(async (text) => {
    const query = text || inputText.trim();
    if (!query || isLoading) return;

    setInputText('');
    setMessages(prev => [...prev, { role: 'user', text: query }]);
    setIsLoading(true);

    try {
      let responseText = '';
      let sources = [];
      let toolsUsed = [];

      if (mode === MODES.AGENT) {
        // Construir historial de conversacion para el agente
        const history = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-6)
          .map(m => ({ role: m.role, text: m.text }));

        const currentUser = authService.getCurrentUser();
        const result = await agentQuery(query, history, currentUser?.nombre || currentUser?.username || '');
        responseText = result.response;
        toolsUsed = result.tools_used || [];
        if (result.active_agent && result.active_agent !== 'directo' && result.active_agent !== 'supervisor') {
          toolsUsed = [...toolsUsed, `agente: ${result.active_agent}`];
        }
      } else {
        const result = await queryTraceability(query);
        responseText = result.answer;
        sources = result.sources || [];
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: responseText,
          sources,
          toolsUsed,
        },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: 'Error al consultar el sistema. Verifica que el servidor AI este activo.',
          error: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, mode, messages]);

  // Iniciar grabacion de voz
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 100) return;

        setMessages(prev => [...prev, { role: 'user', text: '(mensaje de voz)', isVoice: true }]);
        setIsLoading(true);

        try {
          let responseText = '';
          let transcription = '';
          let sources = [];
          let toolsUsed = [];

          if (mode === MODES.AGENT) {
            const result = await agentVoiceQuery(audioBlob);
            responseText = result.response;
            transcription = result.transcription;
            toolsUsed = result.tools_used || [];
          } else {
            const result = await voiceQuery(audioBlob);
            responseText = result.answer;
            transcription = result.transcription;
            sources = result.sources || [];
          }

          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              text: responseText,
              transcription,
              sources,
              toolsUsed,
            },
          ]);

          // TTS: leer la respuesta en voz alta
          if (responseText) {
            setIsSpeaking(true);
            try {
              await speak(responseText);
            } catch { /* TTS not critical */ }
            setIsSpeaking(false);
          }
        } catch (err) {
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              text: 'Error al procesar el audio. Verifica que el servidor AI este activo.',
              error: true,
            },
          ]);
        } finally {
          setIsLoading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      globalThis.alert('No se pudo acceder al microfono. Verifica los permisos del navegador.');
    }
  }, [mode]);

  // Detener grabacion
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  // Parar TTS
  const stopSpeaking = useCallback(() => {
    globalThis.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Boton flotante */}
      <button
        className={`frigovoice-fab ${isOpen ? 'frigovoice-fab--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="FrigoVoice AI"
      >
        {isOpen ? '\u2715' : '\uD83E\uDD16'}
      </button>

      {/* Panel del chat */}
      {isOpen && (
        <div className="frigovoice-panel">
          {/* Header */}
          <div className="frigovoice-header">
            <div className="frigovoice-header__title">
              <span className="frigovoice-header__icon">{'\uD83D\uDC1F'}</span>
              <div>
                <strong>FrigoVoice AI</strong>
                <small>
                  {tab === TABS.ADMIN
                    ? (esAdmin ? 'Mensajes recibidos' : 'Escribir al administrador')
                    : (mode === MODES.AGENT ? 'Agente Inteligente' : 'Busqueda RAG')}
                </small>
              </div>
            </div>
            <div className="frigovoice-header__actions">
              {/* Los controles del asistente no aplican en la pestaña de mensajes */}
              {tab === TABS.CHAT && (
                <>
                  {/* 🎯 Consulta guiada */}
                  <button
                    className="frigovoice-mode-toggle"
                    onClick={() => setShowGuided(!showGuided)}
                    title="Consulta guiada: elige formulario, columna y operación"
                    style={{ background: showGuided ? '#7c3aed' : undefined, color: showGuided ? '#fff' : undefined }}
                  >
                    🎯
                  </button>
                  {/* Toggle de modo */}
                  <button
                    className={`frigovoice-mode-toggle ${mode === MODES.AGENT ? 'frigovoice-mode-toggle--agent' : ''}`}
                    onClick={() => setMode(mode === MODES.AGENT ? MODES.RAG : MODES.AGENT)}
                    title={mode === MODES.AGENT
                      ? 'Modo: Agente (SQL directo + Tools). Click para cambiar a RAG.'
                      : 'Modo: RAG (ChromaDB). Click para cambiar a Agente.'}
                  >
                    {mode === MODES.AGENT ? 'Agent' : 'RAG'}
                  </button>
                </>
              )}
              <button className="frigovoice-header__close" onClick={() => setIsOpen(false)}>
                {'\u2715'}
              </button>
            </div>
          </div>

          {/* Pestañas: asistente / mensaje al administrador */}
          <div className="frigovoice-tabs">
            <button
              className={`frigovoice-tab ${tab === TABS.CHAT ? 'frigovoice-tab--active' : ''}`}
              onClick={() => setTab(TABS.CHAT)}
            >
              💬 Asistente
            </button>
            <button
              className={`frigovoice-tab ${tab === TABS.ADMIN ? 'frigovoice-tab--active' : ''}`}
              onClick={() => { setTab(TABS.ADMIN); setMsgAviso(null); }}
              title={esAdmin
                ? 'Mensajes que te mandaron desde la app'
                : 'Escribile al administrador; te contesta desde acá'}
            >
              ✉️ Mensaje a ADMIN
              {pendientes > 0 && <span className="frigovoice-tab__badge">{pendientes}</span>}
            </button>
          </div>

          {/* ✉️ PESTAÑA: MENSAJE A ADMIN */}
          {tab === TABS.ADMIN && (
            <div className="frigovoice-admin">
              {msgAviso && (
                <div className={`frigovoice-admin__aviso frigovoice-admin__aviso--${msgAviso.tipo}`}>
                  {msgAviso.texto}
                </div>
              )}

              {/* Escribir al administrador: lo puede hacer cualquiera */}
              <form className="frigovoice-admin__form" onSubmit={enviarAlAdmin}>
                <input
                  type="text"
                  value={msgAsunto}
                  onChange={(e) => setMsgAsunto(e.target.value)}
                  placeholder="Asunto (ej: Error al guardar el PD-04)"
                  maxLength={150}
                />
                <textarea
                  value={msgTexto}
                  onChange={(e) => setMsgTexto(e.target.value)}
                  placeholder="Contá qué pasó, en qué formulario y con qué lote…"
                  rows={3}
                />
                <button type="submit" disabled={msgEnviando || !msgAsunto.trim() || !msgTexto.trim()}>
                  {msgEnviando ? 'Enviando…' : '📨 Enviar al administrador'}
                </button>
                <small>
                  Se registra como ticket y le llega una notificación por correo al administrador.
                </small>
              </form>

              {/* Bandeja: el admin ve todo; el resto, solo lo suyo con la respuesta */}
              <div className="frigovoice-admin__lista">
                <div className="frigovoice-admin__lista-cab">
                  <strong>
                    {esAdmin
                      ? `🔔 Notificaciones recibidas (${mensajes.length})`
                      : `📬 Mis mensajes (${mensajes.length})`}
                  </strong>
                  <button type="button" onClick={cargarMensajes} disabled={msgCargando}>
                    {msgCargando ? '⏳' : '🔄'}
                  </button>
                </div>

                {mensajes.length === 0 && !msgCargando && (
                  <div className="frigovoice-admin__vacio">
                    {esAdmin ? 'No hay mensajes todavía.' : 'Todavía no enviaste ningún mensaje.'}
                  </div>
                )}

                {mensajes.map((t) => {
                  const estado = String(t.estado || 'abierto').toLowerCase();
                  return (
                    <div key={t.id} className={`frigovoice-admin__item frigovoice-admin__item--${estado}`}>
                      <div className="frigovoice-admin__item-cab">
                        <strong>{t.titulo}</strong>
                        <span className="frigovoice-admin__estado">
                          {ESTADOS_MENSAJE.find(e => e.value === estado)?.label || estado}
                        </span>
                      </div>
                      <div className="frigovoice-admin__meta">
                        👤 {t.creadoPorNombre || 'Desconocido'}
                        {t.creadoEn && ` · ${new Date(t.creadoEn).toLocaleString('es-EC')}`}
                      </div>
                      <div className="frigovoice-admin__texto">{t.descripcion}</div>

                      {t.respuestaAdmin && (
                        <div className="frigovoice-admin__respuesta">
                          <strong>↩️ Respuesta{t.respondidoPor ? ` de ${t.respondidoPor}` : ''}:</strong>
                          <div>{t.respuestaAdmin}</div>
                        </div>
                      )}

                      {/* Contestar y cerrar: solo el administrador */}
                      {esAdmin && (
                        <div className="frigovoice-admin__acciones">
                          <textarea
                            value={respuestas[t.id] || ''}
                            onChange={(e) => setRespuestas(p => ({ ...p, [t.id]: e.target.value }))}
                            placeholder="Escribí la respuesta…"
                            rows={2}
                          />
                          <div className="frigovoice-admin__botones">
                            <button
                              type="button"
                              onClick={() => enviarRespuesta(t, false)}
                              disabled={!String(respuestas[t.id] || '').trim()}
                            >
                              ↩️ Responder
                            </button>
                            <button
                              type="button"
                              onClick={() => enviarRespuesta(t, true)}
                              disabled={!String(respuestas[t.id] || '').trim()}
                            >
                              ✅ Responder y cerrar
                            </button>
                            <select value={estado} onChange={(e) => cambiarEstadoMensaje(t, e.target.value)}>
                              {ESTADOS_MENSAJE.map(e => (
                                <option key={e.value} value={e.value}>{e.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 💬 PESTAÑA: ASISTENTE */}
          {tab === TABS.CHAT && (
          <>
          {/* Mensajes */}
          <div className="frigovoice-messages">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`frigovoice-msg frigovoice-msg--${msg.role} ${msg.error ? 'frigovoice-msg--error' : ''}`}
              >
                {msg.transcription && (
                  <div className="frigovoice-msg__transcription">
                    Transcripcion: &quot;{msg.transcription}&quot;
                  </div>
                )}
                <div className="frigovoice-msg__text">{msg.text}</div>
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="frigovoice-msg__tools">
                    {msg.toolsUsed.map((t, j) => (
                      <span key={j} className="frigovoice-msg__tool-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="frigovoice-msg__sources">
                    {msg.sources.map((s, j) => (
                      <span key={j} className="frigovoice-msg__source-tag">
                        Lote {s.lote}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="frigovoice-msg frigovoice-msg--assistant">
                <div className="frigovoice-msg__typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 🎯 Panel de consulta guiada */}
          {showGuided && (
            <div style={{
              padding: '10px 12px', borderTop: '1px solid #e5e7eb', background: '#faf5ff',
              display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '46%', overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={guidedTemplate}
                  onChange={(e) => { setGuidedTemplate(e.target.value); setGuidedCols([]); }}
                  style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #c4b5fd', fontSize: '12px' }}
                >
                  <option value="">📋 Elige un formulario...</option>
                  {templatesCat.map(t => (
                    <option key={t.templateID} value={t.codigo}>{t.codigo} — {t.nombre}</option>
                  ))}
                </select>
                <select
                  value={guidedDias}
                  onChange={(e) => setGuidedDias(Number(e.target.value))}
                  style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #c4b5fd', fontSize: '12px' }}
                >
                  {PERIODOS.map(p => <option key={p.dias} value={p.dias}>{p.label}</option>)}
                </select>
              </div>

              {templatesCat.length === 0 && (
                <span style={{ fontSize: '11px', color: '#6b7280' }}>⏳ Cargando formularios...</span>
              )}

              {/* Columnas del formulario elegido (numéricas primero) */}
              {selectedTemplateCat && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {[...selectedTemplateCat.campos]
                    .sort((a, b) => (b.numerico ? 1 : 0) - (a.numerico ? 1 : 0))
                    .slice(0, 30)
                    .map(c => (
                      <button
                        key={c.nombre}
                        onClick={() => toggleGuidedCol(c.nombre)}
                        title={`${c.origen} · ${c.tipo}`}
                        style={{
                          fontSize: '10.5px', padding: '3px 8px', borderRadius: '10px', cursor: 'pointer',
                          border: guidedCols.includes(c.nombre) ? '1.5px solid #7c3aed' : '1px solid #d1d5db',
                          background: guidedCols.includes(c.nombre) ? '#ede9fe' : (c.numerico ? '#fff' : '#f9fafb'),
                          color: c.numerico ? '#111827' : '#9ca3af', fontWeight: guidedCols.includes(c.nombre) ? 700 : 400
                        }}
                      >
                        {c.numerico ? '🔢 ' : ''}{c.nombre}
                      </button>
                    ))}
                </div>
              )}

              {guidedCols.length > 0 && (
                <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600 }}>
                  Seleccionadas: {guidedCols.join(' y ')}
                </span>
              )}

              {/* Operaciones */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {OPERACIONES.map(op => {
                  const necesitaCol = !['rendimiento', 'observaciones'].includes(op.key);
                  const deshabilitado = isLoading
                    || (necesitaCol && (!guidedTemplate || guidedCols.length === 0))
                    || (op.requiere2 && guidedCols.length < 2);
                  return (
                    <button
                      key={op.key}
                      onClick={() => runGuidedQuery(op)}
                      disabled={deshabilitado}
                      style={{
                        fontSize: '11px', padding: '5px 9px', borderRadius: '7px',
                        border: 'none', cursor: deshabilitado ? 'not-allowed' : 'pointer',
                        background: deshabilitado ? '#e5e7eb' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                        color: deshabilitado ? '#9ca3af' : '#fff', fontWeight: 600
                      }}
                    >
                      {op.label}
                    </button>
                  );
                })}
              </div>
              <span style={{ fontSize: '10px', color: '#6b7280' }}>
                Elige formulario y columna(s) 🔢, luego la operación. Rendimiento y Observaciones funcionan también sin columna.
              </span>
            </div>
          )}

          {/* Sugerencias (solo si hay pocos mensajes) */}
          {messages.length <= 2 && !showGuided && (
            <div className="frigovoice-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className="frigovoice-suggestion"
                  onClick={() => handleSend(s)}
                  disabled={isLoading}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="frigovoice-input">
            <textarea
              className="frigovoice-input__text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === MODES.AGENT
                  ? 'Pregunta, dicta un formulario, busca lotes...'
                  : 'Pregunta sobre un lote...'
              }
              rows={1}
              disabled={isLoading || isRecording}
            />

            {/* Boton de voz */}
            {isRecording ? (
              <button
                className="frigovoice-input__btn frigovoice-input__btn--recording"
                onClick={stopRecording}
                title="Detener grabacion"
              >
                {'\u23F9'}
              </button>
            ) : (
              <button
                className="frigovoice-input__btn frigovoice-input__btn--mic"
                onClick={startRecording}
                disabled={isLoading}
                title="Hablar"
              >
                {'\uD83C\uDF99'}
              </button>
            )}

            {/* Boton enviar texto */}
            <button
              className="frigovoice-input__btn frigovoice-input__btn--send"
              onClick={() => handleSend()}
              disabled={isLoading || !inputText.trim()}
              title="Enviar"
            >
              {'\u27A4'}
            </button>

            {/* Boton parar TTS */}
            {isSpeaking && (
              <button
                className="frigovoice-input__btn frigovoice-input__btn--stop-tts"
                onClick={stopSpeaking}
                title="Detener voz"
              >
                {'\uD83D\uDD07'}
              </button>
            )}
          </div>
          </>
          )}
        </div>
      )}
    </>
  );
}
