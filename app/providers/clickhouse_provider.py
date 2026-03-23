from app.providers.base import VectorDBProvider


class ClickHouseProvider(VectorDBProvider):
    name = "clickhouse"
    display_name = "ClickHouse"

    @classmethod
    def config_fields(cls):
        return [
            {"key": "host", "label": "Host", "type": "text", "required": True, "default": "localhost"},
            {"key": "port", "label": "Port", "type": "number", "required": False, "default": "8123"},
            {"key": "username", "label": "Username", "type": "text", "required": False, "default": "default"},
            {"key": "password", "label": "Password", "type": "password", "required": False},
            {"key": "database", "label": "Database", "type": "text", "required": True},
            {"key": "table_name", "label": "Table Name", "type": "text", "required": True},
            {"key": "vector_column", "label": "Vector Column", "type": "text", "required": False, "default": "embedding"},
            {"key": "text_column", "label": "Text Column", "type": "text", "required": False, "default": "text"},
        ]

    def search(self, query_vector, config, top_k=5):
        import clickhouse_connect
        client = clickhouse_connect.get_client(
            host=config.get("host", "localhost"),
            port=int(config.get("port", 8123)),
            username=config.get("username", "default"),
            password=config.get("password", ""),
            database=config["database"],
        )
        vec_col = config.get("vector_column", "embedding")
        txt_col = config.get("text_column", "text")
        table = config["table_name"]
        vec_str = "[" + ",".join(map(str, query_vector)) + "]"
        result = client.query(
            f"SELECT id, {txt_col}, cosineDistance({vec_col}, {vec_str}) AS dist "
            f"FROM {table} ORDER BY dist ASC LIMIT {top_k}"
        )
        return [
            {"id": str(row[0]), "score": round(1 - float(row[2]), 4), "metadata": {"text": row[1]}}
            for row in result.result_rows
        ]
