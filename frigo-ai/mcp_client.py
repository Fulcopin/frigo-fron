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
