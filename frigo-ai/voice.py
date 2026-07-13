"""
voice.py - Speech-to-Text via Azure OpenAI Whisper con fallback local

v6.0 — Resilencia:
  - Intenta Azure Whisper primero (baja latencia si está disponible).
  - Si Azure falla (401/404/timeout), usa openai-whisper local automáticamente.
  - Modelo local cargado como singleton (no se recarga en cada llamada).
  - Versión async para no bloquear el event loop.

Requiere en .env:
  AZURE_STT_KEY        — Clave del recurso Azure OpenAI para Whisper.
  AZURE_STT_ENDPOINT   — Endpoint del recurso Azure OpenAI.
  AZURE_STT_DEPLOYMENT — Nombre del deployment de Whisper en Azure (default: whisper).
  WHISPER_LOCAL_MODEL  — Modelo local a usar si Azure falla (default: base).
"""
import asyncio
import io
import logging
import os
import tempfile

from openai import AzureOpenAI

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Singleton del cliente Azure OpenAI — reutiliza pool HTTP entre llamadas
# ---------------------------------------------------------------------------

_client: AzureOpenAI | None = None
_STT_TIMEOUT = float(os.getenv("WHISPER_TIMEOUT", "30"))
# Flag para no reintentar Azure si ya sabemos que falla (401/404)
_azure_disabled = False


def _get_client() -> AzureOpenAI:
    """Retorna el cliente singleton de Azure OpenAI para Whisper."""
    global _client
    if _client is None:
        api_key = os.getenv("AZURE_STT_KEY") or os.getenv("AZURE_OPENAI_KEY")
        endpoint = os.getenv("AZURE_STT_ENDPOINT") or os.getenv("AZURE_OPENAI_ENDPOINT")
        if not api_key or not endpoint:
            raise EnvironmentError(
                "Faltan AZURE_STT_KEY y AZURE_STT_ENDPOINT en .env para Whisper STT."
            )
        _client = AzureOpenAI(
            api_key=api_key,
            azure_endpoint=endpoint,
            api_version="2024-06-01",
            timeout=_STT_TIMEOUT,
            max_retries=0,
        )
        log.info("Whisper client inicializado: %s", endpoint)
    return _client


def _get_deployment() -> str:
    return os.getenv("AZURE_STT_DEPLOYMENT", "whisper")


# ---------------------------------------------------------------------------
# Fallback: whisper local (openai-whisper)
# ---------------------------------------------------------------------------

_local_model = None


def _get_local_model():
    """Carga el modelo openai-whisper local como singleton."""
    global _local_model
    if _local_model is None:
        import whisper  # openai-whisper package
        model_name = os.getenv("WHISPER_LOCAL_MODEL", "base")
        log.info("Cargando modelo whisper local '%s'...", model_name)
        _local_model = whisper.load_model(model_name)
        log.info("Modelo whisper local '%s' cargado.", model_name)
    return _local_model


def _transcribe_local(audio_bytes: bytes, suffix: str) -> str:
    """Transcribe usando openai-whisper local. Escribe archivo temporal mínimo."""
    import whisper as _whisper
    model = _get_local_model()
    suffix_clean = suffix.lstrip(".")
    with tempfile.NamedTemporaryFile(suffix=f".{suffix_clean}", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        result = model.transcribe(tmp_path, language="es", fp16=False)
        return result["text"].strip()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# Transcripción con bytes en memoria (sin archivo temporal)
# ---------------------------------------------------------------------------

def _transcribe_bytes(audio_bytes: bytes, suffix: str) -> str:
    """Transcribe audio: intenta Azure primero, cae a local si falla."""
    global _azure_disabled

    if not _azure_disabled:
        try:
            client = _get_client()
            file_tuple = (
                f"audio{suffix}",
                io.BytesIO(audio_bytes),
                f"audio/{suffix.lstrip('.')}",
            )
            result = client.audio.transcriptions.create(
                model=_get_deployment(),
                file=file_tuple,
                language="es",
            )
            return result.text.strip()
        except EnvironmentError:
            # No hay credenciales configuradas, usar local directamente
            _azure_disabled = True
            log.warning("Azure STT no configurado, usando whisper local.")
        except Exception as exc:
            _azure_disabled = True
            log.warning(
                "Azure Whisper falló (%s). Usando whisper local como fallback.", exc
            )

    return _transcribe_local(audio_bytes, suffix)


# ---------------------------------------------------------------------------
# API pública síncrona (backward compatible)
# ---------------------------------------------------------------------------

def transcribe_webm_bytes(webm_bytes: bytes, _language: str = "es") -> str:
    """Transcribe audio WebM/Opus del navegador."""
    return _transcribe_bytes(webm_bytes, ".webm")


def transcribe_ogg_bytes(ogg_bytes: bytes, _language: str = "es") -> str:
    """Transcribe audio OGG/Opus de Telegram."""
    return _transcribe_bytes(ogg_bytes, ".ogg")


# ---------------------------------------------------------------------------
# API pública async (para telegram_bot.py y server.py)
# ---------------------------------------------------------------------------

async def transcribe_webm_async(webm_bytes: bytes) -> str:
    """Versión async de transcribe_webm_bytes (no bloquea event loop)."""
    return await asyncio.to_thread(_transcribe_bytes, webm_bytes, ".webm")


async def transcribe_ogg_async(ogg_bytes: bytes) -> str:
    """Versión async de transcribe_ogg_bytes (no bloquea event loop)."""
    return await asyncio.to_thread(_transcribe_bytes, ogg_bytes, ".ogg")
