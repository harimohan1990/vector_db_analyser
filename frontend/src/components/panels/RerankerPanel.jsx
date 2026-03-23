import { useState } from "react";
import styles from "./RerankerPanel.module.css";
const API = "http://localhost:8000";

function ResultRow({ rank, item, isReranked }) {
  const scoreKey = isReranked ? "rerank_score" : "score";
  const score = item[scoreKey] || 0;
  const color = score > 0.5 ? "var(--green)" : score > 0 ? "var(--amber)" : "var(--text4)";
  const moved = isReranked && item.original_score !== undefined
    ? item.rerank_position - (rank) : 0;
  return (
    <div className={styles.row}>
      <span className={styles.rank}>{rank}</span>
      {isReranked && item.original_score !== undefined && (
        <span className={styles.move} style={{color:moved<0?"var(--green)":moved>0?"var(--red)":"var(--text4)"}}>
          {moved < 0 ? `▲${-moved}` : moved > 0 ? `▼${moved}` : "–"}
        </span>
      )}
      <span className={styles.id} title={String(item.id)}>{String(item.id).slice(0, 24)}</span>
      <span className={styles.score} style={{color}}>{(score*100).toFixed(1)}%</span>
      {isReranked && item.original_score !== undefined && (
        <span className={styles.origScore}>was {(item.original_score*100).toFixed(1)}%</span>
      )}
      <span className={styles.meta}>{Object.values(item.metadata||{}).join(" ").slice(0,80)}</span>
    </div>
  );
}

export default function RerankerPanel({ onClose }) {
  const [query, setQuery] = useState("");
  const [resultsJson, setResultsJson] = useState("[]");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function rerank() {
    if (!query.trim()) return;
    setLoading(true); setError(null);
    try {
      const results = JSON.parse(resultsJson);
      const res = await fetch(`${API}/rerank`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, results }),
      });
      setResult(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>🏅 Cross-Encoder Reranker</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.form}>
            <input className={styles.input} value={query} onChange={e => setQuery(e.target.value)} placeholder="Query…" />
            <label className={styles.label}>Search results JSON (array with id, score, metadata)</label>
            <textarea className={styles.textarea} value={resultsJson} onChange={e => setResultsJson(e.target.value)} rows={5}
              placeholder='[{"id":"doc1","score":0.8,"metadata":{"text":"…"}},…]' />
            <button className={styles.runBtn} onClick={rerank} disabled={loading || !query.trim()}>
              {loading ? "Reranking…" : "🏅 Rerank"}
            </button>
            {error && <div className={styles.error}>⚠ {error}</div>}
          </div>

          {result && (
            <div className={styles.results}>
              <div className={styles.resultCols}>
                <div className={styles.col}>
                  <div className={styles.colHead}>Original Order</div>
                  {result.original.map((r, i) => <ResultRow key={i} rank={i+1} item={r} isReranked={false} />)}
                </div>
                <div className={styles.col}>
                  <div className={styles.colHead}>After Reranking <span className={styles.latTag}>{result.latency_ms}ms</span></div>
                  {result.reranked.map((r, i) => <ResultRow key={i} rank={i+1} item={r} isReranked={true} />)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
