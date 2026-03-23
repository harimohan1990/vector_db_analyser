import { useState } from "react";
import styles from "./ChunkingPanel.module.css";
const API = "http://localhost:8000";
const COLORS = ["var(--accent)","var(--green)","var(--amber)","#e879f9"];

export default function ChunkingPanel({ onClose }) {
  const [text, setText] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeStrategy, setActiveStrategy] = useState(0);

  async function compare() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/chunk/compare`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setResults(await res.json());
      setActiveStrategy(0);
    } catch {}
    finally { setLoading(false); }
  }

  const strat = results?.strategies?.[activeStrategy];

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>🧬 Chunking Strategy Visualizer</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <textarea className={styles.textarea} value={text} onChange={e => setText(e.target.value)} rows={5}
            placeholder="Paste your document text here to compare chunking strategies…" />
          <button className={styles.runBtn} onClick={compare} disabled={loading || !text.trim()}>
            {loading ? "Analyzing…" : "⚡ Compare Strategies"}
          </button>

          {results && (
            <>
              <div className={styles.statsRow}>
                <span className={styles.statPill}>📝 {results.total_tokens} tokens</span>
                <span className={styles.statPill}>🔤 {results.total_chars} chars</span>
              </div>
              <div className={styles.strategyTabs}>
                {results.strategies.map((s, i) => (
                  <button key={i} className={`${styles.stratTab} ${activeStrategy===i?styles.stratTabActive:""}`}
                    style={activeStrategy===i?{borderColor:COLORS[i],color:COLORS[i]}:{}}
                    onClick={() => setActiveStrategy(i)}>
                    {s.label}
                    <span className={styles.stratCount}>{s.num_chunks} chunks</span>
                  </button>
                ))}
              </div>

              {strat && (
                <div className={styles.stratDetail}>
                  <div className={styles.stratMeta}>
                    <div className={styles.metaItem}><span>Chunk size</span><b>{strat.chunk_size}</b></div>
                    <div className={styles.metaItem}><span>Overlap</span><b>{strat.overlap}</b></div>
                    <div className={styles.metaItem}><span>Chunks</span><b style={{color:COLORS[activeStrategy]}}>{strat.num_chunks}</b></div>
                    <div className={styles.metaItem}><span>Avg tokens</span><b>{strat.avg_tokens}</b></div>
                    <div className={styles.metaItem}><span>Coverage</span><b>{(strat.coverage*100).toFixed(0)}%</b></div>
                  </div>

                  <div className={styles.chunkViz}>
                    {strat.chunks_preview.map((c, i) => (
                      <div key={i} className={styles.chunkBlock} style={{borderColor:COLORS[activeStrategy]}}>
                        <div className={styles.chunkHeader} style={{color:COLORS[activeStrategy]}}>
                          Chunk {c.index + 1} · {c.tokens} tokens
                        </div>
                        <div className={styles.chunkText}>{c.text}</div>
                      </div>
                    ))}
                    {strat.num_chunks > 4 && (
                      <div className={styles.moreChunks}>+ {strat.num_chunks - 4} more chunks</div>
                    )}
                  </div>

                  <div className={styles.chartWrap}>
                    <div className={styles.chartTitle}>Chunk size comparison (tokens)</div>
                    <div className={styles.bars}>
                      {results.strategies.map((s, i) => (
                        <div key={i} className={styles.barGroup}>
                          <div className={styles.bar} style={{height:`${(s.avg_tokens/1024)*100}%`,background:COLORS[i]}} title={`${s.avg_tokens} avg tokens`} />
                          <span className={styles.barLabel}>{s.chunk_size}</span>
                        </div>
                      ))}
                    </div>
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
