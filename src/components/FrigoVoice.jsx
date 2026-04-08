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
  speak,
} from '../services/aiService';
import './FrigoVoice.css';

const SUGGESTIONS = [
  'Trazabilidad del lote 260302',
  'Iniciar control de sellos maquina 2',
  'Que formularios hay disponibles?',
  'Quien firmo el fileteo del lote 260318?',
];

// Modos de operacion
const MODES = {
  AGENT: 'agent',   // Tool Calling directo a SQL
  RAG: 'rag',       // ChromaDB + embeddings
};

export default function FrigoVoice() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState(MODES.AGENT);
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

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

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

        const result = await agentQuery(query, history);
        responseText = result.response;
        toolsUsed = result.tools_used || [];
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
                  {mode === MODES.AGENT ? 'Agente Inteligente' : 'Busqueda RAG'}
                </small>
              </div>
            </div>
            <div className="frigovoice-header__actions">
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
              <button className="frigovoice-header__close" onClick={() => setIsOpen(false)}>
                {'\u2715'}
              </button>
            </div>
          </div>

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

          {/* Sugerencias (solo si hay pocos mensajes) */}
          {messages.length <= 2 && (
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
        </div>
      )}
    </>
  );
}
