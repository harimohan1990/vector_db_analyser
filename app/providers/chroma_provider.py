from app.providers.base import VectorDBProvider


class ChromaProvider(VectorDBProvider):
    name = "chroma"
    display_name = "Chroma"

    @classmethod
    def config_fields(cls):
        return [
            {"key": "host", "label": "Host", "type": "text", "required": False, "default": "localhost"},
            {"key": "port", "label": "Port", "type": "number", "required": False, "default": "8000"},
            {"key": "collection_name", "label": "Collection Name", "type": "text", "required": True},
        ]

    def list_collections(self, config):
        import chromadb
        client = chromadb.HttpClient(
            host=config.get("host", "localhost"),
            port=int(config.get("port", 8000)),
        )
        cols = client.list_collections()
        result = []
        for c in cols:
            try:
                col = client.get_collection(c.name)
                vc = col.count()
            except Exception:
                vc = 0
            result.append({"name": c.name, "vector_count": vc, "dimension": "?", "status": "ready", "namespaces": []})
        return result

    def search(self, query_vector, config, top_k=5):
        import chromadb
        client = chromadb.HttpClient(
            host=config.get("host", "localhost"),
            port=int(config.get("port", 8000)),
        )
        collection = client.get_collection(config["collection_name"])
        results = collection.query(
            query_embeddings=[query_vector],
            n_results=top_k,
            include=["metadatas", "distances", "documents"],
        )
        matches = []
        for i, doc_id in enumerate(results["ids"][0]):
            meta = results["metadatas"][0][i] or {}
            if results.get("documents") and results["documents"][0][i]:
                meta["text"] = results["documents"][0][i]
            matches.append({
                "id": doc_id,
                "score": round(1 - results["distances"][0][i], 4),
                "metadata": meta,
            })
        return matches
