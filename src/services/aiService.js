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
 * ID de sesión persistente por navegador: cada usuario mantiene su propia
 * memoria de conversación en el multi-agente (LangGraph checkpointer).
 */
export function getAISessionId() {
  let sid = localStorage.getItem('frigoia_session_id');
  if (!sid) {
    sid = (globalThis.crypto?.randomUUID?.() || `s_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    localStorage.setItem('frigoia_session_id', sid);
  }
  return sid;
}

/**
 * Consulta al agente inteligente por texto.
 * El agente decide automaticamente si buscar trazabilidad, llenar formulario, etc.
 * Envia session_id y nombre del usuario para memoria multi-usuario.
 */
export async function agentQuery(message, conversationHistory = null, userName = '') {
  const response = await fetch(`${AI_API_URL}/agent/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory,
      session_id: getAISessionId(),
      user_name: userName || undefined,
    }),
  });
  if (!response.ok) throw new Error(`Error ${response.status}`);
  return response.json();
}

/**
 * Catálogo de formularios con sus campos/columnas para la consulta guiada.
 * Devuelve [{templateID, codigo, nombre, proceso, campos:[{nombre,tipo,numerico,origen}]}]
 */
export async function getTemplateFields() {
  const response = await fetch(`${AI_API_URL}/templates/fields`);
  if (!response.ok) throw new Error(`Error ${response.status}`);
  const data = await response.json();
  return data.templates || [];
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
 * Obtiene el contenido completo (HeaderData + TODAS las filas BodyData) de un FormID especifico
 * usando el MCP tool obtener_formulario_completo.
 * Devuelve { form_id, template_codigo, template_nombre, header, tablas, ... } o null.
 */
export async function mcpObtenerFormulario(formId) {
  const result = await agentQuery(
    `obtén el contenido completo del formulario llenado con ID ${formId} usando la herramienta obtener_formulario_completo, necesito todas las filas y columnas`
  );

  if (Array.isArray(result.tool_results) && result.tool_results.length > 0) {
    for (const tr of result.tool_results) {
      try {
        const parsed = typeof tr === 'string' ? JSON.parse(tr) : tr;
        if (parsed?.data?.tablas !== undefined) return parsed.data;
      } catch {
        // continuar
      }
    }
  }
  // Fallback: buscar JSON en el texto libre de respuesta
  try {
    const match = result.response?.match(/\{[\s\S]*?"tablas"\s*:\s*\[[\s\S]*?\]\s*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed?.tablas !== undefined) return parsed;
      if (parsed?.data?.tablas !== undefined) return parsed.data;
    }
  } catch { /* ignorar */ }
  return null;
}

/**
 * Rastrea la trazabilidad de un lote consultando FilledForms via MCP auditar_trazabilidad_lote.
 * Devuelve { pasos, soloBorradores, numeroLote, mensaje }
 */
export async function mcpAuditarLote(numeroLote) {
  const result = await agentQuery(
    `rastrea la trazabilidad completa del lote ${numeroLote} usando la herramienta auditar_trazabilidad_lote`
  );

  if (Array.isArray(result.tool_results) && result.tool_results.length > 0) {
    for (const tr of result.tool_results) {
      try {
        const parsed = typeof tr === 'string' ? JSON.parse(tr) : tr;
        if (parsed?.data?.pasos) {
          return {
            pasos: parsed.data.pasos,
            soloBorradores: parsed.data.solo_borradores || false,
            numeroLote: parsed.data.numero_lote || numeroLote,
            mensaje: parsed.message || '',
          };
        }
      } catch {
        // continuar con siguiente resultado
      }
    }
  }

  // Fallback: no se pudo extraer estructura, devolver respuesta de texto
  return {
    pasos: [],
    soloBorradores: false,
    numeroLote,
    mensaje: result.response || 'Sin resultados.',
  };
}

/**
 * Lista todos los templates disponibles via el tool MCP listar_templates.
 * Devuelve array normalizado: [{templateID, codigo, nombre, proceso, quienLoLlena, frecuencia}]
 */
export async function mcpListarTemplates() {
  const result = await agentQuery('lista todos los formularios disponibles en el sistema usando la herramienta listar_templates');

  // Intentar extraer de tool_results (respuesta estructurada del agente)
  if (Array.isArray(result.tool_results) && result.tool_results.length > 0) {
    for (const tr of result.tool_results) {
      try {
        const parsed = typeof tr === 'string' ? JSON.parse(tr) : tr;
        const templates = parsed?.data?.templates || parsed?.templates;
        if (Array.isArray(templates) && templates.length > 0) {
          return templates.map(t => ({
            templateID: t.template_id ?? t.templateID,
            codigo: t.codigo,
            nombre: t.nombre,
            proceso: t.proceso || '',
            quienLoLlena: t.quien_lo_llena || '',
            frecuencia: t.frecuencia || '',
          }));
        }
      } catch {
        // continuar con el siguiente resultado
      }
    }
  }

  // Fallback: intentar extraer JSON del texto de respuesta
  try {
    const match = result.response && result.response.match(/\{[\s\S]*?"templates"\s*:\s*\[[\s\S]*?\]\s*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const templates = parsed?.data?.templates || parsed?.templates;
      if (Array.isArray(templates)) {
        return templates.map(t => ({
          templateID: t.template_id ?? t.templateID,
          codigo: t.codigo,
          nombre: t.nombre,
          proceso: t.proceso || '',
          quienLoLlena: t.quien_lo_llena || '',
          frecuencia: t.frecuencia || '',
        }));
      }
    }
  } catch {
    // ignorar
  }

  return [];
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
