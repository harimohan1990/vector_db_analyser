import { useState } from "react";
import styles from "./DuplicateDetectorPanel.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

function qualityScore(dupCount, total) {
  if (!total) return { label: "Unknown", color: "var(--text3)" };
  const ratio = dupCount / total;
  if (ratio === 0) return { label: "Clean", color: "var(--green)" };
  if (ratio < 0.05) return { label: "Good", color: "var(--green)" };
  if (ratio < 0.15) return { label: "Some Duplicates", color: "var(--amber)" };
  return { label: "Many Duplicates", color: "var(--red)" };
}

export default function DuplicateDetectorPanel({ providers = [], dbConfigs = {}, embCfg = {}, onClose }) {
  const [selectedDB, setSelectedDB] = useState(providers[0] ?? "");
  const [sampleSize, setSampleSize] = useState(50);
  const [threshold, setThreshold] = useState(0.97);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleDetect() {
    if (!selectedDB) {
      setError("Please select a database.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API}/duplicates/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_type: selectedDB,
          config: dbConfigs[selectedDB] ?? {},
          emb_config: embCfg,
          sample_size: sampleSize,
          threshold,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const quality = result
    ? qualityScore(result.duplicate_count ?? 0, result.total_checked ?? sampleSize)
    : null;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.icon}>🔍</span>
            <h2 className={styles.title}>Duplicate Detector</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Database</label>
                <select
                  value={selectedDB}
                  onChange={(e) => setSelectedDB(e.target.value)}
                  className={styles.select}
                >
                  <option value="">— Select DB —</option>
                  {providers.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  Sample Size
                  <span className={styles.valBadge}>{sampleSize}</span>
                </label>
                <input
                  type="number"
                  min={10}
                  max={200}
                  value={sampleSize}
                  onChange={(e) => setSampleSize(Math.min(200, Math.max(10, Number(e.target.value))))}
                  className={styles.numberInput}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                Similarity Threshold
                <span className={styles.valBadge}>{threshold.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0.90}
                max={0.99}
                step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className={styles.slider}
              />
              <div className={styles.sliderTicks}>
                <span>0.90 (broad)</span>
                <span>0.99 (strict)</span>
              </div>
            </div>
          </div>

          {error && (
            <div className={styles.errorBox}>
              <span>⚠</span> {error}
            </div>
          )}

          {result && (
            <div className={styles.results}>
              <div className={styles.scoreBar}>
                <div className={styles.scoreLeft}>
                  <div
                    className={styles.scoreIndicator}
                    style={{ background: quality.color, boxShadow: `0 0 12px ${quality.color}` }}
                  />
                  <div>
                    <div className={styles.scoreLabel} style={{ color: quality.color }}>
                      {quality.label}
                    </div>
                    <div className={styles.scoreNote}>
                      {result.duplicate_count ?? 0} duplicate pair{result.duplicate_count !== 1 ? "s" : ""} in{" "}
                      {result.total_checked ?? sampleSize} sampled vectors
                    </div>
                  </div>
                </div>
                <div className={styles.scoreStat}>
                  <span className={styles.scoreNum} style={{ color: quality.color }}>
                    {result.duplicate_count ?? 0}
                  </span>
                  <span className={styles.scoreNumLabel}>duplicates</span>
                </div>
              </div>

              {result.pairs && result.pairs.length > 0 && (
                <div className={styles.pairsList}>
                  <div className={styles.pairsHeader}>
                    <span>ID Pair</span>
                    <span>Similarity</span>
                  </div>
                  {result.pairs.map((pair, i) => {
                    const sim = pair.similarity ?? 0;
                    const simColor = sim >= 0.99 ? "var(--red)" : sim >= 0.95 ? "var(--amber)" : "var(--text2)";
                    return (
                      <div key={i} className={styles.pairRow}>
                        <div className={styles.pairIds}>
                          <span className={styles.pairId}>{pair.id_a ?? pair[0]}</span>
                          <span className={styles.pairSep}>↔</span>
                          <span className={styles.pairId}>{pair.id_b ?? pair[1]}</span>
                        </div>
                        <div className={styles.pairSim} style={{ color: simColor }}>
                          {(sim * 100).toFixed(2)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {result.pairs && result.pairs.length === 0 && (
                <div className={styles.noDups}>
                  <span>✓</span> No duplicates found above the {(threshold * 100).toFixed(0)}% threshold.
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.detectBtn}
            onClick={handleDetect}
            disabled={loading}
          >
            {loading ? <span className={styles.spinner} /> : "🔍 Detect Duplicates"}
          </button>
          <button className={styles.cancelBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
