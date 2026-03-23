from app.providers.base import VectorDBProvider


class PineconeProvider(VectorDBProvider):
    name = "pinecone"
    display_name = "Pinecone"

    @classmethod
    def config_fields(cls):
        return [
            {"key": "api_key", "label": "API Key", "type": "password", "required": True},
            {"key": "index_name", "label": "Index Name", "type": "text", "required": True, "default": "quickstart-py"},
            {"key": "namespace", "label": "Namespace", "type": "text", "required": False, "default": ""},
        ]

    def list_collections(self, config):
        from pinecone import Pinecone
        pc = Pinecone(api_key=config["api_key"])
        indexes = pc.list_indexes()
        result = []
        for idx in indexes:
            name = idx.name if hasattr(idx, "name") else str(idx)
            try:
                stats = pc.Index(name).describe_index_stats()
                vc = stats.get("total_vector_count", 0)
                dim = stats.get("dimension", "?")
                ns_map = stats.get("namespaces", {})
                namespaces = list(ns_map.keys()) if ns_map else []
            except Exception:
                vc, dim, namespaces = 0, "?", []
            result.append({"name": name, "vector_count": vc, "dimension": dim,
                           "status": "ready", "namespaces": namespaces})
        return result

    def upsert(self, config, vectors):
        from pinecone import Pinecone
        pc = Pinecone(api_key=config["api_key"])
        index = pc.Index(config["index_name"])
        ns = config.get("namespace", "")
        index.upsert(vectors=vectors, namespace=ns)
        return {"upserted_count": len(vectors)}

    def search(self, query_vector, config, top_k=5):
        from pinecone import Pinecone
        pc = Pinecone(api_key=config["api_key"])
        index = pc.Index(config["index_name"])
        results = index.query(
            vector=query_vector,
            top_k=top_k,
            namespace=config.get("namespace", ""),
            include_metadata=True,
        )
        return [
            {"id": m["id"], "score": m["score"], "metadata": m.get("metadata") or {}}
            for m in results["matches"]
        ]
