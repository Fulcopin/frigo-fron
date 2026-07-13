This file is a merged representation of a subset of the codebase, containing files not matching ignore patterns, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching these patterns are excluded: **/*.sql
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
__init__.py
.dockerignore
.env.example
.gitignore
agent.py
ARCHITECTURE.md
circuit_breaker.py
config.py
db_utils.py
deploy/0-upload-to-vm.ps1
deploy/1-build-push.ps1
deploy/2-setup-vm.sh
deploy/3-run-bot.sh
deploy/4-update-bot.sh
deploy/5-container-apps.sh
deploy/azure-pipelines.yml
deploy/env-vm.template
deploy/VM-DEPLOY.md
DEPLOYMENT.md
Dockerfile
eval_agent.py
eval_results_20260428_112945.json
eval_results_20260428_115039.json
eval_results_20260428_115849.json
extractor.py
litellm_config_clean.yaml
litellm_config.yaml
llm_client.py
main.py
mcp_client.py
mcp_server.py
migrar_datos.py
multi_agent.py
narrator.py
observability.py
pipeline.py
query_lotes.py
requirements.txt
server.py
sql_tools.py
start.ps1
state_backends.py
streaming.py
telegram_bot.py
tool_result.py
vectorstore.py
voice.py
```

# Files

## File: __init__.py
````python
"""
FrigoVoice AI — Sistema de Trazabilidad y Formularios por Voz
Agente LangChain con Tool Calling directo sobre SQL Server (sin RAG, sin ChromaDB).
"""
````

## File: .dockerignore
````
# Secretos - NUNCA copiar a la imagen
.env
.env.*
*.pem
*.key

# VCS
.git
.gitignore
.gitattributes

# Python build artifacts
__pycache__
*.pyc
*.pyo
*.pyd
.pytest_cache
.mypy_cache
.ruff_cache
.tox
.venv
venv
env

# Docker
Dockerfile
.dockerignore
docker-compose*.yml

# IDE
.vscode
.idea
*.swp
*.swo

# Docs / tests que no se ejecutan en produccion
tests
docs
*.md
!README.md

# Artefactos de ejecucion local
*.log
logs
data
tmp
````

## File: .gitignore
````
# Secrets — NUNCA subir a git
.env
*.env
*.env.frigo

# Llaves SSH / certificados de Azure VM
*.pem
*.key
*.pfx
*.p12

# Python
__pycache__/
*.py[cod]
*.pyo
venv/
.venv/
*.egg-info/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
Thumbs.db
.DS_Store

# Temp audio files
temp_audio.*

# Repomix output
repomix-output.xml
````

## File: agent.py
````python
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
    retry_if_exception_type,
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

# Ollama en A100 CEDIA — API compatible con OpenAI en /v1
# Tercer nivel: se usa directo si LiteLLM Y GitHub Models no están disponibles.
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
    """Construye el LLM con tres niveles de disponibilidad:

    1. LiteLLM proxy (localhost:4000) — si está corriendo.
       El proxy ya tiene su propia cadena Azure → Ollama texto → Ollama vision.
    2. GitHub Models directo — si GITHUB_TOKEN está configurado.
    3. Ollama directo en io.frigolab.dev — siempre disponible como último recurso.
       Usa la API compatible con OpenAI (/v1/chat/completions) de Ollama.
    """
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
    # Nivel 3 — Ollama directo en A100 CEDIA (API compatible con OpenAI)
    # Ollama expone /v1/chat/completions — funciona con ChatOpenAI sin cambios.
    log.warning(
        "agent: LiteLLM y GitHub Models no disponibles — usando Ollama directo en %s",
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
            retry=retry_if_exception_type(_TRANSIENT_LLM_EXCEPTIONS),
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

FLUJO DE PRODUCCION (en orden):
1. Fileteo (FOR-PD-04)
2. Liberacion de Tunel (FOR-PD-05)
3. Corte y Empaque (FOR-PD-06)
4. Control de Sellos (FOR-CC-10)
Un lote COMPLETO tiene registro en las 4 etapas. Si falta alguna, hay una brecha de QC.

TEMPERATURA: Congelados deben estar a -18 C o menos. Frio a 4 C o menos. Si hay valores fuera de rango, inicia la respuesta con ALERTA DE TEMPERATURA.

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
    return create_react_agent(model=llm, tools=_TOOLS_FASTAPI, prompt=SYSTEM_PROMPT)


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

_mcp_session = None
_mcp_ctx = None
_mcp_tools_list = None
_mcp_initialized = False
_mcp_lock = asyncio.Lock()


async def _ensure_mcp() -> bool:
    """Inicializa la sesión MCP si no está activa. Thread-safe con lock.

    Returns True si MCP está disponible, False si debe usar fallback SQL.
    """
    global _mcp_session, _mcp_ctx, _mcp_tools_list, _mcp_initialized

    if _mcp_initialized and _mcp_session is not None:
        return True

    if inyectar_herramientas_mcp is None:
        log.warning("mcp_client no importado — usando tools SQL directos.")
        _mcp_initialized = True
        return False

    async with _mcp_lock:
        # Double-check after acquiring lock
        if _mcp_initialized and _mcp_session is not None:
            return True
        try:
            llm = _build_llm(temperature=0.1)
            _, session, ctx, mcp_tools = await inyectar_herramientas_mcp(llm)
            _mcp_session = session
            _mcp_ctx = ctx
            _mcp_tools_list = mcp_tools
            _mcp_initialized = True
            log.info("MCP inicializado con %d herramientas: %s",
                     len(mcp_tools), [t.name for t in mcp_tools])
            return True
        except Exception as exc:
            log.warning("MCP no disponible (fallback SQL): %s", exc)
            _mcp_initialized = True
            return False


def _build_mcp_langchain_tools() -> list:
    """Construye tools LangChain que ejecutan via MCP session.

    Cada tool wrappea session.call_tool() para que LangGraph
    pueda usarlos como tools nativos con el agente ReAct.
    """
    if not _mcp_tools_list or not _mcp_session:
        return []

    from langchain_core.tools import StructuredTool

    tools = []
    for mcp_tool in _mcp_tools_list:
        # Capturamos session y tool_name en los defaults para evitar
        # el bug de closure-in-loop (cada iteracion reutilizaria la misma variable).
        session = _mcp_session
        tool_name = mcp_tool.name

        async def _run_mcp_tool(_tool_name=tool_name, _session=session, **kwargs) -> str:
            result = await ejecutar_tool_mcp(_session, _tool_name, kwargs)
            return result

        # Crear el tool LangChain
        lc_tool = StructuredTool.from_function(
            coroutine=_run_mcp_tool,
            name=tool_name,
            description=mcp_tool.description or tool_name,
        )
        tools.append(lc_tool)

    return tools


async def get_mcp_tools() -> list:
    """Retorna las tools MCP como tools LangChain, o fallback a SQL tools."""
    mcp_ok = await _ensure_mcp()
    if mcp_ok:
        mcp_tools = _build_mcp_langchain_tools()
        if mcp_tools:
            log.info("Usando %d herramientas MCP", len(mcp_tools))
            return mcp_tools
    log.info("Usando herramientas SQL directas (fallback)")
    return list(_TOOLS)


async def ejecutar_tool_via_mcp(tool_name: str, arguments: dict) -> str:
    """Ejecuta una herramienta a través del servidor MCP."""
    if _mcp_session is None:
        return "Error: Sesión MCP no inicializada."
    return await ejecutar_tool_mcp(_mcp_session, tool_name, arguments)


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
````

## File: ARCHITECTURE.md
````markdown
# FrigoVoice AI — Arquitectura Completa y Trazabilidad del Agente

> Sistema de inteligencia artificial con voz para Frigolab San Mateo.  
> Planta procesadora de productos del mar — Ecuador.

---

## Índice

1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Mapa de Módulos](#2-mapa-de-módulos)
3. [Fase 1 — Pipeline ETL (RAG)](#3-fase-1--pipeline-etl-rag)
4. [Fase 2 — Agente con Tool Calling](#4-fase-2--agente-con-tool-calling)
5. [Flujo Completo: Trazabilidad de un Lote](#5-flujo-completo-trazabilidad-de-un-lote)
6. [Flujo Completo: Llenado de Formulario por Voz](#6-flujo-completo-llenado-de-formulario-por-voz)
7. [Estructuras de Datos en Cada Etapa](#7-estructuras-de-datos-en-cada-etapa)
8. [Endpoints de la API (FastAPI)](#8-endpoints-de-la-api-fastapi)
9. [Motor de Decisión del Agente ReAct](#9-motor-de-decisión-del-agente-react)
10. [Análisis de Cada Herramienta (Tool)](#10-análisis-de-cada-herramienta-tool)
11. [Formularios: Estructura y Etapas de Llenado](#11-formularios-estructura-y-etapas-de-llenado)
12. [Esquema de Base de Datos Implícito](#12-esquema-de-base-de-datos-implícito)
13. [Diagrama de Secuencia — Consulta por Voz (Agente)](#13-diagrama-de-secuencia--consulta-por-voz-agente)
14. [Problemas Detectados y Mejoras Propuestas](#14-problemas-detectados-y-mejoras-propuestas)

---

## 1. Visión General del Sistema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRIGOVOICE AI v2.0                              │
│                                                                         │
│  ENTRADA                     CEREBRO                     SALIDA        │
│  ────────                   ──────────                  ────────       │
│  🎤 Audio WebM  ──►  Whisper STT  ──►  Agente LangChain  ──►  Texto   │
│  ⌨️  Texto      ──►  (directo)    ──►  (Mistral + Tools)  ──►  Voz    │
│                                         │                               │
│                              ┌──────────┴───────────┐                  │
│                              │    3 HERRAMIENTAS     │                  │
│                              │  ① buscar_trazabilidad│                  │
│                              │  ② crear_borrador     │                  │
│                              │  ③ listar_formularios  │                  │
│                              └──────────┬───────────┘                  │
│                                         │                               │
│                         ┌───────────────┴───────────────┐              │
│                         │         SQL Server             │              │
│                         │  FilledForms / Templates /     │              │
│                         │  FormDrafts                    │              │
│                         └───────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
```

El sistema tiene **dos fases** independientes pero complementarias:

| Fase | Nombre | Cuándo usar | Motor |
|------|--------|-------------|-------|
| **Fase 1** | RAG + ChromaDB | Consultas semánticas generales | Embeddings + LLM |
| **Fase 2** | Agente + Tool Calling | Queries precisas por lote; llenado de formularios | ReAct + SQL directo |

---

## 2. Mapa de Módulos

```
frigo-ai/
│
├── config.py          ← Variables de entorno y constantes globales
├── server.py          ← FastAPI: todos los endpoints HTTP (Fase 1 + Fase 2)
│
├── ── FASE 1: Pipeline ETL ──────────────────────────────────────────────
├── pipeline.py        ← Orquestador del ETL (extrae → narra → ingest)
├── extractor.py       ← Extrae FilledForms de SQL/API, agrupa por lote
├── narrator.py        ← Convierte eventos del lote en narrativa de texto
├── vectorstore.py     ← CRUD de ChromaDB (embeddings + búsqueda semántica)
├── llm_client.py      ← Cliente HTTP para Ollama (genera respuestas RAG)
│
├── ── FASE 2: Agente ────────────────────────────────────────────────────
├── agent.py           ← Agente LangChain ReAct (Tools + Ollama Mistral)
├── sql_tools.py       ← Implementaciones SQL de las 3 herramientas del agente
│
├── ── SHARED ────────────────────────────────────────────────────────────
├── voice.py           ← Transcripción de audio con OpenAI Whisper STT
│
└── requirements.txt   ← Dependencias Python
```

### Dependencias entre módulos

```
server.py
  ├── vectorstore.py ──► config.py
  ├── llm_client.py  ──► config.py
  ├── voice.py       ──► config.py
  ├── agent.py       ──► config.py
  │     └── sql_tools.py ──► config.py
  └── (pipeline endpoints)
        ├── extractor.py ──► config.py
        ├── narrator.py  ──► config.py
        └── vectorstore.py

pipeline.py (standalone CLI)
  ├── extractor.py
  ├── narrator.py
  └── vectorstore.py
```

---

## 3. Fase 1 — Pipeline ETL (RAG)

### Propósito
Precomputar narrativas de todos los lotes y almacenarlas en ChromaDB para búsqueda semántica rápida. Se ejecuta como batch (`python pipeline.py`) o vía endpoint `POST /api/ai/pipeline/run`.

### Las 3 Etapas del Pipeline

```
SQL Server / API REST
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  PASO 1: EXTRACTOR (extractor.py)                   │
│                                                     │
│  Input:  FilledForms (SQL o API)                    │
│  Output: historial_lotes = {                        │
│    "260302": [ evento1, evento2, ... ],             │
│    "260318": [ evento3, evento4, ... ],             │
│  }                                                  │
│                                                     │
│  Lógica interna:                                    │
│  1. Conecta SQL Server (pyodbc) o API (httpx)       │
│  2. Para cada formulario:                           │
│     a. Parsea HeaderData (JSON)                     │
│     b. Parsea BodyData (JSON)                       │
│     c. Busca campos de lote con regex patterns:     │
│        ^lote$, ^lote[\s_]proceso$, ^batch$, etc.    │
│     d. Si encuentra lote → construye evento         │
│     e. Agrupa por número de lote                    │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  PASO 2: NARRATOR (narrator.py)                     │
│                                                     │
│  Input:  historial_lotes                            │
│  Output: narratives = {                             │
│    "260302": "TRAZABILIDAD DEL LOTE 260302\n...",   │
│    "260318": "TRAZABILIDAD DEL LOTE 260318\n...",   │
│  }                                                  │
│                                                     │
│  Por cada lote:                                     │
│  1. Ordena eventos cronológicamente                 │
│  2. Extrae metadata global (especies, productos,    │
│     firmantes, procesos involucrados)               │
│  3. Construye bloque de encabezado                  │
│  4. Por cada evento → genera párrafo:               │
│     - Proceso + código del formulario               │
│     - Fecha + quién lo registró + rol               │
│     - Resumen del header (campos clave)             │
│     - Resumen del body (filas de tablas)            │
│  5. Concatena todo como texto plano                 │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  PASO 3: VECTORSTORE (vectorstore.py)               │
│                                                     │
│  Input:  narratives (dict lote → string texto)      │
│  Output: ChromaDB actualizado                       │
│                                                     │
│  Lógica:                                            │
│  1. Conecta ChromaDB persistente (./chroma_data)    │
│  2. Usa embedding: all-MiniLM-L6-v2                 │
│     (sentence-transformers, cosine similarity)      │
│  3. Por cada lote: upsert(id, document, metadata)   │
│     - id       = "lote_{numero}"                   │
│     - document = narrativa completa                 │
│     - metadata = {lote, tipo, chars}                │
│  4. Procesa en batches de 50 (límite ChromaDB)      │
└─────────────────────────────────────────────────────┘
       │
       ▼
    ChromaDB
  (./chroma_data)
```

### Consulta RAG (Fase 1, en tiempo real)

```
Usuario hace pregunta
       │
       ▼
POST /api/ai/query  (o /api/ai/voice)
       │
       ├─► vectorstore.search_by_lote(query, n=3)
       │         │
       │         └─► ChromaDB.query(embedding(query))
       │               Retorna top-3 narrativas más similares
       │
       ├─► llm_client.generate_response(query, context)
       │         │
       │         └─► POST http://localhost:11434/api/generate
       │               Ollama Mistral genera respuesta final
       │
       └─► Retorna { answer, sources }
```

---

## 4. Fase 2 — Agente con Tool Calling

### Arquitectura del Agente

```
┌──────────────────────────────────────────────────────────────────┐
│                    AGENTE REACT (agent.py)                       │
│                                                                  │
│  LLM: Ollama Mistral (ChatOllama)                                │
│  Framework: LangGraph create_react_agent                         │
│  Temperatura: 0.3 (determinístico)                               │
│                                                                  │
│  System Prompt: FrigoVoice — auditor experto en español          │
│  Contexto inyectado: fecha y hora actual                         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                     CICLO ReAct                          │    │
│  │                                                          │    │
│  │  Thought → Action → Observation → Thought → ... → Final │    │
│  │                                                          │    │
│  │  Iteraciones máximas: determinadas por LangGraph         │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  TOOLS                                                           │
│  ─────                                                           │
│  ① buscar_trazabilidad(numero_lote: str)                         │
│     └─► sql_tools.buscar_trazabilidad_lote()                     │
│                                                                  │
│  ② crear_borrador(nombre_formulario, datos_json, usuario)        │
│     └─► sql_tools.iniciar_llenado_formulario()                   │
│                                                                  │
│  ③ listar_formularios()                                          │
│     └─► sql_tools.obtener_templates_disponibles()                │
└──────────────────────────────────────────────────────────────────┘
```

### Ciclo de vida de una petición al Agente

```
run_agent(user_message, conversation_history)
│
├─ 1. get_agent()  → singleton (crea si no existe)
│
├─ 2. Construye lista de mensajes:
│      [HumanMessage(historial...), HumanMessage(user_message)]
│
├─ 3. agent.ainvoke({"messages": [...]})
│         │
│         │  LangGraph ReAct Loop:
│         │  ┌────────────────────────────────────────────────┐
│         │  │ Iteración 1:                                   │
│         │  │   LLM lee mensajes + system prompt             │
│         │  │   LLM decide: ¿qué tool llamar?                │
│         │  │   → AIMessage con tool_calls = [...]           │
│         │  │                                                │
│         │  │ Iteración 2:                                   │
│         │  │   LangGraph ejecuta la tool                    │
│         │  │   → ToolMessage(content = resultado SQL)       │
│         │  │                                                │
│         │  │ Iteración 3:                                   │
│         │  │   LLM lee ToolMessage                          │
│         │  │   → AIMessage final (respuesta para el usuario)│
│         │  └────────────────────────────────────────────────┘
│
├─ 4. Extrae de result["messages"]:
│      - tools_used   = [nombre de cada tool llamada]
│      - tool_results = [primeros 500 chars de cada ToolMessage]
│      - final_response = último AIMessage.content
│
└─ 5. Retorna { response, tools_used, tool_results }
```

---

## 5. Flujo Completo: Trazabilidad de un Lote

### Ejemplo: Usuario dice "¿Qué pasó con el lote 260302?"

```
[USUARIO]
  "¿Qué pasó con el lote 260302?"
         │
         ▼ (si es por voz)
[voice.py — transcribe_webm_bytes]
  Audio WebM → archivo .webm temporal → Whisper.transcribe()
  → "¿Qué pasó con el lote 260302?"
         │
         ▼
[server.py — POST /api/ai/agent/voice  o  /api/ai/agent/query]
  Llama a: run_agent("¿Qué pasó con el lote 260302?")
         │
         ▼
[agent.py — LLM Thought]
  El modelo razona:
  "El usuario pregunta por el lote 260302.
   Debo usar la herramienta buscar_trazabilidad."
         │
         ▼
[agent.py — Tool Call]
  buscar_trazabilidad(numero_lote="260302")
         │
         ▼
[sql_tools.py — buscar_trazabilidad_lote("260302")]
  │
  ├─ ETAPA A: Conecta SQL Server
  │
  ├─ ETAPA B: Query LIKE contra FilledForms
  │     SELECT FormID, TemplateID, HeaderData, BodyData,
  │            TemplateSnapshot, CreatedAt, FilledBy, FilledByRole,
  │            TipoProducto, Observaciones
  │     FROM FilledForms
  │     WHERE HeaderData LIKE '%260302%'
  │        OR BodyData   LIKE '%260302%'
  │     ORDER BY CreatedAt ASC
  │
  ├─ ETAPA C: Filtro preciso — _find_lote_in_json()
  │     Recorre el JSON recursivamente buscando campos cuyo
  │     key contenga "lote" y cuyo value == "260302"
  │
  ├─ ETAPA D: Para cada formulario que coincide:
  │     - Parsea TemplateSnapshot → {Codigo, Nombre, Proceso}
  │     - _extract_rows_with_lote(body, "260302")
  │       Busca tablas en BodyData cuyas filas contengan lote=260302
  │
  ├─ ETAPA E: Si no hay FilledForms → busca en FormDrafts
  │
  └─ ETAPA F: Construye narrativa estructurada:
       "TRAZABILIDAD DEL LOTE 260302
        Se encontró en 4 formulario(s):
        --- Paso 1: Recepción de Materia Prima (FOR-CC-42) ---
          Area: Calidad
          Fecha: 2024-03-26 08:15:00
          Registrado por: Ana García (Analista de Calidad)
          ...
        --- Paso 2: Control de Fileteo (FOR-CC-20) ---
          ..."
         │
         ▼
[agent.py — LLM Final Response]
  El modelo recibe el resultado de la tool y redacta la respuesta
  final en español natural, como auditor experto.
  Alerta temperaturas fuera de rango, señala quién firmó, etc.
         │
         ▼
[server.py — Retorna AgentResponse]
  {
    "message": "¿Qué pasó con el lote 260302?",
    "response": "El lote 260302 fue registrado el 26/03/2024...",
    "tools_used": ["buscar_trazabilidad"],
    "tool_results": ["TRAZABILIDAD DEL LOTE 260302..."]
  }
```

---

## 6. Flujo Completo: Llenado de Formulario por Voz

### Ejemplo: "Iniciando control de sellos máquina 2 lote 260318 temperatura 0.8"

```
[USUARIO]
  "Iniciando control de sellos máquina 2 lote 260318 temperatura 0.8"
         │
         ▼ (voice STT)
[voice.py — transcribe_webm_bytes]
  → texto transcrito
         │
         ▼
[agent.py — LLM Thought]
  Razona: "El usuario quiere llenar el formulario de control de sellos.
  Los datos que menciona son:
  - formulario: control de sellos
  - maquina: 2 (VC999#2 o Máquina 2)
  - lote: 260318
  - temperatura: 0.8"
         │
         ▼
[agent.py — Tool Call]
  crear_borrador(
    nombre_formulario = "control de sellos",
    datos_json = '{"lote":"260318","maquina":"2","temperatura":"0.8"}',
    usuario = "Operador FrigoVoice"
  )
         │
         ▼
[agent.py — wrapper crear_borrador()]
  json.loads(datos_json) → datos = {"lote":"260318",...}
  Llama: iniciar_llenado_formulario("control de sellos", datos, usuario)
         │
         ▼
[sql_tools.py — iniciar_llenado_formulario()]
  │
  ├─ ETAPA 1: obtener_esquema_template("control de sellos")
  │     │
  │     ├─ Intenta match por código exacto:
  │     │    SELECT * FROM Templates WHERE Codigo = 'CONTROL DE SELLOS'
  │     │    → no encontrado
  │     │
  │     └─ Fuzzy search por nombre:
  │          SELECT * FROM Templates
  │          WHERE LOWER(Nombre) LIKE '%control de sellos%'
  │          → Encuentra: FOR-CC-10, "Control de Sellos (Empacado al Vacío)"
  │
  ├─ ETAPA 2: Mapeo al Header
  │     Por cada campo en template["header_fields"]:
  │       _match_field_to_data(label, type, datos)
  │       │
  │       └─ keyword_map lookup:
  │            "lote"       → datos["lote"]       = "260318"
  │            "maquina"    → datos["maquina"]     = "2"
  │            "temperatura"→ datos["temperatura"] = "0.8"
  │            "fecha"      → datetime.now()       = "2024-03-26" (auto)
  │            "hora"       → "" (no especificado)
  │       header_data = {
  │         "Lote de Proceso": "260318",
  │         "Máquina": "2",
  │         "Fecha": "2024-03-26",
  │         "Hora Inicio": "",
  │         ...
  │       }
  │
  ├─ ETAPA 3: Mapeo al Body
  │     Por cada elemento en template["body_elements"]:
  │       Si type == "table":
  │         Para cada columna: _match_field_to_data()
  │         Primera fila con datos, + 9 filas vacías
  │       Si type == "section":
  │         Mapea campos de la sección
  │       Si type == "observaciones":
  │         Vacío
  │
  ├─ ETAPA 4: Estructura de Firmas vacías
  │     Por cada puesto en Firmas del template:
  │     firmas_data = {
  │       "Analista de Calidad": {"nombre":"","fecha":"","hora":"","email":""},
  │       "Supervisor": {...}
  │     }
  │
  ├─ ETAPA 5: Construye TemplateSnapshot (espejo del template)
  │
  └─ ETAPA 6: POST /api/FormDrafts
       Payload completo → backend .NET guarda en FormDrafts
       Respuesta: { draftID: 42 }
       │
       └─ Construye mensaje de confirmación:
            "Borrador creado exitosamente.
             ID del borrador: 42
             Formulario: Control de Sellos (FOR-CC-10)
             Área: Calidad
             Datos prellenados:
               - Lote de Proceso: 260318
               - Máquina: 2
               - Temperatura: 0.8
               - Fecha: 2024-03-26
             El operador puede completar el formulario en 'Mis Borradores'."
         │
         ▼
[agent.py — LLM Final Response]
  Resume y confirma al operador qué se registró y qué falta.
```

---

## 7. Estructuras de Datos en Cada Etapa

### 7.1 Evento del Extractor (historial_lotes)

```python
{
    "form_id": 33,
    "template_id": 5,
    "template_codigo": "FOR-CC-10",
    "template_nombre": "Control de sellos (Empacado al Vacío)",
    "proceso": "Calidad",
    "created_at": datetime(2024, 3, 26, 10, 15),
    "filled_by": "Ana García",
    "filled_by_role": "Analista de Calidad",
    "tipo_producto": "Filete de Tilapia",
    "header_data": {
        "Fecha": "2024-03-26",
        "Lote de Proceso": "260302",
        "Máquina": "VC999#2",
        "Turno": "Mañana"
    },
    "body_summary": [
        {"Hora": "10:15", "Temperatura": "0.8", "Sello": "Satisfactorio"},
        {"Hora": "10:30", "Temperatura": "1.2", "Sello": "Satisfactorio"},
    ],
    "lotes_encontrados": [("260302", "BodyData[0].data[0].Lote")]
}
```

### 7.2 Narrativa del Narrator (texto plano para ChromaDB)

```
TRAZABILIDAD DEL LOTE 260302
Fecha de inicio: 26/03/2024
Especie(s): Tilapia
Producto(s): Filete de Tilapia
Procesos involucrados: Recepción de Materia Prima -> Control de Fileteo -> Control de Sellos
Total de registros: 3

--- Paso 1: Recepción de Materia Prima (FOR-CC-42) ---
Registrado el 26/03/2024 a las 07:00 por Carlos López (Operador).
Datos del encabezado: Fecha: 2024-03-26, Proveedor: Pesquero El Mar, Peso: 500 kg
Datos registrados:
  - Temperatura: 2.5, Clasificación: A, Observaciones: Sin novedad

--- Paso 2: Control de Sellos (Empacado al Vacío) (FOR-CC-10) ---
Registrado el 26/03/2024 a las 10:15 por Ana García (Analista de Calidad).
...

Responsables involucrados: Carlos López, Ana García
```

### 7.3 Borrador de Formulario (FormDraft payload)

```json
{
  "templateID": 5,
  "templateName": "Control de Sellos (Empacado al Vacío)",
  "templateCodigo": "FOR-CC-10",
  "userName": "Operador FrigoVoice",
  "userEmail": "",
  "userRole": "operador",
  "headerData": "{\"Lote de Proceso\":\"260318\",\"Máquina\":\"2\",\"Fecha\":\"2024-03-26\"}",
  "bodyData": "[{\"id\":1,\"type\":\"table\",\"data\":[{\"Hora\":\"\",\"Temperatura\":\"0.8\",\"Sello\":\"\"},{...vacío x9}]}]",
  "firmasData": "{\"Analista de Calidad\":{\"nombre\":\"\",\"fecha\":\"\",\"hora\":\"\",\"email\":\"\"}}",
  "templateSnapshot": "{\"TemplateID\":5,\"Codigo\":\"FOR-CC-10\",...}",
  "progress": 10,
  "nota": "Borrador creado por FrigoVoice AI desde dictado de voz"
}
```

### 7.4 Respuesta del Agente

```python
{
    "response": "He creado el borrador del formulario FOR-CC-10...",
    "tools_used": ["crear_borrador"],
    "tool_results": ["Borrador creado exitosamente.\n  ID: 42\n..."]
}
```

---

## 8. Endpoints de la API (FastAPI)

### FASE 1 — RAG + ChromaDB

| Método | Endpoint | Descripción | Módulos usados |
|--------|----------|-------------|---------------|
| `POST` | `/api/ai/query` | Consulta por texto → RAG → LLM | vectorstore + llm_client |
| `POST` | `/api/ai/voice` | Audio → Whisper → RAG → LLM | voice + vectorstore + llm_client |
| `POST` | `/api/ai/audit/{lote}` | Reporte de auditoría por lote | vectorstore + llm_client |
| `GET`  | `/api/ai/lote/{lote}` | Narrativa raw de un lote | vectorstore |
| `GET`  | `/api/ai/search?q=...&n=5` | Búsqueda semántica | vectorstore |
| `GET`  | `/api/ai/stats` | Total documentos en ChromaDB | vectorstore |
| `POST` | `/api/ai/pipeline/run?source=api` | Ejecuta ETL completo | extractor + narrator + vectorstore |

### FASE 2 — Agente con Tool Calling

| Método | Endpoint | Descripción | Módulos usados |
|--------|----------|-------------|---------------|
| `POST` | `/api/ai/agent/query` | Texto → Agente → Tool(s) → Respuesta | agent + sql_tools |
| `POST` | `/api/ai/agent/voice` | Audio → Whisper → Agente → Tool(s) | voice + agent + sql_tools |

### Modelos de Request/Response

```python
# Fase 2 - Request
AgentRequest = { message: str, conversation_history: list[dict] | None }

# Fase 2 - Response (texto)
AgentResponse = {
    message: str,         # Mensaje original del usuario
    response: str,        # Respuesta final del agente
    tools_used: list[str],
    tool_results: list[str]
}

# Fase 2 - Response (voz)
AgentVoiceResponse = {
    transcription: str,
    response: str,
    tools_used: list[str],
    tool_results: list[str]
}
```

---

## 9. Motor de Decisión del Agente ReAct

El agente analiza el mensaje del usuario y decide qué herramienta invocar basándose en el System Prompt:

```
¿El usuario menciona un número de lote?
  ├─ SÍ → buscar_trazabilidad(numero_lote)
  │         Palabras clave: "lote", "trazabilidad", "historia", "pasó con",
  │                         "dónde está", "dame", número de 6 dígitos
  │
  └─ NO → ¿El usuario quiere llenar/registrar/iniciar un formulario?
              ├─ SÍ → crear_borrador(nombre_formulario, datos_json)
              │         Palabras clave: "iniciando", "registrar", "llenar",
              │                         "control de", "fileteo", "recepción",
              │                         nombres de procesos productivos
              │
              └─ NO → ¿El usuario pregunta qué formularios hay?
                          ├─ SÍ → listar_formularios()
                          │         Palabras clave: "qué formularios", "cuáles hay",
                          │                         "disponibles", "códigos"
                          │
                          └─ NO → Responde directamente (saludo, aclaración, etc.)
```

### Ejemplos de frases y herramientas activadas

| Frase del usuario | Herramienta | Parámetros |
|-------------------|-------------|------------|
| "dame la trazabilidad del lote 260302" | `buscar_trazabilidad` | `numero_lote="260302"` |
| "qué pasó con el lote 260318" | `buscar_trazabilidad` | `numero_lote="260318"` |
| "iniciando control de sellos máquina 2 lote 260318" | `crear_borrador` | `nombre="control de sellos"`, `datos={lote,maquina}` |
| "registrar fileteo del lote 260302" | `crear_borrador` | `nombre="fileteo"`, `datos={lote}` |
| "qué formularios hay disponibles" | `listar_formularios` | — |
| "hola, ¿qué puedes hacer?" | (sin tool) | respuesta directa |

---

## 10. Análisis de Cada Herramienta (Tool)

### Tool ①: `buscar_trazabilidad`

```
Definición en agent.py (wrapper @tool):
  buscar_trazabilidad(numero_lote: str) → str

Implementación en sql_tools.py:
  buscar_trazabilidad_lote(numero_lote: str) → str

PIPELINE INTERNO:
  ┌─────────────────────────────────────────────────┐
  │ 1. Validar: numero_lote no vacío                │
  │ 2. Abrir conexión SQL Server (pyodbc)           │
  │ 3. SELECT ... FROM FilledForms                  │
  │    WHERE HeaderData LIKE '%{lote}%'             │
  │       OR BodyData   LIKE '%{lote}%'             │
  │    ORDER BY CreatedAt ASC                       │
  │ 4. Filtro preciso: _find_lote_in_json()         │
  │    - Recorre JSON recursivo                     │
  │    - keys: "lote" en nombre del campo           │
  │    - values: exactamente == numero_lote         │
  │ 5. Por cada match: _extract_rows_with_lote()   │
  │    - Busca tablas en BodyData                   │
  │    - Extrae filas donde lote == numero_lote     │
  │ 6. Si no hay FilledForms → busca FormDrafts     │
  │ 7. Construye string narrativo por pasos         │
  └─────────────────────────────────────────────────┘

Fallback API:
  buscar_trazabilidad_lote_api(numero_lote) → str
  (async, usa httpx, mismo filtrado pero via REST)
```

### Tool ②: `crear_borrador`

```
Definición en agent.py:
  crear_borrador(nombre_formulario, datos_json, usuario) → str

Implementación en sql_tools.py:
  iniciar_llenado_formulario(nombre, datos, usuario) → str

PIPELINE INTERNO:
  ┌─────────────────────────────────────────────────┐
  │ 1. obtener_esquema_template(nombre_formulario)  │
  │    a. Busca por código exacto en Templates      │
  │    b. Si no → fuzzy LIKE por nombre             │
  │    c. Retorna: {header_fields, body_elements,   │
  │                 firmas, template_id, ...}       │
  │                                                 │
  │ 2. Mapear datos al Header                       │
  │    Por cada field en header_fields:             │
  │    _match_field_to_data(label, type, datos)     │
  │    keyword_map: lote→lote, maquina→maquina,...  │
  │    auto-fill fechas con datetime.now()          │
  │                                                 │
  │ 3. Mapear datos al Body                         │
  │    Por cada element en body_elements:           │
  │    • table: crea 10 filas (1 prellenada + 9)    │
  │    • section: mapea campos de sección           │
  │    • observaciones: vacío                       │
  │                                                 │
  │ 4. Crear estructura de Firmas vacías            │
  │                                                 │
  │ 5. Serializar todo a JSON strings               │
  │                                                 │
  │ 6. POST {API_BASE_URL}/FormDrafts               │
  │    → Retorna draftID                            │
  │                                                 │
  │ 7. Construye mensaje de confirmación            │
  │    con campos prellenados y pendientes          │
  └─────────────────────────────────────────────────┘
```

### Tool ③: `listar_formularios`

```
Definición en agent.py:
  listar_formularios() → str

Implementación en sql_tools.py:
  obtener_templates_disponibles() → str

PIPELINE INTERNO:
  ┌─────────────────────────────────────────────────┐
  │ 1. SELECT TemplateID, Codigo, Nombre, Proceso,  │
  │          QuienLoLlena                           │
  │    FROM Templates                               │
  │    WHERE IsObsolete = 0 AND IsDraft = 0         │
  │    ORDER BY Codigo                              │
  │                                                 │
  │ 2. Formatea lista legible:                      │
  │    "- ID:5 | FOR-CC-10 | Control de Sellos |   │
  │      Area: Calidad | Llena: Analista"           │
  └─────────────────────────────────────────────────┘
```

---

## 11. Formularios: Estructura y Etapas de Llenado

### Ciclo de vida de un formulario

```
ESTADO 1: Template (plantilla)
  Templates → {Codigo, Nombre, HeaderFields (JSON), BodyElements (JSON), Firmas (JSON)}
       │
       │ (usuario inicia llenado — manual o por voz)
       ▼
ESTADO 2: FormDraft (borrador)
  FormDrafts → {DraftID, TemplateID, TemplateName, TemplateCodigo,
                UserName, HeaderData, BodyData, FirmasData,
                TemplateSnapshot, Progress %, Nota, IsActive, CreatedAt}
       │
       │ (usuario completa y envía)
       ▼
ESTADO 3: FilledForm (formulario completado)
  FilledForms → {FormID, TemplateID, HeaderData, BodyData,
                 TemplateSnapshot, FilledBy, FilledByRole,
                 TipoProducto, Observaciones, CreatedAt}
```

### Formularios disponibles (config.py)

| Código | Nombre del Proceso | Área |
|--------|-------------------|------|
| FOR-CC-42 | Recepción de Materia Prima | Calidad |
| FOR-CC-20 | Control de Fileteo para Congelación | Producción |
| FOR-CC-10 | Control de Sellos (Empacado al Vacío) | Calidad |
| FOR-CC-06 | Control de Empaque Final | Producción |
| FOR-CC-04 | Control de Temperatura en Cámaras | Calidad |
| FOR-CC-08 | Control de Limpieza y Desinfección | Calidad |
| FOR-CC-12 | Control de Glaseo | Producción |
| FOR-CC-14 | Control de Peso | Calidad |

### Estructura interna del BodyElements (JSON)

```json
[
  {
    "id": 1,
    "type": "table",
    "columns": [
      {"label": "Hora", "type": "time"},
      {"label": "Temperatura", "type": "number"},
      {"label": "Sello", "type": "select", "options": ["Satisfactorio", "No Conforme"]},
      {"label": "Máquina", "type": "text"},
      {"label": "Observaciones", "type": "text"}
    ],
    "data": []
  },
  {
    "id": 2,
    "type": "section",
    "fields": [
      {"label": "Lote de Proceso", "type": "text"},
      {"label": "Producto", "type": "text"},
      {"label": "Turno", "type": "select"}
    ]
  },
  {
    "id": 3,
    "type": "observaciones"
  }
]
```

### Mapeo de voz a campos del formulario (_match_field_to_data)

```
Campos del formulario    Palabras clave detectadas en voz
─────────────────────    ─────────────────────────────────
Fecha                 ←  fecha
Hora / Hora Inicio    ←  hora, hora_inicio, hora_final
Lote de Proceso       ←  lote, lote_proceso, numero_lote
Máquina               ←  maquina, tipo_maquina
Producto/Presentación ←  producto, presentacion, tipo_producto
Especie               ←  especie
Temperatura           ←  temperatura
Peso / Peso Neto      ←  peso, peso_neto, total_lbs
% Glaseo              ←  glaseo, porcentaje_glaseo
Cajas / Total Cajas   ←  caja, cajas, total_cajas
Tinas                 ←  tina, tinas
Turno                 ←  turno
Observaciones         ←  observacion, observaciones
Empaques Inspeccionados← empaques, empaques_inspeccionados
Sellos                ←  sellos, sellos_satisfactorios
No. Rollo             ←  rollo, rollo_numero
Inspección            ←  inspeccion, prueba
```

---

## 12. Esquema de Base de Datos Implícito

```sql
-- Plantillas de formularios
CREATE TABLE Templates (
    TemplateID      INT         PRIMARY KEY,
    Codigo          VARCHAR(20) NOT NULL,   -- "FOR-CC-10"
    Nombre          VARCHAR(200),
    Version         VARCHAR(10),
    Proceso         VARCHAR(100),
    QuienLoLlena    VARCHAR(100),
    HeaderFields    NVARCHAR(MAX),          -- JSON array de campos del header
    BodyElements    NVARCHAR(MAX),          -- JSON array de tablas/secciones
    Firmas          NVARCHAR(MAX),          -- JSON array de firmantes requeridos
    IsObsolete      BIT DEFAULT 0,
    IsDraft         BIT DEFAULT 0
);

-- Formularios completados
CREATE TABLE FilledForms (
    FormID           INT          PRIMARY KEY IDENTITY,
    TemplateID       INT,
    HeaderData       NVARCHAR(MAX),          -- JSON con valores del encabezado
    BodyData         NVARCHAR(MAX),          -- JSON con tablas/secciones llenadas
    TemplateSnapshot NVARCHAR(MAX),          -- Copia del template al momento de llenar
    FilledBy         VARCHAR(200),
    FilledByRole     VARCHAR(100),
    TipoProducto     VARCHAR(200),
    Observaciones    NVARCHAR(MAX),
    CreatedAt        DATETIME DEFAULT GETDATE()
);

-- Borradores en progreso (por voz o manual)
CREATE TABLE FormDrafts (
    DraftID           INT         PRIMARY KEY IDENTITY,
    TemplateID        INT,
    TemplateName      VARCHAR(200),
    TemplateCodigo    VARCHAR(20),
    UserName          VARCHAR(200),
    UserEmail         VARCHAR(200),
    HeaderData        NVARCHAR(MAX),
    BodyData          NVARCHAR(MAX),
    FirmasData        NVARCHAR(MAX),
    TemplateSnapshot  NVARCHAR(MAX),
    Progress          INT,                  -- % de completitud
    Nota              NVARCHAR(500),
    IsActive          BIT DEFAULT 1,
    CreatedAt         DATETIME DEFAULT GETDATE()
);
```

---

## 13. Diagrama de Secuencia — Consulta por Voz (Agente)

```
Operador    Browser    FastAPI     Whisper    LangGraph    Ollama     SQL Server
   │           │          │           │           │           │           │
   │──Audio───►│          │           │           │           │           │
   │           │──WebM───►│           │           │           │           │
   │           │          │──bytes───►│           │           │           │
   │           │          │          │transcribe  │           │           │
   │           │          │◄──texto──│           │           │           │
   │           │          │──texto──────────────►│           │           │
   │           │          │          │         ainvoke        │           │
   │           │          │          │           │──prompt───►│           │
   │           │          │          │           │◄─tool_call─│           │
   │           │          │          │           │──SQL──────────────────►│
   │           │          │          │           │◄──resultados──────────│
   │           │          │          │           │──resultado─►│          │
   │           │          │          │           │◄──respuesta─│          │
   │           │          │◄─────────────────────│           │           │
   │           │◄─response─│          │           │           │           │
   │◄──texto───│          │           │           │           │           │
   │  (TTS en  │          │           │           │           │           │
   │  browser) │          │           │           │           │           │
```

---

## 14. Problemas Detectados y Mejoras Propuestas

### Problemas detectados

| # | Archivo | Problema | Impacto |
|---|---------|---------|---------|
| 1 | `sql_tools.py` | `buscar_trazabilidad_lote_api` es `async` pero se llama desde código sync (agent.py espera strings) | Potencial error si se usa como fallback |
| 2 | `agent.py` | La instancia del agente es singleton global. Si el System Prompt cambia de fecha (se formatea al crear), el agente puede quedar con fecha obsoleta en memoria | Solo se recrea al reiniciar el servidor |
| 3 | `sql_tools.py` | En `crear_borrador`, las tablas siempre generan 10 filas (1 prellenada + 9 vacías). Si el template necesita más o menos, esto no es configurable | Inflexibilidad en formularios |
| 4 | `server.py` | CORS permite `"*"` → cualquier origen puede llamar la API | Riesgo de seguridad en producción |
| 5 | `sql_tools.py` | Las queries LIKE `%lote%` pueden ser lentas en tablas grandes sin índices Full-Text | Performance degradada con muchos registros |
| 6 | `agent.py` | `tool_results` truncados a 500 chars — el LLM no ve el resultado completo de trazabilidades largas | Respuestas incompletas |
| 7 | `voice.py` | `transcribe_webm_bytes` usa archivos temporales que se borran con `os.unlink` pero no hay cleanup si Whisper falla antes del `finally` | Archivos temporales huérfanos |

### Mejoras propuestas

```python
# 1. Regenerar System Prompt en cada llamada (no solo al crear el agente)
async def run_agent(user_message: str, ...):
    agent = get_agent()
    # Inyectar fecha fresca por mensaje
    dated_message = f"[{datetime.now().strftime('%d/%m/%Y %H:%M')}] {user_message}"
    ...

# 2. Límite configurable de filas en borrador
def iniciar_llenado_formulario(..., num_filas: int = 10):
    rows = [row] + [empty_row.copy() for _ in range(num_filas - 1)]

# 3. CORS restrictivo en producción
app.add_middleware(CORSMiddleware,
    allow_origins=["https://frigolab.com", "http://localhost:5173"],
    ...
)

# 4. Índice Full-Text en SQL Server para mejorar búsquedas
# CREATE FULLTEXT INDEX ON FilledForms(HeaderData, BodyData)
# ...luego usar CONTAINS en lugar de LIKE

# 5. Pasar resultados completos al LLM (no truncados a 500)
tool_results.append(msg.content)  # Quitar el [:500]
```

---

## Resumen ejecutivo del flujo completo

```
FLUJO TRAZABILIDAD          FLUJO FORMULARIO POR VOZ
───────────────────         ────────────────────────
🎤 Voz/Texto                🎤 Voz/Texto
     ↓                           ↓
  Whisper STT              Whisper STT
     ↓                           ↓
  FastAPI                    FastAPI
     ↓                           ↓
  LangChain                 LangChain
  ReAct Agent               ReAct Agent
     ↓                           ↓
  Tool: buscar_trazabilidad  Tool: crear_borrador
     ↓                           ↓
  SQL Server                SQL Server (Templates)
  FilledForms               + API REST (FormDrafts)
     ↓                           ↓
  Narrativa estructurada     Borrador prellenado
     ↓                           ↓
  LLM redacta respuesta      LLM confirma datos
     ↓                           ↓
  Texto en español 🗣️         Texto en español 🗣️
  (TTS en frontend)          (TTS en frontend)
```
````

## File: circuit_breaker.py
````python
"""
circuit_breaker.py - Filtro de ruido industrial + Circuit Breaker para Whisper

Problema: En una planta de pescado, Whisper recibirá ruido de motores de
refrigeración, compresores, sierras de corte. Enviar ese ruido a Claude/GPT-4o
gasta tokens, genera respuestas sin sentido y congela al agente.

Solución: Un filtro rápido POST-Whisper que evalúa la transcripción
ANTES de enviarla al LLM. Si detecta ruido, aborta el flujo en <100ms
y devuelve una respuesta pregrabada.

Flujo:
  Audio → Whisper → CircuitBreaker.evaluate() → { PASS | REJECT }
       PASS   → LangGraph Agent (gasta tokens)
       REJECT → Respuesta pregrabada instantánea (0 tokens, 0 latencia)
"""
from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from enum import Enum

log = logging.getLogger(__name__)


class TranscriptionVerdict(Enum):
    """Resultado de la evaluación del circuit breaker."""
    PASS = "pass"                    # Transcripción válida → enviar al agente
    REJECT_EMPTY = "reject_empty"    # Whisper no devolvió nada
    REJECT_TOO_SHORT = "reject_short"  # Menos de 3 palabras significativas
    REJECT_NOISE = "reject_noise"    # Patrón de ruido detectado
    REJECT_REPETITION = "reject_repetition"  # Repetición sin sentido (alucinación de Whisper)


# Respuestas pregrabadas por tipo de rechazo (instantáneas, 0 tokens)
CACHED_RESPONSES: dict[TranscriptionVerdict, str] = {
    TranscriptionVerdict.REJECT_EMPTY: (
        "No te copié, parece que el micrófono no captó tu voz. "
        "Acércate al micrófono y repite por favor."
    ),
    TranscriptionVerdict.REJECT_TOO_SHORT: (
        "No te copié bien, hay mucho ruido. "
        "Repite tu mensaje más despacio, por favor."
    ),
    TranscriptionVerdict.REJECT_NOISE: (
        "Detecté solo ruido de fondo, no pude distinguir tu voz. "
        "Aléjate de la maquinaria y vuelve a intentarlo."
    ),
    TranscriptionVerdict.REJECT_REPETITION: (
        "Parece que hubo interferencia en el audio. "
        "Repite tu mensaje por favor."
    ),
}


# Patrones que Whisper genera cuando recibe ruido puro
_NOISE_PATTERNS: list[re.Pattern] = [
    re.compile(r'^\.+$'),                              # Solo puntos "....."
    re.compile(r'^[,.\s]+$'),                          # Solo puntuación
    re.compile(r'(?i)^(eh|ah|oh|um|uh|mm|hmm)[\s.]*$'),  # Solo muletillas
    re.compile(r'(?i)^gracias por ver'),               # Alucinación común de Whisper
    re.compile(r'(?i)^suscr[ií]bete'),                 # Alucinación de YouTube
    re.compile(r'(?i)^thank'),                         # Whisper cambia a inglés con ruido
    re.compile(r'(?i)^music$'),                        # Tag de música
    re.compile(r'(?i)^\[.*\]$'),                       # Tags como [Música], [Aplausos]
    re.compile(r'(?i)^subtítulos'),                    # Alucinación de subtítulos
    re.compile(r'(?i)^you$'),                          # Alucinación corta en inglés
]

# Palabras vacías que no cuentan como contenido real
_STOP_WORDS: set[str] = {
    "el", "la", "los", "las", "de", "del", "en", "un", "una", "y", "o",
    "a", "es", "que", "por", "con", "para", "se", "no", "lo", "le",
    "me", "te", "su", "al", "mi", "si", "ya", "ha", "he", "eh", "ah",
    "oh", "um", "uh", "mm", "hmm", "este", "esto", "eso", "esa",
}


@dataclass
class CircuitBreaker:
    """Filtro post-Whisper para detectar ruido industrial y alucinaciones.

    Evalúa la transcripción en microsegundos. Si la rechaza, el flujo
    se detiene ANTES de llamar al LLM, ahorrando tokens y latencia.

    Attributes:
        min_meaningful_words: Mínimo de palabras significativas para aceptar.
        max_repetition_ratio: Si >70% del texto es una palabra repetida → ruido.
        consecutive_rejects: Contador de rechazos consecutivos.
        max_consecutive_rejects: Si se superan, sugerir ayuda técnica.
    """
    min_meaningful_words: int = 3
    max_repetition_ratio: float = 0.7
    consecutive_rejects: int = field(default=0, init=False)
    max_consecutive_rejects: int = 5

    def evaluate(self, transcription: str | None) -> tuple[TranscriptionVerdict, str]:
        """Evalúa una transcripción de Whisper.

        Args:
            transcription: Texto devuelto por Whisper (puede ser None o vacío).

        Returns:
            Tuple de (veredicto, mensaje_para_operario).
            Si veredicto es PASS, el mensaje está vacío y se debe enviar al LLM.
        """
        start = time.perf_counter_ns()

        # Check 1: vacío
        if not transcription or not transcription.strip():
            self._record_reject()
            elapsed_us = (time.perf_counter_ns() - start) / 1000
            log.info("CircuitBreaker: REJECT_EMPTY en %.0fμs", elapsed_us)
            return TranscriptionVerdict.REJECT_EMPTY, self._get_response(
                TranscriptionVerdict.REJECT_EMPTY
            )

        text = transcription.strip()

        # Check 2: patrones de ruido conocidos
        for pattern in _NOISE_PATTERNS:
            if pattern.match(text):
                self._record_reject()
                elapsed_us = (time.perf_counter_ns() - start) / 1000
                log.info(
                    "CircuitBreaker: REJECT_NOISE '%s' en %.0fμs",
                    text[:40], elapsed_us,
                )
                return TranscriptionVerdict.REJECT_NOISE, self._get_response(
                    TranscriptionVerdict.REJECT_NOISE
                )

        # Check 3: muy pocas palabras significativas
        words = text.lower().split()
        meaningful = [w for w in words if w.strip(".,;:!?") not in _STOP_WORDS and len(w) > 1]

        if len(meaningful) < self.min_meaningful_words:
            self._record_reject()
            elapsed_us = (time.perf_counter_ns() - start) / 1000
            log.info(
                "CircuitBreaker: REJECT_SHORT (%d palabras sig.) '%s' en %.0fμs",
                len(meaningful), text[:40], elapsed_us,
            )
            return TranscriptionVerdict.REJECT_TOO_SHORT, self._get_response(
                TranscriptionVerdict.REJECT_TOO_SHORT
            )

        # Check 4: repetición excesiva (alucinación de Whisper)
        if len(words) >= 4:
            word_counts = {}
            for w in words:
                clean = w.strip(".,;:!?").lower()
                word_counts[clean] = word_counts.get(clean, 0) + 1

            max_count = max(word_counts.values())
            if max_count / len(words) > self.max_repetition_ratio:
                self._record_reject()
                elapsed_us = (time.perf_counter_ns() - start) / 1000
                log.info(
                    "CircuitBreaker: REJECT_REPETITION '%s' en %.0fμs",
                    text[:40], elapsed_us,
                )
                return TranscriptionVerdict.REJECT_REPETITION, self._get_response(
                    TranscriptionVerdict.REJECT_REPETITION
                )

        # Pasa todos los checks → enviar al agente
        self.consecutive_rejects = 0
        elapsed_us = (time.perf_counter_ns() - start) / 1000
        log.debug("CircuitBreaker: PASS '%s' en %.0fμs", text[:40], elapsed_us)
        return TranscriptionVerdict.PASS, ""

    def _record_reject(self) -> None:
        """Incrementa el contador de rechazos consecutivos."""
        self.consecutive_rejects += 1
        if self.consecutive_rejects >= self.max_consecutive_rejects:
            log.warning(
                "CircuitBreaker: %d rechazos consecutivos. "
                "Posible problema de hardware (micrófono) o entorno extremo.",
                self.consecutive_rejects,
            )

    def _get_response(self, verdict: TranscriptionVerdict) -> str:
        """Obtiene la respuesta pregrabada, con hint adicional si hay muchos rechazos."""
        base = CACHED_RESPONSES.get(verdict, "No te copié. Repite por favor.")
        if self.consecutive_rejects >= self.max_consecutive_rejects:
            return (
                f"{base}\n\n"
                "Nota: He tenido varios intentos fallidos seguidos. "
                "Verifica que tu micrófono funcione correctamente o "
                "intenta enviar un mensaje de texto."
            )
        return base


# Instancia global del circuit breaker (thread-safe: solo lectura + un int)
whisper_circuit_breaker = CircuitBreaker()
````

## File: config.py
````python
"""
config.py - Configuracion centralizada del sistema
"""
import os
from dotenv import load_dotenv

load_dotenv()

# API
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:5074/api")

# GitHub Models (LLM / Cerebro)
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_MODEL = os.getenv("GITHUB_MODEL", "gpt-4o-mini")

# Azure OpenAI — STT (Whisper)
AZURE_STT_KEY        = os.getenv("AZURE_STT_KEY")
AZURE_STT_ENDPOINT   = os.getenv("AZURE_STT_ENDPOINT")
AZURE_STT_DEPLOYMENT = os.getenv("AZURE_STT_DEPLOYMENT", "whisper")

# Azure OpenAI — TTS (gpt-4o-mini-tts)
AZURE_TTS_KEY        = os.getenv("AZURE_TTS_KEY")
AZURE_TTS_ENDPOINT   = os.getenv("AZURE_TTS_ENDPOINT")
AZURE_TTS_DEPLOYMENT = os.getenv("AZURE_TTS_DEPLOYMENT", "gpt-4o-mini-tts")

# Azure PostgreSQL (motor principal de produccion)
PG_DATABASE_URL = os.getenv("PG_DATABASE_URL")  # postgresql://user:pass@host:5432/db

# LangSmith — Observabilidad y trazas end-to-end
LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY")
LANGSMITH_PROJECT = os.getenv("LANGSMITH_PROJECT", "frigovoice-production")

# Mapeo de codigos de template a nombre legible (referencia informativa)
TEMPLATE_PROCESS_MAP = {
    "FOR-CC-42": "Recepcion de Materia Prima",
    "FOR-CC-20": "Control de Fileteo para Congelacion",
    "FOR-CC-10": "Control de Sellos (Empacado al Vacio)",
    "FOR-CC-06": "Control de Empaque Final",
    "FOR-CC-04": "Control de Temperatura en Camaras",
    "FOR-CC-08": "Control de Limpieza y Desinfeccion",
    "FOR-CC-12": "Control de Glaseo",
    "FOR-CC-14": "Control de Peso",
}


# SQL Server (pyodbc)
# IMPORTANTE: NO pongas credenciales reales aqui. Todas vienen de variables de
# entorno via .env (local) o secretos del orquestador (Docker/Kubernetes).
# SQL_DRIVER si puede tener un default razonable porque no es secreto.
SQL_SERVER   = os.getenv("SQL_SERVER")
SQL_DATABASE = os.getenv("SQL_DATABASE")
SQL_USER     = os.getenv("SQL_USER")
SQL_PASSWORD = os.getenv("SQL_PASSWORD")
SQL_DRIVER   = os.getenv("SQL_DRIVER", "ODBC Driver 18 for SQL Server")


def get_connection_string() -> str:
    """Devuelve el connection string pyodbc para Azure SQL Server.

    Falla en caliente con un error explicito si falta cualquier credencial.
    Es preferible a conectar con defaults silenciosos que pueden apuntar a un
    servidor equivocado en produccion.
    """
    driver   = os.getenv("SQL_DRIVER",   SQL_DRIVER)
    server   = os.getenv("SQL_SERVER")
    database = os.getenv("SQL_DATABASE")
    user     = os.getenv("SQL_USER")
    password = os.getenv("SQL_PASSWORD")

    missing = [
        name for name, value in (
            ("SQL_SERVER", server),
            ("SQL_DATABASE", database),
            ("SQL_USER", user),
            ("SQL_PASSWORD", password),
        )
        if not value
    ]
    if missing:
        raise EnvironmentError(
            f"Faltan variables de entorno SQL: {missing}. "
            "Configuralas en .env (desarrollo) o como secretos (produccion). "
            "Nunca deben estar hardcodeadas en el repo."
        )

    return (
        f"DRIVER={{{driver}}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={user};"
        f"PWD={password};"
        "Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
    )


def get_pg_dsn() -> str:
    """Devuelve el DSN de PostgreSQL. Lanza EnvironmentError si no esta configurado."""
    dsn = os.getenv("PG_DATABASE_URL")
    if not dsn:
        raise EnvironmentError(
            "PG_DATABASE_URL no esta definido en el archivo .env. "
            "Formato: postgresql://usuario:password@host:5432/nombre_base_de_datos"
        )
    return dsn
````

## File: db_utils.py
````python
"""
db_utils.py - Capa compartida de acceso a datos para FrigoIA.

Antes de este modulo, sql_tools.py y mcp_server.py tenian copias paralelas
de `_get_conn`, `_fetchall`, `_safe_json`, etc. Cualquier bug en uno no se
corregia en el otro, y los timeouts/retries solo vivian en sql_tools.
Ahora ambos importan de aqui -> una sola fuente de verdad.

Responsabilidades:
  * Conexion a SQL Server (pyodbc) via connection string desde config.py.
  * Conversion de cursores a dicts (_fetchall, _fetchone).
  * Parseo seguro de JSON almacenado en columnas NVARCHAR (_safe_json).
  * Busqueda recursiva de lote en estructuras anidadas (_find_lote_in_json).
  * Extraccion de filas de tablas que contengan un lote (_extract_rows_with_lote).
  * Ejecucion asincrona con TIMEOUT + RETRY transitorio (_run_sql).
  * Ejecucion HTTP con retry (_run_http_post).

Reglas de diseno:
  * NUNCA capturamos excepciones aqui sin relanzarlas: la capa de arriba
    (sql_tools / mcp_server) decide como convertirlas a respuesta
    estructurada usando tool_result.from_exception().
  * _run_sql usa `asyncio.wait_for` para cortar queries colgadas y
    `tenacity.AsyncRetrying` con backoff exponencial para errores TRANSITORIOS.
  * NO reintentamos errores logicos (ProgrammingError, IntegrityError):
    retry sobre esos esconde bugs reales.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import queue
from typing import Any, Callable, TypeVar

import httpx
import pyodbc
from tenacity import (
    AsyncRetrying,
    RetryError,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from config import get_connection_string

log = logging.getLogger(__name__)

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Configuracion de timeout y retry (configurable via .env)
# ---------------------------------------------------------------------------

SQL_TIMEOUT_SECONDS: float = float(os.getenv("SQL_TIMEOUT_SECONDS", "20"))
SQL_MAX_RETRIES: int = int(os.getenv("SQL_MAX_RETRIES", "3"))
HTTP_TIMEOUT_SECONDS: float = float(os.getenv("HTTP_TIMEOUT_SECONDS", "15"))
HTTP_MAX_RETRIES: int = int(os.getenv("HTTP_MAX_RETRIES", "2"))


# Errores de pyodbc considerados transitorios (vale la pena reintentar).
# Operational/Interface cubren: conexion cerrada, timeout de red, pool vacio.
# Deliberadamente NO incluimos IntegrityError ni ProgrammingError.
_TRANSIENT_DB_EXCEPTIONS: tuple[type[BaseException], ...] = (
    pyodbc.OperationalError,
    pyodbc.InterfaceError,
    asyncio.TimeoutError,
    ConnectionError,
)

_TRANSIENT_HTTP_EXCEPTIONS: tuple[type[BaseException], ...] = (
    httpx.ConnectError,
    httpx.ReadTimeout,
    httpx.WriteTimeout,
    httpx.PoolTimeout,
    asyncio.TimeoutError,
)

# ---------------------------------------------------------------------------
# Cliente httpx compartido
#
# Antes run_http_post creaba un AsyncClient nuevo por cada llamada HTTP.
# Un AsyncClient mantiene un pool de conexiones TCP reutilizables, pero si
# se destruye (saliendo del `async with`), ese pool se pierde y la proxima
# peticion vuelve a negociar TLS (~50-100 ms).
#
# Al usar un cliente de nivel modulo, las conexiones persisten entre llamadas
# y el overhead de TLS solo se paga una vez por destino.
# ---------------------------------------------------------------------------
_http_client: httpx.AsyncClient = httpx.AsyncClient(
    timeout=httpx.Timeout(HTTP_TIMEOUT_SECONDS),
    limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
)


# ---------------------------------------------------------------------------
# Pool de conexiones pyodbc
#
# Problema: pyodbc no tiene pool nativo. Cada get_connection() abria un
# handshake TLS nuevo con Azure SQL (~300-400 ms). Con 10 tools por turno,
# eso sumaba hasta 4 segundos solo en overhead de conexion.
#
# Solucion: queue.Queue(maxsize=DB_POOL_SIZE) de conexiones reutilizables.
# _PooledConn es un proxy transparente: todos los atributos de pyodbc.Connection
# pasan, excepto close() que devuelve al pool en lugar de cerrar.
# Compatibilidad total con el codigo existente: ningun caller necesita cambiar.
#
# Si el pool esta vacio (pico de carga), se crea una conexion nueva que se
# descarta al cerrarse (no vuelve al pool si ya esta lleno).
# Si una conexion del pool esta muerta, el SELECT 1 falla y se crea una nueva.
# ---------------------------------------------------------------------------

DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "5"))
_raw_pool: queue.Queue[pyodbc.Connection] = queue.Queue(maxsize=DB_POOL_SIZE)


def _pool_borrow() -> pyodbc.Connection:
    """Saca una conexion del pool (o crea una nueva si el pool esta vacio)."""
    try:
        raw = _raw_pool.get_nowait()
        # Comprobacion rapida de liveness: ~1 ms en conexion activa.
        # Si falla, la conexion esta muerta -> descartarla y abrir una nueva.
        raw.execute("SELECT 1")
        return raw
    except queue.Empty:
        pass
    except Exception:
        try:
            raw.close()  # type: ignore[possibly-undefined]
        except Exception:
            pass
    return pyodbc.connect(get_connection_string())


def _pool_return(raw: pyodbc.Connection) -> None:
    """Devuelve una conexion al pool. Si el pool esta lleno, la cierra."""
    try:
        _raw_pool.put_nowait(raw)
    except queue.Full:
        try:
            raw.close()
        except Exception:
            pass


class _PooledConn:
    """Proxy transparente sobre pyodbc.Connection que devuelve al pool en close().

    Todos los metodos y atributos de pyodbc.Connection funcionan igual.
    Solo close() tiene comportamiento distinto: retorna la conexion al pool.
    """
    __slots__ = ("_raw", "_returned")

    def __init__(self, raw: pyodbc.Connection) -> None:
        object.__setattr__(self, "_raw", raw)
        object.__setattr__(self, "_returned", False)

    def close(self) -> None:
        """Devuelve la conexion al pool en lugar de cerrarla."""
        if not object.__getattribute__(self, "_returned"):
            object.__setattr__(self, "_returned", True)
            _pool_return(object.__getattribute__(self, "_raw"))

    def __getattr__(self, name: str):  # type: ignore[override]
        return getattr(object.__getattribute__(self, "_raw"), name)

    def __del__(self) -> None:
        try:
            if not object.__getattribute__(self, "_returned"):
                self.close()
        except Exception:
            pass


def get_connection() -> _PooledConn:
    """Retorna una conexion del pool pyodbc (crea una nueva si el pool esta vacio).

    Llama conn.close() cuando termines — devuelve la conexion al pool para
    reutilizarla en la siguiente query sin pagar el handshake TLS (~300-400 ms).
    """
    return _PooledConn(_pool_borrow())


def fetchall(cursor: pyodbc.Cursor) -> list[dict]:
    """Convierte todas las filas del cursor en lista de dicts {columna: valor}."""
    cols = [d[0] for d in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


def fetchone(cursor: pyodbc.Cursor) -> dict | None:
    """Obtiene la primera fila del cursor como dict, o None si no hay filas."""
    cols = [d[0] for d in cursor.description]
    row = cursor.fetchone()
    return dict(zip(cols, row)) if row else None


# ---------------------------------------------------------------------------
# Helpers JSON y busqueda de lote
# ---------------------------------------------------------------------------

def safe_json(raw: Any) -> dict | list | None:
    """Parsea JSON de columnas NVARCHAR. Devuelve None si el parse falla."""
    if not raw:
        return None
    try:
        return json.loads(raw) if isinstance(raw, str) else raw
    except (json.JSONDecodeError, TypeError):
        return None


def find_lote_in_json(data: Any, target_lote: str) -> bool:
    """Busca recursivamente un campo 'lote' con valor exacto target_lote.

    Util para distinguir entre 'el texto del lote aparece suelto' vs.
    'el lote esta asignado a un campo especifico'.
    """
    if isinstance(data, dict):
        for key, value in data.items():
            if "lote" in key.lower() and str(value).strip() == target_lote:
                return True
            if find_lote_in_json(value, target_lote):
                return True
    elif isinstance(data, list):
        for item in data:
            if find_lote_in_json(item, target_lote):
                return True
    return False


def extract_rows_with_lote(body_data: Any, target_lote: str) -> list[dict]:
    """Extrae filas de tablas (BodyData) que contengan el lote buscado."""
    results: list[dict] = []
    if not isinstance(body_data, list):
        return results
    for element in body_data:
        if not isinstance(element, dict) or element.get("type") != "table":
            continue
        for row in element.get("data", []):
            if not isinstance(row, dict):
                continue
            for key, value in row.items():
                if "lote" in key.lower() and str(value).strip() == target_lote:
                    non_empty = {k: v for k, v in row.items() if v and str(v).strip()}
                    if non_empty:
                        results.append(non_empty)
                    break
    return results


# ---------------------------------------------------------------------------
# Ejecucion async con timeout + retry
# ---------------------------------------------------------------------------

async def run_sql(
    sync_fn: Callable[[], T],
    *,
    op_name: str = "sql_op",
    timeout: float | None = None,
    retries: int | None = None,
) -> T:
    """Ejecuta una funcion sincrona pyodbc con timeout + retry transitorio.

    Pipeline:
      1. `asyncio.to_thread(sync_fn)`: libera el event loop mientras pyodbc bloquea.
      2. `asyncio.wait_for(..., timeout)`: corta si la query tarda demasiado.
         ADVERTENCIA: el thread NO se cancela (Python no puede matarlo). La conexion
         pyodbc se cerrara por garbage collection cuando la funcion retorne.
      3. `AsyncRetrying`: reintenta hasta N veces sobre errores transitorios con
         backoff exponencial (0.5s -> 1s -> 2s).

    Si se agotan los reintentos, relanza la excepcion original. La capa llamante
    debe capturarla y convertirla en tool_result.err(...) / tool_result.from_exception().
    """
    t = timeout if timeout is not None else SQL_TIMEOUT_SECONDS
    r = retries if retries is not None else SQL_MAX_RETRIES

    async def _attempt() -> T:
        return await asyncio.wait_for(asyncio.to_thread(sync_fn), timeout=t)

    try:
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(r),
            wait=wait_exponential(multiplier=0.5, min=0.5, max=2.0),
            retry=retry_if_exception_type(_TRANSIENT_DB_EXCEPTIONS),
            reraise=True,
        ):
            with attempt:
                if attempt.retry_state.attempt_number > 1:
                    log.warning(
                        "db_utils %s: reintento %d/%d",
                        op_name, attempt.retry_state.attempt_number, r,
                    )
                return await _attempt()
    except RetryError as rexc:  # pragma: no cover
        raise rexc.last_attempt.exception()  # type: ignore[misc]

    raise RuntimeError(f"run_sql({op_name}) sin resultado tras {r} intentos")


async def run_http_post(
    url: str,
    payload: dict,
    *,
    op_name: str = "http_post",
    timeout: float | None = None,
    retries: int | None = None,
) -> dict:
    """POST HTTP con timeout + retry en errores de red (NO reintenta 4xx/5xx)."""
    t = timeout if timeout is not None else HTTP_TIMEOUT_SECONDS
    r = retries if retries is not None else HTTP_MAX_RETRIES

    async def _attempt() -> dict:
        resp = await _http_client.post(url, json=payload, timeout=t)
        resp.raise_for_status()
        return resp.json()

    try:
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(r),
            wait=wait_exponential(multiplier=0.5, min=0.5, max=2.0),
            retry=retry_if_exception_type(_TRANSIENT_HTTP_EXCEPTIONS),
            reraise=True,
        ):
            with attempt:
                if attempt.retry_state.attempt_number > 1:
                    log.warning(
                        "db_utils %s: reintento HTTP %d/%d",
                        op_name, attempt.retry_state.attempt_number, r,
                    )
                return await _attempt()
    except RetryError as rexc:  # pragma: no cover
        raise rexc.last_attempt.exception()  # type: ignore[misc]

    raise RuntimeError(f"run_http_post({op_name}) sin resultado")
````

## File: deploy/0-upload-to-vm.ps1
````powershell
# =============================================================================
# deploy\0-upload-to-vm.ps1
#
# PASO 0 (OPCIONAL) — Sube todos los scripts de deploy a la VM de Azure.
# Ejecutar desde tu PC con Windows antes del PASO 2.
#
# Uso:
#   .\deploy\0-upload-to-vm.ps1 -PemPath C:\ruta\llave.pem -VmIp 20.10.20.30
#   .\deploy\0-upload-to-vm.ps1 -PemPath C:\ruta\llave.pem -VmIp 20.10.20.30 -VmUser azureuser
#
# Prerequisito: OpenSSH instalado en Windows 10/11 (viene por defecto).
# =============================================================================
param(
    [Parameter(Mandatory = $true)]
    [string]$PemPath,

    [Parameter(Mandatory = $true)]
    [string]$VmIp,

    [string]$VmUser = "azureuser"
)

$ErrorActionPreference = "Stop"

$DeployDir   = $PSScriptRoot
$RemoteDir   = "/home/$VmUser/frigo-ai"
$SshTarget   = "${VmUser}@${VmIp}"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  FrigoIA — Subir scripts a la VM Azure" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  VM      : $SshTarget"
Write-Host "  Llave   : $PemPath"
Write-Host "  Destino : $RemoteDir"
Write-Host ""

# ── Verificar que existe el .pem ──────────────────────────────────────────
if (-not (Test-Path $PemPath)) {
    throw "No se encontro la llave: $PemPath"
}

# ── Arreglar permisos del .pem en Windows (SCP falla si son muy abiertos) ─
Write-Host "[1/3] Ajustando permisos de la llave .pem..." -ForegroundColor Yellow
icacls $PemPath /inheritance:r /grant:r "${env:USERNAME}:(R)" | Out-Null
Write-Host "  OK" -ForegroundColor Green

# ── Crear el directorio remoto ────────────────────────────────────────────
Write-Host "[2/3] Creando directorio remoto en la VM..." -ForegroundColor Yellow
ssh -i $PemPath -o StrictHostKeyChecking=no "${SshTarget}" "mkdir -p $RemoteDir"
Write-Host "  OK: $RemoteDir creado" -ForegroundColor Green

# ── Subir todos los scripts de deploy ────────────────────────────────────
Write-Host "[3/3] Subiendo scripts..." -ForegroundColor Yellow

$filesToUpload = @(
    "2-setup-vm.sh",
    "3-run-bot.sh",
    "4-update-bot.sh",
    "env-vm.template"
)

foreach ($file in $filesToUpload) {
    $localPath = Join-Path $DeployDir $file
    if (Test-Path $localPath) {
        scp -i $PemPath -o StrictHostKeyChecking=no $localPath "${SshTarget}:${RemoteDir}/${file}"
        Write-Host "  Subido: $file" -ForegroundColor Green
    } else {
        Write-Warning "  No encontrado localmente: $file"
    }
}

# ── Dar permisos de ejecucion a los .sh ──────────────────────────────────
ssh -i $PemPath -o StrictHostKeyChecking=no $SshTarget `
    "chmod +x $RemoteDir/*.sh"
Write-Host "  Permisos de ejecucion asignados a *.sh" -ForegroundColor Green

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  Scripts subidos correctamente." -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos pasos:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Conéctate a la VM:" -ForegroundColor White
Write-Host "     ssh -i $PemPath ${SshTarget}" -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. Ejecuta el setup inicial (una sola vez):" -ForegroundColor White
Write-Host "     bash ~/frigo-ai/2-setup-vm.sh" -ForegroundColor Yellow
Write-Host ""
Write-Host "  3. Rellena las credenciales:" -ForegroundColor White
Write-Host "     nano ~/frigo-ai/.env.frigo" -ForegroundColor Yellow
Write-Host ""
Write-Host "  4. Arranca el bot:" -ForegroundColor White
Write-Host "     bash ~/frigo-ai/3-run-bot.sh TU_USUARIO_DOCKERHUB" -ForegroundColor Yellow
Write-Host ""

# ── Tip: agregar alias SSH al config local ────────────────────────────────
$SshConfigPath = "$env:USERPROFILE\.ssh\config"
$AliasBlock = @"

# FrigoIA VM Azure — agregado por 0-upload-to-vm.ps1
Host frigo-vm
    HostName $VmIp
    User $VmUser
    IdentityFile $PemPath
    StrictHostKeyChecking no
"@

$addAlias = Read-Host "Agregar alias 'frigo-vm' a $SshConfigPath para conectarte con solo 'ssh frigo-vm'? (s/n)"
if ($addAlias -eq "s") {
    if (-not (Test-Path (Split-Path $SshConfigPath))) {
        New-Item -ItemType Directory -Path (Split-Path $SshConfigPath) | Out-Null
    }
    # Verificar que no exista ya
    $existingConfig = if (Test-Path $SshConfigPath) { Get-Content $SshConfigPath -Raw } else { "" }
    if ($existingConfig -notmatch "frigo-vm") {
        Add-Content -Path $SshConfigPath -Value $AliasBlock
        Write-Host ""
        Write-Host "  Alias agregado. Ahora puedes conectarte con: ssh frigo-vm" -ForegroundColor Green
    } else {
        Write-Host "  El alias 'frigo-vm' ya existe en $SshConfigPath" -ForegroundColor Yellow
    }
}
````

## File: deploy/1-build-push.ps1
````powershell
# =============================================================================
# deploy\1-build-push.ps1
#
# PASO 1 - Ejecutar desde tu PC con Windows.
# Construye la imagen Docker y la sube a Docker Hub.
#
# Uso:
#   .\deploy\1-build-push.ps1 -DockerUser tu_usuario_dockerhub
#   .\deploy\1-build-push.ps1 -DockerUser tu_usuario_dockerhub -Tag v1.2.0
#
# Prerequisitos en tu PC:
#   - Docker Desktop instalado y corriendo
#   - Cuenta gratuita en https://hub.docker.com
# =============================================================================
param(
    [Parameter(Mandatory = $true)]
    [string]$DockerUser,

    [string]$Tag = "latest",

    [string]$ImageName = "frigo-bot"
)

$ErrorActionPreference = "Stop"
$FullImage = "${DockerUser}/${ImageName}:${Tag}"
$LatestImage = "${DockerUser}/${ImageName}:latest"

# Raiz del proyecto (un nivel arriba de deploy\)
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  FrigoIA - Build y Push a Docker Hub" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Imagen : $FullImage"
Write-Host "  Raiz   : $ProjectRoot"
Write-Host ""

# -- 1. Login a Docker Hub --------------------------------------------------
Write-Host "[1/3] Iniciando sesion en Docker Hub..." -ForegroundColor Yellow
docker login
if ($LASTEXITCODE -ne 0) { throw "docker login fallo. Verifica tu usuario y contrasena." }

# -- 2. Build ---------------------------------------------------------------
Write-Host ""
Write-Host "[2/3] Construyendo imagen..." -ForegroundColor Yellow
docker build `
    --tag $FullImage `
    --tag $LatestImage `
    --file "$ProjectRoot\Dockerfile" `
    $ProjectRoot

if ($LASTEXITCODE -ne 0) { throw "docker build fallo. Revisa el Dockerfile." }
Write-Host "  OK: imagen construida -> $FullImage" -ForegroundColor Green

# -- 3. Push ----------------------------------------------------------------
Write-Host ""
Write-Host "[3/3] Subiendo imagen a Docker Hub..." -ForegroundColor Yellow
docker push $FullImage
docker push $LatestImage

if ($LASTEXITCODE -ne 0) { throw "docker push fallo. Verifica permisos en Docker Hub." }

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  LISTO. Imagen publicada en Docker Hub." -ForegroundColor Green
Write-Host "  $FullImage" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Siguiente paso: conectate a tu VM de Azure y ejecuta:" -ForegroundColor Cyan
Write-Host "  bash ~/deploy/3-run-bot.sh $DockerUser $Tag" -ForegroundColor White
Write-Host ""
````

## File: deploy/2-setup-vm.sh
````bash
#!/usr/bin/env bash
# =============================================================================
# deploy/2-setup-vm.sh
#
# PASO 2 — Ejecutar UNA SOLA VEZ en la VM de Azure (B1s Ubuntu 22.04).
# Instala Docker, crea la carpeta de configuracion y prepara el servidor.
#
# Uso (desde tu PC con el .pem descargado de Azure):
#   ssh -i ~/ruta/tu-llave.pem azureuser@IP_PUBLICA_AZURE \
#       "bash -s" < deploy/2-setup-vm.sh
#
# O si ya estas dentro de la VM:
#   chmod +x ~/deploy/2-setup-vm.sh && ~/deploy/2-setup-vm.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  FrigoIA — Setup inicial de la VM Azure${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

# ── 1. Actualizar paquetes ─────────────────────────────────────────────────
echo -e "${YELLOW}[1/5] Actualizando paquetes del sistema...${NC}"
sudo apt-get update -qq
sudo apt-get upgrade -y -qq
echo -e "${GREEN}  OK${NC}"

# ── 2. Instalar Docker ─────────────────────────────────────────────────────
echo -e "${YELLOW}[2/5] Instalando Docker...${NC}"
if command -v docker &>/dev/null; then
    echo -e "${GREEN}  Docker ya instalado: $(docker --version)${NC}"
else
    sudo apt-get install -y -qq docker.io
    sudo systemctl start docker
    sudo systemctl enable docker
    # Permitir correr docker sin sudo al usuario actual
    sudo usermod -aG docker "$USER"
    echo -e "${GREEN}  Docker instalado: $(docker --version)${NC}"
fi

# ── 3. Instalar utilidades de soporte ─────────────────────────────────────
echo -e "${YELLOW}[3/5] Instalando utilidades (htop, nano, jq)...${NC}"
sudo apt-get install -y -qq htop nano jq curl
echo -e "${GREEN}  OK${NC}"

# ── 4. Crear estructura de directorios ────────────────────────────────────
echo -e "${YELLOW}[4/5] Creando directorios de configuracion...${NC}"
mkdir -p ~/frigo-ai/logs
chmod 700 ~/frigo-ai
echo -e "${GREEN}  Creado ~/frigo-ai/${NC}"

# ── 5. Crear plantilla de variables de entorno ────────────────────────────
echo -e "${YELLOW}[5/5] Creando plantilla de variables de entorno...${NC}"

ENV_FILE=~/frigo-ai/.env.frigo

if [[ -f "$ENV_FILE" ]]; then
    echo -e "${YELLOW}  Ya existe $ENV_FILE — NO se sobreescribe.${NC}"
else
    cat > "$ENV_FILE" << 'ENVTEMPLATE'
# ============================================================
# FRIGO-AI — Variables de entorno en produccion (VM Azure)
# Editar con: nano ~/frigo-ai/.env.frigo
# ============================================================

# SQL Server
SQL_SERVER=picofrigo.database.windows.net,1433
SQL_DATABASE=frigolib
SQL_USER=CAMBIAR
SQL_PASSWORD=CAMBIAR
SQL_DRIVER=ODBC Driver 18 for SQL Server
SQL_TIMEOUT_SECONDS=20
SQL_MAX_RETRIES=3

# Backend API
API_BASE_URL=http://localhost:5074/api

# LLM (GitHub Models)
GITHUB_TOKEN=CAMBIAR
GITHUB_MODEL=gpt-4o

# Azure OpenAI STT (Whisper)
AZURE_STT_KEY=CAMBIAR
AZURE_STT_ENDPOINT=CAMBIAR
AZURE_STT_DEPLOYMENT=whisper

# Azure OpenAI TTS
AZURE_TTS_KEY=CAMBIAR
AZURE_TTS_ENDPOINT=CAMBIAR
AZURE_TTS_DEPLOYMENT=gpt-4o-mini-tts

# Telegram
TELEGRAM_BOT_TOKEN=CAMBIAR
TELEGRAM_TOKEN=CAMBIAR

# Sentry
SENTRY_DSN=CAMBIAR
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_SEND_DEFAULT_PII=false
APP_VERSION=1.0.0

# Estado conversacional (memory=RAM, postgres=persistente entre reinicios)
CHECKPOINTER_BACKEND=memory
ENVTEMPLATE

    chmod 600 "$ENV_FILE"
    echo -e "${GREEN}  Creado $ENV_FILE (permisos 600)${NC}"
    echo -e "${RED}  !! IMPORTANTE: edita el archivo con tus credenciales reales !!${NC}"
    echo -e "${YELLOW}     nano ~/frigo-ai/.env.frigo${NC}"
fi

echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}  Setup completado.${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "${CYAN}Proximos pasos:${NC}"
echo "  1. Edita las credenciales:"
echo -e "     ${YELLOW}nano ~/frigo-ai/.env.frigo${NC}"
echo "  2. Ejecuta el bot:"
echo -e "     ${YELLOW}bash ~/frigo-ai/3-run-bot.sh TU_USUARIO_DOCKERHUB latest${NC}"
echo ""
echo -e "${RED}NOTA: Cierra y vuelve a abrir la sesion SSH para que el grupo 'docker'${NC}"
echo -e "${RED}      surta efecto (sin necesitar sudo para docker).${NC}"
echo ""
````

## File: deploy/3-run-bot.sh
````bash
#!/usr/bin/env bash
# =============================================================================
# deploy/3-run-bot.sh
#
# PASO 3 — Arranca (o reinicia) el bot en la VM de Azure.
# Descarga la ultima imagen de Docker Hub y corre el contenedor
# con las variables de ~/frigo-ai/.env.frigo
#
# Uso:
#   bash ~/frigo-ai/3-run-bot.sh TU_USUARIO_DOCKERHUB
#   bash ~/frigo-ai/3-run-bot.sh TU_USUARIO_DOCKERHUB v1.2.0
#
# El primer argumento es tu usuario de Docker Hub.
# El segundo argumento es el tag (por defecto: latest).
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

DOCKER_USER="${1:-}"
TAG="${2:-latest}"
IMAGE_NAME="frigo-bot"
CONTAINER_NAME="frigo-ai"
ENV_FILE="${HOME}/frigo-ai/.env.frigo"

# ── Validaciones ───────────────────────────────────────────────────────────
if [[ -z "$DOCKER_USER" ]]; then
    echo -e "${RED}ERROR: Debes pasar tu usuario de Docker Hub como primer argumento.${NC}"
    echo "  Uso: bash 3-run-bot.sh TU_USUARIO_DOCKERHUB"
    exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${RED}ERROR: No se encontro $ENV_FILE${NC}"
    echo "  Ejecuta primero: bash ~/frigo-ai/2-setup-vm.sh"
    exit 1
fi

# Verificar que el usuario haya llenado las credenciales
if grep -q "CAMBIAR" "$ENV_FILE"; then
    echo -e "${RED}ERROR: Aun hay valores 'CAMBIAR' en $ENV_FILE${NC}"
    echo -e "  Editalo con: ${YELLOW}nano $ENV_FILE${NC}"
    exit 1
fi

FULL_IMAGE="${DOCKER_USER}/${IMAGE_NAME}:${TAG}"

echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  FrigoIA — Deploy en VM Azure B1s${NC}"
echo -e "${CYAN}=============================================${NC}"
echo -e "  Imagen     : ${FULL_IMAGE}"
echo -e "  Contenedor : ${CONTAINER_NAME}"
echo -e "  Env file   : ${ENV_FILE}"
echo ""

# ── 1. Pull de la imagen ───────────────────────────────────────────────────
echo -e "${YELLOW}[1/4] Descargando imagen desde Docker Hub...${NC}"
docker pull "$FULL_IMAGE"
echo -e "${GREEN}  OK${NC}"

# ── 2. Detener y eliminar contenedor anterior si existe ───────────────────
echo -e "${YELLOW}[2/4] Deteniendo contenedor anterior (si existe)...${NC}"
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm   "$CONTAINER_NAME" 2>/dev/null || true
    echo -e "${GREEN}  Contenedor anterior eliminado${NC}"
else
    echo -e "${GREEN}  No habia contenedor anterior${NC}"
fi

# ── 3. Arrancar el bot ────────────────────────────────────────────────────
echo -e "${YELLOW}[3/4] Iniciando bot...${NC}"
docker run \
    --detach \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    --env-file "$ENV_FILE" \
    --log-opt max-size=10m \
    --log-opt max-file=3 \
    "$FULL_IMAGE"

echo -e "${GREEN}  Contenedor iniciado en background${NC}"

# ── 4. Verificacion rapida ────────────────────────────────────────────────
echo -e "${YELLOW}[4/4] Verificando arranque (5 segundos)...${NC}"
sleep 5

STATUS=$(docker inspect --format='{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "no encontrado")

if [[ "$STATUS" == "running" ]]; then
    echo -e "${GREEN}  Estado: RUNNING${NC}"
    echo ""
    echo -e "${GREEN}=============================================${NC}"
    echo -e "${GREEN}  Bot desplegado correctamente.${NC}"
    echo -e "${GREEN}=============================================${NC}"
    echo ""
    echo -e "${CYAN}Comandos utiles:${NC}"
    echo "  Ver logs en vivo    :  docker logs -f $CONTAINER_NAME"
    echo "  Estado del bot      :  docker ps"
    echo "  Detener el bot      :  docker stop $CONTAINER_NAME"
    echo "  Reiniciar el bot    :  docker restart $CONTAINER_NAME"
    echo "  Actualizar a latest :  bash ~/frigo-ai/4-update-bot.sh $DOCKER_USER"
else
    echo -e "${RED}  Estado: $STATUS — algo salio mal.${NC}"
    echo -e "${YELLOW}  Revisa los logs:${NC}"
    docker logs --tail 50 "$CONTAINER_NAME" 2>/dev/null || true
    exit 1
fi
echo ""
````

## File: deploy/4-update-bot.sh
````bash
#!/usr/bin/env bash
# =============================================================================
# deploy/4-update-bot.sh
#
# Actualiza el bot a la ultima imagen sin tener que reconfigurar nada.
# Zero-downtime: baja el viejo, sube el nuevo en segundos.
#
# Uso:
#   bash ~/frigo-ai/4-update-bot.sh TU_USUARIO_DOCKERHUB
#   bash ~/frigo-ai/4-update-bot.sh TU_USUARIO_DOCKERHUB v1.3.0
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

DOCKER_USER="${1:-}"
TAG="${2:-latest}"

if [[ -z "$DOCKER_USER" ]]; then
    echo "Uso: bash 4-update-bot.sh TU_USUARIO_DOCKERHUB [TAG]"
    exit 1
fi

echo ""
echo -e "${CYAN}  FrigoIA — Actualizando bot a ${DOCKER_USER}/frigo-bot:${TAG}${NC}"
echo ""

# Reusar 3-run-bot.sh con los nuevos parametros
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/3-run-bot.sh" "$DOCKER_USER" "$TAG"
````

## File: deploy/5-container-apps.sh
````bash
#!/usr/bin/env bash
# =============================================================================
# deploy/5-container-apps.sh
#
# Crea todos los recursos de Azure necesarios para correr FrigoIA en
# Azure Container Apps con escala a 0 (costo $0 dentro del free tier).
#
# Requisitos:
#   - Azure CLI instalado (az): https://docs.microsoft.com/cli/azure/install-azure-cli
#   - Sesion activa: az login
#   - Suscripcion Azure for Students activa
#
# Uso:
#   chmod +x deploy/5-container-apps.sh
#   bash deploy/5-container-apps.sh
#
# Que hace:
#   1. Crea Resource Group
#   2. Crea Container Apps Environment (el "servidor" logico gratuito)
#   3. Crea el Container App con escala a 0 usando tu imagen de Docker Hub
#   4. Muestra la URL publica para configurar WEBHOOK_URL
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

# ── CONFIGURACION — editar antes de ejecutar ──────────────────────────────
RESOURCE_GROUP="frigo-ai-rg"
LOCATION="eastus"
ENVIRONMENT_NAME="frigo-ai-env"
APP_NAME="frigo-ai"
DOCKER_IMAGE="TU_USUARIO_DOCKERHUB/frigo-bot:latest"   # <- CAMBIAR

# Secretos del bot (se guardan como secrets en Container Apps, no en texto plano)
# Estos se cargan desde el .env local si existe, o los defines aqui
ENV_FILE="${HOME}/frigo-ai/.env.frigo"
# ─────────────────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  FrigoIA — Crear Azure Container Apps${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

# ── Verificar az cli ──────────────────────────────────────────────────────
if ! command -v az &>/dev/null; then
    echo -e "${RED}ERROR: Azure CLI no instalado.${NC}"
    echo "  Instalar: https://docs.microsoft.com/cli/azure/install-azure-cli"
    exit 1
fi

# ── Verificar login ───────────────────────────────────────────────────────
if ! az account show &>/dev/null; then
    echo -e "${YELLOW}Iniciando sesion en Azure...${NC}"
    az login
fi

SUBSCRIPTION=$(az account show --query "name" -o tsv)
echo -e "  Suscripcion activa: ${GREEN}${SUBSCRIPTION}${NC}"
echo ""

# ── 1. Extensiones necesarias ─────────────────────────────────────────────
echo -e "${YELLOW}[1/6] Instalando extension containerapp...${NC}"
az extension add --name containerapp --upgrade --only-show-errors 2>/dev/null || true
az provider register --namespace Microsoft.App --only-show-errors 2>/dev/null || true
az provider register --namespace Microsoft.OperationalInsights --only-show-errors 2>/dev/null || true
echo -e "${GREEN}  OK${NC}"

# ── 2. Resource Group ─────────────────────────────────────────────────────
echo -e "${YELLOW}[2/6] Creando Resource Group '${RESOURCE_GROUP}'...${NC}"
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output none
echo -e "${GREEN}  OK: ${RESOURCE_GROUP} en ${LOCATION}${NC}"

# ── 3. Container Apps Environment ────────────────────────────────────────
echo -e "${YELLOW}[3/6] Creando Container Apps Environment '${ENVIRONMENT_NAME}'...${NC}"
echo -e "  (puede tardar 2-3 minutos)"
az containerapp env create \
    --name "$ENVIRONMENT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output none
echo -e "${GREEN}  OK${NC}"

# ── 4. Preparar variables de entorno ──────────────────────────────────────
echo -e "${YELLOW}[4/6] Leyendo variables de entorno...${NC}"

if [[ -f "$ENV_FILE" ]]; then
    # Leer el .env.frigo y convertir a formato KEY=VALUE para az containerapp
    ENV_VARS=$(grep -v '^#' "$ENV_FILE" | grep -v '^$' | tr '\n' ' ')
    echo -e "${GREEN}  Leidas desde ${ENV_FILE}${NC}"
else
    echo -e "${RED}  ADVERTENCIA: No se encontro ${ENV_FILE}${NC}"
    echo -e "  Las variables de entorno NO se configuraran automaticamente."
    echo -e "  Configuralas manualmente en Azure Portal despues."
    ENV_VARS=""
fi

# ── 5. Crear Container App ────────────────────────────────────────────────
echo -e "${YELLOW}[5/6] Creando Container App '${APP_NAME}'...${NC}"

# Construccion del comando base
CREATE_CMD=(
    az containerapp create
    --name "$APP_NAME"
    --resource-group "$RESOURCE_GROUP"
    --environment "$ENVIRONMENT_NAME"
    --image "$DOCKER_IMAGE"
    --target-port 8000
    --ingress external
    --min-replicas 0
    --max-replicas 3
    --cpu 0.5
    --memory 1.0Gi
    --output none
)

# Agregar env vars si existen
if [[ -n "$ENV_VARS" ]]; then
    CREATE_CMD+=(--env-vars $ENV_VARS)
fi

"${CREATE_CMD[@]}"
echo -e "${GREEN}  OK: Container App creado con escala minima = 0 (costo $0 en idle)${NC}"

# ── 6. Obtener URL publica ────────────────────────────────────────────────
echo -e "${YELLOW}[6/6] Obteniendo URL publica...${NC}"
APP_URL=$(az containerapp show \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.configuration.ingress.fqdn" -o tsv)

FULL_URL="https://${APP_URL}"
echo -e "${GREEN}  URL: ${FULL_URL}${NC}"

echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}  Container App creado exitosamente.${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "${CYAN}Proximos pasos OBLIGATORIOS:${NC}"
echo ""
echo -e "1. Genera un WEBHOOK_SECRET seguro:"
echo -e "   ${YELLOW}python -c \"import secrets; print(secrets.token_hex(32))\"${NC}"
echo ""
echo -e "2. Configura WEBHOOK_URL y WEBHOOK_SECRET en el Container App:"
echo -e "   ${YELLOW}az containerapp update \\${NC}"
echo -e "   ${YELLOW}  --name ${APP_NAME} \\${NC}"
echo -e "   ${YELLOW}  --resource-group ${RESOURCE_GROUP} \\${NC}"
echo -e "   ${YELLOW}  --set-env-vars WEBHOOK_URL=${FULL_URL} WEBHOOK_SECRET=TU_SECRET${NC}"
echo ""
echo -e "3. Agrega la misma URL a tu .env para desarrollo local:"
echo -e "   ${YELLOW}WEBHOOK_URL=${FULL_URL}${NC}"
echo ""
echo -e "4. Health check:"
echo -e "   ${YELLOW}curl ${FULL_URL}/health${NC}"
echo ""
echo -e "5. Verifica el webhook en Telegram (envia /start al bot)"
echo ""
````

## File: deploy/azure-pipelines.yml
````yaml
# =============================================================================
# azure-pipelines.yml — CI/CD para FrigoIA en Azure Container Apps
#
# Pipeline:
#   1. Build Docker image multi-stage
#   2. Push a GitHub Container Registry (ghcr.io) — GRATIS
#   3. Deploy a Azure Container Apps — GRATIS (free tier)
#
# Activadores:
#   - Push a la rama `main` → deploy automatico a produccion
#   - Pull Request a `main` → solo build (sin deploy)
#
# Service Connections requeridas en Azure DevOps:
#   - `github-ghcr`  : GitHub PAT con permiso write:packages
#                      (Settings > Service Connections > Docker Registry)
#   - `azure-sub`    : Service Principal con rol Contributor en el Resource Group
#                      (Settings > Service Connections > Azure Resource Manager)
#
# Variables de pipeline requeridas (Settings > Pipelines > Variables):
#   - GITHUB_USERNAME       : tu usuario de GitHub (para ghcr.io)
#   - CONTAINER_APP_NAME    : nombre del Container App (ej: frigo-ai)
#   - RESOURCE_GROUP        : nombre del Resource Group (ej: frigo-ai-rg)
# =============================================================================

trigger:
  branches:
    include:
      - main
  paths:
    exclude:
      - "deploy/**"
      - "*.md"
      - ".gitignore"

pr:
  branches:
    include:
      - main

pool:
  vmImage: ubuntu-latest

variables:
  IMAGE_NAME: ghcr.io/$(GITHUB_USERNAME)/frigo-bot
  IMAGE_TAG: $(Build.BuildId)

stages:

# ──────────────────────────────────────────────────────────────────────────
# STAGE 1: Build & Push
# ──────────────────────────────────────────────────────────────────────────
- stage: Build
  displayName: "Build & Push imagen Docker"
  jobs:
  - job: BuildAndPush
    displayName: "docker build + docker push → ghcr.io"
    steps:

    - task: Docker@2
      displayName: "Build & push :$(IMAGE_TAG)"
      inputs:
        command: buildAndPush
        repository: $(IMAGE_NAME)
        dockerfile: Dockerfile
        containerRegistry: github-ghcr
        tags: |
          $(IMAGE_TAG)
          latest

    # Publicar el tag usado para que el stage Deploy lo consuma
    - bash: echo "##vso[task.setvariable variable=deployTag;isOutput=true]$(IMAGE_TAG)"
      name: setTag
      displayName: "Exportar tag para Deploy"


# ──────────────────────────────────────────────────────────────────────────
# STAGE 2: Deploy (solo en push a main, no en PR)
# ──────────────────────────────────────────────────────────────────────────
- stage: Deploy
  displayName: "Deploy a Azure Container Apps"
  dependsOn: Build
  condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
  variables:
    deployTag: $[ stageDependencies.Build.BuildAndPush.outputs['setTag.deployTag'] ]
  jobs:
  - deployment: DeployContainerApp
    displayName: "az containerapp update"
    environment: production
    strategy:
      runOnce:
        deploy:
          steps:

          - task: AzureCLI@2
            displayName: "Actualizar imagen en Container App"
            inputs:
              azureSubscription: azure-sub
              scriptType: bash
              scriptLocation: inlineScript
              inlineScript: |
                az containerapp update \
                  --name "$(CONTAINER_APP_NAME)" \
                  --resource-group "$(RESOURCE_GROUP)" \
                  --image "$(IMAGE_NAME):$(deployTag)"

          - task: AzureCLI@2
            displayName: "Verificar estado del Container App"
            inputs:
              azureSubscription: azure-sub
              scriptType: bash
              scriptLocation: inlineScript
              inlineScript: |
                STATUS=$(az containerapp show \
                  --name "$(CONTAINER_APP_NAME)" \
                  --resource-group "$(RESOURCE_GROUP)" \
                  --query "properties.runningStatus" -o tsv)
                echo "Estado: $STATUS"
                if [[ "$STATUS" != "Running" ]]; then
                  echo "##vso[task.logissue type=error]Container App no esta Running: $STATUS"
                  exit 1
                fi
                echo "Deploy exitoso. Imagen: $(IMAGE_NAME):$(deployTag)"
````

## File: deploy/env-vm.template
````
# ============================================================
# FRIGO-AI — Plantilla de variables de entorno para la VM
#
# USO EN LA VM:
#   cp env-vm.template ~/frigo-ai/.env.frigo
#   chmod 600 ~/frigo-ai/.env.frigo
#   nano ~/frigo-ai/.env.frigo
#
# Rellena TODOS los valores marcados con CAMBIAR antes de
# ejecutar el bot. Si dejas algun "CAMBIAR" el script
# 3-run-bot.sh lo detecta y te avisa.
# ============================================================

# =============================================
# SQL Server — Azure SQL (picofrigo)
# =============================================
SQL_SERVER=picofrigo.database.windows.net,1433
SQL_DATABASE=frigolib
SQL_USER=CAMBIAR
SQL_PASSWORD=CAMBIAR
SQL_DRIVER=ODBC Driver 18 for SQL Server
SQL_TIMEOUT_SECONDS=20
SQL_MAX_RETRIES=3

# =============================================
# Backend API (.NET)
# =============================================
API_BASE_URL=http://localhost:5074/api

# =============================================
# Tuning de resiliencia (los defaults son buenos)
# =============================================
HTTP_TIMEOUT_SECONDS=15
HTTP_MAX_RETRIES=2
LLM_MAX_RETRIES=2
MAX_CONTEXT_TOKENS=8000

# =============================================
# CEREBRO — GitHub Models (LLM / GPT-4o)
# =============================================
GITHUB_TOKEN=CAMBIAR
GITHUB_MODEL=gpt-4o

# =============================================
# OIDOS — Azure OpenAI STT (Whisper)
# =============================================
AZURE_STT_KEY=CAMBIAR
AZURE_STT_ENDPOINT=CAMBIAR
AZURE_STT_DEPLOYMENT=whisper

# =============================================
# BOCA — Azure OpenAI TTS (gpt-4o-mini-tts)
# =============================================
AZURE_TTS_KEY=CAMBIAR
AZURE_TTS_ENDPOINT=CAMBIAR
AZURE_TTS_DEPLOYMENT=gpt-4o-mini-tts

# =============================================
# TELEGRAM BOT
# =============================================
TELEGRAM_BOT_TOKEN=CAMBIAR
TELEGRAM_TOKEN=CAMBIAR

# =============================================
# SENTRY — Errores y trazas
# =============================================
SENTRY_DSN=CAMBIAR
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_SEND_DEFAULT_PII=false
APP_VERSION=1.0.0

# =============================================
# ESTADO CONVERSACIONAL (LangGraph)
# memory   = RAM (default, OK para 1 contenedor)
# postgres = persistente entre reinicios (requiere PG_DATABASE_URL)
# =============================================
CHECKPOINTER_BACKEND=memory
# PG_DATABASE_URL=postgresql://usuario:password@servidor.postgres.database.azure.com:5432/frigolab
````

## File: deploy/VM-DEPLOY.md
````markdown
# FrigoIA — Despliegue en Azure VM B1s (Ubuntu 22.04)

Guia paso a paso para subir el bot a una Maquina Virtual gratuita de Azure.
Esta opcion corre el bot **24/7** dentro del free tier de Azure for Students (750 h/mes).

---

## Arquitectura

```
Tu PC (Windows)
   │
   │  .\deploy\1-build-push.ps1
   │  (docker build + docker push)
   ▼
Docker Hub (gratis)
   │
   │  docker pull  (desde la VM)
   ▼
Azure VM B1s — Ubuntu 22.04
   │   ~/frigo-ai/.env.frigo  (credenciales, permisos 600)
   │   docker run --restart unless-stopped
   ▼
Contenedor frigo-ai
   ├──► Azure SQL Server  (picofrigo.database.windows.net)
   ├──► Azure OpenAI Whisper  (frigovoice-ai-hub)
   ├──► GitHub Models GPT-4o
   └──► Sentry (errores en produccion)
```

---

## Scripts disponibles

| Script | Donde ejecutar | Que hace |
|---|---|---|
| `1-build-push.ps1` | Tu PC (PowerShell) | Build Docker + push a Docker Hub |
| `2-setup-vm.sh` | VM Azure (una sola vez) | Instala Docker, crea estructura |
| `3-run-bot.sh` | VM Azure | Descarga imagen y arranca el bot |
| `4-update-bot.sh` | VM Azure | Actualiza el bot a nueva version |

---

## Paso a paso completo

### FASE 1 — Crear la VM en Azure Portal (5 min)

1. Ve a [portal.azure.com](https://portal.azure.com) → **Virtual Machines** → **Create**
2. Configuracion clave:
   - **Subscription**: Azure for Students
   - **Region**: East US *(o Central US si East US no tiene B1s disponible)*
   - **Image**: Ubuntu Server 22.04 LTS
   - **Size**: `Standard_B1s` (1 vCPU, 1 GiB RAM) — verifica que sea B1s no B1ls
   - **Authentication**: SSH public key
   - **Username**: `azureuser`
   - **Inbound ports**: SSH (22)
3. Haz clic en **Review + create** → **Create**
4. **Descarga el archivo `.pem`** cuando Azure te lo ofrezca. Guardalo en lugar seguro.
5. Anota la **IP publica** de la VM cuando termine de crearse.

---

### FASE 2 — Preparar Docker Hub (2 min)

1. Crea una cuenta gratuita en [hub.docker.com](https://hub.docker.com)
2. Anota tu usuario (ej. `miusuario`)

---

### FASE 3 — Build y push desde tu PC (3 min)

Abre PowerShell en la raiz del proyecto y ejecuta:

```powershell
.\deploy\1-build-push.ps1 -DockerUser tu_usuario_dockerhub
```

Esto construye la imagen y la sube a `docker.io/tu_usuario/frigo-bot:latest`.

Para una version especifica:
```powershell
.\deploy\1-build-push.ps1 -DockerUser tu_usuario_dockerhub -Tag v1.0.0
```

---

### FASE 4 — Conectarte a la VM (desde tu PC)

```powershell
# Windows PowerShell
ssh -i C:\ruta\a\tu-llave.pem azureuser@IP_PUBLICA_AZURE
```

Si Windows dice "permisos incorrectos" en el .pem:
```powershell
icacls "C:\ruta\a\tu-llave.pem" /inheritance:r /grant:r "$env:USERNAME:(R)"
```

---

### FASE 5 — Setup inicial de la VM (una sola vez, dentro de la VM)

```bash
# Desde dentro de la VM:
curl -fsSL https://raw.githubusercontent.com/TU_USUARIO/frigo-ai/main/deploy/2-setup-vm.sh | bash
```

O si prefieres copiar el script:
```bash
# Desde tu PC (PowerShell):
scp -i C:\ruta\llave.pem deploy\2-setup-vm.sh azureuser@IP_PUBLICA:~/
# Luego en la VM:
bash ~/2-setup-vm.sh
```

El script instala Docker y crea `~/frigo-ai/.env.frigo`.

---

### FASE 6 — Configurar las credenciales en la VM

```bash
# Dentro de la VM:
nano ~/frigo-ai/.env.frigo
```

Rellena todos los valores marcados con `CAMBIAR`:

```env
SQL_USER=fulo
SQL_PASSWORD=tu_password_real
GITHUB_TOKEN=ghp_tu_token_real
AZURE_STT_KEY=tu_llave_real
AZURE_STT_ENDPOINT=https://frigovoice-ai-hub.cognitiveservices.azure.com/
TELEGRAM_BOT_TOKEN=tu_token_real
SENTRY_DSN=tu_dsn_real
# ... etc
```

Guarda con `Ctrl+O`, cierra con `Ctrl+X`.

---

### FASE 7 — Arrancar el bot

```bash
# Copiar los scripts de deploy a la VM primero (desde tu PC):
scp -i C:\ruta\llave.pem deploy\3-run-bot.sh deploy\4-update-bot.sh \
    azureuser@IP_PUBLICA:~/frigo-ai/

# Dentro de la VM:
bash ~/frigo-ai/3-run-bot.sh TU_USUARIO_DOCKERHUB
```

Deberias ver:
```
[1/4] Descargando imagen desde Docker Hub... OK
[2/4] Deteniendo contenedor anterior (si existe)... No habia contenedor anterior
[3/4] Iniciando bot... Contenedor iniciado en background
[4/4] Verificando arranque (5 segundos)... Estado: RUNNING
============================================
  Bot desplegado correctamente.
============================================
```

---

## Operaciones del dia a dia

### Ver logs del bot en vivo
```bash
docker logs -f frigo-ai
```

### Ver estado del contenedor
```bash
docker ps
```

### Reiniciar el bot (sin cambiar imagen)
```bash
docker restart frigo-ai
```

### Actualizar a una nueva version
```bash
# En tu PC: construir y subir nueva version
.\deploy\1-build-push.ps1 -DockerUser tu_usuario_dockerhub -Tag v1.1.0

# En la VM: actualizar
bash ~/frigo-ai/4-update-bot.sh tu_usuario_dockerhub v1.1.0
```

### Detener el bot
```bash
docker stop frigo-ai
```

### Ver cuanto disco usa Docker
```bash
docker system df
```

### Limpiar imagenes viejas (liberar espacio en el disco de 30 GB)
```bash
docker image prune -f
```

---

## Monitoreo

- **Sentry**: abre [sentry.io](https://sentry.io) → Issues. Cada error del bot llega ahi con stack trace.
- **Logs de la VM**: `docker logs --tail 100 frigo-ai`
- **Metricas de la VM**: Azure Portal → tu VM → Monitoring → Metrics (CPU, red, disco)

---

## Preguntas frecuentes

### "El bot se cayo en la noche, que hago?"
Con `--restart unless-stopped` el bot se reinicia automaticamente si crashea.
Si la VM entera se reinicio (Azure la puede reiniciar por mantenimiento), el bot
vuelve a levantarse solo al arrancar Docker.

### "Pierdo las conversaciones si se reinicia?"
Con `CHECKPOINTER_BACKEND=memory` (el default): SI, las conversaciones en curso
se pierden. El bot vuelve a responder, pero sin contexto anterior.
Si quieres persistencia: agrega una Azure PostgreSQL y cambia a `CHECKPOINTER_BACKEND=postgres`.

### "Como cambio una variable de entorno sin rearmar la imagen?"
```bash
# En la VM:
nano ~/frigo-ai/.env.frigo  # editar
bash ~/frigo-ai/3-run-bot.sh TU_USUARIO_DOCKERHUB  # reiniciar con nuevos valores
```
No necesitas hacer docker build ni push.

### "Me quedo sin espacio en disco (30 GB)"
```bash
docker system prune -f       # elimina contenedores parados e imagenes sin tag
docker image prune -a -f     # elimina TODAS las imagenes no usadas (cuidado)
```

### "Cuantas horas gratis tengo en Azure Student?"
750 horas/mes para la B1s. El mes tiene ~720 horas, asi que cubre el 100%
si tienes solo esta VM corriendo.

### "Como hago SSH desde Windows sin el .pem cada vez?"
Agrega esto a `C:\Users\TU_USUARIO\.ssh\config`:
```
Host frigo-vm
    HostName IP_PUBLICA_AZURE
    User azureuser
    IdentityFile C:\ruta\a\tu-llave.pem
```
Luego: `ssh frigo-vm`
````

## File: DEPLOYMENT.md
````markdown
# Despliegue de FrigoIA en produccion

Guia completa para subir el bot a un servidor con observabilidad (Sentry),
trazabilidad (LangSmith) y resiliencia (timeouts, retries, persistencia de
estado). Incluye la seccion "preguntas frecuentes" al final.

## 1. Arquitectura del despliegue

```
+-------------------+      +-----------------+      +-----------------+
|   Operarios       |      |  FrigoIA        |      |  Servicios      |
|   Telegram/Voz    |----> |  container      |----> |  externos       |
+-------------------+      |                 |      |                 |
                           |  telegram_bot   |      | - Azure SQL     |
                           |  agent (LLM)    |      | - Whisper STT   |
                           |  MCP server     |      | - LLM proxy     |
                           |                 |      |                 |
                           +--------+--------+      +-----------------+
                                    |
                 +------------------+--------------------+
                 |                  |                    |
           +-----v-----+      +-----v------+      +------v-------+
           | Postgres  |      |  Sentry    |      |  LangSmith   |
           | (estado)  |      |  (errores) |      |  (trazas)    |
           +-----------+      +------------+      +--------------+
```

Componentes nuevos tras este sprint:
- `db_utils.py`: capa compartida de DB con timeouts y retries.
- `tool_result.py`: contrato JSON `{status, code, message, data}` para todas las tools.
- `state_backends.py`: factory swappable de checkpointer (memory / postgres).
- `observability.py`: Sentry + metricas + spans.
- `Dockerfile`: imagen multi-stage con ODBC Driver 18 y usuario no-root.

## 2. Pre-requisitos

- Cuenta en tu proveedor de nube o servidor con Docker instalado.
- Acceso a Azure SQL Server (pueden ser las mismas credenciales existentes).
- (Opcional) DSN de Sentry: crea un proyecto Python en [sentry.io](https://sentry.io).
- (Opcional) API key de [LangSmith](https://smith.langchain.com) para trazas del LLM.
- (Opcional) Postgres para persistir estado conversacional.

## 3. Variables de entorno criticas

Copia `.env.example` a `.env` y llena al menos estas:

| Variable | Obligatorio | Por que |
|---|---|---|
| `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD` | Si | Sin estas el proceso NO arranca (fail-fast). |
| `TELEGRAM_BOT_TOKEN` | Si | Token del bot @BotFather. |
| `GITHUB_TOKEN` | Si | Auth para GitHub Models (LLM). |
| `AZURE_STT_KEY`, `AZURE_STT_ENDPOINT` | Si | Para notas de voz. |
| `SENTRY_DSN` | No | Activa reporte de errores. |
| `LANGSMITH_API_KEY` | No | Activa trazas detalladas del LLM. |
| `CHECKPOINTER_BACKEND=postgres` + `PG_DATABASE_URL` | No | Persiste estado conversacional entre reinicios. |

## 4. Build y run local con Docker

```bash
docker build -t frigo-ai:latest .

docker run --rm \
  --name frigo-ai \
  --env-file .env \
  frigo-ai:latest
```

Logs esperados al arrancar:
```
Observability: Sentry activo (env=production, release=frigo-ai@1.0.0, traces=0.10)
Observability: LangSmith activo -> proyecto 'frigovoice-production'
state_backends: usando MemorySaver (backend=memory)
FrigoVoice Telegram Bot iniciado. Esperando mensajes...
```

Si ves `Observability: Sentry no configurado`, no hay DSN: Sentry queda apagado
pero el bot funciona normalmente.

## 5. Deploy a un servidor

### Opcion A: Railway / Fly.io / Render

1. Subir el repo a GitHub.
2. Conectar el proyecto a la plataforma y seleccionar "Deploy from Dockerfile".
3. Definir las variables de entorno desde el panel de la plataforma (NO subir el `.env` al repo).
4. La plataforma construye la imagen y la expone. No necesitas hacer mas nada.

### Opcion B: VPS con Docker + systemd

1. Instalar Docker en el VPS.
2. Clonar el repo en `/opt/frigo-ai` y crear `.env` (modo 600, solo root).
3. Crear `/etc/systemd/system/frigo-ai.service`:

```ini
[Unit]
Description=FrigoIA Telegram Bot
After=docker.service
Requires=docker.service

[Service]
Restart=always
RestartSec=10
ExecStartPre=-/usr/bin/docker stop frigo-ai
ExecStartPre=-/usr/bin/docker rm frigo-ai
ExecStartPre=/usr/bin/docker build -t frigo-ai:latest /opt/frigo-ai
ExecStart=/usr/bin/docker run --rm --name frigo-ai --env-file /opt/frigo-ai/.env frigo-ai:latest
ExecStop=/usr/bin/docker stop frigo-ai

[Install]
WantedBy=multi-user.target
```

4. `systemctl enable --now frigo-ai`.

### Opcion C: Kubernetes (escala horizontal)

Solo si necesitas alta disponibilidad. Activa `CHECKPOINTER_BACKEND=postgres`
para compartir estado entre replicas. Crea un `Secret` para las credenciales
y un `Deployment` con `replicas: 2+`.

## 6. Validacion post-despliegue

Lista de chequeo al levantar un entorno nuevo:

- [ ] `docker logs frigo-ai` muestra "Telegram Bot iniciado".
- [ ] Enviar `/start` al bot en Telegram responde en menos de 2s.
- [ ] Preguntar "Que formularios tengo?" -> el bot responde con la lista real.
- [ ] Provocar un error (apagar Azure SQL momentaneamente): las tools deben
      responder con `status: error, code: DB_UNAVAILABLE` en lugar de colgar.
- [ ] Si Sentry esta activado, el error aparece en sentry.io (busca `environment=production`).
- [ ] Si LangSmith esta activado, la traza del request aparece en smith.langchain.com.
- [ ] Reiniciar el contenedor. Si CHECKPOINTER_BACKEND=postgres, un operario
      que estaba en medio de una conversacion puede continuar. Si esta en
      memory, debe empezar de cero (comportamiento esperado).

## 7. Operaciones comunes

- Ver metricas en caliente:
  ```python
  from observability import dump_metrics
  print(dump_metrics())
  ```
  Puedes exponer esto en un endpoint `/health` si agregas FastAPI al contenedor.
- Cambiar de MemorySaver a Postgres sin rebuild:
  ```bash
  docker run -e CHECKPOINTER_BACKEND=postgres -e PG_DATABASE_URL=... frigo-ai:latest
  ```
- Ajustar timeouts en caliente (ejemplo para SQL mas agresivo):
  ```bash
  docker run -e SQL_TIMEOUT_SECONDS=10 -e SQL_MAX_RETRIES=2 frigo-ai:latest
  ```

## 8. Preguntas frecuentes que probablemente tendras

### "Por que el mensaje del operario NO se envia a Sentry?"
Deliberadamente: los mensajes de los operarios son datos operativos potencialmente
sensibles (lotes, pesos, temperaturas, identidades). En `observability._sentry_before_send`
filtramos antes de enviar. Solo se envian stack traces y tags tecnicos (chat_id,
tool_name, error_code). Si quieres adjuntar mensajes para debugging puntual, usalo
como `extra` en un `log_error(...)` controlado.

### "El bot respondio mal ante un error: simulo datos cuando la BD estaba caida"
Esto es un problema del SYSTEM_PROMPT, no del codigo. Con las tools devolviendo
JSON `{status:error, code:DB_UNAVAILABLE}`, el prompt YA instruye al modelo a
NO inventar datos. Si aun asi pasa:
1. Revisa en LangSmith la traza: el ToolMessage deberia decir `"status":"error"`.
2. Si el ToolMessage es correcto pero el LLM lo ignora, el modelo (gpt-4o-mini)
   puede no estar siguiendo instrucciones. Sube a `gpt-4o` cambiando `GITHUB_MODEL`.
3. Como ultima opcion, agrega una guardia en `tools_node`: si cualquier tool
   devolvio `status:error` transitorio, corta el ciclo y responde al operario
   con un mensaje fijo ("servicio momentaneamente indisponible").

### "Cuanto me cuesta cada mensaje del operario?"
Con las optimizaciones actuales (MAX_CONTEXT_TOKENS=8000, LLM cacheado,
trim automatico):
- Un mensaje simple ("que formularios tengo"): 1 llamada al LLM, ~1k tokens.
- Una trazabilidad de lote: 2-3 llamadas (LLM + tool + LLM), ~3-5k tokens.
- Si GITHUB_MODEL=gpt-4o-mini: centavos de USD por mensaje.
- Si GITHUB_MODEL=gpt-4o: 10-20x mas caro. Usalo solo si gpt-4o-mini da respuestas
  malas en produccion.

### "Por que no usaron un pool de conexiones pyodbc?"
pyodbc NO tiene pool nativo. En Python las opciones son:
- `aioodbc` + pool asyncio: alternativa solida pero requiere refactor de
  `db_utils.run_sql` para que no use `asyncio.to_thread`.
- `SQLAlchemy` async: demasiado overhead para 8 queries.
- `threading.local` con conexiones reutilizables: funciona, pero agrega
  complejidad por thread-safety.

Con ~20 operarios concurrentes y <10 queries/minuto, abrir/cerrar conexion por
query (~300ms handshake) es aceptable. Si el volumen crece, migrar a `aioodbc`
es el siguiente paso; el contrato de `db_utils.run_sql` queda igual.

### "Que pasa si Azure SQL esta caido?"
Cada query intenta 3 veces con backoff exponencial (0.5s, 1s, 2s). Si todas
fallan, la tool devuelve `status:error, code:DB_UNAVAILABLE`. El SYSTEM_PROMPT
instruye al LLM a informar al operario de forma clara y no inventar datos.
Sentry recibe un evento para que el equipo de infra reaccione. El bot NO se
cae: sigue respondiendo a otros operarios y a mensajes que no requieran SQL.

### "Si reinicio el contenedor, los operarios pierden el hilo de la conversacion?"
- Con `CHECKPOINTER_BACKEND=memory` (default): SI. Todos empiezan de cero.
- Con `CHECKPOINTER_BACKEND=postgres`: NO. El estado persiste. Si un operario
  estaba contestando un interrupt, al volver el contenedor puede seguir.
  Recomendado para produccion.

### "Como hago rollback si subo una version mala?"
1. Taguea cada imagen: `docker build -t frigo-ai:v1.2.3 .`
2. Guarda la imagen anterior antes de desplegar: `docker tag frigo-ai:prod frigo-ai:prev`
3. Si algo sale mal: `docker run frigo-ai:prev` y listo.
4. En Kubernetes: `kubectl rollout undo deployment/frigo-ai`.

### "Cuales son las siguientes mejoras (sprint 2)?"
Con el estado actual ya estas en territorio Senior. Cosas que quedan:
1. **Tests de integracion con mocks** (pytest + pytest-asyncio + aioresponses).
   Mockear pyodbc y httpx para validar retry/timeout sin tocar produccion.
2. **Connection pool real para pyodbc** si el volumen supera 50 QPS.
3. **Redis para `_pending_resume`** en telegram_bot si escalas a multiples replicas.
4. **Endpoint `/metrics`** que exponga `dump_metrics()` en formato Prometheus.
5. **Circuit breaker para el LLM**: si Azure OpenAI esta caido por 5 min, cortar
   y responder "servicio de IA temporalmente indisponible" sin consumir tokens
   en reintentos.
6. **Migracion a `aioodbc`** si la latencia del handshake TLS de SQL Server
   se vuelve dominante (raro).

### "Podes auditar todas las queries SQL que hizo el bot hoy?"
Si: LangSmith graba cada ToolMessage (incluye el `data` con detalles de la
query). Ademas los contadores `frigo.tool.call{tool=rastrear_lote}` dan
volumen agregado. Para queries crudas, activa logging DEBUG en `db_utils.run_sql`
y redirige a stdout / CloudWatch / Loki.

### "Como evito que un operario malicioso saque datos sensibles?"
- La arquitectura MCP ya hace de gatekeeper: el LLM no accede a la BD
  directamente, solo puede llamar tools con parametros controlados.
- Ningun tool permite SQL crudo: todo es parametrizado con `cur.execute(..., [params])`.
- Las queries son read-only salvo `guardar_borrador` (write controlado).
- Activar `ALLOWED_CHAT_IDS` en `telegram_bot.py` para whitelist de operarios autorizados.
- Las transcripciones de voz NO se guardan mas alla del mensaje actual.
````

## File: Dockerfile
````dockerfile
# syntax=docker/dockerfile:1.7
#
# Dockerfile de produccion para FrigoIA (telegram_bot.py + agent.py)
#
# Decisiones de diseno:
#   * Base: python:3.12-slim-bookworm. Bookworm tiene paquetes actualizados y
#     mas ligeros que bullseye; slim evita doc y utilidades innecesarias.
#   * Multi-stage: la etapa `builder` compila wheels pesados (pyodbc) y la
#     etapa `runtime` solo lleva la venv final -> imagen ~60% mas pequena.
#   * ODBC Driver 18 de Microsoft para SQL Server (igual que en Azure portal).
#   * Usuario no-root (appuser, UID 1001): principio de menor privilegio.
#   * tini como PID 1: maneja signals correctamente para graceful shutdown.
#
# Build:
#   docker build -t frigo-ai:latest .
#
# Run:
#   docker run --rm --env-file .env --name frigo-ai frigo-ai:latest

ARG PYTHON_VERSION=3.12

# =========================================================================
# Stage 1: builder - compila dependencias y crea la venv aislada
# =========================================================================
FROM python:${PYTHON_VERSION}-slim-bookworm AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

# Librerias de sistema necesarias para compilar pyodbc y psycopg2.
# unixodbc-dev provee los headers para compilar el wheel de pyodbc.
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      curl \
      gnupg \
      ca-certificates \
      unixodbc-dev \
      libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Creamos la venv dentro de /opt/venv para poder copiarla al runtime stage.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt


# =========================================================================
# Stage 2: runtime - imagen final con solo lo necesario para correr
# =========================================================================
FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Paso 1: instalar utilidades base (curl para healthcheck, tini para PID 1).
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl \
      gnupg \
      ca-certificates \
      tini \
      unixodbc \
      libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Paso 2: agregar repositorio oficial de Microsoft y ODBC Driver 18.
# ACCEPT_EULA=Y requerido por la licencia de Microsoft.
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
      | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
      > /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 && \
    rm -rf /var/lib/apt/lists/*

# Copiamos la venv compilada desde el builder.
COPY --from=builder /opt/venv /opt/venv

# Creamos usuario sin privilegios.
RUN groupadd --system --gid 1001 appuser && \
    useradd  --system --uid 1001 --gid appuser --shell /sbin/nologin --create-home appuser

WORKDIR /app
COPY --chown=appuser:appuser . /app

# Hardening adicional: no permitir que el proceso escriba fuera de /tmp/app.
USER appuser

# Puerto expuesto: FastAPI escucha en 8000 (modo webhook / API REST).
# En modo polling (VM) el contenedor no recibe trafico entrante, pero
# el puerto se declara igualmente para que Azure Container Apps pueda
# hacer health checks HTTP.
EXPOSE 8000

# tini como init: garantiza que SIGTERM llegue al proceso Python y no se
# quede zombie en Docker. Sin tini, python-telegram-bot puede tardar en cerrar.
ENTRYPOINT ["/usr/bin/tini", "--"]

# Healthcheck HTTP: usa el endpoint /health del servidor FastAPI.
# Azure Container Apps lo sondea cada 30s para saber si el contenedor esta vivo.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Modo por defecto: webhook + API REST via FastAPI (Azure Container Apps).
# Para modo polling (VM B1s) sobrescribir con:
#   docker run ... frigo-ai:latest python telegram_bot.py
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
````

## File: eval_agent.py
````python
"""
eval_agent.py - Framework de Evaluación GenAI para FrigoIA

Implementa evaluación sistemática del agente con tres capas:
  1. LLM-as-Judge  — GPT-4o evalúa la respuesta del agente (task_completion,
                     no_hallucination, language_compliance).
  2. Tool Precision — verifica que el agente llamó las herramientas correctas.
  3. Regression     — compara con respuestas de referencia del dominio Frigolab.

Resultados:
  - Se guardan en eval_results_<timestamp>.json (siempre).
  - Se suben a LangSmith como "dataset run" si LANGSMITH_API_KEY está configurado.

Uso:
    python eval_agent.py                         # evalúa todos los casos
    python eval_agent.py --suite trazabilidad    # solo la suite indicada
    python eval_agent.py --dry-run               # sin llamadas reales al LLM
    python eval_agent.py --case trace_001        # evalúa un caso específico
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any

from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)
logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)


# =============================================================================
# Dataset de evaluación — casos representativos del dominio Frigolab
# =============================================================================

@dataclass
class EvalCase:
    """Un caso de prueba del agente."""
    id: str
    input: str
    expected_tools: list[str]         # tools que deben ser llamadas
    expected_keywords: list[str]      # palabras clave esperadas en la respuesta
    forbidden_phrases: list[str]      # indicadores de alucinación o error
    category: str                     # trazabilidad | formularios | analisis | edge
    description: str = ""
    reference_answer: str = ""        # respuesta de referencia (opcional)


EVAL_DATASET: list[EvalCase] = [
    # ─── Trazabilidad ───────────────────────────────────────────────────────
    EvalCase(
        id="trace_001",
        input="quiero rastrear el lote ABC-2024-001",
        expected_tools=["rastrear_lote_tool"],
        expected_keywords=["lote", "ABC-2024-001"],
        forbidden_phrases=["inventé", "no tengo acceso", "no puedo acceder"],
        category="trazabilidad",
        description="Rastreo básico de lote por número exacto",
    ),
    EvalCase(
        id="trace_002",
        input="que etapas le faltan al lote XYZ-0042 para estar completo",
        expected_tools=["analizar_brecha_lote_tool"],
        expected_keywords=["lote", "etapa", "XYZ-0042"],
        forbidden_phrases=["asumo", "probablemente", "creo que"],
        category="trazabilidad",
        description="Análisis de brecha — etapas faltantes de un lote",
    ),
    EvalCase(
        id="trace_003",
        input="dame la lista de lotes de esta semana",
        expected_tools=["listar_lotes_tool"],
        expected_keywords=["lote"],
        forbidden_phrases=["no tengo información", "inventé"],
        category="trazabilidad",
        description="Listado de lotes recientes",
    ),
    EvalCase(
        id="trace_004",
        input="el lote 9999 está completo?",
        expected_tools=["analizar_brecha_lote_tool"],
        expected_keywords=["lote", "9999"],
        forbidden_phrases=["asumo que sí", "debería estar"],
        category="trazabilidad",
        description="Verificación de completitud de lote",
    ),
    # ─── Formularios ────────────────────────────────────────────────────────
    EvalCase(
        id="form_001",
        input="quiero llenar el formulario de fileteo FOR-PD-04",
        expected_tools=["obtener_esquema_formulario_tool"],
        expected_keywords=["formulario", "FOR-PD-04", "campo"],
        forbidden_phrases=["no existe ese formulario", "asumo los campos"],
        category="formularios",
        description="Solicitud de esquema de formulario antes de dictado",
    ),
    EvalCase(
        id="form_002",
        input="guardar borrador del formulario de control de sellos con lote 2024-10",
        expected_tools=["guardar_borrador_tool"],
        expected_keywords=["borrador", "guardado"],
        forbidden_phrases=["no pude guardar porque no tengo acceso"],
        category="formularios",
        description="Guardado de borrador de formulario",
    ),
    EvalCase(
        id="form_003",
        input="necesito el esquema del formulario de liberacion de tunel",
        expected_tools=["obtener_esquema_formulario_tool"],
        expected_keywords=["formulario", "campo"],
        forbidden_phrases=["inventé los campos"],
        category="formularios",
        description="Esquema de formulario por nombre parcial",
    ),
    # ─── Análisis / Estadísticas ─────────────────────────────────────────────
    EvalCase(
        id="analisis_001",
        input="dame el resumen del día, como vamos en producción",
        expected_tools=["resumen_negocio_tool"],
        expected_keywords=["lote", "formulario", "cumplimiento"],
        forbidden_phrases=["no tengo datos de hoy", "inventé"],
        category="analisis",
        description="Dashboard diario de producción",
    ),
    EvalCase(
        id="analisis_002",
        input="cuál es el porcentaje de cumplimiento de formularios esta semana",
        expected_tools=["estadisticas_formularios_tool"],
        expected_keywords=["%", "formulario"],
        forbidden_phrases=["no puedo calcular", "asumo"],
        category="analisis",
        description="Estadísticas de cumplimiento de formularios",
    ),
    EvalCase(
        id="analisis_003",
        input="analiza las temperaturas del formulario FOR-CC-10 del último mes",
        expected_tools=["analizar_datos_formulario_tool"],
        expected_keywords=["temperatura", "FOR-CC-10"],
        forbidden_phrases=["no tengo acceso a temperaturas", "inventé"],
        category="analisis",
        description="Análisis de datos dentro de un tipo de formulario",
    ),
    # ─── Edge cases ─────────────────────────────────────────────────────────
    EvalCase(
        id="edge_001",
        input="hola",
        expected_tools=[],
        expected_keywords=["hola", "ayudar", "frigolab"],
        forbidden_phrases=["error", "no entiendo"],
        category="edge",
        description="Saludo simple — no debe llamar tools",
    ),
    EvalCase(
        id="edge_002",
        input="cuál es la capital de Francia",
        expected_tools=[],
        expected_keywords=["Frigolab", "producción", "formulario"],
        forbidden_phrases=["París", "capital", "Francia"],
        category="edge",
        description="Pregunta fuera de dominio — debe rechazar gentilmente",
    ),
    EvalCase(
        id="edge_003",
        input="hay alertas de temperatura crítica ahora mismo",
        expected_tools=["resumen_negocio_tool"],
        expected_keywords=["temperatura", "alerta"],
        forbidden_phrases=["no monitoreo temperaturas", "inventé"],
        category="edge",
        description="Alerta de temperatura — debe consultar datos reales",
    ),
]


# =============================================================================
# Runner: ejecuta el agente sobre un caso
# =============================================================================

async def _run_case_live(case: EvalCase) -> dict[str, Any]:
    """Ejecuta el agente real (modo live). Requiere BD y LLM configurados."""
    from agent import run_agent
    start = time.perf_counter()
    try:
        result = await run_agent(case.input, conversation_history=None)
        elapsed_ms = (time.perf_counter() - start) * 1000
        return {
            "response": result.get("response", ""),
            "tools_used": result.get("tools_used", []),
            "tool_results": result.get("tool_results", []),
            "elapsed_ms": round(elapsed_ms, 1),
            "error": None,
        }
    except Exception as exc:
        return {
            "response": "",
            "tools_used": [],
            "tool_results": [],
            "elapsed_ms": round((time.perf_counter() - start) * 1000, 1),
            "error": str(exc),
        }


def _run_case_dry(case: EvalCase) -> dict[str, Any]:
    """Modo dry-run: simula una respuesta sin llamar al agente real."""
    mock_response = (
        f"[DRY-RUN] Procesando: {case.input[:60]}... "
        f"(herramientas esperadas: {', '.join(case.expected_tools) or 'ninguna'})"
    )
    return {
        "response": mock_response,
        "tools_used": case.expected_tools,  # simulamos que llamó las correctas
        "tool_results": ["[mock]"],
        "elapsed_ms": 0.0,
        "error": None,
    }


# =============================================================================
# Evaluadores
# =============================================================================

@dataclass
class EvalScore:
    name: str
    score: float          # 0.0 – 1.0
    passed: bool
    reasoning: str = ""


def eval_tool_precision(case: EvalCase, run: dict[str, Any]) -> EvalScore:
    """Evalúa si el agente llamó las tools correctas (sin extras ni faltantes).

    Métrica: F1 entre expected_tools y tools_used.
    Si expected_tools está vacío, pasa si tools_used también está vacío.
    """
    expected = set(case.expected_tools)
    used = set(run["tools_used"])

    if not expected:
        passed = len(used) == 0
        score = 1.0 if passed else 0.0
        return EvalScore(
            name="tool_precision",
            score=score,
            passed=passed,
            reasoning=(
                "Sin tools esperadas y ninguna usada — correcto."
                if passed
                else f"Se esperaba que no llamara tools pero llamó: {used}"
            ),
        )

    tp = len(expected & used)
    fp = len(used - expected)
    fn = len(expected - used)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    return EvalScore(
        name="tool_precision",
        score=round(f1, 3),
        passed=f1 >= 0.8,
        reasoning=(
            f"F1={f1:.2f} | esperadas={expected} | usadas={used} | "
            f"TP={tp}, FP={fp}, FN={fn}"
        ),
    )


def eval_language_compliance(case: EvalCase, run: dict[str, Any]) -> EvalScore:
    """Verifica que la respuesta esté en español (mínimo heurístico)."""
    response = run["response"].lower()
    if not response or run["error"]:
        return EvalScore(
            name="language_compliance",
            score=0.0,
            passed=False,
            reasoning="Sin respuesta o error en ejecución.",
        )

    # Palabras comunes del español que no aparecen en inglés puro
    spanish_markers = ["el ", "la ", "los ", "las ", "de ", "en ", "que ", "y ", "no ", "se "]
    spanish_count = sum(1 for w in spanish_markers if w in response)
    score = min(1.0, spanish_count / 4)
    passed = spanish_count >= 3

    return EvalScore(
        name="language_compliance",
        score=round(score, 3),
        passed=passed,
        reasoning=f"Marcadores de español encontrados: {spanish_count}/10",
    )


def eval_no_hallucination(case: EvalCase, run: dict[str, Any]) -> EvalScore:
    """Detecta frases que indican que el agente inventó datos o no usó tools."""
    response = run["response"].lower()
    if not response or run["error"]:
        return EvalScore(
            name="no_hallucination",
            score=0.0,
            passed=False,
            reasoning="Sin respuesta o error en ejecución.",
        )

    found = [phrase for phrase in case.forbidden_phrases if phrase.lower() in response]
    passed = len(found) == 0
    score = 0.0 if found else 1.0

    return EvalScore(
        name="no_hallucination",
        score=score,
        passed=passed,
        reasoning=(
            f"Frases prohibidas detectadas: {found}" if found
            else "Ninguna frase de alucinación detectada."
        ),
    )


async def eval_task_completion_llm(
    case: EvalCase,
    run: dict[str, Any],
    judge_llm,
) -> EvalScore:
    """Evalúa con un LLM-as-Judge si la tarea fue completada correctamente.

    Usa GPT-4o como juez neutral. El prompt sigue el patrón estándar de
    evaluación con criterios explícitos y puntuación 1-5.
    """
    from langchain_core.messages import HumanMessage, SystemMessage

    if run["error"] or not run["response"]:
        return EvalScore(
            name="task_completion",
            score=0.0,
            passed=False,
            reasoning=f"Agente falló con error: {run.get('error', 'sin respuesta')}",
        )

    judge_system = """Eres un evaluador experto de sistemas de IA para plantas de producción industrial.
Tu tarea es evaluar si un agente de IA completó correctamente la solicitud de un operario.

Responde ÚNICAMENTE con un JSON con este formato exacto:
{
  "score": <número del 1 al 5>,
  "reasoning": "<explicación breve en español>"
}

Criterios de puntuación:
5 — Respuesta completa, precisa y útil. El agente usó las herramientas correctas y proveyó información relevante.
4 — Respuesta buena con detalles menores faltantes.
3 — Respuesta parcial o con alguna imprecisión no crítica.
2 — Respuesta pobre, falta información importante o hay errores.
1 — Respuesta incorrecta, fuera de tema, o el agente alucinó datos."""

    judge_human = f"""SOLICITUD DEL OPERARIO:
{case.input}

RESPUESTA DEL AGENTE:
{run["response"][:1000]}

HERRAMIENTAS USADAS:
{", ".join(run["tools_used"]) or "ninguna"}

HERRAMIENTAS ESPERADAS:
{", ".join(case.expected_tools) or "ninguna"}

Evalúa si la respuesta del agente completó correctamente la solicitud."""

    try:
        result = await judge_llm.ainvoke([
            SystemMessage(content=judge_system),
            HumanMessage(content=judge_human),
        ])
        parsed = json.loads(result.content.strip())
        raw_score = int(parsed.get("score", 1))
        normalized = (raw_score - 1) / 4  # 1-5 → 0.0-1.0
        return EvalScore(
            name="task_completion",
            score=round(normalized, 3),
            passed=raw_score >= 4,
            reasoning=parsed.get("reasoning", ""),
        )
    except Exception as exc:
        log.warning("LLM judge falló para caso %s: %s", case.id, exc)
        return EvalScore(
            name="task_completion",
            score=0.5,
            passed=False,
            reasoning=f"Error al invocar LLM judge: {exc}",
        )


def eval_keyword_coverage(case: EvalCase, run: dict[str, Any]) -> EvalScore:
    """Verifica que la respuesta mencione las palabras clave esperadas."""
    response = run["response"].lower()
    if not response or run["error"]:
        return EvalScore(
            name="keyword_coverage",
            score=0.0,
            passed=False,
            reasoning="Sin respuesta o error.",
        )

    if not case.expected_keywords:
        return EvalScore(
            name="keyword_coverage",
            score=1.0,
            passed=True,
            reasoning="Sin keywords requeridas.",
        )

    found = [kw for kw in case.expected_keywords if kw.lower() in response]
    score = len(found) / len(case.expected_keywords)
    return EvalScore(
        name="keyword_coverage",
        score=round(score, 3),
        passed=score >= 0.7,
        reasoning=f"Encontradas: {found} / Requeridas: {case.expected_keywords}",
    )


# =============================================================================
# Resultado de evaluación
# =============================================================================

@dataclass
class CaseResult:
    case_id: str
    category: str
    description: str
    input: str
    response: str
    tools_used: list[str]
    elapsed_ms: float
    scores: list[EvalScore]
    overall_passed: bool = False
    overall_score: float = 0.0
    error: str | None = None

    def compute_overall(self) -> None:
        if self.scores:
            self.overall_score = round(sum(s.score for s in self.scores) / len(self.scores), 3)
            self.overall_passed = all(s.passed for s in self.scores)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["scores"] = [asdict(s) for s in self.scores]
        return d


# =============================================================================
# Runner principal
# =============================================================================

async def evaluate_case(
    case: EvalCase,
    judge_llm,
    dry_run: bool = False,
) -> CaseResult:
    """Ejecuta un caso completo: run → evalúa → devuelve CaseResult."""
    log.info("Evaluando caso %s: %s", case.id, case.description)

    if dry_run:
        run = _run_case_dry(case)
    else:
        run = await _run_case_live(case)

    scores = [
        eval_tool_precision(case, run),
        eval_language_compliance(case, run),
        eval_no_hallucination(case, run),
        eval_keyword_coverage(case, run),
    ]

    # LLM-as-judge (más costoso, siempre al final)
    if not dry_run and judge_llm is not None:
        llm_score = await eval_task_completion_llm(case, run, judge_llm)
        scores.append(llm_score)

    result = CaseResult(
        case_id=case.id,
        category=case.category,
        description=case.description,
        input=case.input,
        response=run["response"],
        tools_used=run["tools_used"],
        elapsed_ms=run["elapsed_ms"],
        scores=scores,
        error=run["error"],
    )
    result.compute_overall()
    return result


async def run_evaluation(
    suite: str | None = None,
    case_id: str | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Ejecuta la evaluación completa y devuelve el reporte."""
    from agent import _build_llm
    from observability import configure_langsmith

    configure_langsmith()

    # Filtrar dataset
    cases = EVAL_DATASET
    if suite:
        cases = [c for c in cases if c.category == suite]
    if case_id:
        cases = [c for c in cases if c.id == case_id]

    if not cases:
        log.warning("No se encontraron casos para suite=%s case_id=%s", suite, case_id)
        return {"results": [], "summary": {}}

    log.info("Iniciando evaluación: %d casos (dry_run=%s)", len(cases), dry_run)

    # Judge LLM (temperatura 0 para reproducibilidad)
    judge_llm = None
    if not dry_run:
        try:
            judge_llm = _build_llm(temperature=0.0)
            log.info("LLM judge inicializado.")
        except Exception as exc:
            log.warning("No se pudo inicializar el LLM judge: %s", exc)

    # Ejecutar todos los casos
    results: list[CaseResult] = []
    for case in cases:
        try:
            result = await evaluate_case(case, judge_llm, dry_run=dry_run)
            results.append(result)
            status = "PASS" if result.overall_passed else "FAIL"
            log.info(
                "[%s] %s — score=%.2f elapsed=%.0fms",
                status, result.case_id, result.overall_score, result.elapsed_ms,
            )
        except Exception as exc:
            log.error("Error evaluando caso %s: %s", case.id, exc, exc_info=True)

    # Resumen global
    summary = _compute_summary(results)
    _log_summary(summary)

    # Exportar a JSON
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"eval_results_{timestamp}.json"
    report = {
        "timestamp": timestamp,
        "dry_run": dry_run,
        "suite_filter": suite,
        "case_filter": case_id,
        "total_cases": len(results),
        "summary": summary,
        "results": [r.to_dict() for r in results],
    }
    try:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        log.info("Resultados guardados en: %s", output_file)
    except Exception as exc:
        log.warning("No se pudo guardar el archivo de resultados: %s", exc)

    # Subir a LangSmith si está configurado
    _upload_to_langsmith(report, results)

    return report


def _compute_summary(results: list[CaseResult]) -> dict:
    """Calcula métricas agregadas por categoría y global."""
    if not results:
        return {}

    total = len(results)
    passed = sum(1 for r in results if r.overall_passed)

    # Por categoría
    by_category: dict[str, dict] = {}
    for r in results:
        cat = r.category
        if cat not in by_category:
            by_category[cat] = {"total": 0, "passed": 0, "scores": []}
        by_category[cat]["total"] += 1
        by_category[cat]["passed"] += int(r.overall_passed)
        by_category[cat]["scores"].append(r.overall_score)

    category_summary = {}
    for cat, data in by_category.items():
        category_summary[cat] = {
            "pass_rate": round(data["passed"] / data["total"], 3),
            "avg_score": round(sum(data["scores"]) / len(data["scores"]), 3),
            "total": data["total"],
        }

    # Por evaluador
    evaluator_scores: dict[str, list[float]] = {}
    for r in results:
        for s in r.scores:
            evaluator_scores.setdefault(s.name, []).append(s.score)

    evaluator_summary = {
        name: round(sum(scores) / len(scores), 3)
        for name, scores in evaluator_scores.items()
    }

    avg_elapsed = sum(r.elapsed_ms for r in results) / total

    return {
        "pass_rate": round(passed / total, 3),
        "avg_score": round(sum(r.overall_score for r in results) / total, 3),
        "total_passed": passed,
        "total_cases": total,
        "avg_elapsed_ms": round(avg_elapsed, 1),
        "by_category": category_summary,
        "by_evaluator": evaluator_summary,
    }


def _log_summary(summary: dict) -> None:
    """Imprime el resumen de evaluación en consola."""
    if not summary:
        return
    print("\n" + "=" * 60)
    print("  EVALUACIÓN FRIGOAI — RESUMEN")
    print("=" * 60)
    print(f"  Pass rate global : {summary['pass_rate']:.1%} ({summary['total_passed']}/{summary['total_cases']})")
    print(f"  Score promedio   : {summary['avg_score']:.3f}")
    print(f"  Latencia promedio: {summary['avg_elapsed_ms']:.0f} ms")
    print()
    print("  Por categoría:")
    for cat, data in summary.get("by_category", {}).items():
        print(f"    {cat:<20} pass={data['pass_rate']:.1%}  score={data['avg_score']:.3f}")
    print()
    print("  Por evaluador:")
    for ev, score in summary.get("by_evaluator", {}).items():
        print(f"    {ev:<25} avg_score={score:.3f}")
    print("=" * 60 + "\n")


def _upload_to_langsmith(report: dict, results: list[CaseResult]) -> None:
    """Sube los resultados como dataset + experimento a LangSmith."""
    api_key = os.getenv("LANGSMITH_API_KEY", "").strip()
    if not api_key:
        log.info("LANGSMITH_API_KEY no configurado — omitiendo upload a LangSmith.")
        return
    try:
        from langsmith import Client
        client = Client(api_key=api_key)

        dataset_name = "FrigoIA-EvalSuite"
        # Crear dataset si no existe
        try:
            dataset = client.read_dataset(dataset_name=dataset_name)
        except Exception:
            dataset = client.create_dataset(
                dataset_name=dataset_name,
                description="Dataset de evaluación del agente FrigoIA (trazabilidad, formularios, análisis)",
            )

        # Subir ejemplos y feedback
        for r in results:
            try:
                client.create_example(
                    inputs={"input": r.input},
                    outputs={"response": r.response, "tools_used": r.tools_used},
                    dataset_id=dataset.id,
                    metadata={
                        "case_id": r.case_id,
                        "category": r.category,
                        "overall_score": r.overall_score,
                        "overall_passed": r.overall_passed,
                        "eval_timestamp": report["timestamp"],
                    },
                )
            except Exception as exc:
                log.debug("No se pudo subir ejemplo %s a LangSmith: %s", r.case_id, exc)

        log.info("Resultados subidos a LangSmith dataset '%s'", dataset_name)
    except ImportError:
        log.warning("langsmith SDK no instalado. Ejecuta: pip install langsmith")
    except Exception as exc:
        log.warning("Error subiendo a LangSmith: %s", exc)


# =============================================================================
# CLI
# =============================================================================

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluación GenAI del agente FrigoIA",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python eval_agent.py                         # evalúa todos los casos
  python eval_agent.py --suite trazabilidad    # solo trazabilidad
  python eval_agent.py --case trace_001        # un caso específico
  python eval_agent.py --dry-run               # sin llamadas reales al LLM
  python eval_agent.py --list                  # muestra los casos disponibles
        """,
    )
    parser.add_argument(
        "--suite",
        choices=["trazabilidad", "formularios", "analisis", "edge"],
        help="Filtrar por categoría",
    )
    parser.add_argument("--case", help="ID de un caso específico")
    parser.add_argument("--dry-run", action="store_true", help="Simular sin llamadas reales")
    parser.add_argument(
        "--list",
        action="store_true",
        help="Listar los casos disponibles y salir",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()

    if args.list:
        print(f"\n{'ID':<15} {'Categoría':<15} {'Descripción'}")
        print("-" * 65)
        for c in EVAL_DATASET:
            print(f"{c.id:<15} {c.category:<15} {c.description}")
        print(f"\nTotal: {len(EVAL_DATASET)} casos\n")
    else:
        asyncio.run(
            run_evaluation(
                suite=args.suite,
                case_id=args.case,
                dry_run=args.dry_run,
            )
        )
````

## File: eval_results_20260428_112945.json
````json
{
  "timestamp": "20260428_112945",
  "dry_run": true,
  "suite_filter": null,
  "case_filter": null,
  "total_cases": 13,
  "summary": {
    "pass_rate": 0.0,
    "avg_score": 0.75,
    "total_passed": 0,
    "total_cases": 13,
    "avg_elapsed_ms": 0.0,
    "by_category": {
      "trazabilidad": {
        "pass_rate": 0.0,
        "avg_score": 0.828,
        "total": 4
      },
      "formularios": {
        "pass_rate": 0.0,
        "avg_score": 0.785,
        "total": 3
      },
      "analisis": {
        "pass_rate": 0.0,
        "avg_score": 0.75,
        "total": 3
      },
      "edge": {
        "pass_rate": 0.0,
        "avg_score": 0.611,
        "total": 3
      }
    },
    "by_evaluator": {
      "tool_precision": 1.0,
      "language_compliance": 0.423,
      "no_hallucination": 0.923,
      "keyword_coverage": 0.654
    }
  },
  "results": [
    {
      "case_id": "trace_001",
      "category": "trazabilidad",
      "description": "Rastreo básico de lote por número exacto",
      "input": "quiero rastrear el lote ABC-2024-001",
      "response": "[DRY-RUN] Procesando: quiero rastrear el lote ABC-2024-001... (herramientas esperadas: rastrear_lote_tool)",
      "tools_used": [
        "rastrear_lote_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'rastrear_lote_tool'} | usadas={'rastrear_lote_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.25,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 1/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['lote', 'ABC-2024-001'] / Requeridas: ['lote', 'ABC-2024-001']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.812,
      "error": null
    },
    {
      "case_id": "trace_002",
      "category": "trazabilidad",
      "description": "Análisis de brecha — etapas faltantes de un lote",
      "input": "que etapas le faltan al lote XYZ-0042 para estar completo",
      "response": "[DRY-RUN] Procesando: que etapas le faltan al lote XYZ-0042 para estar completo... (herramientas esperadas: analizar_brecha_lote_tool)",
      "tools_used": [
        "analizar_brecha_lote_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'analizar_brecha_lote_tool'} | usadas={'analizar_brecha_lote_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.25,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 1/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['lote', 'etapa', 'XYZ-0042'] / Requeridas: ['lote', 'etapa', 'XYZ-0042']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.812,
      "error": null
    },
    {
      "case_id": "trace_003",
      "category": "trazabilidad",
      "description": "Listado de lotes recientes",
      "input": "dame la lista de lotes de esta semana",
      "response": "[DRY-RUN] Procesando: dame la lista de lotes de esta semana... (herramientas esperadas: listar_lotes_tool)",
      "tools_used": [
        "listar_lotes_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'listar_lotes_tool'} | usadas={'listar_lotes_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.5,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 2/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['lote'] / Requeridas: ['lote']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.875,
      "error": null
    },
    {
      "case_id": "trace_004",
      "category": "trazabilidad",
      "description": "Verificación de completitud de lote",
      "input": "el lote 9999 está completo?",
      "response": "[DRY-RUN] Procesando: el lote 9999 está completo?... (herramientas esperadas: analizar_brecha_lote_tool)",
      "tools_used": [
        "analizar_brecha_lote_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'analizar_brecha_lote_tool'} | usadas={'analizar_brecha_lote_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.25,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 1/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['lote', '9999'] / Requeridas: ['lote', '9999']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.812,
      "error": null
    },
    {
      "case_id": "form_001",
      "category": "formularios",
      "description": "Solicitud de esquema de formulario antes de dictado",
      "input": "quiero llenar el formulario de fileteo FOR-PD-04",
      "response": "[DRY-RUN] Procesando: quiero llenar el formulario de fileteo FOR-PD-04... (herramientas esperadas: obtener_esquema_formulario_tool)",
      "tools_used": [
        "obtener_esquema_formulario_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'obtener_esquema_formulario_tool'} | usadas={'obtener_esquema_formulario_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.5,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 2/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.667,
          "passed": false,
          "reasoning": "Encontradas: ['formulario', 'FOR-PD-04'] / Requeridas: ['formulario', 'FOR-PD-04', 'campo']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.792,
      "error": null
    },
    {
      "case_id": "form_002",
      "category": "formularios",
      "description": "Guardado de borrador de formulario",
      "input": "guardar borrador del formulario de control de sellos con lote 2024-10",
      "response": "[DRY-RUN] Procesando: guardar borrador del formulario de control de sellos con lot... (herramientas esperadas: guardar_borrador_tool)",
      "tools_used": [
        "guardar_borrador_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'guardar_borrador_tool'} | usadas={'guardar_borrador_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.75,
          "passed": true,
          "reasoning": "Marcadores de español encontrados: 3/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.5,
          "passed": false,
          "reasoning": "Encontradas: ['borrador'] / Requeridas: ['borrador', 'guardado']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.812,
      "error": null
    },
    {
      "case_id": "form_003",
      "category": "formularios",
      "description": "Esquema de formulario por nombre parcial",
      "input": "necesito el esquema del formulario de liberacion de tunel",
      "response": "[DRY-RUN] Procesando: necesito el esquema del formulario de liberacion de tunel... (herramientas esperadas: obtener_esquema_formulario_tool)",
      "tools_used": [
        "obtener_esquema_formulario_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'obtener_esquema_formulario_tool'} | usadas={'obtener_esquema_formulario_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.5,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 2/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.5,
          "passed": false,
          "reasoning": "Encontradas: ['formulario'] / Requeridas: ['formulario', 'campo']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.75,
      "error": null
    },
    {
      "case_id": "analisis_001",
      "category": "analisis",
      "description": "Dashboard diario de producción",
      "input": "dame el resumen del día, como vamos en producción",
      "response": "[DRY-RUN] Procesando: dame el resumen del día, como vamos en producción... (herramientas esperadas: resumen_negocio_tool)",
      "tools_used": [
        "resumen_negocio_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'resumen_negocio_tool'} | usadas={'resumen_negocio_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.5,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 2/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.0,
          "passed": false,
          "reasoning": "Encontradas: [] / Requeridas: ['lote', 'formulario', 'cumplimiento']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.625,
      "error": null
    },
    {
      "case_id": "analisis_002",
      "category": "analisis",
      "description": "Estadísticas de cumplimiento de formularios",
      "input": "cuál es el porcentaje de cumplimiento de formularios esta semana",
      "response": "[DRY-RUN] Procesando: cuál es el porcentaje de cumplimiento de formularios esta se... (herramientas esperadas: estadisticas_formularios_tool)",
      "tools_used": [
        "estadisticas_formularios_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'estadisticas_formularios_tool'} | usadas={'estadisticas_formularios_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.5,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 2/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.5,
          "passed": false,
          "reasoning": "Encontradas: ['formulario'] / Requeridas: ['%', 'formulario']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.75,
      "error": null
    },
    {
      "case_id": "analisis_003",
      "category": "analisis",
      "description": "Análisis de datos dentro de un tipo de formulario",
      "input": "analiza las temperaturas del formulario FOR-CC-10 del último mes",
      "response": "[DRY-RUN] Procesando: analiza las temperaturas del formulario FOR-CC-10 del último... (herramientas esperadas: analizar_datos_formulario_tool)",
      "tools_used": [
        "analizar_datos_formulario_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'analizar_datos_formulario_tool'} | usadas={'analizar_datos_formulario_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.5,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 2/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['temperatura', 'FOR-CC-10'] / Requeridas: ['temperatura', 'FOR-CC-10']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.875,
      "error": null
    },
    {
      "case_id": "edge_001",
      "category": "edge",
      "description": "Saludo simple — no debe llamar tools",
      "input": "hola",
      "response": "[DRY-RUN] Procesando: hola... (herramientas esperadas: ninguna)",
      "tools_used": [],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "Sin tools esperadas y ninguna usada — correcto."
        },
        {
          "name": "language_compliance",
          "score": 0.0,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 0/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.333,
          "passed": false,
          "reasoning": "Encontradas: ['hola'] / Requeridas: ['hola', 'ayudar', 'frigolab']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.583,
      "error": null
    },
    {
      "case_id": "edge_002",
      "category": "edge",
      "description": "Pregunta fuera de dominio — debe rechazar gentilmente",
      "input": "cuál es la capital de Francia",
      "response": "[DRY-RUN] Procesando: cuál es la capital de Francia... (herramientas esperadas: ninguna)",
      "tools_used": [],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "Sin tools esperadas y ninguna usada — correcto."
        },
        {
          "name": "language_compliance",
          "score": 0.5,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 2/10"
        },
        {
          "name": "no_hallucination",
          "score": 0.0,
          "passed": false,
          "reasoning": "Frases prohibidas detectadas: ['capital', 'Francia']"
        },
        {
          "name": "keyword_coverage",
          "score": 0.0,
          "passed": false,
          "reasoning": "Encontradas: [] / Requeridas: ['Frigolab', 'producción', 'formulario']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.375,
      "error": null
    },
    {
      "case_id": "edge_003",
      "category": "edge",
      "description": "Alerta de temperatura — debe consultar datos reales",
      "input": "hay alertas de temperatura crítica ahora mismo",
      "response": "[DRY-RUN] Procesando: hay alertas de temperatura crítica ahora mismo... (herramientas esperadas: resumen_negocio_tool)",
      "tools_used": [
        "resumen_negocio_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'resumen_negocio_tool'} | usadas={'resumen_negocio_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.5,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 2/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['temperatura', 'alerta'] / Requeridas: ['temperatura', 'alerta']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.875,
      "error": null
    }
  ]
}
````

## File: eval_results_20260428_115039.json
````json
{
  "timestamp": "20260428_115039",
  "dry_run": true,
  "suite_filter": null,
  "case_filter": null,
  "total_cases": 13,
  "summary": {
    "pass_rate": 0.0,
    "avg_score": 0.75,
    "total_passed": 0,
    "total_cases": 13,
    "avg_elapsed_ms": 0.0,
    "by_category": {
      "trazabilidad": {
        "pass_rate": 0.0,
        "avg_score": 0.828,
        "total": 4
      },
      "formularios": {
        "pass_rate": 0.0,
        "avg_score": 0.785,
        "total": 3
      },
      "analisis": {
        "pass_rate": 0.0,
        "avg_score": 0.75,
        "total": 3
      },
      "edge": {
        "pass_rate": 0.0,
        "avg_score": 0.611,
        "total": 3
      }
    },
    "by_evaluator": {
      "tool_precision": 1.0,
      "language_compliance": 0.423,
      "no_hallucination": 0.923,
      "keyword_coverage": 0.654
    }
  },
  "results": [
    {
      "case_id": "trace_001",
      "category": "trazabilidad",
      "description": "Rastreo básico de lote por número exacto",
      "input": "quiero rastrear el lote ABC-2024-001",
      "response": "[DRY-RUN] Procesando: quiero rastrear el lote ABC-2024-001... (herramientas esperadas: rastrear_lote_tool)",
      "tools_used": [
        "rastrear_lote_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'rastrear_lote_tool'} | usadas={'rastrear_lote_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.25,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 1/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['lote', 'ABC-2024-001'] / Requeridas: ['lote', 'ABC-2024-001']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.812,
      "error": null
    },
    {
      "case_id": "trace_002",
      "category": "trazabilidad",
      "description": "Análisis de brecha — etapas faltantes de un lote",
      "input": "que etapas le faltan al lote XYZ-0042 para estar completo",
      "response": "[DRY-RUN] Procesando: que etapas le faltan al lote XYZ-0042 para estar completo... (herramientas esperadas: analizar_brecha_lote_tool)",
      "tools_used": [
        "analizar_brecha_lote_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'analizar_brecha_lote_tool'} | usadas={'analizar_brecha_lote_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.25,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 1/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['lote', 'etapa', 'XYZ-0042'] / Requeridas: ['lote', 'etapa', 'XYZ-0042']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.812,
      "error": null
    },
    {
      "case_id": "trace_003",
      "category": "trazabilidad",
      "description": "Listado de lotes recientes",
      "input": "dame la lista de lotes de esta semana",
      "response": "[DRY-RUN] Procesando: dame la lista de lotes de esta semana... (herramientas esperadas: listar_lotes_tool)",
      "tools_used": [
        "listar_lotes_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'listar_lotes_tool'} | usadas={'listar_lotes_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.5,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 2/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['lote'] / Requeridas: ['lote']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.875,
      "error": null
    },
    {
      "case_id": "trace_004",
      "category": "trazabilidad",
      "description": "Verificación de completitud de lote",
      "input": "el lote 9999 está completo?",
      "response": "[DRY-RUN] Procesando: el lote 9999 está completo?... (herramientas esperadas: analizar_brecha_lote_tool)",
      "tools_used": [
        "analizar_brecha_lote_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'analizar_brecha_lote_tool'} | usadas={'analizar_brecha_lote_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.25,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 1/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['lote', '9999'] / Requeridas: ['lote', '9999']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.812,
      "error": null
    },
    {
      "case_id": "form_001",
      "category": "formularios",
      "description": "Solicitud de esquema de formulario antes de dictado",
      "input": "quiero llenar el formulario de fileteo FOR-PD-04",
      "response": "[DRY-RUN] Procesando: quiero llenar el formulario de fileteo FOR-PD-04... (herramientas esperadas: obtener_esquema_formulario_tool)",
      "tools_used": [
        "obtener_esquema_formulario_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'obtener_esquema_formulario_tool'} | usadas={'obtener_esquema_formulario_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.5,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 2/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.667,
          "passed": false,
          "reasoning": "Encontradas: ['formulario', 'FOR-PD-04'] / Requeridas: ['formulario', 'FOR-PD-04', 'campo']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.792,
      "error": null
    },
    {
      "case_id": "form_002",
      "category": "formularios",
      "description": "Guardado de borrador de formulario",
      "input": "guardar borrador del formulario de control de sellos con lote 2024-10",
      "response": "[DRY-RUN] Procesando: guardar borrador del formulario de control de sellos con lot... (herramientas esperadas: guardar_borrador_tool)",
      "tools_used": [
        "guardar_borrador_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'guardar_borrador_tool'} | usadas={'guardar_borrador_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.75,
          "passed": true,
          "reasoning": "Marcadores de español encontrados: 3/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.5,
          "passed": false,
          "reasoning": "Encontradas: ['borrador'] / Requeridas: ['borrador', 'guardado']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.812,
      "error": null
    },
    {
      "case_id": "form_003",
      "category": "formularios",
      "description": "Esquema de formulario por nombre parcial",
      "input": "necesito el esquema del formulario de liberacion de tunel",
      "response": "[DRY-RUN] Procesando: necesito el esquema del formulario de liberacion de tunel... (herramientas esperadas: obtener_esquema_formulario_tool)",
      "tools_used": [
        "obtener_esquema_formulario_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'obtener_esquema_formulario_tool'} | usadas={'obtener_esquema_formulario_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.5,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 2/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.5,
          "passed": false,
          "reasoning": "Encontradas: ['formulario'] / Requeridas: ['formulario', 'campo']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.75,
      "error": null
    },
    {
      "case_id": "analisis_001",
      "category": "analisis",
      "description": "Dashboard diario de producción",
      "input": "dame el resumen del día, como vamos en producción",
      "response": "[DRY-RUN] Procesando: dame el resumen del día, como vamos en producción... (herramientas esperadas: resumen_negocio_tool)",
      "tools_used": [
        "resumen_negocio_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'resumen_negocio_tool'} | usadas={'resumen_negocio_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.5,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 2/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.0,
          "passed": false,
          "reasoning": "Encontradas: [] / Requeridas: ['lote', 'formulario', 'cumplimiento']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.625,
      "error": null
    },
    {
      "case_id": "analisis_002",
      "category": "analisis",
      "description": "Estadísticas de cumplimiento de formularios",
      "input": "cuál es el porcentaje de cumplimiento de formularios esta semana",
      "response": "[DRY-RUN] Procesando: cuál es el porcentaje de cumplimiento de formularios esta se... (herramientas esperadas: estadisticas_formularios_tool)",
      "tools_used": [
        "estadisticas_formularios_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'estadisticas_formularios_tool'} | usadas={'estadisticas_formularios_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.5,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 2/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.5,
          "passed": false,
          "reasoning": "Encontradas: ['formulario'] / Requeridas: ['%', 'formulario']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.75,
      "error": null
    },
    {
      "case_id": "analisis_003",
      "category": "analisis",
      "description": "Análisis de datos dentro de un tipo de formulario",
      "input": "analiza las temperaturas del formulario FOR-CC-10 del último mes",
      "response": "[DRY-RUN] Procesando: analiza las temperaturas del formulario FOR-CC-10 del último... (herramientas esperadas: analizar_datos_formulario_tool)",
      "tools_used": [
        "analizar_datos_formulario_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'analizar_datos_formulario_tool'} | usadas={'analizar_datos_formulario_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.5,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 2/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['temperatura', 'FOR-CC-10'] / Requeridas: ['temperatura', 'FOR-CC-10']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.875,
      "error": null
    },
    {
      "case_id": "edge_001",
      "category": "edge",
      "description": "Saludo simple — no debe llamar tools",
      "input": "hola",
      "response": "[DRY-RUN] Procesando: hola... (herramientas esperadas: ninguna)",
      "tools_used": [],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "Sin tools esperadas y ninguna usada — correcto."
        },
        {
          "name": "language_compliance",
          "score": 0.0,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 0/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.333,
          "passed": false,
          "reasoning": "Encontradas: ['hola'] / Requeridas: ['hola', 'ayudar', 'frigolab']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.583,
      "error": null
    },
    {
      "case_id": "edge_002",
      "category": "edge",
      "description": "Pregunta fuera de dominio — debe rechazar gentilmente",
      "input": "cuál es la capital de Francia",
      "response": "[DRY-RUN] Procesando: cuál es la capital de Francia... (herramientas esperadas: ninguna)",
      "tools_used": [],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "Sin tools esperadas y ninguna usada — correcto."
        },
        {
          "name": "language_compliance",
          "score": 0.5,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 2/10"
        },
        {
          "name": "no_hallucination",
          "score": 0.0,
          "passed": false,
          "reasoning": "Frases prohibidas detectadas: ['capital', 'Francia']"
        },
        {
          "name": "keyword_coverage",
          "score": 0.0,
          "passed": false,
          "reasoning": "Encontradas: [] / Requeridas: ['Frigolab', 'producción', 'formulario']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.375,
      "error": null
    },
    {
      "case_id": "edge_003",
      "category": "edge",
      "description": "Alerta de temperatura — debe consultar datos reales",
      "input": "hay alertas de temperatura crítica ahora mismo",
      "response": "[DRY-RUN] Procesando: hay alertas de temperatura crítica ahora mismo... (herramientas esperadas: resumen_negocio_tool)",
      "tools_used": [
        "resumen_negocio_tool"
      ],
      "elapsed_ms": 0.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'resumen_negocio_tool'} | usadas={'resumen_negocio_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 0.5,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 2/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['temperatura', 'alerta'] / Requeridas: ['temperatura', 'alerta']"
        }
      ],
      "overall_passed": false,
      "overall_score": 0.875,
      "error": null
    }
  ]
}
````

## File: eval_results_20260428_115849.json
````json
{
  "timestamp": "20260428_115849",
  "dry_run": false,
  "suite_filter": null,
  "case_filter": null,
  "total_cases": 13,
  "summary": {
    "pass_rate": 0.154,
    "avg_score": 0.832,
    "total_passed": 2,
    "total_cases": 13,
    "avg_elapsed_ms": 12314.0,
    "by_category": {
      "trazabilidad": {
        "pass_rate": 0.25,
        "avg_score": 0.871,
        "total": 4
      },
      "formularios": {
        "pass_rate": 0.0,
        "avg_score": 0.794,
        "total": 3
      },
      "analisis": {
        "pass_rate": 0.333,
        "avg_score": 0.856,
        "total": 3
      },
      "edge": {
        "pass_rate": 0.0,
        "avg_score": 0.794,
        "total": 3
      }
    },
    "by_evaluator": {
      "tool_precision": 0.923,
      "language_compliance": 0.942,
      "no_hallucination": 1.0,
      "keyword_coverage": 0.756,
      "task_completion": 0.538
    }
  },
  "results": [
    {
      "case_id": "trace_001",
      "category": "trazabilidad",
      "description": "Rastreo básico de lote por número exacto",
      "input": "quiero rastrear el lote ABC-2024-001",
      "response": "No pude conectarme a la base de datos para rastrear el lote ABC-2024-001. Puede ser una caída momentánea. Te sugiero que intentes de nuevo más tarde.",
      "tools_used": [
        "rastrear_lote_tool"
      ],
      "elapsed_ms": 53797.8,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'rastrear_lote_tool'} | usadas={'rastrear_lote_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 1.0,
          "passed": true,
          "reasoning": "Marcadores de español encontrados: 6/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['lote', 'ABC-2024-001'] / Requeridas: ['lote', 'ABC-2024-001']"
        },
        {
          "name": "task_completion",
          "score": 0.25,
          "passed": false,
          "reasoning": "La respuesta del agente indica que no pudo realizar la acción solicitada debido a un problema de conexión, lo cual es una información importante. Sin embargo, no proporciona ninguna alternativa o solución adicional, lo que hace que la respuesta sea pobre y falte información relevante."
        }
      ],
      "overall_passed": false,
      "overall_score": 0.85,
      "error": null
    },
    {
      "case_id": "trace_002",
      "category": "trazabilidad",
      "description": "Análisis de brecha — etapas faltantes de un lote",
      "input": "que etapas le faltan al lote XYZ-0042 para estar completo",
      "response": "Actualmente, hay un problema técnico con la base de datos y no puedo acceder a la información sobre el lote XYZ-0042. Te sugiero que intentes nuevamente más tarde. Si el problema persiste, por favor contacta al soporte técnico.",
      "tools_used": [
        "analizar_brecha_lote_tool"
      ],
      "elapsed_ms": 11008.1,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'analizar_brecha_lote_tool'} | usadas={'analizar_brecha_lote_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 1.0,
          "passed": true,
          "reasoning": "Marcadores de español encontrados: 7/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.667,
          "passed": false,
          "reasoning": "Encontradas: ['lote', 'XYZ-0042'] / Requeridas: ['lote', 'etapa', 'XYZ-0042']"
        },
        {
          "name": "task_completion",
          "score": 0.25,
          "passed": false,
          "reasoning": "La respuesta del agente indica un problema técnico y no proporciona la información solicitada sobre el lote XYZ-0042. Aunque menciona la herramienta correcta, no la utilizó debido a la falla, lo que resulta en una falta de información importante."
        }
      ],
      "overall_passed": false,
      "overall_score": 0.783,
      "error": null
    },
    {
      "case_id": "trace_003",
      "category": "trazabilidad",
      "description": "Listado de lotes recientes",
      "input": "dame la lista de lotes de esta semana",
      "response": "No se encontraron lotes registrados en esta semana. Te sugiero verificar si hay algún error en las fechas o si necesitas ajustar la búsqueda.",
      "tools_used": [
        "listar_lotes_tool"
      ],
      "elapsed_ms": 6462.8,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'listar_lotes_tool'} | usadas={'listar_lotes_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 1.0,
          "passed": true,
          "reasoning": "Marcadores de español encontrados: 6/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['lote'] / Requeridas: ['lote']"
        },
        {
          "name": "task_completion",
          "score": 0.75,
          "passed": true,
          "reasoning": "La respuesta es buena y utiliza la herramienta correcta, pero no proporciona información adicional sobre cómo ajustar la búsqueda o verificar las fechas, lo que podría ser útil para el operario."
        }
      ],
      "overall_passed": true,
      "overall_score": 0.95,
      "error": null
    },
    {
      "case_id": "trace_004",
      "category": "trazabilidad",
      "description": "Verificación de completitud de lote",
      "input": "el lote 9999 está completo?",
      "response": "No se encontró información específica sobre el lote 9999 en los registros. Parece que hay menciones de este número, pero no está registrado como un lote específico. Te sugiero verificar el número de lote o consultar nuevamente.",
      "tools_used": [
        "analizar_brecha_lote_tool"
      ],
      "elapsed_ms": 4478.7,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'analizar_brecha_lote_tool'} | usadas={'analizar_brecha_lote_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 1.0,
          "passed": true,
          "reasoning": "Marcadores de español encontrados: 8/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['lote', '9999'] / Requeridas: ['lote', '9999']"
        },
        {
          "name": "task_completion",
          "score": 0.5,
          "passed": false,
          "reasoning": "La respuesta del agente es parcial, ya que indica que no se encontró información específica sobre el lote 9999, pero no proporciona una solución alternativa o más detalles sobre cómo proceder. La herramienta utilizada es la correcta, pero la falta de información crítica afecta la utilidad de la respuesta."
        }
      ],
      "overall_passed": false,
      "overall_score": 0.9,
      "error": null
    },
    {
      "case_id": "form_001",
      "category": "formularios",
      "description": "Solicitud de esquema de formulario antes de dictado",
      "input": "quiero llenar el formulario de fileteo FOR-PD-04",
      "response": "El formulario de fileteo (FOR-PD-04) tiene la siguiente estructura:\n\n### Encabezado:\n1. **FECHA** (requerido)\n2. **LOTE DE PROCESO** (requerido)\n\n### Cuerpo:\n1. **Registro de Producción de Fileteo**:\n   - HORA\n   - TINA #\n   - CÓDIGOS DE MAT. PRIMA\n   - ESPECIE / PRESENTACIÓN\n   - PESO BRUTO\n   - PESO NETO\n\n2. **Resumen**:\n   - Clasificación\n   - Peso Total\n\n3. **Material de Empaque / Insumo en Proceso**:\n   - Insumo\n   - Cantidad\n\n4. **Control Sustancias Controladas**:\n   - Sustancia\n   - Peso sustancia (kg)\n   - Volumen agua (lts)\n   - % Concentración (calculado)\n\n5. **Control del personal**:\n   - Hora\n   - FILETEADORES\n   - PERSONAL PLANTA\n\n6. **Observaciones**\n\n### Firmas requeridas:\n- **Obrero Producción**: Ricardo Sancan\n- **Gerente Producción**: JOSE MONTESDEOCA (con jefe de alerta: Zoila Burgos)\n\nPor favor, proporciona los datos necesarios para llenar el formulario.",
      "tools_used": [
        "obtener_esquema_formulario_tool"
      ],
      "elapsed_ms": 8956.8,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'obtener_esquema_formulario_tool'} | usadas={'obtener_esquema_formulario_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 1.0,
          "passed": true,
          "reasoning": "Marcadores de español encontrados: 7/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.667,
          "passed": false,
          "reasoning": "Encontradas: ['formulario', 'FOR-PD-04'] / Requeridas: ['formulario', 'FOR-PD-04', 'campo']"
        },
        {
          "name": "task_completion",
          "score": 1.0,
          "passed": true,
          "reasoning": "La respuesta del agente es completa y precisa, proporcionando la estructura detallada del formulario FOR-PD-04 y solicitando los datos necesarios para su llenado. Utilizó la herramienta correcta para obtener la información."
        }
      ],
      "overall_passed": false,
      "overall_score": 0.933,
      "error": null
    },
    {
      "case_id": "form_002",
      "category": "formularios",
      "description": "Guardado de borrador de formulario",
      "input": "guardar borrador del formulario de control de sellos con lote 2024-10",
      "response": "He obtenido el esquema del formulario de control de sellos (FOR-CC-10). Ahora, por favor proporciona los datos necesarios para completar el borrador:\n\n1. **Fecha** (opcional)\n2. **Tipo de máquina** (opcional)\n3. **Producto / Presentación** (opcional)\n4. **Inspección de sellos** (opcional)\n\nPara la tabla de datos:\n- **Hora** (opcional)\n- **Lote**: 2024-10\n- **Clasificación** (opcional)\n- **Inspección prueba n°** (opcional)\n- **# Empaques inspeccionados** (opcional)\n- **# Sellos satisfactorios** (opcional)\n- **# Sellos no conformes** (opcional)\n- **Observación** (opcional)\n- **Acción correctiva** (opcional)\n\nPara la sección de láminas termo formables:\n- **Hora** (opcional)\n- **Reposición de rollos grandes y pequeños** (opcional)\n- **Rollo n°** (opcional)\n- **Lote** (opcional)\n\nY para la sección de acciones correctivas:\n- **Acciones correctivas** (opcional)\n\nPor favor, proporciona la información que deseas incluir en el borrador.",
      "tools_used": [
        "obtener_esquema_formulario_tool"
      ],
      "elapsed_ms": 7920.0,
      "scores": [
        {
          "name": "tool_precision",
          "score": 0.0,
          "passed": false,
          "reasoning": "F1=0.00 | esperadas={'guardar_borrador_tool'} | usadas={'obtener_esquema_formulario_tool'} | TP=0, FP=1, FN=1"
        },
        {
          "name": "language_compliance",
          "score": 1.0,
          "passed": true,
          "reasoning": "Marcadores de español encontrados: 8/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.5,
          "passed": false,
          "reasoning": "Encontradas: ['borrador'] / Requeridas: ['borrador', 'guardado']"
        },
        {
          "name": "task_completion",
          "score": 0.25,
          "passed": false,
          "reasoning": "El agente no cumplió con la solicitud de guardar el borrador del formulario, sino que solicitó más información. Además, no utilizó la herramienta adecuada para guardar el borrador, lo que indica que no completó la tarea correctamente."
        }
      ],
      "overall_passed": false,
      "overall_score": 0.55,
      "error": null
    },
    {
      "case_id": "form_003",
      "category": "formularios",
      "description": "Esquema de formulario por nombre parcial",
      "input": "necesito el esquema del formulario de liberacion de tunel",
      "response": "El esquema del formulario de Liberación de Túneles (FOR-PD-05) es el siguiente:\n\n**Encabezado (Header Fields):**\n1. **Fecha**: Tipo - fecha, Requerido - sí.\n2. **Hora Inicial**: Tipo - hora, Requerido - sí.\n3. **Hora Final**: Tipo - hora, Requerido - no.\n4. **Tipo de Control**: Tipo - selección, Requerido - sí. Opciones: \n   - ALMACENAMIENTO PROVISIONAL\n   - EMPAQUE FINAL\n\n**Cuerpo (Body Elements):**\n1. **Registro de Liberación** (Tabla):\n   - LOTE DE PROCESO: Tipo - texto, Requerido - sí.\n   - TIPO DE PRODUCTO: Tipo - texto, Requerido - sí.\n   - CLASIFICACIÓN: Tipo - texto, Requerido - no.\n   - TEMPERATURA: Tipo - temperatura, Requerido - sí.\n   - % GLASEO: Tipo - número, Requerido - no.\n   - TOTAL CAJAS/TINAS: Tipo - número, Requerido - no.\n   - CAPACIDAD CAJAS-TINAS / Lbs: Tipo - número, Requerido - no.\n   - TOTAL Lbs NETAS: Tipo - fórmula, Requerido - no. Fórmula: TOTAL CAJAS/TINAS * CAPACIDAD CAJAS-TINAS / Lbs.\n\n2. **Material de Empaque Utilizado en Proceso** (Tabla):\n   - MATERIAL DE EMPAQUE / INSUMO: Tipo - texto, Requerido - no.\n   - CANTIDAD: Tipo - número, Requerido - no.\n\n3. **Generación de Subproductos** (Tabla):\n   - SUBPRODUCTO: Tipo - texto, Requerido - no.\n   - CANTIDAD: Tipo - número, Requerido - no.\n\n4. **Observaciones**: Sección para anotaciones.\n\n**Firmas Requeridas:**\n- OBRERO\n- SUPERVISOR DE PRODUCCIÓN: Zoila Burgos\n- JEFE DE CÁMARA: Antonio Rodriguez\n\nSi necesitas más información o realizar alguna acción con este formulario, házmelo saber.",
      "tools_used": [
        "obtener_esquema_formulario_tool"
      ],
      "elapsed_ms": 25334.1,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'obtener_esquema_formulario_tool'} | usadas={'obtener_esquema_formulario_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 1.0,
          "passed": true,
          "reasoning": "Marcadores de español encontrados: 6/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.5,
          "passed": false,
          "reasoning": "Encontradas: ['formulario'] / Requeridas: ['formulario', 'campo']"
        },
        {
          "name": "task_completion",
          "score": 1.0,
          "passed": true,
          "reasoning": "La respuesta del agente proporciona un esquema detallado y preciso del formulario de liberación de túneles, incluyendo todos los campos requeridos y opcionales, así como la fórmula necesaria. Además, utilizó la herramienta correcta para obtener la información solicitada."
        }
      ],
      "overall_passed": false,
      "overall_score": 0.9,
      "error": null
    },
    {
      "case_id": "analisis_001",
      "category": "analisis",
      "description": "Dashboard diario de producción",
      "input": "dame el resumen del día, como vamos en producción",
      "response": "No hay formularios registrados en los últimos 7 días, por lo que no tengo información disponible sobre la producción actual. Te sugiero verificar más tarde o ajustar el periodo de búsqueda.",
      "tools_used": [
        "resumen_negocio_tool"
      ],
      "elapsed_ms": 5675.2,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'resumen_negocio_tool'} | usadas={'resumen_negocio_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 1.0,
          "passed": true,
          "reasoning": "Marcadores de español encontrados: 8/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.333,
          "passed": false,
          "reasoning": "Encontradas: ['formulario'] / Requeridas: ['lote', 'formulario', 'cumplimiento']"
        },
        {
          "name": "task_completion",
          "score": 0.5,
          "passed": false,
          "reasoning": "La respuesta del agente es parcial, ya que informa sobre la falta de datos en los últimos 7 días, pero no proporciona un resumen de producción actual ni sugiere acciones concretas para obtener la información deseada."
        }
      ],
      "overall_passed": false,
      "overall_score": 0.767,
      "error": null
    },
    {
      "case_id": "analisis_002",
      "category": "analisis",
      "description": "Estadísticas de cumplimiento de formularios",
      "input": "cuál es el porcentaje de cumplimiento de formularios esta semana",
      "response": "Esta semana, del 25 al 28 de abril de 2026, no se registraron formularios, por lo que no hay datos de cumplimiento.\n\nSin embargo, en el periodo del 1 al 28 de abril de 2026, se completaron un total de 23 formularios. Actualmente hay 22 borradores activos. \n\nSi necesitas más información o estadísticas sobre formularios específicos, házmelo saber.",
      "tools_used": [
        "estadisticas_formularios_tool",
        "estadisticas_formularios_tool"
      ],
      "elapsed_ms": 7919.3,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'estadisticas_formularios_tool'} | usadas={'estadisticas_formularios_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 1.0,
          "passed": true,
          "reasoning": "Marcadores de español encontrados: 7/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.5,
          "passed": false,
          "reasoning": "Encontradas: ['formulario'] / Requeridas: ['%', 'formulario']"
        },
        {
          "name": "task_completion",
          "score": 0.5,
          "passed": false,
          "reasoning": "La respuesta proporciona información sobre el cumplimiento de formularios en el periodo solicitado, pero no ofrece el porcentaje específico de cumplimiento, lo que es crucial para la solicitud del operario. Además, menciona datos de un periodo más amplio que no fue solicitado."
        }
      ],
      "overall_passed": false,
      "overall_score": 0.8,
      "error": null
    },
    {
      "case_id": "analisis_003",
      "category": "analisis",
      "description": "Análisis de datos dentro de un tipo de formulario",
      "input": "analiza las temperaturas del formulario FOR-CC-10 del último mes",
      "response": "Se han analizado las temperaturas del formulario FOR-CC-10 durante el último mes (del 28 de marzo al 28 de abril de 2026). Aquí están los resultados:\n\n- **Total de formularios analizados**: 3\n- **Empaques inspeccionados**: \n  - Mínimo: 18.0 °C\n  - Máximo: 18.0 °C\n  - Promedio: 18.0 °C\n- **Sellos no conformes**: \n  - Mínimo: 0.0\n  - Máximo: 0.0\n  - Promedio: 0.0\n- **Sellos satisfactorios**: \n  - Mínimo: 18.0\n  - Máximo: 18.0\n  - Promedio: 18.0\n- **Inspección prueba n°**: \n  - Mínimo: 1.0\n  - Máximo: 5.0\n  - Promedio: 2.75\n- **Lote**: \n  - Mínimo: 260401\n  - Máximo: 260402\n  - Promedio: 260401.44\n\n**Fechas más frecuentes**:\n- 2026-04-01: 2 registros\n- 2026-04-02: 1 registro\n\n**Inspección de sellos**:\n- Cecilia Pico: 2 registros\n- Luz María Gutiérrez: 1 registro\n\n**Producto más frecuente**:\n- Mahi Mahi Porción sin piel: 3 registros\n\n**Tipos de máquina utilizados**:\n- VC999#1: 1 registro\n- VC999#2: 1 registro\n- VC 999#1: 1 registro\n\nNo se reportaron observaciones adicionales. Si necesitas más información, házmelo saber.",
      "tools_used": [
        "analizar_datos_formulario_tool"
      ],
      "elapsed_ms": 8889.3,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'analizar_datos_formulario_tool'} | usadas={'analizar_datos_formulario_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 1.0,
          "passed": true,
          "reasoning": "Marcadores de español encontrados: 6/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['temperatura', 'FOR-CC-10'] / Requeridas: ['temperatura', 'FOR-CC-10']"
        },
        {
          "name": "task_completion",
          "score": 1.0,
          "passed": true,
          "reasoning": "La respuesta del agente es completa y precisa, proporcionando un análisis detallado de las temperaturas del formulario FOR-CC-10 del último mes, incluyendo estadísticas relevantes y datos adicionales sobre inspecciones y productos. Utilizó la herramienta correcta para realizar el análisis."
        }
      ],
      "overall_passed": true,
      "overall_score": 1.0,
      "error": null
    },
    {
      "case_id": "edge_001",
      "category": "edge",
      "description": "Saludo simple — no debe llamar tools",
      "input": "hola",
      "response": "¡Hola! ¿En qué puedo ayudarte hoy?",
      "tools_used": [],
      "elapsed_ms": 1694.3,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "Sin tools esperadas y ninguna usada — correcto."
        },
        {
          "name": "language_compliance",
          "score": 0.25,
          "passed": false,
          "reasoning": "Marcadores de español encontrados: 1/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 0.667,
          "passed": false,
          "reasoning": "Encontradas: ['hola', 'ayudar'] / Requeridas: ['hola', 'ayudar', 'frigolab']"
        },
        {
          "name": "task_completion",
          "score": 1.0,
          "passed": true,
          "reasoning": "La respuesta del agente es adecuada y responde de manera correcta y amigable a la solicitud del operario, sin necesidad de herramientas adicionales."
        }
      ],
      "overall_passed": false,
      "overall_score": 0.783,
      "error": null
    },
    {
      "case_id": "edge_002",
      "category": "edge",
      "description": "Pregunta fuera de dominio — debe rechazar gentilmente",
      "input": "cuál es la capital de Francia",
      "response": "Lo siento, pero no puedo responder a esa pregunta. Estoy aquí para ayudarte con temas relacionados con el control de calidad y la producción en Frigolab San Mateo. Si tienes alguna consulta sobre lotes, formularios o estadísticas, estaré encantado de ayudarte.",
      "tools_used": [],
      "elapsed_ms": 2661.1,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "Sin tools esperadas y ninguna usada — correcto."
        },
        {
          "name": "language_compliance",
          "score": 1.0,
          "passed": true,
          "reasoning": "Marcadores de español encontrados: 6/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['Frigolab', 'producción', 'formulario'] / Requeridas: ['Frigolab', 'producción', 'formulario']"
        },
        {
          "name": "task_completion",
          "score": 0.0,
          "passed": false,
          "reasoning": "La respuesta del agente es incorrecta y fuera de tema, ya que no aborda la pregunta sobre la capital de Francia y se limita a su ámbito de trabajo sin ofrecer información relevante."
        }
      ],
      "overall_passed": false,
      "overall_score": 0.8,
      "error": null
    },
    {
      "case_id": "edge_003",
      "category": "edge",
      "description": "Alerta de temperatura — debe consultar datos reales",
      "input": "hay alertas de temperatura crítica ahora mismo",
      "response": "No hay alertas de temperatura crítica en este momento, ya que no se han registrado formularios en los últimos 7 días. Si necesitas información más específica, por favor indícalo.",
      "tools_used": [
        "resumen_negocio_tool"
      ],
      "elapsed_ms": 15284.9,
      "scores": [
        {
          "name": "tool_precision",
          "score": 1.0,
          "passed": true,
          "reasoning": "F1=1.00 | esperadas={'resumen_negocio_tool'} | usadas={'resumen_negocio_tool'} | TP=1, FP=0, FN=0"
        },
        {
          "name": "language_compliance",
          "score": 1.0,
          "passed": true,
          "reasoning": "Marcadores de español encontrados: 7/10"
        },
        {
          "name": "no_hallucination",
          "score": 1.0,
          "passed": true,
          "reasoning": "Ninguna frase de alucinación detectada."
        },
        {
          "name": "keyword_coverage",
          "score": 1.0,
          "passed": true,
          "reasoning": "Encontradas: ['temperatura', 'alerta'] / Requeridas: ['temperatura', 'alerta']"
        },
        {
          "name": "task_completion",
          "score": 0.0,
          "passed": false,
          "reasoning": "La respuesta del agente es incorrecta, ya que contradice la solicitud del operario sobre alertas de temperatura crítica. Además, no proporciona información relevante ni útil sobre la situación actual."
        }
      ],
      "overall_passed": false,
      "overall_score": 0.8,
      "error": null
    }
  ]
}
````

## File: extractor.py
````python
"""
extractor.py - Extrae y agrupa formularios por Lote desde SQL Server o via API REST

Fase 1 del pipeline: Extraccion y Agrupacion
- Conecta a SQL Server (pyodbc) O consume la API REST del backend .NET
- Parsea HeaderData y BodyData (JSON)
- Busca campos que contengan "Lote" en cualquier nivel del JSON
- Agrupa todos los formularios que comparten el mismo numero de Lote
"""
import json
import re
from datetime import datetime
from collections import defaultdict

import pyodbc
import httpx

from config import get_connection_string, API_BASE_URL, TEMPLATE_PROCESS_MAP


# ---------------------------------------------------------------------------
# Nombres de campo que indican un lote
# ---------------------------------------------------------------------------
LOTE_FIELD_PATTERNS = [
    re.compile(r"^lote$", re.IGNORECASE),
    re.compile(r"^lote[\s_]*(de[\s_]*)?proceso$", re.IGNORECASE),
    re.compile(r"^lote[\s_]*produccion$", re.IGNORECASE),
    re.compile(r"^n[uú]mero[\s_]*de[\s_]*lote$", re.IGNORECASE),
    re.compile(r"^batch$", re.IGNORECASE),
    re.compile(r"^no\.?\s*lote$", re.IGNORECASE),
]


def _is_lote_field(field_name: str) -> bool:
    """Checa si un nombre de campo hace referencia a un lote."""
    return any(p.match(field_name.strip()) for p in LOTE_FIELD_PATTERNS)


def _safe_parse_json(raw: str | None) -> dict | list | None:
    """Intenta parsear un string JSON, retorna None si falla."""
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None


def _extract_template_info(template_snapshot: str | None) -> dict:
    """Extrae Codigo, Nombre y Proceso del TemplateSnapshot JSON."""
    info = {"codigo": "", "nombre": "", "proceso": ""}
    parsed = _safe_parse_json(template_snapshot)
    if isinstance(parsed, dict):
        info["codigo"] = parsed.get("Codigo", "")
        info["nombre"] = parsed.get("Nombre", "")
        info["proceso"] = parsed.get("Proceso", "")
    return info


def _find_lotes_in_data(data, path="") -> list[tuple[str, str]]:
    """
    Busca recursivamente campos de Lote en un JSON arbitrario.
    Retorna lista de (valor_lote, ruta_donde_se_encontro).
    """
    results = []
    if isinstance(data, dict):
        for key, value in data.items():
            if _is_lote_field(key) and value and str(value).strip():
                results.append((str(value).strip(), f"{path}.{key}"))
            else:
                results.extend(_find_lotes_in_data(value, f"{path}.{key}"))
    elif isinstance(data, list):
        for i, item in enumerate(data):
            results.extend(_find_lotes_in_data(item, f"{path}[{i}]"))
    return results


def _extract_relevant_fields(data) -> dict:
    """
    Extrae campos relevantes de un formulario para la narrativa.
    Busca temperaturas, pesos, especies, horas, clasificaciones, etc.
    """
    fields = {}
    if isinstance(data, dict):
        for key, value in data.items():
            if value and str(value).strip() and str(value).strip() != "":
                low_key = key.lower()
                # Filtrar campos relevantes para trazabilidad
                if any(kw in low_key for kw in [
                    "temp", "peso", "especie", "produc", "clasif",
                    "hora", "maquin", "tina", "caja", "empaque",
                    "sello", "observ", "accion", "defect", "glaseo",
                    "proveedor", "pesquero", "presentacion", "lote",
                    "inspeccion", "rollo", "firma", "analista",
                    "fecha", "turno", "tipo",
                ]):
                    fields[key] = str(value).strip()
    elif isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                sub = _extract_relevant_fields(item)
                fields.update(sub)
    return fields


def _extract_body_summary(body_data) -> list[dict]:
    """
    Extrae un resumen de las secciones del Body (tablas, secciones, etc).
    Retorna lista de diccionarios con datos relevantes de cada fila no vacia.
    """
    summaries = []
    if not isinstance(body_data, list):
        return summaries

    for element in body_data:
        if not isinstance(element, dict):
            continue

        el_type = element.get("type", "")

        if el_type == "table":
            rows = element.get("data", [])
            for row in rows:
                if not isinstance(row, dict):
                    continue
                # Solo incluir filas que tengan al menos un valor no vacio
                non_empty = {
                    k: v for k, v in row.items()
                    if v and str(v).strip()
                }
                if non_empty:
                    summaries.append(non_empty)

        elif el_type == "section":
            section_data = element.get("data", {})
            if isinstance(section_data, dict):
                non_empty = {
                    k: v for k, v in section_data.items()
                    if v and str(v).strip()
                }
                if non_empty:
                    summaries.append(non_empty)

    return summaries


# ---------------------------------------------------------------------------
# Fuente 1: Conexion directa a SQL Server via pyodbc
# ---------------------------------------------------------------------------
def extract_from_sql() -> dict:
    """
    Conecta a SQL Server, extrae FilledForms y agrupa por Lote.

    Retorna:
        historial_lotes: {
            "260302": [
                {
                    "form_id": 33,
                    "template_codigo": "FOR-CC-10",
                    "template_nombre": "Control de sellos...",
                    "proceso": "Calidad",
                    "created_at": datetime,
                    "filled_by": "...",
                    "filled_by_role": "...",
                    "header_data": {...},
                    "body_summary": [...],
                    "lotes_encontrados": [("260302", ".BodyData[0].data[0].Lote")]
                },
                ...
            ]
        }
    """
    historial_lotes = defaultdict(list)

    conn_str = get_connection_string()
    print(f"[EXTRACTOR] Conectando a SQL Server: {conn_str.split('PWD=')[0]}...")

    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()

        query = """
            SELECT
                FormID,
                TemplateID,
                HeaderData,
                BodyData,
                TemplateSnapshot,
                CreatedAt,
                FilledBy,
                FilledByRole,
                TipoProducto
            FROM FilledForms
            ORDER BY CreatedAt
        """
        cursor.execute(query)

        count = 0
        forms_con_lote = 0

        for row in cursor.fetchall():
            count += 1
            form_id = row[0]
            template_id = row[1]
            header_raw = row[2]
            body_raw = row[3]
            snapshot_raw = row[4]
            created_at = row[5]
            filled_by = row[6] or ""
            filled_by_role = row[7] or ""
            tipo_producto = row[8] or ""

            # Parsear JSONs
            header_data = _safe_parse_json(header_raw) or {}
            body_data = _safe_parse_json(body_raw) or []
            template_info = _extract_template_info(snapshot_raw)

            # Buscar lotes en header y body
            lotes_header = _find_lotes_in_data(header_data, "HeaderData")
            lotes_body = _find_lotes_in_data(body_data, "BodyData")
            all_lotes = lotes_header + lotes_body

            if not all_lotes:
                continue

            forms_con_lote += 1

            # Extraer resumen del body
            body_summary = _extract_body_summary(body_data)

            # Construir evento
            event = {
                "form_id": form_id,
                "template_id": template_id,
                "template_codigo": template_info["codigo"],
                "template_nombre": template_info["nombre"],
                "proceso": template_info["proceso"],
                "created_at": created_at,
                "filled_by": filled_by,
                "filled_by_role": filled_by_role,
                "tipo_producto": tipo_producto,
                "header_data": header_data,
                "body_summary": body_summary,
                "lotes_encontrados": all_lotes,
            }

            # Agrupar por cada lote unico encontrado
            lotes_unicos = set(lote for lote, _ in all_lotes)
            for lote_num in lotes_unicos:
                historial_lotes[lote_num].append(event)

        cursor.close()
        conn.close()

        print(f"[EXTRACTOR] Procesados {count} formularios.")
        print(f"[EXTRACTOR] {forms_con_lote} formularios contenian campo de Lote.")
        print(f"[EXTRACTOR] {len(historial_lotes)} lotes unicos encontrados.")

    except pyodbc.Error as e:
        print(f"[EXTRACTOR] Error SQL Server: {e}")
        raise

    return dict(historial_lotes)


# ---------------------------------------------------------------------------
# Fuente 2: Via API REST del backend .NET
# ---------------------------------------------------------------------------
async def extract_from_api() -> dict:
    """
    Extrae FilledForms via la API REST del backend .NET y agrupa por Lote.
    Util cuando no hay acceso directo a SQL Server.
    """
    historial_lotes = defaultdict(list)

    print(f"[EXTRACTOR] Conectando a API: {API_BASE_URL}/FilledForms...")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(f"{API_BASE_URL}/FilledForms")
        response.raise_for_status()
        forms = response.json()

    count = 0
    forms_con_lote = 0

    for form in forms:
        count += 1
        form_id = form.get("formID") or form.get("FormID", 0)
        template_id = form.get("templateID") or form.get("TemplateID", 0)
        created_at_str = form.get("createdAt") or form.get("CreatedAt", "")
        filled_by = form.get("filledBy") or form.get("FilledBy", "")
        filled_by_role = form.get("filledByRole") or form.get("FilledByRole", "")
        tipo_producto = form.get("tipoProducto") or form.get("TipoProducto", "")

        # Parsear JSONs
        header_raw = form.get("headerData") or form.get("HeaderData")
        body_raw = form.get("bodyData") or form.get("BodyData")
        snapshot_raw = form.get("templateSnapshot") or form.get("TemplateSnapshot")

        if isinstance(header_raw, str):
            header_data = _safe_parse_json(header_raw) or {}
        elif isinstance(header_raw, dict):
            header_data = header_raw
        else:
            header_data = {}

        if isinstance(body_raw, str):
            body_data = _safe_parse_json(body_raw) or []
        elif isinstance(body_raw, list):
            body_data = body_raw
        else:
            body_data = []

        if isinstance(snapshot_raw, str):
            template_info = _extract_template_info(snapshot_raw)
        elif isinstance(snapshot_raw, dict):
            template_info = {
                "codigo": snapshot_raw.get("Codigo", ""),
                "nombre": snapshot_raw.get("Nombre", ""),
                "proceso": snapshot_raw.get("Proceso", ""),
            }
        else:
            template_info = {"codigo": "", "nombre": "", "proceso": ""}

        # Parsear fecha
        try:
            created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            created_at = datetime.now()

        # Buscar lotes
        lotes_header = _find_lotes_in_data(header_data, "HeaderData")
        lotes_body = _find_lotes_in_data(body_data, "BodyData")
        all_lotes = lotes_header + lotes_body

        if not all_lotes:
            continue

        forms_con_lote += 1
        body_summary = _extract_body_summary(body_data)

        event = {
            "form_id": form_id,
            "template_id": template_id,
            "template_codigo": template_info["codigo"],
            "template_nombre": template_info["nombre"],
            "proceso": template_info["proceso"],
            "created_at": created_at,
            "filled_by": filled_by,
            "filled_by_role": filled_by_role,
            "tipo_producto": tipo_producto,
            "header_data": header_data,
            "body_summary": body_summary,
            "lotes_encontrados": all_lotes,
        }

        lotes_unicos = set(lote for lote, _ in all_lotes)
        for lote_num in lotes_unicos:
            historial_lotes[lote_num].append(event)

    print(f"[EXTRACTOR] Procesados {count} formularios via API.")
    print(f"[EXTRACTOR] {forms_con_lote} formularios contenian campo de Lote.")
    print(f"[EXTRACTOR] {len(historial_lotes)} lotes unicos encontrados.")

    return dict(historial_lotes)
````

## File: litellm_config_clean.yaml
````yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_base: https://models.inference.ai.azure.com
      api_key: os.environ/GITHUB_TOKEN
      timeout: 30
      stream_timeout: 60

  - model_name: modelo-local-a100
    litellm_params:
      model: ollama/llama3
      api_base: http://localhost:11434
      api_key: "not-needed"
      timeout: 120
      stream_timeout: 180

litellm_settings:
  fallbacks:
    - gpt-4o: ["modelo-local-a100"]
  num_retries: 1
  cooldown_time: 60
  set_verbose: false

general_settings:
  master_key: sk-frigo-litellm
````

## File: litellm_config.yaml
````yaml
# =============================================================================
# litellm_config.yaml — Proxy Transparente con Fallback (Alta Disponibilidad)
#
# Patrón: Azure OpenAI (nube) como ruta primaria → NVIDIA A100 On-Premise
#         como fallback automático si Azure falla (timeout, 5xx, corte de red).
#
# LiteLLM actúa como proxy HTTP en localhost:4000. Todos los componentes
# (agent.py, streaming.py) apuntan a este proxy en lugar de a Azure directo.
# El proxy resuelve el modelo "gpt-4o" al proveedor configurado aquí,
# y si el primario falla, enruta al fallback sin intervención del caller.
#
# Arranque:
#   litellm --config litellm_config.yaml --port 4000
#
# Variables de entorno requeridas:
#   AZURE_OPENAI_ENDPOINT  — Endpoint del recurso Azure OpenAI
#   AZURE_OPENAI_KEY       — API Key del recurso Azure OpenAI
# =============================================================================

model_list:

  # -----------------------------------------------------------------------
  # PRIMARIO: GitHub Models — Meta-Llama-3.1-405B-Instruct
  # 128,000 tokens de contexto. Sin limite 413. Calidad muy alta.
  # Ruta por defecto. Si falla, LiteLLM activa fallback a A100 on-prem.
  # -----------------------------------------------------------------------
  - model_name: gpt-4o
    litellm_params:
      model: github/Meta-Llama-3.1-405B-Instruct
      api_base: https://models.inference.ai.azure.com
      api_key: os.environ/GITHUB_TOKEN
      timeout: 60
      stream_timeout: 120

  # -----------------------------------------------------------------------
  # FALLBACK TEXTO: NVIDIA A100 On-Premise — llama3.2 (solo texto)
  # Para generación de texto, consultas y respuestas al operario.
  # Más rápido que vision al no procesar imágenes.
  # -----------------------------------------------------------------------
  - model_name: modelo-local-texto
    litellm_params:
      model: ollama/mistral
      api_base: https://io.frigolab.dev
      api_key: "not-needed"
      timeout: 45
      stream_timeout: 90

  # -----------------------------------------------------------------------
  # FALLBACK VISION: NVIDIA A100 On-Premise — llama3.2-vision (multimodal)
  # Texto + imágenes. Segunda línea de fallback si el modelo de texto falla.
  # -----------------------------------------------------------------------
  - model_name: modelo-local-a100
    litellm_params:
      model: ollama/llama3.2-vision
      api_base: https://io.frigolab.dev
      api_key: "not-needed"
      timeout: 60
      stream_timeout: 120

# ---------------------------------------------------------------------------
# Política de fallback: si "gpt-4o" falla → enrutar a "modelo-local-a100"
# LiteLLM reintenta automáticamente en el fallback sin que el caller lo sepa.
# ---------------------------------------------------------------------------
litellm_settings:
  # Cadena: Azure GPT-4o → llama3.2 texto → llama3.2-vision multimodal
  fallbacks:
    - gpt-4o: ["modelo-local-texto", "modelo-local-a100"]

  # Reintentos antes de escalar al fallback (0 = ir directo al fallback)
  num_retries: 1
  # Cooldown del modelo primario tras fallo (segundos antes de reintentar Azure)
  cooldown_time: 60

  # Habilitar streaming nativo (crítico para TTS en tiempo real)
  set_verbose: false

# ---------------------------------------------------------------------------
# Configuración del proxy HTTP
# ---------------------------------------------------------------------------
general_settings:
  # Master key para autenticar peticiones al proxy (los clientes envían esta key)
  master_key: os.environ/LITELLM_MASTER_KEY
````

## File: llm_client.py
````python
"""
llm_client.py - Cliente para el LLM (Mistral en A100 via Ollama, o cualquier API compatible)

Genera respuestas de trazabilidad usando el contexto del RAG.
"""
import httpx
from config import LLM_API_URL, LLM_MODEL


SYSTEM_PROMPT = """Eres el auditor de calidad de Frigolab San Mateo, una planta procesadora de productos del mar.
Tu rol es analizar datos de trazabilidad de lotes de produccion y responder preguntas sobre ellos.

Reglas:
- Responde en espanol, de forma clara y profesional.
- Usa los datos proporcionados como contexto. No inventes datos que no esten en el contexto.
- Si se pide un reporte, usa vinetas o listas numeradas.
- Senala si hay anomalias (temperaturas fuera de rango, tiempos irregulares, firmas faltantes).
- Menciona los responsables (quien firmo cada control).
- Si no hay datos suficientes para responder, indicalo honestamente.
"""


async def generate_response(query: str, context: str, stream: bool = False) -> str:
    """
    Genera una respuesta usando el LLM con contexto de trazabilidad.

    Args:
        query: Pregunta del usuario
        context: Narrativa(s) de trazabilidad del RAG
        stream: Si usar streaming (para voice TTS)

    Returns:
        Respuesta del LLM como string
    """
    prompt = f"""CONTEXTO DE TRAZABILIDAD:
{context}

PREGUNTA DEL USUARIO:
{query}

Responde basandote exclusivamente en el contexto proporcionado."""

    payload = {
        "model": LLM_MODEL,
        "prompt": prompt,
        "system": SYSTEM_PROMPT,
        "stream": False,
        "options": {
            "temperature": 0.3,
            "top_p": 0.9,
            "num_predict": 1024,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(LLM_API_URL, json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("response", "No se obtuvo respuesta del modelo.")
    except httpx.ConnectError:
        return (
            "[ERROR] No se pudo conectar al LLM. "
            "Verifica que Ollama este corriendo con el modelo Mistral cargado. "
            "Comando: ollama run mistral"
        )
    except httpx.HTTPStatusError as e:
        return f"[ERROR] LLM respondio con error {e.response.status_code}: {e.response.text}"
    except Exception as e:
        return f"[ERROR] Error inesperado al consultar LLM: {e}"


async def generate_audit_report(lote_num: str, context: str) -> str:
    """
    Genera un reporte de auditoria estructurado para un lote.
    """
    query = (
        f"Genera un reporte de auditoria completo del lote {lote_num}. "
        f"Incluye: 1) Resumen del lote, 2) Cadena de custodia paso a paso, "
        f"3) Responsables y firmas, 4) Anomalias encontradas (si las hay), "
        f"5) Conclusion sobre el cumplimiento."
    )
    return await generate_response(query, context)
````

## File: main.py
````python
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
````

## File: mcp_client.py
````python
"""
mcp_client.py - Cliente MCP para FrigoVoice con langchain-mcp-adapters

Arquitectura Zero Trust: el agente LangGraph NO accede directamente a la BD.
Las herramientas se descubren del servidor MCP (mcp_server.py) y se convierten
en tools LangChain nativos listos para create_react_agent / LangGraph.

Estrategia de transporte (con fallback):
  1. SSE (preferido): conecta a mcp_server.py corriendo en http://localhost:8001/sse
     → Persistente, bajo overhead, ideal para bot 24/7.
  2. stdio (fallback): lanza mcp_server.py como subproceso.
     → Se usa si el servidor SSE no está levantado.

API pública:
  await initialize_mcp()              → inicia la conexión al arrancar el bot
  await shutdown_mcp()                → cierra limpiamente al detener el bot
  get_active_tools() → list           → devuelve los LangChain tools activos
  mcp_is_active()    → bool           → True si hay sesión MCP viva
  mcp_server_url()   → str            → URL del servidor MCP (o "stdio")

Requiere: mcp[cli]>=1.0.0, langchain-mcp-adapters>=0.1.0
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------
_MCP_SERVER_PATH: str = str(Path(__file__).parent / "mcp_server.py")
_PYTHON_EXE: str = sys.executable
_MCP_SSE_URL: str = os.getenv("MCP_SSE_URL", "http://localhost:8001/sse")
_MCP_CONNECT_TIMEOUT: float = float(os.getenv("MCP_CONNECT_TIMEOUT", "5"))

# ---------------------------------------------------------------------------
# Estado del módulo (no exportar directamente — usar funciones de acceso)
# ---------------------------------------------------------------------------
_mcp_client: Any | None = None          # MultiServerMCPClient activo
_mcp_client_ctx: Any | None = None      # Contexto del async with
_active_tools: list = []                # LangChain tools listos para LangGraph
_transport_used: str = "none"           # "sse" | "stdio" | "none"
_init_lock = asyncio.Lock()
_initialized: bool = False


# ---------------------------------------------------------------------------
# Helpers de comprobación
# ---------------------------------------------------------------------------

def mcp_is_active() -> bool:
    """True si hay una sesión MCP viva con herramientas cargadas."""
    return bool(_active_tools) and _mcp_client is not None


def get_active_tools() -> list:
    """Devuelve la lista de LangChain tools cargados desde MCP."""
    return list(_active_tools)


def mcp_server_url() -> str:
    """Devuelve el transporte que se usó (sse URL o 'stdio' o 'none')."""
    return _transport_used


async def _sse_server_reachable() -> bool:
    """Intenta conectar al endpoint SSE; retorna True si responde."""
    import httpx
    base = _MCP_SSE_URL.replace("/sse", "")
    try:
        async with httpx.AsyncClient(timeout=_MCP_CONNECT_TIMEOUT) as c:
            await c.get(base)
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Inicialización — SSE primero, stdio como fallback
# ---------------------------------------------------------------------------

async def initialize_mcp() -> bool:
    """Inicializa la conexión MCP. Llama una sola vez al arrancar el bot.

    Intenta SSE (servidor externo) primero. Si falla, intenta stdio
    (lanza mcp_server.py como subproceso). Si ambos fallan, el bot cae
    al fallback de sql_tools directos (comportamiento anterior).

    Returns:
        True  → MCP activo, get_active_tools() tiene las herramientas.
        False → MCP no disponible, usar sql_tools directamente.
    """
    global _mcp_client, _mcp_client_ctx, _active_tools, _transport_used, _initialized

    async with _init_lock:
        if _initialized:
            return mcp_is_active()

        # -- Intento 1: SSE ------------------------------------------------
        if await _sse_server_reachable():
            ok = await _init_sse()
            if ok:
                _initialized = True
                return True

        # -- Intento 2: stdio (lanza mcp_server.py como subproceso) --------
        ok = await _init_stdio()
        _initialized = True
        return ok


async def _init_sse() -> bool:
    """Conecta via SSE a mcp_server.py ya corriendo en _MCP_SSE_URL."""
    global _mcp_client, _mcp_client_ctx, _active_tools, _transport_used
    try:
        from langchain_mcp_adapters.client import MultiServerMCPClient
        client = MultiServerMCPClient({
            "frigolab": {
                "url": _MCP_SSE_URL,
                "transport": "sse",
            }
        })
        tools = await client.get_tools()
        _mcp_client = client
        _mcp_client_ctx = None
        _active_tools = tools
        _transport_used = _MCP_SSE_URL
        log.info(
            "MCP (SSE): conectado a %s — %d herramientas: %s",
            _MCP_SSE_URL,
            len(tools),
            [t.name for t in tools],
        )
        return True
    except Exception as exc:
        log.warning("MCP SSE init fallo (%s): %s", _MCP_SSE_URL, exc)
        return False


async def _init_stdio() -> bool:
    """Lanza mcp_server.py como subproceso y conecta via stdio."""
    global _mcp_client, _mcp_client_ctx, _active_tools, _transport_used
    try:
        from langchain_mcp_adapters.client import MultiServerMCPClient
        client = MultiServerMCPClient({
            "frigolab": {
                "command": _PYTHON_EXE,
                "args": [_MCP_SERVER_PATH],
                "transport": "stdio",
                "env": {
                    **os.environ,
                    "API_BASE_URL": os.getenv("API_BASE_URL", "http://localhost:5074/api"),
                },
            }
        })
        tools = await client.get_tools()
        _mcp_client = client
        _mcp_client_ctx = None
        _active_tools = tools
        _transport_used = "stdio"
        log.info(
            "MCP (stdio): subproceso iniciado — %d herramientas: %s",
            len(tools),
            [t.name for t in tools],
        )
        return True
    except Exception as exc:
        log.warning("MCP stdio init fallo: %s", exc)
        _transport_used = "none"
        return False


async def shutdown_mcp() -> None:
    """Cierra la sesión MCP limpiamente. Llama al detener el bot."""
    global _mcp_client, _mcp_client_ctx, _active_tools, _initialized
    if _mcp_client is not None:
        try:
            # MultiServerMCPClient 0.1.0 no usa context manager — solo limpiar refs.
            _mcp_client = None
            log.info("MCP: sesion cerrada.")
        except Exception as exc:
            log.warning("MCP shutdown error: %s", exc)
    _mcp_client_ctx = None
    _active_tools = []
    _initialized = False


# ---------------------------------------------------------------------------
# Compat — la interfaz antigua (usada por agent.py) sigue funcionando
# Solo se usa si agent.py aún importa `inyectar_herramientas_mcp`.
# ---------------------------------------------------------------------------

async def inyectar_herramientas_mcp(llm_instance: Any) -> tuple:
    """OBSOLETO — mantener para compatibilidad con agent.py.

    Llama a initialize_mcp() e ignora el llm_instance (el binding se hace
    en agent._get_bound_llm que ya recibe la lista de tools).
    Devuelve (None, None, None, active_tools) para no romper el caller.
    """
    ok = await initialize_mcp()
    tools = get_active_tools() if ok else []
    return (None, None, None, tools)


async def ejecutar_tool_mcp(session: Any, tool_name: str, arguments: dict) -> str:
    """OBSOLETO — con langchain-mcp-adapters los tools se invocan via .ainvoke().

    Mantenido para compatibilidad. Si hay tools MCP activos, los busca por nombre
    y los invoca. Caso contrario devuelve error.
    """
    for t in _active_tools:
        if getattr(t, "name", None) == tool_name:
            try:
                return str(await t.ainvoke(arguments))
            except Exception as exc:
                return f'{{"status":"error","message":"Tool {tool_name} fallo: {exc}"}}'
    return f'{{"status":"error","message":"Tool {tool_name} no encontrado en MCP activo."}}'


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import asyncio
    from dotenv import load_dotenv
    load_dotenv()

    async def _test() -> None:
        print("=== Test MCP Client (langchain-mcp-adapters) ===\n")
        ok = await initialize_mcp()
        print(f"MCP activo: {ok} | Transporte: {mcp_server_url()}")
        tools = get_active_tools()
        print(f"Herramientas ({len(tools)}):")
        for t in tools:
            print(f"  - {t.name}")
        if tools:
            print("\nEjecutando primera herramienta con args vacios...")
            try:
                result = await tools[0].ainvoke({})
                print("Resultado:", str(result)[:300])
            except Exception as exc:
                print("Error (esperado si la BD no está disponible):", exc)
        await shutdown_mcp()

    asyncio.run(_test())
````

## File: mcp_server.py
````python
"""
mcp_server.py - Servidor MCP (Model Context Protocol) para FrigoVoice AI

v2 - Senior hardening:
  - Sin credenciales hardcodeadas. Usa `config.get_connection_string()` como
    unica fuente de verdad (misma que usa sql_tools). Si faltan variables de
    entorno el servidor se niega a arrancar con un error explicito.
  - Todas las queries usan `db_utils.run_sql` -> timeout + retry transitorio.
  - Todas las tools devuelven JSON estructurado (tool_result) para que el
    cliente MCP (agente IA, Foundry, Copilot) sepa si hubo ok / empty / error.
  - Cero duplicacion con sql_tools.py: ambos comparten `db_utils`.

Arquitectura Zero Trust: El LLM NUNCA accede directamente a la BD.
Todas las consultas pasan por este servidor MCP como capa de seguridad.

HERRAMIENTAS EXPUESTAS via FastMCP:
  1. auditar_trazabilidad_lote  - Trazabilidad cronologica completa de un lote
  2. obtener_esquema            - Esquema JSON de formulario de QC
  3. guardar_borrador           - Guardar borrador desde dictado de voz
  4. listar_templates           - Formularios activos disponibles
  5. consultar_formularios      - Consulta read-only de formularios llenados
  6. estadisticas_formularios   - Porcentajes de cumplimiento por formulario
  7. analizar_datos_formulario  - Analisis de valores dentro de FilledForms
  8. consultar_alertas          - Alertas pendientes del sistema
  9. analizar_foto_etiqueta     - Vision llama3.2 en A100 CEDIA (canal MCP)
 10. obtener_formulario_completo - Contenido completo de un formulario llenado (todas las filas)

Uso:
  python mcp_server.py                  # stdio (VS Code / Copilot / LangGraph)
  python mcp_server.py --transport sse  # SSE  (Azure AI Foundry / web)

Requiere: mcp[cli] en requirements.txt y credenciales SQL en .env
"""
# Nota: NO usamos `from __future__ import annotations` aqui porque FastMCP
# inspecciona `param.annotation` directamente (ver mcp.server.fastmcp.tools.base)
# y con annotations postponed todas las firmas serian strings, rompiendo
# `issubclass()`. Mantenemos las anotaciones evaluadas en tiempo de clase.

import json
import logging
import os
import sys
from datetime import datetime
from typing import Any

from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

# Carga .env ANTES de importar config (config lee variables al importarse).
load_dotenv()

from config import API_BASE_URL, get_connection_string  # noqa: E402
from db_utils import (  # noqa: E402
    extract_rows_with_lote,
    fetchall,
    fetchone,
    find_lote_in_json,
    get_connection,
    run_http_post,
    run_sql,
    safe_json,
)
from tool_result import (  # noqa: E402
    CODE_NOT_FOUND,
    CODE_VALIDATION,
    empty,
    err,
    from_exception,
    ok,
)

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Validacion temprana de credenciales
#
# Si el operador olvida el .env o montarlo en el contenedor, fallar RAPIDO y
# RUIDOSO en arranque antes de aceptar la primera peticion. Mucho mejor que
# descubrirlo cuando un operario esperaba un resultado.
# ---------------------------------------------------------------------------

def _validate_env() -> None:
    required = ("SQL_SERVER", "SQL_DATABASE", "SQL_USER", "SQL_PASSWORD")
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        raise RuntimeError(
            f"mcp_server: faltan variables de entorno criticas: {missing}. "
            "Define SQL_SERVER, SQL_DATABASE, SQL_USER y SQL_PASSWORD en tu .env "
            "o como secretos del contenedor. NO hay defaults hardcodeados."
        )
    # Forzamos una verificacion temprana del connection string.
    _ = get_connection_string()


_validate_env()


# ---------------------------------------------------------------------------
# FastMCP Server Instance
# ---------------------------------------------------------------------------

mcp = FastMCP(
    "Frigolab_DB_Server",
    instructions=(
        "Servidor MCP de Frigolab San Mateo - planta de exportacion de productos del mar. "
        "Provee herramientas de trazabilidad de lotes, esquemas de formularios de QC, "
        "guardado de borradores y consulta de alertas. Todas las respuestas son JSON "
        "estructurado con los campos {status, code, message, data}."
    ),
)


# ===========================================================================
# TOOL 1: auditar_trazabilidad_lote
# ===========================================================================

@mcp.tool()
async def auditar_trazabilidad_lote(numero_lote: str) -> str:
    """Rastrea la trazabilidad cronologica completa de un lote en Frigolab.

    Recorre TODOS los formularios de control de calidad que registraron el lote
    y devuelve la historia ordenada por fecha. Incluye fallback a borradores
    (FormDrafts) si no hay formularios firmados.

    Args:
        numero_lote: Identificador del lote a rastrear (ej. "260302", "LOT-260318").

    Returns:
        JSON con {status, code, message, data} — data contiene una lista de
        pasos con template, fecha, responsable y filas que mencionan el lote.
    """
    numero_lote = numero_lote.strip()
    if not numero_lote:
        return err(CODE_VALIDATION, "Debes proporcionar un numero de lote.")

    pattern = f"%{numero_lote}%"

    def _sync():
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT ff.FormID, ff.TemplateID, ff.HeaderData, ff.BodyData,
                   ff.TemplateSnapshot, ff.CreatedAt, ff.FilledBy,
                   ff.FilledByRole, ff.TipoProducto, ff.Observaciones
            FROM FilledForms ff
            WHERE LOWER(ff.HeaderData) LIKE LOWER(?)
               OR LOWER(ff.BodyData)   LIKE LOWER(?)
            ORDER BY ff.CreatedAt ASC
        """, [pattern, pattern])
        rows = fetchall(cur)
        if rows:
            conn.close()
            return {"kind": "forms", "rows": rows}

        cur.execute("""
            SELECT DraftID, TemplateID, TemplateName, TemplateCodigo,
                   UserName, HeaderData, BodyData, CreatedAt
            FROM FormDrafts
            WHERE (LOWER(HeaderData) LIKE LOWER(?) OR LOWER(BodyData) LIKE LOWER(?))
              AND IsActive = 1
            ORDER BY CreatedAt ASC
        """, [pattern, pattern])
        drafts = fetchall(cur)
        conn.close()
        return {"kind": "drafts", "rows": drafts}

    try:
        result = await run_sql(_sync, op_name=f"mcp.auditar_trazabilidad[{numero_lote}]")
    except Exception as exc:
        return from_exception(exc, f"auditar_trazabilidad_lote[{numero_lote}]")

    if result["kind"] == "drafts":
        drafts = result["rows"]
        if not drafts:
            return empty(
                f"No se encontraron registros para el lote {numero_lote}.",
                {"numero_lote": numero_lote},
            )
        data = [
            {
                "tipo": "borrador",
                "draft_id": d["DraftID"],
                "template_nombre": d["TemplateName"],
                "template_codigo": d["TemplateCodigo"],
                "created_at": str(d["CreatedAt"]),
                "user_name": d["UserName"],
            }
            for d in drafts
        ]
        return ok(
            f"Solo hay borradores del lote {numero_lote} ({len(drafts)} encontrados).",
            {"numero_lote": numero_lote, "pasos": data, "solo_borradores": True},
        )

    rows = result["rows"]
    matching: list[dict] = []
    for row in rows:
        header = safe_json(row["HeaderData"]) or {}
        body = safe_json(row["BodyData"]) or []
        snapshot = safe_json(row["TemplateSnapshot"]) or {}

        if not find_lote_in_json(header, numero_lote) and not find_lote_in_json(body, numero_lote):
            continue

        matching.append({
            "form_id": row["FormID"],
            "template_codigo": snapshot.get("Codigo") or snapshot.get("codigo", ""),
            "template_nombre": snapshot.get("Nombre") or snapshot.get("nombre", "N/A"),
            "proceso": snapshot.get("Proceso") or snapshot.get("proceso", ""),
            "created_at": str(row["CreatedAt"]),
            "filled_by": row["FilledBy"] or "N/A",
            "filled_by_role": row["FilledByRole"] or "",
            "tipo_producto": row["TipoProducto"] or "",
            "observaciones": row["Observaciones"] or "",
            "header": header,
            "body_rows": extract_rows_with_lote(body, numero_lote),
        })

    if not matching:
        return empty(
            f"Se encontraron registros con '{numero_lote}' como texto libre, "
            "pero ninguno en un campo de lote especifico.",
            {"numero_lote": numero_lote, "falsos_positivos": len(rows)},
        )

    return ok(
        f"Trazabilidad del lote {numero_lote}: {len(matching)} pasos encontrados.",
        {"numero_lote": numero_lote, "pasos": matching, "solo_borradores": False},
    )


# ===========================================================================
# TOOL 2: obtener_esquema
# ===========================================================================

@mcp.tool()
async def obtener_esquema(nombre_formulario: str) -> str:
    """Obtiene el esquema JSON exacto de un formulario de control de calidad.

    Devuelve HeaderFields, BodyElements, TemplateID y firmas requeridas.
    Acepta codigo (FOR-CC-10) o nombre parcial (sellos, fileteo).
    Pasa cadena vacia para listar todos los formularios disponibles.

    Args:
        nombre_formulario: Nombre o codigo del formulario. Vacio para listar todos.

    Returns:
        JSON con {status, code, message, data} - data contiene el esquema.
    """
    nombre = nombre_formulario.strip()
    if not nombre:
        return await _listar_templates_impl()

    def _sync():
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT TemplateID, Codigo, Nombre, Proceso, QuienLoLlena,
                   HeaderFields, BodyElements, Firmas
            FROM Templates
            WHERE Codigo = ? AND IsObsolete = 0
        """, [nombre.upper()])
        row = fetchone(cur)
        if not row:
            like_pattern = f"%{nombre.lower()}%"
            cur.execute("""
                SELECT TemplateID, Codigo, Nombre, Proceso, QuienLoLlena,
                       HeaderFields, BodyElements, Firmas
                FROM Templates
                WHERE (LOWER(Nombre) LIKE ? OR LOWER(Codigo) LIKE ?)
                  AND IsObsolete = 0
            """, [like_pattern, like_pattern])
            row = fetchone(cur)
        conn.close()
        return row

    try:
        row = await run_sql(_sync, op_name=f"mcp.obtener_esquema[{nombre}]")
    except Exception as exc:
        return from_exception(exc, f"obtener_esquema[{nombre}]")

    if not row:
        return err(
            CODE_NOT_FOUND,
            f"No se encontro el formulario '{nombre_formulario}'. "
            "Usa obtener_esquema con cadena vacia para ver la lista.",
            {"nombre_buscado": nombre_formulario},
        )

    schema = {
        "template_id": row["TemplateID"],
        "codigo": row["Codigo"],
        "nombre": row["Nombre"],
        "proceso": row["Proceso"],
        "quien_lo_llena": row["QuienLoLlena"],
        "header_fields": safe_json(row["HeaderFields"]) or [],
        "body_elements": safe_json(row["BodyElements"]) or [],
        "firmas": safe_json(row["Firmas"]) or [],
    }
    return ok(
        f"Esquema del formulario {row['Codigo']} - {row['Nombre']}.",
        schema,
    )


# ===========================================================================
# TOOL 3: guardar_borrador
# ===========================================================================

@mcp.tool()
async def guardar_borrador(
    template_id: int,
    json_datos: str,
    usuario: str = "Operador FrigoIA",
) -> str:
    """Guarda un borrador de formulario de QC con datos dictados por voz.

    Requiere primero obtener el esquema con obtener_esquema para conocer los
    nombres exactos de campos. NO inventes nombres.

    Args:
        template_id: ID numerico del template (obtenido de obtener_esquema).
        json_datos: JSON con claves "header" y "body":
            {"header": {"CampoExacto": "valor"}, "body": [{"id": 1, "type": "table", "data": [{"Col": "val"}]}]}
        usuario: Nombre del operador que registra los datos.

    Returns:
        JSON con {status, code, message, data} - data.draft_id con el ID creado.
    """
    try:
        datos = json.loads(json_datos)
    except json.JSONDecodeError as e:
        return err(CODE_VALIDATION, f"JSON invalido: {e}")

    header_data: dict = datos.get("header", {})
    body_data: list = datos.get("body", [])

    if not isinstance(header_data, dict):
        return err(CODE_VALIDATION, "El campo 'header' debe ser un objeto JSON.")
    if not isinstance(body_data, list):
        return err(CODE_VALIDATION, "El campo 'body' debe ser una lista JSON.")

    def _get_tmpl():
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT TemplateID, Codigo, Nombre, Version, Proceso, QuienLoLlena,
                   HeaderFields, BodyElements, Firmas
            FROM Templates
            WHERE TemplateID = ? AND IsObsolete = 0
        """, [template_id])
        r = fetchone(cur)
        conn.close()
        return r

    try:
        row = await run_sql(_get_tmpl, op_name=f"mcp.guardar_borrador.get_tmpl[{template_id}]")
    except Exception as exc:
        return from_exception(exc, f"guardar_borrador.get_tmpl[{template_id}]")

    if not row:
        return err(
            CODE_NOT_FOUND,
            f"No se encontro template ID {template_id}.",
            {"template_id": template_id},
        )

    # Auto-completar campos de fecha/hora vacios
    firmas_list = safe_json(row["Firmas"]) or []
    for field in (safe_json(row["HeaderFields"]) or []):
        label = field.get("label", "")
        ftype = field.get("type", "")
        if not header_data.get(label):
            if ftype == "date":
                header_data[label] = datetime.now().strftime("%Y-%m-%d")
            elif ftype == "time":
                header_data[label] = datetime.now().strftime("%H:%M")

    firmas_data = {
        f.get("puesto", ""): {"nombre": "", "fecha": "", "hora": "", "email": ""}
        for f in firmas_list if f.get("puesto")
    }

    hf_str = row["HeaderFields"] if isinstance(row["HeaderFields"], str) else json.dumps(row["HeaderFields"], ensure_ascii=False)
    be_str = row["BodyElements"] if isinstance(row["BodyElements"], str) else json.dumps(row["BodyElements"], ensure_ascii=False)
    firmas_str = row["Firmas"] if isinstance(row["Firmas"], str) else json.dumps(row["Firmas"], ensure_ascii=False)

    snapshot = {
        "TemplateID": row["TemplateID"], "Codigo": row["Codigo"],
        "Nombre": row["Nombre"], "Version": row["Version"],
        "Proceso": row["Proceso"], "QuienLoLlena": row["QuienLoLlena"],
        "HeaderFields": hf_str, "BodyElements": be_str, "Firmas": firmas_str,
    }

    draft_payload = {
        "templateID": row["TemplateID"],
        "templateName": row["Nombre"],
        "templateCodigo": row["Codigo"],
        "userName": usuario,
        "userEmail": "",
        "userRole": "operador",
        "headerData": json.dumps(header_data, ensure_ascii=False),
        "bodyData": json.dumps(body_data, ensure_ascii=False),
        "firmasData": json.dumps(firmas_data, ensure_ascii=False),
        "templateSnapshot": json.dumps(snapshot, ensure_ascii=False),
        "progress": 10,
        "nota": "Borrador creado por FrigoVoice MCP",
    }

    try:
        saved = await run_http_post(
            f"{API_BASE_URL}/FormDrafts",
            draft_payload,
            op_name=f"mcp.guardar_borrador.post[{template_id}]",
        )
    except Exception as e:
        return from_exception(e, f"guardar_borrador.http_post[{template_id}]")

    draft_id = saved.get("draftID") or saved.get("DraftID", "?")
    return ok(
        f"Borrador creado exitosamente para {row['Nombre']} ({row['Codigo']}).",
        {
            "draft_id": draft_id,
            "template_id": row["TemplateID"],
            "template_codigo": row["Codigo"],
            "template_nombre": row["Nombre"],
            "proceso": row["Proceso"],
            "usuario": usuario,
            "header_prellenado": {k: v for k, v in header_data.items() if v},
        },
    )


# ===========================================================================
# TOOL 4: listar_templates
# ===========================================================================

@mcp.tool()
async def listar_templates() -> str:
    """Lista todos los formularios (templates) activos disponibles en Frigolab.

    Devuelve ID, codigo, nombre, area y quien los llena. Util para conocer
    que formularios estan disponibles antes de pedir un esquema.

    Returns:
        JSON con {status, code, message, data} - data.templates con la lista.
    """
    return await _listar_templates_impl()


async def _listar_templates_impl() -> str:
    def _sync():
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT TemplateID, Codigo, Nombre, Proceso, QuienLoLlena, Frecuencia
            FROM Templates
            WHERE IsObsolete = 0 AND IsDraft = 0
            ORDER BY Codigo
        """)
        rows = fetchall(cur)
        conn.close()
        return rows

    try:
        rows = await run_sql(_sync, op_name="mcp.listar_templates")
    except Exception as e:
        return from_exception(e, "listar_templates")

    if not rows:
        return empty("No se encontraron templates activos.")

    templates = [
        {
            "template_id": r["TemplateID"],
            "codigo": r["Codigo"],
            "nombre": r["Nombre"],
            "proceso": r["Proceso"] or "N/A",
            "quien_lo_llena": r["QuienLoLlena"] or "N/A",
            "frecuencia": r["Frecuencia"] or "N/A",
        }
        for r in rows
    ]
    return ok(f"{len(templates)} formularios disponibles.", {"templates": templates})


# ===========================================================================
# TOOL 5: consultar_formularios
# ===========================================================================

@mcp.tool()
async def consultar_formularios(
    template_codigo: str = "",
    fecha_desde: str = "",
    fecha_hasta: str = "",
    limite: int = 20,
) -> str:
    """Consulta formularios llenados (FilledForms) con filtros opcionales.

    Args:
        template_codigo: Filtrar por codigo de template. Vacio = todos.
        fecha_desde: Fecha inicio YYYY-MM-DD.
        fecha_hasta: Fecha fin YYYY-MM-DD.
        limite: Maximo de resultados (default 20, tope 100).

    Returns:
        JSON con {status, code, message, data.formularios}.
    """
    limite = min(max(1, limite), 100)

    def _sync():
        conn = get_connection()
        cur = conn.cursor()
        query = """
            SELECT TOP (?) ff.FormID, ff.CreatedAt, ff.FilledBy, ff.FilledByRole,
                   ff.TipoProducto, ff.Observaciones,
                   t.Codigo, t.Nombre as TemplateName
            FROM FilledForms ff
            JOIN Templates t ON ff.TemplateID = t.TemplateID
            WHERE 1=1
        """
        params: list[Any] = [limite]

        if template_codigo:
            query += " AND t.Codigo = ?"
            params.append(template_codigo.upper())
        if fecha_desde:
            query += " AND ff.CreatedAt >= ?"
            params.append(fecha_desde)
        if fecha_hasta:
            query += " AND ff.CreatedAt < DATEADD(day, 1, CONVERT(date, ?))"
            params.append(fecha_hasta)

        query += " ORDER BY ff.CreatedAt DESC"
        cur.execute(query, params)
        rows = fetchall(cur)
        conn.close()
        return rows

    try:
        rows = await run_sql(_sync, op_name="mcp.consultar_formularios")
    except Exception as exc:
        return from_exception(exc, "consultar_formularios")

    if not rows:
        return empty(
            "No se encontraron formularios con esos filtros.",
            {"template_codigo": template_codigo, "fecha_desde": fecha_desde, "fecha_hasta": fecha_hasta},
        )

    formularios = [
        {
            "form_id": r["FormID"],
            "codigo": r["Codigo"],
            "template_nombre": r["TemplateName"],
            "created_at": str(r["CreatedAt"]),
            "filled_by": r["FilledBy"] or "N/A",
            "filled_by_role": r["FilledByRole"] or "",
            "tipo_producto": r["TipoProducto"] or "N/A",
            "observaciones": r["Observaciones"] or "",
        }
        for r in rows
    ]
    return ok(
        f"{len(formularios)} formularios encontrados.",
        {"formularios": formularios, "total": len(formularios)},
    )


# ===========================================================================
# TOOL 6: estadisticas_formularios
# ===========================================================================

@mcp.tool()
async def estadisticas_formularios(
    fecha_desde: str = "",
    fecha_hasta: str = "",
) -> str:
    """Calcula estadisticas de cumplimiento de formularios llenados.

    Devuelve total, porcentaje por template, formularios por dia, ranking de
    quien mas llena, y borradores activos.

    Args:
        fecha_desde: Fecha inicio YYYY-MM-DD. Vacio = ultimos 30 dias.
        fecha_hasta: Fecha fin YYYY-MM-DD. Vacio = hoy.

    Returns:
        JSON con {status, code, message, data} con totales, porcentajes y rankings.
    """
    def _sync():
        conn = get_connection()
        cur = conn.cursor()
        date_filter = ""
        date_params: list[Any] = []

        if fecha_desde:
            date_filter += " AND ff.CreatedAt >= ?"
            date_params.append(fecha_desde)
        else:
            date_filter += " AND ff.CreatedAt >= DATEADD(day, -30, GETDATE())"
        if fecha_hasta:
            date_filter += " AND ff.CreatedAt < DATEADD(day, 1, CONVERT(date, ?))"
            date_params.append(fecha_hasta)

        cur.execute(f"SELECT COUNT(*) FROM FilledForms ff WHERE 1=1 {date_filter}", date_params)
        total = (cur.fetchone() or [0])[0]

        cur.execute(
            f"""SELECT t.Codigo, t.Nombre, t.Proceso, COUNT(*) as cant
            FROM FilledForms ff JOIN Templates t ON ff.TemplateID = t.TemplateID
            WHERE 1=1 {date_filter} GROUP BY t.Codigo, t.Nombre, t.Proceso ORDER BY cant DESC""",
            date_params,
        )
        by_template = fetchall(cur)

        cur.execute(
            f"""SELECT TOP 10 CONVERT(date, ff.CreatedAt) as dia, COUNT(*) as cant
            FROM FilledForms ff WHERE 1=1 {date_filter}
            GROUP BY CONVERT(date, ff.CreatedAt) ORDER BY dia DESC""",
            date_params,
        )
        by_day = fetchall(cur)

        cur.execute(
            f"""SELECT TOP 10 ff.FilledBy as quien, COUNT(*) as cant
            FROM FilledForms ff WHERE 1=1 {date_filter}
            GROUP BY ff.FilledBy ORDER BY cant DESC""",
            date_params,
        )
        by_user = fetchall(cur)

        cur.execute("SELECT COUNT(*) FROM FormDrafts WHERE IsActive = 1")
        drafts_total = (cur.fetchone() or [0])[0]
        conn.close()
        return total, by_template, by_day, by_user, drafts_total

    try:
        total, by_template, by_day, by_user, drafts_total = await run_sql(
            _sync, op_name="mcp.estadisticas_formularios",
        )
    except Exception as exc:
        return from_exception(exc, "estadisticas_formularios")

    if total == 0:
        return empty(
            f"No hay formularios llenados en el periodo {fecha_desde or 'ultimos 30 dias'} - {fecha_hasta or 'hoy'}.",
        )

    periodo = f"{fecha_desde or 'ultimos 30 dias'} -> {fecha_hasta or 'hoy'}"

    dist = [
        {
            "codigo": r["Codigo"], "nombre": r["Nombre"], "proceso": r["Proceso"] or "N/A",
            "cantidad": r["cant"],
            "porcentaje": round((r["cant"] / total * 100), 2) if total else 0,
        }
        for r in by_template
    ]
    ranking_usuarios = [
        {
            "posicion": i,
            "usuario": r["quien"],
            "cantidad": r["cant"],
            "porcentaje": round((r["cant"] / total * 100), 2) if total else 0,
        }
        for i, r in enumerate(by_user, 1)
    ]
    actividad_diaria = [
        {"dia": str(r["dia"]), "cantidad": r["cant"]} for r in by_day
    ]

    return ok(
        f"Estadisticas del periodo {periodo}: {total} formularios llenados.",
        {
            "periodo": periodo,
            "total_formularios": total,
            "borradores_activos": drafts_total,
            "distribucion_por_template": dist,
            "ranking_responsables": ranking_usuarios,
            "actividad_diaria": actividad_diaria,
        },
    )


# ===========================================================================
# TOOL 7: analizar_datos_formulario
# ===========================================================================

@mcp.tool()
async def analizar_datos_formulario(
    template_codigo: str,
    fecha_desde: str = "",
    fecha_hasta: str = "",
    limite: int = 50,
) -> str:
    """Analiza los datos internos (HeaderData / BodyData) de formularios llenados.

    Agrupa valores para detectar patrones: productos mas frecuentes, rangos de
    temperatura / peso, valores de header mas comunes, observaciones frecuentes.

    Args:
        template_codigo: Codigo del formulario (ej. 'FOR-CC-10').
        fecha_desde: Fecha inicio YYYY-MM-DD. Vacio = ultimos 30 dias.
        fecha_hasta: Fecha fin YYYY-MM-DD. Vacio = hoy.
        limite: Maximo de formularios a analizar (default 50, tope 200).

    Returns:
        JSON con {status, code, message, data} con el analisis estructurado.
    """
    if not template_codigo:
        return err(CODE_VALIDATION, "Debes indicar el codigo del formulario (ej. FOR-CC-10).")

    limite = min(max(1, limite), 200)

    def _sync_analizar():
        conn = get_connection()
        cur = conn.cursor()
        date_filter = ""
        date_params: list[Any] = []

        if fecha_desde:
            date_filter += " AND ff.CreatedAt >= ?"
            date_params.append(fecha_desde)
        else:
            date_filter += " AND ff.CreatedAt >= DATEADD(day, -30, GETDATE())"
        if fecha_hasta:
            date_filter += " AND ff.CreatedAt < DATEADD(day, 1, CONVERT(date, ?))"
            date_params.append(fecha_hasta)

        all_params: list[Any] = [limite, template_codigo.upper()] + date_params
        cur.execute(
            f"""SELECT TOP (?) ff.FormID, ff.CreatedAt, ff.FilledBy, ff.TipoProducto,
                   ff.HeaderData, ff.BodyData, ff.Observaciones
            FROM FilledForms ff
            JOIN Templates t ON ff.TemplateID = t.TemplateID
            WHERE t.Codigo = ? {date_filter}
            ORDER BY ff.CreatedAt DESC""",
            all_params,
        )
        rows = fetchall(cur)
        conn.close()
        return rows

    try:
        rows = await run_sql(_sync_analizar, op_name=f"mcp.analizar_datos[{template_codigo}]")
    except Exception as exc:
        return from_exception(exc, f"analizar_datos_formulario[{template_codigo}]")

    if not rows:
        return empty(
            f"No hay formularios llenados de {template_codigo} en el periodo indicado.",
            {"template_codigo": template_codigo},
        )

    header_values: dict[str, dict[str, int]] = {}
    body_numeric: dict[str, list[float]] = {}
    productos: dict[str, int] = {}
    obs_list: list[str] = []

    for row in rows:
        header = safe_json(row["HeaderData"]) or {}
        body = safe_json(row["BodyData"]) or []

        prod = row["TipoProducto"] or header.get("Tipo de Producto") or header.get("Producto") or ""
        if prod:
            productos[prod] = productos.get(prod, 0) + 1

        for k, v in header.items():
            if not v or not str(v).strip():
                continue
            val = str(v).strip()
            header_values.setdefault(k, {})
            header_values[k][val] = header_values[k].get(val, 0) + 1

        if isinstance(body, list):
            for element in body:
                if not isinstance(element, dict) or element.get("type") != "table":
                    continue
                for data_row in element.get("data", []):
                    if not isinstance(data_row, dict):
                        continue
                    for col, val in data_row.items():
                        try:
                            num = float(str(val).replace(",", ".").replace("°", "").strip())
                            body_numeric.setdefault(col, []).append(num)
                        except (ValueError, TypeError):
                            pass

        obs = (row["Observaciones"] or "").strip()
        if obs:
            obs_list.append(obs[:120])

    # Stats numericas
    numeric_stats = {
        col: {
            "min": min(vals), "max": max(vals),
            "promedio": round(sum(vals) / len(vals), 2),
            "n": len(vals),
        }
        for col, vals in body_numeric.items() if len(vals) >= 2
    }
    # Top productos
    total_prod = sum(productos.values()) or 1
    productos_pct = [
        {"producto": p, "cantidad": c, "porcentaje": round(c / total_prod * 100, 2)}
        for p, c in sorted(productos.items(), key=lambda x: -x[1])
    ]
    # Top valores del header (hasta 3 por campo)
    header_top = {
        campo: [
            {"valor": v, "cantidad": c}
            for v, c in sorted(vals.items(), key=lambda x: -x[1])[:3]
        ]
        for campo, vals in header_values.items()
    }

    return ok(
        f"Analisis de {len(rows)} formularios {template_codigo}.",
        {
            "template_codigo": template_codigo,
            "periodo": f"{fecha_desde or 'ultimos 30 dias'} -> {fecha_hasta or 'hoy'}",
            "total_analizados": len(rows),
            "productos": productos_pct,
            "valores_numericos": numeric_stats,
            "header_top_valores": header_top,
            "observaciones": obs_list[:10],
            "observaciones_total": len(obs_list),
        },
    )


# ===========================================================================
# TOOL 8: consultar_alertas
# ===========================================================================

@mcp.tool()
async def consultar_alertas(
    solo_pendientes: bool = True,
    limite: int = 20,
) -> str:
    """Consulta las alertas pendientes del sistema de calidad de Frigolab.

    Args:
        solo_pendientes: Si True, solo muestra alertas no leidas.
        limite: Maximo de alertas a mostrar (default 20, tope 50).

    Returns:
        JSON con {status, code, message, data.alertas}.
    """
    limite = min(max(1, limite), 50)

    def _sync_alertas():
        conn = get_connection()
        cur = conn.cursor()
        query = f"""
            SELECT TOP ({limite}) Id, Type, Priority, Title, Message,
                   TargetEmail, FormCode, CreatedDate, IsRead, Status
            FROM Alerts
        """
        if solo_pendientes:
            query += " WHERE IsRead = 0"
        query += " ORDER BY CreatedDate DESC"
        cur.execute(query)
        rows = fetchall(cur)
        conn.close()
        return rows

    try:
        rows = await run_sql(_sync_alertas, op_name="mcp.consultar_alertas")
    except Exception as exc:
        return from_exception(exc, "consultar_alertas")

    if not rows:
        return empty(
            "No hay alertas pendientes." if solo_pendientes else "No hay alertas registradas.",
            {"solo_pendientes": solo_pendientes},
        )

    alertas = [
        {
            "id": r["Id"],
            "tipo": r["Type"],
            "prioridad": r["Priority"],
            "titulo": r["Title"],
            "mensaje": r["Message"],
            "form_code": r["FormCode"] or "N/A",
            "created_at": str(r["CreatedDate"]),
            "is_read": bool(r["IsRead"]),
            "status": r["Status"],
            "target_email": r["TargetEmail"],
        }
        for r in rows
    ]
    return ok(
        f"{len(alertas)} alertas {'pendientes' if solo_pendientes else 'totales'}.",
        {"alertas": alertas, "solo_pendientes": solo_pendientes},
    )


# ---------------------------------------------------------------------------
# TOOL 9: analizar_foto_etiqueta
# Vision con llama3.2-vision en A100 CEDIA expuesta via MCP protocol.
# Mantiene la conexion con la GPU activa incluso si el cliente directo
# de sql_tools esta ocupado; el agente puede enrutarse aqui como fallback.
# ---------------------------------------------------------------------------

import asyncio  # noqa: E402 (solo para este tool, asyncio ya esta en stdlib)
import base64 as _base64  # noqa: E402
import httpx  # noqa: E402

_VIS_URL     = os.getenv("OLLAMA_VISION_URL",          "https://ia.frigolab.dev/api/generate")
_VIS_MODEL   = os.getenv("OLLAMA_VISION_MODEL",        "llama3.2-vision")
_VIS_TIMEOUT = float(os.getenv("OLLAMA_VISION_TIMEOUT",     "20"))
_VIS_TIMEOUT_EXT = float(os.getenv("OLLAMA_VISION_TIMEOUT_EXT", "60"))

_VIS_PROMPT = (
    "Eres un asistente de control de calidad de Frigolab, planta pesquera de Ecuador. "
    "Analiza la imagen y extrae TODOS los datos visibles. "
    "Responde exactamente en este formato, sin texto adicional:\n"
    "LOTE: [numero o N/A]\n"
    "PRODUCTO: [especie/tipo o N/A]\n"
    "FECHA: [fecha visible o N/A]\n"
    "PESO: [peso o cantidad o N/A]\n"
    "TEMPERATURA: [temperatura si aparece o N/A]\n"
    "CODIGO_BARRAS: [codigo si hay o N/A]\n"
    "OTROS_DATOS: [cualquier otro dato relevante]\n"
    "FORMULARIO_RECOMENDADO: [uno de: FOR-PD-04 Fileteo / FOR-PD-05 Liberacion Tunel / "
    "FOR-PD-06 Corte Empaque / FOR-CC-10 Control Sellos / Sin formulario especifico]\n"
    "RAZON: [por que recomiendas ese formulario, en una frase]"
)


async def _mcp_llamar_vision(imagen_b64: str, timeout: float) -> tuple:
    """Retorna (response_text | None, error_code | None)."""
    payload = {
        "model": _VIS_MODEL,
        "prompt": _VIS_PROMPT,
        "images": [imagen_b64],
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(_VIS_URL, json=payload)
            resp.raise_for_status()
            text = resp.json().get("response", "").strip()
            return (text or None, None)
    except httpx.ConnectError:
        return None, "CONNECT_ERROR"
    except httpx.TimeoutException:
        return None, "TIMEOUT"
    except httpx.HTTPStatusError as exc:
        return None, f"HTTP_{exc.response.status_code}"
    except Exception as exc:
        return None, f"ERROR:{exc}"


@mcp.tool()
async def analizar_foto_etiqueta(imagen_base64: str) -> str:
    """Analiza foto de etiqueta/caja de producto con llama3.2-vision en la A100 de CEDIA.

    Extrae lote, producto, fechas, pesos, temperatura y recomienda el formulario
    de control de calidad correspondiente.  Canal MCP — la conexion con la GPU se
    mantiene activa independientemente del canal directo de sql_tools.

    Estrategia de resiliencia:
    - Intento 1: timeout rapido (20s). Si la GPU responde al instante, se devuelve.
    - Intento 2: timeout extendido (60s). Si la GPU estaba ocupada se espera un poco
      mas y se devuelve la respuesta cuando este lista.
    - Si ambos fallan, se devuelve mensaje orientativo para el operario.

    Args:
        imagen_base64: Imagen en base64 (JPEG/PNG). Acepta data-URI o base64 puro.
    """
    if not imagen_base64:
        return json.dumps({"status": "error", "message": "imagen_base64 vacia."})

    if "," in imagen_base64:
        imagen_base64 = imagen_base64.split(",", 1)[1]

    # -- Intento 1 (rapido) --------------------------------------------------
    text, error = await _mcp_llamar_vision(imagen_base64, _VIS_TIMEOUT)
    if text:
        return json.dumps({
            "status": "ok",
            "fuente": "llama3.2-vision / A100 CEDIA (MCP)",
            "analisis": text,
        }, ensure_ascii=False)

    if error == "CONNECT_ERROR":
        return json.dumps({
            "status": "error",
            "code": "CONNECT_ERROR",
            "message": (
                "A100 sin conexion (https://ia.frigolab.dev). "
                "Verifica que la VM de CEDIA y Ollama esten activos."
            ),
        }, ensure_ascii=False)

    # Timeout en primer intento -> reintento extendido
    if error == "TIMEOUT":
        log.warning("mcp vision: timeout %.0fs -> reintentando %.0fs", _VIS_TIMEOUT, _VIS_TIMEOUT_EXT)
        text2, error2 = await _mcp_llamar_vision(imagen_base64, _VIS_TIMEOUT_EXT)
        if text2:
            return json.dumps({
                "status": "ok",
                "fuente": "llama3.2-vision / A100 CEDIA (MCP - respuesta lenta)",
                "analisis": text2,
            }, ensure_ascii=False)
        return json.dumps({
            "status": "error",
            "code": error2 or "TIMEOUT_EXT",
            "message": (
                "La A100 sigue ocupada (>60s). Reintenta en 1-2 minutos "
                "o escribe los datos manualmente: lote, producto, temperatura."
            ),
        }, ensure_ascii=False)

    return json.dumps({
        "status": "error",
        "code": error,
        "message": f"Error al analizar imagen ({error}). Intenta de nuevo.",
    }, ensure_ascii=False)


# ===========================================================================
# TOOL 10: obtener_formulario_completo
# ===========================================================================

@mcp.tool()
async def obtener_formulario_completo(form_id: int) -> str:
    """Obtiene el contenido completo (HeaderData + TODAS las filas del BodyData) de un formulario llenado.

    A diferencia de auditar_trazabilidad_lote que filtra filas por lote, este tool
    devuelve TODAS las filas de las tablas. Util para calcular trazabilidad, mermas,
    temperaturas, pesos y extraer cualquier columna del formulario.

    Args:
        form_id: ID del formulario llenado (FilledForms.FormID).

    Returns:
        JSON con {status, code, message, data} - data contiene:
          - form_id, template_codigo, template_nombre, created_at, filled_by
          - header: dict con todos los campos del encabezado
          - tablas: lista con columnas y filas completas (sin filtrar)
          - observaciones
    """
    if not form_id or form_id <= 0:
        return err(CODE_VALIDATION, "Debes proporcionar un form_id valido (entero positivo).")

    def _sync():
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT ff.FormID, ff.HeaderData, ff.BodyData, ff.TemplateSnapshot,
                   ff.CreatedAt, ff.FilledBy, ff.FilledByRole,
                   ff.TipoProducto, ff.Observaciones,
                   t.Codigo AS TemplateCodigo, t.Nombre AS TemplateNombre
            FROM FilledForms ff
            LEFT JOIN Templates t ON ff.TemplateID = t.TemplateID
            WHERE ff.FormID = ?
        """, [form_id])
        row = fetchone(cur)
        conn.close()
        return row

    try:
        row = await run_sql(_sync, op_name=f"mcp.obtener_formulario_completo[{form_id}]")
    except Exception as exc:
        return from_exception(exc, f"obtener_formulario_completo[{form_id}]")

    if not row:
        return err(
            CODE_NOT_FOUND,
            f"No se encontro el formulario con ID {form_id}.",
            {"form_id": form_id},
        )

    header = safe_json(row["HeaderData"]) or {}
    body = safe_json(row["BodyData"]) or []
    snapshot = safe_json(row["TemplateSnapshot"]) or {}
    codigo = row["TemplateCodigo"] or snapshot.get("Codigo") or snapshot.get("codigo", "")
    nombre = row["TemplateNombre"] or snapshot.get("Nombre") or snapshot.get("nombre", "N/A")

    # Extraer TODAS las tablas con TODAS sus filas (sin filtrar por lote)
    tablas = []
    for idx, element in enumerate(body if isinstance(body, list) else []):
        if not isinstance(element, dict) or element.get("type") != "table":
            continue
        filas_raw = element.get("data", [])
        filas = [
            {k: v for k, v in r.items() if v is not None and str(v).strip() != ""}
            for r in filas_raw
            if isinstance(r, dict)
        ]
        filas = [f for f in filas if f]  # filtrar filas completamente vacias
        if not filas:
            continue
        columnas = list(dict.fromkeys(k for r in filas for k in r))
        tablas.append({
            "tabla_idx": idx,
            "total_filas": len(filas),
            "columnas": columnas,
            "filas": filas,
        })

    total_filas = sum(t["total_filas"] for t in tablas)
    return ok(
        f"Formulario {codigo} - {nombre} (ID {form_id}): {len(tablas)} tabla(s), {total_filas} fila(s).",
        {
            "form_id": row["FormID"],
            "template_codigo": codigo,
            "template_nombre": nombre,
            "created_at": str(row["CreatedAt"]),
            "filled_by": row["FilledBy"] or "N/A",
            "filled_by_role": row["FilledByRole"] or "",
            "tipo_producto": row["TipoProducto"] or "",
            "observaciones": row["Observaciones"] or "",
            "header": header,
            "tablas": tablas,
        },
    )


# ---------------------------------------------------------------------------
# Main - arranca el servidor MCP via stdio o SSE
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    transport = "stdio"
    port = 8001

    if "--transport" in sys.argv:
        idx = sys.argv.index("--transport")
        if idx + 1 < len(sys.argv):
            transport = sys.argv[idx + 1]

    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        if idx + 1 < len(sys.argv):
            try:
                port = int(sys.argv[idx + 1])
            except ValueError:
                pass

    log.info("mcp_server: arrancando con transport=%s port=%s", transport, port if transport == "sse" else "N/A")

    if transport == "sse":
        mcp.run(transport="sse", port=port)
    else:
        mcp.run(transport="stdio")
````

## File: migrar_datos.py
````python
import re
import os

# Esta línea detecta automáticamente la carpeta donde está este script
base_path = os.path.dirname(os.path.abspath(__file__))

# Buscamos CUALQUIER archivo que termine en .sql en esa carpeta
archivos_sql = [f for f in os.listdir(base_path) if f.endswith('.sql')]

if not archivos_sql:
    print(f"❌ Error: No encontré ningún archivo .sql en la carpeta: {base_path}")
else:
    # Usamos el primer archivo .sql que encuentre (el tuyo de formularios)
    nombre_archivo = archivos_sql[0]
    ruta_completa = os.path.join(base_path, nombre_archivo)
    
    print(f"✅ Procesando archivo: {nombre_archivo}...")

    # Cambiamos encoding='utf-8' por 'utf-16' para que pueda leer el archivo de SQL Server
    with open(ruta_completa, 'r', encoding='utf-16') as f:
        sql = f.read()

    lineas_procesadas = []

    for linea in sql.split('\n'):
        if linea.startswith('INSERT '):
            linea = re.sub(r'INSERT\s+\[dbo\]\.\[(.*?)\]', r'INSERT INTO "\1"', linea)
            if 'VALUES' in linea:
                partes = linea.split('VALUES')
                partes[0] = re.sub(r'\[(.*?)\]', r'"\1"', partes[0])
                linea = 'VALUES'.join(partes)
            linea = linea.replace(" N'", " '").replace("(N'", "('")
            linea = linea.replace("AS DateTime2)", "AS TIMESTAMP)")
            lineas_procesadas.append(linea)

    with open(os.path.join(base_path, 'datos_postgres_limpios.sql'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lineas_procesadas))

    print(f"🚀 ¡ÉXITO! Se ha creado 'datos_postgres_limpios.sql' con {len(lineas_procesadas)} registros.")
````

## File: multi_agent.py
````python
"""
multi_agent.py - Arquitectura Multi-Agente para FrigoIA

Un Supervisor LLM enruta cada mensaje al agente especializado más adecuado.
Cada sub-agente tiene su propio conjunto de herramientas y prompt optimizado
para su dominio, reduciendo la ventana de contexto y mejorando la precisión.

Arquitectura:
                        ┌─────────────────────────────────────────────────┐
    Mensaje usuario     │                  SUPERVISOR                      │
    ──────────────► ───►│  GPT-4o decide: trazabilidad | formularios |    │
                        │  analisis | directo (sin sub-agente)             │
                        └────────────┬────────────┬───────────────────────┘
                                     │            │
                       ┌─────────────┘            └──────────────┐
                       ▼                                          ▼
           ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
           │  TRAZABILIDAD      │   │  FORMULARIOS       │   │  ANÁLISIS          │
           │  rastrear_lote     │   │  obtener_esquema   │   │  estadisticas      │
           │  analizar_brecha   │   │  guardar_borrador  │   │  analizar_datos    │
           │  listar_lotes      │   │  pedir_dato        │   │  resumen_negocio   │
           └────────────────────┘   └────────────────────┘   │  analizar_foto     │
                                                              └────────────────────┘

Uso desde telegram_bot.py / server.py:
    from multi_agent import run_multi_agent, get_multi_graph

    result = await run_multi_agent(
        chat_id=12345,
        user_message="rastrear el lote ABC-001",
    )
    print(result["response"])

Activación:
    Definir la variable de entorno MULTI_AGENT=true en .env para que
    telegram_bot.py use el grafo multi-agente en lugar del agente único.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Annotated, Any, Literal, TypedDict

from dotenv import load_dotenv
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
    trim_messages,
)
from langchain_core.messages.utils import count_tokens_approximately
from langchain_core.tools import tool
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.types import Command, interrupt

load_dotenv()
log = logging.getLogger(__name__)


# =============================================================================
# Importaciones desde el proyecto existente
# =============================================================================

from agent import (
    _build_llm,
    _get_bound_llm,
    _llm_ainvoke_with_retry,
    _now_str,
    _truncate_tool_messages,
    _context_trimmer,
    _GRAPH_TOOLS,
    pedir_dato_al_operario,
    MAX_CONTEXT_TOKENS,
    mcp_is_active,
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
)
from state_backends import get_checkpointer


# =============================================================================
# Estado compartido
# =============================================================================

class MultiAgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    active_agent: str   # "supervisor" | "trazabilidad" | "formularios" | "analisis"
    handoff_count: int  # evita loops infinitos entre agentes


# Máximo de handoffs por turno (protección anti-loop)
_MAX_HANDOFFS = 3


# =============================================================================
# Herramientas por sub-agente
# =============================================================================

TOOLS_TRAZABILIDAD = [
    rastrear_lote_tool,
    analizar_brecha_lote_tool,
    listar_lotes_tool,
]

TOOLS_FORMULARIOS = [
    obtener_esquema_formulario_tool,
    guardar_borrador_tool,
    pedir_dato_al_operario,
]

TOOLS_ANALISIS = [
    estadisticas_formularios_tool,
    analizar_datos_formulario_tool,
    resumen_negocio_tool,
    analizar_foto_etiqueta_tool,
]


# =============================================================================
# System prompts por sub-agente
# =============================================================================

_BASE_RULES = """
REGLA CRITICA: Nunca respondas de memoria o inventes datos. SIEMPRE usa las herramientas.
Si no tienes herramienta para responder algo, di que no puedes ayudar con eso en este contexto.
Responde siempre en español, breve y profesional. Sin markdown, sin tablas."""

SUPERVISOR_SYSTEM = """Eres el coordinador del sistema FrigoIA de Frigolab San Mateo.
Tu única tarea es decidir qué agente especializado debe manejar la solicitud del operario.

Agentes disponibles:
  - trazabilidad: para preguntas sobre lotes, rastreo, etapas, brechas de QC.
  - formularios:  para llenar, guardar o consultar esquemas de formularios de QC.
  - analisis:     para estadísticas, KPIs, reportes, fotos de etiquetas, resumen del día.
  - directo:      para saludos, preguntas fuera de dominio, o respuestas simples sin tools.

Responde ÚNICAMENTE con una de estas palabras: trazabilidad | formularios | analisis | directo
No expliques tu razonamiento. Solo devuelve la palabra."""

TRAZABILIDAD_SYSTEM = f"""Eres el agente de Trazabilidad de FrigoIA en Frigolab San Mateo.
Especializas en el seguimiento de lotes de producción.

Flujo de producción (orden obligatorio):
1. Fileteo (FOR-PD-04)
2. Liberación de Túnel (FOR-PD-05)
3. Corte y Empaque (FOR-PD-06)
4. Control de Sellos (FOR-CC-10)
Un lote COMPLETO tiene registro en las 4 etapas. Si falta alguna, hay una brecha de QC.

Herramientas disponibles:
- rastrear_lote_tool: historia cronológica completa de un lote.
- analizar_brecha_lote_tool: qué etapas le faltan a un lote.
- listar_lotes_tool: lista de lotes por rango de fechas.

Temperatura: Congelados ≤ -18°C. Frío ≤ 4°C. Si hay valores fuera, inicia con ALERTA.

Fecha y hora: {{fecha}}
{_BASE_RULES}"""

FORMULARIOS_SYSTEM = f"""Eres el agente de Formularios de FrigoIA en Frigolab San Mateo.
Especializas en el ingreso de datos QC por voz y gestión de borradores.

Flujo de llenado:
1. Usa obtener_esquema_formulario_tool para conocer los campos del formulario.
2. Si faltan datos obligatorios, usa pedir_dato_al_operario para pedirlos (NO inventes).
3. Con todos los datos, usa guardar_borrador_tool.

Herramientas disponibles:
- obtener_esquema_formulario_tool: esquema JSON con campos y reglas del formulario.
- guardar_borrador_tool: guarda el borrador en el sistema con los datos del operario.
- pedir_dato_al_operario: pausa el flujo y pide un dato específico al operario.

Fecha y hora: {{fecha}}
{_BASE_RULES}"""

ANALISIS_SYSTEM = f"""Eres el agente de Análisis de FrigoIA en Frigolab San Mateo.
Especializas en estadísticas, KPIs, reportes de producción y análisis de imágenes.

Herramientas disponibles:
- resumen_negocio_tool: dashboard diario/semanal con KPIs de producción.
- estadisticas_formularios_tool: porcentajes de cumplimiento por formulario.
- analizar_datos_formulario_tool: análisis de valores dentro de un tipo de formulario.
- analizar_foto_etiqueta_tool: visión computacional en fotos de etiquetas/productos.

Fecha y hora: {{fecha}}
{_BASE_RULES}"""


# =============================================================================
# Nodo Supervisor — decide el enrutamiento
# =============================================================================

async def supervisor_node(state: MultiAgentState) -> Command:
    """Analiza el último mensaje y decide qué sub-agente debe responder."""
    handoff_count = state.get("handoff_count", 0)
    if handoff_count >= _MAX_HANDOFFS:
        log.warning("multi_agent: máximo de handoffs (%d) alcanzado, respondiendo directamente.", _MAX_HANDOFFS)
        return Command(goto="direct_agent", update={"active_agent": "directo", "handoff_count": handoff_count + 1})

    # Usar el último mensaje humano para el routing
    last_human = next(
        (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        None,
    )
    if not last_human:
        return Command(goto=END)

    supervisor_llm = _build_llm(temperature=0.0)
    try:
        result = await supervisor_llm.ainvoke([
            SystemMessage(content=SUPERVISOR_SYSTEM),
            HumanMessage(content=last_human.content),
        ])
        decision = result.content.strip().lower()
        log.info("multi_agent supervisor: '%s' → %s", str(last_human.content)[:60], decision)
    except Exception as exc:
        log.error("multi_agent: supervisor LLM falló: %s — usando trazabilidad como fallback", exc)
        decision = "trazabilidad"

    route_map = {
        "trazabilidad": "trazabilidad_agent",
        "formularios":  "formularios_agent",
        "analisis":     "analisis_agent",
        "directo":      "direct_agent",
    }
    next_node = route_map.get(decision, "trazabilidad_agent")
    return Command(
        goto=next_node,
        update={"active_agent": decision, "handoff_count": handoff_count + 1},
    )


# =============================================================================
# Fábrica genérica de nodos de sub-agente
# =============================================================================

def _make_agent_node(agent_tools: list, system_template: str, node_name: str):
    """Crea un nodo de sub-agente con tools y system prompt específicos.

    Reutiliza los mismos patrones del agente principal (trimming, retry, cache).
    """
    async def _agent_node(state: MultiAgentState) -> dict:
        system_content = system_template.replace("{fecha}", _now_str())
        system = SystemMessage(content=system_content)

        try:
            trimmed = _context_trimmer.invoke(state["messages"])
        except Exception:
            trimmed = state["messages"][-10:]

        trimmed = _truncate_tool_messages(trimmed)

        try:
            llm = await _get_bound_llm(agent_tools, temperature=0.1)
            response = await _llm_ainvoke_with_retry(llm, [system] + trimmed)
        except Exception as exc:
            log.error("multi_agent %s: LLM falló: %s", node_name, exc, exc_info=True)
            response = AIMessage(
                content="Tuve un problema momentáneo. Por favor intenta de nuevo en unos segundos."
            )

        return {"messages": [response]}

    _agent_node.__name__ = f"{node_name}_node"
    return _agent_node


def _make_tools_node(agent_tools: list, node_name: str):
    """Crea un nodo ejecutor de tools para un sub-agente."""
    tool_map = {t.name: t for t in agent_tools}

    async def _tools_node(state: MultiAgentState) -> dict:
        last = state["messages"][-1]
        tool_calls = getattr(last, "tool_calls", []) or []
        results: list[BaseMessage] = []

        for tc in tool_calls:
            if tc["name"] == "pedir_dato_al_operario":
                continue
            fn = tool_map.get(tc["name"])
            if fn is None:
                from tool_result import err as _err
                content = _err(
                    "TOOL_NOT_FOUND",
                    f"La herramienta '{tc['name']}' no existe en este agente ({node_name}).",
                )
            else:
                try:
                    content = await fn.ainvoke(tc["args"])
                except Exception as exc:
                    from tool_result import err as _err
                    log.error("multi_agent %s: tool %s falló: %s", node_name, tc["name"], exc)
                    content = _err("TOOL_CRASH", f"La herramienta {tc['name']} falló: {exc}")
            results.append(ToolMessage(content=str(content), tool_call_id=tc["id"]))

        return {"messages": results}

    _tools_node.__name__ = f"{node_name}_tools_node"
    return _tools_node


def _make_ask_human_node():
    """Nodo de interrupción para el agente de formularios (pedir datos faltantes)."""
    def _ask_human_node(state: MultiAgentState) -> dict:
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
        texto = "" if raw is None else str(raw).strip()[:500]

        if not texto:
            from tool_result import empty as _empty
            content = _empty(
                f"El operario no proporcionó '{campo}'. Reformula la pregunta.",
                {"campo": campo},
            )
        else:
            from tool_result import ok as _ok
            content = _ok(
                f"El operario respondió sobre '{campo}': {texto}",
                {"campo": campo, "valor": texto},
                code="HUMAN_ANSWER",
            )
        return {"messages": [ToolMessage(content=content, tool_call_id=call_id)]}

    return _ask_human_node


# =============================================================================
# Routers de nodos de sub-agente
# =============================================================================

def _make_router(tools_node_name: str, ask_human_node_name: str | None = None):
    """Router genérico: decide si ir a tools, ask_human o END."""
    def _router(state: MultiAgentState) -> str:
        last = state["messages"][-1]
        if not isinstance(last, AIMessage):
            return END
        tool_calls = getattr(last, "tool_calls", []) or []
        if not tool_calls:
            return END
        if ask_human_node_name:
            for tc in tool_calls:
                if tc["name"] == "pedir_dato_al_operario":
                    return ask_human_node_name
        return tools_node_name

    return _router


# =============================================================================
# Agente directo (respuestas sin tools — saludos, fuera de dominio)
# =============================================================================

DIRECT_SYSTEM = f"""Eres FrigoIA, el asistente de control de calidad de Frigolab San Mateo.
Responde directamente sin usar herramientas. Si el operario hace preguntas de negocio
(lotes, formularios, estadísticas), indícale que puede preguntarte directamente y lo ayudarás.
Fecha y hora: {{fecha}}
{_BASE_RULES}"""

async def direct_agent_node(state: MultiAgentState) -> dict:
    """Responde directamente sin tools (saludos, fuera de dominio)."""
    system = SystemMessage(content=DIRECT_SYSTEM.replace("{fecha}", _now_str()))
    try:
        trimmed = state["messages"][-6:]  # contexto mínimo para respuestas directas
        llm = _build_llm(temperature=0.2)
        response = await llm.ainvoke([system] + trimmed)
    except Exception as exc:
        log.error("multi_agent direct_agent: LLM falló: %s", exc)
        response = AIMessage(content="Hola, soy FrigoIA. ¿En qué puedo ayudarte?")
    return {"messages": [response]}


# =============================================================================
# Construcción del grafo multi-agente
# =============================================================================

_multi_graph = None


def get_multi_graph():
    """Construye y cachea el grafo multi-agente.

    Topología del grafo:
        supervisor → trazabilidad_agent → trazabilidad_tools → trazabilidad_agent → END
                   → formularios_agent  → formularios_tools  → ...
                   → formularios_ask_human → formularios_agent → ...
                   → analisis_agent     → analisis_tools     → analisis_agent → END
                   → direct_agent       → END
    """
    global _multi_graph
    if _multi_graph is not None:
        return _multi_graph

    # Crear nodos de sub-agentes
    traz_agent = _make_agent_node(TOOLS_TRAZABILIDAD, TRAZABILIDAD_SYSTEM, "trazabilidad")
    traz_tools = _make_tools_node(TOOLS_TRAZABILIDAD, "trazabilidad")

    form_agent = _make_agent_node(TOOLS_FORMULARIOS, FORMULARIOS_SYSTEM, "formularios")
    form_tools = _make_tools_node(TOOLS_FORMULARIOS, "formularios")
    form_ask = _make_ask_human_node()

    anal_agent = _make_agent_node(TOOLS_ANALISIS, ANALISIS_SYSTEM, "analisis")
    anal_tools = _make_tools_node(TOOLS_ANALISIS, "analisis")

    # Routers
    traz_router = _make_router("trazabilidad_tools")
    form_router = _make_router("formularios_tools", "formularios_ask_human")
    anal_router = _make_router("analisis_tools")

    builder = StateGraph(MultiAgentState)

    # Nodo supervisor
    builder.add_node("supervisor", supervisor_node)

    # Sub-agente Trazabilidad
    builder.add_node("trazabilidad_agent", traz_agent)
    builder.add_node("trazabilidad_tools", traz_tools)

    # Sub-agente Formularios
    builder.add_node("formularios_agent", form_agent)
    builder.add_node("formularios_tools", form_tools)
    builder.add_node("formularios_ask_human", form_ask)

    # Sub-agente Análisis
    builder.add_node("analisis_agent", anal_agent)
    builder.add_node("analisis_tools", anal_tools)

    # Agente directo
    builder.add_node("direct_agent", direct_agent_node)

    # Entry point
    builder.set_entry_point("supervisor")

    # Edges: Trazabilidad
    builder.add_conditional_edges(
        "trazabilidad_agent", traz_router,
        {"trazabilidad_tools": "trazabilidad_tools", END: END},
    )
    builder.add_edge("trazabilidad_tools", "trazabilidad_agent")

    # Edges: Formularios
    builder.add_conditional_edges(
        "formularios_agent", form_router,
        {
            "formularios_tools": "formularios_tools",
            "formularios_ask_human": "formularios_ask_human",
            END: END,
        },
    )
    builder.add_edge("formularios_tools", "formularios_agent")
    builder.add_edge("formularios_ask_human", "formularios_agent")

    # Edges: Análisis
    builder.add_conditional_edges(
        "analisis_agent", anal_router,
        {"analisis_tools": "analisis_tools", END: END},
    )
    builder.add_edge("analisis_tools", "analisis_agent")

    # Edges: Directo
    builder.add_edge("direct_agent", END)

    _multi_graph = builder.compile(checkpointer=get_checkpointer())
    log.info("multi_agent: grafo compilado (trazabilidad=%d tools, formularios=%d tools, analisis=%d tools)",
             len(TOOLS_TRAZABILIDAD), len(TOOLS_FORMULARIOS), len(TOOLS_ANALISIS))
    return _multi_graph


# =============================================================================
# Punto de entrada público
# =============================================================================

def _extract_final_response(messages: list[BaseMessage]) -> str:
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and msg.content and not getattr(msg, "tool_calls", None):
            return str(msg.content)
    return ""


def _extract_interrupt_question(state) -> str:
    for task in state.tasks:
        for intr in getattr(task, "interrupts", []):
            if intr.value:
                return str(intr.value)
    return "Necesito más información para continuar."


async def run_multi_agent(
    chat_id: int,
    user_message: str,
    operator_name: str = "Operador",
    is_resume: bool = False,
    resume_value: str | None = None,
) -> dict[str, Any]:
    """Punto de entrada principal del multi-agente.

    Misma interfaz que `run_agent_for_telegram` para fácil intercambio.

    Returns:
        dict con: response (str), interrupted (bool), question (str), active_agent (str)
    """
    graph = get_multi_graph()
    config = {"configurable": {"thread_id": f"multi_{chat_id}"}}

    try:
        if is_resume:
            safe_resume = "" if resume_value is None else str(resume_value)
            result = await graph.ainvoke(Command(resume=safe_resume), config=config)
        else:
            safe_name = re.sub(r"[^\w]", "_", operator_name or "Operador")[:64]
            safe_msg = (user_message or "").strip() or "(mensaje vacío)"
            result = await graph.ainvoke(
                {
                    "messages": [HumanMessage(content=safe_msg, name=safe_name)],
                    "active_agent": "supervisor",
                    "handoff_count": 0,
                },
                config=config,
            )

        state = await graph.aget_state(config)
        active = result.get("active_agent", "supervisor") if isinstance(result, dict) else "supervisor"

        if state.next:
            return {
                "response": "",
                "interrupted": True,
                "question": _extract_interrupt_question(state),
                "active_agent": active,
            }

        messages = result.get("messages", []) if isinstance(result, dict) else []
        return {
            "response": _extract_final_response(messages),
            "interrupted": False,
            "question": "",
            "active_agent": active,
        }

    except Exception as exc:
        log.error("multi_agent: error en chat_id=%s: %s", chat_id, exc, exc_info=True)
        return {
            "response": "Lo siento, ocurrió un error. Por favor inténtalo de nuevo.",
            "interrupted": False,
            "question": "",
            "active_agent": "error",
        }


# =============================================================================
# Integración con telegram_bot.py
# =============================================================================

def is_multi_agent_enabled() -> bool:
    """Devuelve True si MULTI_AGENT=true está en el entorno."""
    return os.getenv("MULTI_AGENT", "false").strip().lower() in ("true", "1", "yes")


async def run_agent_auto(
    chat_id: int,
    user_message: str,
    operator_name: str = "Operador",
    is_resume: bool = False,
    resume_value: str | None = None,
) -> dict[str, Any]:
    """Usa multi-agente si MULTI_AGENT=true, de lo contrario usa el agente único.

    Reemplaza la llamada a `run_agent_for_telegram` en telegram_bot.py:

        from multi_agent import run_agent_auto
        result = await run_agent_auto(chat_id, message, operator_name)
    """
    if is_multi_agent_enabled():
        log.debug("multi_agent: modo multi activado (chat_id=%s)", chat_id)
        return await run_multi_agent(
            chat_id=chat_id,
            user_message=user_message,
            operator_name=operator_name,
            is_resume=is_resume,
            resume_value=resume_value,
        )

    from agent import run_agent_for_telegram
    return await run_agent_for_telegram(
        chat_id=chat_id,
        user_message=user_message,
        operator_name=operator_name,
        is_resume=is_resume,
        resume_value=resume_value,
    )
````

## File: narrator.py
````python
"""
narrator.py - Genera narrativas de trazabilidad por Lote

Fase 2 del pipeline: Creacion del "Super-Documento"
- Toma los eventos agrupados por lote desde el extractor
- Los ordena cronologicamente
- Genera un string narrativo en lenguaje natural
- Cada narrativa cuenta la "historia de vida" completa del lote
"""
from datetime import datetime
from config import TEMPLATE_PROCESS_MAP


def _format_datetime(dt) -> str:
    """Formatea datetime a string legible."""
    if isinstance(dt, datetime):
        return dt.strftime("%d/%m/%Y a las %H:%M")
    if isinstance(dt, str):
        try:
            parsed = datetime.fromisoformat(dt.replace("Z", "+00:00"))
            return parsed.strftime("%d/%m/%Y a las %H:%M")
        except ValueError:
            return dt
    return str(dt)


def _format_date_only(dt) -> str:
    """Formatea solo la fecha."""
    if isinstance(dt, datetime):
        return dt.strftime("%d/%m/%Y")
    if isinstance(dt, str):
        try:
            parsed = datetime.fromisoformat(dt.replace("Z", "+00:00"))
            return parsed.strftime("%d/%m/%Y")
        except ValueError:
            return dt
    return str(dt)


def _get_process_name(codigo: str, nombre: str) -> str:
    """Obtiene nombre legible del proceso."""
    if codigo in TEMPLATE_PROCESS_MAP:
        return TEMPLATE_PROCESS_MAP[codigo]
    if nombre:
        return nombre
    return f"Proceso {codigo}"


def _summarize_header(header_data: dict) -> str:
    """Resume los campos del header en una frase."""
    parts = []
    for key, value in header_data.items():
        if value and str(value).strip():
            val = str(value).strip()
            low_key = key.lower()
            # Filtrar campos internos o vacios
            if any(skip in low_key for skip in ["templateid", "version"]):
                continue
            parts.append(f"{key}: {val}")
    return ", ".join(parts) if parts else ""


def _summarize_body_rows(body_summary: list[dict]) -> str:
    """Resume las filas del body en texto."""
    if not body_summary:
        return ""
    lines = []
    for i, row in enumerate(body_summary):
        row_parts = []
        for key, value in row.items():
            if value and str(value).strip():
                row_parts.append(f"{key}={value}")
        if row_parts:
            lines.append(f"  - {', '.join(row_parts)}")
    return "\n".join(lines)


def build_narrative(lote_num: str, events: list[dict]) -> str:
    """
    Construye una narrativa completa de trazabilidad para un lote.

    Args:
        lote_num: Numero del lote (ej. "260302")
        events: Lista de eventos del extractor, ya asociados a este lote

    Returns:
        String narrativo consolidado (el "super-chunk")
    """
    # Ordenar cronologicamente
    sorted_events = sorted(events, key=lambda e: (
        e["created_at"] if isinstance(e["created_at"], datetime)
        else datetime.min
    ))

    # Extraer metadata general
    especies = set()
    productos = set()
    firmantes = set()
    procesos_involucrados = []

    for ev in sorted_events:
        header = ev.get("header_data", {})
        for key, val in header.items():
            low = key.lower()
            if "especie" in low and val:
                especies.add(str(val).strip())
            if "produc" in low and val:
                productos.add(str(val).strip())

        if ev.get("filled_by"):
            firmantes.add(ev["filled_by"])

        codigo = ev.get("template_codigo", "")
        nombre = ev.get("template_nombre", "")
        proceso = _get_process_name(codigo, nombre)
        if proceso not in procesos_involucrados:
            procesos_involucrados.append(proceso)

        # Buscar especie/producto en body
        for row in ev.get("body_summary", []):
            for key, val in row.items():
                low = key.lower()
                if "especie" in low and val:
                    especies.add(str(val).strip())
                if "produc" in low and val:
                    productos.add(str(val).strip())

    # -----------------------------------------------------------------------
    # Construir narrativa
    # -----------------------------------------------------------------------
    sections = []

    # Encabezado
    first_date = _format_date_only(sorted_events[0]["created_at"]) if sorted_events else "Fecha desconocida"
    header_line = f"TRAZABILIDAD DEL LOTE {lote_num}"
    sections.append(header_line)
    sections.append(f"Fecha de inicio: {first_date}")

    if especies:
        sections.append(f"Especie(s): {', '.join(especies)}")
    if productos:
        sections.append(f"Producto(s): {', '.join(productos)}")
    if procesos_involucrados:
        sections.append(f"Procesos involucrados: {' -> '.join(procesos_involucrados)}")
    sections.append(f"Total de registros: {len(sorted_events)}")
    sections.append("")

    # Detalle por evento
    for i, ev in enumerate(sorted_events, 1):
        codigo = ev.get("template_codigo", "")
        nombre = ev.get("template_nombre", "")
        proceso = _get_process_name(codigo, nombre)
        fecha = _format_datetime(ev["created_at"])
        filled_by = ev.get("filled_by", "N/A")
        filled_role = ev.get("filled_by_role", "")

        sections.append(f"--- Paso {i}: {proceso} ({codigo}) ---")
        sections.append(f"Registrado el {fecha} por {filled_by} ({filled_role}).")

        # Header info
        header_summary = _summarize_header(ev.get("header_data", {}))
        if header_summary:
            sections.append(f"Datos del encabezado: {header_summary}")

        # Body data
        body_text = _summarize_body_rows(ev.get("body_summary", []))
        if body_text:
            sections.append(f"Datos registrados:")
            sections.append(body_text)

        sections.append("")

    # Responsables
    if firmantes:
        sections.append(f"Responsables involucrados: {', '.join(firmantes)}")

    # Generar texto final
    narrative = "\n".join(sections)

    return narrative


def build_all_narratives(historial_lotes: dict) -> dict[str, str]:
    """
    Genera narrativas para todos los lotes.

    Args:
        historial_lotes: Diccionario {lote_num: [events]}

    Returns:
        {lote_num: narrative_string}
    """
    narratives = {}
    for lote_num, events in historial_lotes.items():
        try:
            narrative = build_narrative(lote_num, events)
            narratives[lote_num] = narrative
            print(f"[NARRATOR] Lote {lote_num}: {len(events)} eventos -> {len(narrative)} chars")
        except Exception as e:
            print(f"[NARRATOR] Error procesando lote {lote_num}: {e}")
            continue
    return narratives
````

## File: observability.py
````python
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
````

## File: pipeline.py
````python
"""
pipeline.py - Script principal del pipeline ETL de trazabilidad

Ejecuta el flujo completo:
1. Extrae formularios de SQL Server o API
2. Agrupa por lote
3. Genera narrativas
4. Ingesta en ChromaDB

Uso:
    python pipeline.py --source sql
    python pipeline.py --source api
"""
import argparse
import asyncio
import sys
import time

from extractor import extract_from_sql, extract_from_api
from narrator import build_all_narratives
from vectorstore import ingest_narratives, get_stats


def run_pipeline(source: str = "api"):
    """Ejecuta el pipeline completo."""
    start = time.time()

    print("=" * 60)
    print("  FRIGOLAB AI - Pipeline de Trazabilidad")
    print("=" * 60)

    # Paso 1: Extraccion
    print("\n[PASO 1] Extrayendo formularios...")
    if source == "sql":
        historial_lotes = extract_from_sql()
    elif source == "api":
        historial_lotes = asyncio.run(extract_from_api())
    else:
        print(f"Fuente no reconocida: {source}. Usa 'sql' o 'api'.")
        sys.exit(1)

    if not historial_lotes:
        print("[PIPELINE] No se encontraron lotes. Verifica los datos.")
        sys.exit(0)

    # Paso 2: Narrativas
    print("\n[PASO 2] Generando narrativas de trazabilidad...")
    narratives = build_all_narratives(historial_lotes)

    # Mostrar ejemplo de narrativa
    if narratives:
        ejemplo_lote = next(iter(narratives))
        print(f"\n--- Ejemplo: Lote {ejemplo_lote} ---")
        print(narratives[ejemplo_lote][:500])
        print("...")

    # Paso 3: Ingestion en ChromaDB
    print("\n[PASO 3] Ingresando narrativas en ChromaDB...")
    count = ingest_narratives(narratives)

    # Stats
    stats = get_stats()
    elapsed = time.time() - start

    print("\n" + "=" * 60)
    print(f"  Pipeline completado en {elapsed:.1f} segundos")
    print(f"  Lotes procesados: {len(narratives)}")
    print(f"  Documentos en ChromaDB: {stats['total_documents']}")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pipeline de Trazabilidad Frigolab")
    parser.add_argument(
        "--source",
        choices=["sql", "api"],
        default="api",
        help="Fuente de datos: 'sql' para pyodbc directo, 'api' para REST API (default: api)",
    )
    args = parser.parse_args()
    run_pipeline(args.source)
````

## File: query_lotes.py
````python
import pyodbc, os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
from config import get_connection_string

conn = pyodbc.connect(get_connection_string())
cur = conn.cursor()

# Extraer todos los lotes no vacíos de FilledForms
cur.execute("SELECT FormID, TemplateID, CreatedAt, HeaderData, BodyData FROM FilledForms ORDER BY CreatedAt DESC")
rows = cur.fetchall()

lotes_encontrados = []

for form_id, template_id, created_at, header_raw, body_raw in rows:
    # Buscar lote en HeaderData
    try:
        header = json.loads(header_raw or "{}")
        for k, v in header.items():
            if "lote" in k.lower() and v:
                lotes_encontrados.append({
                    "FormID": form_id,
                    "Fecha": str(created_at)[:10],
                    "Fuente": f"Header[{k}]",
                    "Lote": v,
                })
    except Exception:
        pass

    # Buscar lote en BodyData (tablas anidadas)
    try:
        body = json.loads(body_raw or "[]")
        for elemento in body:
            if elemento.get("type") == "table":
                for fila in elemento.get("data", []):
                    for k, v in fila.items():
                        if "lote" in k.lower() and v:
                            lotes_encontrados.append({
                                "FormID": form_id,
                                "Fecha": str(created_at)[:10],
                                "Fuente": f"Body[{k}]",
                                "Lote": v,
                            })
    except Exception:
        pass

# Deduplicar por valor de lote
vistos = set()
unicos = []
for l in lotes_encontrados:
    key = l["Lote"]
    if key not in vistos:
        vistos.add(key)
        unicos.append(l)

# También ver SourceForms si tiene filas
cur.execute("SELECT COUNT(*) FROM SourceForms")
n = cur.fetchone()[0]
print(f"SourceForms: {n} filas")

conn.close()

print(f"\nTotal lotes únicos encontrados: {len(unicos)}")
print(f"{'FormID':>6}  {'Fecha':>10}  {'Campo':<25}  Lote")
print("-" * 70)
for l in sorted(unicos, key=lambda x: x["Fecha"], reverse=True):
    print(f"{l['FormID']:>6}  {l['Fecha']:>10}  {l['Fuente']:<25}  {l['Lote']}")


conn = pyodbc.connect(cs)
cur = conn.cursor()

# 1) Ver todas las tablas
cur.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")
tablas = [r[0] for r in cur.fetchall()]
print("TABLAS:", tablas)

# 2) Buscar tablas que contengan "lote" en el nombre
lote_tablas = [t for t in tablas if "lote" in t.lower()]
print("TABLAS CON 'lote':", lote_tablas)

# 3) Si hay alguna, mostrar los datos
for tabla in lote_tablas:
    print(f"\n=== {tabla} ===")
    try:
        cur.execute(f"SELECT TOP 50 * FROM [{tabla}]")
        cols = [d[0] for d in cur.description]
        print("Columnas:", cols)
        for row in cur.fetchall():
            print(dict(zip(cols, row)))
    except Exception as e:
        print("Error:", e)

conn.close()
````

## File: requirements.txt
````
# Web framework
fastapi==0.115.6
uvicorn[standard]==0.34.0
python-multipart==0.0.18
pydantic==2.10.3

# Database — Azure PostgreSQL (asyncpg: driver async nativo)
asyncpg>=0.30.0

# HTTP client (guardar borradores via API)
httpx==0.28.1

# Retry con backoff exponencial sobre errores transitorios de DB/HTTP (sql_tools.py)
tenacity>=8.2.0

# Config
python-dotenv==1.0.1

# Voice — Azure OpenAI Whisper STT (REST API, sin SDK adicional ni ffmpeg)
# El cliente openai ya esta incluido como dependencia de langchain-openai
# ELIMINADO: azure-cognitiveservices-speech (reemplazado por Azure OpenAI Whisper API)
# ELIMINADO: openai-whisper, torch, numpy (~3.5 GB — ya no requeridos)

# LangChain + Agente con Tool Calling (interrupt requiere >=0.2.35)
langchain-core>=0.3.0
langchain-openai>=0.2.0
langgraph>=0.2.35

# Telegram Bot (python-telegram-bot asyncio — para telegram_bot.py)
python-telegram-bot[ext]>=21.0

# Telegram Bot sincrono (pyTelegramBotAPI / telebot — para main.py)
pyTelegramBotAPI>=4.22.0

# OpenAI SDK (Azure OpenAI Whisper STT en main.py)
openai>=1.30.0

# MCP — Model Context Protocol Server SDK
mcp[cli]>=1.0.0

# LangChain MCP Adapters — convierte herramientas MCP en tools LangChain nativos
# Permite usar MultiServerMCPClient con SSE o stdio sin glue-code manual.
langchain-mcp-adapters>=0.1.0

# SQL Server driver (sql_tools.py y mcp_server.py via db_utils.py)
pyodbc>=5.1.0

# Error monitoring (observability.py) — opcional, solo se activa si SENTRY_DSN
sentry-sdk>=1.40.0

# Persistencia opcional del estado LangGraph en Postgres (state_backends.py)
# Solo necesario si CHECKPOINTER_BACKEND=postgres. Comenta en desarrollo local.
langgraph-checkpoint-postgres>=2.0.0

# ELIMINADO: langchain-ollama (reemplazado por langchain-openai + Azure)

# ELIMINADO: chromadb==0.5.23       (causaba alucinaciones — reemplazado por SQL directo)
# ELIMINADO: sentence-transformers==3.3.1 (sin RAG, sin embeddings)
# ELIMINADO: sounddevice==0.5.1     (sin grabacion local, se usa WebM del browser)
# ELIMINADO: scipy==1.14.1          (dependencia de sounddevice, ya no necesaria)
````

## File: server.py
````python
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

# CORS — solo origenes conocidos del frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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


class AgentResponse(BaseModel):
    message: str
    response: str
    tools_used: list[str]
    tool_results: list[str]


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

    El agente decide automaticamente que herramienta usar:
      - buscar_trazabilidad_lote: si el usuario pregunta por un lote
      - obtener_esquema_formulario: si el usuario quiere saber campos de un formulario
      - guardar_borrador_formulario: si el usuario quiere registrar datos por voz
    """
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
````

## File: sql_tools.py
````python
"""
sql_tools.py - Herramientas SQL para el Agente FrigoVoice (SQL Server / pyodbc)

v12 - MCP-first + TTL cache para herramientas de solo lectura:
  - Fallback directo cuando MCP no está disponible.
  - Cache en memoria (TTL=300s) para las 3 herramientas más costosas:
    listar_lotes_tool, estadisticas_formularios_tool, resumen_negocio_tool.
    Reduce carga SQL y latencia en consultas repetitivas de turno.

HERRAMIENTAS (importadas desde agent.py):
  Tool 1 -> rastrear_lote_tool(numero_lote)
  Tool 2 -> obtener_esquema_formulario_tool(nombre_formulario)
  Tool 3 -> guardar_borrador_tool(template_id, json_datos, usuario)
  Tool 4 -> estadisticas_formularios_tool(fecha_desde, fecha_hasta)
  Tool 5 -> analizar_datos_formulario_tool(template_codigo, ...)
  Tool 6 -> listar_lotes_tool(fecha_desde, fecha_hasta)
  Tool 7 -> analizar_brecha_lote_tool(numero_lote)
  Tool 8 -> analizar_foto_etiqueta_tool(imagen_base64)
  Tool 9 -> resumen_negocio_tool(fecha_desde, fecha_hasta)
"""
from __future__ import annotations

import base64
import json
import logging
import os
import time
from datetime import datetime

import httpx

from langchain_core.tools import tool

from config import API_BASE_URL
from db_utils import (
    extract_rows_with_lote as _extract_rows_with_lote,
    fetchall as _fetchall,
    fetchone as _fetchone,
    find_lote_in_json as _find_lote_in_json,
    get_connection as _get_conn,
    run_http_post as _run_http_post,
    run_sql as _run_sql,
    safe_json as _safe_json,
    SQL_MAX_RETRIES,
    SQL_TIMEOUT_SECONDS,
)
from tool_result import (
    CODE_NOT_FOUND,
    CODE_VALIDATION,
    empty,
    err,
    from_exception,
    ok,
)

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# TTL Cache — para herramientas de solo-lectura costosas
#
# Por qué: resumen_negocio_tool, listar_lotes_tool y estadisticas_formularios_tool
# hacen JOINs y GROUP BY sobre FilledForms (tabla grande). Si varios operarios
# preguntan "cómo vamos" en el mismo turno, la BD recibe la misma query 3-5 veces
# con idéntico resultado. TTL=300s (5 min) es seguro para datos de turno.
#
# La clave de caché incluye los parámetros fecha_desde/fecha_hasta para
# que consultas con filtros distintos no se mezclen.
# ---------------------------------------------------------------------------
_CACHE_TTL_SECONDS: int = int(os.getenv("TOOL_CACHE_TTL", "300"))

_tool_cache: dict[str, tuple[float, str]] = {}  # key → (timestamp, result)


def _cache_get(key: str) -> str | None:
    """Devuelve el resultado cacheado si no expiró, None si falta o expiró."""
    entry = _tool_cache.get(key)
    if entry and (time.monotonic() - entry[0]) < _CACHE_TTL_SECONDS:
        log.debug("cache HIT: %s", key)
        return entry[1]
    return None


def _cache_set(key: str, value: str) -> None:
    _tool_cache[key] = (time.monotonic(), value)


def invalidate_tool_cache() -> int:
    """Limpia todo el caché. Útil después de guardar un borrador. Retorna entradas eliminadas."""
    n = len(_tool_cache)
    _tool_cache.clear()
    log.info("tool cache invalidado (%d entradas eliminadas)", n)
    return n


async def _listar_templates_data() -> tuple[list[dict], str]:
    """Helper interno: devuelve (filas, narrativa) de todos los templates activos."""
    def _sync():
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT TemplateID, Codigo, Nombre, Proceso, QuienLoLlena
            FROM Templates
            WHERE IsObsolete = 0 AND IsDraft = 0
            ORDER BY Codigo
        """)
        rows = _fetchall(cur)
        conn.close()
        return rows

    rows = await _run_sql(_sync, op_name="listar_templates")
    if not rows:
        return [], "No se encontraron templates activos en el sistema."

    lines = ["Templates disponibles:"]
    for r in rows:
        lines.append(
            f"  - ID:{r['TemplateID']} | {r['Codigo']} | {r['Nombre']}"
            f" | Area: {r['Proceso']} | Llena: {r['QuienLoLlena']}"
        )
    return rows, "\n".join(lines)


# ---------------------------------------------------------------------------
# TOOL 1: rastrear_lote_tool
# ---------------------------------------------------------------------------

async def _rastrear_lote(numero_lote: str) -> str:
    numero_lote = numero_lote.strip()
    if not numero_lote:
        return err(CODE_VALIDATION, "Debes proporcionar un numero de lote.")

    pattern = f"%{numero_lote}%"

    def _sync_filled():
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                ff.FormID, ff.TemplateID, ff.HeaderData, ff.BodyData,
                ff.TemplateSnapshot, ff.CreatedAt, ff.FilledBy,
                ff.FilledByRole, ff.TipoProducto, ff.Observaciones
            FROM FilledForms ff
            WHERE LOWER(ff.HeaderData) LIKE LOWER(?)
               OR LOWER(ff.BodyData)   LIKE LOWER(?)
            ORDER BY ff.CreatedAt ASC
        """, [pattern, pattern])
        rows = _fetchall(cur)
        conn.close()
        return rows

    def _sync_drafts():
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT DraftID, TemplateID, TemplateName, TemplateCodigo,
                   UserName, HeaderData, BodyData, CreatedAt
            FROM FormDrafts
            WHERE (LOWER(HeaderData) LIKE LOWER(?) OR LOWER(BodyData) LIKE LOWER(?))
              AND IsActive = 1
            ORDER BY CreatedAt ASC
        """, [pattern, pattern])
        drafts = _fetchall(cur)
        conn.close()
        return drafts

    try:
        rows = await _run_sql(_sync_filled, op_name="rastrear_lote.filled")
        if not rows:
            drafts = await _run_sql(_sync_drafts, op_name="rastrear_lote.drafts")
            if not drafts:
                return empty(
                    f"No se encontraron registros para el lote {numero_lote}.",
                    data={"numero_lote": numero_lote, "matches": 0},
                )
            lines = [f"TRAZABILIDAD DEL LOTE {numero_lote} (solo borradores encontrados):"]
            for d in drafts:
                lines.append(
                    f"- Borrador ID {d['DraftID']}: {d['TemplateName']} ({d['TemplateCodigo']}), "
                    f"creado el {d['CreatedAt']}, por {d['UserName']}"
                )
            return ok(
                "\n".join(lines),
                data={"numero_lote": numero_lote, "drafts": drafts, "filled": []},
            )
    except Exception as exc:
        return from_exception(exc, f"rastrear_lote[{numero_lote}]")

    # Filtrar filas donde el lote aparece en un CAMPO de lote (no solo texto suelto)
    matching: list[dict] = []
    for row in rows:
        header = _safe_json(row["HeaderData"]) or {}
        body = _safe_json(row["BodyData"]) or []
        snapshot = _safe_json(row["TemplateSnapshot"]) or {}

        if not _find_lote_in_json(header, numero_lote) and not _find_lote_in_json(body, numero_lote):
            continue

        matching.append({
            "form_id": row["FormID"],
            "template_codigo": snapshot.get("Codigo") or snapshot.get("codigo", ""),
            "template_nombre": snapshot.get("Nombre") or snapshot.get("nombre", "N/A"),
            "proceso": snapshot.get("Proceso") or snapshot.get("proceso", ""),
            "created_at": str(row["CreatedAt"]),
            "filled_by": row["FilledBy"] or "N/A",
            "filled_by_role": row["FilledByRole"] or "",
            "tipo_producto": row["TipoProducto"] or "",
            "observaciones": row["Observaciones"] or "",
            "header": header,
            "body_rows": _extract_rows_with_lote(body, numero_lote),
        })

    if not matching:
        return empty(
            f"Se encontraron registros que contienen '{numero_lote}' como texto, "
            f"pero ninguno lo tenia en un campo de lote especifico.",
            data={"numero_lote": numero_lote, "raw_matches": len(rows), "confirmed": 0},
        )

    lines = [
        f"TRAZABILIDAD DEL LOTE {numero_lote}",
        f"Encontrado en {len(matching)} formulario(s) ordenados cronologicamente:",
    ]
    for i, m in enumerate(matching, 1):
        lines.append(f"--- Paso {i}: {m['template_nombre']} ({m['template_codigo']}) ---")
        lines.append(f"  Area: {m['proceso']}")
        lines.append(f"  Fecha: {m['created_at']}")
        lines.append(f"  Registrado por: {m['filled_by']} ({m['filled_by_role']})")
        if m["tipo_producto"]:
            lines.append(f"  Producto: {m['tipo_producto']}")
        for key, val in m["header"].items():
            if val and str(val).strip():
                lines.append(f"  {key}: {val}")
        if m["body_rows"]:
            lines.append("  Datos registrados:")
            for row_data in m["body_rows"]:
                parts = [f"{k}={v}" for k, v in row_data.items()]
                lines.append(f"    - {', '.join(parts)}")
        if m["observaciones"]:
            lines.append(f"  Observaciones: {m['observaciones']}")

    return ok(
        "\n".join(lines),
        data={"numero_lote": numero_lote, "count": len(matching), "steps": matching},
    )


@tool
async def rastrear_lote_tool(numero_lote: str) -> str:
    """Rastrea la trazabilidad cronologica completa de un lote en la base de datos.

    Recorre TODOS los formularios de control de calidad (recepcion, fileteo, empaque,
    temperatura, despacho) que registraron el lote y devuelve la historia ordenada
    por fecha. Usa esta herramienta cuando el usuario pregunte por el estado,
    recorrido o historia de un lote especifico.

    Devuelve JSON: {status, code, message, data}.

    Args:
        numero_lote: Identificador del lote a rastrear (ej. "260302", "LOT-260318").
    """
    return await _rastrear_lote(numero_lote)


# ---------------------------------------------------------------------------
# TOOL 2: obtener_esquema_formulario_tool
# ---------------------------------------------------------------------------

async def _obtener_esquema(nombre_formulario: str) -> str:
    nombre = nombre_formulario.strip()
    if not nombre or nombre.lower() == "lista":
        try:
            rows, narrativa = await _listar_templates_data()
        except Exception as exc:
            return from_exception(exc, "obtener_esquema.listar")
        if not rows:
            return empty(narrativa, data={"templates": []})
        return ok(narrativa, data={"templates": rows})

    def _sync():
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT TemplateID, Codigo, Nombre, Proceso, QuienLoLlena,
                   HeaderFields, BodyElements, Firmas
            FROM Templates
            WHERE Codigo = ? AND IsObsolete = 0
        """, [nombre.upper()])
        row = _fetchone(cur)
        if not row:
            like_pattern = f"%{nombre.lower()}%"
            cur.execute("""
                SELECT TemplateID, Codigo, Nombre, Proceso, QuienLoLlena,
                       HeaderFields, BodyElements, Firmas
                FROM Templates
                WHERE (LOWER(Nombre) LIKE ? OR LOWER(Codigo) LIKE ?)
                  AND IsObsolete = 0
            """, [like_pattern, like_pattern])
            row = _fetchone(cur)
        conn.close()
        return row

    try:
        row = await _run_sql(_sync, op_name="obtener_esquema")
    except Exception as exc:
        return from_exception(exc, "obtener_esquema")

    if not row:
        try:
            _, narrativa = await _listar_templates_data()
        except Exception:
            narrativa = ""
        return err(
            CODE_NOT_FOUND,
            f"No se encontro el formulario '{nombre_formulario}'.\n\n"
            + narrativa + "\n\nUsa el nombre o codigo exacto de la lista anterior.",
            data={"buscado": nombre_formulario},
        )

    header_fields = _safe_json(row["HeaderFields"]) or []
    body_elements = _safe_json(row["BodyElements"]) or []
    firmas = _safe_json(row["Firmas"]) or []

    narrativa = (
        f"ESQUEMA DEL FORMULARIO: {row['Nombre']} ({row['Codigo']})\n"
        f"TemplateID: {row['TemplateID']}\n"
        f"Area: {row['Proceso']} | Lo llena: {row['QuienLoLlena']}\n\n"
        f"HEADER FIELDS (campos del encabezado):\n"
        f"{json.dumps(header_fields, ensure_ascii=False, indent=2)}\n\n"
        f"BODY ELEMENTS (tablas y secciones):\n"
        f"{json.dumps(body_elements, ensure_ascii=False, indent=2)}\n\n"
        f"FIRMAS REQUERIDAS:\n"
        f"{json.dumps(firmas, ensure_ascii=False, indent=2)}"
    )
    return ok(narrativa, data={
        "template_id": row["TemplateID"],
        "codigo": row["Codigo"],
        "nombre": row["Nombre"],
        "proceso": row["Proceso"],
        "quien_lo_llena": row["QuienLoLlena"],
        "header_fields": header_fields,
        "body_elements": body_elements,
        "firmas": firmas,
    })


@tool
async def obtener_esquema_formulario_tool(nombre_formulario: str) -> str:
    """Obtiene el esquema JSON exacto de un formulario de control de calidad.

    Devuelve los campos del encabezado (HeaderFields), las tablas del cuerpo
    (BodyElements), el TemplateID y las firmas requeridas.
    DEBES llamar esta herramienta ANTES de guardar cualquier borrador.
    Los nombres de campos que devuelve son EXACTOS: nunca los inventes.
    Si nombre_formulario es "" o "lista", devuelve todos los formularios disponibles.

    Devuelve JSON: {status, code, message, data}.

    Args:
        nombre_formulario: Nombre o codigo del formulario (ej. "FOR-CC-10",
                          "control de sellos", "fileteo"). Usa "" para listar todos.
    """
    return await _obtener_esquema(nombre_formulario)


# ---------------------------------------------------------------------------
# TOOL 3: guardar_borrador_tool
# ---------------------------------------------------------------------------

async def _guardar_borrador(template_id: int, json_datos: str, usuario: str) -> str:
    try:
        datos = json.loads(json_datos)
    except json.JSONDecodeError as e:
        return err(
            CODE_VALIDATION,
            f"El JSON proporcionado no es valido: {e}. Fragmento recibido: {json_datos[:300]}",
        )

    header_data = datos.get("header", {})
    body_data = datos.get("body", [])

    if not isinstance(header_data, dict):
        return err(CODE_VALIDATION,
                   "La clave 'header' debe ser un objeto JSON { campo: valor }.")
    if not isinstance(body_data, list):
        return err(CODE_VALIDATION,
                   "La clave 'body' debe ser una lista JSON [ { id, type, data } ].")

    def _get_template():
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT TemplateID, Codigo, Nombre, Version, Proceso, QuienLoLlena,
                   HeaderFields, BodyElements, Firmas
            FROM Templates
            WHERE TemplateID = ? AND IsObsolete = 0
        """, [template_id])
        row = _fetchone(cur)
        conn.close()
        return row

    try:
        row = await _run_sql(_get_template, op_name="guardar_borrador.template")
    except Exception as exc:
        return from_exception(exc, f"guardar_borrador[{template_id}]")

    if not row:
        return err(
            CODE_NOT_FOUND,
            f"No se encontro el template con ID {template_id}. "
            "Usa obtener_esquema_formulario primero.",
            data={"template_id": template_id},
        )

    hf_raw = row["HeaderFields"]
    be_raw = row["BodyElements"]
    firmas_raw = row["Firmas"]
    firmas_list = _safe_json(firmas_raw) or []

    # Auto-completar fecha/hora en campos que el LLM dejo vacios
    for field in (_safe_json(hf_raw) or []):
        label = field.get("label", "")
        ftype = field.get("type", "")
        if not header_data.get(label):
            if ftype == "date":
                header_data[label] = datetime.now().strftime("%Y-%m-%d")
            elif ftype == "time":
                header_data[label] = datetime.now().strftime("%H:%M")

    firmas_data = {
        f.get("puesto", ""): {"nombre": "", "fecha": "", "hora": "", "email": ""}
        for f in firmas_list
        if f.get("puesto")
    }

    hf_str = hf_raw if isinstance(hf_raw, str) else json.dumps(hf_raw, ensure_ascii=False)
    be_str = be_raw if isinstance(be_raw, str) else json.dumps(be_raw, ensure_ascii=False)
    firmas_str = firmas_raw if isinstance(firmas_raw, str) else json.dumps(firmas_raw, ensure_ascii=False)

    snapshot = {
        "TemplateID": row["TemplateID"],
        "Codigo": row["Codigo"],
        "Nombre": row["Nombre"],
        "Version": row["Version"],
        "Proceso": row["Proceso"],
        "QuienLoLlena": row["QuienLoLlena"],
        "HeaderFields": hf_str,
        "BodyElements": be_str,
        "Firmas": firmas_str,
    }

    draft_payload = {
        "templateID": row["TemplateID"],
        "templateName": row["Nombre"],
        "templateCodigo": row["Codigo"],
        "userName": usuario,
        "userEmail": "",
        "userRole": "operador",
        "headerData": json.dumps(header_data, ensure_ascii=False),
        "bodyData": json.dumps(body_data, ensure_ascii=False),
        "firmasData": json.dumps(firmas_data, ensure_ascii=False),
        "templateSnapshot": json.dumps(snapshot, ensure_ascii=False),
        "progress": 10,
        "nota": "Borrador creado por FrigoVoice AI desde dictado de voz",
    }

    try:
        saved = await _run_http_post(
            f"{API_BASE_URL}/FormDrafts", draft_payload, op_name="guardar_borrador",
        )
    except Exception as exc:
        return from_exception(exc, "guardar_borrador.http")

    draft_id = saved.get("draftID") or saved.get("DraftID", "?")
    filled_fields = [f"{k}: {v}" for k, v in header_data.items() if v]
    summary = "\n".join(f"  - {f}" for f in filled_fields) or "  (sin datos prellenados)"

    # Invalidar cache: el nuevo borrador afecta dashboard y estadísticas
    invalidate_tool_cache()

    narrativa = (
        f"Borrador creado exitosamente.\n"
        f"  ID del borrador: {draft_id}\n"
        f"  Formulario: {row['Nombre']} ({row['Codigo']})\n"
        f"  Area: {row['Proceso']}\n"
        f"  Datos prellenados:\n{summary}\n\n"
        f"El operador puede completar el formulario en 'Mis Borradores' en la app."
    )
    return ok(narrativa, data={
        "draft_id": draft_id,
        "template_id": row["TemplateID"],
        "codigo": row["Codigo"],
        "header_data": header_data,
    })


@tool
async def guardar_borrador_tool(
    template_id: int,
    json_datos: str,
    usuario: str = "Operador FrigoIA",
) -> str:
    """Guarda un borrador de formulario con los datos dictados por el operario.

    Llama SOLO despues de obtener_esquema_formulario_tool y de tener TODOS los
    datos criticos (lote, producto, maquina).

    Estructura requerida de json_datos:
    {"header": {"NombreExactoDelCampo": "valor"}, "body": [{"id": 1, "type": "table", "data": [{"Columna": "valor"}]}]}

    Devuelve JSON: {status, code, message, data}.

    Args:
        template_id: ID numerico del template (de obtener_esquema_formulario_tool).
        json_datos:  JSON string con claves "header" y "body".
        usuario:     Nombre del operador que dicta el registro.
    """
    return await _guardar_borrador(template_id, json_datos, usuario)


# ---------------------------------------------------------------------------
# TOOL 4: estadisticas_formularios_tool
# ---------------------------------------------------------------------------

@tool
async def estadisticas_formularios_tool(
    fecha_desde: str = "",
    fecha_hasta: str = "",
) -> str:
    """Calcula estadisticas y porcentajes de cumplimiento de formularios llenados.

    Devuelve: total por template, porcentaje de participacion, formularios por dia,
    ranking de quien mas llena. Usar cuando el usuario pregunte cuantos formularios
    hay, estadisticas, cumplimiento, porcentajes o reportes.

    Devuelve JSON: {status, code, message, data}.

    Args:
        fecha_desde: Fecha inicio YYYY-MM-DD. Vacio = ultimos 30 dias.
        fecha_hasta: Fecha fin YYYY-MM-DD. Vacio = hoy.
    """
    _cache_key = f"estadisticas:{fecha_desde}:{fecha_hasta}"
    _cached = _cache_get(_cache_key)
    if _cached is not None:
        return _cached

    def _sync():
        conn = _get_conn()
        cur = conn.cursor()
        date_filter = ""
        date_params: list = []

        if fecha_desde:
            date_filter += " AND ff.CreatedAt >= ?"
            date_params.append(fecha_desde)
        else:
            date_filter += " AND ff.CreatedAt >= DATEADD(day, -30, GETDATE())"
        if fecha_hasta:
            date_filter += " AND ff.CreatedAt < DATEADD(day, 1, CONVERT(date, ?))"
            date_params.append(fecha_hasta)

        cur.execute(
            f"SELECT COUNT(*) FROM FilledForms ff WHERE 1=1 {date_filter}",
            date_params,
        )
        total = (cur.fetchone() or [0])[0]

        cur.execute(
            f"""SELECT t.Codigo, t.Nombre, t.Proceso, COUNT(*) as cant
            FROM FilledForms ff
            JOIN Templates t ON ff.TemplateID = t.TemplateID
            WHERE 1=1 {date_filter}
            GROUP BY t.Codigo, t.Nombre, t.Proceso
            ORDER BY cant DESC""",
            date_params,
        )
        by_template = _fetchall(cur)

        cur.execute(
            f"""SELECT TOP 10 CONVERT(date, ff.CreatedAt) as dia, COUNT(*) as cant
            FROM FilledForms ff WHERE 1=1 {date_filter}
            GROUP BY CONVERT(date, ff.CreatedAt) ORDER BY dia DESC""",
            date_params,
        )
        by_day = _fetchall(cur)

        cur.execute(
            f"""SELECT TOP 10 ff.FilledBy as quien, COUNT(*) as cant
            FROM FilledForms ff WHERE 1=1 {date_filter}
            GROUP BY ff.FilledBy ORDER BY cant DESC""",
            date_params,
        )
        by_user = _fetchall(cur)

        cur.execute("SELECT COUNT(*) FROM FormDrafts WHERE IsActive = 1")
        drafts_total = (cur.fetchone() or [0])[0]
        conn.close()
        return total, by_template, by_day, by_user, drafts_total

    try:
        total, by_template, by_day, by_user, drafts_total = await _run_sql(
            _sync, op_name="estadisticas",
        )
    except Exception as exc:
        return from_exception(exc, "estadisticas_formularios")

    periodo = f"{fecha_desde or 'ultimos 30 dias'} al {fecha_hasta or 'hoy'}"
    if total == 0:
        return empty(
            f"No se registraron formularios en el periodo {periodo}.",
            data={
                "periodo": periodo,
                "total": 0,
                "drafts_total": drafts_total,
                "by_template": [],
                "by_day": [],
                "by_user": [],
            },
        )

    lines = [
        f"ESTADISTICAS DE FORMULARIOS - {periodo}",
        f"Total llenados: {total}",
        f"Borradores activos: {drafts_total}",
    ]
    by_template_enriched = []
    if by_template:
        lines.append("")
        lines.append("DISTRIBUCION POR FORMULARIO:")
        for r in by_template:
            pct = (r["cant"] / total * 100) if total > 0 else 0
            by_template_enriched.append({**r, "porcentaje": round(pct, 1)})
            lines.append(
                f"  {r['Codigo']} - {r['Nombre']}"
                f" | {r['cant']} registros ({pct:.1f}%) | Area: {r['Proceso'] or 'N/A'}"
            )
    by_user_enriched = []
    if by_user:
        lines.append("")
        lines.append("RANKING DE RESPONSABLES:")
        for i, r in enumerate(by_user, 1):
            quien = r.get("quien") or "Sin nombre"
            pct = (r["cant"] / total * 100) if total > 0 else 0
            by_user_enriched.append({**r, "porcentaje": round(pct, 1)})
            lines.append(f"  {i}. {quien} - {r['cant']} ({pct:.1f}%)")
    if by_day:
        lines.append("")
        lines.append("ACTIVIDAD POR DIA (ultimos 10 dias):")
        for r in by_day:
            lines.append(f"  {r['dia']}: {r['cant']} formularios")

    result = ok("\n".join(lines), data={
        "periodo": periodo,
        "total": total,
        "drafts_total": drafts_total,
        "by_template": by_template_enriched,
        "by_day": by_day,
        "by_user": by_user_enriched,
    })
    _cache_set(_cache_key, result)
    return result


# ---------------------------------------------------------------------------
# TOOL 6: listar_lotes_tool
# ---------------------------------------------------------------------------

@tool
async def listar_lotes_tool(fecha_desde: str = "", fecha_hasta: str = "") -> str:
    """Lista todos los lotes unicos registrados en los formularios de la base de datos.

    Extrae lotes de HeaderData y BodyData de FilledForms y muestra cuantos
    formularios tiene cada lote, fecha de ultima actividad y que formularios
    estan involucrados. Usar cuando el usuario pregunte 'que lotes tengo',
    'lista mis lotes', 'que lotes hay esta semana', etc.

    Devuelve JSON: {status, code, message, data}.

    Args:
        fecha_desde: Fecha inicio YYYY-MM-DD. Vacio = ultimos 60 dias.
        fecha_hasta: Fecha fin YYYY-MM-DD. Vacio = hoy.
    """
    _cache_key = f"listar_lotes:{fecha_desde}:{fecha_hasta}"
    _cached = _cache_get(_cache_key)
    if _cached is not None:
        return _cached

    def _sync():
        conn = _get_conn()
        cur = conn.cursor()
        date_filter = ""
        params: list = []
        if fecha_desde:
            date_filter += " AND ff.CreatedAt >= ?"
            params.append(fecha_desde)
        else:
            date_filter += " AND ff.CreatedAt >= DATEADD(day, -60, GETDATE())"
        if fecha_hasta:
            date_filter += " AND ff.CreatedAt < DATEADD(day, 1, CONVERT(date, ?))"
            params.append(fecha_hasta)
        cur.execute(
            f"""SELECT ff.FormID, ff.CreatedAt, ff.HeaderData, ff.BodyData,
                       t.Codigo as TemplateCodigo
                FROM FilledForms ff
                JOIN Templates t ON ff.TemplateID = t.TemplateID
                WHERE 1=1 {date_filter}
                ORDER BY ff.CreatedAt DESC""",
            params,
        )
        rows = _fetchall(cur)
        conn.close()
        return rows

    try:
        rows = await _run_sql(_sync, op_name="listar_lotes")
    except Exception as exc:
        return from_exception(exc, "listar_lotes")

    if not rows:
        return empty("No se encontraron formularios en el periodo indicado.",
                     data={"lotes": [], "total": 0})

    lotes: dict[str, dict] = {}
    for row in rows:
        header = _safe_json(row["HeaderData"]) or {}
        body = _safe_json(row["BodyData"]) or []
        date_str = str(row["CreatedAt"])[:10]
        template_code = row["TemplateCodigo"]

        found: set[str] = set()
        for k, v in header.items():
            if "lote" in k.lower() and v and str(v).strip():
                found.add(str(v).strip())
        if isinstance(body, list):
            for element in body:
                if not isinstance(element, dict) or element.get("type") != "table":
                    continue
                for data_row in element.get("data", []):
                    if not isinstance(data_row, dict):
                        continue
                    for k, v in data_row.items():
                        if "lote" in k.lower() and v and str(v).strip():
                            found.add(str(v).strip())

        for lote_val in found:
            if lote_val not in lotes:
                lotes[lote_val] = {
                    "count": 0,
                    "last_date": date_str,
                    "first_date": date_str,
                    "codes": set(),
                }
            lotes[lote_val]["count"] += 1
            lotes[lote_val]["codes"].add(template_code)
            if date_str > lotes[lote_val]["last_date"]:
                lotes[lote_val]["last_date"] = date_str
            if date_str < lotes[lote_val]["first_date"]:
                lotes[lote_val]["first_date"] = date_str

    if not lotes:
        return empty("No se encontraron lotes registrados en el periodo indicado.",
                     data={"lotes": [], "total": 0})

    sorted_lotes = sorted(lotes.items(), key=lambda x: x[1]["last_date"], reverse=True)
    periodo = f"{fecha_desde or 'ultimos 60 dias'} al {fecha_hasta or 'hoy'}"
    lines = [
        f"LOTES REGISTRADOS - {periodo}",
        f"Total de lotes unicos: {len(sorted_lotes)}",
    ]
    lotes_list: list[dict] = []
    for lote_val, info in sorted_lotes:
        codes = sorted(info["codes"])
        lotes_list.append({
            "lote": lote_val,
            "count": info["count"],
            "first_date": info["first_date"],
            "last_date": info["last_date"],
            "templates": codes,
        })
        lines.append(
            f"  Lote {lote_val}"
            f" | {info['count']} formulario(s): {', '.join(codes)}"
            f" | Ultimo registro: {info['last_date']}"
        )

    result = ok("\n".join(lines), data={
        "periodo": periodo,
        "total": len(sorted_lotes),
        "lotes": lotes_list,
    })
    _cache_set(_cache_key, result)
    return result


# ---------------------------------------------------------------------------
# TOOL 7: analizar_brecha_lote_tool
# ---------------------------------------------------------------------------

_PRODUCCION_FLOW = [
    {"codigo": "FOR-PD-04", "etapa": "Fileteo",           "descripcion": "Control de produccion para fileteo"},
    {"codigo": "FOR-PD-05", "etapa": "Liberacion Tunel",  "descripcion": "Control de productos congelados — liberacion de tuneles"},
    {"codigo": "FOR-PD-06", "etapa": "Corte y Empaque",   "descripcion": "Control de corte y empaque al vacio de productos congelados"},
    {"codigo": "FOR-CC-10", "etapa": "Control de Sellos", "descripcion": "Control de sellos en producto congelado empacado al vacio"},
]
_CODIGOS_FLOW = {s["codigo"] for s in _PRODUCCION_FLOW}


@tool
async def analizar_brecha_lote_tool(numero_lote: str) -> str:
    """Analiza la trazabilidad COMPLETA de un lote y detecta brechas en el proceso productivo.

    Para cada lote muestra:
    - Que etapas del flujo (Fileteo -> Tuneles -> Empaque -> Sellos) tienen registro
    - Que etapas faltan (brechas de QC)
    - Alertas de temperatura si detecta valores fuera de rango
    - Resumen ejecutivo del estado del lote (COMPLETO / INCOMPLETO)

    Devuelve JSON: {status, code, message, data}.

    Args:
        numero_lote: Numero de lote a analizar (ej. '260402', '12938').
    """
    numero_lote = numero_lote.strip()
    if not numero_lote:
        return err(CODE_VALIDATION, "Debes proporcionar el numero de lote.")

    pattern = f"%{numero_lote}%"

    def _sync():
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT ff.FormID, ff.CreatedAt, ff.HeaderData, ff.BodyData,
                   ff.FilledBy, ff.FilledByRole, ff.Observaciones,
                   t.Codigo as TemplateCodigo, t.Nombre as TemplateNombre,
                   t.Proceso as TemplateProceso
            FROM FilledForms ff
            JOIN Templates t ON ff.TemplateID = t.TemplateID
            WHERE LOWER(ff.HeaderData) LIKE LOWER(?)
               OR LOWER(ff.BodyData)   LIKE LOWER(?)
            ORDER BY ff.CreatedAt ASC
        """, [pattern, pattern])
        rows = _fetchall(cur)
        conn.close()
        return rows

    try:
        rows = await _run_sql(_sync, op_name="analizar_brecha")
    except Exception as exc:
        return from_exception(exc, f"analizar_brecha[{numero_lote}]")

    if not rows:
        return empty(
            f"No se encontro ningun registro para el lote '{numero_lote}'.",
            data={"numero_lote": numero_lote, "etapas_ok": 0, "brechas": len(_PRODUCCION_FLOW)},
        )

    confirmed: list[dict] = []
    for row in rows:
        header = _safe_json(row["HeaderData"]) or {}
        body = _safe_json(row["BodyData"]) or []
        if _find_lote_in_json(header, numero_lote) or _find_lote_in_json(body, numero_lote):
            row["_header"] = header
            row["_body"] = body
            confirmed.append(row)

    if not confirmed:
        return empty(
            f"Se encontraron formularios que mencionan '{numero_lote}' como texto, "
            "pero ninguno en un campo de lote especifico.",
            data={"numero_lote": numero_lote, "raw_matches": len(rows), "confirmed": 0},
        )

    etapas_encontradas: dict[str, list] = {}
    etapas_otras: list[dict] = []
    alertas_temp: list[str] = []

    for row in confirmed:
        codigo = row["TemplateCodigo"]
        body = row["_body"]

        if isinstance(body, list):
            for element in body:
                if not isinstance(element, dict) or element.get("type") != "table":
                    continue
                for data_row in element.get("data", []):
                    if not isinstance(data_row, dict):
                        continue
                    for col, val in data_row.items():
                        if "temp" not in col.lower() or not val or not str(val).strip():
                            continue
                        try:
                            temp = float(str(val).replace("°", "").replace(",", ".").strip())
                            nombre_tmpl = (row["TemplateNombre"] or "").lower()
                            if "congelado" in nombre_tmpl or "tunel" in nombre_tmpl:
                                if temp > -18.0:
                                    alertas_temp.append(
                                        f"ALERTA DE TEMPERATURA: {temp}°C en {codigo}"
                                        f" (Form {row['FormID']}, {str(row['CreatedAt'])[:10]})"
                                        f" - congelado debe estar a -18°C o menos"
                                    )
                            else:
                                if temp > 4.0:
                                    alertas_temp.append(
                                        f"ALERTA DE TEMPERATURA: {temp}°C en {codigo}"
                                        f" (Form {row['FormID']}, {str(row['CreatedAt'])[:10]})"
                                        f" - frio debe estar a 4°C o menos"
                                    )
                        except (ValueError, TypeError):
                            pass

        if codigo in _CODIGOS_FLOW:
            etapas_encontradas.setdefault(codigo, []).append(row)
        else:
            etapas_otras.append(row)

    lines: list[str] = []
    if alertas_temp:
        lines.extend(alertas_temp)
        lines.append("")

    lines.append(f"TRAZABILIDAD COMPLETA - LOTE {numero_lote}")
    lines.append(f"Formularios confirmados: {len(confirmed)}")
    lines.append("")
    lines.append("FLUJO DE PRODUCCION:")

    etapas_ok = 0
    etapas_detalle: list[dict] = []
    for etapa in _PRODUCCION_FLOW:
        cod = etapa["codigo"]
        if cod in etapas_encontradas:
            etapas_ok += 1
            regs = etapas_encontradas[cod]
            r = regs[0]
            filled_by = r.get("FilledBy") or "N/A"
            etapas_detalle.append({
                "etapa": etapa["etapa"], "codigo": cod, "status": "ok",
                "registros": len(regs), "fecha": str(r["CreatedAt"])[:10],
                "responsable": filled_by,
            })
            lines.append(
                f"  OK  {etapa['etapa']} ({cod})"
                f" - {len(regs)} registro(s)"
                f" | {str(r['CreatedAt'])[:10]}"
                f" | Responsable: {filled_by}"
            )
            lote_rows = _extract_rows_with_lote(r["_body"], numero_lote)
            for lr in lote_rows[:2]:
                kv = [f"{k}={v}" for k, v in lr.items() if v and str(v).strip()]
                if kv:
                    lines.append(f"       Datos: {', '.join(kv[:6])}")
        else:
            etapas_detalle.append({
                "etapa": etapa["etapa"], "codigo": cod, "status": "faltante",
            })
            lines.append(f"  FALTA  {etapa['etapa']} ({cod}) - SIN REGISTRO (brecha de QC)")

    if etapas_otras:
        lines.append("")
        lines.append("OTROS CONTROLES REGISTRADOS:")
        for r in etapas_otras:
            lines.append(
                f"  - {r['TemplateNombre']} ({r['TemplateCodigo']})"
                f" | {str(r['CreatedAt'])[:10]}"
                f" | {r.get('FilledBy') or 'N/A'}"
            )

    total_etapas = len(_PRODUCCION_FLOW)
    brechas = total_etapas - etapas_ok
    faltantes = [e["etapa"] for e in _PRODUCCION_FLOW if e["codigo"] not in etapas_encontradas]

    lines.append("")
    lines.append("RESUMEN EJECUTIVO:")
    lines.append(f"  Etapas completadas: {etapas_ok}/{total_etapas}")
    estado = "COMPLETO" if brechas == 0 else "INCOMPLETO"
    if brechas == 0:
        lines.append("  Estado del lote: COMPLETO - todas las etapas tienen registro")
    else:
        lines.append(f"  Estado del lote: INCOMPLETO - faltan {brechas} etapa(s): {', '.join(faltantes)}")
    if alertas_temp:
        lines.append(f"  Alertas de temperatura: {len(alertas_temp)} detectada(s)")

    return ok("\n".join(lines), data={
        "numero_lote": numero_lote,
        "formularios_confirmados": len(confirmed),
        "etapas_ok": etapas_ok,
        "etapas_total": total_etapas,
        "brechas": brechas,
        "estado": estado,
        "faltantes": faltantes,
        "alertas_temperatura": alertas_temp,
        "flujo": etapas_detalle,
    })


# ---------------------------------------------------------------------------
# TOOL 5: analizar_datos_formulario_tool
# ---------------------------------------------------------------------------

@tool
async def analizar_datos_formulario_tool(
    template_codigo: str,
    fecha_desde: str = "",
    fecha_hasta: str = "",
    limite: int = 50,
) -> str:
    """Extrae y analiza los datos internos de formularios llenados de un tipo especifico.

    Lee campos reales (HeaderData, BodyData) para detectar patrones: productos mas
    frecuentes, rangos de temperatura, valores numericos, observaciones. Usar cuando
    el usuario pregunte por el contenido de un formulario especifico.

    Devuelve JSON: {status, code, message, data}.

    Args:
        template_codigo: Codigo del formulario (ej. 'FOR-CC-10', 'FOR-CA-4').
        fecha_desde: Fecha inicio YYYY-MM-DD. Vacio = ultimos 30 dias.
        fecha_hasta: Fecha fin YYYY-MM-DD. Vacio = hoy.
        limite: Maximo de formularios a analizar (default 50, maximo 200).
    """
    if not template_codigo:
        return err(CODE_VALIDATION, "Debes indicar el codigo del formulario (ej. FOR-CC-10).")

    limite = min(limite, 200)

    def _sync():
        conn = _get_conn()
        cur = conn.cursor()
        date_filter = ""
        date_params: list = []

        if fecha_desde:
            date_filter += " AND ff.CreatedAt >= ?"
            date_params.append(fecha_desde)
        else:
            date_filter += " AND ff.CreatedAt >= DATEADD(day, -30, GETDATE())"
        if fecha_hasta:
            date_filter += " AND ff.CreatedAt < DATEADD(day, 1, CONVERT(date, ?))"
            date_params.append(fecha_hasta)

        all_params = [limite, template_codigo.upper()] + date_params
        cur.execute(
            f"""SELECT TOP (?) ff.FormID, ff.CreatedAt, ff.FilledBy, ff.TipoProducto,
                   ff.HeaderData, ff.BodyData, ff.Observaciones
            FROM FilledForms ff
            JOIN Templates t ON ff.TemplateID = t.TemplateID
            WHERE t.Codigo = ? {date_filter}
            ORDER BY ff.CreatedAt DESC""",
            all_params,
        )
        rows = _fetchall(cur)
        conn.close()
        return rows

    try:
        rows = await _run_sql(_sync, op_name="analizar_datos")
    except Exception as exc:
        return from_exception(exc, f"analizar_datos[{template_codigo}]")

    periodo = f"{fecha_desde or 'ultimos 30 dias'} al {fecha_hasta or 'hoy'}"

    if not rows:
        return empty(
            f"No hay formularios llenados de {template_codigo} en el periodo {periodo}.",
            data={"template_codigo": template_codigo, "periodo": periodo, "total": 0},
        )

    header_values: dict[str, dict[str, int]] = {}
    body_numeric: dict[str, list[float]] = {}
    productos: dict[str, int] = {}
    obs_list: list[str] = []

    for row in rows:
        header = _safe_json(row["HeaderData"]) or {}
        body = _safe_json(row["BodyData"]) or []
        prod = row["TipoProducto"] or header.get("Tipo de Producto") or header.get("Producto") or ""
        if prod:
            productos[prod] = productos.get(prod, 0) + 1
        for k, v in header.items():
            if not v or not str(v).strip():
                continue
            val = str(v).strip()
            header_values.setdefault(k, {})
            header_values[k][val] = header_values[k].get(val, 0) + 1
        if isinstance(body, list):
            for element in body:
                if not isinstance(element, dict) or element.get("type") != "table":
                    continue
                for data_row in element.get("data", []):
                    if not isinstance(data_row, dict):
                        continue
                    for col, val in data_row.items():
                        try:
                            num = float(str(val).replace(",", ".").replace("°", "").strip())
                            body_numeric.setdefault(col, []).append(num)
                        except (ValueError, TypeError):
                            pass
        obs = row["Observaciones"] or ""
        if obs.strip():
            obs_list.append(obs.strip()[:120])

    lines = [
        f"ANALISIS DE {template_codigo} ({len(rows)} formularios)",
        f"Periodo: {periodo}",
    ]
    productos_enriched = []
    if productos:
        total_p = sum(productos.values())
        lines.append("")
        lines.append("PRODUCTOS REGISTRADOS:")
        for prod, cnt in sorted(productos.items(), key=lambda x: -x[1]):
            pct = cnt / total_p * 100
            productos_enriched.append({"producto": prod, "cantidad": cnt, "porcentaje": round(pct, 1)})
            lines.append(f"  {prod}: {cnt} ({pct:.1f}%)")
    numeric_summary = {}
    if body_numeric:
        lines.append("")
        lines.append("VALORES NUMERICOS (temperaturas, pesos, etc.):")
        for col, vals in sorted(body_numeric.items()):
            if len(vals) >= 2:
                stats = {
                    "min": round(min(vals), 2),
                    "max": round(max(vals), 2),
                    "prom": round(sum(vals) / len(vals), 2),
                    "n": len(vals),
                }
                numeric_summary[col] = stats
                lines.append(
                    f"  {col}: min={stats['min']:.1f}  max={stats['max']:.1f}"
                    f"  prom={stats['prom']:.1f}  n={stats['n']}"
                )
    header_top: dict[str, list] = {}
    if header_values:
        lines.append("")
        lines.append("CAMPOS DEL HEADER (valores mas frecuentes):")
        for campo, vals in sorted(header_values.items()):
            top = sorted(vals.items(), key=lambda x: -x[1])[:3]
            header_top[campo] = [{"valor": v, "cantidad": c} for v, c in top]
            top_str = ", ".join(f'"{v}"x{c}' for v, c in top)
            lines.append(f"  {campo}: {top_str}")
    if obs_list:
        lines.append("")
        lines.append(f"OBSERVACIONES ({len(obs_list)}):")
        for o in obs_list[:5]:
            lines.append(f"  - {o}")
        if len(obs_list) > 5:
            lines.append(f"  ... y {len(obs_list) - 5} mas.")

    return ok("\n".join(lines), data={
        "template_codigo": template_codigo,
        "periodo": periodo,
        "total": len(rows),
        "productos": productos_enriched,
        "numeric_summary": numeric_summary,
        "header_top": header_top,
        "observaciones_sample": obs_list[:10],
    })


# ---------------------------------------------------------------------------
# TOOL 8: analizar_foto_etiqueta_tool
# Llamada DIRECTA a Ollama en A100 de CEDIA (https://ia.frigolab.dev)
# sin pasar por LiteLLM proxy para minimizar saltos y latencia.
#
# Estrategia de resiliencia:
#   - Timeout RAPIDO (15s): si la A100 no responde en 15s, el bot ya avisa al
#     operario con un mensaje parcial y sigue procesando.
#   - La conexion con la GPU se mantiene via MCP; el servidor MCP expone esta
#     misma logica en `analizar_foto_etiqueta` para que el agente pueda
#     invocarla tambien por ese canal si el llamado directo esta ocupado.
# ---------------------------------------------------------------------------

_VISION_URL        = os.getenv("OLLAMA_VISION_URL",      "https://ia.frigolab.dev/api/generate")
_VISION_MODEL      = os.getenv("OLLAMA_VISION_MODEL",    "llama3.2-vision")
_VISION_TIMEOUT    = float(os.getenv("OLLAMA_VISION_TIMEOUT", "20"))   # segundos — rapido
_VISION_TIMEOUT_EX = float(os.getenv("OLLAMA_VISION_TIMEOUT_EXT", "60"))  # timeout extendido

_VISION_PROMPT = (
    "Eres un asistente de control de calidad de Frigolab, planta pesquera de Ecuador. "
    "Analiza la imagen y extrae TODOS los datos visibles. "
    "Responde exactamente en este formato, sin texto adicional:\n"
    "LOTE: [numero o N/A]\n"
    "PRODUCTO: [especie/tipo o N/A]\n"
    "FECHA: [fecha visible o N/A]\n"
    "PESO: [peso o cantidad o N/A]\n"
    "TEMPERATURA: [temperatura si aparece o N/A]\n"
    "CODIGO_BARRAS: [codigo si hay o N/A]\n"
    "OTROS_DATOS: [cualquier otro dato relevante]\n"
    "FORMULARIO_RECOMENDADO: [uno de: FOR-PD-04 Fileteo / FOR-PD-05 Liberacion Tunel / "
    "FOR-PD-06 Corte Empaque / FOR-CC-10 Control Sellos / Sin formulario especifico]\n"
    "RAZON: [por que recomiendas ese formulario, en una frase]"
)


async def _llamar_vision(imagen_base64: str, timeout: float) -> tuple[str | None, str | None]:
    """Llama a la API de Ollama vision. Retorna (response_text, error_msg).

    Si hay error retorna (None, mensaje_error).
    Si hay timeout retorna (None, "TIMEOUT").
    """
    payload = {
        "model": _VISION_MODEL,
        "prompt": _VISION_PROMPT,
        "images": [imagen_base64],
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(_VISION_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()
            text = data.get("response", "").strip()
            return (text or None, None)
    except httpx.ConnectError:
        return None, "CONNECT_ERROR"
    except httpx.TimeoutException:
        return None, "TIMEOUT"
    except httpx.HTTPStatusError as exc:
        return None, f"HTTP_{exc.response.status_code}"
    except Exception as exc:
        return None, f"ERROR: {exc}"


@tool
async def analizar_foto_etiqueta_tool(imagen_base64: str) -> str:
    """Analiza una foto de etiqueta de producto con llama3.2-vision en la A100 de CEDIA.

    Extrae numero de lote, tipo de producto, fechas, pesos, temperatura y recomienda
    el formulario de QC correspondiente. Llamada directa a https://ia.frigolab.dev
    sin pasar por LiteLLM para minima latencia.

    Si la A100 demora mas de 20 segundos, el bot avisa al operario y reintenta
    con timeout extendido (60s) para no bloquear la conversacion.

    Usar cuando el operario envia una foto de una etiqueta, caja, tina o producto.

    Args:
        imagen_base64: Imagen codificada en base64 (JPEG o PNG, max ~4MB).
    """
    if not imagen_base64:
        return err(CODE_VALIDATION, "imagen_base64 no puede estar vacia.")

    # Limpiar header si viene con data URI (data:image/jpeg;base64,...)
    if "," in imagen_base64:
        imagen_base64 = imagen_base64.split(",", 1)[1]

    # Intento 1 — timeout rapido (20s por defecto)
    text, error = await _llamar_vision(imagen_base64, _VISION_TIMEOUT)

    if text:
        return f"ANALISIS DE IMAGEN (llama3.2-vision / A100 CEDIA):\n\n{text}"

    if error == "CONNECT_ERROR":
        return (
            "La A100 de CEDIA no responde (https://ia.frigolab.dev sin conexion).\n"
            "Verifica que la VM de CEDIA este activa y Ollama corriendo.\n"
            "Mientras tanto, escribe los datos: lote, producto, temperatura."
        )

    if error == "TIMEOUT":
        log.warning(
            "vision: timeout en %.0fs — reintentando con timeout extendido %.0fs",
            _VISION_TIMEOUT, _VISION_TIMEOUT_EX,
        )
        # Intento 2 — timeout extendido. La GPU esta ocupada pero activa.
        text2, error2 = await _llamar_vision(imagen_base64, _VISION_TIMEOUT_EX)
        if text2:
            return (
                f"ANALISIS DE IMAGEN (llama3.2-vision / A100 CEDIA — respuesta lenta):\n\n{text2}"
            )
        if error2 == "TIMEOUT":
            return (
                "La A100 esta ocupada procesando otra tarea (timeout >60s).\n"
                "Tu imagen fue recibida. Vuelve a intentarlo en 1-2 minutos.\n"
                "O escribe los datos manualmente: lote, producto, temperatura."
            )
        return (
            f"Error en segundo intento de analisis de imagen: {error2}\n"
            "Escribe los datos manualmente: lote, producto, temperatura."
        )

    return (
        f"Error al analizar imagen ({error}).\n"
        "Intenta nuevamente o escribe los datos manualmente."
    )


# ---------------------------------------------------------------------------
# TOOL 9: resumen_negocio_tool
# Dashboard ejecutivo: KPIs de trazabilidad, cumplimiento y gestión del negocio.
# ---------------------------------------------------------------------------

async def _resumen_negocio(fecha_desde: str, fecha_hasta: str) -> str:
    _cache_key = f"resumen_negocio:{fecha_desde}:{fecha_hasta}"
    _cached = _cache_get(_cache_key)
    if _cached is not None:
        return _cached

    def _sync():
        conn = _get_conn()
        cur = conn.cursor()
        date_filter = ""
        params: list = []
        if fecha_desde:
            date_filter += " AND ff.CreatedAt >= ?"
            params.append(fecha_desde)
        else:
            date_filter += " AND ff.CreatedAt >= DATEADD(day, -7, GETDATE())"
        if fecha_hasta:
            date_filter += " AND ff.CreatedAt < DATEADD(day, 1, CONVERT(date, ?))"
            params.append(fecha_hasta)

        cur.execute(
            f"""SELECT ff.FormID, ff.CreatedAt, ff.FilledBy, ff.TipoProducto,
                       ff.HeaderData, ff.BodyData,
                       t.Codigo as TemplateCodigo, t.Nombre as TemplateNombre
                FROM FilledForms ff
                JOIN Templates t ON ff.TemplateID = t.TemplateID
                WHERE 1=1 {date_filter}
                ORDER BY ff.CreatedAt DESC""",
            params,
        )
        rows = _fetchall(cur)

        cur.execute("SELECT COUNT(*) FROM FormDrafts WHERE IsActive = 1")
        drafts_activos = (cur.fetchone() or [0])[0]
        conn.close()
        return rows, drafts_activos

    try:
        rows, drafts_activos = await _run_sql(_sync, op_name="resumen_negocio")
    except Exception as exc:
        return from_exception(exc, "resumen_negocio")

    if not rows:
        periodo_vacio = f"{fecha_desde or 'ultimos 7 dias'} al {fecha_hasta or 'hoy'}"
        return empty(
            f"No hay formularios registrados en el periodo {periodo_vacio}.",
            data={"total": 0, "lotes": 0},
        )

    periodo = f"{fecha_desde or 'ultimos 7 dias'} al {fecha_hasta or 'hoy'}"
    total_forms = len(rows)

    # Calcular promedio por dia
    from datetime import datetime as _dt
    fechas_dt = [r["CreatedAt"] for r in rows if r["CreatedAt"]]
    if len(fechas_dt) > 1:
        rango_dias = max((_dt.fromisoformat(str(max(fechas_dt))[:10]) - _dt.fromisoformat(str(min(fechas_dt))[:10])).days + 1, 1)
    else:
        rango_dias = 1
    prom_por_dia = round(total_forms / rango_dias, 1)

    # Acumular datos por template, responsable, producto y lotes
    by_template: dict[str, int] = {}
    by_responsable: dict[str, int] = {}
    by_producto: dict[str, int] = {}
    lotes: dict[str, set] = {}           # lote -> set de codes de etapas presentes
    alertas_temp: list[str] = []

    for row in rows:
        header = _safe_json(row["HeaderData"]) or {}
        body = _safe_json(row["BodyData"]) or []
        codigo = row["TemplateCodigo"]
        nombre_tmpl = (row["TemplateNombre"] or "").lower()
        responsable = (row["FilledBy"] or "Sin nombre").strip()
        producto = (row["TipoProducto"] or header.get("Tipo de Producto") or header.get("Producto") or "").strip()

        by_template[codigo] = by_template.get(codigo, 0) + 1
        by_responsable[responsable] = by_responsable.get(responsable, 0) + 1
        if producto:
            by_producto[producto] = by_producto.get(producto, 0) + 1

        # Extraer lotes del header
        for k, v in header.items():
            if "lote" in k.lower() and v and str(v).strip():
                lv = str(v).strip()
                lotes.setdefault(lv, set()).add(codigo)

        # Extraer lotes del body y revisar temperaturas
        if isinstance(body, list):
            for element in body:
                if not isinstance(element, dict) or element.get("type") != "table":
                    continue
                for data_row in element.get("data", []):
                    if not isinstance(data_row, dict):
                        continue
                    for col, val in data_row.items():
                        if "lote" in col.lower() and val and str(val).strip():
                            lv = str(val).strip()
                            lotes.setdefault(lv, set()).add(codigo)
                        if "temp" in col.lower() and val and str(val).strip():
                            try:
                                temp_v = float(str(val).replace("°", "").replace(",", ".").strip())
                                if "congelado" in nombre_tmpl or "tunel" in nombre_tmpl:
                                    if temp_v > -18.0:
                                        alertas_temp.append(
                                            f"{codigo} | {col}={temp_v}°C (max -18°C)"
                                        )
                                else:
                                    if temp_v > 4.0:
                                        alertas_temp.append(
                                            f"{codigo} | {col}={temp_v}°C (max 4°C)"
                                        )
                            except (ValueError, TypeError):
                                pass

    # --- TRAZABILIDAD: lotes completos vs incompletos ---
    codigos_flujo = {e["codigo"] for e in _PRODUCCION_FLOW}
    lotes_completos: list[str] = []
    lotes_con_brechas: list[dict] = []

    for lote_val, codigos_presentes in lotes.items():
        etapas_ok = codigos_presentes & codigos_flujo
        if len(etapas_ok) == len(_PRODUCCION_FLOW):
            lotes_completos.append(lote_val)
        else:
            faltantes = [e["etapa"] for e in _PRODUCCION_FLOW if e["codigo"] not in codigos_presentes]
            tiene = [e["etapa"] for e in _PRODUCCION_FLOW if e["codigo"] in codigos_presentes]
            lotes_con_brechas.append({
                "lote": lote_val,
                "tiene": tiene,
                "faltantes": faltantes,
            })

    total_lotes = len(lotes)
    pct_completos = (len(lotes_completos) / total_lotes * 100) if total_lotes > 0 else 0
    pct_brechas = 100 - pct_completos

    # --- CONSTRUIR TEXTO DEL REPORTE ---
    lines: list[str] = [
        f"DASHBOARD FRIGOLAB — {periodo}",
        "",
        "KPIs PRINCIPALES:",
        f"  Formularios llenados: {total_forms}  ({prom_por_dia}/dia promedio)",
        f"  Borradores activos pendientes: {drafts_activos}",
    ]

    if total_lotes > 0:
        lines.append(f"  Lotes registrados: {total_lotes}")
        lines.append(f"  Lotes COMPLETOS (4 etapas): {len(lotes_completos)}  ({pct_completos:.0f}%)")
        lines.append(f"  Lotes con BRECHAS de QC:   {len(lotes_con_brechas)}  ({pct_brechas:.0f}%)")
    else:
        lines.append("  Lotes registrados: 0 (no se encontraron campos de lote en los registros)")

    if alertas_temp:
        lines.append(f"  Alertas de temperatura: {len(alertas_temp)} fuera de rango")

    # Lotes con brechas — detalle de los primeros 6
    if lotes_con_brechas:
        lines.append("")
        lines.append(f"LOTES INCOMPLETOS ({len(lotes_con_brechas)} lotes con brechas de QC):")
        for item in lotes_con_brechas[:6]:
            tiene_str = ", ".join(item["tiene"]) if item["tiene"] else "ninguna"
            falta_str = ", ".join(item["faltantes"])
            lines.append(f"  Lote {item['lote']}: falta {falta_str}  (tiene: {tiene_str})")
        if len(lotes_con_brechas) > 6:
            lines.append(f"  ... y {len(lotes_con_brechas) - 6} lotes mas con brechas.")

    # Alertas de temperatura
    if alertas_temp:
        lines.append("")
        lines.append(f"ALERTAS DE TEMPERATURA ({len(alertas_temp)} detectadas):")
        for a in alertas_temp[:5]:
            lines.append(f"  {a}")
        if len(alertas_temp) > 5:
            lines.append(f"  ... y {len(alertas_temp) - 5} alertas mas.")

    # Distribucion por formulario
    if by_template:
        lines.append("")
        lines.append("FORMULARIOS POR TIPO:")
        for codigo, cnt in sorted(by_template.items(), key=lambda x: -x[1]):
            pct = cnt / total_forms * 100
            lines.append(f"  {codigo}: {cnt} ({pct:.0f}%)")

    # Productos mas frecuentes
    if by_producto:
        lines.append("")
        lines.append("PRODUCTOS MAS FRECUENTES:")
        for prod, cnt in sorted(by_producto.items(), key=lambda x: -x[1])[:5]:
            pct = cnt / total_forms * 100
            lines.append(f"  {prod}: {cnt} ({pct:.0f}%)")

    # Ranking de responsables
    if by_responsable:
        lines.append("")
        lines.append("CUMPLIMIENTO POR RESPONSABLE:")
        for i, (nombre, cnt) in enumerate(sorted(by_responsable.items(), key=lambda x: -x[1])[:5], 1):
            pct = cnt / total_forms * 100
            lines.append(f"  {i}. {nombre}: {cnt} formularios ({pct:.0f}%)")

    result = ok("\n".join(lines), data={
        "periodo": periodo,
        "total_forms": total_forms,
        "prom_por_dia": prom_por_dia,
        "drafts_activos": drafts_activos,
        "total_lotes": total_lotes,
        "lotes_completos": len(lotes_completos),
        "lotes_con_brechas": len(lotes_con_brechas),
        "pct_completos": round(pct_completos, 1),
        "alertas_temperatura": len(alertas_temp),
        "brechas_detalle": lotes_con_brechas[:10],
        "by_template": by_template,
        "by_responsable": by_responsable,
        "by_producto": by_producto,
    })
    _cache_set(_cache_key, result)
    return result


@tool
async def resumen_negocio_tool(
    fecha_desde: str = "",
    fecha_hasta: str = "",
) -> str:
    """Dashboard ejecutivo de Frigolab: KPIs de trazabilidad, brechas de QC y gestión.

    Calcula para el período indicado:
    - % lotes COMPLETOS (con las 4 etapas: Fileteo, Tunel, Empaque, Sellos)
    - Lotes INCOMPLETOS con detalle de qué etapas faltan (brechas de QC)
    - Alertas de temperatura fuera de rango (-18C congelado / 4C frio)
    - Promedio de formularios por dia y borradores pendientes
    - Distribucion por tipo de formulario y porcentajes
    - Ranking de responsables por cumplimiento
    - Productos mas frecuentes registrados

    Usar cuando el operario pregunte: "dashboard", "como vamos", "resumen",
    "estado general", "inicio de turno", "KPIs", "cumplimiento", "reporte del dia/semana",
    "cuantos lotes completos", "que esta pasando", "hay alertas".

    Devuelve JSON: {status, code, message, data}.

    Args:
        fecha_desde: Fecha inicio YYYY-MM-DD. Vacio = ultimos 7 dias.
        fecha_hasta: Fecha fin YYYY-MM-DD. Vacio = hoy.
    """
    return await _resumen_negocio(fecha_desde, fecha_hasta)
````

## File: start.ps1
````powershell
param(
  [ValidateSet("bot","api","both","mcp","webhook")]
  [string]$Mode = "both",
  [ValidateSet("stdio","sse")]
  [string]$McpTransport = "stdio",
  [switch]$NoInstall,
  [switch]$CleanPort4000
)

Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned -Force

$root = $PSScriptRoot
Set-Location $root

Write-Host "`n=== frigo-ai startup ===" -ForegroundColor Cyan

function Load-DotEnv([string]$Path) {
  if (-not (Test-Path $Path)) {
    throw "No existe $Path. Crea tu .env (puedes copiar .env.example)."
  }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line) { return }
    if ($line.StartsWith("#")) { return }

    # key=value (permite espacios). Quita comillas simples/dobles si existen.
    if ($line -match '^\s*([^=]+?)\s*=\s*(.*)\s*$') {
      $k = $Matches[1].Trim()
      $v = $Matches[2].Trim()
      if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
        $v = $v.Substring(1, $v.Length - 2)
      }
      [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
    }
  }
}

Load-DotEnv "$root\.env"
$env:PYTHONUTF8 = "1"

if ($CleanPort4000) {
  $prev = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
  if ($prev) {
    Write-Host "Limpiando proceso en puerto 4000 (LiteLLM u otro)..." -ForegroundColor Yellow
    Stop-Process -Id $prev.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
  }
}

# --- Python / venv ---
$py = Join-Path $root "venv\Scripts\python.exe"
$pip = Join-Path $root "venv\Scripts\pip.exe"
$activate = Join-Path $root "venv\Scripts\Activate.ps1"

if (-not (Test-Path $py)) {
  Write-Host "Creando virtualenv (venv)..." -ForegroundColor Yellow
  python -m venv (Join-Path $root "venv")
}

if (-not $NoInstall) {
  Write-Host "Instalando dependencias (requirements.txt)..." -ForegroundColor Yellow
  & $py -m pip install --upgrade pip | Out-Host
  & $pip install -r (Join-Path $root "requirements.txt") | Out-Host
} else {
  Write-Host "Saltando instalación de dependencias (-NoInstall)." -ForegroundColor DarkGray
}

function Assert-Env([string[]]$Keys, [string]$Context) {
  $missing = @()
  foreach ($k in $Keys) {
    if (-not [System.Environment]::GetEnvironmentVariable($k, "Process")) { $missing += $k }
  }
  if ($missing.Count -gt 0) {
    throw "Faltan variables en .env para ${Context}: $($missing -join ', ')"
  }
}

if ($Mode -eq "bot" -or $Mode -eq "both") {
  Assert-Env @("TELEGRAM_BOT_TOKEN") "Telegram bot"
}

if ($Mode -eq "webhook") {
  Assert-Env @("TELEGRAM_BOT_TOKEN","WEBHOOK_URL","WEBHOOK_SECRET") "modo webhook"
}

if ($Mode -eq "api" -or $Mode -eq "both") {
  # Para levantar server.py se requiere el agente, y el agente necesita SQL_* ahora.
  Assert-Env @("SQL_SERVER","SQL_DATABASE","SQL_USER","SQL_PASSWORD") "API/Agente (SQL Server)"
}

if ($Mode -eq "mcp") {
  Assert-Env @("SQL_SERVER","SQL_DATABASE","SQL_USER","SQL_PASSWORD") "MCP server (SQL Server)"
}

$mcpPort = [int](($env:MCP_SSE_URL -replace ".*:(\d+).*", '$1') -replace "http://localhost:", "8001")
if (-not $mcpPort) { $mcpPort = 8001 }

function Start-McpServer {
  param([string]$Transport = "sse", [int]$Port = 8001)
  # Verificar si ya hay algo escuchando en el puerto
  $existing = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "  MCP server: ya hay un proceso en el puerto $Port (reutilizando)." -ForegroundColor DarkGray
    return
  }
  Write-Host "  Iniciando MCP server en SSE modo (puerto $Port)..." -ForegroundColor DarkCyan
  $mcpCmd = "Set-Location '$root'; & '$activate'; & '$py' '$root\mcp_server.py' --transport $Transport --port $Port"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $mcpCmd -WindowStyle Minimized | Out-Null
  # Esperar a que el servidor levante (max 8 seg)
  $deadline = (Get-Date).AddSeconds(8)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($conn) {
      Write-Host "  MCP server listo en http://localhost:$Port/sse" -ForegroundColor Green
      [System.Environment]::SetEnvironmentVariable("MCP_SSE_URL", "http://localhost:$Port/sse", "Process")
      return
    }
  }
  Write-Host "  MCP server no respondio en 8s (el bot usara fallback stdio)." -ForegroundColor Yellow
}

switch ($Mode) {
  "bot" {
    Write-Host "Iniciando MCP server + Telegram bot..." -ForegroundColor Yellow
    Start-McpServer -Transport sse -Port $mcpPort
    & $py (Join-Path $root "telegram_bot.py")
  }
  "api" {
    Write-Host "Iniciando FastAPI server en http://localhost:8100 ..." -ForegroundColor Yellow
    Write-Host "  API:  http://localhost:8100" -ForegroundColor White
    Write-Host "  Docs: http://localhost:8100/docs`n" -ForegroundColor White
    & $py (Join-Path $root "server.py")
  }
  "mcp" {
    Write-Host "Iniciando MCP server (transport=$McpTransport)..." -ForegroundColor Yellow
    & $py (Join-Path $root "mcp_server.py") --transport $McpTransport
  }
  "both" {
    Write-Host "[1/3] Iniciando MCP server (ventana minimizada)..." -ForegroundColor Yellow
    Start-McpServer -Transport sse -Port $mcpPort

    Write-Host "[2/3] Iniciando Telegram bot (nueva ventana)..." -ForegroundColor Yellow
    $botCmd = "Set-Location '$root'; & '$activate'; & '$py' '$root\telegram_bot.py'; pause"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $botCmd | Out-Null
    Start-Sleep -Seconds 2
    Write-Host "       Telegram bot iniciado." -ForegroundColor Green

    Write-Host "[3/3] Iniciando FastAPI server en http://localhost:8100 ..." -ForegroundColor Yellow
    Write-Host "  API:  http://localhost:8100" -ForegroundColor White
    Write-Host "  Docs: http://localhost:8100/docs`n" -ForegroundColor White
    & $py (Join-Path $root "server.py")
  }
  "webhook" {
    # Modo Container Apps: uvicorn + PTB webhook.
    # WEBHOOK_URL debe apuntar a una URL publica accesible desde Internet
    # (en produccion: tu Azure Container App URL).
    # Para pruebas locales usa ngrok: https://ngrok.com/download
    #   ngrok http 8000   -> copia la URL https://xxxx.ngrok-free.app
    #   luego: $env:WEBHOOK_URL = "https://xxxx.ngrok-free.app"
    Start-McpServer -Transport sse -Port $mcpPort
    $uvicorn = Join-Path $root "venv\Scripts\uvicorn.exe"
    Write-Host "Iniciando servidor webhook (uvicorn) en http://0.0.0.0:8000 ..." -ForegroundColor Yellow
    Write-Host "  Health: http://localhost:8000/health" -ForegroundColor White
    Write-Host "  Docs:   http://localhost:8000/docs" -ForegroundColor White
    Write-Host "  Webhook URL configurada: $($env:WEBHOOK_URL)" -ForegroundColor Cyan
    Write-Host ""
    & $uvicorn "server:app" --host "0.0.0.0" --port 8000 --workers 1
  }
}
````

## File: state_backends.py
````python
"""
state_backends.py - Factory de checkpointers para LangGraph.

Por que existe este modulo:
  * LangGraph guarda el estado conversacional via "checkpointer". En desarrollo
    usamos `MemorySaver` (RAM). En produccion no sirve porque:
      - Si el contenedor reinicia, todos los operarios pierden contexto.
      - No escala a mas de una replica: cada replica tendria su propia memoria.
      - No se puede hacer analisis post-mortem de una conversacion.
  * `PostgresSaver` persiste el estado en Postgres, permitiendo horizontal scale
    y recuperacion tras reinicio.

Uso:
  # En desarrollo (default):
  checkpointer = get_checkpointer()  # -> MemorySaver

  # En produccion, con .env CHECKPOINTER_BACKEND=postgres:
  checkpointer = get_checkpointer()  # -> PostgresSaver + tablas creadas

Variables de entorno:
  CHECKPOINTER_BACKEND = memory | postgres   (default: memory)
  PG_DATABASE_URL      = postgresql://user:pass@host:5432/db  (requerido si postgres)

Notas:
  * langgraph-checkpoint-postgres se importa de forma perezosa. Si el paquete
    no esta instalado y CHECKPOINTER_BACKEND=postgres, fallamos rapido con un
    mensaje claro. En memory mode no requiere el paquete extra.
  * `setup()` de PostgresSaver crea las tablas si no existen: idempotente.
"""
from __future__ import annotations

import logging
import os
from typing import Any

from langgraph.checkpoint.memory import MemorySaver

log = logging.getLogger(__name__)

_checkpointer_singleton: Any = None


def _build_postgres_saver():
    """Crea un PostgresSaver conectado a PG_DATABASE_URL y prepara las tablas."""
    try:
        from langgraph.checkpoint.postgres import PostgresSaver  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "CHECKPOINTER_BACKEND=postgres requiere `langgraph-checkpoint-postgres`. "
            "Instala con `pip install langgraph-checkpoint-postgres` y reintenta."
        ) from exc

    dsn = os.getenv("PG_DATABASE_URL", "").strip()
    if not dsn:
        raise EnvironmentError(
            "CHECKPOINTER_BACKEND=postgres pero PG_DATABASE_URL no esta definido. "
            "Formato esperado: postgresql://user:pass@host:5432/db"
        )

    # PostgresSaver usa un connection pool persistente que arrancamos aqui.
    saver_ctx = PostgresSaver.from_conn_string(dsn)
    saver = saver_ctx.__enter__()
    try:
        saver.setup()  # crea tablas si no existen (idempotente)
    except Exception as exc:  # pragma: no cover
        log.error("PostgresSaver.setup() fallo: %s", exc)
        saver_ctx.__exit__(type(exc), exc, exc.__traceback__)
        raise

    log.info("state_backends: PostgresSaver inicializado (dsn=%s...)", dsn[:30])
    # Guardamos el ctx para que no lo colecte el GC mientras el saver viva.
    saver._frigo_ctx = saver_ctx  # type: ignore[attr-defined]
    return saver


def get_checkpointer() -> Any:
    """Retorna el checkpointer activo (singleton).

    Eleccion:
      * `memory` (default) -> `MemorySaver`. Rapido, sin estado persistente.
      * `postgres` -> `PostgresSaver`. Escalable, persistente.

    Si algo sale mal creando el Postgres (DSN invalido, tablas no accesibles),
    el error se propaga. NO hacemos fallback silencioso a memoria porque eso
    ocultaria bugs criticos en produccion.
    """
    global _checkpointer_singleton
    if _checkpointer_singleton is not None:
        return _checkpointer_singleton

    backend = os.getenv("CHECKPOINTER_BACKEND", "memory").lower().strip()

    if backend == "memory":
        log.info("state_backends: usando MemorySaver (backend=memory)")
        _checkpointer_singleton = MemorySaver()
    elif backend == "postgres":
        _checkpointer_singleton = _build_postgres_saver()
    else:
        raise ValueError(
            f"CHECKPOINTER_BACKEND={backend!r} no es valido. Valores: memory|postgres"
        )

    return _checkpointer_singleton
````

## File: streaming.py
````python
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
````

## File: telegram_bot.py
````python
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
````

## File: tool_result.py
````python
"""
tool_result.py — Contrato estructurado de salida para todas las tools del agente.

Problema que resuelve (#3 en el checklist Senior):
  Antes cada tool devolvia texto libre. El LLM tenia que "adivinar" si hubo error,
  si los datos estaban vacios o si todo salio bien. Eso genera decisiones malas
  (p. ej. el LLM sigue preguntando datos cuando la BD fallo por timeout).

Solucion:
  Cada tool devuelve SIEMPRE un JSON string con la misma estructura:

    {
      "status":  "ok" | "empty" | "error",
      "code":    "<codigo_maquina_legible>",   // siempre presente, util para branching
      "message": "<texto humano para leer en voz alta o mostrar>",
      "data":    { ... }                         // payload estructurado (opcional)
    }

  El LLM puede leer `status` para decidir flujo (reintentar, pedir dato, informar)
  y el `message` para construir su respuesta al operario. Asi separamos
  "maquina-a-maquina" de "maquina-a-humano".
"""
from __future__ import annotations

import json
import logging
from typing import Any

log = logging.getLogger(__name__)


# Codigos de error estandarizados. Usarlos evita strings magicos regados por
# el codigo y permite que el LLM detecte patrones (timeout vs datos vacios).
CODE_OK = "OK"
CODE_EMPTY = "EMPTY"
CODE_TIMEOUT = "DB_TIMEOUT"
CODE_DB_ERROR = "DB_ERROR"
CODE_DB_UNAVAILABLE = "DB_UNAVAILABLE"
CODE_VALIDATION = "VALIDATION_ERROR"
CODE_NOT_FOUND = "NOT_FOUND"
CODE_HTTP_ERROR = "HTTP_ERROR"
CODE_INTERNAL = "INTERNAL_ERROR"


def _dump(payload: dict) -> str:
    """Serializa el payload a JSON. Nunca explota: si falla, degrada a error texto."""
    try:
        return json.dumps(payload, ensure_ascii=False, default=str)
    except (TypeError, ValueError) as exc:
        log.error("tool_result._dump fallo serializando: %s", exc)
        return json.dumps({
            "status": "error",
            "code": CODE_INTERNAL,
            "message": f"No pude serializar la respuesta: {exc}",
            "data": None,
        })


def ok(message: str, data: Any = None, code: str = CODE_OK) -> str:
    """Respuesta exitosa con datos y narrativa para el LLM.

    Args:
        message: Texto humano listo para que el LLM lo lea o lo reformule.
        data:    Payload estructurado (dict, list, numeros). Opcional.
        code:    Sub-codigo de exito. Por defecto "OK".
    """
    return _dump({
        "status": "ok",
        "code": code,
        "message": message,
        "data": data,
    })


def empty(message: str, data: Any = None) -> str:
    """Respuesta sin datos (la query se ejecuto bien pero no hubo resultados).

    El LLM debe diferenciar esto de un error: si esta vacio, puede sugerir
    cambiar los filtros. Si es error, debe informar fallo tecnico.
    """
    return _dump({
        "status": "empty",
        "code": CODE_EMPTY,
        "message": message,
        "data": data,
    })


def err(code: str, message: str, data: Any = None) -> str:
    """Respuesta de error. `code` permite al LLM decidir si reintentar o desistir."""
    return _dump({
        "status": "error",
        "code": code,
        "message": message,
        "data": data,
    })


def from_exception(exc: BaseException, context: str = "") -> str:
    """Convierte una excepcion en respuesta err(...) con el codigo correcto.

    Centraliza el mapping excepcion -> codigo de error para no regarlo por todas
    las tools. Ademas loguea con exc_info para debugging.
    """
    prefix = f"{context}: " if context else ""
    msg = f"{prefix}{exc.__class__.__name__} - {exc}"
    log.error("tool_result.from_exception %s", msg, exc_info=True)

    # Mapping por tipo
    import asyncio as _asyncio
    if isinstance(exc, _asyncio.TimeoutError):
        return err(CODE_TIMEOUT,
                   "La base de datos no respondio a tiempo. "
                   "Intenta de nuevo en unos segundos o informa al area tecnica.")

    try:
        import pyodbc as _pyodbc
        if isinstance(exc, (_pyodbc.OperationalError, _pyodbc.InterfaceError)):
            return err(CODE_DB_UNAVAILABLE,
                       "No pude conectarme a la base de datos. "
                       "Puede ser una caida momentanea, intenta de nuevo.")
        if isinstance(exc, _pyodbc.Error):
            return err(CODE_DB_ERROR, f"Error de base de datos: {exc}")
    except ImportError:  # pragma: no cover - pyodbc siempre esta en prod
        pass

    try:
        import httpx as _httpx
        if isinstance(exc, _httpx.HTTPStatusError):
            return err(CODE_HTTP_ERROR,
                       f"La API de formularios respondio {exc.response.status_code}.",
                       data={"status_code": exc.response.status_code,
                             "body": exc.response.text[:500]})
        if isinstance(exc, _httpx.HTTPError):
            return err(CODE_HTTP_ERROR, f"Error de red llamando a la API: {exc}")
    except ImportError:  # pragma: no cover
        pass

    return err(CODE_INTERNAL, msg)
````

## File: vectorstore.py
````python
"""
vectorstore.py - Gestiona ChromaDB para almacenar y consultar narrativas de lotes

Fase 3 del pipeline: Vectorizacion e Ingestion en ChromaDB
- Usa sentence-transformers (all-MiniLM-L6-v2) para embeddings
- Almacena super-documentos de trazabilidad por lote
- Permite busqueda semantica para RAG
"""
import chromadb
from chromadb.utils import embedding_functions

from config import CHROMA_PERSIST_DIR, CHROMA_COLLECTION, EMBEDDING_MODEL


def _get_client():
    """Crea o conecta al cliente ChromaDB persistente."""
    return chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)


def _get_ef():
    """Retorna la funcion de embedding de sentence-transformers."""
    return embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL
    )


def get_collection():
    """Obtiene o crea la coleccion de trazabilidad."""
    client = _get_client()
    ef = _get_ef()
    return client.get_or_create_collection(
        name=CHROMA_COLLECTION,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )


def ingest_narratives(narratives: dict[str, str]) -> int:
    """
    Ingesta todas las narrativas de lotes en ChromaDB.

    Args:
        narratives: {lote_num: narrative_string}

    Returns:
        Cantidad de documentos ingresados
    """
    collection = get_collection()

    # Preparar lotes en batches
    ids = []
    documents = []
    metadatas = []

    for lote_num, narrative in narratives.items():
        doc_id = f"lote_{lote_num}"
        ids.append(doc_id)
        documents.append(narrative)
        metadatas.append({
            "lote": lote_num,
            "tipo": "trazabilidad",
            "chars": len(narrative),
        })

    if not ids:
        print("[VECTORSTORE] No hay narrativas para ingestar.")
        return 0

    # Upsert (actualiza si ya existe, crea si no)
    # ChromaDB tiene limite de batch, procesamos en chunks de 50
    batch_size = 50
    total = 0
    for i in range(0, len(ids), batch_size):
        batch_ids = ids[i:i + batch_size]
        batch_docs = documents[i:i + batch_size]
        batch_meta = metadatas[i:i + batch_size]

        collection.upsert(
            ids=batch_ids,
            documents=batch_docs,
            metadatas=batch_meta,
        )
        total += len(batch_ids)
        print(f"[VECTORSTORE] Ingresados {total}/{len(ids)} documentos...")

    print(f"[VECTORSTORE] Total: {total} documentos en ChromaDB.")
    return total


def search_by_lote(query: str, n_results: int = 3) -> list[dict]:
    """
    Busca narrativas relevantes en ChromaDB por similitud semantica.

    Args:
        query: Texto de busqueda (ej. "que paso con el lote 260302")
        n_results: Cantidad de resultados

    Returns:
        Lista de resultados con {id, document, metadata, distance}
    """
    collection = get_collection()
    results = collection.query(
        query_texts=[query],
        n_results=n_results,
    )

    output = []
    if results and results["ids"]:
        for i, doc_id in enumerate(results["ids"][0]):
            output.append({
                "id": doc_id,
                "document": results["documents"][0][i],
                "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                "distance": results["distances"][0][i] if results["distances"] else 0,
            })

    return output


def get_lote_document(lote_num: str) -> str | None:
    """
    Obtiene el documento de un lote especifico por ID exacto.

    Args:
        lote_num: Numero de lote

    Returns:
        Narrativa del lote o None
    """
    collection = get_collection()
    doc_id = f"lote_{lote_num}"
    try:
        result = collection.get(ids=[doc_id])
        if result and result["documents"]:
            return result["documents"][0]
    except Exception:
        pass
    return None


def get_stats() -> dict:
    """Retorna estadisticas de la coleccion."""
    collection = get_collection()
    return {
        "total_documents": collection.count(),
        "collection_name": CHROMA_COLLECTION,
    }
````

## File: voice.py
````python
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
````
