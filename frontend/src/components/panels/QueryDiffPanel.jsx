import { useState } from "react";
import styles from "./QueryDiffPanel.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function QueryDiffPanel({ providers, dbConfigs, embCfg, onClose }) {
  const [queryA, setQueryA] = useState("");
  const [queryB, setQueryB] = useState("");
  const [db, setDb] = useState(providers[0]?.name || "");
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [resultsA, setResultsA] = useState(null);
  const [resultsB, setResultsB] = useState(null);
  const [error, setError] = useState(null);

  async function compare() {
    if (!queryA.trim() || !queryB.trim() || !db) return;
    setLoading(true);
    setError(null);
    setResultsA(null);
    setResultsB(null);
    try {
      const payload = (q) => ({
        query: q,
        db_type: db,
        config: dbConfigs[db] || {},
        top_k: topK,
        ...embCfg,
      });
      const [resA, resB] = await Promise.all([
        fetch(`${API}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload(queryA)),
        }),
        fetch(`${API}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload(queryB)),
        }),
      ]);
      const [dataA, dataB] = await Promise.all([resA.json(), resB.json()]);
      if (!resA.ok) throw new Error(dataA.detail || `HTTP ${resA.status}`);
      if (!resB.ok) throw new Error(dataB.detail || `HTTP ${resB.status}`);
      setResultsA(dataA.results || []);
      setResultsB(dataB.results || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const idsA = new Set((resultsA || []).map(r => r.id));
  const idsB = new Set((resultsB || []).map(r => r.id));
  const overlap = resultsA && resultsB
    ? (resultsA || []).filter(r => idsB.has(r.id)).length
    : 0;

  function statusFor(id, side) {
    const inA = idsA.has(id);
    const inB = idsB.has(id);
    if (inA && inB) return "both";
    if (side === "A" && inA) return "only-a";
    if (side === "B" && inB) return "only-b";
    return "none";
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>Query Diff</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.queryRow}>
            <div className={styles.queryBlock}>
              <label className={styles.label} style={{ color: "var(--accent)" }}>Query A</label>
              <textarea
                className={styles.queryInput}
                value={queryA}
                onChange={e => setQueryA(e.target.value)}
                placeholder="First query…"
                rows={3}
              />
            </div>
            <div className={styles.vsDivider}>VS</div>
            <div className={styles.queryBlock}>
              <label className={styles.label} style={{ color: "var(--amber)" }}>Query B</label>
              <textarea
                className={styles.queryInput}
                value={queryB}
                onChange={e => setQueryB(e.target.value)}
                placeholder="Second query…"
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

          {resultsA && resultsB && (
            <>
              <div className={styles.overlapBar}>
                <span className={styles.legend}>
                  <span className={styles.dot} style={{ background: "var(--green)" }} /> Both
                </span>
                <span className={styles.legend}>
                  <span className={styles.dot} style={{ background: "var(--accent)" }} /> Only A
                </span>
                <span className={styles.legend}>
                  <span className={styles.dot} style={{ background: "var(--amber)" }} /> Only B
                </span>
                <span className={styles.overlapCount}>
                  {overlap} result{overlap !== 1 ? "s" : ""} in common
                </span>
              </div>

              <div className={styles.compareGrid}>
                <div className={styles.col}>
                  <div className={styles.colHeader} style={{ color: "var(--accent)" }}>
                    Query A
                    <span className={styles.colCount}>{resultsA.length}</span>
                  </div>
                  <div className={styles.list}>
                    {resultsA.map((item, i) => {
                      const status = statusFor(item.id, "A");
                      return (
                        <div key={i} className={`${styles.card} ${styles[`card-${status}`]}`}>
                          <span
                            className={styles.statusDot}
                            style={{
                              background: status === "both" ? "var(--green)" : status === "only-a" ? "var(--accent)" : "var(--text4)"
                            }}
                          />
                          <span className={styles.rank}>#{i + 1}</span>
                          <span className={styles.cardId}>{item.id}</span>
                          <span className={styles.score}>{((item.score ?? 0) * 100).toFixed(1)}%</span>
                        </div>
                      );
                    })}
                    {resultsA.length === 0 && <div className={styles.empty}>No results</div>}
                  </div>
                </div>

                <div className={styles.col}>
                  <div className={styles.colHeader} style={{ color: "var(--amber)" }}>
                    Query B
                    <span className={styles.colCount}>{resultsB.length}</span>
                  </div>
                  <div className={styles.list}>
                    {resultsB.map((item, i) => {
                      const status = statusFor(item.id, "B");
                      return (
                        <div key={i} className={`${styles.card} ${styles[`card-${status}`]}`}>
                          <span
                            className={styles.statusDot}
                            style={{
                              background: status === "both" ? "var(--green)" : status === "only-b" ? "var(--amber)" : "var(--text4)"
                            }}
                          />
                          <span className={styles.rank}>#{i + 1}</span>
                          <span className={styles.cardId}>{item.id}</span>
                          <span className={styles.score}>{((item.score ?? 0) * 100).toFixed(1)}%</span>
                        </div>
                      );
                    })}
                    {resultsB.length === 0 && <div className={styles.empty}>No results</div>}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={styles.compareBtn}
            onClick={compare}
            disabled={loading || !queryA.trim() || !queryB.trim() || !db}
          >
            {loading ? "Comparing…" : "Compare"}
          </button>
        </div>
      </div>
    </div>
  );
}
