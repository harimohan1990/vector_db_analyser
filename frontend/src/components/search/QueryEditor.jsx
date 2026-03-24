import { useState, useRef, useEffect } from "react";
import styles from "./QueryEditor.module.css";

export default function QueryEditor({ onSearch, loading, currentDB, onSaveQuery, onPrefetch }) {
  const [tabs, setTabs] = useState([{ id: 1, query: "", label: "Query 1" }]);
  const [activeTab, setActiveTab] = useState(1);
  const [nextId, setNextId] = useState(2);
  const [warming, setWarming] = useState(false);  // subtle cache-warm indicator
  const [listening, setListening] = useState(false);
  const textRef = useRef(null);
  const prefetchTimer = useRef(null);

  const activeQuery = tabs.find(t => t.id === activeTab)?.query || "";

  function updateQuery(val) {
    setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, query: val } : t));
    // Debounced pre-warm: fire after 700ms pause in typing
    if (onPrefetch) {
      clearTimeout(prefetchTimer.current);
      if (val.trim().length > 3) {
        prefetchTimer.current = setTimeout(() => {
          setWarming(true);
          onPrefetch(val.trim()).finally(() => setWarming(false));
        }, 700);
      }
    }
  }

  function addTab() {
    const id = nextId;
    setTabs(prev => [...prev, { id, query: "", label: `Query ${id}` }]);
    setActiveTab(id);
    setNextId(id + 1);
  }

  function closeTab(id, e) {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const remaining = tabs.filter(t => t.id !== id);
    setTabs(remaining);
    if (activeTab === id) setActiveTab(remaining[remaining.length - 1].id);
  }

  useEffect(() => {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (activeQuery.trim()) onSearch(activeQuery);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeQuery, onSearch]);

  const words = activeQuery.trim() ? activeQuery.trim().split(/\s+/).length : 0;

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Voice search not supported in this browser'); return; }
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setListening(true);
    recognition.onresult = (e) => { updateQuery(e.results[0][0].transcript); setListening(false); };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  }

  return (
    <div className={styles.editor}>
      <div className={styles.tabBar}>
        {tabs.map(t => (
          <div
            key={t.id}
            className={`${styles.tab} ${t.id === activeTab ? styles.activeTab : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className={styles.tabIcon}>⬡</span>
            <span className={styles.tabLabel}>{t.label}</span>
            {t.query && <span className={styles.tabDirty} />}
            {tabs.length > 1 && (
              <button className={styles.tabClose} onClick={e => closeTab(t.id, e)}>✕</button>
            )}
          </div>
        ))}
        <button className={styles.addTab} onClick={addTab} title="New tab">+</button>
      </div>

      <div className={styles.body}>
        <textarea
          ref={textRef}
          className={styles.textarea}
          value={activeQuery}
          onChange={e => updateQuery(e.target.value)}
          placeholder={"Enter your semantic search query...\n\nTip: Press Cmd+Enter to search"}
          spellCheck={false}
          rows={9}
        />
      </div>

      <div className={styles.footer}>
        <span className={styles.meta}>
          {currentDB && `${currentDB} · `}{words} word{words !== 1 ? "s" : ""}
          {warming && <span className={styles.warmDot} title="Pre-warming embedding cache…" />}
        </span>
        <div className={styles.actions}>
          {activeQuery && (
            <button className={styles.saveBtn} onClick={() => onSaveQuery?.(activeQuery)}>
              💾 Save Query
            </button>
          )}
          {activeQuery && (
            <button className={styles.clearBtn} onClick={() => updateQuery("")}>Clear</button>
          )}
          <button
            className={`${styles.micBtn} ${listening ? styles.micListening : ""}`}
            onClick={startVoice}
            disabled={listening}
            title={listening ? "Listening…" : "Voice search"}
            aria-label={listening ? "Listening for voice input" : "Start voice search"}
          >
            {listening ? <span className={styles.micDot} /> : "🎤"}
          </button>
          <button
            className={styles.runBtn}
            onClick={() => onSearch(activeQuery)}
            disabled={loading || !activeQuery.trim()}
          >
            {loading ? <span className={styles.spinner} /> : "▶ Run"}
            <kbd className={styles.kbd}>⌘↵</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
