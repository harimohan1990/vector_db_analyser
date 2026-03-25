import { useEffect, useState } from "react";
import styles from "./Dashboard.module.css";

const DB_ICONS = {
  pinecone: "🌲", chroma: "🎨", deeplake: "🌊", vespa: "🚀", milvus: "⚡",
  scann: "🔎", weaviate: "🕸️", qdrant: "🎯", vald: "🔷", faiss: "📦",
  opensearch: "🔍", pgvector: "🐘", cassandra: "💫", elasticsearch: "🔶", clickhouse: "🖱️",
};

function relTime(iso) {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

function latencyColor(ms) {
  if (ms < 500) return "#22d3a0";
  if (ms < 2000) return "#f59e0b";
  return "#f43f5e";
}

export default function Dashboard({ onClose, onRerun }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/history?limit=100`)
      .then((r) => r.json())
      .then((data) => { setHistory(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function clearAll() {
    await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/history`, { method: "DELETE" });
    setHistory([]);
  }

  // Compute per-DB stats
  const dbCounts = {}, dbLatencies = {}, dbScores = {};
  history.forEach((h) => {
    let dbs = [];
    try { dbs = JSON.parse(h.db_types); } catch { dbs = [h.db_types]; }
    dbs.forEach((db) => {
      dbCounts[db] = (dbCounts[db] || 0) + 1;
      if (!dbLatencies[db]) dbLatencies[db] = [];
      dbLatencies[db].push(h.latency_ms || 0);
      if (!dbScores[db]) dbScores[db] = [];
      if (h.avg_score) dbScores[db].push(h.avg_score);
    });
  });

  const topDB = Object.entries(dbCounts).sort((a, b) => b[1] - a[1])[0];
  const avgLatencyPerDB = Object.entries(dbLatencies)
    .map(([db, lats]) => ({ db, avg: Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) }))
    .sort((a, b) => a.avg - b.avg);
  const maxLatency = Math.max(...avgLatencyPerDB.map((x) => x.avg), 1);
  const totalResults = history.reduce((a, h) => a + (h.results_count || 0), 0);

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>📊 Analytics Dashboard</h2>
            <p className={styles.subtitle}>Search history and performance insights</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Metric cards */}
        <div className={styles.metrics}>
          {[
            { label: "Total Searches", value: history.length, icon: "🔍" },
            { label: "Total Results", value: totalResults, icon: "📦" },
            { label: "Most Used DB", value: topDB ? `${DB_ICONS[topDB[0]] || ""} ${topDB[0]}` : "—", icon: "🏆" },
            { label: "DBs Used", value: Object.keys(dbCounts).length, icon: "🗄️" },
          ].map((m) => (
            <div key={m.label} className={styles.metricCard}>
              <span className={styles.metricIcon}>{m.icon}</span>
              <span className={styles.metricValue}>{m.value}</span>
              <span className={styles.metricLabel}>{m.label}</span>
            </div>
          ))}
        </div>

        <div className={styles.body}>
          {/* Latency chart */}
          {avgLatencyPerDB.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Avg Latency by Database</h3>
              <div className={styles.chart}>
                {avgLatencyPerDB.map(({ db, avg }) => (
                  <div key={db} className={styles.chartRow}>
                    <span className={styles.chartLabel}>{DB_ICONS[db] || "🗄"} {db}</span>
                    <div className={styles.chartBarWrap}>
                      <div
                        className={styles.chartBar}
                        style={{
                          width: `${(avg / maxLatency) * 100}%`,
                          background: latencyColor(avg),
                          boxShadow: `0 0 8px ${latencyColor(avg)}`,
                        }}
                      />
                    </div>
                    <span className={styles.chartVal} style={{ color: latencyColor(avg) }}>{avg}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History table */}
          <div className={styles.section}>
            <div className={styles.sectionRow}>
              <h3 className={styles.sectionTitle}>Recent Searches</h3>
              {history.length > 0 && (
                <button className={styles.clearBtn} onClick={clearAll}>Clear all</button>
              )}
            </div>

            {loading && <p className={styles.empty}>Loading...</p>}
            {!loading && history.length === 0 && (
              <p className={styles.empty}>No searches yet. Start searching to see history here.</p>
            )}

            {!loading && history.length > 0 && (
              <div className={styles.histTable}>
                <div className={styles.histHead}>
                  <span>Query</span><span>DBs</span><span>Results</span><span>Latency</span><span>Time</span><span></span>
                </div>
                {history.slice(0, 25).map((h) => {
                  let dbs = [];
                  try { dbs = JSON.parse(h.db_types); } catch { dbs = [h.db_types]; }
                  return (
                    <div key={h.id} className={styles.histRow}>
                      <span className={styles.histQuery} title={h.query}>{h.query}</span>
                      <span className={styles.histDBs}>{dbs.map((d) => DB_ICONS[d] || "🗄").join(" ")}</span>
                      <span>{h.results_count ?? 0}</span>
                      <span style={{ color: latencyColor(h.latency_ms) }}>{h.latency_ms ? `${h.latency_ms}ms` : "—"}</span>
                      <span className={styles.histTime}>{relTime(h.timestamp)}</span>
                      <button className={styles.rerunBtn} onClick={() => { onRerun(h.query); onClose(); }} title="Re-run">↩</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
