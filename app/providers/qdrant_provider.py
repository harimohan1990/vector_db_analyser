from app.providers.base import VectorDBProvider


class QdrantProvider(VectorDBProvider):
    name = "qdrant"
    display_name = "Qdrant"

    @classmethod
    def config_fields(cls):
        return [
            {"key": "url", "label": "URL", "type": "text", "required": True, "default": "http://localhost:6333"},
            {"key": "api_key", "label": "API Key (optional)", "type": "password", "required": False},
            {"key": "collection_name", "label": "Collection Name", "type": "text", "required": True},
        ]

    def list_collections(self, config):
        from qdrant_client import QdrantClient
        client = QdrantClient(url=config["url"], api_key=config.get("api_key"))
        cols = client.get_collections().collections
        result = []
        for c in cols:
            try:
                info = client.get_collection(c.name)
                vc = info.vectors_count or 0
                dim = info.config.params.vectors.size if hasattr(info.config.params.vectors, "size") else "?"
            except Exception:
                vc, dim = 0, "?"
            result.append({"name": c.name, "vector_count": vc, "dimension": dim, "status": "ready", "namespaces": []})
        return result

    def upsert(self, config, vectors):
        from qdrant_client import QdrantClient
        from qdrant_client.models import PointStruct
        client = QdrantClient(url=config["url"], api_key=config.get("api_key"))
        points = [PointStruct(id=v["id"], vector=v["values"], payload=v.get("metadata", {})) for v in vectors]
        client.upsert(collection_name=config["collection_name"], points=points)
        return {"upserted_count": len(vectors)}

    def search(self, query_vector, config, top_k=5):
        from qdrant_client import QdrantClient
        client = QdrantClient(url=config["url"], api_key=config.get("api_key"))
        results = client.search(
            collection_name=config["collection_name"],
            query_vector=query_vector,
            limit=top_k,
            with_payload=True,
        )
        return [
            {"id": str(r.id), "score": round(r.score, 4), "metadata": r.payload or {}}
            for r in results
        ]
