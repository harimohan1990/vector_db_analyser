from pinecone import Pinecone
from app.config import PINECONE_API_KEY

_index = None

def get_index():
    global _index
    if _index is None:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        _index = pc.Index("quickstart-py")
    return _index
