"""
streaming.py - Streaming con filtrado de etiquetas XML internas

Problema: El LLM usa instrucciones XML internas (<rol>, <instrucciones>, etc.)
para razonar. Si enviamos TODO el output al TTS, el operario escucharía
"menor que rol mayor que titulo Gerente de Operaciones..."

Solución: Un buffer que intercepta tokens en streaming, filtra cualquier
contenido entre < y >, y emite SOLO el texto conversacional frase por frase
al motor TTS de Azure.

Arquitectura:
  LLM (streaming) → XMLStreamFilter → frases limpias → Azure TTS → audio

Uso:
    async for frase in stream_agent_response(agent, mensaje, config):
        audio = await tts_frase(frase)  # enviar al operario
"""
from __future__ import annotations

import logging
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from langchain_core.messages import AIMessageChunk

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# XMLStreamFilter — filtra etiquetas XML del stream de tokens
# ---------------------------------------------------------------------------

@dataclass
class XMLStreamFilter:
    """Buffer que filtra etiquetas XML y emite texto limpio frase por frase.

    El filtro mantiene un buffer interno y detecta cuando el LLM está
    generando contenido dentro de etiquetas XML (pensamiento interno).
    Solo emite texto que NO esté dentro de tags XML.

    Emite una frase cuando detecta un delimitador natural:
    punto, signo de interrogación, signo de exclamación, salto de línea,
    o dos puntos seguidos de espacio.
    """

    _buffer: str = field(default="", init=False)
    _inside_tag: bool = field(default=False, init=False)
    _tag_depth: int = field(default=0, init=False)
    _pending_text: str = field(default="", init=False)

    # Delimitadores de frase para TTS (puntos naturales de pausa)
    _SENTENCE_PATTERN: re.Pattern = field(
        default_factory=lambda: re.compile(r'[.!?]\s+|:\s+|\n'),
        init=False,
    )

    def feed(self, token: str) -> list[str]:
        """Procesa un token y retorna frases completas listas para TTS.

        Args:
            token: Token crudo del LLM (puede contener XML parcial).

        Returns:
            Lista de frases limpias (puede estar vacía si aún no hay frase completa).
        """
        frases: list[str] = []

        for char in token:
            if char == '<':
                self._inside_tag = True
                self._tag_depth += 1
                self._buffer = ""
                continue

            if char == '>':
                if self._inside_tag:
                    self._tag_depth = max(0, self._tag_depth - 1)
                    if self._tag_depth == 0:
                        self._inside_tag = False
                    self._buffer = ""
                continue

            if self._inside_tag or self._tag_depth > 0:
                # Dentro de un tag XML — descartar
                continue

            # Texto válido para el operario
            self._pending_text += char

            # Verificar si tenemos una frase completa
            if self._SENTENCE_PATTERN.search(self._pending_text):
                frase = self._pending_text.strip()
                if frase and len(frase) > 2:
                    frases.append(frase)
                self._pending_text = ""

        return frases

    def flush(self) -> str | None:
        """Emite cualquier texto pendiente al final del stream.

        Returns:
            Texto restante o None si no hay nada.
        """
        remaining = self._pending_text.strip()
        self._pending_text = ""
        self._buffer = ""
        self._inside_tag = False
        self._tag_depth = 0
        return remaining if remaining and len(remaining) > 2 else None


# ---------------------------------------------------------------------------
# Streaming del agente con filtrado XML
# ---------------------------------------------------------------------------

async def stream_agent_response(
    agent,
    user_message: str,
    config: dict,
    system_prompt: str = "",
) -> AsyncIterator[str]:
    """Stream de respuestas del agente con filtrado XML para TTS.

    Intercepta los tokens del LLM en streaming, filtra etiquetas XML
    internas y emite frases limpias una por una.

    Args:
        agent: Agente LangGraph compilado.
        user_message: Mensaje del operario.
        config: Config con thread_id para aislamiento.
        system_prompt: System prompt (ya inyectado normalmente).

    Yields:
        Frases limpias sin XML, listas para Azure TTS.

    Ejemplo:
        async for frase in stream_agent_response(agent, "lote 260302", config):
            audio_chunk = await azure_tts(frase)
            send_audio(audio_chunk)
    """
    from langchain_core.messages import HumanMessage, SystemMessage

    xml_filter = XMLStreamFilter()

    messages = []
    if system_prompt:
        messages.append(SystemMessage(content=system_prompt))
    messages.append(HumanMessage(content=user_message))

    try:
        async for event in agent.astream_events(
            {"messages": messages},
            config=config,
            version="v2",
        ):
            kind = event.get("event", "")

            # Solo nos interesan los tokens del LLM (no tool calls)
            if kind == "on_chat_model_stream":
                chunk = event.get("data", {}).get("chunk")
                if isinstance(chunk, AIMessageChunk) and chunk.content:
                    # No emitir tokens que son tool_calls
                    if getattr(chunk, "tool_calls", None) or getattr(chunk, "tool_call_chunks", None):
                        continue

                    token = str(chunk.content)
                    frases = xml_filter.feed(token)
                    for frase in frases:
                        yield frase

        # Emitir texto restante
        remaining = xml_filter.flush()
        if remaining:
            yield remaining

    except Exception as exc:
        log.error("Error en streaming del agente: %s", exc)
        yield "Ocurrió un error al procesar tu solicitud."


# ---------------------------------------------------------------------------
# Streaming para FastAPI (SSE)
# ---------------------------------------------------------------------------

async def stream_agent_sse(
    agent,
    user_message: str,
    config: dict,
    system_prompt: str = "",
) -> AsyncIterator[str]:
    """Genera eventos SSE con frases filtradas para el frontend.

    Formato: data: {"frase": "texto limpio", "done": false}

    Args:
        agent: Agente LangGraph.
        user_message: Texto del operario.
        config: Config con thread_id.
        system_prompt: System prompt.

    Yields:
        Strings en formato SSE.
    """
    import json

    async for frase in stream_agent_response(agent, user_message, config, system_prompt):
        yield f"data: {json.dumps({'frase': frase, 'done': False}, ensure_ascii=False)}\n\n"

    yield f"data: {json.dumps({'frase': '', 'done': True})}\n\n"
