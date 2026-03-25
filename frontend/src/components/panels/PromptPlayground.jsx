import { useState } from "react";
import styles from "./PromptPlayground.module.css";
const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const DEFAULT_TEMPLATE = "You are a helpful assistant.\n\nContext:\n{context}\n\nQuestion: {query}\n\nAnswer:";

export default function PromptPlayground({ providers, dbConfigs, embCfg, onClose }) {
  const [query, setQuery] = useState("");
  const [db, setDb] = useState(providers[0]?.name || "");
  const [topK, setTopK] = useState(3);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("prompt"); // prompt | context | results

  async function run() {
    if (!query.trim() || !db) return;
    setLoading(true); setResult(null);
    try {
      const res = await fetch(`${API}/playground/rag`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query, db_type: db, config: dbConfigs[db] || {}, top_k: topK,
          prompt_template: template,
          openai_api_key: embCfg?.openai_api_key || "",
          embedding_model: embCfg?.embedding_model || "local",
        }),
      });
      setResult(await res.json());
      setTab("prompt");
    } catch {}
    finally { setLoading(false); }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>🧠 Prompt + Retrieval Playground</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.topConfig}>
            <input className={styles.queryInput} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Ask a question…" onKeyDown={e => e.key === "Enter" && run()} />
            <select className={styles.select} value={db} onChange={e => setDb(e.target.value)}>
              {providers.map(p => <option key={p.name} value={p.name}>{p.display_name}</option>)}
            </select>
            <span className={styles.topkLabel}>K={topK}</span>
            <input type="range" min={1} max={10} value={topK} onChange={e => setTopK(+e.target.value)} className={styles.slider} />
          </div>

          <div className={styles.templateWrap}>
            <div className={styles.templateLabel}>Prompt Template <span className={styles.hint}>(use {"{context}"} and {"{query}"})</span></div>
            <textarea className={styles.template} value={template} onChange={e => setTemplate(e.target.value)} rows={6} />
          </div>

          <button className={styles.runBtn} onClick={run} disabled={loading || !query.trim()}>
            {loading ? "Retrieving…" : "▶ Run RAG Pipeline"}
          </button>

          {result && (
            <>
              <div className={styles.tabBar}>
                {["prompt","context","results"].map(t => (
                  <button key={t} className={`${styles.tabBtn} ${tab===t?styles.tabBtnActive:""}`} onClick={() => setTab(t)}>
                    {t === "prompt" ? "📝 Filled Prompt" : t === "context" ? "📄 Context" : "🔍 Results"}
                  </button>
                ))}
                <span className={styles.latBadge}>{result.retrieval_latency_ms}ms · {result.result_count} docs</span>
              </div>

              {tab === "prompt" && (
                <pre className={styles.output}>{result.filled_prompt}</pre>
              )}
              {tab === "context" && (
                <pre className={styles.output}>{result.context}</pre>
              )}
              {tab === "results" && (
                <div className={styles.resultList}>
                  {result.retrieved_results.map((r, i) => (
                    <div key={i} className={styles.resultRow}>
                      <span className={styles.rank}>#{i+1}</span>
                      <span className={styles.rScore} style={{color:r.score>0.7?"var(--green)":r.score>0.4?"var(--amber)":"var(--red)"}}>
                        {(r.score*100).toFixed(0)}%
                      </span>
                      <span className={styles.rText}>
                        {Object.values(r.metadata||{}).join(" ").slice(0,150) || r.id}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.note}>{result.note}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
