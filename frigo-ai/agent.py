"""
agent.py - Agente Orquestador FrigoIA con LangGraph + GitHub Models (GPT-4o)

v9.0 — Arquitectura MCP-First escalable:
  - Cerebro principal: GitHub Models GPT-4o via langchain-openai.
  - Herramientas: descubiertas dinámicamente del servidor MCP (mcp_server.py).
  - El LLM NUNCA accede a la BD directamente → pasa por MCP como capa de seguridad.
  - Fallback: tools SQL directos si MCP no está disponible.
  - MCP se inicializa al arrancar y se reutiliza (sesión persistente).
  - procesar_mensaje_con_agente(texto, chat_id): punto de entrada SINCRONO para main.py.
  - run_agent_for_telegram(): punto de entrada ASYNC con interrupt para telegram_bot.py.
  - run_agent() / get_agent(): backward-compat FastAPI (estateless).
  - MemorySaver por chat_id: cada operario mantiene su sesion conversacional.

Requiere en .env:
  GITHUB_TOKEN, GITHUB_MODEL           — GitHub Models (cerebro principal)
  PG_DATABASE_URL                      — Azure PostgreSQL
"""
import asyncio
import logging
import os
import re
from datetime import datetime
from typing import Annotated, Any, TypedDict

import httpx
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
    trim_messages,
)
from langchain_core.messages.utils import count_tokens_approximately
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import create_react_agent
from langgraph.types import Command, interrupt
from tenacity import (
    AsyncRetrying,
    RetryError,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from sql_tools import (
    rastrear_lote_tool,
    obtener_esquema_formulario_tool,
    guardar_borrador_tool,
    estadisticas_formularios_tool,
    analizar_datos_formulario_tool,
    listar_lotes_tool,
    analizar_brecha_lote_tool,
    analizar_foto_etiqueta_tool,
    resumen_negocio_tool,
    analizar_rendimiento_tool,
    calcular_formula_tool,
    revisar_observaciones_tool,
)
from state_backends import get_checkpointer
from tool_result import err as tool_err

try:
    from mcp_client import (
        initialize_mcp,
        shutdown_mcp,
        get_active_tools as _mcp_get_active_tools,
        mcp_is_active,
        mcp_server_url,
        inyectar_herramientas_mcp,  # compat
        ejecutar_tool_mcp,          # compat
    )
    _MCP_AVAILABLE = True
except ImportError:
    initialize_mcp = None  # type: ignore[assignment]
    shutdown_mcp = None    # type: ignore[assignment]
    _mcp_get_active_tools = None  # type: ignore[assignment]
    mcp_is_active = lambda: False  # type: ignore[assignment]
    mcp_server_url = lambda: "none"  # type: ignore[assignment]
    inyectar_herramientas_mcp = None  # type: ignore[assignment]
    ejecutar_tool_mcp = None  # type: ignore[assignment]
    _MCP_AVAILABLE = False
    logging.getLogger(__name__).warning("mcp_client no disponible — usando tools SQL directos.")

log = logging.getLogger(__name__)


# ===========================================================================
# LLM FACTORY — Proxy Transparente con Fallback (LiteLLM)
#
# Patrón de Alta Disponibilidad:
#   agent.py → LiteLLM Proxy (localhost:4000) → Azure OpenAI GPT-4o (nube)
#                                              ↘ NVIDIA A100 Ollama (on-prem)
#
# El proxy LiteLLM (litellm_config.yaml) intercepta todas las llamadas LLM.
# Si Azure falla (timeout, 5xx, corte de red), LiteLLM enruta al modelo
# local automáticamente. El agente NO necesita saber cuál backend respondió.
#
# El model="gpt-4o" actúa como alias lógico: LiteLLM lo resuelve al
# proveedor configurado en el YAML (azure/gpt-4o → ollama/llama3).
#
# streaming=True es CRÍTICO: permite TTS en tiempo real (frase a frase)
# via XMLStreamFilter en streaming.py. Sin streaming, el operario esperaría
# la respuesta completa antes de escuchar algo.
# ===========================================================================

# URL del proxy LiteLLM (opcional) — si no está corriendo, usa GitHub Models directo
_LITELLM_BASE_URL = os.getenv("LITELLM_BASE_URL", "")
_LITELLM_API_KEY = os.getenv("LITELLM_MASTER_KEY", "sk-frigo-litellm")

# GitHub Models (fallback / modo directo)
_GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
_GITHUB_BASE_URL = "https://models.inference.ai.azure.com"

# Groq — API compatible con OpenAI, inferencia ultrarrapida (Llama 3.3 70B)
# Tercer nivel: se usa si LiteLLM y GitHub Models no están disponibles.
_GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
_GROQ_BASE_URL = "https://api.groq.com/openai/v1"
_GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# Ollama en A100 CEDIA — API compatible con OpenAI en /v1
# Cuarto nivel: último recurso si ninguno de los anteriores está disponible.
_OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "https://io.frigolab.dev")
_OLLAMA_TEXT_MODEL = os.getenv("OLLAMA_TEXT_MODEL", "llama3.2")


def _litellm_available() -> bool:
    """Retorna True si el proxy LiteLLM responde en localhost:4000."""
    import socket
    try:
        host = "localhost"
        port = int((_LITELLM_BASE_URL or "http://localhost:4000").split(":")[-1])
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


def _build_llm(temperature: float = 0.1) -> ChatOpenAI:
    """Construye el LLM con cuatro niveles de disponibilidad:

    1. LiteLLM proxy (localhost:4000) — si está corriendo.
       El proxy ya tiene su propia cadena Azure → Ollama texto → Ollama vision.
    2. GitHub Models directo — si GITHUB_TOKEN está configurado.
    3. Groq directo — si GROQ_API_KEY está configurado (Llama 3.3 70B, muy rápido).
    4. Ollama directo en io.frigolab.dev — último recurso.
       Usa la API compatible con OpenAI (/v1/chat/completions) de Ollama.
    """
    # Selector explicito de proveedor (LLM_PROVIDER=github|groq|ollama|auto)
    # Util cuando el nivel superior tiene limites (ej. GitHub Models gratis
    # acepta max 8000 tokens por request — corto para un agente con 12 tools).
    _provider = os.getenv("LLM_PROVIDER", "auto").lower()
    if _provider == "groq" and _GROQ_API_KEY:
        log.info("agent: LLM_PROVIDER=groq — usando Groq (%s)", _GROQ_MODEL)
        return ChatOpenAI(
            model=_GROQ_MODEL,
            api_key=_GROQ_API_KEY,
            base_url=_GROQ_BASE_URL,
            temperature=temperature,
            streaming=True,
            max_tokens=1024,  # Groq cuenta la salida reservada en el limite TPM
        )
    if _provider == "ollama":
        return ChatOpenAI(
            model=_OLLAMA_TEXT_MODEL,
            api_key="not-needed",
            base_url=f"{_OLLAMA_BASE_URL.rstrip('/')}/v1",
            temperature=temperature,
            streaming=True,
        )

    # Nivel 1 — LiteLLM proxy (gestiona su propia cadena de fallback)
    if _LITELLM_BASE_URL and _litellm_available():
        log.debug("agent: usando LiteLLM proxy en %s", _LITELLM_BASE_URL)
        return ChatOpenAI(
            model="gpt-4o",
            api_key=_LITELLM_API_KEY,
            base_url=_LITELLM_BASE_URL,
            temperature=temperature,
            streaming=True,
        )
    # Nivel 2 — GitHub Models directo
    if _GITHUB_TOKEN:
        log.debug("agent: usando GitHub Models directo")
        return ChatOpenAI(
            model=os.getenv("GITHUB_MODEL", "gpt-4o"),
            api_key=_GITHUB_TOKEN,
            base_url=_GITHUB_BASE_URL,
            temperature=temperature,
            streaming=True,
        )
    # Nivel 3 — Groq (API compatible con OpenAI, soporta tool calling)
    if _GROQ_API_KEY:
        log.info("agent: usando Groq directo (%s)", _GROQ_MODEL)
        return ChatOpenAI(
            model=_GROQ_MODEL,
            api_key=_GROQ_API_KEY,
            base_url=_GROQ_BASE_URL,
            temperature=temperature,
            streaming=True,
            max_tokens=1024,  # Groq cuenta la salida reservada en el limite TPM
        )
    # Nivel 4 — Ollama directo en A100 CEDIA (API compatible con OpenAI)
    # Ollama expone /v1/chat/completions — funciona con ChatOpenAI sin cambios.
    log.warning(
        "agent: LiteLLM, GitHub Models y Groq no disponibles — usando Ollama directo en %s",
        _OLLAMA_BASE_URL,
    )
    return ChatOpenAI(
        model=_OLLAMA_TEXT_MODEL,
        api_key="not-needed",
        base_url=f"{_OLLAMA_BASE_URL.rstrip('/')}/v1",
        temperature=temperature,
        streaming=True,
    )


# ---------------------------------------------------------------------------
# Cache del LLM con tools bindeadas
#
# Antes este modulo construia un nuevo `ChatOpenAI` y llamaba `bind_tools()` en
# CADA turno del agente (cada mensaje del operario). Esto:
#   * Obligaba a negociar el pool httpx desde cero (~100ms por turno).
#   * Recompilaba la definicion de tools que es estatica.
#   * Desperdiciaba memoria creando objetos redundantes.
#
# Ahora cachemos por `(temperature, tools_key)`. La clave de tools es el tuple
# de nombres de tools para que si agregas / quitas tools en tests no reutilices
# un binding obsoleto. Uso `lru_cache` implicito via dict manual.
# ---------------------------------------------------------------------------

_LLM_CACHE: dict[tuple, Any] = {}
_LLM_CACHE_LOCK = asyncio.Lock()

# Errores del LLM considerados transitorios (rate limit, 502, timeout de red).
_TRANSIENT_LLM_EXCEPTIONS: tuple[type[BaseException], ...] = (
    httpx.ConnectError,
    httpx.ReadTimeout,
    httpx.WriteTimeout,
    httpx.PoolTimeout,
    asyncio.TimeoutError,
)

LLM_MAX_RETRIES: int = int(os.getenv("LLM_MAX_RETRIES", "2"))


def _es_error_reintentable(exc: BaseException) -> bool:
    """True si el error del LLM amerita reintento.

    Ademas de los errores de red transitorios, reintenta los FLAKES DE
    GENERACION de tool calls: a veces el modelo emite una llamada a funcion
    malformada y el proveedor la rechaza ("Failed to call a function",
    "tool call validation failed"). No es un bug del prompt — al reintentar,
    el modelo casi siempre genera la llamada bien.
    """
    if isinstance(exc, _TRANSIENT_LLM_EXCEPTIONS):
        return True
    msg = str(exc).lower()
    return (
        "failed to call a function" in msg
        or "tool call validation failed" in msg
        or "failed_generation" in msg
        or "rate_limit_exceeded" in msg
    )


async def _get_bound_llm(tools: list, temperature: float = 0.1):
    """Retorna el LLM con `bind_tools(...)` aplicado, cacheado por tools y temperature."""
    key = (round(temperature, 2), tuple(getattr(t, "name", str(t)) for t in tools))
    cached = _LLM_CACHE.get(key)
    if cached is not None:
        return cached
    async with _LLM_CACHE_LOCK:
        cached = _LLM_CACHE.get(key)
        if cached is not None:
            return cached
        bound = _build_llm(temperature=temperature).bind_tools(tools)
        _LLM_CACHE[key] = bound
        log.info(
            "agent._get_bound_llm: LLM cacheado (temperature=%.2f, tools=%d)",
            temperature, len(tools),
        )
        return bound


async def _llm_ainvoke_with_retry(llm, messages: list) -> Any:
    """Invoca el LLM con reintento exponencial sobre errores de red transitorios.

    NO reintenta errores 4xx (bad request / auth) porque esos indican un bug
    en la composicion del prompt; reintentar solo empeora el problema.
    """
    try:
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(LLM_MAX_RETRIES + 1),
            wait=wait_exponential(multiplier=0.5, min=0.5, max=3.0),
            retry=retry_if_exception(_es_error_reintentable),
            reraise=True,
        ):
            with attempt:
                n = attempt.retry_state.attempt_number
                if n > 1:
                    log.warning("LLM reintento %d/%d", n, LLM_MAX_RETRIES + 1)
                return await llm.ainvoke(messages)
    except RetryError as rexc:  # pragma: no cover
        raise rexc.last_attempt.exception()  # type: ignore[misc]
    raise RuntimeError("_llm_ainvoke_with_retry sin resultado")


# ===========================================================================
# SYSTEM PROMPT XML — GPT-4o como Gerente de Operaciones
# Dos flujos: trazabilidad de lotes + ingreso de formularios por voz.
# ===========================================================================

SYSTEM_PROMPT = """Eres FrigoIA, el asistente de control de calidad de Frigolab San Mateo, una planta de exportacion de productos del mar. Tienes acceso a herramientas (tools/functions) que consultan la base de datos de produccion en tiempo real.

REGLA CRITICA: Cuando el operario pregunte por lotes, formularios, estadisticas, resumen o datos de produccion, SIEMPRE debes llamar a la herramienta correspondiente. NUNCA respondas de memoria o inventes datos. Si no usas una herramienta, tu respuesta esta mal.

HERRAMIENTAS DISPONIBLES Y CUANDO USARLAS:
- resumen_negocio_tool: usar cuando pregunten "dashboard", "como vamos", "resumen", "estado general", "inicio de turno", "KPIs", "cumplimiento", "reporte del dia/semana", "cuantos lotes completos", "que esta pasando", "hay alertas de temperatura". Sin argumentos = ultimos 7 dias.
- listar_lotes_tool: usar cuando pregunten "que lotes hay", "lista lotes", "lotes de hoy/semana". Sin argumentos = ultimos 60 dias.
- rastrear_lote_tool: usar cuando den un numero de lote y quieran ver su historia completa.
- analizar_brecha_lote_tool: usar cuando pregunten si un lote especifico esta completo o que etapas le faltan.
- analizar_foto_etiqueta_tool: usar cuando envien una foto de etiqueta o producto.
- obtener_esquema_formulario_tool: usar antes de crear un formulario para saber los campos exactos.
- guardar_borrador_tool: usar para guardar datos de un formulario de QC.
- estadisticas_formularios_tool: usar cuando pregunten metricas globales, porcentajes, ranking top formularios.
- analizar_datos_formulario_tool: usar cuando pregunten por el contenido especifico de un tipo de formulario (ej. "que temperaturas tiene el FOR-CC-10").
- analizar_rendimiento_tool: usar cuando pregunten por RENDIMIENTO, yield, eficiencia o perdidas de produccion, en cualquier fecha o rango: "rendimiento de hoy", "rendimiento del 5 de julio", "que dia tuvo mejor rendimiento este mes", "compara el rendimiento de esta semana con la anterior" (para comparar, llamala una vez por cada periodo). Acepta filtros opcionales por formulario (template_codigo) y producto.
- calcular_formula_tool: usar cuando el usuario pida un CALCULO PERSONALIZADO entre columnas de los formularios: "divide la columna X entre Y", "suma la columna X de los ultimos 15 dias", "diferencia entre peso entrada y salida", "promedio de X por dia". Construye la formula con los nombres de columna ENTRE CORCHETES, ej: "[Peso Neto] / [Peso Recibido] * 100" o "SUM([Cantidad])". Si la tool responde que una columna no existe, revisa la lista de columnas disponibles que devuelve y reintenta con el nombre correcto.
- revisar_observaciones_tool: usar cuando pregunten por OBSERVACIONES, novedades, incidencias, problemas o comentarios anotados por los operarios: "que novedades hay esta semana", "que observaciones aparecieron en el FOR-CC-11", "hubo algun problema en los ultimos 15 dias", "busca observaciones que mencionen cloro". Filtra automaticamente los "sin novedad".

FLUJO DE PRODUCCION (en orden):
1. Fileteo (FOR-PD-04)
2. Liberacion de Tunel (FOR-PD-05)
3. Corte y Empaque (FOR-PD-06)
4. Control de Sellos (FOR-CC-10)
Un lote COMPLETO tiene registro en las 4 etapas. Si falta alguna, hay una brecha de QC.

TEMPERATURA: Congelados deben estar a -18 C o menos. Frio a 4 C o menos. Si hay valores fuera de rango, inicia la respuesta con ALERTA DE TEMPERATURA.

FECHAS: Para rangos relativos ("ultimos 15 dias", "esta semana", "este mes") NO calcules fechas: pasa el parametro ultimos_dias (ej. ultimos_dias=15, semana=7, mes=30) y deja fecha_desde/fecha_hasta vacios. Solo usa fecha_desde/fecha_hasta (YYYY-MM-DD, nunca futuras) cuando el usuario diga fechas concretas; la fecha actual esta al final de este prompt.

FORMATO DE RESPUESTA DE HERRAMIENTAS:
Las herramientas devuelven JSON: {"status": "ok"/"empty"/"error", "message": "...", "data": {...}}
- status "ok": usa "message" y extrae datos de "data" para responder.
- status "empty": informa que no hay datos y sugiere ajustar la busqueda.
- status "error": informa del problema tecnico y sugiere reintentar.
Nunca muestres el JSON crudo al operario. Traduce siempre a lenguaje natural en espanol.

IDIOMA Y TONO: Responde siempre en espanol. Claro, breve y profesional. Sin markdown complejo, sin tablas. El operario puede estar en planta leyendo desde el telefono."""


def _now_str() -> str:
    """Fecha y hora actual formateada."""
    return datetime.now().strftime("%d/%m/%Y %H:%M:%S")


# Todas las herramientas del agente
_TOOLS = [
    resumen_negocio_tool,
    listar_lotes_tool,
    rastrear_lote_tool,
    analizar_brecha_lote_tool,
    analizar_foto_etiqueta_tool,
    obtener_esquema_formulario_tool,
    guardar_borrador_tool,
    estadisticas_formularios_tool,
    analizar_datos_formulario_tool,
    analizar_rendimiento_tool,
    calcular_formula_tool,
    revisar_observaciones_tool,
]


# ===========================================================================
# AGENTE GPT-4o con MemorySaver (sesion por chat_id)
# ===========================================================================

_main_agent = None


def _build_main_agent():
    """Construye el agente ReAct con GPT-4o (GitHub Models) y las 3 herramientas."""
    llm = _build_llm(temperature=0.1)
    # Usamos un callable como prompt para que el timestamp se inyecte en cada
    # llamada al LLM SIN almacenarlo en el historial de MemorySaver.
    # Si usaramos prompt=SYSTEM_PROMPT (string estatico) perderiamos la hora,
    # y si inyectaramos SystemMessage en el input, se acumularia en el historial
    # (~800 tokens por turno desperdiciados).
    def _dynamic_prompt(state: dict) -> list:
        system = SystemMessage(
            content=f"{SYSTEM_PROMPT}\n\nFecha y hora actual: {_now_str()}"
        )
        return [system] + state["messages"]

    return create_react_agent(
        model=llm,
        tools=_TOOLS,
        prompt=_dynamic_prompt,
        checkpointer=get_checkpointer(),
    )


def get_main_agent():
    """Singleton del agente GPT-4o con memoria."""
    global _main_agent
    if _main_agent is None:
        _main_agent = _build_main_agent()
    return _main_agent


# ===========================================================================
# procesar_mensaje_con_agente — punto de entrada SINCRONO para main.py (telebot)
# ===========================================================================

async def _async_procesar(texto: str, chat_id: str) -> str:
    """Ejecuta el agente async. El timestamp se inyecta via _dynamic_prompt, no aqui."""
    agent = get_main_agent()
    config = {"configurable": {"thread_id": chat_id}}

    # Solo enviamos HumanMessage. El SystemMessage con timestamp lo genera
    # _dynamic_prompt() en cada llamada al LLM y NO se almacena en MemorySaver,
    # evitando la acumulacion de ~800 tokens por turno en el historial.
    entrada = {"messages": [HumanMessage(content=texto)]}

    try:
        resultado = await agent.ainvoke(entrada, config=config)
        mensajes = resultado.get("messages", [])

        # Extraer la ultima respuesta del LLM (sin tool_calls)
        for msg in reversed(mensajes):
            if isinstance(msg, AIMessage) and msg.content and not getattr(msg, "tool_calls", None):
                return str(msg.content)

        return "No obtuve una respuesta del agente. Por favor intenta de nuevo."

    except Exception as exc:
        log.error("Error en agente GPT-4o (chat_id=%s): %s", chat_id, exc, exc_info=True)
        return (
            "Ocurrio un error al procesar tu solicitud. "
            "Por favor intentalo de nuevo en unos momentos."
        )


def procesar_mensaje_con_agente(texto: str, chat_id: str) -> str:
    """
    Punto de entrada SINCRONO del agente FrigoIA.

    Diseñado para telebot (main.py) que corre en modo polling sincrono.
    Cada chat_id tiene su propia sesion conversacional (MemorySaver).

    Args:
        texto:   Mensaje del operario (transcripcion de voz o texto plano).
        chat_id: ID del chat de Telegram como string. Identifica la sesion.

    Returns:
        Respuesta en texto plano lista para enviar por Telegram.
    """
    return asyncio.run(_async_procesar(texto, chat_id))


# ===========================================================================
# GRAFO ESTATEFUL LANGGRAPH — telegram_bot.py (async + interrupt)
# Usa GPT-4o + pedir_dato_al_operario para datos faltantes.
# ===========================================================================

@tool
def pedir_dato_al_operario(campo: str, pregunta: str) -> str:
    """Pausa el flujo y pregunta al operario por Telegram cuando falta un dato critico.

    USA esta herramienta cuando un campo obligatorio (lote, producto, maquina,
    temperatura) no fue mencionado en el dictado. No inventes el dato.

    Args:
        campo:    Nombre del campo faltante (ej. "numero_lote").
        pregunta: Pregunta clara en espanol para el operario.
    """
    return f"__NEED_INPUT__:{campo}:{pregunta}"


# ---------------------------------------------------------------------------
# _GRAPH_TOOLS — se rellena con MCP tools si están disponibles,
# de lo contrario cae al fallback de imports directos de sql_tools.
# Se actualiza por initialize_mcp_tools() al arrancar el bot.
# ---------------------------------------------------------------------------
_GRAPH_TOOLS: list = _TOOLS + [pedir_dato_al_operario]  # fallback inicial


def _refresh_graph_tools() -> None:
    """Actualiza _GRAPH_TOOLS con las herramientas MCP activas (si las hay).

    Si MCP está activo, reemplaza los sql_tools directos por las versiones MCP.
    Mantiene siempre `pedir_dato_al_operario` que es local (no está en MCP).
    Invalida el LLM cache para que la próxima llamada use los nuevos tools.
    """
    global _GRAPH_TOOLS
    if _MCP_AVAILABLE and mcp_is_active():
        mcp_tools = _mcp_get_active_tools()
        _GRAPH_TOOLS = mcp_tools + [pedir_dato_al_operario]
        _LLM_CACHE.clear()  # forzar re-binding del LLM con los nuevos tools
        log.info(
            "agent: usando %d herramientas MCP (transport=%s) + pedir_dato_al_operario",
            len(mcp_tools),
            mcp_server_url(),
        )
    else:
        _GRAPH_TOOLS = list(_TOOLS) + [pedir_dato_al_operario]
        log.info("agent: usando %d herramientas SQL directas (fallback)", len(_TOOLS))


async def initialize_mcp_tools() -> bool:
    """Inicializa MCP al arrancar el bot y actualiza _GRAPH_TOOLS.

    Llama esta función una sola vez en el startup de telegram_bot.py.
    Retorna True si MCP se activó, False si se usa fallback.
    """
    if not _MCP_AVAILABLE or initialize_mcp is None:
        log.info("agent: mcp_client no disponible — usando sql_tools directos.")
        return False
    ok = await initialize_mcp()
    _refresh_graph_tools()
    return ok


async def shutdown_agent() -> None:
    """Cierra recursos async del agente (sesión MCP) al detener el bot."""
    if _MCP_AVAILABLE and shutdown_mcp is not None:
        await shutdown_mcp()


def mcp_status() -> dict:
    """Devuelve estado MCP para el comando /status de Telegram."""
    active = _MCP_AVAILABLE and mcp_is_active()
    return {
        "mcp_active": active,
        "transport": mcp_server_url() if active else "none",
        "tools_count": len(_GRAPH_TOOLS),
        "tool_names": [t.name for t in _GRAPH_TOOLS],
    }


class FrigoState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


# ---------------------------------------------------------------------------
# Recorte de contexto (#2 del checklist Senior)
#
# Por que: una conversacion de Telegram con varios ciclos de tool calls puede
# acumular 20k+ tokens entre ToolMessage (resultados SQL largos) y AIMessage
# (pensamientos del agente). GPT-4o tiene ventana grande, pero el costo crece
# linealmente y la latencia tambien. Ademas, algunos modelos de fallback
# (Ollama on-prem) tienen ventanas de 8k-16k.
#
# Estrategia:
#   * Mantenemos los ULTIMOS mensajes hasta `MAX_CONTEXT_TOKENS`.
#   * `start_on="human"`: el recorte respeta los pares (AI -> tool_calls) y
#     empieza en un HumanMessage valido. Asi nunca enviamos ToolMessage
#     huerfanos al LLM, que harian fallar la validacion OpenAI.
#   * `count_tokens_approximately` es suficiente: no necesitamos tiktoken
#     en el hot path. Ligera subestimacion, pero la ventana tiene colchon.
#   * El SystemMessage se agrega APARTE porque cambia en cada turno
#     (incluye la fecha/hora actual).
# ---------------------------------------------------------------------------

# gpt-4o-mini (GitHub Models): limite REAL de 8000 tokens por request.
# El payload total incluye:
#   - System prompt:         ~800 tokens
#   - Definiciones de tools: ~2500 tokens (10 tools con descripciones)
#   - Respuesta del modelo:  ~500 tokens
# Budget real para historial de mensajes: 8000 - 3800 = ~4200 tokens.
# Usamos 3500 para tener margen seguro.
MAX_CONTEXT_TOKENS: int = int(os.getenv("MAX_CONTEXT_TOKENS", "3500"))

# Limite para el contenido de un ToolMessage individual.
# 600 chars (~150 tokens) evita que un resultado grande de listar_lotes
# consuma todo el budget de contexto.
_MAX_TOOL_MSG_CHARS: int = int(os.getenv("MAX_TOOL_MSG_CHARS", "600"))

_context_trimmer = trim_messages(
    max_tokens=MAX_CONTEXT_TOKENS,
    strategy="last",
    token_counter=count_tokens_approximately,
    include_system=False,
    allow_partial=False,
    start_on="human",
)


def _truncate_tool_messages(messages: list) -> list:
    """Recorta el contenido de ToolMessages que superen _MAX_TOOL_MSG_CHARS.

    Evita el 413 cuando una tool devuelve un JSON enorme (lista de lotes, etc.).
    El recorte agrega un aviso al final para que el LLM sepa que hay mas datos.
    """
    result = []
    for msg in messages:
        if isinstance(msg, ToolMessage) and isinstance(msg.content, str):
            if len(msg.content) > _MAX_TOOL_MSG_CHARS:
                truncated = msg.content[:_MAX_TOOL_MSG_CHARS]
                # Cortar en el ultimo caracter seguro (no a mitad de palabra)
                last_safe = max(truncated.rfind("\n"), truncated.rfind(","), truncated.rfind("}"))
                if last_safe > _MAX_TOOL_MSG_CHARS // 2:
                    truncated = truncated[:last_safe + 1]
                truncated += f"\n... [RESULTADO TRUNCADO — {len(msg.content)} chars totales. Usa filtros mas especificos.]"
                msg = ToolMessage(
                    content=truncated,
                    tool_call_id=msg.tool_call_id,
                    name=getattr(msg, "name", None),
                )
        result.append(msg)
    return result


async def agent_node(state: FrigoState) -> dict:
    """Invoca GPT-4o con las tools y el contexto recortado de la conversacion.

    * Reusa el LLM bindeado del cache (sin reconstruirlo por turno).
    * Reintenta errores de red transitorios con backoff exponencial.
    * Si el LLM falla aun asi, devolvemos un AIMessage con mensaje degradado
      para que la UI (Telegram) pueda mostrar algo coherente al operario.
    """
    llm = await _get_bound_llm(_GRAPH_TOOLS, temperature=0.1)
    system = SystemMessage(content=f"{SYSTEM_PROMPT}\nFecha y hora: {_now_str()}")

    # Truncar ToolMessages gigantes PRIMERO para que el trimmer vea mensajes pequeños
    # y no descarte todo el historial por exceso de tokens.
    pre_truncated = _truncate_tool_messages(state["messages"])

    try:
        trimmed = _context_trimmer.invoke(pre_truncated)
    except Exception as exc:
        log.warning("trim_messages fallo, usando fallback: %s", exc)
        trimmed = pre_truncated[-10:]

    # Fallback de seguridad: si el trimmer devolvio 0 mensajes (resultado vacio),
    # conservar al menos los ultimos 4 para que el LLM tenga contexto minimo.
    if not trimmed:
        trimmed = pre_truncated[-4:]
        log.warning(
            "agent_node: trimmer devolvio 0 mensajes — usando fallback ultimos %d",
            len(trimmed),
        )

    if len(trimmed) < len(state["messages"]):
        log.info(
            "agent_node: contexto recortado %d -> %d mensajes (max_tokens=%d)",
            len(state["messages"]), len(trimmed), MAX_CONTEXT_TOKENS,
        )

    try:
        response = await _llm_ainvoke_with_retry(llm, [system] + trimmed)
    except Exception as exc:
        err_str = str(exc)
        log.error("agent_node: LLM fallo tras reintentos: %s", exc, exc_info=True)

        # 413 tokens_limit_reached: intentar de nuevo con Ollama SIN tool-calling.
        # Ollama bloquea (403) los requests con function-calling definitions (WAF).
        # En su lugar, resumimos el ultimo resultado visible y pedimos respuesta texto.
        if "413" in err_str or "tokens_limit" in err_str:
            log.warning("agent_node: 413 en GitHub Models -> reintentando con Ollama (sin tools)")
            try:
                ollama_llm = ChatOpenAI(
                    model=_OLLAMA_TEXT_MODEL,
                    api_key="not-needed",
                    base_url=f"{_OLLAMA_BASE_URL.rstrip('/')}/v1",
                    temperature=0.1,
                    streaming=False,  # no streaming en fallback
                )
                # Extraer solo el ultimo par human + tool_result para dar contexto minimo
                last_human = next(
                    (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)), None
                )
                last_tool = next(
                    (m for m in reversed(state["messages"]) if isinstance(m, ToolMessage)), None
                )
                mini_ctx: list = []
                if last_tool:
                    # Resumir el resultado SQL en pocas palabras
                    tool_content = last_tool.content[:800] if isinstance(last_tool.content, str) else str(last_tool.content)[:800]
                    mini_ctx.append(HumanMessage(content=(
                        f"Datos de la base de datos Frigolab:\n{tool_content}\n\n"
                        f"Pregunta del operario: {last_human.content if last_human else 'resumen'}"
                    )))
                elif last_human:
                    mini_ctx.append(last_human)
                else:
                    mini_ctx = [HumanMessage(content="Resume la situacion actual de Frigolab.")]
                response = await ollama_llm.ainvoke(
                    [SystemMessage(content="Eres FrigoIA, asistente de Frigolab. Responde en espanol, breve y claro.")] + mini_ctx
                )
            except Exception as exc2:
                log.error("agent_node: Ollama fallback tambien fallo: %s", exc2)
                response = AIMessage(
                    content="El contexto es demasiado grande. Usa filtros mas especificos (ej: fecha o lote concreto)."
                )
        else:
            response = AIMessage(
                content=(
                    "Tuve un problema momentaneo con el servicio de IA. "
                    "Por favor intenta de nuevo en unos segundos."
                )
            )
    return {"messages": [response]}


async def tools_node(state: FrigoState) -> dict:
    """Ejecuta las tools solicitadas (excepto pedir_dato_al_operario).

    Si una tool lanza excepcion inesperada (no deberia — nuestras tools ya
    capturan internamente y devuelven JSON err(...)), fabricamos aqui mismo
    un ToolMessage con el mismo contrato estructurado via `tool_result.err`.
    """
    last = state["messages"][-1]
    tool_calls = getattr(last, "tool_calls", []) or []
    tool_map = {t.name: t for t in _GRAPH_TOOLS}
    results: list[BaseMessage] = []

    for tc in tool_calls:
        if tc["name"] == "pedir_dato_al_operario":
            continue
        fn = tool_map.get(tc["name"])
        if fn is None:
            content = tool_err(
                "TOOL_NOT_FOUND",
                f"La herramienta '{tc['name']}' no existe en este agente.",
                {"tool": tc["name"]},
            )
        else:
            try:
                content = await fn.ainvoke(tc["args"])
            except Exception as exc:
                log.error("Error en tool %s: %s", tc["name"], exc, exc_info=True)
                content = tool_err(
                    "TOOL_CRASH",
                    f"La herramienta {tc['name']} fallo inesperadamente: {exc}",
                    {"tool": tc["name"], "error": str(exc)},
                )
        results.append(ToolMessage(content=str(content), tool_call_id=tc["id"]))

    return {"messages": results}


# ---------------------------------------------------------------------------
# Human-in-the-loop robusto (#4 del checklist Senior)
#
# Problemas del interrupt original:
#   a) Si el operario mandaba texto vacio o basura (ej. sticker), entraba al LLM
#      como "El operario respondio sobre X: " y el LLM no sabia que hacer.
#   b) No habia limite de longitud — un audio de 3 minutos transcrito podia
#      meter 2000 palabras como "respuesta" a una pregunta de un campo.
#   c) El LLM recibia free-text sin saber si el operario respondio o no.
#
# Mejoras:
#   * `_sanitize_resume_value`: limpia y valida la respuesta.
#   * El ToolMessage devuelve JSON estructurado (mismo contrato que sql_tools):
#     status=ok/empty/error segun si la respuesta fue util.
#   * Si viene vacio/corto: le decimos al LLM explicitamente "vuelve a preguntar".
# ---------------------------------------------------------------------------

_MAX_RESUME_CHARS = 500
_MIN_RESUME_CHARS = 1


def _sanitize_resume_value(raw) -> tuple[str, bool]:
    """Limpia la respuesta del operario. Devuelve (texto_limpio, es_valida).

    Reglas:
      - None, vacio, solo espacios -> invalido
      - Menos de `_MIN_RESUME_CHARS` caracteres -> invalido
      - Mas de `_MAX_RESUME_CHARS` -> truncar
    """
    if raw is None:
        return "", False
    text = str(raw).strip()
    if len(text) < _MIN_RESUME_CHARS:
        return "", False
    if len(text) > _MAX_RESUME_CHARS:
        log.warning("resume_value truncado de %d a %d chars", len(text), _MAX_RESUME_CHARS)
        text = text[:_MAX_RESUME_CHARS]
    return text, True


def ask_human_node(state: FrigoState) -> dict:
    """Pausa el grafo con interrupt() y reanuda validando la respuesta del operario."""
    last = state["messages"][-1]
    tool_calls = getattr(last, "tool_calls", []) or []

    campo, pregunta, call_id = "dato", "Necesito un dato adicional.", "unknown"
    for tc in tool_calls:
        if tc["name"] == "pedir_dato_al_operario":
            campo = tc["args"].get("campo", campo)
            pregunta = tc["args"].get("pregunta", pregunta)
            call_id = tc["id"]
            break

    raw = interrupt(pregunta)
    texto, es_valida = _sanitize_resume_value(raw)

    if not es_valida:
        # Devolvemos al LLM una senal explicita de "no hubo respuesta util".
        # El SYSTEM_PROMPT ya instruye a reintentar con otra pregunta.
        from tool_result import empty as tool_empty
        content = tool_empty(
            f"El operario no proporciono un valor claro para '{campo}'. "
            "Reformula la pregunta de forma mas simple o pide el dato de otra manera. "
            "No inventes el dato.",
            {"campo": campo, "pregunta_original": pregunta},
        )
    else:
        from tool_result import ok as tool_ok
        content = tool_ok(
            f"El operario respondio sobre '{campo}': {texto}",
            {"campo": campo, "valor": texto},
            code="HUMAN_ANSWER",
        )

    return {"messages": [ToolMessage(content=content, tool_call_id=call_id)]}


def router(state: FrigoState) -> str:
    """Decide el siguiente nodo tras la respuesta del LLM."""
    last = state["messages"][-1]
    if not isinstance(last, AIMessage):
        return "agent"
    tool_calls = getattr(last, "tool_calls", []) or []
    if not tool_calls:
        return END
    for tc in tool_calls:
        if tc["name"] == "pedir_dato_al_operario":
            return "ask_human"
    return "tools"


_telegram_graph = None


def get_telegram_graph():
    """Singleton del grafo estateful para telegram_bot.py.

    El checkpointer se elige en `state_backends.get_checkpointer()` segun
    `CHECKPOINTER_BACKEND` (memory|postgres). Tanto el agente principal como
    el grafo de Telegram comparten el MISMO checkpointer para que un operario
    que mande texto y luego voz siga hablando en el mismo thread.
    """
    global _telegram_graph
    if _telegram_graph is None:
        builder = StateGraph(FrigoState)
        builder.add_node("agent", agent_node)
        builder.add_node("tools", tools_node)
        builder.add_node("ask_human", ask_human_node)
        builder.set_entry_point("agent")
        builder.add_conditional_edges(
            "agent", router, {"tools": "tools", "ask_human": "ask_human", END: END}
        )
        builder.add_edge("tools", "agent")
        builder.add_edge("ask_human", "agent")
        _telegram_graph = builder.compile(checkpointer=get_checkpointer())
    return _telegram_graph


# ---------------------------------------------------------------------------
# Helpers para run_agent_for_telegram
# ---------------------------------------------------------------------------

def _extract_interrupt_question(state) -> str:
    for task in state.tasks:
        for intr in getattr(task, "interrupts", []):
            if intr.value:
                return str(intr.value)
    return "Necesito mas informacion para continuar."


def _extract_final_ai_response(messages: list) -> str:
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and msg.content and not getattr(msg, "tool_calls", None):
            return str(msg.content)
    return ""


async def _invoke_graph(graph, config, is_resume, resume_value, user_message, operator_name):
    """Invoca el grafo con sanitizacion estricta del input.

    * En reanudacion, el valor llega al ask_human_node via `Command(resume=...)`.
      Lo dejamos pasar TAL CUAL (lo valida `ask_human_node._sanitize_resume_value`),
      pero nos aseguramos de que sea un string — un None implicito aqui tiraria
      un interrupt-resume roto.
    * En mensaje nuevo, saneamos el nombre del operador (GitHub Models rechaza
      nombres con caracteres especiales) y garantizamos que el mensaje no esta vacio.
    """
    if is_resume:
        safe_resume = "" if resume_value is None else str(resume_value)
        return await graph.ainvoke(Command(resume=safe_resume), config=config)

    safe_name = re.sub(r"[^\w]", "_", operator_name or "Operador")[:64]
    safe_msg = (user_message or "").strip() or "(mensaje vacio)"
    return await graph.ainvoke(
        {"messages": [HumanMessage(content=safe_msg, name=safe_name)]},
        config=config,
    )


async def run_agent_for_telegram(
    chat_id: int,
    user_message: str,
    operator_name: str = "Operador",
    is_resume: bool = False,
    resume_value: str | None = None,
) -> dict:
    """
    Ejecuta el agente GPT-4o para telegram_bot.py con soporte de interrupt.

    Returns dict con: response, interrupted, question.
    """
    graph = get_telegram_graph()
    config = {"configurable": {"thread_id": str(chat_id)}}
    try:
        result = await _invoke_graph(
            graph, config, is_resume, resume_value, user_message, operator_name
        )
        state = await graph.aget_state(config)
        if state.next:
            return {
                "response": "",
                "interrupted": True,
                "question": _extract_interrupt_question(state),
            }
        return {
            "response": _extract_final_ai_response(result.get("messages", [])),
            "interrupted": False,
            "question": "",
        }
    except Exception as exc:
        log.error("Error en agente Telegram chat_id=%s: %s", chat_id, exc, exc_info=True)
        return {
            "response": "Lo siento, ocurrio un error. Por favor intentalo de nuevo.",
            "interrupted": False,
            "question": "",
        }


# ===========================================================================
# BACKWARD COMPAT — FastAPI / server.py (GPT estateless)
# ===========================================================================

# El agente FastAPI expone la MISMA lista de tools que el grafo Telegram (sin
# `pedir_dato_al_operario` porque FastAPI no tiene interrupt/human-in-the-loop).
# Antes estaba hardcodeado con solo 5 tools y perdia listar_lotes / analizar_brecha.
_TOOLS_FASTAPI = list(_TOOLS)


def _build_message_history(conversation_history: list | None) -> list:
    messages = []
    if not conversation_history:
        return messages
    for msg in conversation_history:
        role = msg.get("role", "")
        text = msg.get("text", "")
        if role == "user":
            messages.append(HumanMessage(content=text))
        elif role == "assistant":
            messages.append(AIMessage(content=text))
    return messages


def _extract_tools_used(agent_messages: list) -> list[str]:
    used = []
    for msg in agent_messages:
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                used.append(tc.get("name", ""))
    return used


def _extract_tool_results(agent_messages: list) -> list[str]:
    return [
        msg.content for msg in agent_messages
        if hasattr(msg, "name") and msg.name and hasattr(msg, "content")
    ]


def _extract_final_response(agent_messages: list) -> str:
    for msg in reversed(agent_messages):
        if isinstance(msg, AIMessage) and msg.content and not getattr(msg, "tool_calls", None):
            return str(msg.content)
    return ""


def _create_agent():
    """Agente GPT para FastAPI (estateless, sin MemorySaver)."""
    llm = _build_llm(temperature=0.2)

    # Prompt dinamico: inyecta la fecha/hora actual en CADA llamada.
    # Con prompt estatico el modelo no sabe que dia es y calcula mal los
    # rangos relativos ("ultimos 15 dias" terminaba en fechas futuras).
    def _dynamic_prompt(state: dict) -> list:
        system = SystemMessage(
            content=f"{SYSTEM_PROMPT}\n\nFecha y hora actual: {_now_str()}"
        )
        return [system] + state["messages"]

    return create_react_agent(model=llm, tools=_TOOLS_FASTAPI, prompt=_dynamic_prompt)


_agent_instance = None


def get_agent():
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = _create_agent()
    return _agent_instance


async def run_agent(user_message: str, conversation_history: list | None = None) -> dict:
    """Agente GPT estateless para la API REST (server.py / FastAPI)."""
    agent = get_agent()
    messages = [SystemMessage(content=f"{SYSTEM_PROMPT}\nFecha y hora: {_now_str()}")]
    messages += _build_message_history(conversation_history)
    messages.append(HumanMessage(content=user_message))
    try:
        result = await agent.ainvoke({"messages": messages})
        msgs = result.get("messages", [])
        return {
            "response": _extract_final_response(msgs),
            "tools_used": _extract_tools_used(msgs),
            "tool_results": _extract_tool_results(msgs),
        }
    except Exception as exc:
        log.error("Error en run_agent: %s", exc, exc_info=True)
        return {"response": f"Error: {exc}", "tools_used": [], "tool_results": []}


# ===========================================================================
# AGENTE MCP — Zero Trust (herramientas descubiertas del servidor MCP)
# ===========================================================================

async def get_mcp_tools() -> list:
    """Retorna las tools MCP como tools LangChain, o fallback a SQL tools."""
    if _MCP_AVAILABLE:
        if mcp_is_active():
            mcp_tools = _mcp_get_active_tools()
            log.info("Usando %d herramientas MCP", len(mcp_tools))
            return mcp_tools
        elif initialize_mcp is not None and await initialize_mcp():
            mcp_tools = _mcp_get_active_tools()
            log.info("Usando %d herramientas MCP (recien inicializado)", len(mcp_tools))
            return mcp_tools
            
    log.info("Usando herramientas SQL directas (fallback)")
    return list(_TOOLS)


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    async def _test():
        print("=== Test 1: procesar_mensaje_con_agente (sync, GPT-4o) ===")
        resp = await _async_procesar("¿Que formularios tengo disponibles?", "test-001")
        print(f"FrigoIA: {resp}")

        print("\n=== Test 2: MCP Agent (Zero Trust) ===")
        mcp_tools = await get_mcp_tools()
        print(f"Tools disponibles: {[t.name for t in mcp_tools]}")

    asyncio.run(_test())
