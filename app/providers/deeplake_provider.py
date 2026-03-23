from app.providers.base import VectorDBProvider


class DeepLakeProvider(VectorDBProvider):
    name = "deeplake"
    display_name = "Deep Lake"

    @classmethod
    def config_fields(cls):
        return [
            {"key": "dataset_path", "label": "Dataset Path", "type": "text", "required": True,
             "placeholder": "hub://org/dataset or ./local"},
            {"key": "token", "label": "Activeloop Token (for hub://)", "type": "password", "required": False},
            {"key": "embedding_tensor", "label": "Embedding Tensor", "type": "text", "required": False, "default": "embedding"},
            {"key": "text_tensor", "label": "Text Tensor", "type": "text", "required": False, "default": "text"},
        ]

    def search(self, query_vector, config, top_k=5):
        import deeplake, numpy as np
        ds = deeplake.load(config["dataset_path"], token=config.get("token"))
        emb_tensor = config.get("embedding_tensor", "embedding")
        txt_tensor = config.get("text_tensor", "text")
        embeddings = ds[emb_tensor].numpy()
        query = np.array(query_vector)
        norms = np.linalg.norm(embeddings, axis=1) * np.linalg.norm(query)
        scores = (embeddings @ query) / (norms + 1e-9)
        top_indices = np.argsort(scores)[::-1][:top_k]
        return [
            {
                "id": str(int(idx)),
                "score": round(float(scores[idx]), 4),
                "metadata": {"text": str(ds[txt_tensor][int(idx)].numpy())},
            }
            for idx in top_indices
        ]
