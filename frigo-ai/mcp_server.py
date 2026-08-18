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

@mcp.tool(name="rastrear_lote_tool")
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

@mcp.tool(name="obtener_esquema_formulario_tool")
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

@mcp.tool(name="guardar_borrador_tool")
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

@mcp.tool(name="listar_templates_tool")
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

@mcp.tool(name="consultar_formularios_tool")
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

@mcp.tool(name="estadisticas_formularios_tool")
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

@mcp.tool(name="analizar_datos_formulario_tool")
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

@mcp.tool(name="consultar_alertas_tool")
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


@mcp.tool(name="analizar_foto_etiqueta_tool")
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

@mcp.tool(name="obtener_formulario_completo_tool")
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


# --- Nuevas Herramientas Importadas de sql_tools ---
import sql_tools

@mcp.tool()
async def listar_lotes_tool(fecha_desde: str = "", fecha_hasta: str = "") -> str:
    """Lista los lotes de proceso activos o recientes."""
    return await sql_tools.listar_lotes_tool(fecha_desde, fecha_hasta)

@mcp.tool()
async def analizar_brecha_lote_tool(numero_lote: str) -> str:
    """Analiza si un lote esta completo en sus 4 etapas."""
    return await sql_tools.analizar_brecha_lote_tool(numero_lote)

@mcp.tool()
async def analizar_rendimiento_tool(
    fecha_desde: str = "",
    fecha_hasta: str = "",
    template_codigo: str = "",
    producto: str = ""
) -> str:
    """Analiza el rendimiento, mermas y saldos."""
    return await sql_tools.analizar_rendimiento_tool(fecha_desde, fecha_hasta, template_codigo, producto)

@mcp.tool()
async def calcular_formula_tool(
    formula: str,
    template_codigo: str = "",
    fecha_desde: str = "",
    fecha_hasta: str = ""
) -> str:
    """Calcula formulas matematicas sobre las columnas de la BD."""
    return await sql_tools.calcular_formula_tool(formula, template_codigo, fecha_desde, fecha_hasta)

@mcp.tool()
async def revisar_observaciones_tool(
    busqueda: str = "",
    template_codigo: str = "",
    fecha_desde: str = "",
    fecha_hasta: str = ""
) -> str:
    """Busca observaciones y novedades reportadas en los formularios."""
    return await sql_tools.revisar_observaciones_tool(busqueda, template_codigo, fecha_desde, fecha_hasta)

@mcp.tool()
async def resumen_negocio_tool(fecha_desde: str = "", fecha_hasta: str = "") -> str:
    """Da un resumen ejecutivo o dashboard general de la planta."""
    return await sql_tools.resumen_negocio_tool(fecha_desde, fecha_hasta)

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
