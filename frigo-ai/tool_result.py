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
