import sqlite3, json, os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "history.db")

def get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS searches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query TEXT NOT NULL,
            db_types TEXT NOT NULL,
            results_count INTEGER,
            avg_score REAL,
            latency_ms REAL,
            timestamp TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def add_search(query, db_types, results_count, avg_score, latency_ms):
    conn = get_conn()
    conn.execute(
        "INSERT INTO searches (query, db_types, results_count, avg_score, latency_ms, timestamp) VALUES (?,?,?,?,?,?)",
        (query, json.dumps(db_types), results_count, avg_score, latency_ms, datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()

def get_history(limit=50):
    conn = get_conn()
    rows = conn.execute("SELECT * FROM searches ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def clear_history():
    conn = get_conn()
    conn.execute("DELETE FROM searches")
    conn.commit()
    conn.close()
