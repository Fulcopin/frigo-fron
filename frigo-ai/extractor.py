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
