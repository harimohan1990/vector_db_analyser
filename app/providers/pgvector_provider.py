from app.providers.base import VectorDBProvider


class PgvectorProvider(VectorDBProvider):
    name = "pgvector"
    display_name = "pgvector"

    @classmethod
    def config_fields(cls):
        return [
            {"key": "connection_string", "label": "Connection String", "type": "text", "required": True,
             "placeholder": "postgresql://user:pass@localhost/db"},
            {"key": "table_name", "label": "Table Name", "type": "text", "required": True},
            {"key": "vector_column", "label": "Vector Column", "type": "text", "required": False, "default": "embedding"},
            {"key": "text_column", "label": "Text Column", "type": "text", "required": False, "default": "text"},
        ]

    def search(self, query_vector, config, top_k=5):
        import psycopg2, json
        conn = psycopg2.connect(config["connection_string"])
        cur = conn.cursor()
        vec_col = config.get("vector_column", "embedding")
        txt_col = config.get("text_column", "text")
        table = config["table_name"]
        vec_str = json.dumps(query_vector)
        cur.execute(
            f"SELECT id, {txt_col}, 1 - ({vec_col} <=> %s::vector) AS score "
            f"FROM {table} ORDER BY {vec_col} <=> %s::vector LIMIT %s",
            (vec_str, vec_str, top_k),
        )
        rows = cur.fetchall()
        conn.close()
        return [
            {"id": str(row[0]), "score": round(float(row[2]), 4), "metadata": {"text": row[1]}}
            for row in rows
        ]
