import { useState } from "react";
import styles from "./BatchSearchPanel.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function BatchSearchPanel({ providers, dbConfigs, embCfg, onClose }) {
  const [queriesText, setQueriesText] = useState("");
  const [db, setDb] = useState(providers[0]?.name || "");
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  async function runBatch() {
    const lines = queriesText.split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length || !db) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setExpanded({});
    try {
      const res = await fetch(`${API}/search/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries: lines,
          db_type: db,
          config: dbConfigs[db] || {},
          top_k: topK,
          ...embCfg,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleRow(i) {
    setExpanded(prev => ({ ...prev, [i]: !prev[i] }));
  }

  const queryLines = queriesText.split("\n").map(l => l.trim()).filter(Boolean);
  const summary = results ? {
    total: results.results?.length ?? 0,
    avgLatency: results.results?.length
      ? Math.round(results.results.reduce((s, r) => s + (r.latency_ms || 0), 0) / results.results.length)
      : 0,
    errors: results.results?.filter(r => r.error).length ?? 0,
  } : null;

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>Batch Search</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            <label className={styles.label}>Queries (one per line)</label>
            <textarea
              className={styles.textarea}
              value={queriesText}
              onChange={e => setQueriesText(e.target.value)}
              placeholder={"what is machine learning?\nhow does a neural network work?\nexplain embeddings"}
              rows={5}
            />
            <span className={styles.hint}>{queryLines.length} quer{queryLines.length === 1 ? "y" : "ies"} detected</span>
          </div>

          <div className={styles.row}>
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

          {summary && (
            <div className={styles.summary}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Total Queries</span>
                <b className={styles.summaryVal}>{summary.total}</b>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Avg Latency</span>
                <b className={styles.summaryVal} style={{ color: summary.avgLatency < 300 ? "var(--green)" : summary.avgLatency < 800 ? "var(--amber)" : "var(--red)" }}>
                  {summary.avgLatency}ms
                </b>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Errors</span>
                <b className={styles.summaryVal} style={{ color: summary.errors > 0 ? "var(--red)" : "var(--green)" }}>
                  {summary.errors}
                </b>
              </div>
            </div>
          )}

          {results?.results && (
            <div className={styles.resultList}>
              {results.results.map((r, i) => (
                <div key={i} className={styles.resultRow}>
                  <button className={styles.rowHeader} onClick={() => toggleRow(i)}>
                    <span className={styles.chevron}>{expanded[i] ? "▾" : "▸"}</span>
                    <span className={styles.queryText}>{r.query}</span>
                    <div className={styles.rowMeta}>
                      {r.error
                        ? <span className={styles.errBadge}>Error</span>
                        : <>
                            <span className={styles.badge}>{r.result_count ?? r.results?.length ?? 0} results</span>
                            <span className={styles.latBadge}>{r.latency_ms}ms</span>
                          </>
                      }
                    </div>
                  </button>

                  {expanded[i] && (
                    <div className={styles.rowBody}>
                      {r.error
                        ? <div className={styles.err}>{r.error}</div>
                        : (r.results || []).slice(0, 3).map((item, j) => (
                            <div key={j} className={styles.miniCard}>
                              <span className={styles.miniRank}>#{j + 1}</span>
                              <span className={styles.miniId}>{item.id}</span>
                              <span className={styles.miniScore}>
                                {((item.score ?? item.hybrid_score ?? 0) * 100).toFixed(1)}%
                              </span>
                            </div>
                          ))
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={styles.runBtn}
            onClick={runBatch}
            disabled={loading || !queryLines.length || !db}
          >
            {loading ? "Running…" : "Run Batch"}
          </button>
        </div>
      </div>
    </div>
  );
}
