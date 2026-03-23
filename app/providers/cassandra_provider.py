from app.providers.base import VectorDBProvider


class CassandraProvider(VectorDBProvider):
    name = "cassandra"
    display_name = "Apache Cassandra"

    @classmethod
    def config_fields(cls):
        return [
            {"key": "host", "label": "Host", "type": "text", "required": True, "default": "localhost"},
            {"key": "port", "label": "Port", "type": "number", "required": False, "default": "9042"},
            {"key": "keyspace", "label": "Keyspace", "type": "text", "required": True},
            {"key": "table_name", "label": "Table Name", "type": "text", "required": True},
            {"key": "username", "label": "Username (optional)", "type": "text", "required": False},
            {"key": "password", "label": "Password (optional)", "type": "password", "required": False},
        ]

    def search(self, query_vector, config, top_k=5):
        from cassandra.cluster import Cluster
        from cassandra.auth import PlainTextAuthProvider
        auth = PlainTextAuthProvider(config["username"], config["password"]) if config.get("username") else None
        cluster = Cluster(
            [config.get("host", "localhost")],
            port=int(config.get("port", 9042)),
            auth_provider=auth,
        )
        session = cluster.connect(config["keyspace"])
        vec_str = str(query_vector)
        rows = session.execute(
            f"SELECT id, text, similarity_cosine(embedding, {vec_str}) AS score "
            f"FROM {config['table_name']} ORDER BY embedding ANN OF {vec_str} LIMIT {top_k}"
        )
        cluster.shutdown()
        return [
            {"id": str(row.id), "score": round(float(row.score), 4), "metadata": {"text": row.text}}
            for row in rows
        ]
