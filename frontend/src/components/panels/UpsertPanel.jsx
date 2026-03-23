import { useState } from "react";
import styles from "./UpsertPanel.module.css";

const API = "http://localhost:8000";

export default function UpsertPanel({ selectedDBs, dbConfigs, embCfg, onClose }) {
  const db = [...selectedDBs][0] || "";
  const [mode, setMode] = useState("text"); // "text" | "json"
  const [text, setText] = useState("");
  const [jsonInput, setJsonInput] = useState('[\n  {\n    "id": "vec1",\n    "values": [0.1, 0.2, 0.3],\n    "metadata": {"text": "Hello world"}\n  }\n]');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  async function upsert() {
    if (!db) { setError("No database selected"); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let body;
      if (mode === "text") {
        if (!text.trim()) { setError("Enter text to embed"); setLoading(false); return; }
        body = {
          db_type: db,
          config: dbConfigs[db] || {},
          vectors: [],
          text: text.trim(),
          openai_api_key: embCfg.openai_api_key || "",
          embedding_model: embCfg.embedding_model || "local",
        };
      } else {
        let vecs;
        try { vecs = JSON.parse(jsonInput); } catch { setError("Invalid JSON"); setLoading(false); return; }
        if (!Array.isArray(vecs)) { setError("JSON must be an array of vectors"); setLoading(false); return; }
        body = { db_type: db, config: dbConfigs[db] || {}, vectors: vecs };
      }

      const res = await fetch(`${API}/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setResult(data);
      const entry = {
        time: new Date().toLocaleTimeString(),
        db,
        count: data.upserted_count,
        mode,
        preview: mode === "text" ? text.slice(0, 60) : `${JSON.parse(jsonInput).length} vectors`,
      };
      setHistory(h => [entry, ...h.slice(0, 19)]);
      if (mode === "text") setText("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>⬆️ Data Ingestion</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.dbTag}>
            Target: <strong>{db || "—"}</strong>
            {!db && <span className={styles.warn}> Select a database in the sidebar</span>}
          </div>

          {/* Mode tabs */}
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${mode === "text" ? styles.tabOn : ""}`} onClick={() => setMode("text")}>
              📝 Text → Auto-embed
            </button>
            <button className={`${styles.tab} ${mode === "json" ? styles.tabOn : ""}`} onClick={() => setMode("json")}>
              {"{ }"} Raw Vectors JSON
            </button>
          </div>

          {mode === "text" ? (
            <div className={styles.textMode}>
              <textarea
                className={styles.textArea}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Enter text to embed and upsert into the selected database…"
                rows={5}
              />
              <div className={styles.textNote}>
                Uses <code>{embCfg.embedding_model || "local"}</code> to generate embedding · auto-assigns UUID
              </div>
            </div>
          ) : (
            <div className={styles.jsonMode}>
              <textarea
                className={`${styles.textArea} ${styles.mono}`}
                value={jsonInput}
                onChange={e => setJsonInput(e.target.value)}
                rows={8}
                spellCheck={false}
              />
              <div className={styles.textNote}>
                Array of <code>{"{ id, values, metadata }"}</code> objects. <code>values</code> must match collection dimension.
              </div>
            </div>
          )}

          <button
            className={styles.upsertBtn}
            onClick={upsert}
            disabled={loading || !db}
          >
            {loading ? "Upserting…" : `Upsert to ${db || "DB"}`}
          </button>

          {error && <div className={styles.err}>{error}</div>}

          {result && (
            <div className={styles.success}>
              ✅ Successfully upserted <strong>{result.upserted_count}</strong> vector(s)
            </div>
          )}

          {history.length > 0 && (
            <div className={styles.historySection}>
              <div className={styles.histTitle}>Ingestion Log</div>
              {history.map((h, i) => (
                <div key={i} className={styles.histRow}>
                  <span className={styles.histTime}>{h.time}</span>
                  <span className={styles.histDB}>{h.db}</span>
                  <span className={styles.histPreview}>{h.preview}</span>
                  <span className={styles.histCount}>+{h.count} vec</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
