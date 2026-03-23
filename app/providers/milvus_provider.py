from app.providers.base import VectorDBProvider


class MilvusProvider(VectorDBProvider):
    name = "milvus"
    display_name = "Milvus"

    @classmethod
    def config_fields(cls):
        return [
            {"key": "host", "label": "Host", "type": "text", "required": True, "default": "localhost"},
            {"key": "port", "label": "Port", "type": "number", "required": True, "default": "19530"},
            {"key": "collection_name", "label": "Collection Name", "type": "text", "required": True},
            {"key": "vector_field", "label": "Vector Field", "type": "text", "required": False, "default": "embedding"},
            {"key": "output_fields", "label": "Output Fields (comma-separated)", "type": "text", "required": False, "default": "text"},
        ]

    def search(self, query_vector, config, top_k=5):
        from pymilvus import connections, Collection
        connections.connect(host=config.get("host", "localhost"), port=int(config.get("port", 19530)))
        collection = Collection(config["collection_name"])
        collection.load()
        output_fields = [f.strip() for f in config.get("output_fields", "text").split(",")]
        results = collection.search(
            data=[query_vector],
            anns_field=config.get("vector_field", "embedding"),
            param={"metric_type": "COSINE", "params": {"nprobe": 10}},
            limit=top_k,
            output_fields=output_fields,
        )
        return [
            {
                "id": str(hit.id),
                "score": round(hit.score, 4),
                "metadata": {f: hit.entity.get(f) for f in output_fields},
            }
            for hit in results[0]
        ]
