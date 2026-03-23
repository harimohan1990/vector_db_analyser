import { useState, memo } from "react";
import styles from "./EmbeddingGraph.module.css";

const SCORE_COLOR = (s) => s >= 0.85 ? "var(--green)" : s >= 0.6 ? "var(--amber)" : "var(--red)";
const SCORE_HEX = (s) => s >= 0.85 ? "#22d3a0" : s >= 0.6 ? "#f59e0b" : "#f43f5e";

const EmbeddingGraph = memo(function EmbeddingGraph({ results, onClose }) {
  const [tooltip, setTooltip] = useState(null);

  const empty = !results || results.length === 0;

  const W = 100;
  const H = 280;
  const PAD = 20;
  const innerW = W - PAD * 2;

  const points = empty ? [] : results.map((item, i) => {
    const x = PAD + item.score * 0.85 * innerW;
    const y = H / 2 + Math.sin(i * 1.8) * (H * 0.35);
    return { x, y, item, i };
  });

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <span className={styles.title}>Embedding Graph</span>
            <span className={styles.subtitle}>
              {empty ? "Run a search to visualize results" : `${results.length} results · score-based layout`}
            </span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {empty ? (
          <div className={styles.emptyState}>
            No results yet — perform a search to see the scatter plot.
          </div>
        ) : (
          <>
            <div className={styles.svgWrap}>
              <svg
                viewBox={`0 0 640 ${H}`}
                preserveAspectRatio="none"
                className={styles.svg}
                aria-label="2D scatter plot of search results"
              >
                {[0.25, 0.5, 0.75].map(v => (
                  <line
                    key={v}
                    x1={PAD + v * innerW * 6.4}
                    y1={PAD}
                    x2={PAD + v * innerW * 6.4}
                    y2={H - PAD}
                    stroke="rgba(255,255,255,0.04)"
                    strokeWidth={1}
                    strokeDasharray="3 4"
                  />
                ))}
                <line
                  x1={PAD} y1={H / 2}
                  x2={640 - PAD} y2={H / 2}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={1}
                />
                {points.map(({ x, y, item, i }) => (
                  <g key={item.id + i}>
                    <circle
                      cx={x * 6.4}
                      cy={y}
                      r={7}
                      fill={SCORE_HEX(item.score)}
                      fillOpacity={0.75}
                      stroke={SCORE_HEX(item.score)}
                      strokeWidth={1.5}
                      strokeOpacity={0.9}
                      style={{ animationDelay: `${i * 60}ms` }}
                      className={styles.circle}
                      onMouseEnter={() => setTooltip({ item, i, cx: x * 6.4, cy: y })}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    <text
                      x={x * 6.4}
                      y={y + 18}
                      textAnchor="middle"
                      fontSize={9}
                      fill="rgba(255,255,255,0.35)"
                      className={styles.rankLabel}
                    >
                      #{i + 1}
                    </text>
                  </g>
                ))}
                {tooltip && (() => {
                  const { item, cx, cy } = tooltip;
                  const tipW = 130;
                  const tipH = 38;
                  const tx = Math.min(Math.max(cx - tipW / 2, 4), 640 - tipW - 4);
                  const ty = cy < H / 2 + 40 ? cy + 18 : cy - tipH - 12;
                  return (
                    <g>
                      <rect x={tx} y={ty} width={tipW} height={tipH} rx={6} fill="rgba(13,17,28,0.92)" stroke="rgba(108,99,255,0.3)" strokeWidth={1} />
                      <text x={tx + tipW / 2} y={ty + 14} textAnchor="middle" fontSize={9} fill="rgba(200,210,230,0.7)">
                        {String(item.id).slice(0, 18)}
                      </text>
                      <text x={tx + tipW / 2} y={ty + 27} textAnchor="middle" fontSize={11} fill={SCORE_HEX(item.score)} fontWeight="700">
                        {(item.score * 100).toFixed(1)}%
                      </text>
                    </g>
                  );
                })()}
              </svg>
              <div className={styles.axisWrap}>
                <span className={styles.axisLeft}>← Low Relevance</span>
                <span className={styles.axisRight}>High Relevance →</span>
              </div>
            </div>
            <div className={styles.legend}>
              <span className={styles.legendItem} style={{ color: "var(--green)" }}>● High ≥85%</span>
              <span className={styles.legendItem} style={{ color: "var(--amber)" }}>● Mid ≥60%</span>
              <span className={styles.legendItem} style={{ color: "var(--red)" }}>● Low &lt;60%</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export default EmbeddingGraph;
