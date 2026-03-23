import { useState } from "react";
import styles from "./SQLBook.module.css";

const KEY = "vdb_sql_book";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

export default function SQLBook({ onRun, onClose }) {
  const [queries, setQueries] = useState(load);
  const [search, setSearch] = useState("");

  function remove(id) {
    const u = queries.filter(q => q.id !== id);
    setQueries(u); localStorage.setItem(KEY, JSON.stringify(u));
  }

  const filtered = queries.filter(q =>
    q.text.toLowerCase().includes(search.toLowerCase()) ||
    q.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3>💾 Query Book</h3>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.searchRow}>
          <input
            className={styles.search}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search saved queries..."
          />
        </div>
        {filtered.length === 0 && (
          <p className={styles.empty}>No saved queries yet. Use the editor to save queries.</p>
        )}
        <div className={styles.list}>
          {filtered.map(q => (
            <div key={q.id} className={styles.item}>
              <div className={styles.itemTop}>
                <span className={styles.label}>{q.label}</span>
                <span className={styles.date}>{new Date(q.savedAt).toLocaleDateString()}</span>
              </div>
              <p className={styles.text}>{q.text}</p>
              <div className={styles.itemActions}>
                <button className={styles.runBtn} onClick={() => { onRun(q.text); onClose(); }}>
                  ▶ Run
                </button>
                <button className={styles.delBtn} onClick={() => remove(q.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function saveQuery(text) {
  const label = text.slice(0, 50) + (text.length > 50 ? "…" : "");
  const entry = { id: Date.now(), label, text, savedAt: new Date().toISOString() };
  const existing = load();
  const updated = [entry, ...existing.filter(q => q.text !== text)].slice(0, 100);
  localStorage.setItem(KEY, JSON.stringify(updated));
}
