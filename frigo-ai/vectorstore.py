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
