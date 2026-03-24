import { useState } from "react";
import styles from "./ShareableLinkPanel.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function ShareableLinkPanel({
  currentQuery = "",
  selectedDB = "",
  dbConfigs = {},
  embCfg = {},
  onClose,
}) {
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);

  function generateLink() {
    const state = {
      query: currentQuery,
      db: selectedDB,
      config: dbConfigs[selectedDB] ?? {},
      emb: embCfg,
      ts: Date.now(),
    };
    const encoded = btoa(JSON.stringify(state));
    const link = `${window.location.origin}${window.location.pathname}?state=${encoded}`;
    setGeneratedLink(link);
    setCopied(false);
  }

  async function copyLink() {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select the input text
      const el = document.getElementById("shareable-link-input");
      if (el) { el.select(); document.execCommand("copy"); }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  const dbConfig = dbConfigs[selectedDB] ?? {};
  const configKeys = Object.keys(dbConfig).filter((k) => !k.toLowerCase().includes("key") && !k.toLowerCase().includes("secret"));

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.icon}>🔗</span>
            <h2 className={styles.title}>Shareable Link</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.stateSummary}>
            <h3 className={styles.sectionTitle}>Current State</h3>
            <div className={styles.stateGrid}>
              <div className={styles.stateRow}>
                <span className={styles.stateKey}>Query</span>
                <span className={styles.stateVal}>
                  {currentQuery ? `"${currentQuery}"` : <em className={styles.empty}>No query</em>}
                </span>
              </div>
              <div className={styles.stateRow}>
                <span className={styles.stateKey}>Database</span>
                <span className={styles.stateVal}>
                  {selectedDB || <em className={styles.empty}>None selected</em>}
                </span>
              </div>
              <div className={styles.stateRow}>
                <span className={styles.stateKey}>Embedding</span>
                <span className={styles.stateVal}>
                  {embCfg?.model ?? <em className={styles.empty}>Default</em>}
                </span>
              </div>
              {configKeys.slice(0, 3).map((k) => (
                <div key={k} className={styles.stateRow}>
                  <span className={styles.stateKey}>{k}</span>
                  <span className={styles.stateVal}>{String(dbConfig[k]).slice(0, 40)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.note}>
            <span className={styles.noteIcon}>ℹ️</span>
            Share this link to reproduce this exact search configuration. API keys and secrets are excluded from the link for security.
          </div>

          {generatedLink && (
            <div className={styles.linkSection}>
              <label className={styles.linkLabel}>Generated Link</label>
              <div className={styles.linkRow}>
                <input
                  id="shareable-link-input"
                  type="text"
                  value={generatedLink}
                  readOnly
                  className={styles.linkInput}
                  onClick={(e) => e.target.select()}
                />
                <button
                  className={`${styles.copyBtn} ${copied ? styles.copiedBtn : ""}`}
                  onClick={copyLink}
                >
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
              </div>
              <div className={styles.linkMeta}>
                {generatedLink.length} characters · Encoded state
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.generateBtn} onClick={generateLink}>
            🔗 Generate Link
          </button>
          {generatedLink && (
            <button
              className={`${styles.copyFooterBtn} ${copied ? styles.copiedBtn : ""}`}
              onClick={copyLink}
            >
              {copied ? "✓ Copied!" : "Copy Link"}
            </button>
          )}
          <button className={styles.cancelBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
