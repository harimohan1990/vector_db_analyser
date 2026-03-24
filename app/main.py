import asyncio, time, logging, hashlib, json, math as _math, re as _re
from collections import Counter as _Counter
from contextlib import asynccontextmanager
from functools import lru_cache
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from app.providers import PROVIDERS
from app.embedding import get_embedding_with_meta, EmbeddingResult
from app.database import init_db, add_search, get_history, clear_history
from app.rag_eval import evaluate_results, evaluate_dataset
from app.reranker import rerank
from app.chunker import compare_strategies, chunk_text
from app.drift import init_drift_db, save_snapshot, get_snapshots, compare_snapshots
from app.quality import analyze_quality
from app.monitor import record_request, get_qps, get_error_rate, get_latency_stats, get_endpoint_breakdown, get_timeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── In-memory embedding cache (keyed by text+model) ──────────────────────────
_embed_cache: dict[str, EmbeddingResult] = {}
_CACHE_MAX = 512

def _cache_key(text: str, model: str) -> str:
    return hashlib.sha256(f"{model}:{text}".encode()).hexdigest()

def get_embedding_cached(text: str, api_key: str | None, model: str) -> EmbeddingResult:
    key = _cache_key(text, model)
    if key in _embed_cache:
        logger.debug("Embedding cache hit")
        return _embed_cache[key]
    result = get_embedding_with_meta(text, api_key, model)
    if len(_embed_cache) >= _CACHE_MAX:
        _embed_cache.pop(next(iter(_embed_cache)))
    _embed_cache[key] = result
    return result


# ── App lifecycle ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    init_drift_db()
    logger.info("✅ Database initialized | %d providers loaded", len(PROVIDERS))
    yield
    logger.info("Shutdown complete")

app = FastAPI(title="Vector DB Analyzer", version="3.0.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=512)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── Request logging middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = round((time.perf_counter() - t0) * 1000, 1)
    logger.info("%s %s → %d (%sms)", request.method, request.url.path, response.status_code, ms)
    record_request(request.url.path, ms, response.status_code < 400)
    return response


# ── Global error handler ───────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(_request: Request, exc: Exception):
    logger.error("Unhandled error: %s", exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": str(exc), "type": type(exc).__name__})


# ── Models ─────────────────────────────────────────────────────────────────────
class SearchRequest(BaseModel):
    query: str
    db_type: str
    config: dict = {}
    top_k: int = 5
    offset: int = 0
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"

class MultiTarget(BaseModel):
    db_type: str
    config: dict = {}

class MultiSearchRequest(BaseModel):
    query: str
    targets: list[MultiTarget]
    top_k: int = 5
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "version": "3.0.0", "providers": len(PROVIDERS), "cache_size": len(_embed_cache)}

@app.get("/providers")
@lru_cache(maxsize=1)
def get_providers():
    return [
        {"name": p.name, "display_name": p.display_name, "config_fields": p.config_fields()}
        for p in PROVIDERS.values()
    ]

@app.post("/search")
async def search(req: SearchRequest):
    if not req.query.strip():
        raise HTTPException(400, "Query cannot be empty")
    if req.db_type not in PROVIDERS:
        raise HTTPException(400, f"Unknown db_type '{req.db_type}'. Available: {list(PROVIDERS)}")
    try:
        embed_result = await asyncio.to_thread(
            get_embedding_cached, req.query, req.openai_api_key or None, req.embedding_model
        )
        vector = embed_result.vector
        fetch_k = min(req.top_k + req.offset, 200)  # fetch enough to slice
        t0 = time.perf_counter()
        all_results = await asyncio.to_thread(PROVIDERS[req.db_type]().search, vector, req.config, fetch_k)
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        page_results = all_results[req.offset: req.offset + req.top_k]
        has_more = len(all_results) >= fetch_k and fetch_k < 200
        avg_score = round(sum(r["score"] for r in page_results) / len(page_results), 4) if page_results else 0
        if req.offset == 0:  # only log on first page to avoid duplicates
            await asyncio.to_thread(add_search, req.query, [req.db_type], len(page_results), avg_score, latency_ms)
        return {
            "results": page_results, "latency_ms": latency_ms,
            "db_type": req.db_type, "query": req.query,
            "embedding_dim": len(vector), "embedding_model": embed_result.model_used,
            "has_more": has_more, "offset": req.offset, "page_size": req.top_k,
            "embedding_fallback": embed_result.fallback,
            "embedding_fallback_reason": embed_result.fallback_reason,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Search error: %s", e, exc_info=True)
        raise HTTPException(500, str(e))

@app.post("/search/multi")
async def search_multi(req: MultiSearchRequest):
    if not req.query.strip():
        raise HTTPException(400, "Query cannot be empty")
    if not req.targets:
        raise HTTPException(400, "At least one target required")
    invalid = [t.db_type for t in req.targets if t.db_type not in PROVIDERS]
    if invalid:
        raise HTTPException(400, f"Unknown db_types: {invalid}")
    try:
        # Embed once — reused across all DB calls
        embed_result = await asyncio.to_thread(
            get_embedding_cached, req.query, req.openai_api_key or None, req.embedding_model
        )
        vector = embed_result.vector
    except Exception as e:
        raise HTTPException(500, f"Embedding failed: {e}")

    async def search_one(target: MultiTarget):
        t0 = time.perf_counter()
        try:
            results = await asyncio.to_thread(
                PROVIDERS[target.db_type]().search, vector, target.config, req.top_k
            )
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            return {"db_type": target.db_type, "results": results, "latency_ms": latency_ms, "error": None}
        except Exception as e:
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            logger.warning("DB error [%s]: %s", target.db_type, e)
            return {"db_type": target.db_type, "results": [], "latency_ms": latency_ms, "error": str(e)}

    # All DBs queried in parallel
    all_results = await asyncio.gather(*[search_one(t) for t in req.targets])

    total   = sum(len(r["results"]) for r in all_results)
    scores  = [s for r in all_results for s in [item["score"] for item in r["results"]]]
    avg_s   = round(sum(scores) / len(scores), 4) if scores else 0
    avg_lat = round(sum(r["latency_ms"] for r in all_results) / len(all_results), 1)
    await asyncio.to_thread(add_search, req.query, [t.db_type for t in req.targets], total, avg_s, avg_lat)
    return {
        "results": list(all_results),
        "embedding_fallback": embed_result.fallback,
        "embedding_fallback_reason": embed_result.fallback_reason,
        "embedding_model": embed_result.model_used,
    }

@app.delete("/embed-cache")
def clear_embed_cache():
    _embed_cache.clear()
    return {"status": "cleared"}

@app.get("/history")
def get_search_history(limit: int = 50):
    return get_history(limit)

@app.delete("/history")
def delete_history():
    clear_history()
    return {"status": "cleared"}


# ── Collections Management ──────────────────────────────────────────────────────
@app.get("/collections/{db_type}")
async def list_collections(db_type: str, request: Request):
    if db_type not in PROVIDERS:
        raise HTTPException(400, f"Unknown db_type '{db_type}'")
    try:
        config = dict(request.query_params)
        result = await asyncio.to_thread(PROVIDERS[db_type]().list_collections, config)
        return {"db_type": db_type, "collections": result}
    except Exception as e:
        logger.error("list_collections error [%s]: %s", db_type, e)
        raise HTTPException(500, str(e))


# ── Upsert ─────────────────────────────────────────────────────────────────────
class UpsertRequest(BaseModel):
    db_type: str
    config: dict = {}
    vectors: list  # [{id, values, metadata}]
    text: str = ""
    openai_api_key: str = ""
    embedding_model: str = "local"

@app.post("/upsert")
async def upsert_vectors(req: UpsertRequest):
    if req.db_type not in PROVIDERS:
        raise HTTPException(400, f"Unknown db_type '{req.db_type}'")
    try:
        vectors = req.vectors
        # If text provided and no values in first vector, auto-embed
        if req.text and (not vectors or not vectors[0].get("values")):
            vec = await asyncio.to_thread(
                get_embedding_cached, req.text, req.openai_api_key or None, req.embedding_model
            )
            import uuid
            vectors = [{"id": str(uuid.uuid4()), "values": vec, "metadata": {"text": req.text}}]
        result = await asyncio.to_thread(PROVIDERS[req.db_type]().upsert, req.config, vectors)
        return result
    except NotImplementedError as e:
        raise HTTPException(501, str(e))
    except Exception as e:
        logger.error("Upsert error [%s]: %s", req.db_type, e)
        raise HTTPException(500, str(e))


# ── Embedding Inspection ────────────────────────────────────────────────────────
class InspectRequest(BaseModel):
    text: str
    openai_api_key: str = ""
    embedding_model: str = "local"

@app.post("/inspect/embedding")
async def inspect_embedding(req: InspectRequest):
    if not req.text.strip():
        raise HTTPException(400, "Text cannot be empty")
    try:
        t0 = time.perf_counter()
        embed_result = await asyncio.to_thread(
            get_embedding_cached, req.text, req.openai_api_key or None, req.embedding_model
        )
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        arr = embed_result.vector
        dim = len(arr)
        mn, mx = min(arr), max(arr)
        mean = sum(arr) / dim
        magnitude = sum(x * x for x in arr) ** 0.5
        # Return preview (first 50 dims) + stats
        return {
            "dimension": dim,
            "model": embed_result.model_used,
            "latency_ms": latency_ms,
            "min": round(mn, 6),
            "max": round(mx, 6),
            "mean": round(mean, 6),
            "magnitude": round(magnitude, 6),
            "preview": [round(x, 6) for x in arr[:50]],
            "full_vector": arr,
            "fallback": embed_result.fallback,
            "fallback_reason": embed_result.fallback_reason,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Hybrid Search ───────────────────────────────────────────────────────────────
class HybridSearchRequest(BaseModel):
    query: str
    db_type: str
    config: dict = {}
    top_k: int = 5
    openai_api_key: str = ""
    embedding_model: str = "local"
    keyword_weight: float = 0.3   # 0=pure semantic, 1=pure keyword
    semantic_weight: float = 0.7

@app.post("/search/hybrid")
async def hybrid_search(req: HybridSearchRequest):
    if not req.query.strip():
        raise HTTPException(400, "Query cannot be empty")
    if req.db_type not in PROVIDERS:
        raise HTTPException(400, f"Unknown db_type '{req.db_type}'")
    try:
        embed_result = await asyncio.to_thread(
            get_embedding_cached, req.query, req.openai_api_key or None, req.embedding_model
        )
        vector = embed_result.vector
        t0 = time.perf_counter()
        semantic_results = await asyncio.to_thread(
            PROVIDERS[req.db_type]().search, vector, req.config, req.top_k * 2
        )
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        # Keyword re-rank: boost results whose metadata text contains query terms
        query_terms = set(req.query.lower().split())
        for r in semantic_results:
            text_blob = " ".join(str(v) for v in r.get("metadata", {}).values()).lower()
            keyword_hits = sum(1 for t in query_terms if t in text_blob)
            keyword_score = keyword_hits / max(len(query_terms), 1)
            r["semantic_score"] = r["score"]
            r["keyword_score"] = round(keyword_score, 4)
            r["hybrid_score"] = round(
                req.semantic_weight * r["score"] + req.keyword_weight * keyword_score, 4
            )
            r["score"] = r["hybrid_score"]
        # Sort by hybrid score
        semantic_results.sort(key=lambda x: x["hybrid_score"], reverse=True)
        return {
            "results": semantic_results[:req.top_k],
            "latency_ms": latency_ms,
            "db_type": req.db_type,
            "query": req.query,
            "mode": "hybrid",
            "keyword_weight": req.keyword_weight,
            "semantic_weight": req.semantic_weight,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ── AI Explanation ──────────────────────────────────────────────────────────────
class ExplainRequest(BaseModel):
    query: str
    results: list  # list of result dicts with metadata

@app.post("/explain")
async def explain_results(req: ExplainRequest):
    if not req.results:
        return {"explanation": "No results to explain."}

    # Extract text from metadata across all results
    texts = []
    for r in req.results[:5]:
        meta = r.get("metadata", {})
        text = " ".join(str(v) for v in meta.values() if v)
        if text.strip():
            texts.append(text)

    if not texts:
        return {"explanation": f"Found {len(req.results)} results matching '{req.query}', but no text metadata was available to explain the matches."}

    # Find most frequent meaningful words across results
    import re
    from collections import Counter
    query_words = set(re.findall(r'\b\w{4,}\b', req.query.lower()))
    all_words = []
    for t in texts:
        all_words.extend(re.findall(r'\b\w{4,}\b', t.lower()))

    common = [w for w, _ in Counter(all_words).most_common(15) if w not in {'this','that','with','from','have','been','will','were','they','their','what','when','which','where','about','also','into','your','more','some'}]
    query_matches = [w for w in query_words if any(w in t.lower() for t in texts)]

    # Build explanation
    result_count = len(req.results)
    top_score = req.results[0].get('score', 0)
    score_desc = "high confidence" if top_score > 0.85 else "moderate confidence" if top_score > 0.6 else "low confidence"

    theme_str = ", ".join(common[:6]) if common else "general content"
    match_str = f" Key query terms found: {', '.join(query_matches)}." if query_matches else ""

    explanation = (
        f"Found {result_count} result{'s' if result_count != 1 else ''} with {score_desc} "
        f"(top score: {top_score:.1%}). "
        f"Results share themes around: {theme_str}.{match_str} "
        f"The top result has ID '{req.results[0].get('id', 'unknown')}' "
        f"with a similarity score of {top_score:.1%}."
    )
    return {"explanation": explanation, "query": req.query, "result_count": result_count}


# ── Vector Search by raw vector ──────────────────────────────────────────────────
class VectorSearchRequest(BaseModel):
    vector: list
    db_type: str
    config: dict = {}
    top_k: int = 5

@app.post("/search/vector")
async def search_by_vector(req: VectorSearchRequest):
    if req.db_type not in PROVIDERS:
        raise HTTPException(400, f"Unknown db_type '{req.db_type}'")
    if not req.vector:
        raise HTTPException(400, "Vector cannot be empty")
    try:
        t0 = time.perf_counter()
        results = await asyncio.to_thread(PROVIDERS[req.db_type]().search, req.vector, req.config, req.top_k)
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        return {"results": results, "latency_ms": latency_ms, "dimension": len(req.vector)}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Performance Metrics ─────────────────────────────────────────────────────────
@app.get("/metrics")
def get_metrics():
    history = get_history(200)
    if not history:
        return {"total_queries": 0, "avg_latency_ms": 0, "p95_latency_ms": 0,
                "total_results": 0, "avg_score": 0, "cache_size": len(_embed_cache),
                "db_breakdown": {}, "recent": []}
    latencies = [h["latency_ms"] for h in history]
    scores = [h["avg_score"] for h in history if h["avg_score"] > 0]
    latencies_sorted = sorted(latencies)
    p95_idx = int(len(latencies_sorted) * 0.95)
    db_breakdown = {}
    for h in history:
        raw = h.get("db_types") or "[]"
        db_list = json.loads(raw) if isinstance(raw, str) else raw
        for db in db_list:
            if db not in db_breakdown:
                db_breakdown[db] = {"queries": 0, "avg_latency": 0, "total_results": 0}
            db_breakdown[db]["queries"] += 1
            db_breakdown[db]["avg_latency"] = round(
                (db_breakdown[db]["avg_latency"] * (db_breakdown[db]["queries"] - 1) + h["latency_ms"])
                / db_breakdown[db]["queries"], 1
            )
            db_breakdown[db]["total_results"] += h.get("results_count", 0)
    return {
        "total_queries": len(history),
        "avg_latency_ms": round(sum(latencies) / len(latencies), 1),
        "p95_latency_ms": round(latencies_sorted[min(p95_idx, len(latencies_sorted)-1)], 1),
        "total_results": sum(h.get("results_count", 0) for h in history),
        "avg_score": round(sum(scores) / len(scores), 4) if scores else 0,
        "cache_size": len(_embed_cache),
        "db_breakdown": db_breakdown,
        "recent": [
            {**h, "db_types": json.loads(h["db_types"]) if isinstance(h.get("db_types"), str) else h.get("db_types", [])}
            for h in history[:10]
        ],
    }


# ── RAG Evaluation ──────────────────────────────────────────────────────────────
class RAGEvalRequest(BaseModel):
    query: str
    results: list
    ground_truth_ids: list
    k_values: list = [1, 3, 5, 10]

@app.post("/rag/evaluate")
async def rag_evaluate(req: RAGEvalRequest):
    metrics = evaluate_results(req.results, req.ground_truth_ids, req.k_values)
    return {"query": req.query, "metrics": metrics}

class RAGDatasetRequest(BaseModel):
    dataset: list  # [{query, relevant_ids, results}]
    k_values: list = [1, 3, 5, 10]

@app.post("/rag/evaluate-dataset")
async def rag_evaluate_dataset(req: RAGDatasetRequest):
    aggregated = evaluate_dataset(req.dataset, req.k_values)
    per_query = [
        {"query": item.get("query", ""), "metrics": evaluate_results(
            item.get("results", []), item.get("relevant_ids", []), req.k_values
        )} for item in req.dataset
    ]
    return {"aggregated": aggregated, "per_query": per_query}


# ── Query Rewriting ──────────────────────────────────────────────────────────────
class RewriteRequest(BaseModel):
    query: str
    strategy: str = "all"  # expand | rephrase | simplify | synonyms | all

@app.post("/query/rewrite")
async def rewrite_query(req: RewriteRequest):
    q = req.query.strip()
    rewrites = []
    expansions = {
        "ml": "machine learning", "ai": "artificial intelligence", "nlp": "natural language processing",
        "db": "database", "vec": "vector", "sim": "similarity", "img": "image",
        "doc": "document", "emb": "embedding", "ret": "retrieval", "llm": "large language model",
    }
    if req.strategy in ("expand", "all"):
        expanded = q
        for abbr, full in expansions.items():
            expanded = _re.sub(r'\b' + abbr + r'\b', full, expanded, flags=_re.IGNORECASE)
        if expanded != q:
            rewrites.append({"strategy": "expand_abbreviations", "query": expanded})
    if req.strategy in ("rephrase", "all"):
        if q.lower().startswith("what is"):
            rewrites.append({"strategy": "rephrase", "query": q[8:].strip() + " definition explanation concept"})
        elif q.lower().startswith("how to"):
            rewrites.append({"strategy": "rephrase", "query": q[7:].strip() + " tutorial steps guide"})
        elif q.lower().startswith("why"):
            rewrites.append({"strategy": "rephrase", "query": q[4:].strip() + " reason cause explanation"})
        else:
            rewrites.append({"strategy": "rephrase", "query": f"information about {q}"})
    if req.strategy in ("simplify", "all"):
        stops = {"a","an","the","is","are","was","were","be","been","have","has","do","does","will","would","could","should","may","might","of","in","for","on","with","at","by","from","about","as","into","through"}
        simplified = " ".join(w for w in q.split() if w.lower() not in stops)
        if simplified and simplified != q:
            rewrites.append({"strategy": "simplify", "query": simplified})
    if req.strategy in ("synonyms", "all"):
        rewrites.append({"strategy": "semantic_expansion", "query": q + " semantic search vector similarity retrieval"})
    if not rewrites:
        rewrites.append({"strategy": "original", "query": q})
    return {"original": q, "rewrites": rewrites, "count": len(rewrites)}


# ── Reranking ────────────────────────────────────────────────────────────────────
class RerankRequest(BaseModel):
    query: str
    results: list
    top_k: int = 20

@app.post("/rerank")
async def rerank_results(req: RerankRequest):
    t0 = time.perf_counter()
    original = [dict(r) for r in req.results[:req.top_k]]
    reranked = await asyncio.to_thread(rerank, req.query, [dict(r) for r in req.results[:req.top_k]])
    latency_ms = round((time.perf_counter() - t0) * 1000, 1)
    return {"query": req.query, "original": original, "reranked": reranked, "latency_ms": latency_ms}


# ── Chunking ─────────────────────────────────────────────────────────────────────
class ChunkRequest(BaseModel):
    text: str
    chunk_size: int = 512
    overlap: int = 64

@app.post("/chunk")
async def chunk_endpoint(req: ChunkRequest):
    if not req.text.strip():
        raise HTTPException(400, "Text cannot be empty")
    chunks = chunk_text(req.text, req.chunk_size, req.overlap)
    return {"chunks": chunks, "total_chunks": len(chunks), "total_tokens": len(req.text.split())}

@app.post("/chunk/compare")
async def chunk_compare(req: ChunkRequest):
    if not req.text.strip():
        raise HTTPException(400, "Text cannot be empty")
    return compare_strategies(req.text)


# ── Embedding Drift ──────────────────────────────────────────────────────────────
class SnapshotRequest(BaseModel):
    label: str
    text: str
    openai_api_key: str = ""
    embedding_model: str = "local"

@app.post("/drift/snapshot")
async def create_snapshot(req: SnapshotRequest):
    if not req.text.strip():
        raise HTTPException(400, "Text cannot be empty")
    embed_result = await asyncio.to_thread(
        get_embedding_cached, req.text, req.openai_api_key or None, req.embedding_model
    )
    await asyncio.to_thread(save_snapshot, req.label, embed_result.model_used, req.text, embed_result.vector)
    return {"status": "saved", "label": req.label, "model": embed_result.model_used, "dim": len(embed_result.vector)}

@app.get("/drift/snapshots")
async def list_snapshots():
    snaps = await asyncio.to_thread(get_snapshots)
    return {"snapshots": snaps}

@app.get("/drift/compare/{id1}/{id2}")
async def drift_compare(id1: int, id2: int):
    result = await asyncio.to_thread(compare_snapshots, id1, id2)
    if not result:
        raise HTTPException(404, "One or both snapshots not found")
    return result


# ── Data Quality ─────────────────────────────────────────────────────────────────
class QualityRequest(BaseModel):
    results: list
    dup_threshold: float = 0.97

@app.post("/quality/analyze")
async def quality_analyze(req: QualityRequest):
    return await asyncio.to_thread(analyze_quality, req.results, req.dup_threshold)


# ── A/B Testing ──────────────────────────────────────────────────────────────────
class ABTestRequest(BaseModel):
    query: str
    config_a: dict  # {db_type, config, embedding_model, openai_api_key}
    config_b: dict
    top_k: int = 5

@app.post("/ab-test")
async def ab_test(req: ABTestRequest):
    async def run_variant(variant: dict, label: str):
        db_type = variant.get("db_type", "")
        if db_type not in PROVIDERS:
            return {"label": label, "error": f"Unknown db_type '{db_type}'", "results": [], "latency_ms": 0, "avg_score": 0}
        try:
            embed_result = await asyncio.to_thread(
                get_embedding_cached, req.query,
                variant.get("openai_api_key") or None,
                variant.get("embedding_model", "local")
            )
            t0 = time.perf_counter()
            results = await asyncio.to_thread(
                PROVIDERS[db_type]().search, embed_result.vector, variant.get("config", {}), req.top_k
            )
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            scores = [r.get("score", 0) for r in results]
            return {
                "label": label, "db_type": db_type, "results": results,
                "latency_ms": latency_ms,
                "avg_score": round(sum(scores) / len(scores), 4) if scores else 0,
                "result_count": len(results),
                "embedding_model": embed_result.model_used,
                "error": None,
            }
        except Exception as e:
            return {"label": label, "error": str(e), "results": [], "latency_ms": 0, "avg_score": 0}

    result_a, result_b = await asyncio.gather(run_variant(req.config_a, "A"), run_variant(req.config_b, "B"))
    winner = None
    if not result_a.get("error") and not result_b.get("error"):
        sd = result_a["avg_score"] - result_b["avg_score"]
        ld = result_a["latency_ms"] - result_b["latency_ms"]
        winner = "A" if sd > 0.02 else "B" if sd < -0.02 else ("A" if ld < 0 else "B")
    return {"query": req.query, "variant_a": result_a, "variant_b": result_b, "winner": winner}


# ── Production Monitor ────────────────────────────────────────────────────────────
@app.get("/monitor")
async def production_monitor(window: int = 300):
    return {
        "qps": get_qps(min(window, 60)),
        "error_rate": get_error_rate(window),
        "latency": get_latency_stats(window),
        "endpoints": get_endpoint_breakdown(window),
        "timeline": get_timeline(window),
        "window_seconds": window,
    }


# ── Streaming Search (SSE) ────────────────────────────────────────────────────────
class StreamSearchRequest(BaseModel):
    query: str
    db_type: str
    config: dict = {}
    top_k: int = 10
    openai_api_key: str = ""
    embedding_model: str = "local"

@app.post("/search/stream")
async def search_stream(req: StreamSearchRequest):
    if req.db_type not in PROVIDERS:
        raise HTTPException(400, f"Unknown db_type '{req.db_type}'")

    async def event_gen():
        try:
            yield f"data: {json.dumps({'phase':'embedding','status':'starting'})}\n\n"
            embed_result = await asyncio.to_thread(
                get_embedding_cached, req.query, req.openai_api_key or None, req.embedding_model
            )
            yield f"data: {json.dumps({'phase':'embedding','status':'done','dim':len(embed_result.vector),'model':embed_result.model_used,'fallback':embed_result.fallback})}\n\n"
            yield f"data: {json.dumps({'phase':'search','status':'starting','db':req.db_type})}\n\n"
            t0 = time.perf_counter()
            results = await asyncio.to_thread(
                PROVIDERS[req.db_type]().search, embed_result.vector, req.config, req.top_k
            )
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            for i, result in enumerate(results):
                yield f"data: {json.dumps({'phase':'result','index':i,'result':result})}\n\n"
                await asyncio.sleep(0.04)
            yield f"data: {json.dumps({'phase':'done','total':len(results),'latency_ms':latency_ms})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'phase':'error','message':str(e)})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ── Auto Index Optimization ───────────────────────────────────────────────────────
class OptimizeRequest(BaseModel):
    query_count: int = 0
    avg_latency_ms: float = 0
    avg_score: float = 0
    dataset_size: int = 0
    current_db: str = ""
    embedding_dim: int = 384
    use_case: str = "general"  # general | realtime | accuracy | scale

@app.post("/optimize/suggest")
async def suggest_optimization(req: OptimizeRequest):
    suggestions = []
    if req.dataset_size > 1_000_000:
        suggestions.append({"category": "database", "priority": "high",
            "suggestion": "Use Milvus or Weaviate for datasets > 1M vectors",
            "reason": "Better IVF index scalability at large scale"})
    elif req.dataset_size < 100_000 and req.use_case == "realtime":
        suggestions.append({"category": "database", "priority": "high",
            "suggestion": "Use Qdrant or Pinecone for real-time < 100K vectors",
            "reason": "HNSW gives sub-10ms latency at this scale"})
    if req.embedding_dim == 384 and req.avg_score < 0.6:
        suggestions.append({"category": "embedding", "priority": "high",
            "suggestion": "Upgrade to text-embedding-3-small (1536D)",
            "reason": f"Avg score {req.avg_score:.0%} below 60% — low-dim model may be limiting quality"})
    elif req.embedding_dim > 1000 and req.avg_latency_ms > 500:
        suggestions.append({"category": "embedding", "priority": "medium",
            "suggestion": "Use Matryoshka reduced dimensions (512D)",
            "reason": "High-dim vectors causing >500ms latency"})
    if req.avg_latency_ms > 300:
        suggestions.append({"category": "index", "priority": "medium",
            "suggestion": "Reduce HNSW ef_construction=128, M=16",
            "reason": "Trade recall for speed when latency > 300ms"})
    if req.avg_score < 0.5:
        suggestions.append({"category": "index", "priority": "high",
            "suggestion": "Increase HNSW ef_search to 200+",
            "reason": f"Low recall (avg score {req.avg_score:.0%}) — increase search scope"})
    if req.use_case == "accuracy":
        suggestions.append({"category": "chunking", "priority": "medium",
            "suggestion": "Use 256-token chunks with 32 overlap",
            "reason": "Smaller chunks improve precision for factual Q&A"})
    if not suggestions:
        suggestions.append({"category": "general", "priority": "low",
            "suggestion": "Configuration looks optimal", "reason": "All metrics within acceptable thresholds"})
    return {"suggestions": suggestions, "input": req.dict()}


# ── Multi-Modal Embed ─────────────────────────────────────────────────────────────
class MultiModalRequest(BaseModel):
    content: str
    content_type: str = "text"  # text | pdf | url
    openai_api_key: str = ""
    embedding_model: str = "local"

@app.post("/multimodal/embed")
async def multimodal_embed(req: MultiModalRequest):
    if not req.content.strip():
        raise HTTPException(400, "Content cannot be empty")
    text = req.content
    if req.content.startswith("http"):
        text = f"URL document: {req.content}"
    embed_result = await asyncio.to_thread(
        get_embedding_cached, text, req.openai_api_key or None, req.embedding_model
    )
    return {
        "content_type": req.content_type,
        "text_preview": text[:200],
        "vector_preview": embed_result.vector[:50],
        "dim": len(embed_result.vector),
        "model": embed_result.model_used,
        "fallback": embed_result.fallback,
    }


# ── Prompt + Retrieval Playground ─────────────────────────────────────────────────
class PromptPlaygroundRequest(BaseModel):
    query: str
    db_type: str
    config: dict = {}
    top_k: int = 3
    prompt_template: str = "You are a helpful assistant.\n\nContext:\n{context}\n\nQuestion: {query}\n\nAnswer:"
    openai_api_key: str = ""
    embedding_model: str = "local"

@app.post("/playground/rag")
async def rag_playground(req: PromptPlaygroundRequest):
    if req.db_type not in PROVIDERS:
        raise HTTPException(400, f"Unknown db_type '{req.db_type}'")
    embed_result = await asyncio.to_thread(
        get_embedding_cached, req.query, req.openai_api_key or None, req.embedding_model
    )
    t0 = time.perf_counter()
    try:
        results = await asyncio.to_thread(PROVIDERS[req.db_type]().search, embed_result.vector, req.config, req.top_k)
    except Exception as e:
        results = []
        logger.warning("Playground retrieval failed [%s]: %s", req.db_type, e)
    latency_ms = round((time.perf_counter() - t0) * 1000, 1)
    context_parts = []
    for i, r in enumerate(results):
        text = " ".join(str(v) for v in r.get("metadata", {}).values() if v)
        if text:
            context_parts.append(f"[{i+1}] (score:{r.get('score',0):.2f}) {text[:400]}")
    context = "\n\n".join(context_parts) or "No relevant context found."
    filled_prompt = req.prompt_template.replace("{context}", context).replace("{query}", req.query)
    return {
        "query": req.query, "retrieved_results": results, "context": context,
        "filled_prompt": filled_prompt, "retrieval_latency_ms": latency_ms,
        "embedding_model": embed_result.model_used, "result_count": len(results),
    }


# ── Deep Query Explainability ──────────────────────────────────────────────────────
class ExplainDeepRequest(BaseModel):
    query: str
    results: list
    vector: list = []

@app.post("/explain/deep")
async def explain_deep(req: ExplainDeepRequest):
    if not req.results:
        return {"token_importance": [], "dimension_analysis": {}, "top_result_explanation": {}}
    stops = {"the","and","for","are","but","not","you","all","can","had","has","have","was","were","this","that","with","from","they","their","what","when","which","where","about","also","into","your","more","some","been","will","would","could","should","other"}
    query_tokens = [t for t in _re.findall(r'\b\w{3,}\b', req.query.lower()) if t not in stops]
    all_text = " ".join(" ".join(str(v) for v in r.get("metadata", {}).values()) for r in req.results[:10]).lower()
    word_freq = _Counter(_re.findall(r'\b\w{3,}\b', all_text))
    total_words = max(sum(word_freq.values()), 1)
    token_importance = []
    for token in set(query_tokens):
        freq = word_freq.get(token, 0)
        tf = freq / total_words
        doc_count = sum(1 for r in req.results if token in " ".join(str(v) for v in r.get("metadata", {}).values()).lower())
        idf = _math.log(len(req.results) / max(doc_count, 1) + 1)
        token_importance.append({"token": token, "frequency": freq, "tf_idf": round(tf * idf, 4),
            "found_in_results": doc_count,
            "importance": "high" if tf * idf > 0.01 else "medium" if freq > 0 else "low"})
    token_importance.sort(key=lambda x: x["tf_idf"], reverse=True)
    dim_analysis = {}
    if req.vector:
        vec = req.vector
        top_pos = sorted(range(len(vec)), key=lambda i: vec[i], reverse=True)[:10]
        top_neg = sorted(range(len(vec)), key=lambda i: vec[i])[:10]
        dim_analysis = {
            "top_positive_dims": [{"dim": i, "value": round(vec[i], 4)} for i in top_pos],
            "top_negative_dims": [{"dim": i, "value": round(vec[i], 4)} for i in top_neg],
            "magnitude": round(_math.sqrt(sum(x * x for x in vec)), 4),
        }
    top = req.results[0]
    top_text = " ".join(str(v) for v in top.get("metadata", {}).values()).lower()
    matched = [t for t in query_tokens if t in top_text]
    return {
        "query": req.query, "token_importance": token_importance[:15],
        "dimension_analysis": dim_analysis,
        "top_result_explanation": {
            "id": top.get("id"), "score": top.get("score", 0), "matched_tokens": matched,
            "reason": f"Ranked #1 with {top.get('score',0):.1%} similarity. " +
                (f"Matched: {', '.join(matched)}." if matched else "Pure vector match — no direct keyword overlap."),
        },
    }


# ── New Feature Models ────────────────────────────────────────────────────────

class BatchSearchRequest(BaseModel):
    queries: list[str]
    db_type: str
    config: dict = {}
    top_k: int = 5
    openai_api_key: str = ""
    embedding_model: str = "local"

class TSNERequest(BaseModel):
    texts: list[str]
    openai_api_key: str = ""
    embedding_model: str = "local"
    perplexity: int = 5

class NegativeSearchRequest(BaseModel):
    query: str
    negative: str
    db_type: str
    config: dict = {}
    top_k: int = 5
    openai_api_key: str = ""
    embedding_model: str = "local"

class MigrationRequest(BaseModel):
    source_db: str
    source_config: dict = {}
    target_db: str
    target_config: dict = {}
    ids: list[str] = []

class NamespaceRequest(BaseModel):
    db_type: str
    config: dict = {}
    namespace: str = ""

class FeedbackRequest(BaseModel):
    query: str
    result_id: str
    relevant: bool
    db_type: str = ""

class ScheduledQueryRequest(BaseModel):
    name: str
    query: str
    db_type: str
    config: dict = {}
    interval_minutes: int = 60
    openai_api_key: str = ""
    embedding_model: str = "local"

class ChangeLogEntry(BaseModel):
    action: str
    details: str = ""

class AutocompleteRequest(BaseModel):
    prefix: str
    limit: int = 5

class GoldenDatasetEntry(BaseModel):
    query: str
    expected_ids: list[str]
    db_type: str = ""
    notes: str = ""

class DuplicateRequest(BaseModel):
    db_type: str
    config: dict = {}
    threshold: float = 0.97
    sample_size: int = 50
    openai_api_key: str = ""
    embedding_model: str = "local"

class HallucinationRequest(BaseModel):
    answer: str
    chunks: list[str]

class CostRequest(BaseModel):
    queries_per_day: int
    embedding_model: str = "local"
    db_type: str = "pinecone"
    top_k: int = 5


# ── Batch Search ──────────────────────────────────────────────────────────────
@app.post("/search/batch")
async def batch_search(req: BatchSearchRequest):
    if req.db_type not in PROVIDERS:
        raise HTTPException(400, f"Unknown db_type '{req.db_type}'")
    results = []
    for q in req.queries:
        try:
            emb = await asyncio.to_thread(
                get_embedding_cached, q, req.openai_api_key or None, req.embedding_model
            )
            t0 = time.perf_counter()
            res = await asyncio.to_thread(
                PROVIDERS[req.db_type]().search, emb.vector, req.config, req.top_k
            )
            results.append({"query": q, "results": res, "latency_ms": round((time.perf_counter()-t0)*1000, 1)})
        except Exception as e:
            results.append({"query": q, "error": str(e), "results": []})
    return {"batch": results, "total": len(results)}


# ── t-SNE / 2D Vector Map ─────────────────────────────────────────────────────
@app.post("/visualize/tsne")
async def visualize_tsne(req: TSNERequest):
    if len(req.texts) < 2:
        raise HTTPException(400, "Need at least 2 texts")
    vectors = []
    for t in req.texts[:50]:  # cap at 50 for performance
        emb = await asyncio.to_thread(
            get_embedding_cached, t, req.openai_api_key or None, req.embedding_model
        )
        vectors.append(emb.vector)
    # Simple PCA-based 2D projection (no sklearn needed)
    import math
    n = len(vectors)
    dim = len(vectors[0])
    # Centre
    mean = [sum(v[d] for v in vectors)/n for d in range(dim)]
    centred = [[v[d]-mean[d] for d in range(dim)] for v in vectors]
    # Project onto first 2 principal components via power iteration
    def dot(a, b): return sum(x*y for x,y in zip(a,b))
    def norm(a): return math.sqrt(dot(a,a)) or 1e-9
    def scale(a, s): return [x*s for x in a]
    def sub(a, b): return [x-y for x,y in zip(a,b)]
    def project_out(vecs, direction):
        return [sub(v, scale(direction, dot(v, direction))) for v in vecs]
    # PC1
    pc1 = centred[0][:]
    for _ in range(20):
        pc1 = [sum(centred[i][d]*dot(centred[i], pc1) for i in range(n)) for d in range(dim)]
        n1 = norm(pc1); pc1 = [x/n1 for x in pc1]
    # PC2
    c2 = project_out(centred, pc1)
    pc2 = c2[0][:]
    for _ in range(20):
        pc2 = [sum(c2[i][d]*dot(c2[i], pc2) for i in range(n)) for d in range(dim)]
        n2 = norm(pc2); pc2 = [x/n2 for x in pc2]
    points = [{"text": req.texts[i], "x": round(dot(centred[i], pc1), 4), "y": round(dot(centred[i], pc2), 4)} for i in range(n)]
    return {"points": points, "method": "PCA-2D"}


# ── Negative Query Search ─────────────────────────────────────────────────────
@app.post("/search/negative")
async def negative_search(req: NegativeSearchRequest):
    if req.db_type not in PROVIDERS:
        raise HTTPException(400, f"Unknown db_type '{req.db_type}'")
    pos_emb = await asyncio.to_thread(
        get_embedding_cached, req.query, req.openai_api_key or None, req.embedding_model
    )
    neg_emb = await asyncio.to_thread(
        get_embedding_cached, req.negative, req.openai_api_key or None, req.embedding_model
    )
    # Subtract negative direction from positive vector
    combined = [p - 0.3*n for p, n in zip(pos_emb.vector, neg_emb.vector)]
    # Re-normalise
    import math
    mag = math.sqrt(sum(x*x for x in combined)) or 1e-9
    combined = [x/mag for x in combined]
    t0 = time.perf_counter()
    results = await asyncio.to_thread(
        PROVIDERS[req.db_type]().search, combined, req.config, req.top_k
    )
    return {"results": results, "latency_ms": round((time.perf_counter()-t0)*1000, 1)}


# ── Query Autocomplete ────────────────────────────────────────────────────────
@app.post("/query/autocomplete")
async def query_autocomplete(req: AutocompleteRequest):
    history = await asyncio.to_thread(get_history, 100)
    prefix_lower = req.prefix.lower().strip()
    matches = []
    seen = set()
    for h in history:
        q = h.get("query", "")
        if q.lower().startswith(prefix_lower) and q not in seen and q != req.prefix:
            matches.append(q)
            seen.add(q)
        if len(matches) >= req.limit:
            break
    return {"suggestions": matches}


# ── Hallucination Detector ────────────────────────────────────────────────────
@app.post("/rag/hallucination")
async def detect_hallucination(req: HallucinationRequest):
    answer_words = set(req.answer.lower().split())
    all_chunk_words = set()
    for c in req.chunks:
        all_chunk_words.update(c.lower().split())
    # Simple overlap score
    stopwords = {"the","a","an","is","are","was","were","be","been","being","have","has","had",
                 "do","does","did","will","would","could","should","may","might","shall","can",
                 "to","of","in","for","on","with","at","by","from","and","or","but","not","it",
                 "this","that","these","those","i","you","we","they","he","she","its"}
    ans_content = answer_words - stopwords
    if not ans_content:
        return {"score": 1.0, "grounded": True, "unsupported_terms": []}
    supported = ans_content & all_chunk_words
    score = len(supported) / len(ans_content)
    unsupported = list(ans_content - all_chunk_words)[:10]
    return {
        "score": round(score, 3),
        "grounded": score >= 0.5,
        "supported_terms": len(supported),
        "total_content_terms": len(ans_content),
        "unsupported_terms": unsupported
    }


# ── Cost Estimator ────────────────────────────────────────────────────────────
@app.post("/cost/estimate")
async def cost_estimate(req: CostRequest):
    # Pricing per 1M tokens (approximate, 2025)
    embed_cost_per_1m = {
        "local": 0.0,
        "text-embedding-3-small": 0.02,
        "text-embedding-3-large": 0.13,
        "text-embedding-ada-002": 0.10,
    }
    # DB read cost per 1M queries (approximate)
    db_read_cost_per_1m = {
        "pinecone": 0.08,
        "qdrant": 0.0,
        "chroma": 0.0,
        "weaviate": 0.05,
        "milvus": 0.0,
    }
    avg_tokens_per_query = 20
    queries_per_month = req.queries_per_day * 30
    embed_price = embed_cost_per_1m.get(req.embedding_model, 0.02)
    db_price = db_read_cost_per_1m.get(req.db_type, 0.05)
    embed_monthly = (queries_per_month * avg_tokens_per_query / 1_000_000) * embed_price
    db_monthly = (queries_per_month / 1_000_000) * db_price
    total = embed_monthly + db_monthly
    return {
        "queries_per_month": queries_per_month,
        "embedding_cost_usd": round(embed_monthly, 4),
        "db_cost_usd": round(db_monthly, 4),
        "total_monthly_usd": round(total, 4),
        "embedding_model": req.embedding_model,
        "db_type": req.db_type,
        "note": "Estimates only. Check provider pricing pages for current rates."
    }


# ── Relevance Feedback ────────────────────────────────────────────────────────
_feedback_store: list[dict] = []

@app.post("/feedback")
async def add_feedback(req: FeedbackRequest):
    entry = {"query": req.query, "result_id": req.result_id, "relevant": req.relevant,
             "db_type": req.db_type, "ts": time.time()}
    _feedback_store.append(entry)
    if len(_feedback_store) > 1000:
        _feedback_store.pop(0)
    return {"ok": True, "total_feedback": len(_feedback_store)}

@app.get("/feedback")
async def get_feedback():
    return {"feedback": _feedback_store[-100:], "total": len(_feedback_store)}


# ── Change Log ────────────────────────────────────────────────────────────────
_changelog: list[dict] = []

@app.post("/changelog")
async def add_changelog(entry: ChangeLogEntry):
    record = {"action": entry.action, "details": entry.details, "ts": time.time(),
              "ts_str": __import__("datetime").datetime.utcnow().isoformat()}
    _changelog.append(record)
    if len(_changelog) > 500:
        _changelog.pop(0)
    return {"ok": True}

@app.get("/changelog")
async def get_changelog():
    return {"entries": list(reversed(_changelog[-100:])), "total": len(_changelog)}


# ── Duplicate Detector ────────────────────────────────────────────────────────
@app.post("/duplicates/detect")
async def detect_duplicates(req: DuplicateRequest):
    if req.db_type not in PROVIDERS:
        raise HTTPException(400, f"Unknown db_type '{req.db_type}'")
    try:
        # Fetch a sample of results using a zero vector to get representative entries
        import math
        zero_vector = [0.0] * 384  # default local embedding dim
        raw_results = await asyncio.to_thread(
            PROVIDERS[req.db_type]().search, zero_vector, req.config, req.sample_size
        )
        result = await asyncio.to_thread(analyze_quality, raw_results, req.threshold)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Golden Dataset ────────────────────────────────────────────────────────────
_golden_dataset: list[dict] = []

@app.post("/golden/add")
async def golden_add(entry: GoldenDatasetEntry):
    record = {**entry.dict(), "id": len(_golden_dataset)+1, "ts": time.time()}
    _golden_dataset.append(record)
    return {"ok": True, "id": record["id"]}

@app.get("/golden")
async def golden_list():
    return {"entries": _golden_dataset, "total": len(_golden_dataset)}

@app.delete("/golden/{entry_id}")
async def golden_delete(entry_id: int):
    global _golden_dataset
    _golden_dataset = [e for e in _golden_dataset if e["id"] != entry_id]
    return {"ok": True}

@app.post("/golden/run")
async def golden_run(body: dict):
    """Run all golden queries and score against expected results."""
    db_type = body.get("db_type", "")
    config = body.get("config", {})
    openai_key = body.get("openai_api_key", "")
    model = body.get("embedding_model", "local")
    top_k = body.get("top_k", 10)
    if db_type not in PROVIDERS:
        raise HTTPException(400, f"Unknown db_type '{db_type}'")
    results = []
    for entry in _golden_dataset:
        try:
            emb = await asyncio.to_thread(
                get_embedding_cached, entry["query"], openai_key or None, model
            )
            res = await asyncio.to_thread(
                PROVIDERS[db_type]().search, emb.vector, config, top_k
            )
            returned_ids = [r.get("id","") for r in res]
            hits = sum(1 for eid in entry["expected_ids"] if eid in returned_ids)
            precision = hits / len(returned_ids) if returned_ids else 0
            recall = hits / len(entry["expected_ids"]) if entry["expected_ids"] else 1.0
            results.append({
                "query": entry["query"],
                "expected": entry["expected_ids"],
                "returned": returned_ids[:5],
                "hits": hits,
                "precision": round(precision, 3),
                "recall": round(recall, 3),
            })
        except Exception as e:
            results.append({"query": entry["query"], "error": str(e)})
    avg_precision = sum(r.get("precision",0) for r in results)/len(results) if results else 0
    avg_recall = sum(r.get("recall",0) for r in results)/len(results) if results else 0
    return {"results": results, "avg_precision": round(avg_precision,3), "avg_recall": round(avg_recall,3)}


# ── Scheduled Queries (in-memory) ─────────────────────────────────────────────
_scheduled: list[dict] = []

@app.post("/scheduled")
async def create_scheduled(req: ScheduledQueryRequest):
    record = {**req.dict(), "id": len(_scheduled)+1, "last_run": None, "last_result_count": None, "enabled": True}
    _scheduled.append(record)
    return {"ok": True, "id": record["id"]}

@app.get("/scheduled")
async def list_scheduled():
    return {"schedules": _scheduled}

@app.delete("/scheduled/{sid}")
async def delete_scheduled(sid: int):
    global _scheduled
    _scheduled = [s for s in _scheduled if s["id"] != sid]
    return {"ok": True}

@app.post("/scheduled/{sid}/run")
async def run_scheduled(sid: int):
    sched = next((s for s in _scheduled if s["id"] == sid), None)
    if not sched:
        raise HTTPException(404, "Schedule not found")
    db_type = sched["db_type"]
    if db_type not in PROVIDERS:
        raise HTTPException(400, f"Unknown db_type '{db_type}'")
    emb = await asyncio.to_thread(
        get_embedding_cached, sched["query"],
        sched.get("openai_api_key") or None,
        sched.get("embedding_model", "local")
    )
    t0 = time.perf_counter()
    results = await asyncio.to_thread(
        PROVIDERS[db_type]().search, emb.vector, sched.get("config", {}), sched.get("top_k", 5)
    )
    sched["last_run"] = __import__("datetime").datetime.utcnow().isoformat()
    sched["last_result_count"] = len(results)
    return {"results": results, "latency_ms": round((time.perf_counter()-t0)*1000, 1), "query": sched["query"]}


# ── Index Migration ───────────────────────────────────────────────────────────
@app.post("/migrate")
async def migrate_index(req: MigrationRequest):
    """Placeholder: lists what would be migrated. Full migration requires provider-specific fetch APIs."""
    return {
        "status": "preview",
        "source": req.source_db,
        "target": req.target_db,
        "note": "Full migration requires read access to source index. Configure source credentials and run.",
        "estimated_vectors": len(req.ids) if req.ids else "unknown"
    }


# ── Namespace Manager ─────────────────────────────────────────────────────────
@app.post("/namespace/list")
async def list_namespaces(req: NamespaceRequest):
    if req.db_type not in PROVIDERS:
        raise HTTPException(400, f"Unknown db_type '{req.db_type}'")
    try:
        inst = PROVIDERS[req.db_type]()
        if hasattr(inst, "list_namespaces"):
            ns = await asyncio.to_thread(inst.list_namespaces, req.config)
        else:
            ns = []
        return {"namespaces": ns}
    except Exception as e:
        return {"namespaces": [], "error": str(e)}


# ── AI Chatbot ────────────────────────────────────────────────────────────────
from typing import Optional

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: Optional[dict] = None
    openai_api_key: Optional[str] = ""

_FALLBACK_ANSWERS = {
    "explain": "Vector search finds semantically similar documents by comparing embedding vectors in high-dimensional space. Higher scores (closer to 1.0) mean more similar content. The top result ranked #1 has the highest cosine similarity to your query embedding.",
    "query": "To improve search quality: (1) Use more specific queries, (2) Try different embedding models (local 384D is fast, OpenAI 1536D is more accurate), (3) Filter by metadata to narrow the search space, (4) Adjust top_k to see more or fewer results.",
    "latency": "To reduce latency: (1) Use the local embedding model (no API round-trip), (2) Enable caching (queries are cached by default), (3) Reduce top_k, (4) Use an index with fewer vectors or enable approximate nearest neighbor search.",
    "config": "For best results: match your embedding model dimension to your index dimension. Local model = 384D, OpenAI text-embedding-3-small = 1536D, text-embedding-3-large = 3072D. Mismatched dimensions cause errors.",
    "score": "Cosine similarity scores range from 0 to 1. Scores above 0.8 indicate high relevance, 0.5–0.8 moderate relevance, below 0.5 low relevance. For L2 distance, lower is better.",
    "default": "I can help you with vector search concepts, query optimization, embedding configurations, and interpreting search results. Try asking about search scores, latency, query tips, or embedding models.",
}

@app.post("/chat")
async def ai_chat(req: ChatRequest):
    api_key = (req.openai_api_key or "").strip()
    last_user = next((m.content for m in reversed(req.messages) if m.role == "user"), "")
    context = req.context or {}

    # Build context string for system prompt
    ctx_parts = []
    if context.get("query"):
        ctx_parts.append(f"Current query: \"{context['query']}\"")
    if context.get("resultCount"):
        ctx_parts.append(f"Results returned: {context['resultCount']}")
    if context.get("dbType"):
        ctx_parts.append(f"Database: {context['dbType']}")
    if context.get("embeddingModel"):
        ctx_parts.append(f"Embedding model: {context['embeddingModel']} ({context.get('embeddingDim', '?')}D)")
    if context.get("latency"):
        ctx_parts.append(f"Last query latency: {context['latency']}ms")
    ctx_str = "\n".join(ctx_parts) if ctx_parts else "No active search context."

    system_prompt = f"""You are an expert AI assistant for VectorDB Analyzer, a tool for querying and analyzing vector databases.
You help users understand semantic search results, optimize queries, debug configurations, and learn about vector databases.

Current session context:
{ctx_str}

Be concise, practical, and technical. Focus on actionable advice.
If asked about search results, help interpret scores and rankings.
If asked about configuration, give specific parameter recommendations.
Supported databases: Pinecone, Qdrant, Weaviate, Chroma, Milvus, OpenSearch, and more."""

    # Try OpenAI if key provided
    if api_key:
        try:
            import openai
            client = openai.AsyncOpenAI(api_key=api_key)
            oai_messages = [{"role": "system", "content": system_prompt}]
            oai_messages += [{"role": m.role, "content": m.content} for m in req.messages]
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=oai_messages,
                max_tokens=512,
                temperature=0.7,
            )
            return {"message": response.choices[0].message.content, "model": "gpt-4o-mini"}
        except Exception as e:
            logger.warning(f"OpenAI chat failed: {e}")

    # Fallback: keyword-based helpful responses
    low = last_user.lower()
    if any(w in low for w in ["explain", "mean", "rank", "why", "top result"]):
        reply = _FALLBACK_ANSWERS["explain"]
    elif any(w in low for w in ["improve", "better query", "suggest", "search tip"]):
        reply = _FALLBACK_ANSWERS["query"]
    elif any(w in low for w in ["latency", "slow", "speed", "fast"]):
        reply = _FALLBACK_ANSWERS["latency"]
    elif any(w in low for w in ["config", "dimension", "model", "setup"]):
        reply = _FALLBACK_ANSWERS["config"]
    elif any(w in low for w in ["score", "similarity", "cosine", "distance"]):
        reply = _FALLBACK_ANSWERS["score"]
    else:
        reply = _FALLBACK_ANSWERS["default"]

    if ctx_parts:
        reply += f"\n\n📊 Context: {'; '.join(ctx_parts)}"

    note = " (Add your OpenAI API key in the Config tab for full AI responses.)" if not api_key else ""
    return {"message": reply + note, "model": "fallback"}
