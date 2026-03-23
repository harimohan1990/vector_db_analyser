import { useState } from "react";
import styles from "./ABTestPanel.module.css";
const API = "http://localhost:8000";

function VariantBlock({ label, data, isWinner }) {
  if (!data) return null;
  const color = label === "A" ? "var(--accent2)" : "var(--green)";
  return (
    <div className={`${styles.variant} ${isWinner ? styles.variantWinner : ""}`}>
      <div className={styles.variantHeader}>
        <span className={styles.variantLabel} style={{ background: color }}>Variant {label}</span>
        {isWinner && <span className={styles.winnerBadge}>🏆 Winner</span>}
        <span className={styles.variantDB}>{data.db_type || "—"}</span>
      </div>
      {data.error ? (
        <div className={styles.variantErr}>⚠ {data.error}</div>
      ) : (
        <div className={styles.variantStats}>
          <div className={styles.statBox}><span>Results</span><b>{data.result_count ?? 0}</b></div>
          <div className={styles.statBox}><span>Avg Score</span><b style={{color: data.avg_score > 0.7 ? "var(--green)" : data.avg_score > 0.4 ? "var(--amber)" : "var(--red)"}}>
            {((data.avg_score||0)*100).toFixed(1)}%</b></div>
          <div className={styles.statBox}><span>Latency</span><b style={{color: data.latency_ms < 300 ? "var(--green)" : data.latency_ms < 800 ? "var(--amber)" : "var(--red)"}}>
            {data.latency_ms}ms</b></div>
          <div className={styles.statBox}><span>Model</span><b>{data.embedding_model || "—"}</b></div>
        </div>
      )}
    </div>
  );
}

export default function ABTestPanel({ providers, dbConfigs, embCfg, onClose }) {
  const [query, setQuery] = useState("");
  const [dbA, setDbA] = useState(providers[0]?.name || "");
  const [dbB, setDbB] = useState(providers[1]?.name || "");
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function runTest() {
    if (!query.trim() || !dbA || !dbB) return;
    setLoading(true); setResult(null);
    try {
      const res = await fetch(`${API}/ab-test`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query, top_k: topK,
          config_a: { db_type: dbA, config: dbConfigs[dbA] || {}, openai_api_key: embCfg?.openai_api_key || "", embedding_model: embCfg?.embedding_model || "local" },
          config_b: { db_type: dbB, config: dbConfigs[dbB] || {}, openai_api_key: embCfg?.openai_api_key || "", embedding_model: embCfg?.embedding_model || "local" },
        }),
      });
      setResult(await res.json());
    } catch {}
    finally { setLoading(false); }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>🧪 A/B Testing Engine</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <input className={styles.queryInput} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Query to test…" onKeyDown={e => e.key === "Enter" && runTest()} />
          <div className={styles.configRow}>
            <div className={styles.variantCfg}>
              <div className={styles.variantCfgLabel} style={{color:"var(--accent2)"}}>Variant A</div>
              <select className={styles.select} value={dbA} onChange={e => setDbA(e.target.value)}>
                {providers.map(p => <option key={p.name} value={p.name}>{p.display_name}</option>)}
              </select>
            </div>
            <div className={styles.vs}>VS</div>
            <div className={styles.variantCfg}>
              <div className={styles.variantCfgLabel} style={{color:"var(--green)"}}>Variant B</div>
              <select className={styles.select} value={dbB} onChange={e => setDbB(e.target.value)}>
                {providers.map(p => <option key={p.name} value={p.name}>{p.display_name}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.bottomRow}>
            <label className={styles.topkLabel}>Top-K: <b>{topK}</b></label>
            <input type="range" min={1} max={20} value={topK} onChange={e => setTopK(+e.target.value)} className={styles.slider} />
            <button className={styles.runBtn} onClick={runTest} disabled={loading || !query.trim()}>
              {loading ? "Running…" : "▶ Run A/B Test"}
            </button>
          </div>

          {result && (
            <div className={styles.results}>
              <div className={styles.variants}>
                <VariantBlock label="A" data={result.variant_a} isWinner={result.winner === "A"} />
                <VariantBlock label="B" data={result.variant_b} isWinner={result.winner === "B"} />
              </div>
              {result.winner && (
                <div className={styles.verdict}>
                  Variant <b>{result.winner}</b> wins based on relevance score + latency
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
