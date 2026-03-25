import { useState } from "react";
import styles from "./HybridSearchPanel.module.css";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function HybridSearchPanel({ selectedDBs, dbConfigs, embCfg, topK, onClose }) {
  const db = [...selectedDBs][0] || "";
  const [query, setQuery] = useState("");
  const [semWeight, setSemWeight] = useState(0.7);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [semanticResults, setSemanticResults] = useState(null);

  async function run() {
    if (!query.trim() || !db) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setSemanticResults(null);
    try {
      const kwWeight = Math.round((1 - semWeight) * 100) / 100;
      const body = {
        query,
        db_type: db,
        config: dbConfigs[db] || {},
        top_k: topK,
        openai_api_key: embCfg.openai_api_key || "",
        embedding_model: embCfg.embedding_model || "local",
        semantic_weight: semWeight,
        keyword_weight: kwWeight,
      };
      const [hybridRes, semanticRes] = await Promise.all([
        fetch(`${API}/search/hybrid`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
        compareMode
          ? fetch(`${API}/search`, { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query, db_type: db, config: dbConfigs[db] || {}, top_k: topK, ...embCfg }) })
          : Promise.resolve(null),
      ]);
      const hybridData = await hybridRes.json();
      if (!hybridRes.ok) throw new Error(hybridData.detail || `HTTP ${hybridRes.status}`);
      setResults(hybridData);
      if (semanticRes) {
        const semData = await semanticRes.json();
        setSemanticResults(semData.results || []);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const kwWeight = Math.round((1 - semWeight) * 100);
  const semPct = Math.round(semWeight * 100);

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>⚡ Hybrid Search Testing</span>
          <div className={styles.hRight}>
            <label className={styles.compToggle}>
              <input type="checkbox" checked={compareMode} onChange={e => setCompareMode(e.target.checked)} />
              Compare with semantic-only
            </label>
            <button className={styles.close} onClick={onClose}>✕</button>
          </div>
        </div>

        <div className={styles.body}>
          {/* Controls */}
          <div className={styles.controls}>
            <input
              className={styles.queryInput}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search in ${db || "selected DB"}…`}
              onKeyDown={e => e.key === "Enter" && run()}
            />

            <div className={styles.weightRow}>
              <div className={styles.weightLabel}>
                <span className={styles.sem}>Semantic {semPct}%</span>
                <span className={styles.kw}>Keyword {kwWeight}%</span>
              </div>
              <div className={styles.sliderWrap}>
                <div className={styles.sliderTrack}>
                  <div className={styles.semFill} style={{ width: `${semPct}%` }} />
                  <div className={styles.kwFill} style={{ width: `${kwWeight}%` }} />
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={semWeight}
                  onChange={e => setSemWeight(parseFloat(e.target.value))}
                  className={styles.slider}
                />
              </div>
            </div>

            <button className={styles.runBtn} onClick={run} disabled={loading || !query.trim() || !db}>
              {loading ? "Searching…" : "Run Hybrid Search"}
            </button>
          </div>

          {error && <div className={styles.err}>{error}</div>}

          {results && (
            <div className={styles.resultArea}>
              {compareMode && semanticResults ? (
                <div className={styles.compareGrid}>
                  <div className={styles.col}>
                    <div className={styles.colHeader}>
                      <span>Hybrid ({semPct}% sem + {kwWeight}% kw)</span>
                      <span className={styles.latBadge}>{results.latency_ms}ms</span>
                    </div>
                    <ResultList items={results.results} mode="hybrid" />
                  </div>
                  <div className={styles.col}>
                    <div className={styles.colHeader}>
                      <span>Semantic only (100%)</span>
                    </div>
                    <ResultList items={semanticResults} mode="semantic" />
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.resultMeta}>
                    {results.results.length} results · {results.latency_ms}ms ·
                    Semantic {semPct}% + Keyword {kwWeight}%
                  </div>
                  <ResultList items={results.results} mode="hybrid" />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultList({ items, mode }) {
  return (
    <div className={styles.list}>
      {items.map((item, i) => (
        <div key={`${item.id}-${i}`} className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.rank}>#{i + 1}</span>
            <span className={styles.cardId}>{item.id}</span>
            <div className={styles.scores}>
              {mode === "hybrid" && item.semantic_score !== undefined && (
                <>
                  <span className={styles.semScore} title="Semantic score">
                    🧠 {(item.semantic_score * 100).toFixed(1)}%
                  </span>
                  <span className={styles.kwScore} title="Keyword score">
                    🔤 {(item.keyword_score * 100).toFixed(1)}%
                  </span>
                  <span className={styles.hybScore} title="Hybrid score">
                    ⚡ {(item.hybrid_score * 100).toFixed(1)}%
                  </span>
                </>
              )}
              {mode === "semantic" && (
                <span className={styles.semScore}>
                  {(item.score * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          {item.metadata && Object.keys(item.metadata).length > 0 && (
            <div className={styles.meta}>
              {Object.entries(item.metadata).slice(0, 3).map(([k, v]) => (
                <span key={k} className={styles.metaChip}><b>{k}:</b> {String(v).slice(0, 60)}</span>
              ))}
            </div>
          )}
        </div>
      ))}
      {items.length === 0 && <div className={styles.empty}>No results</div>}
    </div>
  );
}
