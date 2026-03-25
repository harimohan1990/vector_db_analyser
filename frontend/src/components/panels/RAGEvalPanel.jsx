import { useState } from "react";
import styles from "./RAGEvalPanel.module.css";
const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const METRIC_INFO = {
  "precision@1":"Fraction of top-1 result that's relevant","precision@3":"Fraction of top-3 relevant",
  "precision@5":"Fraction of top-5 relevant","recall@1":"Coverage of relevant docs at rank 1",
  "recall@3":"Coverage at rank 3","recall@5":"Coverage at rank 5",
  "ndcg@5":"Normalized Discounted Cumulative Gain","mrr":"Mean Reciprocal Rank",
};

function MetricBar({ label, value, info }) {
  const pct = Math.round(value * 100);
  const color = value > 0.7 ? "var(--green)" : value > 0.4 ? "var(--amber)" : "var(--red)";
  return (
    <div className={styles.metricRow} title={info}>
      <span className={styles.metricLabel}>{label}</span>
      <div className={styles.metricBarWrap}>
        <div className={styles.metricFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.metricVal} style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function RAGEvalPanel({ onClose }) {
  const [mode, setMode] = useState("single"); // single | dataset
  const [query, setQuery] = useState("");
  const [resultsJson, setResultsJson] = useState("[]");
  const [groundTruth, setGroundTruth] = useState("");
  const [datasetJson, setDatasetJson] = useState("[]");
  const [metrics, setMetrics] = useState(null);
  const [perQuery, setPerQuery] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function evaluate() {
    setLoading(true); setError(null);
    try {
      if (mode === "single") {
        const res = await fetch(`${API}/rag/evaluate`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, results: JSON.parse(resultsJson), ground_truth_ids: groundTruth.split(",").map(s => s.trim()).filter(Boolean) }),
        });
        const data = await res.json();
        setMetrics(data.metrics); setPerQuery([]);
      } else {
        const res = await fetch(`${API}/rag/evaluate-dataset`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataset: JSON.parse(datasetJson) }),
        });
        const data = await res.json();
        setMetrics(data.aggregated); setPerQuery(data.per_query || []);
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>🧠 RAG Evaluation Suite</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.tabs}>
            {["single","dataset"].map(m => (
              <button key={m} className={`${styles.tab} ${mode===m?styles.tabActive:""}`} onClick={() => setMode(m)}>
                {m === "single" ? "Single Query" : "Dataset Batch"}
              </button>
            ))}
          </div>

          {mode === "single" ? (
            <div className={styles.form}>
              <label className={styles.label}>Query</label>
              <input className={styles.input} value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. What is vector search?" />
              <label className={styles.label}>Search Results (JSON array with id field)</label>
              <textarea className={styles.textarea} value={resultsJson} onChange={e => setResultsJson(e.target.value)} rows={4} placeholder='[{"id":"doc1","score":0.9},...]' />
              <label className={styles.label}>Ground Truth IDs (comma-separated)</label>
              <input className={styles.input} value={groundTruth} onChange={e => setGroundTruth(e.target.value)} placeholder="doc1, doc2, doc5" />
            </div>
          ) : (
            <div className={styles.form}>
              <label className={styles.label}>Dataset JSON (array of {"{"} query, relevant_ids, results {"}"})</label>
              <textarea className={styles.textarea} value={datasetJson} onChange={e => setDatasetJson(e.target.value)} rows={8}
                placeholder={'[\n  {\n    "query": "What is RAG?",\n    "relevant_ids": ["doc1"],\n    "results": [{"id":"doc1","score":0.9}]\n  }\n]'} />
            </div>
          )}

          <button className={styles.runBtn} onClick={evaluate} disabled={loading}>
            {loading ? "Evaluating…" : "▶ Run Evaluation"}
          </button>

          {error && <div className={styles.error}>⚠ {error}</div>}

          {metrics && (
            <div className={styles.results}>
              <div className={styles.sectionTitle}>
                {perQuery.length > 0 ? `Aggregated Metrics (${perQuery.length} queries)` : "Evaluation Metrics"}
              </div>
              <div className={styles.metricsList}>
                {Object.entries(metrics).filter(([k]) => k !== "num_queries" && k !== "hits" && k !== "retrieved" && k !== "relevant").map(([k, v]) => (
                  <MetricBar key={k} label={k} value={typeof v === "number" ? v : 0} info={METRIC_INFO[k] || k} />
                ))}
              </div>
              <div className={styles.metaStat}>
                {metrics.hits !== undefined && <span>Hits: <b>{metrics.hits}</b></span>}
                {metrics.retrieved !== undefined && <span>Retrieved: <b>{metrics.retrieved}</b></span>}
                {metrics.relevant !== undefined && <span>Relevant: <b>{metrics.relevant}</b></span>}
                {metrics.num_queries !== undefined && <span>Queries: <b>{metrics.num_queries}</b></span>}
              </div>
              {perQuery.length > 0 && (
                <div className={styles.perQueryList}>
                  <div className={styles.sectionTitle}>Per-Query Results</div>
                  {perQuery.map((pq, i) => (
                    <div key={i} className={styles.perQueryRow}>
                      <span className={styles.perQueryQ}>{pq.query}</span>
                      <span className={styles.perQueryMRR} style={{ color: pq.metrics.mrr > 0.5 ? "var(--green)" : "var(--amber)" }}>
                        MRR {(pq.metrics.mrr * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
