import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./LatencyTimeline.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";
const POLL_MS = 5000;
const MAX_POINTS = 20;

/* ── SVG chart helpers ─────────────────────────────────────── */
const CHART_W = 600;
const CHART_H = 240;
const PAD_L = 52;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 36;
const PW = CHART_W - PAD_L - PAD_R;
const PH = CHART_H - PAD_T - PAD_B;

function toPoints(data, key, maxY) {
  if (!data.length) return "";
  return data
    .map((d, i) => {
      const x = PAD_L + (i / Math.max(data.length - 1, 1)) * PW;
      const y = PAD_T + PH - ((d[key] ?? 0) / (maxY || 1)) * PH;
      return `${x},${y}`;
    })
    .join(" ");
}

function GridLines({ maxY, steps = 4 }) {
  return (
    <>
      {Array.from({ length: steps + 1 }, (_, i) => {
        const frac = i / steps;
        const y = PAD_T + frac * PH;
        const val = Math.round(maxY * (1 - frac));
        return (
          <g key={i}>
            <line
              x1={PAD_L} y1={y} x2={PAD_L + PW} y2={y}
              stroke="var(--border)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6}
            />
            <text
              x={PAD_L - 6} y={y}
              textAnchor="end" dominantBaseline="middle"
              fill="var(--text3)" fontSize={9} fontFamily="inherit"
            >
              {val}
            </text>
          </g>
        );
      })}
    </>
  );
}

function XLabels({ count }) {
  return (
    <>
      {Array.from({ length: Math.min(count, 5) }, (_, i) => {
        const idx = Math.round(i * (count - 1) / 4);
        const x = PAD_L + (idx / Math.max(count - 1, 1)) * PW;
        return (
          <text
            key={i}
            x={x} y={CHART_H - 6}
            textAnchor="middle"
            fill="var(--text3)" fontSize={9} fontFamily="inherit"
          >
            -{count - 1 - idx}
          </text>
        );
      })}
      <text
        x={PAD_L + PW / 2} y={CHART_H + 2}
        textAnchor="middle"
        fill="var(--text4)" fontSize={9} fontFamily="inherit"
      >
        samples ago
      </text>
    </>
  );
}

function Line({ points, color, strokeWidth = 2 }) {
  if (!points) return null;
  return (
    <polyline
      points={points}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.9}
    />
  );
}

/* ── Main component ─────────────────────────────────────────── */
export default function LatencyTimeline({ onClose }) {
  const [history, setHistory] = useState([]);   // array of monitor snapshots
  const [stats, setStats] = useState(null);     // latest monitor data
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const intervalRef = useRef(null);

  const fetchMonitor = useCallback(async () => {
    try {
      const res = await fetch(`${API}/monitor`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
      setHistory(prev => {
        const next = [
          ...prev,
          {
            ts: Date.now(),
            p50: data.latency_p50_ms ?? data.p50 ?? 0,
            p95: data.latency_p95_ms ?? data.p95 ?? 0,
            p99: data.latency_p99_ms ?? data.p99 ?? 0,
          },
        ].slice(-MAX_POINTS);
        return next;
      });
      setError("");
    } catch (e) {
      setError(e.message || "Failed to reach /monitor");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => { fetchMonitor(); }, [fetchMonitor]);

  // Polling
  useEffect(() => {
    if (paused) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(fetchMonitor, POLL_MS);
    return () => clearInterval(intervalRef.current);
  }, [paused, fetchMonitor]);

  const hasData = history.length > 0;
  const noRequests = stats && (stats.total_requests === 0 || stats.request_count === 0);

  const maxY = hasData
    ? Math.ceil(Math.max(...history.map(d => d.p99), 10) * 1.15)
    : 100;

  const ptP50 = toPoints(history, "p50", maxY);
  const ptP95 = toPoints(history, "p95", maxY);
  const ptP99 = toPoints(history, "p99", maxY);

  // Latest values
  const last = history[history.length - 1] ?? {};
  const qps = stats?.qps ?? stats?.requests_per_second ?? 0;
  const errRate = stats?.error_rate ?? stats?.error_rate_pct ?? 0;

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.title}>Latency Timeline</span>
            {!paused && hasData && <span className={styles.liveDot} title="Live — polling every 5s" />}
          </div>
          <div className={styles.hRight}>
            <button
              className={`${styles.pauseBtn} ${paused ? styles.pauseBtnResume : ""}`}
              onClick={() => setPaused(p => !p)}
            >
              {paused ? "Resume" : "Pause"}
            </button>
            <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>

          {loading && (
            <div className={styles.loadingWrap}>
              <span className={styles.spinner} />
              <span>Connecting to monitor…</span>
            </div>
          )}

          {!loading && error && (
            <div className={styles.errorBox}>{error}</div>
          )}

          {!loading && !error && (noRequests || !hasData) && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <svg viewBox="0 0 32 32" width={40} height={40} fill="none">
                  <polyline points="2,28 10,18 16,22 22,10 30,14"
                    stroke="var(--border2)" strokeWidth={2.5}
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span>No requests recorded yet — run some searches</span>
              <span className={styles.emptySub}>Charts will appear automatically once data arrives.</span>
            </div>
          )}

          {!loading && !error && hasData && !noRequests && (
            <>
              {/* Summary stats */}
              <div className={styles.statsRow}>
                <div className={styles.statCard}>
                  <div className={styles.statVal}>{typeof qps === "number" ? qps.toFixed(2) : "—"}</div>
                  <div className={styles.statLabel}>QPS</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statVal} style={{ color: errRate > 5 ? "var(--red)" : "var(--green)" }}>
                    {typeof errRate === "number" ? errRate.toFixed(1) : "—"}%
                  </div>
                  <div className={styles.statLabel}>Error rate</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statVal} style={{ color: "var(--green)" }}>
                    {last.p50 ? `${last.p50}ms` : "—"}
                  </div>
                  <div className={styles.statLabel}>p50</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statVal} style={{ color: "var(--amber)" }}>
                    {last.p95 ? `${last.p95}ms` : "—"}
                  </div>
                  <div className={styles.statLabel}>p95</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statVal} style={{ color: "var(--red)" }}>
                    {last.p99 ? `${last.p99}ms` : "—"}
                  </div>
                  <div className={styles.statLabel}>p99</div>
                </div>
              </div>

              {/* Chart */}
              <div className={styles.chartWrap}>
                <svg
                  viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                  preserveAspectRatio="xMidYMid meet"
                  className={styles.svg}
                >
                  {/* Grid */}
                  <GridLines maxY={maxY} steps={4} />
                  <XLabels count={history.length} />

                  {/* Axes */}
                  <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PH}
                    stroke="var(--border2)" strokeWidth={1.5} />
                  <line x1={PAD_L} y1={PAD_T + PH} x2={PAD_L + PW} y2={PAD_T + PH}
                    stroke="var(--border2)" strokeWidth={1.5} />

                  {/* Y axis label */}
                  <text
                    x={10} y={PAD_T + PH / 2}
                    textAnchor="middle"
                    fill="var(--text3)" fontSize={9} fontFamily="inherit"
                    transform={`rotate(-90, 10, ${PAD_T + PH / 2})`}
                  >ms</text>

                  {/* Area fills */}
                  <polygon
                    points={`${PAD_L},${PAD_T + PH} ${ptP99} ${PAD_L + PW},${PAD_T + PH}`}
                    fill="var(--red)" opacity={0.06}
                  />
                  <polygon
                    points={`${PAD_L},${PAD_T + PH} ${ptP95} ${PAD_L + PW},${PAD_T + PH}`}
                    fill="var(--amber)" opacity={0.07}
                  />
                  <polygon
                    points={`${PAD_L},${PAD_T + PH} ${ptP50} ${PAD_L + PW},${PAD_T + PH}`}
                    fill="var(--green)" opacity={0.08}
                  />

                  {/* Lines */}
                  <Line points={ptP99} color="var(--red)" strokeWidth={1.8} />
                  <Line points={ptP95} color="var(--amber)" strokeWidth={1.8} />
                  <Line points={ptP50} color="var(--green)" strokeWidth={2} />

                  {/* Dots at last point */}
                  {[
                    { key: "p99", color: "var(--red)" },
                    { key: "p95", color: "var(--amber)" },
                    { key: "p50", color: "var(--green)" },
                  ].map(({ key, color }) => {
                    const val = last[key] ?? 0;
                    const x = PAD_L + PW;
                    const y = PAD_T + PH - (val / (maxY || 1)) * PH;
                    return (
                      <circle key={key} cx={x} cy={y} r={4}
                        fill={color} stroke="var(--surface)" strokeWidth={2} />
                    );
                  })}
                </svg>
              </div>

              {/* Legend */}
              <div className={styles.legend}>
                {[
                  { label: "p50", color: "var(--green)" },
                  { label: "p95", color: "var(--amber)" },
                  { label: "p99", color: "var(--red)" },
                ].map(({ label, color }) => (
                  <div key={label} className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: color }} />
                    <span className={styles.legendLabel}>{label}</span>
                  </div>
                ))}
                <span className={styles.pollNote}>
                  {paused ? "Paused" : `Polling every ${POLL_MS / 1000}s`}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerNote}>
            {hasData ? `${history.length} data point${history.length !== 1 ? "s" : ""} (last ${MAX_POINTS} kept)` : "Waiting for data…"}
          </span>
          <button className={styles.closeBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
