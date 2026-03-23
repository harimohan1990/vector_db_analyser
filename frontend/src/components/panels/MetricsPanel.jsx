import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./MetricsPanel.module.css";

const API = "http://localhost:8000";

function latColor(ms) {
  if (ms < 300)  return "var(--green)";
  if (ms < 800)  return "var(--amber)";
  return "var(--red)";
}

/* Animated count-up number */
function CountUp({ target, suffix = "", decimals = 0 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = parseFloat(target) || 0;
    if (end === 0) { setVal(0); return; }
    const duration = 600;
    const step = 16;
    const increment = end / (duration / step);
    const timer = setInterval(() => {
      start = Math.min(start + increment, end);
      setVal(start);
      if (start >= end) clearInterval(timer);
    }, step);
    return () => clearInterval(timer);
  }, [target]);
  return <>{decimals > 0 ? val.toFixed(decimals) : Math.round(val)}{suffix}</>;
}

/* Mini SVG sparkline from latency array */
function Sparkline({ values, color = "var(--accent)" }) {
  if (!values || values.length < 2) return null;
  const w = 120, h = 32;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - (v / max) * (h - 4),
  ]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  return (
    <svg width={w} height={h} className={styles.sparkline}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2" fill={color} opacity={i === pts.length - 1 ? 1 : 0.4} />
      ))}
    </svg>
  );
}

/* Stat card with animated value */
function StatCard({ label, val, rawVal, icon, color, suffix = "", decimals = 0, sparkValues }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statVal} style={color ? { color } : {}}>
        {typeof rawVal === "number"
          ? <CountUp target={rawVal} suffix={suffix} decimals={decimals} />
          : val}
      </div>
      <div className={styles.statLabel}>{label}</div>
      {sparkValues && <Sparkline values={sparkValues} color={color || "var(--accent)"} />}
    </div>
  );
}

export default function MetricsPanel({ onClose, onRerun }) {
  const [metrics, setMetrics]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [cleared, setCleared]       = useState(false);
  const [rerunFlash, setRerunFlash] = useState(null); // query being rerun
  const intervalRef = useRef(null);

  const fetchMetrics = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res  = await fetch(`${API}/metrics`);
      const data = await res.json();
      setMetrics(data);
    } catch {/* ignore */}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => fetchMetrics(true), 5000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, fetchMetrics]);

  async function clearHistory() {
    await fetch(`${API}/history`, { method: "DELETE" });
    setCleared(true);
    fetchMetrics();
    setTimeout(() => setCleared(false), 2000);
  }

  function handleRerun(query) {
    setRerunFlash(query);
    setTimeout(() => {
      setRerunFlash(null);
      onRerun?.(query);
    }, 400);
  }

  const dbEntries = metrics ? Object.entries(metrics.db_breakdown) : [];
  const maxLatency = dbEntries.length ? Math.max(...dbEntries.map(([, v]) => v.avg_latency), 1) : 1;

  // Build latency trend from recent queries (oldest→newest)
  const latencyTrend = metrics?.recent
    ? [...metrics.recent].reverse().map(r => r.latency_ms)
    : [];

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* ── Header ─────────────────────────────────── */}
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.title}>📈 Performance Metrics</span>
            {autoRefresh && <span className={styles.liveDot} title="Auto-refreshing every 5s" />}
          </div>
          <div className={styles.hRight}>
            <label className={styles.refreshToggle}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh 5s
            </label>
            <button
              className={`${styles.refreshBtn} ${refreshing ? styles.refreshBtnSpin : ""}`}
              onClick={() => fetchMetrics()}
              disabled={refreshing}
              title="Refresh now"
            >
              <span className={`${styles.refreshIcon} ${refreshing ? styles.spinning : ""}`}>↺</span>
              {refreshing ? " Refreshing…" : " Refresh"}
            </button>
            <button
              className={styles.clearBtn}
              onClick={clearHistory}
              title="Clear all history"
            >
              {cleared ? "✓ Cleared" : "🗑 Clear"}
            </button>
            <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────── */}
        <div className={styles.body}>

          {loading && (
            <div className={styles.loadingWrap}>
              <div className={styles.loadingSpinner} />
              <span>Loading metrics…</span>
            </div>
          )}

          {!loading && metrics && (
            <>
              {/* Stat cards */}
              <div className={styles.statsGrid}>
                <StatCard
                  label="Total Queries" icon="🔍"
                  rawVal={metrics.total_queries}
                />
                <StatCard
                  label="Total Results" icon="📦"
                  rawVal={metrics.total_results}
                />
                <StatCard
                  label="Avg Latency" icon="⚡"
                  rawVal={metrics.avg_latency_ms} suffix="ms"
                  color={latColor(metrics.avg_latency_ms)}
                  sparkValues={latencyTrend}
                />
                <StatCard
                  label="P95 Latency" icon="📊"
                  rawVal={metrics.p95_latency_ms} suffix="ms"
                  color={latColor(metrics.p95_latency_ms)}
                />
                <StatCard
                  label="Avg Score" icon="🎯"
                  rawVal={metrics.avg_score * 100} suffix="%" decimals={1}
                  color={metrics.avg_score > 0.7 ? "var(--green)" : metrics.avg_score > 0.4 ? "var(--amber)" : "var(--red)"}
                />
                <StatCard
                  label="Embed Cache" icon="💾"
                  rawVal={metrics.cache_size}
                />
              </div>

              {/* Per-DB breakdown */}
              {dbEntries.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Per-Database Breakdown</div>
                  <div className={styles.dbTable}>
                    <div className={styles.dbTableHead}>
                      <span>Database</span>
                      <span>Queries</span>
                      <span>Avg Latency</span>
                      <span>Results</span>
                      <span className={styles.barCol}>Latency Bar</span>
                    </div>
                    {dbEntries
                      .sort((a, b) => b[1].queries - a[1].queries)
                      .map(([db, info], idx) => (
                        <div key={db} className={`${styles.dbRow} ${idx === 0 ? styles.dbRowTop : ""}`}>
                          <span className={styles.dbRowName}>
                            {idx === 0 && <span className={styles.rankBadge}>⭐</span>}
                            {db}
                          </span>
                          <span className={styles.dbRowVal}>{info.queries}</span>
                          <span className={styles.dbRowVal} style={{ color: latColor(info.avg_latency) }}>
                            {info.avg_latency}ms
                          </span>
                          <span className={styles.dbRowVal}>{info.total_results.toLocaleString()}</span>
                          <div className={styles.latBarWrap}>
                            <div
                              className={styles.latFill}
                              style={{
                                width: `${Math.max(4, (info.avg_latency / maxLatency) * 100)}%`,
                                background: latColor(info.avg_latency),
                              }}
                            />
                            <span className={styles.latPct}>
                              {Math.round((info.avg_latency / maxLatency) * 100)}%
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Recent queries */}
              {metrics.recent?.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Recent Queries</div>
                  <div className={styles.recentList}>
                    {metrics.recent.map((r, i) => {
                      const isFlashing = rerunFlash === r.query;
                      return (
                        <div
                          key={i}
                          className={`${styles.recentRow} ${isFlashing ? styles.rerunFlash : ""}`}
                          onClick={() => handleRerun(r.query)}
                          title="Click to re-run this query"
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => e.key === "Enter" && handleRerun(r.query)}
                        >
                          <span className={styles.rerunIcon}>▶</span>
                          <span className={styles.recentQuery}>{r.query}</span>
                          <div className={styles.recentRight}>
                            <span className={styles.recentDB}>
                              {(r.db_types || []).join(", ")}
                            </span>
                            <span className={styles.recentLat} style={{ color: latColor(r.latency_ms) }}>
                              {r.latency_ms}ms
                            </span>
                            <span className={styles.recentCount}>
                              {r.results_count} result{r.results_count !== 1 ? "s" : ""}
                            </span>
                            <span className={styles.recentScore}>
                              {r.avg_score > 0 ? `${(r.avg_score * 100).toFixed(0)}%` : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {metrics.total_queries === 0 && (
                <div className={styles.empty}>
                  <span className={styles.emptyIcon}>🔍</span>
                  <span>No query history yet.</span>
                  <span className={styles.emptySub}>Run some searches and metrics will appear here.</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
