import { useState } from "react";
import styles from "./QueryRewritePanel.module.css";
const API = "http://localhost:8000";

export default function QueryRewritePanel({ onClose, onApply }) {
  const [query, setQuery] = useState("");
  const [strategy, setStrategy] = useState("all");
  const [rewrites, setRewrites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  async function rewrite() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/query/rewrite`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, strategy }),
      });
      const data = await res.json();
      setRewrites(data.rewrites || []);
      setSelected(null);
    } catch {}
    finally { setLoading(false); }
  }

  const strategyLabels = { all: "All Strategies", expand: "Expand Abbreviations", rephrase: "Rephrase", simplify: "Simplify", synonyms: "Add Context" };

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>🔄 Query Rewriter</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.inputRow}>
            <input className={styles.input} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Enter your search query…" onKeyDown={e => e.key === "Enter" && rewrite()} />
            <select className={styles.select} value={strategy} onChange={e => setStrategy(e.target.value)}>
              {Object.entries(strategyLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className={styles.runBtn} onClick={rewrite} disabled={loading || !query.trim()}>
              {loading ? "…" : "Rewrite"}
            </button>
          </div>

          {rewrites.length > 0 && (
            <div className={styles.results}>
              <div className={styles.sectionTitle}>Rewritten Queries — click to apply</div>
              {rewrites.map((r, i) => (
                <div key={i}
                  className={`${styles.rewriteCard} ${selected === i ? styles.rewriteCardSelected : ""}`}
                  onClick={() => setSelected(i)}>
                  <div className={styles.strategyBadge}>{r.strategy.replace(/_/g," ")}</div>
                  <div className={styles.rewriteQuery}>{r.query}</div>
                </div>
              ))}
              {selected !== null && (
                <button className={styles.applyBtn} onClick={() => { onApply?.(rewrites[selected].query); onClose(); }}>
                  ✓ Apply Selected Query
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
