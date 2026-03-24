import { useState, useRef, useCallback } from "react";
import styles from "./VectorMap2D.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

const MODELS = [
  { value: "local", label: "Local (default)" },
  { value: "text-embedding-3-small", label: "text-embedding-3-small (OpenAI)" },
];

function Tooltip({ text, x, y, svgW, svgH }) {
  if (!text) return null;
  const flip = x > svgW * 0.7;
  const flipY = y > svgH * 0.75;
  return (
    <g>
      <rect
        x={flip ? x - 160 : x + 10}
        y={flipY ? y - 36 : y - 36}
        width={150}
        height={28}
        rx={5}
        fill="var(--surface)"
        stroke="var(--border2)"
        strokeWidth={1}
        opacity={0.97}
      />
      <text
        x={flip ? x - 85 : x + 85}
        y={flipY ? y - 17 : y - 17}
        textAnchor="middle"
        fill="var(--text)"
        fontSize={11}
        fontFamily="inherit"
      >
        {text.length > 26 ? text.slice(0, 25) + "…" : text}
      </text>
    </g>
  );
}

export default function VectorMap2D({ onClose }) {
  const [texts, setTexts] = useState("");
  const [model, setModel] = useState("local");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [points, setPoints] = useState([]);
  const [method, setMethod] = useState("");
  const [hovered, setHovered] = useState(null);
  const svgRef = useRef(null);

  const SVG_W = 600;
  const SVG_H = 400;
  const PAD = 44;

  const handleVisualize = useCallback(async () => {
    const lines = texts.split("\n").map(t => t.trim()).filter(Boolean).slice(0, 20);
    if (lines.length < 2) {
      setError("Enter at least 2 texts (one per line).");
      return;
    }
    setError("");
    setLoading(true);
    setPoints([]);
    setMethod("");
    try {
      const body = { texts: lines, embedding_model: model };
      if (model !== "local" && apiKey) body.openai_api_key = apiKey;
      const res = await fetch(`${API}/visualize/tsne`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      setPoints(data.points || []);
      setMethod(data.method || "");
    } catch (e) {
      setError(e.message || "Failed to fetch visualization.");
    } finally {
      setLoading(false);
    }
  }, [texts, model, apiKey]);

  // Scale points to SVG viewport
  const scaledPoints = (() => {
    if (!points.length) return [];
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    return points.map(p => ({
      ...p,
      sx: PAD + ((p.x - minX) / rangeX) * (SVG_W - PAD * 2),
      sy: PAD + ((p.y - minY) / rangeY) * (SVG_H - PAD * 2),
    }));
  })();

  const gridLinesX = [0.25, 0.5, 0.75].map(
    f => PAD + f * (SVG_W - PAD * 2)
  );
  const gridLinesY = [0.25, 0.5, 0.75].map(
    f => PAD + f * (SVG_H - PAD * 2)
  );

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>Vector Map 2D</span>
          <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.controls}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Texts <span className={styles.hint}>(one per line, up to 20)</span></label>
              <textarea
                className={styles.textarea}
                rows={5}
                placeholder={"machine learning\nnatural language processing\ndeep neural networks\n..."}
                value={texts}
                onChange={e => setTexts(e.target.value)}
                spellCheck={false}
              />
            </div>

            <div className={styles.row}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Embedding model</label>
                <select
                  className={styles.select}
                  value={model}
                  onChange={e => setModel(e.target.value)}
                >
                  {MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {model !== "local" && (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>OpenAI API key</label>
                  <input
                    type="password"
                    className={styles.input}
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              className={styles.vizBtn}
              onClick={handleVisualize}
              disabled={loading}
            >
              {loading ? (
                <><span className={styles.spinner} /> Visualizing…</>
              ) : "Visualize"}
            </button>
          </div>

          {/* Chart */}
          {(scaledPoints.length > 0 || loading) && (
            <div className={styles.chartWrap}>
              {method && (
                <div className={styles.methodBadge}>{method}</div>
              )}

              {loading && (
                <div className={styles.chartLoading}>
                  <span className={styles.spinnerLg} />
                  <span>Computing projections…</span>
                </div>
              )}

              {!loading && scaledPoints.length > 0 && (
                <div className={styles.svgScroll}>
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                    preserveAspectRatio="xMidYMid meet"
                    className={styles.svg}
                  >
                    {/* Grid lines */}
                    {gridLinesX.map((gx, i) => (
                      <line key={`gx${i}`} x1={gx} y1={PAD} x2={gx} y2={SVG_H - PAD}
                        stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
                    ))}
                    {gridLinesY.map((gy, i) => (
                      <line key={`gy${i}`} x1={PAD} y1={gy} x2={SVG_W - PAD} y2={gy}
                        stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
                    ))}

                    {/* Axes */}
                    <line x1={PAD} y1={SVG_H - PAD} x2={SVG_W - PAD} y2={SVG_H - PAD}
                      stroke="var(--border2)" strokeWidth={1.5} />
                    <line x1={PAD} y1={PAD} x2={PAD} y2={SVG_H - PAD}
                      stroke="var(--border2)" strokeWidth={1.5} />

                    {/* Axis labels */}
                    <text x={SVG_W / 2} y={SVG_H - 8} textAnchor="middle"
                      fill="var(--text3)" fontSize={11} fontFamily="inherit">Dimension 1</text>
                    <text x={12} y={SVG_H / 2} textAnchor="middle"
                      fill="var(--text3)" fontSize={11} fontFamily="inherit"
                      transform={`rotate(-90, 12, ${SVG_H / 2})`}>Dimension 2</text>

                    {/* Points */}
                    {scaledPoints.map((p, i) => {
                      const label = p.text.length > 20 ? p.text.slice(0, 19) + "…" : p.text;
                      const isHov = hovered === i;
                      return (
                        <g key={i}
                          onMouseEnter={() => setHovered(i)}
                          onMouseLeave={() => setHovered(null)}
                          style={{ cursor: "pointer" }}
                        >
                          {/* Glow ring on hover */}
                          {isHov && (
                            <circle cx={p.sx} cy={p.sy} r={14}
                              fill="var(--accent)" opacity={0.15} />
                          )}
                          <circle cx={p.sx} cy={p.sy} r={6}
                            fill={isHov ? "var(--accent2)" : "var(--accent)"}
                            stroke={isHov ? "var(--text)" : "var(--surface)"}
                            strokeWidth={isHov ? 2 : 1.5}
                            style={{ transition: "r 0.12s, fill 0.12s" }}
                          />
                          <text
                            x={p.sx}
                            y={p.sy + 18}
                            textAnchor="middle"
                            fill={isHov ? "var(--text)" : "var(--text2)"}
                            fontSize={10}
                            fontFamily="inherit"
                            style={{ pointerEvents: "none", userSelect: "none" }}
                          >
                            {label}
                          </text>
                        </g>
                      );
                    })}

                    {/* Tooltip on hover */}
                    {hovered !== null && scaledPoints[hovered] && (
                      <Tooltip
                        text={scaledPoints[hovered].text}
                        x={scaledPoints[hovered].sx}
                        y={scaledPoints[hovered].sy}
                        svgW={SVG_W}
                        svgH={SVG_H}
                      />
                    )}
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerNote}>
            {scaledPoints.length > 0
              ? `${scaledPoints.length} point${scaledPoints.length !== 1 ? "s" : ""} plotted`
              : "Enter texts above and click Visualize"}
          </span>
          <button className={styles.closeBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
