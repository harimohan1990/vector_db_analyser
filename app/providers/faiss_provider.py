from app.providers.base import VectorDBProvider


class FaissProvider(VectorDBProvider):
    name = "faiss"
    display_name = "FAISS"

    @classmethod
    def config_fields(cls):
        return [
            {"key": "index_path", "label": "Index File Path (.faiss)", "type": "text", "required": True},
            {"key": "metadata_path", "label": "Metadata JSON Path (optional)", "type": "text", "required": False},
        ]

    def search(self, query_vector, config, top_k=5):
        import faiss, numpy as np, json, os
        index = faiss.read_index(config["index_path"])
        query = np.array([query_vector], dtype=np.float32)
        faiss.normalize_L2(query)
        distances, indices = index.search(query, top_k)

        metadata_list = []
        if config.get("metadata_path") and os.path.exists(config["metadata_path"]):
            with open(config["metadata_path"]) as f:
                metadata_list = json.load(f)

        return [
            {
                "id": str(indices[0][i]),
                "score": round(float(distances[0][i]), 4),
                "metadata": metadata_list[indices[0][i]] if metadata_list and indices[0][i] < len(metadata_list) else {},
            }
            for i in range(len(indices[0])) if indices[0][i] != -1
        ]
