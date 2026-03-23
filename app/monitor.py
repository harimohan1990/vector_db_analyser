import time, threading
from collections import deque

_lock = threading.Lock()
_requests: deque = deque(maxlen=10000)  # (timestamp, latency_ms, endpoint, success)
_errors: deque = deque(maxlen=1000)


def record_request(endpoint: str, latency_ms: float, success: bool = True):
    with _lock:
        _requests.append((time.time(), latency_ms, endpoint, success))
        if not success:
            _errors.append((time.time(), endpoint))


def get_qps(window_seconds: int = 60) -> float:
    now = time.time()
    with _lock:
        count = sum(1 for ts, *_ in _requests if now - ts <= window_seconds)
    return round(count / window_seconds, 2)


def get_error_rate(window_seconds: int = 300) -> float:
    now = time.time()
    with _lock:
        total = sum(1 for ts, *_ in _requests if now - ts <= window_seconds)
        errors = sum(1 for ts, _ in _errors if now - ts <= window_seconds)
    return round(errors / max(total, 1), 4)


def get_latency_stats(window_seconds: int = 300) -> dict:
    now = time.time()
    with _lock:
        lats = [lat for ts, lat, *_ in _requests if now - ts <= window_seconds]
    if not lats:
        return {"avg": 0, "p50": 0, "p95": 0, "p99": 0, "min": 0, "max": 0, "count": 0}
    s = sorted(lats)
    n = len(s)
    return {
        "avg": round(sum(lats) / n, 1),
        "min": round(s[0], 1),
        "max": round(s[-1], 1),
        "p50": round(s[int(n * 0.5)], 1),
        "p95": round(s[min(int(n * 0.95), n - 1)], 1),
        "p99": round(s[min(int(n * 0.99), n - 1)], 1),
        "count": n,
    }


def get_endpoint_breakdown(window_seconds: int = 300) -> dict:
    now = time.time()
    breakdown: dict = {}
    with _lock:
        for ts, lat, ep, ok in _requests:
            if now - ts <= window_seconds:
                if ep not in breakdown:
                    breakdown[ep] = {"count": 0, "errors": 0, "total_lat": 0.0}
                breakdown[ep]["count"] += 1
                breakdown[ep]["total_lat"] += lat
                if not ok:
                    breakdown[ep]["errors"] += 1
    return {
        ep: {**v, "avg_lat": round(v["total_lat"] / max(v["count"], 1), 1)}
        for ep, v in breakdown.items()
    }


def get_timeline(window_seconds: int = 300, buckets: int = 30) -> list:
    now = time.time()
    bucket_size = window_seconds / buckets
    with _lock:
        reqs = list(_requests)
    timeline = []
    for i in range(buckets):
        t_start = now - window_seconds + i * bucket_size
        t_end = t_start + bucket_size
        bucket_reqs = [r for r in reqs if t_start <= r[0] < t_end]
        lats = [r[1] for r in bucket_reqs]
        timeline.append({
            "t": round(t_start),
            "count": len(bucket_reqs),
            "avg_lat": round(sum(lats) / len(lats), 1) if lats else 0,
            "errors": sum(1 for r in bucket_reqs if not r[3]),
        })
    return timeline
