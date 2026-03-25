import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./ProductionMonitor.module.css";
const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function latColor(ms) { return ms < 200 ? "var(--green)" : ms < 600 ? "var(--amber)" : "var(--red)"; }

function MiniChart({ data, color = "var(--accent)", height = 48 }) {
  if (!data || data.length < 2) return null;
  const w = 240, h = height;
  const max = Math.max(...data.map(d => d.count), 1);
  const pts = data.map((d, i) => [(i / (data.length - 1)) * w, h - (d.count / max) * (h - 4)]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const fill = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") + ` L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h}>
      <path d={fill} fill={color} opacity={0.08} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ProductionMonitor({ onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [window_, setWindow] = useState(300);
  const intervalRef = useRef(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(`${API}/monitor?window=${window_}`);
      setData(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, [window_]);

  useEffect(() => { fetch_(); }, [fetch_]);
  useEffect(() => {
    if (autoRefresh) { intervalRef.current = setInterval(fetch_, 5000); }
    else { clearInterval(intervalRef.current); }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, fetch_]);

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>📡 Production Monitor</span>
          <div className={styles.hRight}>
            <select className={styles.windowSelect} value={window_} onChange={e => setWindow(+e.target.value)}>
              <option value={60}>1 min</option>
              <option value={300}>5 min</option>
              <option value={900}>15 min</option>
              <option value={3600}>1 hour</option>
            </select>
            <label className={styles.autoToggle}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              Auto
            </label>
            <button className={styles.refreshBtn} onClick={fetch_}>↺</button>
            <button className={styles.close} onClick={onClose}>✕</button>
          </div>
        </div>
        <div className={styles.body}>
          {loading ? <div className={styles.loading}><div className={styles.spinner} /> Loading…</div> : data && (
            <>
              <div className={styles.statsGrid}>
                <div className={styles.stat}>
                  <div className={styles.statIcon}>⚡</div>
                  <div className={styles.statVal}>{data.qps}</div>
                  <div className={styles.statLabel}>QPS</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statIcon}>🔴</div>
                  <div className={styles.statVal} style={{color: data.error_rate > 0.05 ? "var(--red)" : "var(--green)"}}>{(data.error_rate*100).toFixed(1)}%</div>
                  <div className={styles.statLabel}>Error Rate</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statIcon}>⏱</div>
                  <div className={styles.statVal} style={{color:latColor(data.latency?.avg)}}>{data.latency?.avg ?? 0}ms</div>
                  <div className={styles.statLabel}>Avg Latency</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statIcon}>📊</div>
                  <div className={styles.statVal} style={{color:latColor(data.latency?.p95)}}>{data.latency?.p95 ?? 0}ms</div>
                  <div className={styles.statLabel}>P95</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statIcon}>🔢</div>
                  <div className={styles.statVal}>{data.latency?.count ?? 0}</div>
                  <div className={styles.statLabel}>Requests</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statIcon}>🏎</div>
                  <div className={styles.statVal} style={{color:latColor(data.latency?.p99)}}>{data.latency?.p99 ?? 0}ms</div>
                  <div className={styles.statLabel}>P99</div>
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionTitle}>Traffic Timeline</div>
                <div className={styles.chartBox}>
                  <MiniChart data={data.timeline} color="var(--accent)" height={64} />
                  <div className={styles.chartMeta}>
                    <span>0</span><span>requests/bucket</span><span>{Math.max(...(data.timeline||[]).map(d=>d.count),1)}</span>
                  </div>
                </div>
              </div>

              {Object.keys(data.endpoints || {}).length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Endpoint Breakdown</div>
                  <div className={styles.endpointTable}>
                    <div className={styles.tableHead}>
                      <span>Endpoint</span><span>Calls</span><span>Avg Lat</span><span>Errors</span>
                    </div>
                    {Object.entries(data.endpoints).sort((a,b)=>b[1].count-a[1].count).slice(0,10).map(([ep, v]) => (
                      <div key={ep} className={styles.tableRow}>
                        <span className={styles.epName}>{ep}</span>
                        <span>{v.count}</span>
                        <span style={{color:latColor(v.avg_lat)}}>{v.avg_lat}ms</span>
                        <span style={{color:v.errors>0?"var(--red)":"var(--text4)"}}>{v.errors}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
