import os
import logging
from app.config import OPENAI_API_KEY

logger = logging.getLogger(__name__)

# Lazy-loaded local model singleton
_local_model = None

def _get_local_model():
    global _local_model
    if _local_model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading local embedding model all-MiniLM-L6-v2…")
        _local_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Local model loaded (384D)")
    return _local_model


class EmbeddingResult:
    """Wraps embedding vector with metadata about how it was produced."""
    def __init__(self, vector: list, model_used: str, fallback: bool = False, fallback_reason: str = ""):
        self.vector = vector
        self.model_used = model_used
        self.fallback = fallback
        self.fallback_reason = fallback_reason

    def __iter__(self):          # so it can be iterated like a plain list
        return iter(self.vector)

    def __len__(self):
        return len(self.vector)

    def __getitem__(self, idx):
        return self.vector[idx]


def get_embedding(text: str, api_key: str | None = None, model: str = "text-embedding-3-small") -> list:
    """
    Returns a plain embedding vector list.
    Falls back to local all-MiniLM-L6-v2 (384D) on any OpenAI failure.
    """
    result = get_embedding_with_meta(text, api_key, model)
    return result.vector


def get_embedding_with_meta(
    text: str,
    api_key: str | None = None,
    model: str = "text-embedding-3-small",
) -> EmbeddingResult:
    """
    Returns an EmbeddingResult with `.vector`, `.model_used`, `.fallback`, `.fallback_reason`.
    Fallback chain:
      1. If model == "local" or no key → local immediately (no attempt)
      2. OpenAI call → if ANY exception → local fallback with logged reason
    """
    key = api_key or OPENAI_API_KEY

    # Explicit local request or no credentials at all
    if not key or model == "local":
        vec = _get_local_model().encode(text).tolist()
        return EmbeddingResult(vec, model_used="local", fallback=False)

    # Try OpenAI
    try:
        from openai import OpenAI
        client = OpenAI(api_key=key)
        vec = client.embeddings.create(model=model, input=text).data[0].embedding
        return EmbeddingResult(vec, model_used=model, fallback=False)

    except Exception as e:
        err_str = str(e)
        err_lower = err_str.lower()

        # Classify the failure reason
        if "quota" in err_lower or "billing" in err_lower or "insufficient_quota" in err_lower:
            reason = "OpenAI quota/billing limit reached"
        elif "401" in err_lower or "invalid_api_key" in err_lower or "authentication" in err_lower:
            reason = "OpenAI API key invalid or expired"
        elif "rate" in err_lower or "429" in err_lower:
            reason = "OpenAI rate limit hit"
        elif "timeout" in err_lower or "timed out" in err_lower:
            reason = "OpenAI request timed out"
        elif "connection" in err_lower or "network" in err_lower:
            reason = "Network error reaching OpenAI"
        else:
            reason = f"OpenAI error: {err_str[:120]}"

        logger.warning("Embedding fallback to local — %s", reason)
        vec = _get_local_model().encode(text).tolist()
        return EmbeddingResult(vec, model_used="local", fallback=True, fallback_reason=reason)
