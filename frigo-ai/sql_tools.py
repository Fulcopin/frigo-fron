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
import re
import time
import unicodedata
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
    template_id: str,
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
        template_id: ID numerico del template como texto (de obtener_esquema_formulario_tool).
        json_datos:  JSON string con claves "header" y "body".
        usuario:     Nombre del operador que dicta el registro.
    """
    # Tolerante: los LLM a veces mandan el numero como texto
    tid_s = str(template_id).strip()
    if not tid_s.isdigit():
        return err(CODE_VALIDATION, f"template_id invalido: '{template_id}'. Debe ser el ID numerico del template.")
    return await _guardar_borrador(int(tid_s), json_datos, usuario)


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
    limite: str = "50",
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

    # Tolerante: acepta el limite como texto ("50") o numero
    limite = int(str(limite).strip()) if str(limite).strip().isdigit() else 50
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


# ---------------------------------------------------------------------------
# TOOL 10: analizar_rendimiento_tool
#
# Analiza el RENDIMIENTO (yield) de produccion por rango de fechas.
# Fuentes de datos, en orden de confianza:
#   1. Campos/columnas cuyo nombre contiene "rendimiento" o "rend" → % directo.
#   2. Pares peso entrada/salida en el mismo formulario → rendimiento calculado.
# Agrega por dia, por formulario y por producto para responder preguntas como
# "cual fue el rendimiento del 5 de julio" o "compara el rendimiento de esta
# semana con la anterior".
# ---------------------------------------------------------------------------

_REND_KEYWORDS = ("rendimiento", "rend.", "rend ", "% rend", "yield")
_PESO_ENTRADA_KEYWORDS = (
    "peso recibido", "peso entrada", "peso bruto", "peso inicial",
    "peso materia", "lbs recibidas", "libras recibidas", "cantidad recibida",
    "entrada (", "peso rmp",
)
_PESO_SALIDA_KEYWORDS = (
    "peso neto", "peso salida", "peso final", "peso procesado",
    "producto terminado", "lbs procesadas", "libras procesadas",
    "salida (", "peso pt",
)


def _parse_num(val) -> float | None:
    """Convierte un valor de celda a float. None si no es numerico."""
    try:
        s = str(val).replace(",", ".").replace("%", "").replace("°", "").strip()
        if not s:
            return None
        return float(s)
    except (ValueError, TypeError):
        return None


def _match_keywords(name: str, keywords: tuple) -> bool:
    low = (name or "").lower()
    return any(k in low for k in keywords)


def _normalizar_rendimiento(v: float) -> float | None:
    """Normaliza a porcentaje. Valores 0-1.5 se asumen fraccion (0.85 → 85%).
    Descarta valores absurdos (<=0 o >120%)."""
    if v is None:
        return None
    pct = v * 100 if 0 < v <= 1.5 else v
    if pct <= 0 or pct > 120:
        return None
    return pct


@tool
async def analizar_rendimiento_tool(
    fecha_desde: str = "",
    fecha_hasta: str = "",
    template_codigo: str = "",
    producto: str = "",
    ultimos_dias: str = "",
) -> str:
    """Analiza el rendimiento de produccion (yield %) en un rango de fechas:
    promedio/min/max, serie por dia, mejor y peor dia, desglose por formulario
    y producto. Usa campos de rendimiento y pares peso entrada/salida.
    JSON {status, message, data}.

    Args:
        fecha_desde: YYYY-MM-DD. Vacio = ultimos 30 dias.
        fecha_hasta: YYYY-MM-DD. Vacio = hoy.
        template_codigo: Opcional, limitar a un formulario (ej. 'FOR-PD-04').
        producto: Opcional, filtrar por producto/especie.
        ultimos_dias: Dias hacia atras, como texto (ej. "15"). Preferir para rangos relativos en vez de fechas.
    """
    dias_rel = int(str(ultimos_dias).strip()) if str(ultimos_dias).strip().isdigit() else 0
    _cache_key = f"rendimiento:{fecha_desde}:{fecha_hasta}:{template_codigo}:{producto}:{dias_rel}"
    _cached = _cache_get(_cache_key)
    if _cached is not None:
        return _cached

    def _sync():
        conn = _get_conn()
        cur = conn.cursor()
        filters = ""
        params: list = []
        if dias_rel and not fecha_desde:
            filters += " AND ff.CreatedAt >= DATEADD(day, -?, GETDATE())"
            params.append(dias_rel)
        elif fecha_desde:
            filters += " AND ff.CreatedAt >= ?"
            params.append(fecha_desde)
        else:
            filters += " AND ff.CreatedAt >= DATEADD(day, -30, GETDATE())"
        if fecha_hasta:
            filters += " AND ff.CreatedAt < DATEADD(day, 1, CONVERT(date, ?))"
            params.append(fecha_hasta)
        if template_codigo:
            filters += " AND t.Codigo = ?"
            params.append(template_codigo.upper())

        cur.execute(
            f"""SELECT ff.FormID, ff.CreatedAt, ff.TipoProducto,
                       ff.HeaderData, ff.BodyData,
                       t.Codigo as TemplateCodigo, t.Nombre as TemplateNombre
                FROM FilledForms ff
                JOIN Templates t ON ff.TemplateID = t.TemplateID
                WHERE 1=1 {filters}
                ORDER BY ff.CreatedAt ASC""",
            params,
        )
        rows = _fetchall(cur)
        conn.close()
        return rows

    try:
        rows = await _run_sql(_sync, op_name="analizar_rendimiento")
    except Exception as exc:
        return from_exception(exc, "analizar_rendimiento")

    periodo = (f"ultimos {dias_rel} dias" if dias_rel and not fecha_desde
               else f"{fecha_desde or 'ultimos 30 dias'} al {fecha_hasta or 'hoy'}")

    # muestras: lista de dicts {pct, fecha (date str), template, producto, fuente}
    muestras: list[dict] = []

    for row in rows:
        header = _safe_json(row["HeaderData"]) or {}
        body = _safe_json(row["BodyData"]) or []
        prod = (row["TipoProducto"] or header.get("Tipo de Producto")
                or header.get("Producto") or "").strip()
        if producto and producto.lower() not in prod.lower():
            # Filtro por producto: tambien buscar en header completo
            hdr_texto = " ".join(str(v) for v in header.values()).lower()
            if producto.lower() not in hdr_texto:
                continue
        fecha_dia = str(row["CreatedAt"])[:10]
        tmpl = row["TemplateCodigo"]

        def _registrar(pct: float | None, fuente: str):
            pct_norm = _normalizar_rendimiento(pct)
            if pct_norm is not None:
                muestras.append({
                    "pct": pct_norm, "fecha": fecha_dia,
                    "template": tmpl, "producto": prod or "N/A", "fuente": fuente,
                })

        # 1) Campos de rendimiento directo en el header
        for k, v in header.items():
            if _match_keywords(k, _REND_KEYWORDS):
                _registrar(_parse_num(v), f"header:{k}")

        # 2) Columnas de rendimiento y pares entrada/salida en tablas del body
        if isinstance(body, list):
            for element in body:
                if not isinstance(element, dict):
                    continue
                data_rows = element.get("data") or element.get("rows") or []
                if not isinstance(data_rows, list):
                    continue
                for data_row in data_rows:
                    if not isinstance(data_row, dict):
                        continue
                    entrada = salida = None
                    for col, val in data_row.items():
                        if _match_keywords(col, _REND_KEYWORDS):
                            _registrar(_parse_num(val), f"tabla:{col}")
                        elif _match_keywords(col, _PESO_ENTRADA_KEYWORDS):
                            n = _parse_num(val)
                            if n and n > 0:
                                entrada = n
                        elif _match_keywords(col, _PESO_SALIDA_KEYWORDS):
                            n = _parse_num(val)
                            if n and n > 0:
                                salida = n
                    # Rendimiento calculado = salida / entrada
                    if entrada and salida and entrada > 0:
                        _registrar(salida / entrada * 100, "calculado:salida/entrada")

    if not muestras:
        result = empty(
            f"No se encontraron datos de rendimiento en el periodo {periodo}"
            + (f" para {template_codigo}" if template_codigo else "")
            + (f" del producto '{producto}'" if producto else "")
            + ". Verifica que los formularios tengan campos de rendimiento o pesos de entrada/salida.",
            data={"periodo": periodo, "total_muestras": 0},
        )
        return result

    # --- AGREGACIONES ---
    def _stats(vals: list[float]) -> dict:
        return {
            "n": len(vals),
            "prom": round(sum(vals) / len(vals), 2),
            "min": round(min(vals), 2),
            "max": round(max(vals), 2),
        }

    todas = [m["pct"] for m in muestras]
    global_stats = _stats(todas)

    por_dia: dict[str, list[float]] = {}
    por_template: dict[str, list[float]] = {}
    por_producto: dict[str, list[float]] = {}
    for m in muestras:
        por_dia.setdefault(m["fecha"], []).append(m["pct"])
        por_template.setdefault(m["template"], []).append(m["pct"])
        por_producto.setdefault(m["producto"], []).append(m["pct"])

    serie_dias = [
        {"fecha": d, **_stats(vals)} for d, vals in sorted(por_dia.items())
    ]
    mejor_dia = max(serie_dias, key=lambda x: x["prom"])
    peor_dia = min(serie_dias, key=lambda x: x["prom"])

    lines = [
        f"ANALISIS DE RENDIMIENTO — {periodo}",
        f"Muestras analizadas: {global_stats['n']}"
        + (f" | Formulario: {template_codigo}" if template_codigo else "")
        + (f" | Producto: {producto}" if producto else ""),
        "",
        f"RENDIMIENTO GLOBAL: promedio {global_stats['prom']}%"
        f" (min {global_stats['min']}% / max {global_stats['max']}%)",
        "",
        f"MEJOR DIA:  {mejor_dia['fecha']} con {mejor_dia['prom']}% promedio ({mejor_dia['n']} muestras)",
        f"PEOR DIA:   {peor_dia['fecha']} con {peor_dia['prom']}% promedio ({peor_dia['n']} muestras)",
        "",
        "SERIE POR DIA:",
    ]
    for s in serie_dias[-15:]:
        lines.append(f"  {s['fecha']}: prom {s['prom']}%  (min {s['min']} / max {s['max']} / n={s['n']})")
    if len(serie_dias) > 15:
        lines.insert(len(lines) - 15, f"  ... mostrando los ultimos 15 de {len(serie_dias)} dias.")

    if len(por_template) > 1:
        lines.append("")
        lines.append("POR FORMULARIO:")
        for tmpl, vals in sorted(por_template.items(), key=lambda x: -len(x[1])):
            st = _stats(vals)
            lines.append(f"  {tmpl}: prom {st['prom']}% (n={st['n']})")

    if len(por_producto) > 1:
        lines.append("")
        lines.append("POR PRODUCTO:")
        for prod_k, vals in sorted(por_producto.items(), key=lambda x: -len(x[1]))[:8]:
            st = _stats(vals)
            lines.append(f"  {prod_k}: prom {st['prom']}% (n={st['n']})")

    result = ok("\n".join(lines), data={
        "periodo": periodo,
        "total_muestras": global_stats["n"],
        "global": global_stats,
        "mejor_dia": mejor_dia,
        "peor_dia": peor_dia,
        "serie_por_dia": serie_dias,
        "por_template": {k: _stats(v) for k, v in por_template.items()},
        "por_producto": {k: _stats(v) for k, v in por_producto.items()},
    })
    _cache_set(_cache_key, result)
    return result


# ---------------------------------------------------------------------------
# TOOL 11: calcular_formula_tool — CALCULOS PERSONALIZADOS entre columnas
#
# El operario define su propia formula con columnas de cualquier formulario:
#   "[Peso Neto] / [Peso Recibido] * 100"
#   "SUM([Cantidad]) - SUM([Devoluciones])"
# La herramienta extrae los valores reales de FilledForms, resuelve los nombres
# de columna con matching difuso (acentos/mayusculas/espacios), evalua la
# expresion de forma SEGURA (solo aritmetica) y devuelve resultado global +
# serie por dia.
# ---------------------------------------------------------------------------

_FORMULA_TOKEN_RE = re.compile(r"\[([^\]]+)\]")
_AGG_RE = re.compile(
    r"(SUM|SUMA|AVG|PROM|PROMEDIO|MIN|MAX|COUNT|CONTAR)\s*\(\s*\[([^\]]+)\]\s*\)",
    re.IGNORECASE,
)
_SAFE_EXPR_RE = re.compile(r"^[\d\s+\-*/().]+$")


def _norm_txt(s) -> str:
    """Normaliza texto: minusculas, sin acentos, espacios colapsados."""
    s = unicodedata.normalize("NFD", str(s or "").lower().strip())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s)


def _eval_seguro(expr: str):
    """Evalua una expresion aritmetica pura. Ya sin nombres de columna.
    Valida con regex que solo contenga numeros y operadores basicos."""
    expr = expr.strip()
    if not expr or not _SAFE_EXPR_RE.match(expr):
        raise ValueError(f"Expresion no valida tras sustituir columnas: '{expr}'")
    try:
        return eval(expr, {"__builtins__": {}}, {})  # noqa: S307 — validado por _SAFE_EXPR_RE
    except ZeroDivisionError:
        return None


def _extraer_registros(rows) -> tuple[list[dict], set]:
    """Convierte FilledForms en registros numericos por fila de tabla.

    Cada registro: {"fecha": "YYYY-MM-DD", "valores": {col_normalizada: float}}.
    Los campos numericos del header se fusionan en cada fila (fallback).
    Devuelve (registros, columnas_vistas) para poder sugerir columnas.
    """
    registros: list[dict] = []
    columnas_vistas: set = set()
    for row in rows:
        header = _safe_json(row["HeaderData"]) or {}
        body = _safe_json(row["BodyData"]) or []
        fecha_dia = str(row["CreatedAt"])[:10]
        hdr_num: dict[str, float] = {}
        for k, v in header.items():
            n = _parse_num(v)
            if n is not None:
                hdr_num[_norm_txt(k)] = n
                columnas_vistas.add(str(k))
        filas_form = 0
        if isinstance(body, list):
            for element in body:
                if not isinstance(element, dict):
                    continue
                data_rows = element.get("data") or element.get("rows") or []
                if not isinstance(data_rows, list):
                    continue
                for data_row in data_rows:
                    if not isinstance(data_row, dict):
                        continue
                    rec = dict(hdr_num)
                    tiene = False
                    for col, val in data_row.items():
                        n = _parse_num(val)
                        if n is not None:
                            rec[_norm_txt(col)] = n
                            columnas_vistas.add(str(col))
                            tiene = True
                    if tiene:
                        registros.append({"fecha": fecha_dia, "valores": rec})
                        filas_form += 1
        # Formulario sin filas numericas pero con header numerico → 1 registro
        if filas_form == 0 and hdr_num:
            registros.append({"fecha": fecha_dia, "valores": hdr_num})
    return registros, columnas_vistas


def _resolver_col(nombre: str, registros: list[dict]) -> str | None:
    """Resuelve un nombre de columna del usuario a la clave normalizada real.
    1) match exacto  2) match por contencion (el mas frecuente)."""
    objetivo = _norm_txt(nombre)
    for r in registros:
        if objetivo in r["valores"]:
            return objetivo
    candidatos: dict[str, int] = {}
    for r in registros:
        for k in r["valores"]:
            if objetivo in k or k in objetivo:
                candidatos[k] = candidatos.get(k, 0) + 1
    if candidatos:
        return max(candidatos, key=lambda k: candidatos[k])
    return None


def _stats_vals(vals: list[float]) -> dict:
    return {
        "n": len(vals),
        "suma": round(sum(vals), 3),
        "prom": round(sum(vals) / len(vals), 3),
        "min": round(min(vals), 3),
        "max": round(max(vals), 3),
    }


@tool
async def calcular_formula_tool(
    formula: str,
    template_codigo: str = "",
    fecha_desde: str = "",
    fecha_hasta: str = "",
    ultimos_dias: str = "",
) -> str:
    """Evalua una formula personalizada sobre columnas de los formularios.
    Columnas entre corchetes: "[Peso Neto] / [Peso Recibido] * 100" (por fila)
    o "SUM([Cantidad]) - SUM([Devoluciones])" (agregada: SUM/PROM/MIN/MAX/COUNT).
    Match difuso de nombres; si una columna no existe, devuelve las disponibles.
    Retorna resultado global + serie por dia. JSON {status, message, data}.

    Args:
        formula: Expresion con columnas entre corchetes.
        template_codigo: Opcional, limitar a un formulario (ej. 'FOR-PD-04').
        fecha_desde: YYYY-MM-DD. Vacio = ultimos 30 dias.
        fecha_hasta: YYYY-MM-DD. Vacio = hoy.
        ultimos_dias: Dias hacia atras, como texto (ej. "15"). Preferir para rangos relativos en vez de fechas.
    """
    formula = (formula or "").strip()
    if not formula or len(formula) > 300:
        return err(CODE_VALIDATION, "Formula vacia o demasiado larga (max 300 caracteres).")
    if not _FORMULA_TOKEN_RE.search(formula):
        return err(
            CODE_VALIDATION,
            "La formula debe referenciar columnas entre corchetes. "
            "Ejemplo: [Peso Neto] / [Peso Recibido] * 100",
        )
    dias_rel = int(str(ultimos_dias).strip()) if str(ultimos_dias).strip().isdigit() else 0

    def _sync():
        conn = _get_conn()
        cur = conn.cursor()
        filters = ""
        params: list = [300]
        if template_codigo:
            filters += " AND t.Codigo = ?"
            params.append(template_codigo.upper())
        if dias_rel and not fecha_desde:
            filters += " AND ff.CreatedAt >= DATEADD(day, -?, GETDATE())"
            params.append(dias_rel)
        elif fecha_desde:
            filters += " AND ff.CreatedAt >= ?"
            params.append(fecha_desde)
        else:
            filters += " AND ff.CreatedAt >= DATEADD(day, -30, GETDATE())"
        if fecha_hasta:
            filters += " AND ff.CreatedAt < DATEADD(day, 1, CONVERT(date, ?))"
            params.append(fecha_hasta)
        cur.execute(
            f"""SELECT TOP (?) ff.CreatedAt, ff.HeaderData, ff.BodyData,
                       t.Codigo as TemplateCodigo
                FROM FilledForms ff
                JOIN Templates t ON ff.TemplateID = t.TemplateID
                WHERE 1=1 {filters}
                ORDER BY ff.CreatedAt ASC""",
            params,
        )
        rows = _fetchall(cur)
        conn.close()
        return rows

    try:
        rows = await _run_sql(_sync, op_name="calcular_formula")
    except Exception as exc:
        return from_exception(exc, "calcular_formula")

    periodo = (f"ultimos {dias_rel} dias" if dias_rel and not fecha_desde
               else f"{fecha_desde or 'ultimos 30 dias'} al {fecha_hasta or 'hoy'}")
    registros, columnas_vistas = _extraer_registros(rows)
    if not registros:
        return empty(
            f"No hay datos numericos en el periodo {periodo}"
            + (f" para {template_codigo}" if template_codigo else "") + ".",
            data={"periodo": periodo},
        )

    columnas_disponibles = sorted(columnas_vistas)[:60]
    usadas: dict[str, str] = {}
    faltantes: list[str] = []

    _AGG_FUNCS = {
        "SUM": sum, "SUMA": sum,
        "AVG": lambda v: sum(v) / len(v), "PROM": lambda v: sum(v) / len(v),
        "PROMEDIO": lambda v: sum(v) / len(v),
        "MIN": min, "MAX": max,
        "COUNT": len, "CONTAR": len,
    }

    def _evaluar_sobre(subset: list[dict]):
        """Evalua la formula sobre un subconjunto de registros.
        Modo agregado si hay SUM()/AVG()/...; si no, por fila (lista de resultados)."""
        if _AGG_RE.search(formula):
            def _sub(m):
                func = m.group(1).upper()
                key = _resolver_col(m.group(2), registros)
                if key is None:
                    if m.group(2) not in faltantes:
                        faltantes.append(m.group(2))
                    return "0"
                usadas[m.group(2)] = key
                vals = [r["valores"][key] for r in subset if key in r["valores"]]
                if not vals:
                    return "0"
                return repr(round(float(_AGG_FUNCS[func](vals)), 6))
            expr = _AGG_RE.sub(_sub, formula)
            # No deben quedar corchetes sueltos fuera de agregados
            expr = _FORMULA_TOKEN_RE.sub("0", expr)
            return [_eval_seguro(expr)]
        # Modo por fila
        tokens = _FORMULA_TOKEN_RE.findall(formula)
        claves = {}
        for tk in tokens:
            key = _resolver_col(tk, registros)
            if key is None:
                if tk not in faltantes:
                    faltantes.append(tk)
            else:
                usadas[tk] = key
                claves[tk] = key
        if faltantes:
            return []
        resultados = []
        for r in subset:
            if not all(claves[tk] in r["valores"] for tk in tokens):
                continue
            expr = formula
            for tk in tokens:
                expr = expr.replace(f"[{tk}]", repr(r["valores"][claves[tk]]))
            try:
                v = _eval_seguro(expr)
            except ValueError:
                return []
            if v is not None:
                resultados.append(float(v))
        return resultados

    try:
        resultados_globales = [v for v in _evaluar_sobre(registros) if v is not None]
    except ValueError as ve:
        return err(CODE_VALIDATION, f"No pude evaluar la formula: {ve}")

    if faltantes:
        # Sugerir primero las columnas mas parecidas (comparten alguna palabra)
        sugerencias: list[str] = []
        for f in faltantes:
            palabras = [w for w in _norm_txt(f).split() if len(w) >= 3]
            for c in sorted(columnas_vistas):
                cn = _norm_txt(c)
                if any(w[:5] in cn for w in palabras) and c not in sugerencias:
                    sugerencias.append(c)
        listado = sugerencias[:15] if sugerencias else columnas_disponibles[:40]
        prefijo = "Columnas parecidas encontradas" if sugerencias else "Columnas numericas disponibles"
        return err(
            CODE_NOT_FOUND,
            f"No encontre estas columnas: {', '.join(faltantes)}. "
            f"{prefijo}: {', '.join(listado)}",
        )
    if not resultados_globales:
        return empty(
            f"La formula no produjo resultados (ninguna fila tiene todas las columnas juntas) en {periodo}. "
            f"Columnas numericas disponibles: {', '.join(columnas_disponibles[:40])}. "
            "Sugerencia: usa columnas del MISMO formulario (filtra con template_codigo).",
            data={"periodo": periodo, "columnas_disponibles": columnas_disponibles},
        )

    # Serie por dia
    por_dia: dict[str, list[dict]] = {}
    for r in registros:
        por_dia.setdefault(r["fecha"], []).append(r)
    serie = []
    for dia, subset in sorted(por_dia.items()):
        vals = [v for v in _evaluar_sobre(subset) if v is not None]
        if vals:
            serie.append({"fecha": dia, **_stats_vals([float(v) for v in vals])})

    es_agregada = bool(_AGG_RE.search(formula))
    stats = _stats_vals([float(v) for v in resultados_globales])
    mapeo = "; ".join(f"[{p}] → \"{r}\"" for p, r in usadas.items())

    lines = [
        f"FORMULA: {formula}",
        f"Periodo: {periodo}" + (f" | Formulario: {template_codigo}" if template_codigo else " | Todos los formularios"),
        f"Columnas usadas: {mapeo}",
        "",
    ]
    if es_agregada:
        lines.append(f"RESULTADO: {stats['suma'] if stats['n'] == 1 else stats['prom']}")
    else:
        lines.append(
            f"RESULTADO ({stats['n']} filas evaluadas): promedio {stats['prom']}"
            f" | suma {stats['suma']} | min {stats['min']} | max {stats['max']}"
        )
    if serie:
        lines.append("")
        lines.append("SERIE POR DIA:")
        for s in serie[-20:]:
            valor = s["suma"] if es_agregada else s["prom"]
            lines.append(f"  {s['fecha']}: {valor}  (n={s['n']})")

    return ok("\n".join(lines), data={
        "formula": formula,
        "periodo": periodo,
        "modo": "agregada" if es_agregada else "por_fila",
        "columnas_usadas": usadas,
        "resultado": stats,
        "serie_por_dia": serie,
    })


# ---------------------------------------------------------------------------
# listar_campos_templates — catálogo de formularios con sus columnas/campos
# (NO es un tool del agente: alimenta el selector de "consulta guiada" del
#  frontend via GET /api/ai/templates/fields)
# ---------------------------------------------------------------------------

_TIPOS_NUMERICOS = {"number", "formula", "calculated", "temperature", "decimal", "integer"}


async def listar_campos_templates() -> list[dict]:
    """Devuelve todos los templates activos con sus campos de header y columnas
    de tablas, marcando cuáles son numéricos (aptos para cálculos)."""
    _cached = _cache_get("campos_templates")
    if _cached is not None:
        return json.loads(_cached)

    def _sync():
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute(
            """SELECT TemplateID, Codigo, Nombre, Proceso, HeaderFields, BodyElements
               FROM Templates
               WHERE ISNULL(IsObsolete, 0) = 0
               ORDER BY Codigo"""
        )
        rows = _fetchall(cur)
        conn.close()
        return rows

    rows = await _run_sql(_sync, op_name="listar_campos_templates")

    catalogo: list[dict] = []
    for row in rows:
        header_fields = _safe_json(row.get("HeaderFields")) or []
        body_elements = _safe_json(row.get("BodyElements")) or []
        campos: list[dict] = []
        vistos: set = set()

        def _add(nombre, tipo, origen):
            n = str(nombre or "").strip()
            if not n or n.lower() in vistos:
                return
            vistos.add(n.lower())
            t = str(tipo or "text").lower()
            campos.append({
                "nombre": n,
                "tipo": t,
                "numerico": t in _TIPOS_NUMERICOS,
                "origen": origen,
            })

        if isinstance(header_fields, list):
            for f in header_fields:
                if isinstance(f, dict):
                    _add(f.get("label") or f.get("name"), f.get("type"), "header")
        if isinstance(body_elements, list):
            for el in body_elements:
                if not isinstance(el, dict):
                    continue
                for col in el.get("columns") or []:
                    if isinstance(col, dict):
                        _add(col.get("label") or col.get("name"), col.get("type"), "tabla")
                for f in el.get("fields") or []:
                    if isinstance(f, dict):
                        _add(f.get("label") or f.get("name"), f.get("type"), "seccion")

        catalogo.append({
            "templateID": row.get("TemplateID"),
            "codigo": row.get("Codigo"),
            "nombre": row.get("Nombre"),
            "proceso": row.get("Proceso") or "",
            "campos": campos,
        })

    _cache_set("campos_templates", json.dumps(catalogo, ensure_ascii=False))
    return catalogo


# ---------------------------------------------------------------------------
# TOOL 12: revisar_observaciones_tool — novedades escritas por los operarios
# ---------------------------------------------------------------------------

_OBS_TRIVIALES = {
    "", "-", "--", ".", "n/a", "na", "n.a.", "ninguna", "ninguno", "nada",
    "sin novedad", "sin novedades", "sin observaciones", "ok", "todo bien",
    "todo ok", "normal", "x",
}


@tool
async def revisar_observaciones_tool(
    fecha_desde: str = "",
    fecha_hasta: str = "",
    template_codigo: str = "",
    palabra_clave: str = "",
    ultimos_dias: str = "",
) -> str:
    """Recopila las observaciones y novedades con contenido real escritas por
    los operarios en los formularios de un periodo (filtra "sin novedad"/"ok").
    Devuelve fecha, formulario, autor y texto. JSON {status, message, data}.

    Args:
        fecha_desde: YYYY-MM-DD. Vacio = ultimos 15 dias.
        fecha_hasta: YYYY-MM-DD. Vacio = hoy.
        template_codigo: Opcional, limitar a un formulario (ej. 'FOR-CC-11').
        palabra_clave: Opcional, solo observaciones que mencionen esta palabra.
        ultimos_dias: Dias hacia atras, como texto (ej. "15"). Preferir para rangos relativos en vez de fechas.
    """
    dias_rel = int(str(ultimos_dias).strip()) if str(ultimos_dias).strip().isdigit() else 0

    def _sync():
        conn = _get_conn()
        cur = conn.cursor()
        filters = ""
        params: list = [400]
        if template_codigo:
            filters += " AND t.Codigo = ?"
            params.append(template_codigo.upper())
        if dias_rel and not fecha_desde:
            filters += " AND ff.CreatedAt >= DATEADD(day, -?, GETDATE())"
            params.append(dias_rel)
        elif fecha_desde:
            filters += " AND ff.CreatedAt >= ?"
            params.append(fecha_desde)
        else:
            filters += " AND ff.CreatedAt >= DATEADD(day, -15, GETDATE())"
        if fecha_hasta:
            filters += " AND ff.CreatedAt < DATEADD(day, 1, CONVERT(date, ?))"
            params.append(fecha_hasta)
        cur.execute(
            f"""SELECT TOP (?) ff.FormID, ff.CreatedAt, ff.FilledBy, ff.Observaciones,
                       ff.HeaderData, ff.BodyData, t.Codigo as TemplateCodigo
                FROM FilledForms ff
                JOIN Templates t ON ff.TemplateID = t.TemplateID
                WHERE 1=1 {filters}
                ORDER BY ff.CreatedAt DESC""",
            params,
        )
        rows = _fetchall(cur)
        conn.close()
        return rows

    try:
        rows = await _run_sql(_sync, op_name="revisar_observaciones")
    except Exception as exc:
        return from_exception(exc, "revisar_observaciones")

    periodo = (f"ultimos {dias_rel} dias" if dias_rel and not fecha_desde
               else f"{fecha_desde or 'ultimos 15 dias'} al {fecha_hasta or 'hoy'}")
    clave_norm = _norm_txt(palabra_clave) if palabra_clave else ""

    hallazgos: list[dict] = []
    _vistos: set = set()  # (FormID, texto normalizado) → evita duplicados del mismo formulario

    def _agregar(texto, row):
        # Algunas observaciones vienen como dict: {"texto": "..."} o {"value": "..."}
        if isinstance(texto, dict):
            texto = texto.get("texto") or texto.get("value") or texto.get("text") or ""
        t = str(texto or "").strip()
        if len(t) < 3 or _norm_txt(t) in _OBS_TRIVIALES:
            return
        if clave_norm and clave_norm not in _norm_txt(t):
            return
        clave_dup = (row.get("FormID"), _norm_txt(t))
        if clave_dup in _vistos:
            return
        _vistos.add(clave_dup)
        hallazgos.append({
            "fecha": str(row["CreatedAt"])[:16].replace("T", " "),
            "formulario": row["TemplateCodigo"],
            "quien": (row["FilledBy"] or "").strip() or "N/A",
            "texto": t[:300],
        })

    for row in rows:
        _agregar(row["Observaciones"], row)
        header = _safe_json(row["HeaderData"]) or {}
        for k, v in header.items():
            kn = _norm_txt(k)
            if "observ" in kn or "novedad" in kn or "incidencia" in kn:
                _agregar(v, row)
        body = _safe_json(row["BodyData"]) or []
        if isinstance(body, list):
            for element in body:
                if not isinstance(element, dict):
                    continue
                # Elemento tipo observaciones (texto libre)
                if str(element.get("type", "")).lower() == "observaciones":
                    _agregar(element.get("value") or element.get("data") or "", row)
                    continue
                data_rows = element.get("data") or element.get("rows") or []
                if isinstance(data_rows, dict):
                    # seccion campos: {campo: valor}
                    for k, v in data_rows.items():
                        kn = _norm_txt(k)
                        if "observ" in kn or "novedad" in kn or "incidencia" in kn:
                            _agregar(v, row)
                    continue
                if not isinstance(data_rows, list):
                    continue
                for data_row in data_rows:
                    if not isinstance(data_row, dict):
                        continue
                    for col, val in data_row.items():
                        cn = _norm_txt(col)
                        if "observ" in cn or "novedad" in cn or "incidencia" in cn:
                            _agregar(val, row)

    if not hallazgos:
        return empty(
            f"No se encontraron observaciones con contenido en el periodo {periodo}"
            + (f" para {template_codigo}" if template_codigo else "")
            + (f" que mencionen '{palabra_clave}'" if palabra_clave else "") + ".",
            data={"periodo": periodo, "total": 0, "formularios_revisados": len(rows)},
        )

    por_form: dict[str, int] = {}
    for h in hallazgos:
        por_form[h["formulario"]] = por_form.get(h["formulario"], 0) + 1

    lines = [
        f"OBSERVACIONES Y NOVEDADES — {periodo}",
        f"Formularios revisados: {len(rows)} | Observaciones con contenido: {len(hallazgos)}"
        + (f" | Filtro: '{palabra_clave}'" if palabra_clave else ""),
        "",
    ]
    for h in hallazgos[:40]:
        lines.append(f"  [{h['fecha']}] {h['formulario']} — {h['quien']}: {h['texto']}")
    if len(hallazgos) > 40:
        lines.append(f"  ... y {len(hallazgos) - 40} observaciones mas.")
    lines.append("")
    lines.append("POR FORMULARIO: " + ", ".join(f"{k}={v}" for k, v in sorted(por_form.items(), key=lambda x: -x[1])))

    return ok("\n".join(lines), data={
        "periodo": periodo,
        "total": len(hallazgos),
        "formularios_revisados": len(rows),
        "por_formulario": por_form,
        "observaciones": hallazgos[:60],
    })


@tool
async def resumen_negocio_tool(
    fecha_desde: str = "",
    fecha_hasta: str = "",
) -> str:
    """Dashboard ejecutivo: KPIs del periodo — lotes completos vs con brechas
    de QC (4 etapas), alertas de temperatura, formularios por dia y por tipo,
    ranking de responsables y productos frecuentes. JSON {status, message, data}.

    Args:
        fecha_desde: YYYY-MM-DD. Vacio = ultimos 7 dias.
        fecha_hasta: YYYY-MM-DD. Vacio = hoy.
    """
    return await _resumen_negocio(fecha_desde, fecha_hasta)
