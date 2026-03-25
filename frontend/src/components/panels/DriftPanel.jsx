import { useState, useEffect } from "react";
import styles from "./DriftPanel.module.css";
const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function DriftPanel({ embCfg, onClose }) {
  const [snapshots, setSnapshots] = useState([]);
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [sel1, setSel1] = useState(null);
  const [sel2, setSel2] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [msg, setMsg] = useState(null);

  async function loadSnapshots() {
    const res = await fetch(`${API}/drift/snapshots`);
    const data = await res.json();
    setSnapshots(data.snapshots || []);
  }
  useEffect(() => { loadSnapshots(); }, []);

  async function saveSnap() {
    if (!text.trim() || !label.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API}/drift/snapshot`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, text, openai_api_key: embCfg?.openai_api_key || "", embedding_model: embCfg?.embedding_model || "local" }),
      });
      setMsg("✓ Snapshot saved"); setText(""); setLabel("");
      loadSnapshots();
      setTimeout(() => setMsg(null), 2000);
    } catch {}
    finally { setSaving(false); }
  }

  async function compare_() {
    if (!sel1 || !sel2) return;
    setComparing(true); setComparison(null);
    try {
      const res = await fetch(`${API}/drift/compare/${sel1}/${sel2}`);
      setComparison(await res.json());
    } catch {}
    finally { setComparing(false); }
  }

  const driftColor = c => !c ? "var(--text3)" : c.drift_level === "low" ? "var(--green)" : c.drift_level === "medium" ? "var(--amber)" : "var(--red)";

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>📉 Embedding Drift Detection</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Save Embedding Snapshot</div>
            <div className={styles.snapForm}>
              <input className={styles.input} value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (e.g. v1, after-finetune, 2024-Q1)" />
              <textarea className={styles.textarea} value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Text to embed and snapshot…" />
              <button className={styles.saveBtn} onClick={saveSnap} disabled={saving || !text.trim() || !label.trim()}>
                {saving ? "Saving…" : "📸 Save Snapshot"}
              </button>
              {msg && <div className={styles.msg}>{msg}</div>}
            </div>
          </div>

          {snapshots.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Snapshots ({snapshots.length})</div>
              <div className={styles.snapList}>
                {snapshots.map(s => (
                  <div key={s.id} className={`${styles.snapRow} ${sel1===s.id||sel2===s.id?styles.snapSelected:""}`}
                    onClick={() => { if (sel1===s.id){setSel1(null)} else if (sel2===s.id){setSel2(null)} else if (!sel1){setSel1(s.id)} else if (!sel2){setSel2(s.id)} }}>
                    <div className={styles.snapLabel}>{s.label}</div>
                    <div className={styles.snapMeta}>
                      <span>{s.model}</span><span>{s.dim}D</span><span>{s.created_at?.slice(0,16)}</span>
                    </div>
                    {(sel1===s.id||sel2===s.id) && <span className={styles.selBadge}>{sel1===s.id?"#1":"#2"}</span>}
                  </div>
                ))}
              </div>
              <div className={styles.compareRow}>
                <span className={styles.selHint}>
                  {!sel1 && !sel2 ? "Click 2 snapshots to compare" : !sel2 ? "Select 2nd snapshot" : "Ready to compare"}
                </span>
                <button className={styles.cmpBtn} onClick={compare_} disabled={!sel1||!sel2||comparing}>
                  {comparing ? "Comparing…" : "⚖ Compare Drift"}
                </button>
              </div>
            </div>
          )}

          {comparison && (
            <div className={styles.result}>
              <div className={styles.driftScore} style={{color:driftColor(comparison)}}>
                Drift Score: <b>{(comparison.drift_score*100).toFixed(1)}%</b>
                <span className={styles.driftLevel}>{comparison.drift_level}</span>
              </div>
              <div className={styles.driftBar}>
                <div className={styles.driftFill} style={{width:`${comparison.drift_score*100}%`, background:driftColor(comparison)}} />
              </div>
              <div className={styles.cmpMeta}>
                <span>Cosine similarity: <b>{(comparison.cosine_similarity*100).toFixed(1)}%</b></span>
                {comparison.model_changed && <span className={styles.warn}>⚠ Different models</span>}
                {comparison.dim_mismatch && <span className={styles.warn}>⚠ Dimension mismatch</span>}
              </div>
              <div className={styles.cmpSnaps}>
                {[comparison.snapshot_1, comparison.snapshot_2].map((s,i) => (
                  <div key={i} className={styles.cmpSnap}>
                    <span className={styles.cmpSnapLabel}>#{i+1} {s.label}</span>
                    <span className={styles.cmpSnapMeta}>{s.model} · {s.dim}D · {s.created_at?.slice(0,10)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
