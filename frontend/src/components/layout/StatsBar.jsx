import styles from "./StatsBar.module.css";

function latencyColor(ms) {
  if (ms < 500) return "#22d3a0";
  if (ms < 2000) return "#f59e0b";
  return "#f43f5e";
}

export default function StatsBar({ results, compareMode, meta, shown, hasMore }) {
  if (!results || results.size === 0) return null;

  if (!compareMode) {
    const [, data] = [...results.entries()][0];
    if (!data) return null;
    const scores = data.results.map((r) => r.score);
    const avg = scores.length
      ? ((scores.reduce((a, b) => a + b, 0) / scores.length) * 100).toFixed(1)
      : 0;
    const count = shown ?? data.results.length;
    return (
      <div className={styles.bar}>
        <span className={styles.pill}>
          <b>{count}</b> result{count !== 1 ? "s" : ""}
          {hasMore && <span className={styles.moreTag}> +more</span>}
        </span>
        <span className={styles.sep}>·</span>
        <span className={styles.pill}>
          avg score <b>{avg}%</b>
        </span>
        <span className={styles.sep}>·</span>
        <span className={styles.pill} style={{ color: latencyColor(data.latency_ms) }}>
          <b>{data.latency_ms}ms</b>
        </span>
        {meta?.dim && (
          <>
            <span className={styles.sep}>·</span>
            <span className={styles.pill} title={`Model: ${meta.model}`}>
              📐 <b>{meta.dim}D</b>
            </span>
          </>
        )}
        {data.error && <span className={styles.errPill}>⚠ {data.error}</span>}
      </div>
    );
  }

  const rows = [...results.entries()]
    .map(([db, data]) => {
      const scores = data.results.map((r) => r.score);
      const avg = scores.length
        ? ((scores.reduce((a, b) => a + b, 0) / scores.length) * 100).toFixed(1)
        : null;
      return { db, count: data.results.length, avg, latency: data.latency_ms, error: data.error };
    })
    .sort((a, b) => (parseFloat(b.avg) || 0) - (parseFloat(a.avg) || 0));

  return (
    <div className={styles.table}>
      <div className={styles.tableHeader}>
        <span>Database</span>
        <span>Results</span>
        <span>Avg Score</span>
        <span>Latency</span>
      </div>
      {rows.map((r) => (
        <div key={r.db} className={styles.tableRow}>
          <span className={styles.dbName}>{r.db}</span>
          <span>{r.error ? <span className={styles.errText}>Error</span> : r.count}</span>
          <span>{r.error || r.avg === null ? "—" : `${r.avg}%`}</span>
          <span style={{ color: latencyColor(r.latency) }}>{r.latency}ms</span>
        </div>
      ))}
    </div>
  );
}
