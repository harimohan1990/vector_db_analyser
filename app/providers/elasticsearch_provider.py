from app.providers.base import VectorDBProvider


class ElasticsearchProvider(VectorDBProvider):
    name = "elasticsearch"
    display_name = "Elasticsearch"

    @classmethod
    def config_fields(cls):
        return [
            {"key": "url", "label": "URL", "type": "text", "required": True, "default": "http://localhost:9200"},
            {"key": "api_key", "label": "API Key (optional)", "type": "password", "required": False},
            {"key": "index_name", "label": "Index Name", "type": "text", "required": True},
            {"key": "vector_field", "label": "Vector Field", "type": "text", "required": False, "default": "embedding"},
        ]

    def search(self, query_vector, config, top_k=5):
        from elasticsearch import Elasticsearch
        kwargs = {"hosts": [config["url"]]}
        if config.get("api_key"):
            kwargs["api_key"] = config["api_key"]
        es = Elasticsearch(**kwargs)
        resp = es.search(
            index=config["index_name"],
            knn={
                "field": config.get("vector_field", "embedding"),
                "query_vector": query_vector,
                "k": top_k,
                "num_candidates": top_k * 10,
            },
        )
        return [
            {"id": hit["_id"], "score": round(hit["_score"], 4), "metadata": hit["_source"]}
            for hit in resp["hits"]["hits"]
        ]
