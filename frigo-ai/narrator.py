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
