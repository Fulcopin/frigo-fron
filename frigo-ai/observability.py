"""
observability.py - Trazabilidad End-to-End con LangSmith + Sentry + métricas.

Problema: Si el bot tarda 8 segundos en responder, necesitas saber EXACTAMENTE
donde se fue el tiempo:
  - Whisper STT: 1.2s
  - Circuit Breaker: 0.0001s
  - MCP Server (PostgreSQL): 0.8s
  - LLM (GPT-4o): 2.1s
  - TTS: 0.5s

Solucion triple:
  1. LangSmith (nativo LangChain/LangGraph) - panel visual de trazas del LLM.
  2. Sentry - errores y excepciones con stack traces + breadcrumbs.
  3. Metricas internas - spans manuales para componentes fuera de LangChain
     (Whisper, TTS, Circuit Breaker) y contadores de errores por categoria.

Configuracion (.env):
  LANGSMITH_API_KEY=ls__xxxx                    # (opcional) traces LangGraph
  LANGSMITH_PROJECT=frigovoice-production
  SENTRY_DSN=https://xxx@sentry.io/yyy          # (opcional) errores
  SENTRY_ENVIRONMENT=production|staging|dev
  SENTRY_TRACES_SAMPLE_RATE=0.1                 # 10% de trazas
  APP_VERSION=1.0.0                             # tag en Sentry

Si una variable falta, el componente correspondiente se desactiva silenciosamente.
Las metricas internas (spans, counters) siempre estan activas.
"""
from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from collections import Counter, defaultdict
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# LangSmith auto-config (solo requiere env vars, sin código extra)
# ---------------------------------------------------------------------------

def configure_langsmith() -> bool:
    """Configura LangSmith si las credenciales están disponibles.

    LangChain/LangGraph instrumentan automáticamente cuando estas
    variables de entorno existen. Esta función solo las valida y activa.

    Returns:
        True si LangSmith está configurado, False si se usarán solo logs.
    """
    api_key = os.getenv("LANGSMITH_API_KEY", "")
    if not api_key:
        log.info(
            "Observability: LangSmith no configurado (falta LANGSMITH_API_KEY). "
            "Usando solo métricas en logs."
        )
        return False

    # LangChain detecta estas variables automáticamente
    os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
    os.environ.setdefault("LANGCHAIN_API_KEY", api_key)
    os.environ.setdefault(
        "LANGCHAIN_PROJECT",
        os.getenv("LANGSMITH_PROJECT", "frigovoice-production"),
    )
    os.environ.setdefault("LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com")

    log.info(
        "Observability: LangSmith activo → proyecto '%s'",
        os.environ["LANGCHAIN_PROJECT"],
    )
    return True


# ---------------------------------------------------------------------------
# Span Tracker — métricas de latencia por componente
# ---------------------------------------------------------------------------

@dataclass
class Span:
    """Un span de ejecución con tiempo de inicio, fin y metadata."""
    name: str
    trace_id: str
    start_ns: int = field(default_factory=time.perf_counter_ns)
    end_ns: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)
    error: str | None = None

    @property
    def duration_ms(self) -> float:
        """Duración en milisegundos."""
        if self.end_ns == 0:
            return 0.0
        return (self.end_ns - self.start_ns) / 1_000_000

    def finish(self, error: str | None = None) -> None:
        """Marca el span como terminado."""
        self.end_ns = time.perf_counter_ns()
        self.error = error

    def to_dict(self) -> dict:
        """Serializa el span para logging/export."""
        return {
            "name": self.name,
            "trace_id": self.trace_id,
            "duration_ms": round(self.duration_ms, 2),
            "error": self.error,
            **self.metadata,
        }


@dataclass
class RequestTrace:
    """Traza completa de una solicitud end-to-end.

    Agrupa todos los spans de un request:
    [whisper_stt, circuit_breaker, mcp_tool, llm_inference, tts]

    Uso:
        trace = RequestTrace(user_id="op_12345")
        with trace.span("whisper_stt"):
            text = transcribe(audio)
        with trace.span("circuit_breaker"):
            verdict = cb.evaluate(text)
        with trace.span("llm_inference", model="gpt-4o"):
            response = agent.invoke(...)
        trace.log_summary()  # → [TRACE abc123] Total: 4230ms | whisper: 1200ms | ...
    """
    user_id: str
    trace_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    spans: list[Span] = field(default_factory=list)
    _start_ns: int = field(default_factory=time.perf_counter_ns, init=False)

    @property
    def total_ms(self) -> float:
        """Tiempo total desde la creación de la traza."""
        return (time.perf_counter_ns() - self._start_ns) / 1_000_000

    @contextmanager
    def span(self, name: str, **metadata: Any):
        """Context manager para medir un componente individual.

        Args:
            name: Nombre del componente (whisper_stt, llm, mcp_tool, tts, etc.)
            **metadata: Datos extra (model, tool_name, etc.)

        Yields:
            El objeto Span (puede agregar metadata dentro del bloque).

        Ejemplo:
            with trace.span("whisper_stt", audio_size=len(bytes)) as s:
                text = transcribe(bytes)
                s.metadata["transcription_length"] = len(text)
        """
        s = Span(name=name, trace_id=self.trace_id, metadata=metadata)
        self.spans.append(s)
        try:
            yield s
        except Exception as exc:
            s.finish(error=str(exc))
            raise
        else:
            s.finish()

    def log_summary(self) -> None:
        """Registra un resumen de la traza en los logs.

        Formato optimizado para grep/búsqueda:
        [TRACE abc123] user=op_12345 | Total: 4230ms | whisper_stt: 1200ms | ...
        """
        parts = [f"[TRACE {self.trace_id}] user={self.user_id}"]
        parts.append(f"Total: {self.total_ms:.0f}ms")

        for s in self.spans:
            status = "OK" if not s.error else f"ERR({s.error[:30]})"
            parts.append(f"{s.name}: {s.duration_ms:.0f}ms [{status}]")

        log.info(" | ".join(parts))

    def to_dict(self) -> dict:
        """Serializa la traza completa para APIs de observabilidad."""
        return {
            "trace_id": self.trace_id,
            "user_id": self.user_id,
            "total_ms": round(self.total_ms, 2),
            "spans": [s.to_dict() for s in self.spans],
        }

    def get_slow_spans(self, threshold_ms: float = 2000.0) -> list[Span]:
        """Identifica componentes lentos para alertas."""
        return [s for s in self.spans if s.duration_ms > threshold_ms]


# ---------------------------------------------------------------------------
# Sentry - error reporting con breadcrumbs y context
#
# Decisiones de diseno:
#   * Sentry es OPCIONAL. Si `SENTRY_DSN` no esta definido, todas las funciones
#     se vuelven no-ops. Permite desarrollo local sin ruido ni costo.
#   * `traces_sample_rate` default=0.1: Sentry Performance no es gratis en alto
#     volumen; 10% es un buen trade-off entre observabilidad y costo.
#   * `send_default_pii`: por defecto False (recomendado en planta / QC).
#     El wizard de Sentry suele poner True; puedes forzarlo con
#     SENTRY_SEND_DEFAULT_PII=true si aceptas enviar mas contexto a Sentry.
#   * Integracion LoggingIntegration: captura logs ERROR+ como eventos.
#     WARNING va como breadcrumb para tener contexto sin crear ruido.
#   * AsyncioIntegration: errores en tareas asyncio (python-telegram-bot v21).
# ---------------------------------------------------------------------------

_sentry_enabled = False


def _env_bool(name: str, default: bool = False) -> bool:
    raw = (os.getenv(name) or "").strip().lower()
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off", ""):
        return default
    log.warning("Observability: %s=%r no es un booleano reconocido; usando default=%s", name, raw, default)
    return default


def configure_sentry() -> bool:
    """Inicializa Sentry si SENTRY_DSN esta definido. Idempotente.

    Returns:
        True si Sentry esta activo, False en caso contrario.
    """
    global _sentry_enabled
    if _sentry_enabled:
        return True

    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        log.info("Observability: Sentry no configurado (falta SENTRY_DSN).")
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.asyncio import AsyncioIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
    except ImportError:
        log.warning(
            "Observability: sentry-sdk no instalado. Agrega `sentry-sdk>=1.40` a requirements.txt "
            "o desactiva SENTRY_DSN."
        )
        return False

    sample_rate = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
    environment = os.getenv("SENTRY_ENVIRONMENT", "production")
    release = os.getenv("APP_VERSION", "1.0.0")
    send_pii = _env_bool("SENTRY_SEND_DEFAULT_PII", default=False)

    # `auto_enabling_integrations=False`: evita que Sentry intente cargar
    # integraciones opcionales (rq, celery, django, etc.) solo por estar los
    # paquetes instalados. En Windows la integracion rq revienta al llamar
    # `multiprocessing.get_context('fork')` (fork no existe en Win).
    # `default_integrations=True`: mantenemos las integraciones base de Sentry
    # (stdlib, excepthook, dedupe, atexit, threading...), que SI queremos.
    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        release=f"frigo-ai@{release}",
        traces_sample_rate=sample_rate,
        send_default_pii=send_pii,
        auto_enabling_integrations=False,
        integrations=[
            LoggingIntegration(level=logging.WARNING, event_level=logging.ERROR),
            AsyncioIntegration(),
        ],
        before_send=_sentry_before_send,
    )

    _sentry_enabled = True
    log.info(
        "Observability: Sentry activo (env=%s, release=%s, traces=%.2f, send_default_pii=%s)",
        environment, release, sample_rate, send_pii,
    )
    return True


def _sentry_before_send(event: dict, hint: dict) -> dict | None:
    """Hook de filtrado para eventos de Sentry.

    Uso principal:
      * Dropear eventos de tipo esperado (ej. CancelledError en shutdown).
      * Limpiar datos sensibles residuales (por si algun log lleva el mensaje
        del operario inadvertidamente).
    """
    # Filtramos CancelledError: son normales en teardown del bot.
    exc_info = hint.get("exc_info")
    if exc_info and exc_info[0].__name__ == "CancelledError":
        return None
    return event


def sentry_capture_exception(exc: BaseException, **extra: Any) -> None:
    """Reporta una excepcion a Sentry con contexto adicional."""
    if not _sentry_enabled:
        return
    try:
        import sentry_sdk
        with sentry_sdk.push_scope() as scope:
            for k, v in extra.items():
                scope.set_extra(k, v)
            sentry_sdk.capture_exception(exc)
    except Exception:  # pragma: no cover
        log.debug("sentry_capture_exception fallo silencioso", exc_info=True)


def sentry_set_user(user_id: str | int, **attrs: Any) -> None:
    """Etiqueta al usuario actual (chat_id Telegram) para facilitar busquedas.

    Solo envia el ID como identificador opaco. NO enviamos el nombre del
    operario porque la planta no ha consentido compartir PII con Sentry.
    """
    if not _sentry_enabled:
        return
    try:
        import sentry_sdk
        sentry_sdk.set_user({"id": str(user_id), **{k: v for k, v in attrs.items() if v is not None}})
    except Exception:  # pragma: no cover
        log.debug("sentry_set_user fallo silencioso", exc_info=True)


def sentry_add_breadcrumb(category: str, message: str, level: str = "info", **data: Any) -> None:
    """Agrega un breadcrumb (pista contextual) al scope actual."""
    if not _sentry_enabled:
        return
    try:
        import sentry_sdk
        sentry_sdk.add_breadcrumb(category=category, message=message, level=level, data=data)
    except Exception:  # pragma: no cover
        pass


# ---------------------------------------------------------------------------
# Metrics - contadores simples en memoria (thread-safe)
#
# Diseno consciente:
#   * NO exportamos a Prometheus todavia. Para eso hay que exponer un endpoint
#     HTTP /metrics que el orquestador scrape, y eso anade superficie de ataque.
#   * El objetivo de esta capa es tener SENALES desde el primer dia: cuantos
#     errores por categoria, cuantas requests por tool, etc. Los valores se
#     loggean cada N requests o a demanda via `dump_metrics()`.
#   * Cuando el proyecto crezca, swappable por prometheus_client sin cambiar
#     la API publica (`incr`, `observe`, etc.).
# ---------------------------------------------------------------------------

_counter_lock = threading.Lock()
_counters: Counter[str] = Counter()
_histograms: dict[str, list[float]] = defaultdict(list)
_HISTOGRAM_MAX = 500  # tope para no crecer sin fin en procesos longevos


def incr(metric: str, value: int = 1, **tags: Any) -> None:
    """Incrementa un contador. tags se concatenan al nombre."""
    key = _metric_key(metric, tags)
    with _counter_lock:
        _counters[key] += value


def observe(metric: str, value: float, **tags: Any) -> None:
    """Observa un valor (latencia, tamano, etc.) en un histograma en memoria."""
    key = _metric_key(metric, tags)
    with _counter_lock:
        bucket = _histograms[key]
        bucket.append(value)
        if len(bucket) > _HISTOGRAM_MAX:
            # Conservamos la mitad mas reciente para no perder la tendencia.
            del bucket[: _HISTOGRAM_MAX // 2]


def _metric_key(metric: str, tags: dict) -> str:
    if not tags:
        return metric
    tag_str = ",".join(f"{k}={v}" for k, v in sorted(tags.items()))
    return f"{metric}{{{tag_str}}}"


def dump_metrics() -> dict:
    """Devuelve un snapshot para logging o endpoint de health."""
    with _counter_lock:
        counters = dict(_counters)
        hist = {
            k: {
                "count": len(v),
                "min": min(v) if v else 0,
                "max": max(v) if v else 0,
                "avg": sum(v) / len(v) if v else 0,
            }
            for k, v in _histograms.items()
        }
    return {"counters": counters, "histograms": hist}


# Categorias de error estandares - usa constantes para evitar typos.
METRIC_ERROR_DB = "frigo.error.db"
METRIC_ERROR_LLM = "frigo.error.llm"
METRIC_ERROR_HTTP = "frigo.error.http"
METRIC_ERROR_TOOL = "frigo.error.tool"
METRIC_ERROR_INTERRUPT = "frigo.error.interrupt"
METRIC_ERROR_TELEGRAM = "frigo.error.telegram"
METRIC_REQUEST = "frigo.request"
METRIC_TOOL_CALL = "frigo.tool.call"
METRIC_LATENCY_LLM_MS = "frigo.latency.llm_ms"
METRIC_LATENCY_TOOL_MS = "frigo.latency.tool_ms"
METRIC_LATENCY_TOTAL_MS = "frigo.latency.total_ms"


def log_error(category: str, exc: BaseException, **context: Any) -> None:
    """Helper unificado: incrementa contador + manda a Sentry + loggea.

    Uso:
        try: ...
        except Exception as e:
            log_error(METRIC_ERROR_DB, e, chat_id=123, tool="rastrear_lote")
            raise
    """
    incr(category)
    sentry_capture_exception(exc, **context)
    log.error("%s: %s (context=%s)", category, exc, context, exc_info=True)
