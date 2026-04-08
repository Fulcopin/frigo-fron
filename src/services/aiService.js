/**
 * aiService.js - Servicio de conexion al backend FrigoVoice AI
 */

const AI_API_URL = import.meta.env.VITE_AI_API_URL || 'http://localhost:8100/api/ai';

/**
 * Consulta de trazabilidad por texto
 */
export async function queryTraceability(query, nResults = 3) {
  const response = await fetch(`${AI_API_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, n_results: nResults }),
  });
  if (!response.ok) throw new Error(`Error ${response.status}`);
  return response.json();
}

/**
 * Consulta por voz - envia audio WebM y recibe transcripcion + respuesta
 */
export async function voiceQuery(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const response = await fetch(`${AI_API_URL}/voice`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error(`Error ${response.status}`);
  return response.json();
}

/**
 * Obtener reporte de auditoria de un lote
 */
export async function getAuditReport(loteNum) {
  const response = await fetch(`${AI_API_URL}/audit/${loteNum}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error(`Error ${response.status}`);
  return response.json();
}

/**
 * Obtener narrativa cruda de un lote
 */
export async function getLoteNarrative(loteNum) {
  const response = await fetch(`${AI_API_URL}/lote/${loteNum}`);
  if (!response.ok) throw new Error(`Error ${response.status}`);
  return response.json();
}

/**
 * Busqueda semantica en lotes
 */
export async function searchLotes(query, n = 5) {
  const params = new URLSearchParams({ q: query, n: n.toString() });
  const response = await fetch(`${AI_API_URL}/search?${params}`);
  if (!response.ok) throw new Error(`Error ${response.status}`);
  return response.json();
}

/**
 * Estadisticas del sistema AI
 */
export async function getAIStats() {
  const response = await fetch(`${AI_API_URL}/stats`);
  if (!response.ok) throw new Error(`Error ${response.status}`);
  return response.json();
}

/**
 * Ejecutar pipeline ETL
 */
export async function runPipeline(source = 'api') {
  const params = new URLSearchParams({ source });
  const response = await fetch(`${AI_API_URL}/pipeline/run?${params}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error(`Error ${response.status}`);
  return response.json();
}

// ===========================================================================
// Agente con Tool Calling (Fase 2 - SQL directo, sin ChromaDB)
// ===========================================================================

/**
 * Consulta al agente inteligente por texto.
 * El agente decide automaticamente si buscar trazabilidad, llenar formulario, etc.
 */
export async function agentQuery(message, conversationHistory = null) {
  const response = await fetch(`${AI_API_URL}/agent/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory,
    }),
  });
  if (!response.ok) throw new Error(`Error ${response.status}`);
  return response.json();
}

/**
 * Consulta al agente por voz - envía audio, el agente decide que hacer.
 */
export async function agentVoiceQuery(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const response = await fetch(`${AI_API_URL}/agent/voice`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error(`Error ${response.status}`);
  return response.json();
}

/**
 * Text-to-Speech usando Web Speech API del navegador
 */
export function speak(text, lang = 'es-ES') {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Buscar voz en espanol
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(v => v.lang.startsWith('es'));
    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);

    window.speechSynthesis.speak(utterance);
  });
}
