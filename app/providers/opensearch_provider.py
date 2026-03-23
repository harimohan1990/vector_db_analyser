from app.providers.base import VectorDBProvider


class OpenSearchProvider(VectorDBProvider):
    name = "opensearch"
    display_name = "OpenSearch"

    @classmethod
    def config_fields(cls):
        return [
            {"key": "host", "label": "Host", "type": "text", "required": True, "default": "localhost"},
            {"key": "port", "label": "Port", "type": "number", "required": True, "default": "9200"},
            {"key": "username", "label": "Username", "type": "text", "required": False, "default": "admin"},
            {"key": "password", "label": "Password", "type": "password", "required": False},
            {"key": "index_name", "label": "Index Name", "type": "text", "required": True},
            {"key": "vector_field", "label": "Vector Field", "type": "text", "required": False, "default": "embedding"},
        ]

    def search(self, query_vector, config, top_k=5):
        from opensearchpy import OpenSearch
        auth = (config.get("username", "admin"), config["password"]) if config.get("password") else None
        client = OpenSearch(
            hosts=[{"host": config.get("host", "localhost"), "port": int(config.get("port", 9200))}],
            http_auth=auth,
            use_ssl=False,
            verify_certs=False,
        )
        body = {
            "size": top_k,
            "query": {
                "knn": {
                    config.get("vector_field", "embedding"): {
                        "vector": query_vector,
                        "k": top_k,
                    }
                }
            },
        }
        resp = client.search(index=config["index_name"], body=body)
        return [
            {"id": hit["_id"], "score": round(hit["_score"], 4), "metadata": hit["_source"]}
            for hit in resp["hits"]["hits"]
        ]
