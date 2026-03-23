"""
Seed script: creates a 384-dim Pinecone index and populates it with
LangGraph / LangChain / AI tutorial sample vectors using the local
all-MiniLM-L6-v2 model (no OpenAI key needed).

Usage:
    python seed_pinecone.py
"""

import os, time, json
from dotenv import load_dotenv

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
INDEX_NAME = "langraph-local-384"      # new 384-dim index
NAMESPACE  = "tutorials"
DIM        = 384

SAMPLE_DOCS = [
    {"id": "lg_001", "text": "LangGraph is a library for building stateful, multi-actor applications with LLMs. It extends LangChain with graph-based orchestration."},
    {"id": "lg_002", "text": "LangGraph tutorial step by step: First, define your state schema. Then create nodes that transform state. Connect nodes with edges and compile the graph."},
    {"id": "lg_003", "text": "In LangGraph, a node is a Python function that takes a state dict and returns a partial state update. Nodes are the core processing units."},
    {"id": "lg_004", "text": "LangGraph edges define control flow. Conditional edges use a function to decide the next node. Regular edges always go to a fixed next node."},
    {"id": "lg_005", "text": "LangGraph StateGraph uses TypedDict to define state. Every node reads from and writes to this shared state object."},
    {"id": "lg_006", "text": "LangChain is a framework for developing applications powered by large language models. It provides chains, agents, and tools abstractions."},
    {"id": "lg_007", "text": "RAG (Retrieval Augmented Generation) combines vector search with LLM generation. Documents are embedded and stored in vector databases for semantic retrieval."},
    {"id": "lg_008", "text": "Vector databases store high-dimensional embeddings and support approximate nearest neighbor (ANN) search. Popular options include Pinecone, Qdrant, Chroma, and Weaviate."},
    {"id": "lg_009", "text": "Embeddings are dense numerical representations of text. Models like all-MiniLM-L6-v2 produce 384-dimensional vectors that capture semantic meaning."},
    {"id": "lg_010", "text": "LangGraph supports human-in-the-loop workflows. You can add breakpoints and wait for human input before continuing graph execution."},
    {"id": "lg_011", "text": "LangGraph checkpointing lets you save and restore graph state. Use SqliteSaver or PostgresSaver for persistent memory across sessions."},
    {"id": "lg_012", "text": "Building a ReAct agent in LangGraph: Create a tools node, an LLM node, and conditional routing based on whether tool calls were made."},
    {"id": "lg_013", "text": "LangGraph multi-agent systems: orchestrate multiple specialized agents with a supervisor that routes tasks to the right sub-agent."},
    {"id": "lg_014", "text": "Pinecone is a fully managed vector database. It supports serverless and pod-based indexes, namespaces for multi-tenancy, and metadata filtering."},
    {"id": "lg_015", "text": "Chroma is an open-source vector database designed for AI applications. It runs locally or as a server and integrates natively with LangChain."},
    {"id": "lg_016", "text": "Qdrant is a vector similarity search engine. It supports payload filtering, named vectors, and sparse vectors for hybrid search."},
    {"id": "lg_017", "text": "Semantic search finds documents by meaning rather than keywords. A query is embedded and compared to stored vectors using cosine similarity."},
    {"id": "lg_018", "text": "Hybrid search combines dense vector search (semantic) with sparse keyword search (BM25). It often outperforms either approach alone."},
    {"id": "lg_019", "text": "LangGraph tutorial: implement a simple chatbot with memory using StateGraph. Store conversation history in state and pass it to the LLM each turn."},
    {"id": "lg_020", "text": "Fine-tuning vs RAG: RAG is better for dynamic knowledge that changes frequently. Fine-tuning is better for changing model behavior and style."},
]

def main():
    print("Loading local embedding model (all-MiniLM-L6-v2)...")
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("all-MiniLM-L6-v2")

    print(f"Embedding {len(SAMPLE_DOCS)} documents...")
    texts = [d["text"] for d in SAMPLE_DOCS]
    embeddings = model.encode(texts, show_progress_bar=True)
    print(f"Embedding dimension: {embeddings.shape[1]}")

    print("\nConnecting to Pinecone...")
    from pinecone import Pinecone, ServerlessSpec

    pc = Pinecone(api_key=PINECONE_API_KEY)

    # Create index if it doesn't exist
    existing = [idx.name for idx in pc.list_indexes()]
    if INDEX_NAME not in existing:
        print(f"Creating index '{INDEX_NAME}' (dim={DIM}, cosine)...")
        pc.create_index(
            name=INDEX_NAME,
            dimension=DIM,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        print("Waiting for index to be ready...")
        while not pc.describe_index(INDEX_NAME).status["ready"]:
            time.sleep(2)
        print("Index ready.")
    else:
        print(f"Index '{INDEX_NAME}' already exists.")

    index = pc.Index(INDEX_NAME)

    # Upsert in batches of 10
    vectors = [
        {
            "id": doc["id"],
            "values": embeddings[i].tolist(),
            "metadata": {"text": doc["text"], "source": "langraph-tutorial"},
        }
        for i, doc in enumerate(SAMPLE_DOCS)
    ]

    batch_size = 10
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i:i+batch_size]
        index.upsert(vectors=batch, namespace=NAMESPACE)
        print(f"Upserted batch {i//batch_size + 1}/{-(-len(vectors)//batch_size)}")

    time.sleep(2)
    stats = index.describe_index_stats()
    print(f"\n✅ Done! Index stats: {json.dumps(dict(stats), indent=2, default=str)}")
    print(f"\nIn the UI:")
    print(f"  1. Select Pinecone in the sidebar")
    print(f"  2. Set Index Name → '{INDEX_NAME}'")
    print(f"  3. Set Namespace  → '{NAMESPACE}'")
    print(f"  4. Set Embedding Model → 🏠 Local (384D)")
    print(f"  5. Search: 'LangGraph tutorial step by step'")

if __name__ == "__main__":
    if not PINECONE_API_KEY:
        print("ERROR: PINECONE_API_KEY not set in .env")
        exit(1)
    main()
