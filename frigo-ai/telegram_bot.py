"""
telegram_bot.py - FrigoVoice Telegram Bot

Maneja:
  - /start, /help, /cancelar    → comandos de control
  - Mensaje de texto             → agente directamente
  - Nota de voz (OGG/Opus)       → Whisper → agente
  - Interrupciones del agente    → pausa, pregunta al operario, reanuda

Cada chat de Telegram es un thread independiente en el grafo LangGraph
(thread_id = str(chat_id)), por lo que las sesiones son completamente aisladas.

Modos de ejecucion:
  - Polling  (desarrollo / VM):   python telegram_bot.py
  - Webhook  (Container Apps):    uvicorn server:app  (server.py importa build_application)

Requiere en .env:
    TELEGRAM_BOT_TOKEN   — Token del bot (obtenido con @BotFather)
    GITHUB_TOKEN         — GitHub Models API key
    AZURE_STT_KEY        — Azure OpenAI (Whisper STT)
    AZURE_STT_ENDPOINT
    AZURE_STT_DEPLOYMENT — Nombre del deployment Whisper en Azure AI Foundry

  Solo en modo webhook (Container Apps):
    WEBHOOK_URL          — URL publica del Container App (sin barra final)
                           Ej: https://frigo-ai.azurecontainerapps.io
    WEBHOOK_SECRET       — Token secreto para verificar que el POST viene de Telegram
"""

import asyncio
import logging
import os
import time

from dotenv import load_dotenv
from telegram import Update
from telegram.constants import ChatAction, ParseMode
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from agent import run_agent_for_telegram, initialize_mcp_tools, shutdown_agent, mcp_status
from voice import transcribe_ogg_async
from circuit_breaker import whisper_circuit_breaker, TranscriptionVerdict
from observability import (
    METRIC_ERROR_INTERRUPT,
    METRIC_ERROR_LLM,
    METRIC_ERROR_TELEGRAM,
    METRIC_REQUEST,
    RequestTrace,
    configure_langsmith,
    configure_sentry,
    incr,
    log_error,
    sentry_add_breadcrumb,
    sentry_set_user,
)

load_dotenv()
logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
log = logging.getLogger(__name__)

configure_langsmith()
configure_sentry()

# ---------------------------------------------------------------------------
# Rate limiting por usuario — previene spam y abuso del la cuota del LLM
# Máximo _RL_MAX mensajes en una ventana deslizante de _RL_WINDOW segundos.
# Para escala mayor usar Redis con INCR + EXPIRE.
# ---------------------------------------------------------------------------
_RL_MAX: int = int(os.getenv("RATE_LIMIT_MAX", "20"))
_RL_WINDOW: int = int(os.getenv("RATE_LIMIT_WINDOW", "60"))  # segundos
_rate_buckets: dict[int, list[float]] = {}  # chat_id → timestamps


def _check_rate_limit(chat_id: int) -> bool:
    """True si el usuario está dentro del límite. False si excedió."""
    now = time.monotonic()
    bucket = _rate_buckets.setdefault(chat_id, [])
    # Eliminar entradas fuera de la ventana
    _rate_buckets[chat_id] = [t for t in bucket if now - t < _RL_WINDOW]
    if len(_rate_buckets[chat_id]) >= _RL_MAX:
        return False
    _rate_buckets[chat_id].append(now)
    return True

# ---------------------------------------------------------------------------
# Estado en memoria de chats esperando una respuesta del operario
# Clave: chat_id (int) → True/False
# Para produccion a gran escala reemplazar con Redis.
# ---------------------------------------------------------------------------
_pending_resume: dict[int, bool] = {}

# Locks por chat_id — evita que dos mensajes del mismo operario se procesen
# en paralelo y corrompan el estado del grafo LangGraph.
_chat_locks: dict[int, asyncio.Lock] = {}
_MAX_CHAT_LOCKS = 500


def _get_chat_lock(chat_id: int) -> asyncio.Lock:
    """Obtiene o crea un lock exclusivo por chat_id. Limpia locks antiguos si hay demasiados."""
    if len(_chat_locks) > _MAX_CHAT_LOCKS:
        # Limpiar locks que no estan siendo usados
        to_remove = [cid for cid, lock in _chat_locks.items() if not lock.locked()]
        for cid in to_remove[:len(to_remove) // 2]:  # Eliminar la mitad de los inactivos
            del _chat_locks[cid]
    if chat_id not in _chat_locks:
        _chat_locks[chat_id] = asyncio.Lock()
    return _chat_locks[chat_id]

# Grupos o usuarios autorizados (opcional — deja vacio para no restringir)
ALLOWED_CHAT_IDS: set[int] = set()


# ---------------------------------------------------------------------------
# Authorization guard
# ---------------------------------------------------------------------------
def _is_authorized(chat_id: int) -> bool:
    if not ALLOWED_CHAT_IDS:
        return True
    return chat_id in ALLOWED_CHAT_IDS


# ---------------------------------------------------------------------------
# Helpers de envio
# ---------------------------------------------------------------------------

async def _send_typing(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await context.bot.send_chat_action(
        chat_id=update.effective_chat.id,
        action=ChatAction.TYPING,
    )


_MAX_TG = 4096


def _split(text: str, limit: int = _MAX_TG) -> list[str]:
    """Divide texto en trozos de hasta `limit` caracteres, respetando líneas.
    Si una línea individual supera `limit`, la parte por caracteres para no perder contenido.
    """
    chunks, current = [], []
    length = 0
    for line in text.splitlines(keepends=True):
        # Si la línea en sí es más larga que el límite, partirla en fragmentos
        while len(line) > limit:
            fragment = line[:limit]
            if current:
                chunks.append("".join(current))
                current, length = [], 0
            chunks.append(fragment)
            line = line[limit:]
        if length + len(line) > limit:
            if current:
                chunks.append("".join(current))
            current, length = [], 0
        current.append(line)
        length += len(line)
    if current:
        chunks.append("".join(current))
    return chunks or [""]


# Caracteres especiales de Markdown legacy de Telegram que rompen el parse.
# Si la respuesta del LLM contiene cualquiera de estos sin escapar, Telegram
# responde 400 Bad Request y el mensaje no llega al operario.
# Nota: MarkdownV2 seria mas seguro pero mas invasivo; nos quedamos con
# Markdown legacy y fallback a texto plano.
_MD_SUSPECT = ("_", "*", "`", "[", "]")


def _looks_like_unsafe_markdown(text: str) -> bool:
    """Heuristica conservadora: si hay un numero IMPAR de caracteres especiales
    sueltos, es probable que Telegram rechace el mensaje. Evitamos intentar
    parsearlo como Markdown en ese caso.
    """
    return any(text.count(ch) % 2 == 1 for ch in _MD_SUSPECT)


async def _reply(update: Update, text: str) -> None:
    """Envia respuesta con Markdown. Divide en trozos si supera 4096 chars.

    * Si detectamos markdown potencialmente malformado, enviamos en texto plano
      de entrada (evitamos el round trip rechazado + reintento).
    * Si el envio con Markdown falla igual (p. ej. por algun simbolo raro
      que no detectamos), reintentamos sin parse_mode.
    """
    for chunk in _split(text):
        use_md = not _looks_like_unsafe_markdown(chunk)
        try:
            if use_md:
                await update.message.reply_text(chunk, parse_mode=ParseMode.MARKDOWN)
            else:
                await update.message.reply_text(chunk)
        except Exception as exc:
            log.warning("reply fallback plain-text (motivo=%s)", exc)
            try:
                await update.message.reply_text(chunk)
            except Exception:
                log_error(METRIC_ERROR_INTERRUPT, exc, hint="reply_failed")


# ---------------------------------------------------------------------------
# Logica central: llama al agente y maneja interrupts
# ---------------------------------------------------------------------------

async def _process_message(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    user_text: str,
    trace: RequestTrace | None = None,
) -> None:
    """
    Punto central de procesamiento. Se llama tanto para texto como para voz.
    Gestiona el ciclo de vida del interrupt de LangGraph.

    Instrumentacion:
      * Sentry user scope y breadcrumbs por cada hito del mensaje.
      * Contador frigo.request por cada mensaje procesado.
      * Span `llm_agent` dentro de `trace` (si se proporciona) para medir el
        tiempo real del grafo LangGraph + tools + LLM.
    """
    chat_id = update.effective_chat.id
    user = update.effective_user
    operator_name = f"{user.first_name} {user.last_name or ''}".strip() if user else "Operador"

    sentry_set_user(chat_id)
    sentry_add_breadcrumb(
        "telegram", "message_received",
        chat_id=chat_id, length=len(user_text), preview=user_text[:80],
    )
    incr(METRIC_REQUEST, source="telegram")

    if not _is_authorized(chat_id):
        await _reply(update, "No tienes permiso para usar este bot.")
        return

    # Rate limiting: protege la cuota de GitHub Models
    if not _check_rate_limit(chat_id):
        await _reply(
            update,
            f"Demasiados mensajes seguidos. Espera un momento antes de enviar otro mensaje."
        )
        return

    # Lock por chat_id: serializa mensajes del mismo operario para
    # evitar race conditions en el grafo LangGraph (MemorySaver).
    lock = _get_chat_lock(chat_id)
    async with lock:
        await _send_typing(update, context)
        waiting = _pending_resume.get(chat_id, False)

        async def _run_agent():
            if waiting:
                log.info("chat_id=%s resuming interrupt with: %s", chat_id, user_text[:60])
                _pending_resume[chat_id] = False
                return await run_agent_for_telegram(
                    chat_id=chat_id,
                    user_message="",
                    operator_name=operator_name,
                    is_resume=True,
                    resume_value=user_text,
                )
            log.info("chat_id=%s new message: %s", chat_id, user_text[:60])
            return await run_agent_for_telegram(
                chat_id=chat_id,
                user_message=user_text,
                operator_name=operator_name,
            )

        try:
            if trace is not None:
                with trace.span("llm_agent", chat_id=chat_id, is_resume=waiting):
                    result = await _run_agent()
            else:
                result = await _run_agent()
        except Exception as exc:
            log_error(METRIC_ERROR_LLM, exc, chat_id=chat_id, is_resume=waiting)
            await _reply(
                update,
                "Tuve un problema procesando tu mensaje. Intenta de nuevo en unos segundos.",
            )
            return

        if result["interrupted"]:
            _pending_resume[chat_id] = True
            sentry_add_breadcrumb(
                "agent", "interrupt_raised", chat_id=chat_id, question=result["question"][:200],
            )
            await _reply(update, f"FrigoVoice necesita un dato:\n\n{result['question']}")
        else:
            response = result["response"] or "No obtuve respuesta del agente. Intenta de nuevo."
            await _reply(update, response)


# ---------------------------------------------------------------------------
# Handlers de Telegram
# ---------------------------------------------------------------------------

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    name = update.effective_user.first_name if update.effective_user else "operario"
    await _reply(
        update,
        f"Hola *{name}*, soy *FrigoIA*, el asistente de Frigolab.\n\n"
        "Puedes preguntarme cosas como:\n"
        "• _Como vamos esta semana_ — dashboard con KPIs\n"
        "• _Cuantos lotes completos hay_ — trazabilidad\n"
        "• _Que lotes tienen brechas de QC_ — lotes incompletos\n"
        "• _Hay alertas de temperatura_ — fuera de rango\n"
        "• _Dame el estado del lote 260402_ — historia de un lote\n"
        "• _Estadisticas del mes_ — porcentajes y ranking\n"
        "• _Que productos se registraron hoy_ — datos del dia\n"
        "• Envia una foto de etiqueta para extraer lote y producto\n"
        "• O envia una nota de voz para registrar un formulario\n\n"
        "Escribe /ayuda para ver mas opciones.",
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _reply(
        update,
        "*Comandos:*\n"
        "/start   — Bienvenida\n"
        "/ayuda   — Esta ayuda\n"
        "/cancelar — Cancela la operacion en curso\n\n"
        "*Dashboard y KPIs:*\n"
        "`Como vamos esta semana`\n"
        "`Dame el resumen de hoy`\n"
        "`Hay alertas de temperatura`\n"
        "`Cuantos lotes están completos`\n\n"
        "*Trazabilidad de lotes:*\n"
        "`Que lotes hay esta semana`\n"
        "`Estado del lote 260402`\n"
        "`Que le falta al lote 260318`\n\n"
        "*Formularios y estadisticas:*\n"
        "`Estadisticas del mes`\n"
        "`Que registró FOR-CC-10 esta semana`\n"
        "`Quién llenó mas formularios`\n\n"
        "*Registro por voz o foto:*\n"
        "Envía una nota de voz o foto de etiqueta.",
    )


async def cmd_ayuda(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Alias de /help en español."""
    await cmd_help(update, context)


async def cmd_cancelar(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    was_waiting = _pending_resume.pop(chat_id, False)
    if was_waiting:
        await _reply(update, "✅ Operacion cancelada. Puedes iniciar una nueva consulta.")
    else:
        await _reply(update, "No hay ninguna operacion en curso.")


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Muestra el estado del sistema: MCP, LLM, cache, limite de tasa."""
    status = mcp_status()
    import platform
    mcp_icon = "✅" if status["mcp_active"] else "❌"
    transport_txt = status["transport"] if status["mcp_active"] else "sql_tools directo"
    tools_txt = ", ".join(status["tool_names"][:5])
    if len(status["tool_names"]) > 5:
        tools_txt += f" (+{len(status['tool_names']) - 5} mas)"

    chat_id = update.effective_chat.id
    bucket_size = len(_rate_buckets.get(chat_id, []))

    await _reply(
        update,
        f"*Estado del sistema FrigoIA*\n\n"
        f"{mcp_icon} MCP: {'activo' if status['mcp_active'] else 'inactivo (fallback SQL)'}\n"
        f"  Transporte: `{transport_txt}`\n"
        f"  Herramientas: {status['tools_count']} — {tools_txt}\n\n"
        f"⏱ Rate limit: {bucket_size}/{_RL_MAX} mensajes en los ultimos {_RL_WINDOW}s\n"
        f"🧠 Modelo: {os.getenv('GITHUB_MODEL', 'gpt-4o-mini')} (GitHub Models)",
    )


async def cmd_debug_sentry(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Comando oculto para verificar Sentry end-to-end.

    Lanza una excepcion dentro de un handler real de PTB. Si `telegram_error_handler`
    esta bien conectado y `configure_sentry()` inicializado, aparecera como un
    Issue nuevo en el proyecto de Sentry.

    Uso desde Telegram:
        /debug_sentry
    """
    await _reply(update, "Provocando error de prueba para Sentry...")
    raise RuntimeError("frigo-ai: prueba Sentry desde /debug_sentry")


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.text:
        return
    chat_id = update.effective_chat.id
    trace = RequestTrace(user_id=str(chat_id))
    await _process_message(update, context, update.message.text.strip(), trace=trace)
    trace.log_summary()


async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Descarga la nota de voz (OGG/Opus), la transcribe con Whisper y la procesa.
    Telegram envia notas de voz en formato OGG con codec Opus.
    Azure OpenAI Whisper acepta OGG nativamente (no requiere conversion).
    """
    if not update.message or not update.message.voice:
        return

    chat_id = update.effective_chat.id
    trace = RequestTrace(user_id=str(chat_id))

    await _send_typing(update, context)

    voice = update.message.voice
    try:
        voice_file = await context.bot.get_file(voice.file_id)
        ogg_bytearray = await voice_file.download_as_bytearray()
        ogg_bytes = bytes(ogg_bytearray)
    except Exception as exc:
        log.error("Error descargando nota de voz: %s", exc)
        await _reply(update, "❌ No pude descargar el audio. Intenta enviar un mensaje de texto.")
        return

    try:
        with trace.span("whisper_stt", audio_size=len(ogg_bytes)):
            transcription = await transcribe_ogg_async(ogg_bytes)
    except Exception as exc:
        log.error("Error transcribiendo audio: %s", exc)
        await _reply(update, "❌ No pude transcribir el audio. Habla claramente y vuelve a intentarlo.")
        return

    if not transcription:
        await _reply(update, "⚠️ No detecte habla en el audio. Por favor repite el mensaje.")
        return

    # Circuit breaker: filtrar ruido industrial antes de enviar al LLM
    with trace.span("circuit_breaker"):
        verdict, cached_response = whisper_circuit_breaker.evaluate(transcription)

    if verdict != TranscriptionVerdict.PASS:
        await _reply(update, cached_response)
        trace.log_summary()
        return

    # Confirmar transcripcion al operario antes de procesar
    await _reply(update, f"Transcripcion: _{transcription}_")

    await _process_message(update, context, transcription, trace=trace)
    trace.log_summary()


async def handle_unsupported(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _reply(update, "Solo proceso mensajes de texto, notas de voz y fotos. 🎤📸")


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Procesa fotos enviadas al bot.

    Descarga la imagen en maxima resolucion, la envia a llama3.2-vision en
    la A100 de CEDIA para extraer datos de etiqueta (lote, producto,
    temperatura) y luego pasa el resultado al agente para recomendar o crear
    el borrador del formulario correspondiente.
    """
    if not update.message or not update.message.photo:
        return

    chat_id = update.effective_chat.id
    await _send_typing(update, context)

    # Descargar en maxima resolucion (ultimo elemento = mas grande)
    photo = update.message.photo[-1]
    try:
        photo_file = await context.bot.get_file(photo.file_id)
        photo_bytes = bytes(await photo_file.download_as_bytearray())
    except Exception as exc:
        log.error("Error descargando foto chat_id=%s: %s", chat_id, exc)
        await _reply(update, "No pude descargar la imagen. Intenta de nuevo o escribe los datos.")
        return

    import base64
    from sql_tools import analizar_foto_etiqueta_tool

    imagen_b64 = base64.b64encode(photo_bytes).decode("utf-8")
    await _reply(update, "Analizando la imagen con IA... un momento. 🔍")

    try:
        resultado_vision = await analizar_foto_etiqueta_tool.ainvoke(
            {"imagen_base64": imagen_b64}
        )
    except Exception as exc:
        log.error("Error en vision tool chat_id=%s: %s", chat_id, exc)
        await _reply(update, "Error al analizar la imagen. Describe los datos por texto.")
        return

    # Mostrar al operario lo que extrajo la vision
    await _reply(update, resultado_vision)

    # Pasar al agente con el contexto de la imagen para recomendar/crear borrador
    caption = (update.message.caption or "").strip()
    msg_para_agente = (
        "El operario envio una foto de etiqueta o producto. "
        f"El analisis de vision extrajo:\n\n{resultado_vision}\n\n"
        + (f"El operario agrego este texto: {caption}\n\n" if caption else "")
        + "Con base en estos datos: recomienda el formulario mas apropiado "
        "y pregunta si desea crear el borrador con los datos extraidos."
    )
    await _process_message(update, context, msg_para_agente)


async def telegram_error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Errores no capturados en handlers de python-telegram-bot -> Sentry.

    PTB atrapa muchas excepciones internamente; las que llegan aqui suelen ser
    bugs reales o fallos de red de Telegram. Sin este hook, solo verias el
    traceback en consola.
    """
    err = getattr(context, "error", None)
    if err is None:
        return
    chat_id = getattr(getattr(update, "effective_chat", None), "id", None)
    log_error(METRIC_ERROR_TELEGRAM, err, chat_id=chat_id, update_type=type(update).__name__)


# ---------------------------------------------------------------------------
# Factory: construye la Application con todos los handlers.
# Usada por main() (polling) y por server.py (webhook).
# ---------------------------------------------------------------------------

def build_application() -> Application:
    """Construye y retorna la PTB Application con todos los handlers registrados.

    No arranca ningun servidor ni loop de eventos; solo ensambla la aplicacion.
    Llamada tanto desde:
      - main()      → modo polling (VM / desarrollo local)
      - server.py   → modo webhook (Azure Container Apps / produccion serverless)
    """
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        log.critical("TELEGRAM_BOT_TOKEN no definido en .env.")
        raise EnvironmentError("Falta TELEGRAM_BOT_TOKEN en el archivo .env")

    ptb_app = Application.builder().token(token).build()

    ptb_app.add_handler(CommandHandler("start", cmd_start))
    ptb_app.add_handler(CommandHandler("help", cmd_help))
    ptb_app.add_handler(CommandHandler("ayuda", cmd_ayuda))
    ptb_app.add_handler(CommandHandler("cancelar", cmd_cancelar))
    ptb_app.add_handler(CommandHandler("status", cmd_status))
    # Comando oculto para verificar Sentry. Quitar en produccion si no se necesita.
    ptb_app.add_handler(CommandHandler("debug_sentry", cmd_debug_sentry))

    ptb_app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    ptb_app.add_handler(MessageHandler(filters.VOICE, handle_voice))
    ptb_app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    ptb_app.add_handler(
        MessageHandler(~filters.TEXT & ~filters.VOICE & ~filters.PHOTO & ~filters.COMMAND, handle_unsupported)
    )

    ptb_app.add_error_handler(telegram_error_handler)
    return ptb_app


async def _on_startup(app: Application) -> None:
    """Hook de inicio: inicializa MCP antes de aceptar mensajes."""
    log.info("bot startup: inicializando MCP...")
    ok = await initialize_mcp_tools()
    status = mcp_status()
    if ok:
        log.info(
            "bot startup: MCP activo (%s) con %d herramientas: %s",
            status["transport"],
            status["tools_count"],
            status["tool_names"],
        )
    else:
        log.warning(
            "bot startup: MCP no disponible — usando %d herramientas SQL directas.",
            status["tools_count"],
        )


async def _on_shutdown(app: Application) -> None:
    """Hook de cierre: libera la sesión MCP y otros recursos."""
    log.info("bot shutdown: cerrando recursos...")
    await shutdown_agent()


# ---------------------------------------------------------------------------
# Punto de entrada — modo polling (VM / desarrollo local)
# ---------------------------------------------------------------------------

def main() -> None:
    """Arranca el bot en modo long-polling.

    Usar en:
      - Desarrollo local          python telegram_bot.py
      - VM Azure B1s              start.ps1 -Mode bot

    Para produccion serverless usar modo webhook via server.py + uvicorn.
    """
    ptb_app = build_application()
    ptb_app.post_init = _on_startup
    ptb_app.post_shutdown = _on_shutdown
    log.info("FrigoVoice Telegram Bot iniciado (polling). Esperando mensajes...")
    ptb_app.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)


if __name__ == "__main__":
    main()
