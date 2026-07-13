"""
main.py - Bot de Telegram FrigoIA (telebot + Azure OpenAI Whisper STT)

Punto de entrada principal para operarios de planta.
- Recibe texto o audio por Telegram.
- Transcribe audio OGG con Azure OpenAI Whisper (red privada Microsoft).
- Envía el texto al agente GPT-4o via procesar_mensaje_con_agente().

Requiere en .env:
  TELEGRAM_TOKEN      — Token del bot de Telegram (BotFather).
  AZURE_STT_KEY       — Clave del recurso Azure OpenAI para Whisper.
  AZURE_STT_ENDPOINT  — Endpoint del recurso Azure OpenAI para Whisper.
  AZURE_STT_DEPLOYMENT — Nombre del deployment de Whisper en Azure.
"""
import logging
import os
import tempfile

import telebot
from dotenv import load_dotenv
from openai import AzureOpenAI

from agent import procesar_mensaje_con_agente
from circuit_breaker import whisper_circuit_breaker, TranscriptionVerdict
from observability import RequestTrace, configure_langsmith, configure_sentry

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("frigoIA.main")

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "")
AZURE_STT_KEY = os.getenv("AZURE_STT_KEY", "")
AZURE_STT_ENDPOINT = os.getenv("AZURE_STT_ENDPOINT", "")
AZURE_STT_DEPLOYMENT = os.getenv("AZURE_STT_DEPLOYMENT", "whisper")

if not TELEGRAM_TOKEN:
    raise RuntimeError("Falta TELEGRAM_TOKEN en las variables de entorno.")

configure_langsmith()
configure_sentry()

bot = telebot.TeleBot(TELEGRAM_TOKEN, parse_mode=None)

# Cliente Azure OpenAI para transcripción de voz (Whisper)
azure_audio_client = None
if AZURE_STT_KEY and AZURE_STT_ENDPOINT:
    azure_audio_client = AzureOpenAI(
        api_key=AZURE_STT_KEY,
        api_version="2024-06-01",
        azure_endpoint=AZURE_STT_ENDPOINT,
    )


# ---------------------------------------------------------------------------
# Transcripción de audio OGG → texto (Whisper API)
# ---------------------------------------------------------------------------

def _transcribir_ogg(ogg_bytes: bytes) -> str:
    """Transcribe audio OGG a texto usando Azure OpenAI Whisper."""
    if azure_audio_client is None:
        return ""

    with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as tmp:
        tmp.write(ogg_bytes)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as audio_file:
            transcript = azure_audio_client.audio.transcriptions.create(
                model=AZURE_STT_DEPLOYMENT,
                file=audio_file,
                language="es",
            )
        return transcript.text.strip()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# Handlers de Telegram
# ---------------------------------------------------------------------------

@bot.message_handler(commands=["start"])
def cmd_start(message: telebot.types.Message):
    """Saludo inicial."""
    nombre = message.from_user.first_name or "Operario"
    bot.reply_to(
        message,
        f"Hola {nombre}, soy FrigoIA, tu asistente de control de calidad.\n\n"
        "Puedes enviarme:\n"
        "- Un mensaje de texto con tu consulta.\n"
        "- Una nota de voz dictando los datos.\n\n"
        "Escribe /ayuda para ver los comandos disponibles.",
    )


@bot.message_handler(commands=["ayuda"])
def cmd_ayuda(message: telebot.types.Message):
    """Lista de comandos."""
    bot.reply_to(
        message,
        "Comandos disponibles:\n"
        "/start  - Iniciar conversación\n"
        "/ayuda  - Ver esta ayuda\n"
        "/cancelar - Reiniciar la sesión\n\n"
        "También puedes enviar texto libre o notas de voz.",
    )


@bot.message_handler(commands=["cancelar"])
def cmd_cancelar(message: telebot.types.Message):
    """Reinicia la sesión del operario."""
    bot.reply_to(message, "Sesión reiniciada. ¿En qué puedo ayudarte?")


@bot.message_handler(content_types=["voice"])
def handle_voice(message: telebot.types.Message):
    """Recibe nota de voz, la transcribe con Whisper y la procesa."""
    chat_id = str(message.chat.id)

    if azure_audio_client is None:
        bot.reply_to(message, "La transcripción de voz no está configurada (faltan AZURE_STT_KEY / AZURE_STT_ENDPOINT).")
        return

    bot.send_chat_action(message.chat.id, "typing")

    trace = RequestTrace(user_id=chat_id)

    try:
        # Descargar el archivo OGG de Telegram
        file_info = bot.get_file(message.voice.file_id)
        ogg_bytes = bot.download_file(file_info.file_path)

        # Transcribir con tracing
        with trace.span("whisper_stt", audio_size=len(ogg_bytes)):
            texto = _transcribir_ogg(ogg_bytes)

        if not texto:
            bot.reply_to(message, "No pude entender el audio. ¿Podrías repetirlo?")
            return

        # Circuit breaker: filtrar ruido industrial
        with trace.span("circuit_breaker"):
            verdict, cached_response = whisper_circuit_breaker.evaluate(texto)

        if verdict != TranscriptionVerdict.PASS:
            bot.reply_to(message, cached_response)
            trace.log_summary()
            return

        log.info("Transcripción (chat %s): %s", chat_id, texto)
        bot.reply_to(message, f"Escuché: {texto}")

        # Procesar con el agente GPT-4o
        bot.send_chat_action(message.chat.id, "typing")
        with trace.span("llm_agent"):
            respuesta = procesar_mensaje_con_agente(texto, chat_id)
        bot.send_message(message.chat.id, respuesta)

    except Exception:
        log.exception("Error procesando nota de voz (chat %s)", chat_id)
        bot.reply_to(message, "Ocurrió un error al procesar tu audio. Intenta de nuevo.")
    finally:
        trace.log_summary()


@bot.message_handler(content_types=["text"])
def handle_text(message: telebot.types.Message):
    """Recibe texto y lo procesa con el agente GPT-4o."""
    chat_id = str(message.chat.id)
    texto = (message.text or "").strip()

    if not texto:
        return

    log.info("Texto recibido (chat %s): %s", chat_id, texto)
    bot.send_chat_action(message.chat.id, "typing")

    try:
        respuesta = procesar_mensaje_con_agente(texto, chat_id)
        bot.send_message(message.chat.id, respuesta)
    except Exception:
        log.exception("Error procesando texto (chat %s)", chat_id)
        bot.reply_to(message, "Ocurrió un error. Por favor intenta de nuevo.")


# ---------------------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    log.info("FrigoIA Bot iniciado. Esperando mensajes...")
    bot.infinity_polling(timeout=60, long_polling_timeout=30)
