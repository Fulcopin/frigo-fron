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
