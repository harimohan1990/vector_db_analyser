from abc import ABC, abstractmethod


class VectorDBProvider(ABC):
    name: str = ""
    display_name: str = ""

    @classmethod
    @abstractmethod
    def config_fields(cls) -> list:
        """Return list of config field defs: {key, label, type, required, default?, placeholder?}"""
        pass

    @abstractmethod
    def search(self, query_vector: list, config: dict, top_k: int = 5) -> list:
        """Return list of {id, score, metadata} dicts"""
        pass

    def list_collections(self, config: dict) -> list:
        """Return list of {name, vector_count, dimension, status} dicts. Override per provider."""
        return []

    def upsert(self, config: dict, vectors: list) -> dict:
        """Insert/update vectors. vectors: [{id, values, metadata}]. Returns {upserted_count}."""
        raise NotImplementedError(f"{self.name} does not support upsert via this UI")

    def delete_collection(self, config: dict, collection_name: str) -> dict:
        """Delete a collection/index. Returns {status}."""
        raise NotImplementedError(f"{self.name} does not support collection deletion via this UI")
