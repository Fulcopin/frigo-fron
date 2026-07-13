"""
server.py - FastAPI server para FrigoVoice AI v3.1

ENDPOINTS:
  POST /webhook/telegram        → Recibe updates de Telegram (modo webhook).
                                  Requiere WEBHOOK_URL y WEBHOOK_SECRET en .env.
  GET  /health                  → Health check (usado por Azure Container Apps).
  POST /api/ai/agent/query      → Texto → Agente → Tools SQL → Respuesta
  POST /api/ai/agent/voice      → Audio → Whisper → Agente → Respuesta
  POST /api/ai/agent/stream     → SSE streaming de la respuesta del agente

MODOS DE DESPLIEGUE:
  - Webhook (Azure Container Apps):
      CMD: uvicorn server:app --host 0.0.0.0 --port 8000
      Variables requeridas: WEBHOOK_URL, WEBHOOK_SECRET, TELEGRAM_BOT_TOKEN
      El lifespan registra el webhook en Telegram al arrancar y lo borra al parar.

  - Polling (VM / desarrollo):
      CMD: python telegram_bot.py
      No se usa este servidor para el bot; solo para la API REST.
"""
from contextlib import asynccontextmanager
import asyncio
import logging
import os
import secrets

from fastapi import FastAPI, Header, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent import run_agent, get_agent, get_mcp_tools
from voice import transcribe_webm_bytes, transcribe_webm_async
from circuit_breaker import whisper_circuit_breaker, TranscriptionVerdict
from observability import RequestTrace, configure_langsmith, configure_sentry
from streaming import stream_agent_sse

log = logging.getLogger(__name__)

# PTB Application global (solo en modo webhook)
_ptb_app = None


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_sentry()
    configure_langsmith()
    get_agent()
    log.info("[SERVER] FrigoVoice AI v3.1 listo — Agente SQL Tool Calling activo.")
    asyncio.create_task(_init_mcp_background())

    # ── Modo webhook: inicializar PTB y registrar webhook en Telegram ──────
    webhook_url = os.getenv("WEBHOOK_URL", "").rstrip("/")
    if webhook_url:
        await _start_webhook_mode(webhook_url)

    yield

    # ── Cleanup: eliminar webhook y apagar PTB si estaba activo ───────────
    if _ptb_app is not None:
        await _stop_webhook_mode()

    log.info("[SERVER] FrigoVoice AI apagandose...")


async def _init_mcp_background():
    """Intenta inicializar MCP sin bloquear el arranque del servidor."""
    try:
        tools = await get_mcp_tools()
        log.info("[SERVER] MCP activo con %d herramientas: %s", len(tools), [t.name for t in tools])
    except Exception as e:
        log.warning("[SERVER] MCP no disponible, usando SQL directo: %s", e)


async def _start_webhook_mode(webhook_url: str) -> None:
    """Inicializa PTB Application y registra el webhook en la API de Telegram."""
    global _ptb_app
    from telegram_bot import build_application

    webhook_secret = os.getenv("WEBHOOK_SECRET", secrets.token_hex(32))
    os.environ.setdefault("WEBHOOK_SECRET", webhook_secret)

    _ptb_app = build_application()
    await _ptb_app.initialize()
    await _ptb_app.start()

    full_webhook = f"{webhook_url}/webhook/telegram"
    await _ptb_app.bot.set_webhook(
        url=full_webhook,
        secret_token=webhook_secret,
        allowed_updates=["message", "edited_message", "callback_query"],
        drop_pending_updates=True,
    )
    log.info("[SERVER] Webhook registrado en Telegram: %s", full_webhook)


async def _stop_webhook_mode() -> None:
    """Elimina el webhook y apaga PTB limpiamente."""
    global _ptb_app
    if _ptb_app is None:
        return
    try:
        await _ptb_app.bot.delete_webhook()
        await _ptb_app.stop()
        await _ptb_app.shutdown()
        log.info("[SERVER] Webhook eliminado y PTB apagado.")
    except Exception as exc:
        log.warning("[SERVER] Error al apagar PTB: %s", exc)
    finally:
        _ptb_app = None


app = FastAPI(
    title="FrigoVoice AI",
    description="API de trazabilidad con voz para Frigolab San Mateo — Tool Calling sobre SQL Server.",
    version="3.0.0",
    lifespan=lifespan,
)

# CORS — origenes conocidos del frontend:
#   - Desarrollo local (Vite / CRA)
#   - Red de planta (192.168.x.x) y VPN Tailscale (100.x.x.x) en cualquier puerto
#   - Dominios de frigolab
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_origin_regex=(
        r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|"
        r"100\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$"
        r"|^https://.*\.frigolab\.(dev|com\.ec)$"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Modelos Pydantic
# ---------------------------------------------------------------------------

class AgentRequest(BaseModel):
    message: str
    conversation_history: list[dict] | None = None
    session_id: str | None = None   # id de sesión por usuario (memoria multi-usuario)
    user_name: str | None = None    # nombre del operario que consulta


class AgentResponse(BaseModel):
    message: str
    response: str
    tools_used: list[str]
    tool_results: list[str]
    active_agent: str | None = None  # sub-agente que respondió (modo multi-agente)


class AgentVoiceResponse(BaseModel):
    transcription: str
    response: str
    tools_used: list[str]
    tool_results: list[str]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    mode = "webhook" if _ptb_app is not None else "polling_or_standalone"
    return {"status": "ok", "version": "3.1.0", "bot_mode": mode}


# ---------------------------------------------------------------------------
# Webhook de Telegram (solo activo si WEBHOOK_URL esta definido)
# ---------------------------------------------------------------------------

@app.post("/webhook/telegram", status_code=200)
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str = Header(default=""),
) -> dict:
    """Recibe updates de Telegram y los despacha a la PTB Application.

    Telegram incluye el header X-Telegram-Bot-Api-Secret-Token en cada POST.
    Si no coincide con WEBHOOK_SECRET, rechazamos con 403 para evitar spam.
    """
    if _ptb_app is None:
        raise HTTPException(status_code=503, detail="Bot no inicializado en modo webhook.")

    expected_secret = os.getenv("WEBHOOK_SECRET", "")
    if expected_secret and not secrets.compare_digest(
        x_telegram_bot_api_secret_token, expected_secret
    ):
        raise HTTPException(status_code=403, detail="Token secreto invalido.")

    from telegram import Update
    data = await request.json()
    update = Update.de_json(data, _ptb_app.bot)
    await _ptb_app.process_update(update)
    return {"ok": True}


@app.post("/api/ai/agent/query", response_model=AgentResponse)
async def agent_query(req: AgentRequest):
    """
    Consulta al agente por texto.

    Con MULTI_AGENT=true y session_id: usa el grafo multi-agente LangGraph
    (supervisor → trazabilidad | formularios | analisis | directo) con memoria
    de conversación POR USUARIO (cada session_id mantiene su propio hilo).
    Sin session_id: agente único estateless (compatibilidad).
    """
    from multi_agent import is_multi_agent_enabled, run_multi_agent

    if is_multi_agent_enabled() and req.session_id:
        result = await run_multi_agent(
            chat_id=req.session_id,
            user_message=req.message,
            operator_name=req.user_name or "Operador Web",
        )
        respuesta = result["response"]
        # El grafo web no tiene human-in-the-loop: si un sub-agente pide un dato,
        # la pregunta se devuelve como respuesta normal para que el usuario conteste.
        if result.get("interrupted") and result.get("question"):
            respuesta = result["question"]
        return AgentResponse(
            message=req.message,
            response=respuesta,
            tools_used=[],
            tool_results=[],
            active_agent=result.get("active_agent"),
        )

    result = await run_agent(
        user_message=req.message,
        conversation_history=req.conversation_history,
    )
    return AgentResponse(
        message=req.message,
        response=result["response"],
        tools_used=result["tools_used"],
        tool_results=result["tool_results"],
    )


@app.get("/api/ai/templates/fields")
async def templates_fields():
    """Catálogo de formularios con sus campos/columnas (marca los numéricos).

    Alimenta el selector de "consulta guiada" del frontend: el usuario elige
    formulario + columna + operación y el agente ejecuta el cálculo.
    """
    from sql_tools import listar_campos_templates
    try:
        return {"templates": await listar_campos_templates()}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"No pude leer los templates: {exc}")


@app.post("/api/ai/agent/voice", response_model=AgentVoiceResponse)
async def agent_voice(audio: UploadFile = File(...)):
    """
    Consulta al agente por voz.

    Flujo: Audio WebM → Whisper STT → Agente (3 Tools SQL) → Respuesta
    El frontend se encarga del TTS (Text-to-Speech).
    """
    if not audio.content_type or "audio" not in audio.content_type:
        raise HTTPException(status_code=400, detail="Se esperaba un archivo de audio")

    audio_bytes = await audio.read()
    if len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail="Audio demasiado corto")

    trace = RequestTrace(user_id="api_voice")

    with trace.span("whisper_stt", audio_size=len(audio_bytes)):
        transcription = await transcribe_webm_async(audio_bytes)

    if not transcription:
        return AgentVoiceResponse(
            transcription="",
            response="No pude entender el audio. Intenta de nuevo.",
            tools_used=[],
            tool_results=[],
        )

    # Circuit breaker: filtrar ruido antes de gastar tokens
    with trace.span("circuit_breaker"):
        verdict, cached_response = whisper_circuit_breaker.evaluate(transcription)

    if verdict != TranscriptionVerdict.PASS:
        trace.log_summary()
        return AgentVoiceResponse(
            transcription=transcription,
            response=cached_response,
            tools_used=[],
            tool_results=[],
        )

    with trace.span("llm_agent"):
        result = await run_agent(user_message=transcription)

    trace.log_summary()
    return AgentVoiceResponse(
        transcription=transcription,
        response=result["response"],
        tools_used=result["tools_used"],
        tool_results=result["tool_results"],
    )


@app.post("/api/ai/agent/stream")
async def agent_stream(req: AgentRequest):
    """
    Streaming de la respuesta del agente via Server-Sent Events.

    El frontend recibe frases limpias (sin XML interno) conforme se generan,
    permitiendo enviar cada frase al TTS sin esperar la respuesta completa.

    Eventos SSE:
      data: {"phrase": "El lote 260302 fue recibido el 3 de marzo."}
      data: [DONE]
    """
    return StreamingResponse(
        stream_agent_sse(get_agent(), req.message, {}),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8100, reload=False)
