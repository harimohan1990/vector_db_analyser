import { useState } from "react";
import styles from "./NegativeQueryPanel.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function NegativeQueryPanel({ providers, dbConfigs, embCfg, onClose }) {
  const [positive, setPositive] = useState("");
  const [negative, setNegative] = useState("");
  const [db, setDb] = useState(providers[0]?.name || "");
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState(null);

  async function search() {
    if (!positive.trim() || !negative.trim() || !db) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setLatency(null);
    try {
      const res = await fetch(`${API}/search/negative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: positive,
          negative,
          db_type: db,
          config: dbConfigs[db] || {},
          top_k: topK,
          ...embCfg,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setResults(data.results || []);
      setLatency(data.latency_ms ?? null);
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
          <span className={styles.title}>Negative Query Search</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.explanation}>
            Results semantically close to the <span className={styles.posLabel}>positive</span> query
            but far from the <span className={styles.negLabel}>negative</span> query.
          </div>

          <div className={styles.queryPair}>
            <div className={styles.queryBlock}>
              <label className={styles.label} style={{ color: "var(--green)" }}>
                Positive — what you want
              </label>
              <textarea
                className={`${styles.queryInput} ${styles.posInput}`}
                value={positive}
                onChange={e => setPositive(e.target.value)}
                placeholder="e.g. machine learning applications in healthcare"
                rows={3}
              />
            </div>

            <div className={styles.queryBlock}>
              <label className={styles.label} style={{ color: "var(--red)" }}>
                Negative — what to avoid
              </label>
              <textarea
                className={`${styles.queryInput} ${styles.negInput}`}
                value={negative}
                onChange={e => setNegative(e.target.value)}
                placeholder="e.g. pharmaceutical drug development"
                rows={3}
              />
            </div>
          </div>

          <div className={styles.controls}>
            <div className={styles.field}>
              <label className={styles.label}>Database</label>
              <select className={styles.select} value={db} onChange={e => setDb(e.target.value)}>
                {providers.map(p => (
                  <option key={p.name} value={p.name}>{p.display_name}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Top K</label>
              <input
                type="number"
                className={styles.numInput}
                value={topK}
                min={1}
                max={50}
                onChange={e => setTopK(Number(e.target.value))}
              />
            </div>
          </div>

          {error && <div className={styles.err}>{error}</div>}

          {results && (
            <div className={styles.resultSection}>
              <div className={styles.resultMeta}>
                {results.length} results
                {latency != null && (
                  <span className={styles.latBadge}>{latency}ms</span>
                )}
              </div>
              <div className={styles.list}>
                {results.map((item, i) => (
                  <div key={i} className={styles.card}>
                    <span className={styles.rank}>#{i + 1}</span>
                    <span className={styles.cardId}>{item.id}</span>
                    <div className={styles.scoreBar}>
                      <div
                        className={styles.scoreFill}
                        style={{ width: `${Math.max(0, Math.min(100, (item.score ?? 0) * 100))}%` }}
                      />
                    </div>
                    <span className={styles.score}>
                      {((item.score ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
                {results.length === 0 && (
                  <div className={styles.empty}>No results found</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={styles.searchBtn}
            onClick={search}
            disabled={loading || !positive.trim() || !negative.trim() || !db}
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </div>
    </div>
  );
}
