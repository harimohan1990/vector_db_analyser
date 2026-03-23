import { useState } from "react";
import styles from "./ConfigPanel.module.css";
import eStyles from "./EmbeddingConfig.module.css";

const MODELS = [
  { value: "local",                   label: "🏠 Local — all-MiniLM-L6-v2 (384D, no key)", dim: 384 },
  { value: "text-embedding-3-small",  label: "OpenAI text-embedding-3-small (1536D)", dim: 1536 },
  { value: "text-embedding-3-large",  label: "OpenAI text-embedding-3-large (3072D)", dim: 3072 },
  { value: "text-embedding-ada-002",  label: "OpenAI text-embedding-ada-002 (1536D)", dim: 1536 },
];

export default function EmbeddingConfig({ values, onChange, topK, onTopKChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const [keyVisible, setKeyVisible] = useState(false);
  const isLocal = values.embedding_model === "local";
  const currentModel = MODELS.find(m => m.value === values.embedding_model);
  const dim = currentModel?.dim;

  return (
    <div className={styles.panel}>
      <button className={styles.toggle} onClick={() => setCollapsed((c) => !c)}>
        <span>Embedding Config</span>
        <span className={styles.chevron}>{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed && (
        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label}>
              Model
              {dim && <span className={eStyles.dimBadge}>{dim}D</span>}
            </label>
            <select
              className={eStyles.select}
              value={values.embedding_model ?? "local"}
              onChange={(e) => onChange("embedding_model", e.target.value)}
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {!isLocal && (
            <div className={styles.field}>
              <label className={styles.label}>OpenAI API Key</label>
              <div className={`${styles.inputWrap} ${styles.secretWrap}`}>
                <input
                  className={styles.input}
                  type={keyVisible ? "text" : "password"}
                  value={values.openai_api_key ?? ""}
                  onChange={(e) => onChange("openai_api_key", e.target.value)}
                  placeholder="sk-... (falls back to local if empty)"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setKeyVisible(v => !v)}
                  title={keyVisible ? "Hide key" : "Show key"}
                  aria-label={keyVisible ? "Hide API key" : "Show API key"}
                >
                  {keyVisible ? "🙈" : "👁"}
                </button>
              </div>
              {values.openai_api_key && (
                <div className={styles.keyPreview}>
                  {keyVisible
                    ? values.openai_api_key
                    : `${values.openai_api_key.slice(0, 6)}${"•".repeat(Math.min(values.openai_api_key.length - 6, 20))}${values.openai_api_key.slice(-3)}`
                  }
                </div>
              )}
            </div>
          )}

          {isLocal && (
            <p className={eStyles.localNote}>
              ✓ Uses <code>all-MiniLM-L6-v2</code> locally — no API key required.
              First run downloads ~90MB model.
            </p>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Top K Results</label>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={50}
              value={topK}
              onChange={(e) => onTopKChange(Number(e.target.value))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
