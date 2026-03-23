import { useState, useRef, useEffect } from "react";
import styles from "./SearchBar.module.css";

function relTime(iso) {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

export default function SearchBar({ onSearch, loading, history = [], onRemoveHistory }) {
  const [query, setQuery] = useState("");
  const [showHist, setShowHist] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (!wrapRef.current?.contains(e.target)) setShowHist(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function submit(q) {
    if (!q.trim()) return;
    setShowHist(false);
    onSearch(q);
  }

  function handleKey(e) {
    if (e.key === "Enter") submit(query);
    if (e.key === "Escape") setShowHist(false);
  }

  const showDropdown = showHist && history.length > 0;

  return (
    <div className={styles.wrapper} ref={wrapRef}>
      <div className={`${styles.row} ${showDropdown ? styles.open : ""}`}>
        <span className={styles.icon}>⌕</span>
        <input
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => history.length > 0 && setShowHist(true)}
          placeholder="Enter a natural language query..."
          disabled={loading}
          autoFocus
        />
        {query && !loading && (
          <button className={styles.clearBtn} onClick={() => setQuery("")} tabIndex={-1}>✕</button>
        )}
        {history.length > 0 && (
          <button
            className={`${styles.histToggle} ${showHist ? styles.histToggleActive : ""}`}
            onClick={() => setShowHist((v) => !v)}
            tabIndex={-1}
            title="Recent searches"
          >🕐</button>
        )}
        <button
          className={styles.searchBtn}
          onClick={() => submit(query)}
          disabled={loading || !query.trim()}
        >
          {loading ? <span className={styles.spinner} /> : "Search"}
        </button>
      </div>

      {showDropdown && (
        <div className={styles.dropdown}>
          <p className={styles.dropLabel}>Recent searches</p>
          {history.slice(0, 10).map((h) => (
            <div key={h.id} className={styles.dropItem}>
              <button className={styles.dropQuery} onClick={() => { setQuery(h.query); submit(h.query); }}>
                <span className={styles.dropIcon}>↩</span>
                <span className={styles.dropText}>{h.query}</span>
                <span className={styles.dropTime}>{relTime(h.ts)}</span>
              </button>
              <button
                className={styles.dropDel}
                onClick={(e) => { e.stopPropagation(); onRemoveHistory(h.id); }}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
