import { useState, useMemo } from "react";
import styles from "./SimilarityHeatmap.module.css";

/* ── Similarity helpers ────────────────────────────────────── */

/** Word-overlap Jaccard similarity between two strings */
function wordSimilarity(a, b) {
  const tokA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const tokB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (!tokA.size && !tokB.size) return 1;
  if (!tokA.size || !tokB.size) return 0;
  let inter = 0;
  for (const w of tokA) if (tokB.has(w)) inter++;
  return inter / (tokA.size + tokB.size - inter);
}

/** Normalise an array to [0,1] */
function normalise(arr) {
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  if (max === min) return arr.map(() => 1);
  return arr.map(v => (v - min) / (max - min));
}

/** Build N×N similarity matrix */
function buildMatrix(items, mode) {
  const n = items.length;
  const mat = Array.from({ length: n }, () => new Array(n).fill(0));
  if (mode === "scores") {
    // Treat scores as proximity: sim(i,j) = 1 - |normi - normj|
    const norm = normalise(items.map(it => it.score ?? 0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        mat[i][j] = i === j ? 1 : +(1 - Math.abs(norm[i] - norm[j])).toFixed(4);
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        mat[i][j] = i === j ? 1 : +wordSimilarity(items[i].text, items[j].text).toFixed(4);
      }
    }
  }
  return mat;
}

/** Interpolate cold→hot color for value in [0,1] */
function heatColor(v) {
  // blue(0) → teal(0.5) → red(1)
  const r = Math.round(v < 0.5 ? 30 + v * 2 * 180 : 210 + (v - 0.5) * 2 * 40);
  const g = Math.round(v < 0.5 ? 100 + v * 2 * 80 : 180 - (v - 0.5) * 2 * 120);
  const b = Math.round(v < 0.5 ? 220 - v * 2 * 100 : 120 - (v - 0.5) * 2 * 90);
  return `rgb(${r},${g},${b})`;
}

function trunc(str, n) {
  return str && str.length > n ? str.slice(0, n - 1) + "…" : str;
}

const CELL = 52; // px per cell in SVG units
const HEADER = 68; // label area

export default function SimilarityHeatmap({ results, onClose }) {
  const [mode, setMode] = useState("results"); // "results" | "texts"
  const [textInput, setTextInput] = useState("");
  const [matrix, setMatrix] = useState(null);
  const [labels, setLabels] = useState([]);
  const [computed, setComputed] = useState(false);

  const hasResults = results && results.length >= 2;

  function handleCompute() {
    let items;
    if (mode === "results") {
      if (!hasResults) return;
      items = results.slice(0, 10).map(r => ({
        label: trunc(String(r.id ?? ""), 12),
        text: String(r.id ?? ""),
        score: r.score ?? 0,
      }));
      const mat = buildMatrix(items.map(it => ({ score: it.score })), "scores");
      setLabels(items.map(it => it.label));
      setMatrix(mat);
    } else {
      const lines = textInput.split("\n").map(t => t.trim()).filter(Boolean).slice(0, 10);
      if (lines.length < 2) return;
      items = lines.map(l => ({ text: l, label: trunc(l, 12) }));
      const mat = buildMatrix(items, "texts");
      setLabels(items.map(it => it.label));
      setMatrix(mat);
    }
    setComputed(true);
  }

  const n = labels.length;
  const svgW = HEADER + n * CELL;
  const svgH = HEADER + n * CELL + 32; // +32 for legend

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>Similarity Heatmap</span>
          <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div className={styles.body}>

          {/* Toggle */}
          <div className={styles.toggleRow}>
            <button
              className={`${styles.toggleBtn} ${mode === "results" ? styles.toggleActive : ""}`}
              onClick={() => { setMode("results"); setComputed(false); }}
              disabled={!hasResults}
              title={!hasResults ? "No results passed to this panel" : undefined}
            >
              From last results
            </button>
            <button
              className={`${styles.toggleBtn} ${mode === "texts" ? styles.toggleActive : ""}`}
              onClick={() => { setMode("texts"); setComputed(false); }}
            >
              Enter texts manually
            </button>
          </div>

          {!hasResults && mode === "results" && (
            <div className={styles.infoNote}>
              No search results available. Switch to "Enter texts manually" or run a search first.
            </div>
          )}

          {mode === "texts" && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                Texts <span className={styles.hint}>(one per line, up to 10)</span>
              </label>
              <textarea
                className={styles.textarea}
                rows={5}
                placeholder={"word embeddings\nvector database\nsemantic search\n..."}
                value={textInput}
                onChange={e => { setTextInput(e.target.value); setComputed(false); }}
                spellCheck={false}
              />
            </div>
          )}

          <button
            className={styles.computeBtn}
            onClick={handleCompute}
            disabled={
              mode === "results" ? !hasResults :
              textInput.split("\n").filter(Boolean).length < 2
            }
          >
            Compute
          </button>

          {/* Heatmap */}
          {computed && matrix && n > 0 && (
            <div className={styles.heatmapWrap}>
              <div className={styles.svgScroll}>
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  width={svgW}
                  height={svgH}
                  className={styles.svg}
                >
                  {/* Column headers */}
                  {labels.map((lbl, j) => (
                    <text
                      key={`ch${j}`}
                      x={HEADER + j * CELL + CELL / 2}
                      y={HEADER - 6}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fill="var(--text2)"
                      fontSize={10}
                      fontFamily="inherit"
                      transform={`rotate(-40, ${HEADER + j * CELL + CELL / 2}, ${HEADER - 6})`}
                    >
                      {lbl}
                    </text>
                  ))}

                  {/* Rows */}
                  {labels.map((lbl, i) => (
                    <g key={`row${i}`}>
                      {/* Row label */}
                      <text
                        x={HEADER - 6}
                        y={HEADER + i * CELL + CELL / 2}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fill="var(--text2)"
                        fontSize={10}
                        fontFamily="inherit"
                      >
                        {lbl}
                      </text>

                      {/* Cells */}
                      {matrix[i].map((val, j) => {
                        const bg = heatColor(val);
                        const textC = val > 0.55 ? "#fff" : "#000";
                        return (
                          <g key={`cell${i}-${j}`}>
                            <rect
                              x={HEADER + j * CELL}
                              y={HEADER + i * CELL}
                              width={CELL}
                              height={CELL}
                              fill={bg}
                              stroke="var(--bg)"
                              strokeWidth={1.5}
                            />
                            {CELL >= 40 && (
                              <text
                                x={HEADER + j * CELL + CELL / 2}
                                y={HEADER + i * CELL + CELL / 2}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill={textC}
                                fontSize={10}
                                fontFamily="'JetBrains Mono', monospace"
                                opacity={0.9}
                              >
                                {val.toFixed(2)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  ))}

                  {/* Legend */}
                  <defs>
                    <linearGradient id="legendGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={heatColor(0)} />
                      <stop offset="50%" stopColor={heatColor(0.5)} />
                      <stop offset="100%" stopColor={heatColor(1)} />
                    </linearGradient>
                  </defs>
                  <rect
                    x={HEADER}
                    y={HEADER + n * CELL + 8}
                    width={n * CELL}
                    height={12}
                    rx={4}
                    fill="url(#legendGrad)"
                  />
                  <text x={HEADER} y={HEADER + n * CELL + 28}
                    fill="var(--text3)" fontSize={9} fontFamily="inherit">0.00</text>
                  <text x={HEADER + n * CELL} y={HEADER + n * CELL + 28}
                    textAnchor="end" fill="var(--text3)" fontSize={9} fontFamily="inherit">1.00</text>
                  <text x={HEADER + (n * CELL) / 2} y={HEADER + n * CELL + 28}
                    textAnchor="middle" fill="var(--text3)" fontSize={9} fontFamily="inherit">Similarity</text>
                </svg>
              </div>
            </div>
          )}

          {computed && matrix && n === 0 && (
            <div className={styles.empty}>No items to display.</div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerNote}>
            {computed && n > 0
              ? `${n}×${n} matrix — computed in browser`
              : "Similarity computed entirely client-side"}
          </span>
          <button className={styles.closeBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
