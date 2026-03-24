import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./QueryAutocompleteDemo.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function QueryAutocompleteDemo({ onClose }) {
  const [prefix, setPrefix] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const [noHistory, setNoHistory] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const debouncedPrefix = useDebounce(prefix, 300);

  const fetchSuggestions = useCallback(async (p) => {
    if (!p.trim()) {
      setSuggestions([]);
      setOpen(false);
      setNoHistory(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/query/autocomplete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: p, limit: 5 }),
      });
      const data = await res.json();
      const list = data.suggestions || data.results || data || [];
      if (Array.isArray(list) && list.length === 0) {
        setNoHistory(true);
        setSuggestions([]);
      } else {
        setNoHistory(false);
        setSuggestions(Array.isArray(list) ? list : []);
      }
      setOpen(true);
    } catch {
      setSuggestions([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions(debouncedPrefix);
  }, [debouncedPrefix, fetchSuggestions]);

  function handleSelect(s) {
    const text = typeof s === "string" ? s : s.query || s.text || String(s);
    setSelected(text);
    setPrefix(text);
    setOpen(false);
    setSuggestions([]);
  }

  function handleInputChange(e) {
    setPrefix(e.target.value);
    if (!e.target.value.trim()) {
      setSelected("");
      setNoHistory(false);
    }
  }

  useEffect(() => {
    function handleClick(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>Query Autocomplete</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.description}>
            Start typing a query prefix to see autocomplete suggestions drawn from your search history.
          </div>

          <div className={styles.inputWrap}>
            <label className={styles.label}>Search Prefix</label>
            <div className={styles.inputContainer}>
              <input
                ref={inputRef}
                className={styles.prefixInput}
                value={prefix}
                onChange={handleInputChange}
                onFocus={() => suggestions.length > 0 && setOpen(true)}
                placeholder="Type a query prefix…"
                autoComplete="off"
                spellCheck={false}
              />
              {loading && <span className={styles.spinner} />}
            </div>

            {open && (suggestions.length > 0 || noHistory) && (
              <div ref={dropdownRef} className={styles.dropdown}>
                {noHistory ? (
                  <div className={styles.emptyMsg}>
                    <span className={styles.emptyIcon}>🔍</span>
                    <span>Run some searches first to build history</span>
                  </div>
                ) : (
                  suggestions.map((s, i) => {
                    const text = typeof s === "string" ? s : s.query || s.text || String(s);
                    return (
                      <button
                        key={i}
                        className={styles.suggestion}
                        onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
                      >
                        <span className={styles.sugIcon}>↗</span>
                        <span className={styles.sugText}>{text}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className={styles.caption}>
            Based on your query history
          </div>

          {selected && (
            <div className={styles.selectedBlock}>
              <div className={styles.selectedLabel}>Selected Query</div>
              <div className={styles.selectedText}>{selected}</div>
            </div>
          )}

          {!prefix && !selected && (
            <div className={styles.placeholder}>
              <div className={styles.placeholderIcon}>💬</div>
              <div className={styles.placeholderTitle}>No prefix entered yet</div>
              <div className={styles.placeholderSub}>
                Type in the field above to see your past queries as suggestions.
                If you haven't run any searches, the history will be empty.
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.closeBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
