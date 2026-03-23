import { useState, useRef } from "react";
import styles from "./StreamingSearch.module.css";
const API = "http://localhost:8000";

function latColor(ms) { return ms < 300 ? "var(--green)" : ms < 800 ? "var(--amber)" : "var(--red)"; }

export default function StreamingSearch({ providers, dbConfigs, embCfg, onClose }) {
  const [query, setQuery] = useState("");
  const [db, setDb] = useState(providers[0]?.name || "");
  const [topK, setTopK] = useState(10);
  const [phase, setPhase] = useState(null);
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef(null);

  async function startStream() {
    if (!query.trim() || streaming) return;
    setStreaming(true); setResults([]); setMeta(null); setPhase("embedding");
    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${API}/search/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query, db_type: db, config: dbConfigs[db] || {}, top_k: topK,
          openai_api_key: embCfg?.openai_api_key || "",
          embedding_model: embCfg?.embedding_model || "local",
        }),
        signal: abortRef.current.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") { setStreaming(false); break; }
          try {
            const ev = JSON.parse(payload);
            setPhase(ev.phase);
            if (ev.phase === "result") setResults(prev => [...prev, ev.result]);
            if (ev.phase === "done") setMeta(ev);
          } catch {}
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") console.error(e);
    } finally {
      setStreaming(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
    setPhase("stopped");
  }

  const phaseLabel = { embedding: "🧠 Generating embedding…", search: "🔍 Searching…", result: "📦 Streaming results…", done: "✓ Done", stopped: "⏹ Stopped", error: "⚠ Error" };

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>⚡ Real-Time Streaming Search</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.controls}>
            <input className={styles.input} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Query…" onKeyDown={e => e.key === "Enter" && startStream()} disabled={streaming} />
            <select className={styles.select} value={db} onChange={e => setDb(e.target.value)} disabled={streaming}>
              {providers.map(p => <option key={p.name} value={p.name}>{p.display_name}</option>)}
            </select>
            <span className={styles.kLabel}>K={topK}</span>
            <input type="range" min={1} max={20} value={topK} onChange={e => setTopK(+e.target.value)} disabled={streaming} className={styles.slider} />
            {streaming
              ? <button className={styles.stopBtn} onClick={stop}>⏹ Stop</button>
              : <button className={styles.runBtn} onClick={startStream} disabled={!query.trim()}>▶ Stream</button>}
          </div>

          {phase && (
            <div className={styles.phaseBar}>
              {streaming && <div className={styles.pulse} />}
              <span className={styles.phaseLabel}>{phaseLabel[phase] || phase}</span>
              {meta && <span className={styles.metaBadge}>{results.length} results · {meta.latency_ms}ms</span>}
            </div>
          )}

          <div className={styles.resultList}>
            {results.map((r, i) => (
              <div key={i} className={styles.resultRow} style={{ animationDelay: `${i * 30}ms` }}>
                <span className={styles.rank}>{i + 1}</span>
                <span className={styles.score} style={{ color: latColor(1000 - r.score * 1000) }}>
                  {((r.score || 0) * 100).toFixed(1)}%
                </span>
                <span className={styles.id}>{String(r.id).slice(0, 20)}</span>
                <span className={styles.meta}>{Object.values(r.metadata || {}).join(" ").slice(0, 100)}</span>
              </div>
            ))}
            {streaming && results.length === 0 && (
              <div className={styles.waiting}>Waiting for results…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
