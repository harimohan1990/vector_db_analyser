from app.pinecone_client import get_index
from app.embedding import get_embedding

def search_vectors(query):
    vector = get_embedding(query)

    results = get_index().query(
        vector=vector,
        top_k=5,
        namespace="example-namespace",
        include_metadata=True
    )

    return results["matches"]
