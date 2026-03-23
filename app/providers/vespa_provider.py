from app.providers.base import VectorDBProvider


class VespaProvider(VectorDBProvider):
    name = "vespa"
    display_name = "Vespa"

    @classmethod
    def config_fields(cls):
        return [
            {"key": "url", "label": "URL", "type": "text", "required": True, "default": "http://localhost:8080"},
            {"key": "schema", "label": "Schema Name", "type": "text", "required": True},
            {"key": "ranking_profile", "label": "Ranking Profile", "type": "text", "required": False, "default": "semantic"},
            {"key": "embedding_field", "label": "Embedding Field", "type": "text", "required": False, "default": "embedding"},
        ]

    def search(self, query_vector, config, top_k=5):
        from vespa.application import Vespa
        app = Vespa(url=config["url"])
        emb_field = config.get("embedding_field", "embedding")
        schema = config["schema"]
        body = {
            "yql": f"select * from sources {schema} where {{targetHits: {top_k}}}nearestNeighbor({emb_field}, q_embedding)",
            "hits": top_k,
            "ranking": config.get("ranking_profile", "semantic"),
            "input.query(q_embedding)": query_vector,
        }
        resp = app.query(body=body)
        return [
            {
                "id": hit["id"],
                "score": round(hit["relevance"], 4),
                "metadata": hit.get("fields", {}),
            }
            for hit in resp.hits
        ]
