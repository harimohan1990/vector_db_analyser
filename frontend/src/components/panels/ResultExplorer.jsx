import { useState, memo } from "react";
import styles from "./ResultExplorer.module.css";
import { toast } from "../layout/Toast";
import { copyToClipboard } from "../../utils/clipboard";

const SCORE_COLOR = (s) => s >= 0.85 ? "var(--green)" : s >= 0.6 ? "var(--amber)" : "var(--red)";
const SCORE_LABEL = (s) => s >= 0.85 ? "High" : s >= 0.6 ? "Mid" : "Low";

function VectorSparkline({ values }) {
  const preview = values.slice(0, 16);
  const max = Math.max(...preview.map(Math.abs)) || 1;
  const W = 16 * 6; // 16 bars * 6px each (4px bar + 2px gap)
  const H = 36;
  return (
    <svg width={W} height={H} className={styles.sparkline}>
      {preview.map((v, i) => {
        const barH = Math.max(2, (Math.abs(v) / max) * (H - 4));
        const y = v >= 0 ? H / 2 - barH : H / 2;
        const color = v >= 0 ? "var(--accent)" : "var(--red)";
        return (
          <rect
            key={i}
            x={i * 6}
            y={v >= 0 ? H / 2 - barH : H / 2}
            width={4}
            height={barH}
            fill={color}
            opacity={0.7}
            rx={1}
          />
        );
      })}
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="var(--border2)" strokeWidth={1} />
    </svg>
  );
}

const ResultExplorer = memo(function ResultExplorer({ item, onClose }) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const { id, score, metadata = {}, values } = item;
  const scoreColor = SCORE_COLOR(score);
  const scoreLabel = SCORE_LABEL(score);
  const pct = Math.max(0, Math.min(1, score)) * 100;

  async function copyId() {
    const ok = await copyToClipboard(id);
    if (ok) { setCopiedId(true); setTimeout(() => setCopiedId(false), 1500); }
  }

  async function copyMeta(v) {
    const ok = await copyToClipboard(String(v));
    toast(ok ? "Copied!" : "Copy failed", ok ? "success" : "error");
  }

  async function copyJSON() {
    const ok = await copyToClipboard(JSON.stringify(item, null, 2));
    toast(ok ? "JSON copied!" : "Copy failed", ok ? "success" : "error");
  }

  const metaEntries = Object.entries(metadata);

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>Result Explorer</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          {/* Score section */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Similarity Score</div>
            <div className={styles.scoreRow}>
              <span className={styles.scoreBig} style={{ color: scoreColor }}>
                {(score * 100).toFixed(2)}%
              </span>
              <span className={styles.scoreTag} style={{ color: scoreColor, borderColor: scoreColor }}>
                {scoreLabel}
              </span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${pct}%`, background: scoreColor, boxShadow: `0 0 8px ${scoreColor}55` }}
              />
            </div>
          </div>

          {/* ID section */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Vector ID</div>
            <div className={styles.idRow}>
              <code className={styles.idCode}>{id}</code>
              <button className={styles.copyBtn} onClick={copyId} title="Copy ID">
                {copiedId ? "✓" : "⎘"}
              </button>
            </div>
          </div>

          {/* Metadata section */}
          {metaEntries.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Metadata</div>
              <div className={styles.metaList}>
                {metaEntries.map(([k, v]) => (
                  <div key={k} className={styles.metaRow}>
                    <span className={styles.metaKey}>{k}</span>
                    <span className={styles.metaVal}>{String(v)}</span>
                    <button
                      className={styles.metaCopy}
                      onClick={() => copyMeta(v)}
                      title="Copy value"
                    >
                      ⎘
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vector preview */}
          {Array.isArray(values) && values.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Vector Preview (first 16 dims)</div>
              <div className={styles.sparkWrap}>
                <VectorSparkline values={values} />
                <span className={styles.dimNote}>{values.length}D total</span>
              </div>
            </div>
          )}

          {/* Full JSON section */}
          <div className={styles.section}>
            <div className={styles.jsonHeader}>
              <button
                className={styles.jsonToggle}
                onClick={() => setJsonOpen(v => !v)}
              >
                {jsonOpen ? "▼" : "▶"} Full JSON
              </button>
              <button className={styles.copyBtn} onClick={copyJSON} title="Copy JSON">
                Copy JSON
              </button>
            </div>
            {jsonOpen && (
              <pre className={styles.jsonPre}>
                {JSON.stringify(item, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default ResultExplorer;
