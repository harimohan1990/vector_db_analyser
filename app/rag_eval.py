import math
from typing import List, Dict, Any

def precision_at_k(retrieved: List[str], relevant: set, k: int) -> float:
    retrieved_k = retrieved[:k]
    if not retrieved_k: return 0.0
    return sum(1 for r in retrieved_k if r in relevant) / k

def recall_at_k(retrieved: List[str], relevant: set, k: int) -> float:
    if not relevant: return 0.0
    retrieved_k = retrieved[:k]
    return sum(1 for r in retrieved_k if r in relevant) / len(relevant)

def reciprocal_rank(retrieved: List[str], relevant: set) -> float:
    for i, r in enumerate(retrieved):
        if r in relevant:
            return 1.0 / (i + 1)
    return 0.0

def ndcg_at_k(retrieved: List[str], relevant: set, k: int) -> float:
    dcg = sum(1.0 / math.log2(i + 2) for i, r in enumerate(retrieved[:k]) if r in relevant)
    idcg = sum(1.0 / math.log2(i + 2) for i in range(min(len(relevant), k)))
    return dcg / idcg if idcg > 0 else 0.0

def evaluate_results(results: List[Dict], ground_truth: List[str], k_values: List[int] = [1, 3, 5, 10]) -> Dict[str, Any]:
    retrieved_ids = [str(r.get("id", "")) for r in results]
    relevant = set(str(g) for g in ground_truth)
    metrics = {}
    for k in k_values:
        if k <= len(retrieved_ids):
            metrics[f"precision@{k}"] = round(precision_at_k(retrieved_ids, relevant, k), 4)
            metrics[f"recall@{k}"] = round(recall_at_k(retrieved_ids, relevant, k), 4)
            metrics[f"ndcg@{k}"] = round(ndcg_at_k(retrieved_ids, relevant, k), 4)
    metrics["mrr"] = round(reciprocal_rank(retrieved_ids, relevant), 4)
    metrics["hits"] = sum(1 for r in retrieved_ids if r in relevant)
    metrics["retrieved"] = len(retrieved_ids)
    metrics["relevant"] = len(ground_truth)
    return metrics

def evaluate_dataset(dataset: List[Dict], k_values: List[int] = [1, 3, 5, 10]) -> Dict[str, Any]:
    all_metrics = [evaluate_results(item.get("results", []), item.get("relevant_ids", []), k_values) for item in dataset]
    if not all_metrics: return {}
    keys = all_metrics[0].keys()
    averaged = {k: round(sum(m.get(k, 0) for m in all_metrics) / len(all_metrics), 4) for k in keys}
    averaged["num_queries"] = len(dataset)
    return averaged
