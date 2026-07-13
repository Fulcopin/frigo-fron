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
