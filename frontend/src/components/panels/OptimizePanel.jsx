import { useState } from "react";
import styles from "./OptimizePanel.module.css";
const API = "http://localhost:8000";

const PRIORITY_COLOR = { high: "var(--red)", medium: "var(--amber)", low: "var(--green)" };
const CATEGORY_ICON = { database: "🗄", embedding: "🧠", index: "📐", chunking: "🧬", general: "✅" };

export default function OptimizePanel({ lastSearchMeta, onClose }) {
  const [form, setForm] = useState({
    dataset_size: 10000, avg_latency_ms: lastSearchMeta?.latency || 0,
    avg_score: 0.6, embedding_dim: lastSearchMeta?.dim || 384,
    use_case: "general", current_db: "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function run() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/optimize/suggest`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, avg_latency_ms: +form.avg_latency_ms, avg_score: +form.avg_score,
          dataset_size: +form.dataset_size, embedding_dim: +form.embedding_dim }),
      });
      setResult(await res.json());
    } catch {}
    finally { setLoading(false); }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>🤖 Auto Index Optimizer</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.grid}>
            {[
              ["Dataset Size", "dataset_size", "number", "e.g. 100000"],
              ["Avg Latency (ms)", "avg_latency_ms", "number", "e.g. 250"],
              ["Avg Score (0-1)", "avg_score", "number", "e.g. 0.65"],
              ["Embedding Dim", "embedding_dim", "number", "e.g. 384 or 1536"],
            ].map(([label, key, type, ph]) => (
              <div key={key} className={styles.field}>
                <label className={styles.fieldLabel}>{label}</label>
                <input className={styles.input} type={type} value={form[key]} placeholder={ph}
                  onChange={e => set(key, e.target.value)} />
              </div>
            ))}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Use Case</label>
              <select className={styles.select} value={form.use_case} onChange={e => set("use_case", e.target.value)}>
                <option value="general">General</option>
                <option value="realtime">Real-Time</option>
                <option value="accuracy">High Accuracy</option>
                <option value="scale">Large Scale</option>
              </select>
            </div>
          </div>
          <button className={styles.runBtn} onClick={run} disabled={loading}>
            {loading ? "Analyzing…" : "🤖 Get Suggestions"}
          </button>

          {result?.suggestions && (
            <div className={styles.suggestions}>
              <div className={styles.sectionTitle}>Optimization Suggestions</div>
              {result.suggestions.map((s, i) => (
                <div key={i} className={styles.suggestion}>
                  <div className={styles.suggHeader}>
                    <span className={styles.icon}>{CATEGORY_ICON[s.category]||"💡"}</span>
                    <span className={styles.suggTitle}>{s.suggestion}</span>
                    <span className={styles.priority} style={{color:PRIORITY_COLOR[s.priority]||"var(--text3)"}}>
                      {s.priority}
                    </span>
                  </div>
                  <div className={styles.suggReason}>{s.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
