from app.providers.base import VectorDBProvider


class ValdProvider(VectorDBProvider):
    name = "vald"
    display_name = "Vald"

    @classmethod
    def config_fields(cls):
        return [
            {"key": "host", "label": "Host", "type": "text", "required": True, "default": "localhost"},
            {"key": "port", "label": "Port", "type": "number", "required": True, "default": "8080"},
        ]

    def search(self, query_vector, config, top_k=5):
        import grpc
        from vald.v1.vald import search_pb2_grpc
        from vald.v1.payload.payload_pb2 import Search
        channel = grpc.insecure_channel(f"{config.get('host', 'localhost')}:{config.get('port', 8080)}")
        stub = search_pb2_grpc.SearchStub(channel)
        cfg = Search.Config(num=top_k, radius=-1.0, epsilon=0.01, timeout=3_000_000_000)
        req = Search.Request(vector=query_vector, config=cfg)
        resp = stub.Search(req)
        return [
            {"id": r.id, "score": round(float(r.distance), 4), "metadata": {}}
            for r in resp.results
        ]
