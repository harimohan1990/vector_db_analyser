from app.providers.pinecone_provider import PineconeProvider
from app.providers.chroma_provider import ChromaProvider
from app.providers.deeplake_provider import DeepLakeProvider
from app.providers.vespa_provider import VespaProvider
from app.providers.milvus_provider import MilvusProvider
from app.providers.scann_provider import ScaNNProvider
from app.providers.weaviate_provider import WeaviateProvider
from app.providers.qdrant_provider import QdrantProvider
from app.providers.vald_provider import ValdProvider
from app.providers.faiss_provider import FaissProvider
from app.providers.opensearch_provider import OpenSearchProvider
from app.providers.pgvector_provider import PgvectorProvider
from app.providers.cassandra_provider import CassandraProvider
from app.providers.elasticsearch_provider import ElasticsearchProvider
from app.providers.clickhouse_provider import ClickHouseProvider

PROVIDERS: dict = {
    p.name: p
    for p in [
        PineconeProvider,
        ChromaProvider,
        DeepLakeProvider,
        VespaProvider,
        MilvusProvider,
        ScaNNProvider,
        WeaviateProvider,
        QdrantProvider,
        ValdProvider,
        FaissProvider,
        OpenSearchProvider,
        PgvectorProvider,
        CassandraProvider,
        ElasticsearchProvider,
        ClickHouseProvider,
    ]
}
