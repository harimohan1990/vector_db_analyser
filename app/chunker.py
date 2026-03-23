from typing import List, Dict, Any

def chunk_text(text: str, chunk_size: int = 512, overlap: int = 64) -> List[Dict[str, Any]]:
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_words = words[start:end]
        chunk_str = " ".join(chunk_words)
        chunks.append({
            "index": len(chunks),
            "text": chunk_str,
            "start_word": start,
            "end_word": end,
            "token_count": len(chunk_words),
            "char_count": len(chunk_str),
            "overlap": overlap if start > 0 else 0,
        })
        if end >= len(words): break
        start = end - overlap
    return chunks

def compare_strategies(text: str) -> Dict[str, Any]:
    total_tokens = len(text.split())
    strategies = [
        {"size": 128, "overlap": 16, "label": "Small (128)"},
        {"size": 256, "overlap": 32, "label": "Medium (256)"},
        {"size": 512, "overlap": 64, "label": "Standard (512)"},
        {"size": 1024, "overlap": 128, "label": "Large (1024)"},
    ]
    results = []
    for s in strategies:
        chunks = chunk_text(text, s["size"], s["overlap"])
        results.append({
            "label": s["label"],
            "chunk_size": s["size"],
            "overlap": s["overlap"],
            "num_chunks": len(chunks),
            "avg_tokens": round(sum(c["token_count"] for c in chunks) / max(len(chunks), 1), 1),
            "coverage": round(sum(c["token_count"] for c in chunks) / max(total_tokens, 1), 2),
            "chunks_preview": [{"index": c["index"], "text": c["text"][:120] + "..." if len(c["text"]) > 120 else c["text"], "tokens": c["token_count"]} for c in chunks[:4]],
        })
    return {"total_tokens": total_tokens, "total_chars": len(text), "strategies": results}
