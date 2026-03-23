import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)
_cross_encoder = None

def _get_cross_encoder():
    global _cross_encoder
    if _cross_encoder is None:
        try:
            from sentence_transformers import CrossEncoder
            logger.info("Loading cross-encoder...")
            _cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
            logger.info("Cross-encoder loaded")
        except Exception as e:
            logger.error("Cross-encoder load failed: %s", e)
    return _cross_encoder

def rerank(query: str, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not results: return results
    model = _get_cross_encoder()
    if model is None:
        # Fallback: return as-is with original scores
        for i, r in enumerate(results):
            r["rerank_score"] = r.get("score", 0)
            r["original_score"] = r.get("score", 0)
            r["rerank_position"] = i + 1
        return results
    pairs = []
    for r in results:
        meta = r.get("metadata", {})
        doc_text = " ".join(str(v) for v in meta.values() if v)[:512] or str(r.get("id", ""))
        pairs.append([query, doc_text])
    try:
        scores = model.predict(pairs)
        for r, score in zip(results, scores):
            r["rerank_score"] = round(float(score), 4)
            r["original_score"] = r.get("score", 0)
        reranked = sorted(results, key=lambda x: x["rerank_score"], reverse=True)
        for i, r in enumerate(reranked):
            r["rerank_position"] = i + 1
        return reranked
    except Exception as e:
        logger.error("Reranking error: %s", e)
        return results
