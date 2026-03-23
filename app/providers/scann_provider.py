from app.providers.base import VectorDBProvider


class ScaNNProvider(VectorDBProvider):
    name = "scann"
    display_name = "ScaNN"

    @classmethod
    def config_fields(cls):
        return [
            {"key": "index_dir", "label": "Index Directory Path", "type": "text", "required": True},
            {"key": "metadata_path", "label": "Metadata JSON Path (optional)", "type": "text", "required": False},
        ]

    def search(self, query_vector, config, top_k=5):
        import scann, numpy as np, json, os
        searcher = scann.scann_ops_pybind.load_searcher(config["index_dir"])
        neighbors, distances = searcher.search(
            np.array(query_vector, dtype=np.float32), final_num_neighbors=top_k
        )
        metadata_list = []
        if config.get("metadata_path") and os.path.exists(config["metadata_path"]):
            with open(config["metadata_path"]) as f:
                metadata_list = json.load(f)
        return [
            {
                "id": str(neighbors[i]),
                "score": round(float(1 - distances[i]), 4),
                "metadata": metadata_list[neighbors[i]] if metadata_list and neighbors[i] < len(metadata_list) else {},
            }
            for i in range(len(neighbors))
        ]
