from app.providers.base import VectorDBProvider


class WeaviateProvider(VectorDBProvider):
    name = "weaviate"
    display_name = "Weaviate"

    @classmethod
    def config_fields(cls):
        return [
            {"key": "url", "label": "URL", "type": "text", "required": True, "default": "http://localhost:8080"},
            {"key": "api_key", "label": "API Key (optional)", "type": "password", "required": False},
            {"key": "class_name", "label": "Class Name", "type": "text", "required": True},
            {"key": "text_property", "label": "Text Property", "type": "text", "required": False, "default": "text"},
        ]

    def search(self, query_vector, config, top_k=5):
        import weaviate
        auth = weaviate.auth.AuthApiKey(config["api_key"]) if config.get("api_key") else None
        client = weaviate.Client(url=config["url"], auth_client_secret=auth)
        text_prop = config.get("text_property", "text")
        result = (
            client.query
            .get(config["class_name"], [text_prop])
            .with_near_vector({"vector": query_vector})
            .with_limit(top_k)
            .with_additional(["id", "certainty"])
            .do()
        )
        items = result["data"]["Get"][config["class_name"]]
        return [
            {
                "id": item["_additional"]["id"],
                "score": round(item["_additional"].get("certainty", 0), 4),
                "metadata": {k: v for k, v in item.items() if k != "_additional"},
            }
            for item in items
        ]
