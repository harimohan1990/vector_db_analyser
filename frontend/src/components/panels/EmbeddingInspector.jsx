import { useState } from "react";
import styles from "./EmbeddingInspector.module.css";
import { copyToClipboard } from "../../utils/clipboard";
import { toast } from "../layout/Toast";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function EmbeddingInspector({ embCfg, onClose }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFull, setShowFull] = useState(false);

  async function inspect() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API}/inspect/embedding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          openai_api_key: embCfg.openai_api_key || "",
          embedding_model: embCfg.embedding_model || "local",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Mini bar chart for preview dims
  function DimBar({ val, min, max }) {
    const range = max - min || 1;
    const pct = ((val - min) / range) * 100;
    const isPos = val >= 0;
    return (
      <div className={styles.dimBar}>
        <div
          className={`${styles.dimFill} ${isPos ? styles.pos : styles.neg}`}
          style={{ width: `${Math.abs(pct - 50)}%`, left: isPos ? "50%" : `${pct}%` }}
        />
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>🔬 Embedding Inspector</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.inputRow}>
            <textarea
              className={styles.textArea}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Enter text to embed and inspect…"
              rows={3}
            />
            <button className={styles.inspectBtn} onClick={inspect} disabled={loading || !text.trim()}>
              {loading ? "⟳" : "Inspect"}
            </button>
          </div>

          {error && <div className={styles.err}>{error}</div>}

          {result && (
            <>
              {/* Stats row */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statVal}>{result.dimension}</div>
                  <div className={styles.statLabel}>Dimensions</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statVal}>{result.latency_ms}ms</div>
                  <div className={styles.statLabel}>Latency</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statVal}>{result.magnitude.toFixed(3)}</div>
                  <div className={styles.statLabel}>Magnitude</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statVal}>{result.mean.toFixed(4)}</div>
                  <div className={styles.statLabel}>Mean</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statVal}>{result.min.toFixed(4)}</div>
                  <div className={styles.statLabel}>Min</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statVal}>{result.max.toFixed(4)}</div>
                  <div className={styles.statLabel}>Max</div>
                </div>
              </div>

              <div className={styles.modelTag}>
                Model: <code>{result.model}</code>
              </div>

              {/* Dim preview heatmap */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span>Vector Preview (first {result.preview.length} dims)</span>
                  <button className={styles.toggleFull} onClick={() => setShowFull(v => !v)}>
                    {showFull ? "▲ Hide full" : "▼ Show all dims"}
                  </button>
                </div>
                <div className={styles.heatGrid}>
                  {(showFull ? result.full_vector : result.preview).map((v, i) => (
                    <div key={i} className={styles.heatCell} title={`dim[${i}] = ${v}`}>
                      <div
                        className={styles.heatFill}
                        style={{
                          opacity: 0.15 + Math.abs(v) / (Math.max(result.max, Math.abs(result.min)) || 1) * 0.85,
                          background: v >= 0 ? "#6c63ff" : "#f43f5e",
                        }}
                      />
                      <span className={styles.heatVal}>{v.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar visualization */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>Dimension Values (first 50)</div>
                <div className={styles.barList}>
                  {result.preview.map((v, i) => (
                    <div key={i} className={styles.barRow}>
                      <span className={styles.barIdx}>{i}</span>
                      <DimBar val={v} min={result.min} max={result.max} />
                      <span className={styles.barVal}>{v.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Copy JSON */}
              <button
                className={styles.copyBtn}
                onClick={async () => {
                  const ok = await copyToClipboard(JSON.stringify(result.full_vector));
                  toast(ok ? "✓ Vector copied!" : "Copy failed — try selecting manually", ok ? "success" : "error");
                }}
              >
                📋 Copy full vector JSON
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
