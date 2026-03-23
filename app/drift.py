import sqlite3, json, math, logging
from pathlib import Path

logger = logging.getLogger(__name__)
DB_PATH = Path("data/drift.db")

def init_drift_db():
    DB_PATH.parent.mkdir(exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            model TEXT NOT NULL,
            text TEXT NOT NULL,
            vector TEXT NOT NULL,
            dim INTEGER NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )""")

def save_snapshot(label: str, model: str, text: str, vector: list):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT INTO snapshots (label, model, text, vector, dim) VALUES (?,?,?,?,?)",
                     (label, model, text, json.dumps(vector), len(vector)))

def get_snapshots(limit: int = 50):
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute("SELECT id,label,model,text,dim,created_at FROM snapshots ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return [{"id": r[0], "label": r[1], "model": r[2], "text": r[3][:80], "dim": r[4], "created_at": r[5]} for r in rows]

def _cosine(a, b):
    if len(a) != len(b): return 0.0
    dot = sum(x*y for x,y in zip(a,b))
    na = math.sqrt(sum(x*x for x in a))
    nb = math.sqrt(sum(x*x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def compare_snapshots(id1: int, id2: int):
    with sqlite3.connect(DB_PATH) as conn:
        r1 = conn.execute("SELECT label,model,text,vector,dim,created_at FROM snapshots WHERE id=?", (id1,)).fetchone()
        r2 = conn.execute("SELECT label,model,text,vector,dim,created_at FROM snapshots WHERE id=?", (id2,)).fetchone()
    if not r1 or not r2: return None
    v1, v2 = json.loads(r1[3]), json.loads(r2[3])
    max_dim = max(len(v1), len(v2))
    v1p = v1 + [0.0]*(max_dim-len(v1))
    v2p = v2 + [0.0]*(max_dim-len(v2))
    sim = _cosine(v1p, v2p)
    return {
        "snapshot_1": {"id": id1, "label": r1[0], "model": r1[1], "dim": r1[4], "created_at": r1[5]},
        "snapshot_2": {"id": id2, "label": r2[0], "model": r2[1], "dim": r2[4], "created_at": r2[5]},
        "cosine_similarity": round(sim, 4),
        "drift_score": round(1.0 - sim, 4),
        "dim_mismatch": r1[4] != r2[4],
        "model_changed": r1[1] != r2[1],
        "drift_level": "high" if sim < 0.8 else "medium" if sim < 0.95 else "low",
    }
