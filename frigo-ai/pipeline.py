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
