import { memo } from "react";
import styles from "./EmptyState.module.css";

const STEPS = [
  { icon: "🗄️", label: "Databases", text: "Pick a DB from the sidebar" },
  { icon: "⚙️", label: "Config",    text: "Enter connection credentials in Config tab" },
  { icon: "🏠", label: "Embed",     text: "Use Local model (no API key needed)" },
  { icon: "🔍", label: "Search",    text: "Type a query and press ⌘↵" },
];

const QUICK = [
  "LangGraph tutorial step by step",
  "semantic search with vector databases",
  "building a RAG pipeline",
  "multi-agent orchestration patterns",
];

const EmptyState = memo(function EmptyState({ onSearch }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.glowOrb} />
      <div className={styles.icon}>⬡</div>
      <h2 className={styles.title}>Ready to Explore</h2>
      <p className={styles.sub}>
        Search across 15 vector databases with semantic queries.
      </p>

      <div className={styles.steps}>
        {STEPS.map((s, i) => (
          <div key={i} className={styles.step}>
            <div className={styles.stepNum}>{i + 1}</div>
            <div className={styles.stepContent}>
              <span className={styles.stepIcon}>{s.icon}</span>
              <div>
                <div className={styles.stepLabel}>{s.label}</div>
                <div className={styles.stepText}>{s.text}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {onSearch && (
        <div className={styles.quickSection}>
          <div className={styles.quickTitle}>Quick searches</div>
          <div className={styles.quickChips}>
            {QUICK.map(q => (
              <button key={q} className={styles.chip} onClick={() => onSearch(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default EmptyState;
