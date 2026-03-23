import math
from typing import List, Dict, Any

def _cosine(a, b):
    if len(a) != len(b): return 0.0
    dot = sum(x*y for x,y in zip(a,b))
    na = math.sqrt(sum(x*x for x in a))
    nb = math.sqrt(sum(x*x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def _mag(v): return math.sqrt(sum(x*x for x in v))

def analyze_quality(results: List[Dict[str, Any]], dup_threshold: float = 0.97) -> Dict[str, Any]:
    if not results: return {"total": 0, "issues": [], "score_stats": {}}
    issues = []
    vectors = [r.get("values") or r.get("vector") or [] for r in results]
    has_vectors = any(len(v) > 0 for v in vectors)

    # Near-duplicate detection
    duplicates = []
    if has_vectors:
        for i in range(len(results)):
            for j in range(i+1, len(results)):
                vi, vj = vectors[i], vectors[j]
                if vi and vj and len(vi) == len(vj):
                    sim = _cosine(vi, vj)
                    if sim >= dup_threshold:
                        duplicates.append({"id_a": results[i].get("id"), "id_b": results[j].get("id"), "similarity": round(sim, 4)})
        if duplicates: issues.append({"type": "near_duplicate", "severity": "warning", "count": len(duplicates), "items": duplicates[:5]})

    # Low magnitude vectors
    if has_vectors:
        low_norm = [{"id": r.get("id"), "magnitude": round(_mag(v), 6)} for r, v in zip(results, vectors) if v and _mag(v) < 0.01]
        if low_norm: issues.append({"type": "low_magnitude", "severity": "error", "count": len(low_norm), "items": low_norm})

    # Missing metadata
    no_meta = [r.get("id") for r in results if not r.get("metadata")]
    if no_meta: issues.append({"type": "missing_metadata", "severity": "info", "count": len(no_meta), "items": no_meta[:5]})

    # Score analysis
    scores = [r.get("score", 0) for r in results]
    low_score = [{"id": r.get("id"), "score": round(r.get("score",0), 4)} for r in results if r.get("score", 0) < 0.3]
    if low_score and len(low_score) > len(results)*0.5:
        issues.append({"type": "low_relevance", "severity": "warning", "count": len(low_score), "items": low_score[:5]})

    score_stats = {
        "min": round(min(scores), 4), "max": round(max(scores), 4),
        "mean": round(sum(scores)/len(scores), 4),
        "std": round(math.sqrt(sum((s - sum(scores)/len(scores))**2 for s in scores)/max(len(scores)-1,1)), 4),
    }
    return {"total": len(results), "issues": issues, "issue_count": len(issues), "score_stats": score_stats, "quality_score": max(0, round(1 - len(issues)*0.2, 2))}
